import { createClient } from "@supabase/supabase-js";

// O jeito do Vite de acessar variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL and Anon Key must be defined in your environment variables. Make sure to create a .env file."
  );
}

// Em desenvolvimento, usa Service Role Key se disponível (para contornar RLS)
// Em produção, sempre usa Anon Key (com sistema de autenticação)
const isDevelopment = import.meta.env.DEV;
const useServiceKey = isDevelopment && supabaseServiceKey;

const supabaseKey = useServiceKey ? supabaseServiceKey : supabaseAnonKey;

if (useServiceKey) {
  console.warn('🔧 DESENVOLVIMENTO: Usando Service Role Key para contornar RLS');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;