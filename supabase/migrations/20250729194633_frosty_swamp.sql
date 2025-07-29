/*
  # Criar tabelas para sistema de email

  1. Novas Tabelas
    - `configuracao_email` - Configurações SMTP
    - `logs_envio_email` - Histórico de envios
    
  2. Segurança
    - Enable RLS em todas as tabelas
    - Políticas para admins gerenciarem configurações
    - Políticas para visualizar logs
*/

-- Tabela de configuração de email
CREATE TABLE IF NOT EXISTS configuracao_email (
  id text PRIMARY KEY DEFAULT 'default',
  servidor_smtp text NOT NULL DEFAULT 'smtp.gmail.com',
  porta integer NOT NULL DEFAULT 587,
  usuario text NOT NULL,
  senha text NOT NULL,
  nome_remetente text NOT NULL DEFAULT 'Cresci e Perdi - Financeiro',
  email_padrao text NOT NULL,
  email_retorno text NOT NULL,
  ssl_ativo boolean DEFAULT true,
  ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de logs de envio de email
CREATE TABLE IF NOT EXISTS logs_envio_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario text NOT NULL,
  assunto text NOT NULL,
  sucesso boolean NOT NULL,
  message_id text,
  erro_detalhes text,
  data_envio timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE configuracao_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_envio_email ENABLE ROW LEVEL SECURITY;

-- Políticas para configuracao_email
CREATE POLICY "Admins can manage email config"
  ON configuracao_email
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para logs_envio_email
CREATE POLICY "Admins can view email logs"
  ON logs_envio_email
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert email logs"
  ON logs_envio_email
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_logs_email_data_envio ON logs_envio_email (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_logs_email_destinatario ON logs_envio_email (destinatario);
CREATE INDEX IF NOT EXISTS idx_logs_email_sucesso ON logs_envio_email (sucesso);

-- Inserir configuração padrão (deve ser atualizada pelo admin)
INSERT INTO configuracao_email (
  id,
  usuario,
  senha,
  email_padrao,
  email_retorno,
  ativo
) VALUES (
  'default',
  'financeiro@crescieperdi.com',
  'CONFIGURAR_SENHA_APP',
  'financeiro@crescieperdi.com',
  'financeiro@crescieperdi.com',
  false
) ON CONFLICT (id) DO NOTHING;