/*
  # Sistema de Configurações Gerais e Controle de Acessos

  1. Tabelas
    - usuarios_sistema: Gestão completa de usuários
    - logs_sistema: Auditoria de todas as ações
    - configuracoes_sistema: Configurações flexíveis
    - historico_alteracoes_config: Histórico de mudanças
    - sessoes_usuario: Controle de sessões ativas

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas granulares por nível de usuário
    - Logs automáticos de auditoria
    - Controle de sessões e timeouts

  3. Funcionalidades
    - Gestão completa de usuários e permissões
    - Configurações flexíveis do sistema
    - Auditoria completa de ações
    - Controle de segurança avançado
*/

-- Tabela de usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefone TEXT,
  cargo TEXT,
  codigo_unidade_vinculada TEXT,
  vinculo_multifranqueado TEXT,
  nivel_permissao TEXT NOT NULL DEFAULT 'observador',
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  tentativas_login INTEGER DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  senha_hash TEXT, -- Para autenticação futura
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT usuarios_sistema_nivel_permissao_check 
    CHECK (nivel_permissao IN ('admin_master', 'gestor_juridico', 'cobranca', 'analista_financeiro', 'franqueado', 'observador'))
);

-- Tabela de logs do sistema para auditoria
CREATE TABLE IF NOT EXISTS logs_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  tabela_afetada TEXT,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_origem TEXT,
  user_agent TEXT,
  data_acao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configurações flexíveis do sistema
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  tipo_valor TEXT DEFAULT 'string',
  descricao TEXT,
  categoria TEXT DEFAULT 'sistema',
  editavel BOOLEAN DEFAULT true,
  nivel_permissao_minimo TEXT DEFAULT 'admin_master',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT configuracoes_sistema_tipo_valor_check 
    CHECK (tipo_valor IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT configuracoes_sistema_categoria_check 
    CHECK (categoria IN ('cobranca', 'sistema', 'integracao', 'seguranca'))
);

-- Tabela de histórico de alterações de configurações
CREATE TABLE IF NOT EXISTS historico_alteracoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  usuario TEXT NOT NULL,
  data_alteracao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de sessões ativas para controle de acesso
CREATE TABLE IF NOT EXISTS sessoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios_sistema(id) ON DELETE CASCADE,
  token_sessao TEXT UNIQUE NOT NULL,
  ip_origem TEXT,
  user_agent TEXT,
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_ultimo_acesso TIMESTAMPTZ DEFAULT now(),
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_email ON usuarios_sistema(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_nivel ON usuarios_sistema(nivel_permissao);
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_ativo ON usuarios_sistema(ativo);

CREATE INDEX IF NOT EXISTS idx_logs_sistema_usuario ON logs_sistema(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_data ON logs_sistema(data_acao DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_acao ON logs_sistema(acao);

CREATE INDEX IF NOT EXISTS idx_configuracoes_sistema_chave ON configuracoes_sistema(chave);
CREATE INDEX IF NOT EXISTS idx_configuracoes_sistema_categoria ON configuracoes_sistema(categoria);

CREATE INDEX IF NOT EXISTS idx_historico_alteracoes_data ON historico_alteracoes_config(data_alteracao DESC);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_token ON sessoes_usuario(token_sessao);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario_ativa ON sessoes_usuario(ativa);

-- Habilita RLS em todas as tabelas
ALTER TABLE usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_alteracoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuarios_sistema
CREATE POLICY "Admin master pode gerenciar todos os usuários"
  ON usuarios_sistema
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u 
      WHERE u.email = auth.email() 
      AND u.nivel_permissao = 'admin_master'
      AND u.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u 
      WHERE u.email = auth.email() 
      AND u.nivel_permissao = 'admin_master'
      AND u.ativo = true
    )
  );

CREATE POLICY "Usuários podem ver próprios dados"
  ON usuarios_sistema
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- Políticas RLS para logs_sistema
CREATE POLICY "Admin master pode ver todos os logs"
  ON logs_sistema
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u 
      WHERE u.email = auth.email() 
      AND u.nivel_permissao = 'admin_master'
      AND u.ativo = true
    )
  );

CREATE POLICY "Sistema pode inserir logs"
  ON logs_sistema
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas RLS para configuracoes_sistema
CREATE POLICY "Admin master pode gerenciar configurações"
  ON configuracoes_sistema
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u 
      WHERE u.email = auth.email() 
      AND u.nivel_permissao = 'admin_master'
      AND u.ativo = true
    )
  );

CREATE POLICY "Usuários podem ler configurações básicas"
  ON configuracoes_sistema
  FOR SELECT
  TO authenticated
  USING (categoria != 'seguranca');

