/*
  # Criar tabelas de segurança

  1. Novas Tabelas
    - `configuracao_seguranca`
      - Configurações de políticas de senha e segurança
      - Controle de tentativas de login e bloqueios
      - Configuração de whitelist/blacklist de IPs
    - `tentativas_login`
      - Log de todas as tentativas de login (sucesso e falha)
      - Rastreamento de IPs e user agents
      - Detecção de atividades suspeitas
    - `ips_bloqueados`
      - Lista de IPs bloqueados manualmente
      - Controle de expiração de bloqueios
      - Motivos e responsáveis pelos bloqueios
    - `alertas_seguranca`
      - Alertas automáticos de segurança
      - Detecção de tentativas de força bruta
      - Atividades suspeitas e resoluções

  2. Segurança
    - Enable RLS em todas as tabelas
    - Políticas para admin_master gerenciar configurações
    - Políticas para sistema inserir logs automaticamente

  3. Índices
    - Otimização para consultas por data
    - Índices para IPs e emails
    - Performance para alertas ativos
*/

-- Tabela de configuração de segurança
CREATE TABLE IF NOT EXISTS public.configuracao_seguranca (
    id TEXT PRIMARY KEY DEFAULT 'default',
    -- Políticas de Senha
    senha_comprimento_minimo INTEGER NOT NULL DEFAULT 8,
    senha_requer_maiuscula BOOLEAN NOT NULL DEFAULT TRUE,
    senha_requer_minuscula BOOLEAN NOT NULL DEFAULT TRUE,
    senha_requer_numero BOOLEAN NOT NULL DEFAULT TRUE,
    senha_requer_especial BOOLEAN NOT NULL DEFAULT FALSE,
    senha_expiracao_dias INTEGER NOT NULL DEFAULT 90,
    senha_historico_bloqueio INTEGER NOT NULL DEFAULT 5,
    
    -- Bloqueio por Tentativas
    max_tentativas_login INTEGER NOT NULL DEFAULT 5,
    duracao_bloqueio_minutos INTEGER NOT NULL DEFAULT 30,
    reset_tentativas_apos_minutos INTEGER NOT NULL DEFAULT 60,
    
    -- Controle de IP
    ip_whitelist_ativo BOOLEAN NOT NULL DEFAULT FALSE,
    ips_permitidos TEXT[] NOT NULL DEFAULT '{}',
    ip_blacklist_ativo BOOLEAN NOT NULL DEFAULT FALSE,
    ips_bloqueados TEXT[] NOT NULL DEFAULT '{}',
    
    -- Configurações Gerais
    timeout_sessao_minutos INTEGER NOT NULL DEFAULT 120,
    log_tentativas_falhas BOOLEAN NOT NULL DEFAULT TRUE,
    notificar_admin_tentativas BOOLEAN NOT NULL DEFAULT TRUE,
    email_notificacao_admin TEXT NOT NULL DEFAULT 'admin@crescieperdi.com.br',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_senha_comprimento CHECK (senha_comprimento_minimo >= 6 AND senha_comprimento_minimo <= 50),
    CONSTRAINT chk_senha_expiracao CHECK (senha_expiracao_dias >= 30 AND senha_expiracao_dias <= 365),
    CONSTRAINT chk_max_tentativas CHECK (max_tentativas_login >= 3 AND max_tentativas_login <= 20),
    CONSTRAINT chk_duracao_bloqueio CHECK (duracao_bloqueio_minutos >= 5 AND duracao_bloqueio_minutos <= 1440),
    CONSTRAINT chk_timeout_sessao CHECK (timeout_sessao_minutos >= 30 AND timeout_sessao_minutos <= 480)
);

-- Tabela de tentativas de login
CREATE TABLE IF NOT EXISTS public.tentativas_login (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_tentativa TEXT NOT NULL,
    ip_origem TEXT NOT NULL,
    user_agent TEXT,
    sucesso BOOLEAN NOT NULL,
    motivo_falha TEXT,
    data_tentativa TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bloqueado_automaticamente BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de IPs bloqueados
CREATE TABLE IF NOT EXISTS public.ips_bloqueados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endereco_ip TEXT NOT NULL UNIQUE,
    motivo_bloqueio TEXT NOT NULL,
    bloqueado_por TEXT NOT NULL,
    data_bloqueio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_expiracao TIMESTAMPTZ,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de alertas de segurança
CREATE TABLE IF NOT EXISTS public.alertas_seguranca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    ip_origem TEXT,
    usuario_afetado TEXT,
    data_deteccao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolvido BOOLEAN NOT NULL DEFAULT FALSE,
    acao_tomada TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_tipo_alerta CHECK (tipo IN ('tentativa_brute_force', 'ip_suspeito', 'login_fora_horario', 'multiplas_sessoes', 'acesso_negado'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tentativas_login_data ON public.tentativas_login (data_tentativa DESC);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_ip ON public.tentativas_login (ip_origem);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_email ON public.tentativas_login (email_tentativa);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_sucesso ON public.tentativas_login (sucesso);

CREATE INDEX IF NOT EXISTS idx_ips_bloqueados_ip ON public.ips_bloqueados (endereco_ip);
CREATE INDEX IF NOT EXISTS idx_ips_bloqueados_ativo ON public.ips_bloqueados (ativo);
CREATE INDEX IF NOT EXISTS idx_ips_bloqueados_data ON public.ips_bloqueados (data_bloqueio DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_seguranca_data ON public.alertas_seguranca (data_deteccao DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_seguranca_resolvido ON public.alertas_seguranca (resolvido);
CREATE INDEX IF NOT EXISTS idx_alertas_seguranca_tipo ON public.alertas_seguranca (tipo);

-- Enable RLS
ALTER TABLE public.configuracao_seguranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tentativas_login ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ips_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_seguranca ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para configuracao_seguranca
CREATE POLICY "Admin master pode gerenciar configuração de segurança"
  ON public.configuracao_seguranca
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  );

-- Políticas RLS para tentativas_login
CREATE POLICY "Admin master pode ver tentativas de login"
  ON public.tentativas_login
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  );

CREATE POLICY "Sistema pode inserir tentativas de login"
  ON public.tentativas_login
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas RLS para ips_bloqueados
CREATE POLICY "Admin master pode gerenciar IPs bloqueados"
  ON public.ips_bloqueados
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  );

-- Políticas RLS para alertas_seguranca
CREATE POLICY "Admin master pode gerenciar alertas de segurança"
  ON public.alertas_seguranca
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios_sistema u
      WHERE u.id = auth.uid() 
      AND u.nivel_permissao = 'admin_master' 
      AND u.ativo = true
    )
  );

CREATE POLICY "Sistema pode inserir alertas de segurança"
  ON public.alertas_seguranca
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Inserir configuração padrão
INSERT INTO public.configuracao_seguranca (id) VALUES ('default') 
ON CONFLICT (id) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_configuracao_seguranca_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_configuracao_seguranca_updated_at
    BEFORE UPDATE ON public.configuracao_seguranca
    FOR EACH ROW
    EXECUTE FUNCTION update_configuracao_seguranca_updated_at();