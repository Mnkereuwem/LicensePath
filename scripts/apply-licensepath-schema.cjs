/**
 * Applies supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql using a direct Postgres connection.
 * Same effect as pasting that file into Supabase → SQL Editor → Run.
 *
 * Requires DATABASE_URL in .env.local (Session pooler or Direct URI from Dashboard → Database).
 */
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const net = require("net");
const parse = require("pg-connection-string").parse;
const { Client } = require("pg");
const { createClient } = require("@supabase/supabase-js");

/* Prefer IPv4: direct DB host often resolves AAAA first; Windows/home networks may time out on IPv6 */
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/**
 * Resolve DB hostname to A record and connect by IP so Node/pg does not hang on broken IPv6 routes.
 * TLS SNI must still use the real hostname when connecting by IP.
 */
async function pgClientConfig(connectionString) {
  const useSsl = !/^postgres(ql)?:\/\/[^@]+@localhost/i.test(connectionString);
  const cfg = parse(connectionString);
  if (!useSsl) {
    return { ...cfg, ssl: undefined };
  }
  const hostname = cfg.host;
  if (!hostname || net.isIP(hostname)) {
    return { ...cfg, ssl: { rejectUnauthorized: false } };
  }
  try {
    const { address } = await dns.promises.lookup(hostname, { family: 4 });
    return {
      ...cfg,
      host: address,
      ssl: { rejectUnauthorized: false, servername: hostname },
    };
  } catch {
    return { ...cfg, ssl: { rejectUnauthorized: false } };
  }
}

const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (const line of text.split(/\r?\n/)) {
    let t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (/^export\s+/i.test(t)) t = t.replace(/^export\s+/i, "");
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    /* .env.local wins over inherited machine env (e.g. wrong SUPABASE_POOLER_HOST) */
    process.env[key] = val;
  }
}

function commentedDatabaseUrlHint() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return "";
  const text = fs.readFileSync(p, "utf8");
  if (/^\s*#\s*DATABASE_URL=/m.test(text)) {
    return "\n(Hint: DATABASE_URL is still commented out with # — remove the # at the start of that line and save the file.)\n";
  }
  return "";
}

/**
 * If DATABASE_URL points at db.<ref>.supabase.co but SUPABASE_POOLER_HOST is set, rewrite to
 * Session pooler URI (user postgres.<ref>, port 5432) so IPv4 works.
 */
function rewriteDirectUrlForPooler(connectionString, poolerHost) {
  const pooler = (poolerHost || "").trim();
  if (!pooler || !connectionString) return connectionString;
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    const m = /^db\.([^.]+)\.supabase\.co$/i.exec(u.hostname);
    if (!m) return connectionString;
    const ref = m[1];
    const pw =
      u.password === ""
        ? ""
        : decodeURIComponent(u.password.replace(/\+/g, " "));
    const enc = encodeURIComponent(pw);
    const poolUser = encodeURIComponent(`postgres.${ref}`);
    return `postgresql://${poolUser}:${enc}@${pooler}:5432/postgres`;
  } catch {
    return connectionString;
  }
}

function supabaseRefPasswordFromEnv() {
  const pw =
    process.env.SUPABASE_DB_PASSWORD ||
    process.env.DATABASE_PASSWORD ||
    "";
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!pw || !pub) return null;
  try {
    const host = new URL(pub).hostname;
    const ref = host.split(".")[0];
    if (!ref) return null;
    return { ref, pw };
  } catch {
    return null;
  }
}

function connectionStringFromParts() {
  const parts = supabaseRefPasswordFromEnv();
  if (!parts) return null;
  const { ref, pw } = parts;
  const enc = encodeURIComponent(pw);
  /* Direct host db.<ref>.supabase.co is often IPv6-only; many home networks time out on IPv6.
     Session pooler (Dashboard → Database → "Session pooler") has IPv4 — set SUPABASE_POOLER_HOST. */
  const pooler = (process.env.SUPABASE_POOLER_HOST || "").trim();
  if (pooler) {
    const poolUser = encodeURIComponent(`postgres.${ref}`);
    return `postgresql://${poolUser}:${enc}@${pooler}:5432/postgres`;
  }
  return `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`;
}

/**
 * Session pooler user postgres.<ref> cannot ALTER storage.buckets / policies.
 * The database role `postgres` on db.<ref>.supabase.co can (when reachable via IPv4).
 */
