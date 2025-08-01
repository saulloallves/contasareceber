-- Tabela para registrar o histórico de envios de mensagens (WhatsApp, Email, etc.)
CREATE TABLE IF NOT EXISTS envios_mensagem (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    titulo_id BIGINT NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
    tipo_envio VARCHAR(50) NOT NULL, -- 'pre_vencimento_1d', 'pos_vencimento_1d', 'pos_vencimento_3d', 'pos_vencimento_7d'
    mensagem_enviada TEXT NOT NULL,
    status_envio VARCHAR(20) NOT NULL CHECK (status_envio IN ('sucesso', 'falha')),
    erro_detalhes TEXT,
    data_envio TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela para armazenar alertas do sistema para ação da equipe interna
CREATE TABLE IF NOT EXISTS alertas_sistema (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    tipo_alerta VARCHAR(50) NOT NULL, -- 'sem_retorno_10d'
    titulo_id BIGINT REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
    cnpj_unidade VARCHAR(18),
    descricao TEXT NOT NULL,
    nivel_urgencia VARCHAR(20) NOT NULL CHECK (nivel_urgencia IN ('baixa', 'media', 'alta')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('novo', 'em_andamento', 'resolvido')),
    data_criacao TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_resolucao TIMESTAMPTZ,
    resolvido_por_id UUID REFERENCES auth.users(id)
);

-- Adicionar comentários para clareza
COMMENT ON TABLE envios_mensagem IS 'Registra todos os lembretes automáticos enviados aos clientes.';
COMMENT ON COLUMN envios_mensagem.tipo_envio IS 'Identifica o gatilho do lembrete (ex: 1 dia antes do vencimento).';

COMMENT ON TABLE alertas_sistema IS 'Armazena alertas para a equipe interna sobre cobranças críticas.';
COMMENT ON COLUMN alertas_sistema.tipo_alerta IS 'Categoriza o tipo de alerta (ex: mais de 10 dias sem retorno).';
COMMENT ON COLUMN alertas_sistema.status IS 'Status atual do alerta (novo, em andamento, resolvido).';

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_envios_mensagem_titulo_tipo ON envios_mensagem(titulo_id, tipo_envio);
CREATE INDEX IF NOT EXISTS idx_alertas_sistema_status ON alertas_sistema(status);
CREATE INDEX IF NOT EXISTS idx_alertas_sistema_tipo_alerta ON alertas_sistema(tipo_alerta);