-- Políticas RLS para historico_alteracoes_config
CREATE POLICY "Admin master pode ver histórico de alterações"
  ON historico_alteracoes_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u 
      WHERE u.email = auth.email() 
      AND u.nivel_permissao = 'admin_master'
      AND u.ativo = true
    )
  );

-- Políticas RLS para sessoes_usuario
CREATE POLICY "Usuários podem gerenciar próprias sessões"
  ON sessoes_usuario
  FOR ALL
  TO authenticated
  USING (
    usuario_id IN (
      SELECT id FROM usuarios_sistema 
      WHERE email = auth.email()
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_sistema_updated_at
  BEFORE UPDATE ON usuarios_sistema
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracoes_sistema_updated_at
  BEFORE UPDATE ON configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para registrar logs automaticamente
CREATE OR REPLACE FUNCTION registrar_log_automatico()
RETURNS TRIGGER AS $$
BEGIN
  -- Registra log para operações de UPDATE e DELETE
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO logs_sistema (
      usuario_id,
      acao,
      tabela_afetada,
      registro_id,
      dados_anteriores,
      dados_novos
    ) VALUES (
      COALESCE(current_setting('app.current_user_id', true), 'sistema'),
      'UPDATE',
      TG_TABLE_NAME,
      COALESCE(NEW.id::text, OLD.id::text),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO logs_sistema (
      usuario_id,
      acao,
      tabela_afetada,
      registro_id,
      dados_anteriores
    ) VALUES (
      COALESCE(current_setting('app.current_user_id', true), 'sistema'),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para log automático em tabelas críticas
CREATE TRIGGER trigger_log_usuarios_sistema
  AFTER UPDATE OR DELETE ON usuarios_sistema
  FOR EACH ROW EXECUTE FUNCTION registrar_log_automatico();

CREATE TRIGGER trigger_log_configuracoes_cobranca
  AFTER UPDATE OR DELETE ON configuracoes_cobranca
  FOR EACH ROW EXECUTE FUNCTION registrar_log_automatico();

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION limpar_sessoes_expiradas()
RETURNS void AS $$
BEGIN
  UPDATE sessoes_usuario 
  SET ativa = false 
  WHERE ativa = true 
  AND data_ultimo_acesso < now() - INTERVAL '2 hours';
END;
$$ LANGUAGE plpgsql;

-- Função para verificar permissões
CREATE OR REPLACE FUNCTION verificar_permissao_usuario(
  p_email TEXT,
  p_permissao TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_nivel TEXT;
BEGIN
  SELECT nivel_permissao INTO v_nivel
  FROM usuarios_sistema
  WHERE email = p_email AND ativo = true;
  
  -- Admin master tem todas as permissões
  IF v_nivel = 'admin_master' THEN
    RETURN true;
  END IF;
  
  -- Verifica permissões específicas por nível
  CASE p_permissao
    WHEN 'configuracoes' THEN
      RETURN v_nivel = 'admin_master';
    WHEN 'usuarios' THEN
      RETURN v_nivel = 'admin_master';
    WHEN 'juridico' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico');
    WHEN 'cobrancas' THEN
      RETURN v_nivel IN ('admin_master', 'cobranca', 'analista_financeiro');
    WHEN 'relatorios' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico', 'cobranca', 'analista_financeiro', 'observador');
    WHEN 'dashboard' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico', 'cobranca', 'analista_financeiro', 'observador');
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Insere configurações padrão do sistema
INSERT INTO configuracoes_sistema (chave, valor, tipo_valor, descricao, categoria, editavel) VALUES
  ('sistema_nome', 'Sistema de Cobrança Cresci e Perdi', 'string', 'Nome do sistema', 'sistema', false),
  ('sistema_versao', '1.0.0', 'string', 'Versão atual do sistema', 'sistema', false),
  ('max_tentativas_login', '5', 'number', 'Máximo de tentativas de login', 'seguranca', true),
  ('timeout_sessao_horas', '2', 'number', 'Timeout da sessão em horas', 'seguranca', true),
  ('backup_automatico_ativo', 'true', 'boolean', 'Backup automático ativo', 'sistema', true),
  ('notificacoes_email_ativo', 'true', 'boolean', 'Notificações por email ativas', 'sistema', true),
  ('modo_manutencao', 'false', 'boolean', 'Sistema em modo manutenção', 'sistema', true),
  ('api_externa_timeout', '30', 'number', 'Timeout para APIs externas (segundos)', 'integracao', true)
ON CONFLICT (chave) DO NOTHING;

-- Cria usuário admin padrão (senha deve ser alterada na primeira utilização)
INSERT INTO usuarios_sistema (
  nome_completo,
  email,
  cargo,
  nivel_permissao,
  ativo
) VALUES (
  'Administrador do Sistema',
  'admin@crescieperdi.com',
  'Administrador',
  'admin_master',
  true
) ON CONFLICT (email) DO NOTHING;