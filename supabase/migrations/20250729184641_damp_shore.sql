/*
  # Criar tabelas para sistema de simulação de parcelamento

  1. Novas Tabelas
    - `simulacoes_parcelamento`
      - `id` (uuid, primary key)
      - `titulo_id` (uuid, foreign key para cobrancas_franqueados)
      - `cnpj_unidade` (text)
      - `valor_original` (numeric)
      - `valor_atualizado` (numeric)
      - `quantidade_parcelas` (integer)
      - `valor_entrada` (numeric, nullable)
      - `percentual_juros_parcela` (numeric)
      - `data_primeira_parcela` (date)
      - `parcelas` (jsonb)
      - `valor_total_parcelamento` (numeric)
      - `economia_total` (numeric, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `propostas_parcelamento`
      - `id` (uuid, primary key)
      - `simulacao_id` (uuid, foreign key para simulacoes_parcelamento)
      - `titulo_id` (uuid, foreign key para cobrancas_franqueados)
      - `cnpj_unidade` (text)
      - `mensagem_proposta` (text)
      - `canais_envio` (text array)
      - `data_envio` (timestamp, nullable)
      - `enviado_por` (text)
      - `status_proposta` (enum)
      - `data_expiracao` (timestamp)
      - `aceito_em` (timestamp, nullable)
      - `aceito_por` (text, nullable)
      - `ip_aceite` (text, nullable)
      - `observacoes_aceite` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `registros_aceite_parcelamento`
      - `id` (uuid, primary key)
      - `proposta_id` (uuid, foreign key para propostas_parcelamento)
      - `titulo_id` (uuid, foreign key para cobrancas_franqueados)
      - `cnpj_unidade` (text)
      - `data_aceite` (timestamp)
      - `ip_aceite` (text)
      - `user_agent` (text, nullable)
      - `metodo_aceite` (enum)
      - `dados_proposta` (jsonb)
      - `observacoes` (text, nullable)
      - `created_at` (timestamp)

    - `configuracao_parcelamento`
      - `id` (text, primary key)
      - `percentual_juros_parcela` (numeric)
      - `valor_minimo_parcela` (numeric)
      - `quantidade_maxima_parcelas` (integer)
      - `percentual_entrada_minimo` (numeric, nullable)
      - `dias_entre_parcelas` (integer)
      - `prazo_validade_proposta_dias` (integer)
      - `template_whatsapp` (text)
      - `template_email_assunto` (text)
      - `template_email_corpo` (text)
      - `ativo` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Adicionar políticas para usuários autenticados
*/

-- Criar enum para status da proposta
CREATE TYPE status_proposta_enum AS ENUM (
  'enviada',
  'aceita', 
  'recusada',
  'expirada'
);

-- Criar enum para método de aceite
CREATE TYPE metodo_aceite_enum AS ENUM (
  'whatsapp',
  'email',
  'painel',
  'telefone'
);

-- Tabela de simulações de parcelamento
CREATE TABLE IF NOT EXISTS simulacoes_parcelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade text NOT NULL,
  valor_original numeric NOT NULL DEFAULT 0,
  valor_atualizado numeric NOT NULL DEFAULT 0,
  quantidade_parcelas integer NOT NULL DEFAULT 2,
  valor_entrada numeric DEFAULT 0,
  percentual_juros_parcela numeric NOT NULL DEFAULT 3.0,
  data_primeira_parcela date NOT NULL,
  parcelas jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_total_parcelamento numeric NOT NULL DEFAULT 0,
  economia_total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de propostas de parcelamento
CREATE TABLE IF NOT EXISTS propostas_parcelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id uuid NOT NULL REFERENCES simulacoes_parcelamento(id) ON DELETE CASCADE,
  titulo_id uuid NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade text NOT NULL,
  mensagem_proposta text NOT NULL,
  canais_envio text[] NOT NULL DEFAULT '{}',
  data_envio timestamptz,
  enviado_por text NOT NULL,
  status_proposta status_proposta_enum NOT NULL DEFAULT 'enviada',
  data_expiracao timestamptz NOT NULL,
  aceito_em timestamptz,
  aceito_por text,
  ip_aceite text,
  observacoes_aceite text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de registros de aceite para auditoria
CREATE TABLE IF NOT EXISTS registros_aceite_parcelamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES propostas_parcelamento(id) ON DELETE CASCADE,
  titulo_id uuid NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade text NOT NULL,
  data_aceite timestamptz NOT NULL DEFAULT now(),
  ip_aceite text NOT NULL,
  user_agent text,
  metodo_aceite metodo_aceite_enum NOT NULL,
  dados_proposta jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- Tabela de configuração do parcelamento
