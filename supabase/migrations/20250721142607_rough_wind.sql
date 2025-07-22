/*
  # Sistema de Priorização Inteligente de Cobrança

  1. Tabelas Criadas
    - `criterios_priorizacao` - Configurações dos critérios de priorização
    - `priorizacao_unidades` - Score e nível de cada unidade
    - `historico_escalonamento` - Log de mudanças de nível
    - `acoes_automaticas_log` - Registro de ações executadas automaticamente

  2. Funcionalidades
    - Cálculo automático de score baseado em múltiplos critérios
    - Níveis de escalonamento (1-5) com ações específicas
    - Automação de ações baseada em regras configuráveis
    - Histórico completo de alterações

  3. Integrações
    - Sistema de tratativas para registro de ações
    - Sistema de configurações para parâmetros ajustáveis
    - Sistema de alertas para notificações automáticas
*/

-- Tabela de critérios de priorização
CREATE TABLE IF NOT EXISTS criterios_priorizacao (
  id TEXT PRIMARY KEY DEFAULT 'default',
  valor_minimo_alta_prioridade NUMERIC DEFAULT 5000.00,
  peso_valor_em_aberto INTEGER DEFAULT 40,
  peso_tempo_inadimplencia INTEGER DEFAULT 30,
  peso_multiplicidade_debitos INTEGER DEFAULT 15,
  peso_tipo_debito JSONB DEFAULT '{
    "royalties": 25,
    "aluguel": 20,
    "insumos": 10,
    "multa": 15,
    "outros": 5
  }'::jsonb,
  peso_status_unidade JSONB DEFAULT '{
    "critica": 25,
    "ativa_atraso": 15,
    "negociacao": 5,
    "acordo": 0
  }'::jsonb,
  dias_nivel_1 INTEGER DEFAULT 5,
  dias_nivel_2 INTEGER DEFAULT 15,
  dias_nivel_3 INTEGER DEFAULT 30,
  dias_nivel_4 INTEGER DEFAULT 45,
  dias_nivel_5 INTEGER DEFAULT 60,
  max_tentativas_por_nivel INTEGER DEFAULT 3,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de priorização das unidades
CREATE TABLE IF NOT EXISTS priorizacao_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade TEXT NOT NULL,
  codigo_unidade TEXT,
  nome_franqueado TEXT NOT NULL,
  score_priorizacao INTEGER DEFAULT 0,
  nivel_escalonamento INTEGER DEFAULT 1 CHECK (nivel_escalonamento BETWEEN 1 AND 5),
  valor_total_em_aberto NUMERIC DEFAULT 0,
  dias_inadimplencia_max INTEGER DEFAULT 0,
  quantidade_debitos INTEGER DEFAULT 0,
  tipos_debito TEXT[] DEFAULT '{}',
  status_unidade TEXT DEFAULT 'ativa_atraso' CHECK (status_unidade IN ('critica', 'ativa_atraso', 'negociacao', 'acordo')),
  tentativas_contato_nivel INTEGER DEFAULT 0,
  data_ultimo_contato TIMESTAMPTZ,
  data_proximo_escalonamento TIMESTAMPTZ,
  observacoes_priorizacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de escalonamentos
CREATE TABLE IF NOT EXISTS historico_escalonamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade TEXT NOT NULL,
  nivel_anterior INTEGER NOT NULL,
  nivel_novo INTEGER NOT NULL,
  motivo_escalonamento TEXT NOT NULL,
  score_anterior INTEGER DEFAULT 0,
  score_novo INTEGER DEFAULT 0,
  acao_automatica BOOLEAN DEFAULT false,
  usuario_responsavel TEXT,
  data_escalonamento TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de log de ações automáticas
CREATE TABLE IF NOT EXISTS acoes_automaticas_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade TEXT NOT NULL,
  nivel_escalonamento INTEGER NOT NULL,
  acao_executada TEXT NOT NULL,
  resultado TEXT,
  detalhes JSONB DEFAULT '{}',
  data_execucao TIMESTAMPTZ DEFAULT now(),
  sucesso BOOLEAN DEFAULT true,
  erro_detalhes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_priorizacao_score ON priorizacao_unidades (score_priorizacao DESC);