function postgresOwnerDirectUrlFromEnv() {
  const parts = supabaseRefPasswordFromEnv();
  if (!parts) return null;
  const { ref, pw } = parts;
  const enc = encodeURIComponent(pw);
  return `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`;
}

/**
 * If DATABASE_URL uses postgres.<projectRef>@pooler, derive the direct `postgres` URI
 * (same password) so storage DDL can run without NEXT_PUBLIC_SUPABASE_URL in .env.local.
 */
function postgresOwnerDirectUrlFromPoolerUri(connectionString) {
  if (!connectionString) return null;
  try {
    const normalized = connectionString.replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    const user = decodeURIComponent(u.username || "");
    const m = /^postgres\.([^@\s/]+)$/i.exec(user);
    if (!m) return null;
    const ref = m[1];
    const pw =
      u.password === ""
        ? ""
        : decodeURIComponent(u.password.replace(/\+/g, " "));
    const enc = encodeURIComponent(pw);
    return `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`;
  } catch {
    return null;
  }
}

function storageOwnerRetryMessage(msg) {
  return /must be owner of relation|permission denied for schema storage/i.test(
    String(msg),
  );
}

/**
 * Hosted Supabase often denies INSERT into storage.buckets to pooler / postgres DB roles.
 * The dashboard Storage API (service_role) can create the bucket; policies still run over SQL.
 */
async function ensureBbsUploadsBucketViaApi() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (Dashboard → Settings → API).",
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw new Error(listErr.message);
  if (buckets?.some((b) => b.id === "bbs-uploads")) {
    console.log("Storage bucket bbs-uploads already exists (API).");
    return;
  }
  const { error: createErr } = await supabase.storage.createBucket("bbs-uploads", {
    public: false,
  });
  if (createErr && !/already exists/i.test(String(createErr.message))) {
    throw new Error(createErr.message);
  }
  console.log("Created storage bucket bbs-uploads via Storage API.");
}

/** Strip bucket row + bucket comment (both need storage owner); keep policies + notify. */
function bbsUploadsPoliciesSql(fullSql) {
  return fullSql
    .replace(
      /insert\s+into\s+storage\.buckets[\s\S]*?on\s+conflict\s*\([^)]*\)\s*do\s+nothing\s*;/gi,
      "",
    )
    .replace(/comment\s+on\s+column\s+storage\.buckets\.name[\s\S]*?;/gi, "")
    .trim();
}

