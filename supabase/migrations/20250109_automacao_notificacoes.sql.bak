-- Migração para suporte à automação de notificações
-- Data: 2025-01-09
-- Descrição: Adiciona coluna para controle de último disparo de notificação

-- Adiciona coluna ultimo_disparo_dia se não existir
ALTER TABLE cobrancas_franqueados 
ADD COLUMN IF NOT EXISTS ultimo_disparo_dia INTEGER;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN cobrancas_franqueados.notificacao_automatica_whatsapp IS 'Controle de marcos de notificação via WhatsApp: {"3": false, "7": false, "15": false, "30": false}';
COMMENT ON COLUMN cobrancas_franqueados.notificacao_automatica_email IS 'Controle de marcos de notificação via Email: {"3": false, "7": false, "15": false, "30": false}';
COMMENT ON COLUMN cobrancas_franqueados.ultimo_disparo_dia IS 'Último dia de disparo realizado (3, 7, 15 ou 30)';

-- Cria índice para melhorar performance das consultas de automação
CREATE INDEX IF NOT EXISTS idx_cobrancas_status_created_at 
ON cobrancas_franqueados (status, created_at) 
WHERE status = 'em_aberto';
