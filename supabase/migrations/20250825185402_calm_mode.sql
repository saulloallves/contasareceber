/*
  # Correção para sessões duplicadas

  1. Limpeza de Dados
    - Remove sessões duplicadas existentes
    - Mantém apenas a sessão mais recente por usuário

  2. Índices e Constraints
    - Cria índice único para garantir apenas uma sessão ativa por usuário
    - Adiciona trigger para desativar sessões anteriores automaticamente

  3. Funções de Manutenção
    - Função para limpeza automática de sessões expiradas
    - Trigger para garantir unicidade de sessões ativas
*/

-- Remove sessões duplicadas mantendo apenas a mais recente por usuário
WITH sessoes_duplicadas AS (
  SELECT 
    id,
    usuario_id,
    ROW_NUMBER() OVER (
      PARTITION BY usuario_id 
      ORDER BY data_ultimo_acesso DESC, created_at DESC
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

-- Cria índice único para garantir apenas uma sessão ativa por usuário
DROP INDEX IF EXISTS idx_sessoes_usuario_unico_ativo;
CREATE UNIQUE INDEX idx_sessoes_usuario_unico_ativo 
ON sessoes_usuario (usuario_id) 
WHERE ativa = true;

-- Função para garantir sessão única
CREATE OR REPLACE FUNCTION garantir_sessao_unica()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está inserindo ou ativando uma sessão
  IF (TG_OP = 'INSERT' AND NEW.ativa = true) OR 
     (TG_OP = 'UPDATE' AND OLD.ativa = false AND NEW.ativa = true) THEN
    
    -- Desativa todas as outras sessões ativas do mesmo usuário
    UPDATE sessoes_usuario 
    SET ativa = false 
    WHERE usuario_id = NEW.usuario_id 
      AND ativa = true 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
      
    -- Log da operação
    RAISE NOTICE 'Sessões anteriores desativadas para usuário %', NEW.usuario_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger existente se houver
DROP TRIGGER IF EXISTS trigger_garantir_sessao_unica ON sessoes_usuario;

-- Cria trigger para garantir sessão única
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
  -- Desativa sessões com último acesso há mais de 4 horas
  UPDATE sessoes_usuario 
  SET ativa = false 
  WHERE ativa = true 
    AND data_ultimo_acesso < NOW() - INTERVAL '4 hours';
  
  GET DIAGNOSTICS sessoes_limpas = ROW_COUNT;
  
  -- Remove fisicamente sessões inativas há mais de 7 dias
  DELETE FROM sessoes_usuario 
  WHERE ativa = false 
    AND data_ultimo_acesso < NOW() - INTERVAL '7 days';
  
  RETURN sessoes_limpas;
END;
$$ LANGUAGE plpgsql;

-- Cria extensão pg_cron se não existir (para limpeza automática)
-- Nota: Esta extensão pode não estar disponível em todos os ambientes
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agenda limpeza automática a cada hora (descomente se pg_cron estiver disponível)
-- SELECT cron.schedule('limpar-sessoes-expiradas', '0 * * * *', 'SELECT limpar_sessoes_expiradas();');

-- Adiciona comentário ao índice único
COMMENT ON INDEX idx_sessoes_usuario_unico_ativo IS 'Índice único para garantir apenas uma sessão ativa por usuário';

-- Adiciona comentários às funções
COMMENT ON FUNCTION garantir_sessao_unica() IS 'Garante que cada usuário tenha apenas uma sessão ativa por vez';
COMMENT ON FUNCTION limpar_sessoes_expiradas() IS 'Remove sessões expiradas automaticamente';

-- Executa limpeza inicial
SELECT limpar_sessoes_expiradas();