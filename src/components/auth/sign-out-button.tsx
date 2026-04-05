"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          const supabase = createBrowserSupabaseClient();
          await supabase.auth.signOut();
        } catch {
          /* missing env in dev */
        }
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-3.5 opacity-70" />
      Sign out
    </Button>
  );
}
