
import { createClient } from "@supabase/supabase-js";
import env from "./env.js";

const supabaseUrl = env.storage.supabaseUrl;
const supabaseSecretKey = env.storage.supabaseSecretKey;

const supabase = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export function getSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase storage is not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  return supabase;
}

export default supabase;
