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

function connectionStringFromParts() {
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
    const enc = encodeURIComponent(pw);
    /* Direct host db.<ref>.supabase.co is often IPv6-only; many home networks time out on IPv6.
       Session pooler (Dashboard → Database → "Session pooler") has IPv4 — set SUPABASE_POOLER_HOST. */
    const pooler = (process.env.SUPABASE_POOLER_HOST || "").trim();
    if (pooler) {
      const poolUser = encodeURIComponent(`postgres.${ref}`);
      return `postgresql://${poolUser}:${enc}@${pooler}:5432/postgres`;
    }
    return `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`;
  } catch {
    return null;
  }
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

  const clientConfig = await pgClientConfig(connectionString);
  const client = new Client(clientConfig);

  console.log("Connecting…");
  await client.connect();
  console.log(`Applying SQL (${path.relative(root, sqlPath)})…`);
  try {
    await client.query(sql);
  } catch (e) {
    console.error("\nApply failed:", e.message);
    if (/already exists/i.test(String(e.message))) {
      console.error(`
Looks like part of the schema is already there. Options:
- In Supabase → SQL Editor, run only: NOTIFY pgrst, 'reload schema';
- Or fix the error above (duplicate object), then run this script again.
`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }

  if (/notify\s+pgrst/i.test(sql)) {
    console.log("\nDone. PostgREST schema reload was included in this file.");
  } else {
    console.log("\nDone.");
  }
  console.log("Refresh https://license.fyi or http://127.0.0.1:3000/dashboard\n");
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