CREATE INDEX IF NOT EXISTS idx_priorizacao_nivel ON priorizacao_unidades (nivel_escalonamento);
CREATE INDEX IF NOT EXISTS idx_priorizacao_cnpj ON priorizacao_unidades (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_historico_escalonamento_cnpj ON historico_escalonamento (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_historico_escalonamento_data ON historico_escalonamento (data_escalonamento DESC);
CREATE INDEX IF NOT EXISTS idx_acoes_automaticas_cnpj ON acoes_automaticas_log (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_acoes_automaticas_data ON acoes_automaticas_log (data_execucao DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_priorizacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_priorizacao_unidades_updated_at
  BEFORE UPDATE ON priorizacao_unidades
  FOR EACH ROW
  EXECUTE FUNCTION update_priorizacao_updated_at();

CREATE TRIGGER update_criterios_priorizacao_updated_at
  BEFORE UPDATE ON criterios_priorizacao
  FOR EACH ROW
  EXECUTE FUNCTION update_priorizacao_updated_at();

-- Função para calcular score de priorização
CREATE OR REPLACE FUNCTION calcular_score_priorizacao(p_cnpj_unidade TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_criterios RECORD;
  v_valor_total NUMERIC := 0;
  v_dias_max INTEGER := 0;
  v_qtd_debitos INTEGER := 0;
  v_tipos_debito TEXT[];
  v_score INTEGER := 0;
  v_peso_valor NUMERIC;
  v_peso_tempo NUMERIC;
  v_peso_multiplicidade NUMERIC;
BEGIN
  -- Busca critérios
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  -- Calcula métricas da unidade
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'em_aberto' THEN COALESCE(valor_atualizado, valor_original) ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN status = 'em_aberto' THEN COALESCE(dias_em_atraso, 0) ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'em_aberto' THEN 1 END),
    ARRAY_AGG(DISTINCT COALESCE(tipo_cobranca, 'outros')) FILTER (WHERE status = 'em_aberto')
  INTO v_valor_total, v_dias_max, v_qtd_debitos, v_tipos_debito
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  -- Calcula componentes do score
  v_peso_valor := CASE 
    WHEN v_valor_total >= v_criterios.valor_minimo_alta_prioridade THEN 100
    ELSE (v_valor_total / v_criterios.valor_minimo_alta_prioridade) * 100
  END;
  
  v_peso_tempo := LEAST(v_dias_max / 90.0, 1) * 100;
  v_peso_multiplicidade := LEAST(v_qtd_debitos / 5.0, 1) * 100;
  
  -- Score final
  v_score := ROUND(
    (v_peso_valor * v_criterios.peso_valor_em_aberto / 100) +
    (v_peso_tempo * v_criterios.peso_tempo_inadimplencia / 100) +
    (v_peso_multiplicidade * v_criterios.peso_multiplicidade_debitos / 100)
  );
  
  RETURN GREATEST(v_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para determinar nível de escalonamento
CREATE OR REPLACE FUNCTION determinar_nivel_escalonamento(p_dias_atraso INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_criterios RECORD;
BEGIN
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  IF p_dias_atraso <= v_criterios.dias_nivel_1 THEN RETURN 1;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_2 THEN RETURN 2;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_3 THEN RETURN 3;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_4 THEN RETURN 4;
  ELSE RETURN 5;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar priorização de uma unidade
CREATE OR REPLACE FUNCTION atualizar_priorizacao_unidade(p_cnpj_unidade TEXT)
RETURNS VOID AS $$
DECLARE
  v_score INTEGER;
  v_nivel INTEGER;
  v_valor_total NUMERIC;
  v_dias_max INTEGER;
  v_qtd_debitos INTEGER;
  v_tipos_debito TEXT[];
  v_nome_franqueado TEXT;
  v_codigo_unidade TEXT;
BEGIN
  -- Calcula métricas
  v_score := calcular_score_priorizacao(p_cnpj_unidade);
  
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'em_aberto' THEN COALESCE(valor_atualizado, valor_original) ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN status = 'em_aberto' THEN COALESCE(dias_em_atraso, 0) ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'em_aberto' THEN 1 END),
    ARRAY_AGG(DISTINCT COALESCE(tipo_cobranca, 'outros')) FILTER (WHERE status = 'em_aberto')
  INTO v_valor_total, v_dias_max, v_qtd_debitos, v_tipos_debito
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  v_nivel := determinar_nivel_escalonamento(v_dias_max);
  
  -- Busca dados da unidade
  SELECT nome_franqueado, codigo_unidade 
  INTO v_nome_franqueado, v_codigo_unidade
  FROM unidades_franqueadas 
  WHERE codigo_unidade = p_cnpj_unidade;
  
  -- Atualiza ou insere priorização
  INSERT INTO priorizacao_unidades (
    cnpj_unidade,
    codigo_unidade,
    nome_franqueado,
    score_priorizacao,
    nivel_escalonamento,
    valor_total_em_aberto,
    dias_inadimplencia_max,
    quantidade_debitos,
    tipos_debito
  ) VALUES (
    p_cnpj_unidade,
    v_codigo_unidade,
    COALESCE(v_nome_franqueado, 'Franqueado'),
    v_score,
    v_nivel,
    v_valor_total,
    v_dias_max,
    v_qtd_debitos,
    COALESCE(v_tipos_debito, '{}')
  )
  ON CONFLICT (cnpj_unidade) 
  DO UPDATE SET
    score_priorizacao = EXCLUDED.score_priorizacao,
    nivel_escalonamento = EXCLUDED.nivel_escalonamento,
    valor_total_em_aberto = EXCLUDED.valor_total_em_aberto,
    dias_inadimplencia_max = EXCLUDED.dias_inadimplencia_max,
    quantidade_debitos = EXCLUDED.quantidade_debitos,
    tipos_debito = EXCLUDED.tipos_debito,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Função para processar escalonamento automático
CREATE OR REPLACE FUNCTION processar_escalonamento_automatico()
RETURNS INTEGER AS $$
DECLARE
  v_unidade RECORD;
  v_criterios RECORD;
  v_escalonamentos INTEGER := 0;
BEGIN
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  -- Busca unidades que precisam de escalonamento
  FOR v_unidade IN 
    SELECT * FROM priorizacao_unidades 
    WHERE tentativas_contato_nivel >= v_criterios.max_tentativas_por_nivel
    AND nivel_escalonamento < 5
  LOOP
    -- Registra histórico
    INSERT INTO historico_escalonamento (
      cnpj_unidade,
      nivel_anterior,
      nivel_novo,
      motivo_escalonamento,
      score_anterior,
      score_novo,
      acao_automatica
    ) VALUES (
      v_unidade.cnpj_unidade,
      v_unidade.nivel_escalonamento,
      v_unidade.nivel_escalonamento + 1,
      'Escalonamento automático por máximo de tentativas',
      v_unidade.score_priorizacao,
      v_unidade.score_priorizacao,
      true
    );
    
    -- Atualiza nível
    UPDATE priorizacao_unidades 
    SET 
      nivel_escalonamento = nivel_escalonamento + 1,
      tentativas_contato_nivel = 0,
      updated_at = now()
    WHERE cnpj_unidade = v_unidade.cnpj_unidade;
    
    v_escalonamentos := v_escalonamentos + 1;
  END LOOP;
  
  RETURN v_escalonamentos;
END;
$$ LANGUAGE plpgsql;

-- Insere configuração padrão
INSERT INTO criterios_priorizacao (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- RLS (Row Level Security)
ALTER TABLE criterios_priorizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorizacao_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_escalonamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes_automaticas_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage criterios priorizacao" ON criterios_priorizacao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can view priorizacao unidades" ON priorizacao_unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage priorizacao unidades" ON priorizacao_unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can view historico escalonamento" ON historico_escalonamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage historico escalonamento" ON historico_escalonamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can view acoes automaticas log" ON acoes_automaticas_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert acoes automaticas log" ON acoes_automaticas_log FOR INSERT TO authenticated WITH CHECK (true);