async function main() {
  loadEnvLocal();

  /* Prefer plain password + project URL: avoids broken pooler URIs and encoding mistakes */
  let connectionString = connectionStringFromParts() || "";
  if (!connectionString) {
    connectionString =
      process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";
  }

  connectionString = rewriteDirectUrlForPooler(
    connectionString,
    process.env.SUPABASE_POOLER_HOST,
  );

  if (!connectionString) {
    console.error(`
No database connection configured. Use EITHER:

A) DATABASE_URL=postgresql://...   (full URI from Dashboard → Database)

OR (easier — avoids URL encoding issues):

B) Add your NEXT_PUBLIC_SUPABASE_URL (already set) plus the plain DB password:

   SUPABASE_DB_PASSWORD=your_database_password_here

   If “Connecting…” hangs or ETIMEDOUT: direct db host can be IPv6-only. Add the Session pooler host
   from Dashboard → Database (e.g. aws-0-us-east-1.pooler.supabase.com — use your project’s region):

   SUPABASE_POOLER_HOST=aws-0-REGION.pooler.supabase.com

   (Same DB password as Dashboard → Database — not the API secret.)

Then run: npm run db:apply
${commentedDatabaseUrlHint()}`);
    process.exit(1);
  }

  const sqlPath = process.argv[2]
    ? path.isAbsolute(process.argv[2])
      ? process.argv[2]
      : path.join(root, process.argv[2])
    : path.join(root, "supabase", "RUN_IN_SUPABASE_SQL_EDITOR.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("Missing file:", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  const bbsUploadsHybrid = /bbs_uploads_bucket\.sql$/i.test(sqlPath);

  async function applyWithUri(uri, label, sqlText) {
    const run = typeof sqlText === "string" ? sqlText : sql;
    const clientConfig = await pgClientConfig(uri);
    const client = new Client(clientConfig);
    console.log(label ? `Connecting (${label})…` : "Connecting…");
    await client.connect();
    console.log(`Applying SQL (${path.relative(root, sqlPath)})…`);
    try {
      await client.query(run);
    } finally {
      await client.end();
    }
  }

  function printDone(sqlRun) {
    if (/notify\s+pgrst/i.test(sqlRun)) {
      console.log("\nDone. PostgREST schema reload was included in this file.");
    } else {
      console.log("\nDone.");
    }
    console.log("Refresh https://license.fyi or http://127.0.0.1:3000/dashboard\n");
  }

  const ownerUrl =
    postgresOwnerDirectUrlFromEnv() ||
    postgresOwnerDirectUrlFromPoolerUri(connectionString);

  try {
    await applyWithUri(connectionString, null, sql);
    printDone(sql);
  } catch (e) {
    let done = false;

    if (
      storageOwnerRetryMessage(e.message) &&
      ownerUrl &&
      ownerUrl !== connectionString
    ) {
      console.warn(
        "\nPooler role cannot modify storage; retrying with postgres@db.<ref> (IPv4)…",
      );
      try {
        await applyWithUri(ownerUrl, "postgres owner", sql);
        printDone(sql);
        done = true;
      } catch (e2) {
        console.warn("\npostgres@db:", e2.message);
      }
    }

    if (!done && bbsUploadsHybrid && storageOwnerRetryMessage(e.message)) {
      const polSql = bbsUploadsPoliciesSql(sql);
      if (polSql.includes("create policy")) {
        console.warn(
          "\nTrying Storage API for bucket + Postgres for policies (hosted Supabase)…",
        );
        try {
          await ensureBbsUploadsBucketViaApi();
          const uris = [connectionString, ownerUrl].filter(
            (u, i, a) => u && a.indexOf(u) === i,
          );
          let lastPe = null;
          for (const uri of uris) {
            const lbl =
              uri === ownerUrl ? "policies (postgres@db)" : "policies (pooler)";
            try {
              await applyWithUri(uri, lbl, polSql);
              printDone(polSql);
              done = true;
              break;
            } catch (pe) {
              lastPe = pe;
              console.warn("Policies apply:", pe.message);
            }
          }
          if (!done && lastPe) throw lastPe;
        } catch (hybridErr) {
          console.error("\nHybrid storage setup failed:", hybridErr.message);
          console.error(`
Add SUPABASE_SERVICE_ROLE_KEY to .env.local, or paste this migration into Supabase → SQL Editor.
`);
          process.exit(1);
        }
      }
    }

    if (!done) {
      console.error("\nApply failed:", e.message);
      if (/already exists/i.test(String(e.message))) {
        console.error(`
Looks like part of the schema is already there. Options:
- In Supabase → SQL Editor, run only: NOTIFY pgrst, 'reload schema';
- Or fix the error above (duplicate object), then run this script again.
`);
      }
      if (storageOwnerRetryMessage(e.message) && !ownerUrl && !bbsUploadsHybrid) {
        console.error(`
Storage DDL needs the database postgres user. Set NEXT_PUBLIC_SUPABASE_URL and
SUPABASE_DB_PASSWORD in .env.local, or paste this file into Supabase → SQL Editor.
`);
      }
      if (storageOwnerRetryMessage(e.message) && bbsUploadsHybrid) {
        console.error(`
For bbs-uploads: add SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run npm run db:bbs-uploads,
or run the SQL file in Supabase → SQL Editor.
`);
      }
      process.exit(1);
    }
  }
}

main().catch((e) => {
  const msg = String(e && e.message);
  console.error(e);
  if (/ETIMEDOUT|getaddrinfo/i.test(msg) && !process.env.SUPABASE_POOLER_HOST) {
    console.error(`
Tip: Direct db.<project>.supabase.co often has no IPv4 address. Set in .env.local:

  SUPABASE_POOLER_HOST=<Session pooler host from Supabase Dashboard → Database>

Then: npm run db:apply
`);
  }
  if (/Tenant or user not found/i.test(msg)) {
    console.error(`
Tip: Wrong pooler region — copy the exact “Session pooler” host from Dashboard → Database
for this project (do not guess aws-0-*). Or paste that full connection string as DATABASE_URL.
`);
  }
  process.exit(1);
});
