-- Corrige políticas RLS da tabela eventos_score para permitir INSERT
-- Fix para o erro: "new row violates row-level security policy for table eventos_score"

-- Remove a política existente que só permite SELECT
DROP POLICY IF EXISTS "Admins can view score events" ON eventos_score;

-- Cria nova política que permite INSERT e SELECT para usuários autenticados
CREATE POLICY IF NOT EXISTS "Admins can manage score events" 
ON eventos_score 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Também permite para funções do sistema (quando executadas por triggers)
CREATE POLICY IF NOT EXISTS "System can insert score events" 
ON eventos_score 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Política para aplicações/serviços
CREATE POLICY IF NOT EXISTS "Service role can manage score events" 
ON eventos_score 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
