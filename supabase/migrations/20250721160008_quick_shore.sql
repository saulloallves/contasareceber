-- Módulo de Integrações - Comunicação e Orquestração Externa

-- Tabela de configurações de integrações
CREATE TABLE IF NOT EXISTS integracoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('supabase', 'n8n', 'whatsapp', 'email', 'notion', 'webhook')),
  ativo BOOLEAN DEFAULT true,
  configuracoes JSONB DEFAULT '{}',
  status_conexao TEXT DEFAULT 'falha' CHECK (status_conexao IN ('conectado', 'alerta', 'falha')),
  ultima_verificacao TIMESTAMPTZ,
  ultima_sincronizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de execuções
CREATE TABLE IF NOT EXISTS historico_integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id UUID REFERENCES integracoes_config(id) ON DELETE CASCADE,
  tipo_acao TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'pendente')),
  payload_envio JSONB,
  resposta_api JSONB,
  erro_detalhes TEXT,
  tempo_resposta INTEGER, -- em millisegundos
  data_execucao TIMESTAMPTZ DEFAULT now(),
  usuario_responsavel TEXT
);

-- Tabela de gatilhos de automação
CREATE TABLE IF NOT EXISTS gatilhos_automacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  evento_trigger TEXT NOT NULL CHECK (evento_trigger IN ('novo_debito', 'reuniao_marcada', 'status_alterado', 'upload_planilha', 'escalonamento')),
  condicoes JSONB DEFAULT '[]',
  acoes JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de integrações
CREATE TABLE IF NOT EXISTS logs_integracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_nome TEXT NOT NULL,
  acao TEXT NOT NULL,
  usuario TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_origem TEXT,
  data_acao TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_integracoes_tipo ON integracoes_config(tipo);
CREATE INDEX IF NOT EXISTS idx_integracoes_status ON integracoes_config(status_conexao);
CREATE INDEX IF NOT EXISTS idx_historico_integracao_id ON historico_integracoes(integracao_id);
CREATE INDEX IF NOT EXISTS idx_historico_data_execucao ON historico_integracoes(data_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_historico_status ON historico_integracoes(status);
CREATE INDEX IF NOT EXISTS idx_gatilhos_evento ON gatilhos_automacao(evento_trigger);
CREATE INDEX IF NOT EXISTS idx_logs_integracoes_data ON logs_integracoes(data_acao DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_integracoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integracoes_config_updated_at
  BEFORE UPDATE ON integracoes_config
  FOR EACH ROW
  EXECUTE FUNCTION update_integracoes_updated_at();

CREATE TRIGGER update_gatilhos_automacao_updated_at
  BEFORE UPDATE ON gatilhos_automacao
  FOR EACH ROW
  EXECUTE FUNCTION update_integracoes_updated_at();

-- RLS (Row Level Security)
ALTER TABLE integracoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatilhos_automacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_integracoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage integracoes config" ON integracoes_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view historico integracoes" ON historico_integracoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert historico integracoes" ON historico_integracoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can manage gatilhos automacao" ON gatilhos_automacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "System can insert logs integracoes" ON logs_integracoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can view logs integracoes" ON logs_integracoes
  FOR SELECT TO authenticated USING (true);

-- Inserir integrações padrão
INSERT INTO integracoes_config (nome, tipo, configuracoes) VALUES
('Supabase Principal', 'supabase', '{
  "url": "",
  "anon_key": "",
  "service_role_key": "",
  "schema": "public",
  "tabela_principal": "cobrancas_franqueados"
}'),
('WhatsApp Business', 'whatsapp', '{
  "provider": "meta",
  "numero_autenticado": "",
  "token_api": "",
  "id_remetente": "",
  "templates_mensagem": []
}'),
('Email SMTP', 'email', '{
  "servidor_smtp": "smtp.gmail.com",
  "porta": 587,
  "usuario": "",
  "senha": "",
  "nome_remetente": "Sistema de Cobrança",
  "email_padrao": "",
  "email_retorno": "",
  "ssl_ativo": true
}'),
('n8n Workflows', 'n8n', '{
  "url_base": "",
  "token_autenticacao": "",
  "webhook_url": "",
  "workflows_ativos": []
}'),
('Notion Database', 'notion', '{
  "token_integracao": "",
  "database_url": "",
  "database_id": "",
  "campos_vinculados": []
}')
ON CONFLICT DO NOTHING;

-- Inserir gatilhos padrão
INSERT INTO gatilhos_automacao (nome, evento_trigger, condicoes, acoes) VALUES
('Envio WhatsApp Novo Débito', 'novo_debito', '[
  {"campo": "valor_atualizado", "operador": "maior", "valor": 0},
  {"campo": "telefone", "operador": "diferente", "valor": null}
]', '[
  {"tipo": "whatsapp", "configuracao": {"template": "cobranca_automatica"}}
]'),
('Notificação Email Escalonamento', 'escalonamento', '[
  {"campo": "nivel", "operador": "igual", "valor": "juridico"}
]', '[
  {"tipo": "email", "configuracao": {"template": "escalonamento_juridico", "destinatario": "juridico@empresa.com"}}
]'),
('Webhook Status Alterado', 'status_alterado', '[
  {"campo": "status", "operador": "igual", "valor": "quitado"}
]', '[
  {"tipo": "webhook", "configuracao": {"url": "", "metodo": "POST"}}
]')
ON CONFLICT DO NOTHING;

-- Comentários nas tabelas
COMMENT ON TABLE integracoes_config IS 'Configurações das integrações externas do sistema';
COMMENT ON TABLE historico_integracoes IS 'Histórico de execuções e chamadas das integrações';
COMMENT ON TABLE gatilhos_automacao IS 'Configuração de gatilhos automáticos baseados em eventos';
COMMENT ON TABLE logs_integracoes IS 'Logs de alterações nas configurações de integrações';

COMMENT ON COLUMN integracoes_config.configuracoes IS 'Configurações específicas de cada tipo de integração em formato JSON';
COMMENT ON COLUMN historico_integracoes.payload_envio IS 'Dados enviados para a integração';
COMMENT ON COLUMN historico_integracoes.resposta_api IS 'Resposta recebida da API externa';
COMMENT ON COLUMN gatilhos_automacao.condicoes IS 'Condições que devem ser atendidas para disparar o gatilho';
COMMENT ON COLUMN gatilhos_automacao.acoes IS 'Ações a serem executadas quando o gatilho for ativado';