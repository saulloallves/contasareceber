/*
  # Correção do Sistema de Sessões e Limpeza
  
  2. Correções
    - Ajusta políticas RLS para melhor performance
    - Adiciona índices para otimização
    - Corrige lógica de sessões online
*/

-- Adiciona índice para melhorar performance das consultas de usuários online
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_online 
ON sessoes_usuario (ativa, data_ultimo_acesso DESC) 
WHERE ativa = true;

-- Adiciona índice composto para otimizar busca por usuário ativo
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_ativo_recente 
ON sessoes_usuario (usuario_id, ativa, data_ultimo_acesso DESC);

-- Remove a função antiga ANTES de tentar criar a nova com o tipo de retorno diferente.
DROP FUNCTION IF EXISTS limpar_sessoes_expiradas();

-- Função para limpeza automática de sessões (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION limpar_sessoes_expiradas()
RETURNS INTEGER AS $$
DECLARE
  sessoes_limpas INTEGER;
BEGIN
  -- Desativa sessões sem heartbeat há mais de 10 minutos
  UPDATE sessoes_usuario 
  SET ativa = false 
  WHERE ativa = true 
    AND data_ultimo_acesso < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS sessoes_limpas = ROW_COUNT;
  
  -- Remove sessões inativas antigas (mais de 7 dias)
  DELETE FROM sessoes_usuario 
  WHERE ativa = false 
    AND data_inicio < NOW() - INTERVAL '7 days';
  
  RETURN sessoes_limpas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualiza a política RLS para ser mais eficiente
DROP POLICY IF EXISTS "Usuários podem gerenciar próprias sessões" ON sessoes_usuario;

CREATE POLICY "Usuários podem gerenciar próprias sessões" 
ON sessoes_usuario 
FOR ALL 
TO authenticated 
USING (
  usuario_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM usuarios_sistema 
    WHERE id = auth.uid() 
    AND nivel_permissao = 'admin_master'
  )
) 
WITH CHECK (
  usuario_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM usuarios_sistema 
    WHERE id = auth.uid() 
    AND nivel_permissao = 'admin_master'
  )
);

-- Adiciona trigger para limpeza automática (opcional)
CREATE OR REPLACE FUNCTION trigger_limpar_sessoes_automatico()
RETURNS TRIGGER AS $$
BEGIN
  -- A cada 100 inserções, executa limpeza automática
  IF (SELECT COUNT(*) FROM sessoes_usuario) % 100 = 0 THEN
    PERFORM limpar_sessoes_expiradas();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger (comentado por padrão para não sobrecarregar)
-- DROP TRIGGER IF EXISTS trigger_limpeza_automatica_sessoes ON sessoes_usuario;
-- CREATE TRIGGER trigger_limpeza_automatica_sessoes
--   AFTER INSERT ON sessoes_usuario
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_limpar_sessoes_automatico();

-- Insere configuração padrão de segurança se não existir
INSERT INTO configuracao_seguranca (id) 
VALUES ('default') 
ON CONFLICT (id) DO NOTHING;