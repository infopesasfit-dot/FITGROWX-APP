import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("role");
    
  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }

  const roles = {};
  data.forEach(p => {
    const r = p.role || "null";
    roles[r] = (roles[r] || 0) + 1;
  });

  console.log("role,cantidad");
  Object.entries(roles)
    .sort(([, a], [, b]) => b - a)
    .forEach(([role, count]) => {
      console.log(`${role},${count}`);
    });
})();
