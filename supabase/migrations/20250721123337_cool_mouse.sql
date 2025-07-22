/*
  # Sistema Inteligente de Alertas e Escalonamento

  1. Novas Tabelas
    - `pontuacao_risco_unidades` - Pontuação de risco por unidade
    - `configuracao_risco` - Parâmetros configuráveis do sistema
    - `eventos_risco` - Log de eventos que geram pontos
    - `alertas_sistema` - Alertas ativos e histórico

  2. Funções
    - `calcular_pontuacao_risco()` - Calcula pontuação baseada em critérios
    - `processar_evento_risco()` - Processa novos eventos de risco
    - `verificar_escalonamento_automatico()` - Verifica se deve escalar

  3. Triggers
    - Atualização automática de pontuação quando eventos ocorrem
    - Escalonamento automático para risco crítico
*/

-- Tabela de pontuação de risco por unidade
CREATE TABLE IF NOT EXISTS pontuacao_risco_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  pontuacao_atual integer DEFAULT 0,
  nivel_risco text CHECK (nivel_risco IN ('baixo', 'moderado', 'critico')) DEFAULT 'baixo',
  historico_pontos jsonb DEFAULT '[]'::jsonb,
  alertas_ativos jsonb DEFAULT '[]'::jsonb,
  ultima_atualizacao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de configuração de risco
