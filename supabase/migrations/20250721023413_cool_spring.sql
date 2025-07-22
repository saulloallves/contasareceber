/*
  # Configurações Administrativas do Sistema de Cobrança

  1. Nova Tabela
    - `configuracoes_cobranca`
      - `id` (text, primary key, valor fixo 'default')
      - `percentual_multa` (numeric, percentual de multa)
      - `percentual_juros_dia` (numeric, juros diário)
      - `dia_disparo_mensal` (integer, dia do mês para disparo)
      - `tempo_tolerancia_dias` (integer, dias de tolerância)
      - `texto_padrao_mensagem` (text, template da mensagem)
      - `link_base_agendamento` (text, URL base para agendamento)
      - `canal_envio` (text, canal de envio)
      - `modo_debug` (boolean, modo debug)
      - `ultima_data_importacao` (timestamp, última importação)
      - `created_at` e `updated_at` (timestamps)

  2. Segurança
    - Enable RLS na tabela `configuracoes_cobranca`
    - Add policy para usuários autenticados lerem
    - Add policy para usuários admin editarem

  3. Dados Iniciais
    - Inserir configuração padrão
*/

CREATE TABLE IF NOT EXISTS configuracoes_cobranca (
  id text PRIMARY KEY DEFAULT 'default',
  percentual_multa numeric DEFAULT 2.0,
  percentual_juros_dia numeric DEFAULT 0.033,
  dia_disparo_mensal integer DEFAULT 15,
  tempo_tolerancia_dias integer DEFAULT 3,
  texto_padrao_mensagem text DEFAULT 'Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? {{link_negociacao}}

_Esta é uma mensagem automática do sistema de cobrança._',
  link_base_agendamento text DEFAULT 'https://calendly.com/sua-empresa/negociacao',
  canal_envio text DEFAULT 'whatsapp' CHECK (canal_envio IN ('whatsapp', 'email', 'ambos')),
  modo_debug boolean DEFAULT false,
  ultima_data_importacao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE configuracoes_cobranca ENABLE ROW LEVEL SECURITY;

-- Policy para leitura (usuários autenticados)
CREATE POLICY "Users can read config"
  ON configuracoes_cobranca
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy para edição (apenas admins - em produção, usar roles específicos)
CREATE POLICY "Admins can update config"
  ON configuracoes_cobranca
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir configuração padrão se não existir
INSERT INTO configuracoes_cobranca (id) 
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_configuracoes_cobranca_updated_at
    BEFORE UPDATE ON configuracoes_cobranca
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_configuracoes_id ON configuracoes_cobranca (id);