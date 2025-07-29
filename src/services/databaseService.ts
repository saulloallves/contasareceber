import { createClient } from "@supabase/supabase-js";

// O jeito do Vite de acessar variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

// O jeito do Vite de checar o modo de desenvolvimento (retorna true ou false)
const isDevelopment = import.meta.env.DEV;

// A lógica continua a mesma, apenas a forma de acessar as variáveis mudou
const supabaseKey =
  isDevelopment && supabaseServiceKey ? supabaseServiceKey : supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL and Key must be defined in your environment variables. Make sure to create a .env.local file."
  );
}

// Crie o cliente com a chave apropriada
export const supabase = createClient(supabaseUrl, supabaseKey);
