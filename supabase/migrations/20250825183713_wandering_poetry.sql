/*
  # Correção do sistema de sessões duplicadas

  1. Limpeza de Dados
    - Remove sessões duplicadas mantendo apenas a mais recente por usuário
    - Desativa sessões órfãs (sem usuário válido)

  2. Melhorias na Estrutura
    - Adiciona índice único para evitar múltiplas sessões ativas por usuário
    - Melhora performance das consultas de sessão

  3. Função de Limpeza
    - Cria função para limpeza automática de sessões expiradas
    - Implementa trigger para manter apenas uma sessão ativa por usuário
*/

-- Primeiro, desativa todas as sessões ativas duplicadas, mantendo apenas a mais recente
WITH sessoes_duplicadas AS (
  SELECT 
    id,
    usuario_id,
    data_inicio,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id 
      ORDER BY data_inicio DESC, created_at DESC
    ) as rn
  FROM sessoes_usuario 
  WHERE ativa = true
)
UPDATE sessoes_usuario 
SET ativa = false 
WHERE id IN (
  SELECT id 
  FROM sessoes_duplicadas 
  WHERE rn > 1
);

-- Remove sessões órfãs (usuários que não existem mais)
UPDATE sessoes_usuario 
SET ativa = false 
WHERE usuario_id NOT IN (
  SELECT id FROM usuarios_sistema
);

-- Cria índice único para evitar múltiplas sessões ativas por usuário
DROP INDEX IF EXISTS idx_sessoes_usuario_unico_ativo;
CREATE UNIQUE INDEX idx_sessoes_usuario_unico_ativo 
ON sessoes_usuario (usuario_id) 
WHERE ativa = true;

-- Função para garantir apenas uma sessão ativa por usuário
CREATE OR REPLACE FUNCTION garantir_sessao_unica()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está inserindo uma nova sessão ativa
  IF NEW.ativa = true THEN
    -- Desativa todas as outras sessões ativas do mesmo usuário
    UPDATE sessoes_usuario 
    SET ativa = false 
    WHERE usuario_id = NEW.usuario_id 
      AND ativa = true 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar a função antes de inserir/atualizar
DROP TRIGGER IF EXISTS trigger_garantir_sessao_unica ON sessoes_usuario;
CREATE TRIGGER trigger_garantir_sessao_unica
  BEFORE INSERT OR UPDATE ON sessoes_usuario
  FOR EACH ROW
  EXECUTE FUNCTION garantir_sessao_unica();

-- Função para limpeza automática de sessões expiradas
CREATE OR REPLACE FUNCTION limpar_sessoes_expiradas()
RETURNS INTEGER AS $$
DECLARE
  sessoes_limpas INTEGER;
BEGIN
  -- Considera expirada se último acesso foi há mais de 2 horas
  UPDATE sessoes_usuario 
  SET ativa = false 
  WHERE ativa = true 
    AND data_ultimo_acesso < NOW() - INTERVAL '2 hours';
  
  GET DIAGNOSTICS sessoes_limpas = ROW_COUNT;
  
  -- Remove fisicamente sessões inativas antigas (mais de 7 dias)
  DELETE FROM sessoes_usuario 
  WHERE ativa = false 
    AND created_at < NOW() - INTERVAL '7 days';
  
  RETURN sessoes_limpas;
END;
$$ LANGUAGE plpgsql;

-- Melhora índices para performance
DROP INDEX IF EXISTS idx_sessoes_usuario_cleanup;
CREATE INDEX idx_sessoes_usuario_cleanup 
ON sessoes_usuario (ativa, data_ultimo_acesso) 
WHERE ativa = true;

-- Adiciona comentários para documentação
COMMENT ON FUNCTION garantir_sessao_unica() IS 'Garante que cada usuário tenha apenas uma sessão ativa por vez';
COMMENT ON FUNCTION limpar_sessoes_expiradas() IS 'Remove sessões expiradas automaticamente';
COMMENT ON INDEX idx_sessoes_usuario_unico_ativo IS 'Índice único para garantir apenas uma sessão ativa por usuário';