CREATE TABLE IF NOT EXISTS configuracao_risco (
  id text PRIMARY KEY DEFAULT 'default',
  atraso_10_dias integer DEFAULT 1,
  nao_comparecimento integer DEFAULT 1,
  nao_resposta_consecutiva integer DEFAULT 1,
  notificacao_anterior integer DEFAULT 2,
  parcelamento_nao_cumprido integer DEFAULT 2,
  acionamento_juridico_anterior integer DEFAULT 3,
  reincidencia_valor_alto integer DEFAULT 5,
  limite_risco_baixo integer DEFAULT 2,
  limite_risco_moderado integer DEFAULT 5,
  limite_risco_critico integer DEFAULT 6,
  valor_minimo_reincidencia numeric DEFAULT 1500.00,
  max_alertas_por_dia integer DEFAULT 5,
  max_acoes_automaticas_semana integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de eventos de risco
CREATE TABLE IF NOT EXISTS eventos_risco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  tipo_evento text NOT NULL CHECK (tipo_evento IN ('atraso', 'nao_comparecimento', 'nao_resposta', 'notificacao', 'parcelamento_quebrado', 'acionamento_juridico', 'reincidencia')),
  pontos_adicionados integer NOT NULL,
  descricao text NOT NULL,
  titulo_id uuid REFERENCES cobrancas_franqueados(id) ON DELETE SET NULL,
  reuniao_id uuid REFERENCES reunioes_negociacao(id) ON DELETE SET NULL,
  data_evento timestamptz DEFAULT now(),
  processado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Tabela de alertas do sistema
CREATE TABLE IF NOT EXISTS alertas_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  tipo_alerta text NOT NULL CHECK (tipo_alerta IN ('interno', 'equipe', 'juridico', 'diretoria')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  nivel_urgencia text CHECK (nivel_urgencia IN ('baixa', 'media', 'alta', 'critica')) DEFAULT 'media',
  data_criacao timestamptz DEFAULT now(),
  data_resolucao timestamptz,
  resolvido boolean DEFAULT false,
  acao_automatica text,
  enviado_slack boolean DEFAULT false,
  enviado_email boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pontuacao_risco_cnpj ON pontuacao_risco_unidades(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_pontuacao_risco_nivel ON pontuacao_risco_unidades(nivel_risco);
CREATE INDEX IF NOT EXISTS idx_eventos_risco_cnpj ON eventos_risco(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_eventos_risco_tipo ON eventos_risco(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_risco_data ON eventos_risco(data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_cnpj ON alertas_sistema(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_sistema(tipo_alerta);
CREATE INDEX IF NOT EXISTS idx_alertas_resolvido ON alertas_sistema(resolvido);

-- Inserir configuração padrão
INSERT INTO configuracao_risco (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Função para calcular pontuação de risco
CREATE OR REPLACE FUNCTION calcular_pontuacao_risco(p_cnpj_unidade text)
RETURNS jsonb AS $$
DECLARE
  v_config configuracao_risco%ROWTYPE;
  v_pontuacao integer := 0;
  v_nivel_risco text := 'baixo';
  v_historico jsonb := '[]'::jsonb;
  v_alertas jsonb := '[]'::jsonb;
  v_cobrancas_atrasadas integer;
  v_reunioes_nao_compareceu integer;
  v_notificacoes_anteriores integer;
  v_escalonamentos_anteriores integer;
  v_valor_total_aberto numeric;
BEGIN
  -- Busca configuração
  SELECT * INTO v_config FROM configuracao_risco WHERE id = 'default';
  
  -- 1. Cobranças com atraso > 10 dias
  SELECT COUNT(*) INTO v_cobrancas_atrasadas
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND status = 'em_aberto' 
    AND dias_em_atraso > 10;
  
  IF v_cobrancas_atrasadas > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.atraso_10_dias * v_cobrancas_atrasadas);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_cobrancas_atrasadas || ' cobrança(s) com atraso > 10 dias',
      'pontos_adicionados', v_config.atraso_10_dias * v_cobrancas_atrasadas,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 2. Não comparecimento em reuniões
  SELECT COUNT(*) INTO v_reunioes_nao_compareceu
  FROM reunioes_negociacao 
  WHERE cnpj_unidade = p_cnpj_unidade 
    AND status_reuniao = 'nao_compareceu';
  
  IF v_reunioes_nao_compareceu > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.nao_comparecimento * v_reunioes_nao_compareceu);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_reunioes_nao_compareceu || ' não comparecimento(s) em reunião',
      'pontos_adicionados', v_config.nao_comparecimento * v_reunioes_nao_compareceu,
      'pontuacao_total', v_pontuacao
    );
    
    v_alertas := v_alertas || jsonb_build_object(
      'tipo', 'equipe',
      'titulo', 'Não Comparecimento Recorrente',
      'descricao', 'Unidade ' || p_cnpj_unidade || ' não compareceu a ' || v_reunioes_nao_compareceu || ' reunião(ões)',
      'nivel_urgencia', 'media',
      'data_criacao', now(),
      'resolvido', false
    );
  END IF;
  
  -- 3. Notificações anteriores
  SELECT COUNT(*) INTO v_notificacoes_anteriores
  FROM documentos_gerados dg
  JOIN cobrancas_franqueados cf ON dg.titulo_id = cf.id
  WHERE cf.cnpj = p_cnpj_unidade;
  
  IF v_notificacoes_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.notificacao_anterior * v_notificacoes_anteriores);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_notificacoes_anteriores || ' notificação(ões) anterior(es)',
      'pontos_adicionados', v_config.notificacao_anterior * v_notificacoes_anteriores,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 4. Escalonamentos anteriores
  SELECT COUNT(*) INTO v_escalonamentos_anteriores
  FROM escalonamentos_cobranca 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  IF v_escalonamentos_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.acionamento_juridico_anterior * v_escalonamentos_anteriores);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_escalonamentos_anteriores || ' acionamento(s) jurídico(s) anterior(es)',
      'pontos_adicionados', v_config.acionamento_juridico_anterior * v_escalonamentos_anteriores,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 5. Reincidência com valor alto
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total_aberto
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND status = 'em_aberto';
  
  IF v_valor_total_aberto > v_config.valor_minimo_reincidencia AND v_escalonamentos_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + v_config.reincidencia_valor_alto;
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', 'Reincidência com valor alto (R$ ' || v_valor_total_aberto || ')',
      'pontos_adicionados', v_config.reincidencia_valor_alto,
      'pontuacao_total', v_pontuacao
    );
    
    v_alertas := v_alertas || jsonb_build_object(
      'tipo', 'juridico',
      'titulo', 'Reincidente Valor Alto',
      'descricao', 'Unidade ' || p_cnpj_unidade || ' reincidiu com valor superior a R$ ' || v_config.valor_minimo_reincidencia,
      'nivel_urgencia', 'critica',
      'data_criacao', now(),
      'resolvido', false
    );
  END IF;
  
  -- Determina nível de risco
  IF v_pontuacao >= v_config.limite_risco_critico THEN
    v_nivel_risco := 'critico';
  ELSIF v_pontuacao >= v_config.limite_risco_moderado THEN
    v_nivel_risco := 'moderado';
  ELSE
    v_nivel_risco := 'baixo';
  END IF;
  
  -- Retorna resultado
  RETURN jsonb_build_object(
    'cnpj_unidade', p_cnpj_unidade,
    'pontuacao_atual', v_pontuacao,
    'nivel_risco', v_nivel_risco,
    'historico_pontos', v_historico,
    'alertas_ativos', v_alertas,
    'ultima_atualizacao', now()
  );
END;
$$ LANGUAGE plpgsql;

-- Função para processar evento de risco
CREATE OR REPLACE FUNCTION processar_evento_risco()
RETURNS trigger AS $$
DECLARE
  v_cnpj_unidade text;
  v_pontuacao_resultado jsonb;
BEGIN
  -- Determina CNPJ baseado na tabela de origem
  IF TG_TABLE_NAME = 'cobrancas_franqueados' THEN
    v_cnpj_unidade := NEW.cnpj;
  ELSIF TG_TABLE_NAME = 'reunioes_negociacao' THEN
    v_cnpj_unidade := NEW.cnpj_unidade;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Calcula nova pontuação
  v_pontuacao_resultado := calcular_pontuacao_risco(v_cnpj_unidade);
  
  -- Atualiza ou insere pontuação
  INSERT INTO pontuacao_risco_unidades (
    cnpj_unidade,
    pontuacao_atual,
    nivel_risco,
    historico_pontos,
    alertas_ativos
  ) VALUES (
    v_cnpj_unidade,
    (v_pontuacao_resultado->>'pontuacao_atual')::integer,
    v_pontuacao_resultado->>'nivel_risco',
    v_pontuacao_resultado->'historico_pontos',
    v_pontuacao_resultado->'alertas_ativos'
  )
  ON CONFLICT (cnpj_unidade) 
  DO UPDATE SET
    pontuacao_atual = (v_pontuacao_resultado->>'pontuacao_atual')::integer,
    nivel_risco = v_pontuacao_resultado->>'nivel_risco',
    historico_pontos = v_pontuacao_resultado->'historico_pontos',
    alertas_ativos = v_pontuacao_resultado->'alertas_ativos',
    ultima_atualizacao = now(),
    updated_at = now();
  
  -- Se risco crítico, cria escalonamento automático
  IF (v_pontuacao_resultado->>'nivel_risco') = 'critico' THEN
    PERFORM criar_escalonamento_automatico(v_cnpj_unidade, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para criar escalonamento automático
CREATE OR REPLACE FUNCTION criar_escalonamento_automatico(p_cnpj_unidade text, p_titulo_id uuid)
RETURNS void AS $$
DECLARE
  v_valor_total numeric;
  v_pontuacao integer;
BEGIN
  -- Verifica se já existe escalonamento pendente
  IF EXISTS (
    SELECT 1 FROM escalonamentos_cobranca 
    WHERE cnpj_unidade = p_cnpj_unidade 
      AND status IN ('pendente', 'em_analise')
  ) THEN
    RETURN;
  END IF;
  
  -- Busca valor total e pontuação
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
  
  SELECT pontuacao_atual INTO v_pontuacao
  FROM pontuacao_risco_unidades 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  -- Cria escalonamento
  INSERT INTO escalonamentos_cobranca (
    titulo_id,
    cnpj_unidade,
    motivo_escalonamento,
    enviado_para,
    nivel,
    documento_gerado,
    status,
    valor_total_envolvido,
    quantidade_titulos,
    observacoes
  ) VALUES (
    p_titulo_id,
    p_cnpj_unidade,
    'Escalonamento automático por risco crítico (' || v_pontuacao || ' pontos)',
    'juridico@crescieperdi.com',
    'juridico',
    false,
    'pendente',
    v_valor_total,
    (SELECT COUNT(*) FROM cobrancas_franqueados WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto'),
    'Escalonamento automático acionado pelo sistema de alertas'
  );
  
  -- Registra alerta
  INSERT INTO alertas_sistema (
    cnpj_unidade,
    tipo_alerta,
    titulo,
    descricao,
    nivel_urgencia,
    acao_automatica
  ) VALUES (
    p_cnpj_unidade,
    'juridico',
    'Escalonamento Automático Acionado',
    'Unidade ' || p_cnpj_unidade || ' foi automaticamente escalonada para o jurídico devido ao risco crítico',
    'critica',
    'escalonamento_automatico'
  );
END;
$$ LANGUAGE plpgsql;

-- Função para verificar escalonamentos em lote
CREATE OR REPLACE FUNCTION verificar_escalonamentos_lote()
RETURNS integer AS $$
DECLARE
  v_unidade record;
  v_novos_escalonamentos integer := 0;
BEGIN
  -- Verifica todas as unidades com cobranças em aberto
  FOR v_unidade IN 
    SELECT DISTINCT cnpj 
    FROM cobrancas_franqueados 
    WHERE status = 'em_aberto'
  LOOP
    -- Recalcula pontuação de risco
    PERFORM calcular_pontuacao_risco(v_unidade.cnpj);
    
    -- Verifica se precisa escalar
    IF EXISTS (
      SELECT 1 FROM pontuacao_risco_unidades 
      WHERE cnpj_unidade = v_unidade.cnpj 
        AND nivel_risco = 'critico'
        AND NOT EXISTS (
          SELECT 1 FROM escalonamentos_cobranca 
          WHERE cnpj_unidade = v_unidade.cnpj 
            AND status IN ('pendente', 'em_analise')
        )
    ) THEN
      -- Busca título principal para escalar
      DECLARE
        v_titulo_id uuid;
      BEGIN
        SELECT id INTO v_titulo_id
        FROM cobrancas_franqueados 
        WHERE cnpj = v_unidade.cnpj 
          AND status = 'em_aberto'
        ORDER BY dias_em_atraso DESC
        LIMIT 1;
        
        IF v_titulo_id IS NOT NULL THEN
          PERFORM criar_escalonamento_automatico(v_unidade.cnpj, v_titulo_id);
          v_novos_escalonamentos := v_novos_escalonamentos + 1;
        END IF;
      END;
    END IF;
  END LOOP;
  
  RETURN v_novos_escalonamentos;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualização automática de risco
CREATE OR REPLACE TRIGGER trigger_risco_cobrancas
  AFTER INSERT OR UPDATE ON cobrancas_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION processar_evento_risco();

CREATE OR REPLACE TRIGGER trigger_risco_reunioes
  AFTER INSERT OR UPDATE ON reunioes_negociacao
  FOR EACH ROW
  EXECUTE FUNCTION processar_evento_risco();

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_pontuacao_risco_updated_at
  BEFORE UPDATE ON pontuacao_risco_unidades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_configuracao_risco_updated_at
  BEFORE UPDATE ON configuracao_risco
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE pontuacao_risco_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_risco ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_risco ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_sistema ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage risk data" ON pontuacao_risco_unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage risk config" ON configuracao_risco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage risk events" ON eventos_risco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage alerts" ON alertas_sistema FOR ALL TO authenticated USING (true) WITH CHECK (true);