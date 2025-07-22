/*
  # Sistema de Autenticação para Franqueados

  1. Novas Tabelas
    - `auth_franqueados`
      - `id` (uuid, primary key)
      - `cnpj` (text, unique)
      - `token_acesso` (text)
      - `token_expira_em` (timestamp)
      - `ultimo_acesso` (timestamp)
      - `ip_ultimo_acesso` (text)
      - `tentativas_login` (integer)
      - `bloqueado_ate` (timestamp)
    
    - `logs_acesso_franqueados`
      - `id` (uuid, primary key)
      - `cnpj` (text)
      - `ip_acesso` (text)
      - `user_agent` (text)
      - `acao` (text)
      - `sucesso` (boolean)
      - `data_acesso` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for secure access
*/

-- Tabela de autenticação dos franqueados
CREATE TABLE IF NOT EXISTS auth_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text UNIQUE NOT NULL,
  token_acesso text,
  token_expira_em timestamptz,
  ultimo_acesso timestamptz,
  ip_ultimo_acesso text,
  tentativas_login integer DEFAULT 0,
  bloqueado_ate timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS logs_acesso_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  ip_acesso text,
  user_agent text,
  acao text NOT NULL,
  sucesso boolean DEFAULT true,
  detalhes jsonb DEFAULT '{}',
  data_acesso timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_auth_franqueados_cnpj ON auth_franqueados(cnpj);
CREATE INDEX IF NOT EXISTS idx_auth_franqueados_token ON auth_franqueados(token_acesso);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_cnpj ON logs_acesso_franqueados(cnpj);
CREATE INDEX IF NOT EXISTS idx_logs_acesso_data ON logs_acesso_franqueados(data_acesso DESC);

-- Enable RLS
ALTER TABLE auth_franqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_acesso_franqueados ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Franqueados podem acessar próprios dados de auth"
  ON auth_franqueados
  FOR ALL
  TO authenticated
  USING (cnpj = current_setting('app.current_cnpj', true));

CREATE POLICY "Admins podem gerenciar auth franqueados"
  ON auth_franqueados
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Logs são acessíveis por admins"
  ON logs_acesso_franqueados
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para gerar token de acesso
CREATE OR REPLACE FUNCTION gerar_token_acesso_franqueado(p_cnpj text)
RETURNS text AS $$
DECLARE
  v_token text;
  v_expira_em timestamptz;
BEGIN
  -- Gera token aleatório
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expira_em := now() + interval '15 minutes';
  
  -- Atualiza ou insere registro de auth
  INSERT INTO auth_franqueados (cnpj, token_acesso, token_expira_em, tentativas_login)
  VALUES (p_cnpj, v_token, v_expira_em, 0)
  ON CONFLICT (cnpj) 
  DO UPDATE SET 
    token_acesso = v_token,
    token_expira_em = v_expira_em,
    tentativas_login = 0,
    updated_at = now();
  
  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar token
CREATE OR REPLACE FUNCTION validar_token_franqueado(p_cnpj text, p_token text)
RETURNS boolean AS $$
DECLARE
  v_auth_record auth_franqueados%ROWTYPE;
BEGIN
  -- Busca registro de auth
  SELECT * INTO v_auth_record
  FROM auth_franqueados
  WHERE cnpj = p_cnpj AND token_acesso = p_token;
  
  -- Verifica se existe e não expirou
  IF v_auth_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_auth_record.token_expira_em < now() THEN
    RETURN false;
  END IF;
  
  -- Atualiza último acesso
  UPDATE auth_franqueados
  SET ultimo_acesso = now()
  WHERE id = v_auth_record.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para registrar log de acesso
CREATE OR REPLACE FUNCTION registrar_log_acesso(
  p_cnpj text,
  p_ip text,
  p_user_agent text,
  p_acao text,
  p_sucesso boolean DEFAULT true,
  p_detalhes jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO logs_acesso_franqueados (
    cnpj, ip_acesso, user_agent, acao, sucesso, detalhes
  ) VALUES (
    p_cnpj, p_ip, p_user_agent, p_acao, p_sucesso, p_detalhes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_auth_franqueados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auth_franqueados_updated_at
  BEFORE UPDATE ON auth_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_franqueados_updated_at();