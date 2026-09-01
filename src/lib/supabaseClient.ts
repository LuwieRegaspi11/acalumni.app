// Single shared Supabase client for the whole app.
// Reads the project URL and public anon key from environment variables
// (see .env.example) — never hardcode real keys here.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup instead of silently breaking every login
  // attempt, so a missing .env file is obvious immediately.
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env ' +
    'and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. See ' +
    'DATABASE-SETUP.md for the full walkthrough.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
