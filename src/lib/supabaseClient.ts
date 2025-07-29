import { createClient } from "@supabase/supabase-js";

// O jeito do Vite de acessar variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL and Anon Key must be defined in your environment variables. Make sure to create a .env file."
  );
}

// Sempre usa Anon Key em produção (com autenticação)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;