import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn(
    "Supabase env vars are missing. Running in local fallback mode without Supabase."
  );
}

function createSupabaseClientSafe() {
  if (!hasSupabaseConfig) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn("Supabase config is invalid. Running in local fallback mode.", error);
    return null;
  }
}

export const supabase = createSupabaseClientSafe();
