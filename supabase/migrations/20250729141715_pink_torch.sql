/*
  # Create notification configuration table

  1. New Tables
    - `configuracao_notificacao_automatica`
      - `id` (text, primary key, default 'default')
      - `whatsapp_ativo` (boolean, default true)
      - `email_ativo` (boolean, default true)
      - `template_whatsapp` (text)
      - `template_email_assunto` (text)
      - `template_email_corpo` (text)
      - `enviar_apenas_em_atraso` (boolean, default false)
      - `valor_minimo_notificacao` (numeric, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `configuracao_notificacao_automatica` table
    - Add policy for authenticated users to manage notification config
*/

CREATE TABLE IF NOT EXISTS configuracao_notificacao_automatica (
  id text PRIMARY KEY DEFAULT 'default',
  whatsapp_ativo boolean DEFAULT true,
  email_ativo boolean DEFAULT true,
  template_whatsapp text DEFAULT 'Olá, {{cliente}}! 👋

Uma nova cobrança foi registrada para sua unidade {{codigo_unidade}}.

📋 *Detalhes:*
• Valor: {{valor_atualizado}}
• Vencimento: {{data_vencimento}}
• Tipo: {{tipo_cobranca}}

Para negociar ou esclarecer dúvidas, entre em contato conosco.

_Mensagem automática do sistema de cobrança_',
  template_email_assunto text DEFAULT 'Nova Cobrança Registrada - {{codigo_unidade}}',
  template_email_corpo text DEFAULT 'Prezado(a) {{cliente}},

Informamos que foi registrada uma nova cobrança para sua unidade {{codigo_unidade}}.

Detalhes da Cobrança:
- Valor: {{valor_atualizado}}
- Data de Vencimento: {{data_vencimento}}
- Tipo: {{tipo_cobranca}}

Para esclarecimentos ou negociação, entre em contato através dos nossos canais oficiais.

Atenciosamente,
Equipe Financeira',
  enviar_apenas_em_atraso boolean DEFAULT false,
  valor_minimo_notificacao numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracao_notificacao_automatica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notification config"
  ON configuracao_notificacao_automatica
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default configuration
INSERT INTO configuracao_notificacao_automatica (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_configuracao_notificacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuracao_notificacao_automatica_updated_at
  BEFORE UPDATE ON configuracao_notificacao_automatica
  FOR EACH ROW
  EXECUTE FUNCTION update_configuracao_notificacao_updated_at();

-- Ensure default configuration exists in configuracoes_cobranca table
INSERT INTO configuracoes_cobranca (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;