CREATE TABLE IF NOT EXISTS configuracao_parcelamento (
  id text PRIMARY KEY DEFAULT 'default',
  percentual_juros_parcela numeric NOT NULL DEFAULT 3.0,
  valor_minimo_parcela numeric NOT NULL DEFAULT 200.0,
  quantidade_maxima_parcelas integer NOT NULL DEFAULT 6,
  percentual_entrada_minimo numeric DEFAULT 20.0,
  dias_entre_parcelas integer NOT NULL DEFAULT 30,
  prazo_validade_proposta_dias integer NOT NULL DEFAULT 7,
  template_whatsapp text NOT NULL DEFAULT '🏪 *PROPOSTA DE PARCELAMENTO*

Olá, {{cliente}}! 

Temos uma proposta especial para regularizar seu débito:

💰 *Valor Original:* R$ {{valor_original}}
💰 *Valor Atualizado:* R$ {{valor_atualizado}}

📋 *NOSSA PROPOSTA:*
{{#entrada}}💵 Entrada: R$ {{valor_entrada}}{{/entrada}}
📅 {{quantidade_parcelas}}x de R$ {{valor_parcela}}
📊 Juros: {{percentual_juros}}% por parcela
💳 Total: R$ {{valor_total}}

📅 *Primeira parcela:* {{data_primeira_parcela}}

✅ *Aceita a proposta?*
Responda SIM para confirmar.

⏰ Proposta válida até {{data_expiracao}}

_Equipe Financeira - Cresci e Perdi_',
  template_email_assunto text NOT NULL DEFAULT 'Proposta de Parcelamento - {{cliente}}',
  template_email_corpo text NOT NULL DEFAULT 'Prezado(a) {{cliente}},

Temos uma proposta especial para regularizar seu débito da unidade {{codigo_unidade}}.

DETALHES DA PROPOSTA:
- Valor Original: R$ {{valor_original}}
- Valor Atualizado: R$ {{valor_atualizado}}
{{#entrada}}- Entrada: R$ {{valor_entrada}}{{/entrada}}
- Parcelamento: {{quantidade_parcelas}}x de R$ {{valor_parcela}}
- Juros aplicado: {{percentual_juros}}% por parcela
- Valor Total: R$ {{valor_total}}
- Primeira parcela: {{data_primeira_parcela}}

Esta proposta é válida até {{data_expiracao}}.

Para aceitar, responda este email confirmando.

Atenciosamente,
Equipe Financeira',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO configuracao_parcelamento (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_simulacoes_titulo_id ON simulacoes_parcelamento(titulo_id);
CREATE INDEX IF NOT EXISTS idx_simulacoes_cnpj ON simulacoes_parcelamento(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_simulacoes_data ON simulacoes_parcelamento(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_propostas_simulacao_id ON propostas_parcelamento(simulacao_id);
CREATE INDEX IF NOT EXISTS idx_propostas_titulo_id ON propostas_parcelamento(titulo_id);
CREATE INDEX IF NOT EXISTS idx_propostas_cnpj ON propostas_parcelamento(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas_parcelamento(status_proposta);
CREATE INDEX IF NOT EXISTS idx_propostas_data ON propostas_parcelamento(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aceites_proposta_id ON registros_aceite_parcelamento(proposta_id);
CREATE INDEX IF NOT EXISTS idx_aceites_titulo_id ON registros_aceite_parcelamento(titulo_id);
CREATE INDEX IF NOT EXISTS idx_aceites_cnpj ON registros_aceite_parcelamento(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_aceites_data ON registros_aceite_parcelamento(data_aceite DESC);

-- Habilitar RLS
ALTER TABLE simulacoes_parcelamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_parcelamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_aceite_parcelamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_parcelamento ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para simulacoes_parcelamento
CREATE POLICY "Users can manage simulacoes data"
  ON simulacoes_parcelamento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas de segurança para propostas_parcelamento
CREATE POLICY "Users can manage propostas data"
  ON propostas_parcelamento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas de segurança para registros_aceite_parcelamento
CREATE POLICY "Users can manage aceites data"
  ON registros_aceite_parcelamento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas de segurança para configuracao_parcelamento
CREATE POLICY "Users can read config parcelamento"
  ON configuracao_parcelamento
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage config parcelamento"
  ON configuracao_parcelamento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_parcelamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_simulacoes_parcelamento_updated_at
  BEFORE UPDATE ON simulacoes_parcelamento
  FOR EACH ROW
  EXECUTE FUNCTION update_parcelamento_updated_at();

CREATE TRIGGER update_propostas_parcelamento_updated_at
  BEFORE UPDATE ON propostas_parcelamento
  FOR EACH ROW
  EXECUTE FUNCTION update_parcelamento_updated_at();

CREATE TRIGGER update_configuracao_parcelamento_updated_at
  BEFORE UPDATE ON configuracao_parcelamento
  FOR EACH ROW
  EXECUTE FUNCTION update_parcelamento_updated_at();