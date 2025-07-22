/*
  # Integração Jurídica Automatizada

  1. Novas Tabelas
    - `juridico_log` - Log de ações jurídicas
    - `notificacoes_extrajudiciais` - Notificações formais geradas
    - `criterios_juridico` - Configuração de critérios
    
  2. Campos Adicionais
    - `juridico_status` em unidades_franqueadas
    - `nivel_criticidade` em cobrancas_franqueados
    
  3. Funções e Triggers
    - Verificação automática de critérios
    - Geração de notificações
    - Atualização de status
    
  4. Security
    - RLS habilitado em todas as tabelas
    - Políticas para acesso jurídico
*/

-- Enum para status jurídico
CREATE TYPE juridico_status_enum AS ENUM (
  'regular',
  'pendente_grave', 
  'notificado',
  'em_analise',
  'pre_processo',
  'acionado',
  'resolvido'
);

-- Enum para tipos de notificação
CREATE TYPE tipo_notificacao_juridica_enum AS ENUM (
  'extrajudicial',
  'formal',
  'ultima_chance',
  'pre_judicial',
  'judicial'
);

-- Enum para motivos de acionamento
CREATE TYPE motivo_acionamento_enum AS ENUM (
  'valor_alto',
  'cobrancas_ignoradas',
  'acordo_descumprido',
  'score_zero',
  'reincidencia_6_meses'
);

-- Adiciona campo juridico_status em unidades_franqueadas
ALTER TABLE unidades_franqueadas 
ADD COLUMN IF NOT EXISTS juridico_status juridico_status_enum DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS data_ultimo_acionamento timestamptz,
ADD COLUMN IF NOT EXISTS observacoes_juridicas text;

-- Adiciona campo nivel_criticidade em cobrancas_franqueados
ALTER TABLE cobrancas_franqueados 
ADD COLUMN IF NOT EXISTS nivel_criticidade text DEFAULT 'normal' CHECK (nivel_criticidade IN ('normal', 'grave', 'critico', 'juridico'));

-- Tabela de log jurídico
CREATE TABLE IF NOT EXISTS juridico_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  data_acao timestamptz DEFAULT now(),
  tipo_acao text NOT NULL,
  motivo_acionamento motivo_acionamento_enum NOT NULL,
  valor_em_aberto numeric NOT NULL DEFAULT 0,
  responsavel text NOT NULL,
  documento_gerado_url text,
  observacoes text,
  status_anterior juridico_status_enum,
  status_novo juridico_status_enum,
  created_at timestamptz DEFAULT now()
);

-- Tabela de notificações extrajudiciais
CREATE TABLE IF NOT EXISTS notificacoes_extrajudiciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  tipo_notificacao tipo_notificacao_juridica_enum NOT NULL DEFAULT 'extrajudicial',
  data_envio timestamptz DEFAULT now(),
  destinatario_email text,
  destinatario_whatsapp text,
  conteudo_notificacao text NOT NULL,
  documento_pdf_url text,
  status_envio text DEFAULT 'pendente' CHECK (status_envio IN ('pendente', 'enviado', 'entregue', 'falha')),
  data_prazo_resposta timestamptz,
  respondido boolean DEFAULT false,
  data_resposta timestamptz,
  observacoes_resposta text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de configuração de critérios jurídicos
CREATE TABLE IF NOT EXISTS criterios_juridico (
  id text PRIMARY KEY DEFAULT 'default',
  valor_minimo_acionamento numeric DEFAULT 5000.00,
  dias_sem_retorno_limite integer DEFAULT 15,
  quantidade_cobrancas_ignoradas integer DEFAULT 3,
  score_minimo_acionamento integer DEFAULT 0,
  meses_reincidencia_limite integer DEFAULT 6,
  prazo_resposta_notificacao_dias integer DEFAULT 5,
  template_notificacao_extrajudicial text DEFAULT 'Prezado(a) {{nome_franqueado}},

Consta em nosso sistema pendência financeira com vencimento superior a {{dias_em_aberto}} dias, no valor de R$ {{valor_total}}.

Esta notificação extrajudicial visa formalizar a ciência da dívida e informar que, caso não haja manifestação no prazo de {{prazo_resposta}} dias úteis, serão adotadas providências legais previstas em contrato.

Dados da Pendência:
- Código da Unidade: {{codigo_unidade}}
- Valor Total em Aberto: R$ {{valor_total}}
- Data de Vencimento mais Antiga: {{data_vencimento_antiga}}
- Motivo do Acionamento: {{motivo_acionamento}}

Para regularização imediata, entre em contato através dos canais oficiais ou acesse sua central de cobrança.

Atenciosamente,
Setor Jurídico – Cresci e Perdi',
  email_responsavel_juridico text DEFAULT 'juridico@crescieperdi.com',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insere configuração padrão
INSERT INTO criterios_juridico (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_juridico_log_cnpj ON juridico_log (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_juridico_log_data ON juridico_log (data_acao DESC);
CREATE INDEX IF NOT EXISTS idx_juridico_log_motivo ON juridico_log (motivo_acionamento);

CREATE INDEX IF NOT EXISTS idx_notificacoes_cnpj ON notificacoes_extrajudiciais (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_notificacoes_data ON notificacoes_extrajudiciais (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_status ON notificacoes_extrajudiciais (status_envio);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes_extrajudiciais (tipo_notificacao);

CREATE INDEX IF NOT EXISTS idx_unidades_juridico_status ON unidades_franqueadas (juridico_status);

-- Função para verificar critérios de acionamento jurídico
CREATE OR REPLACE FUNCTION verificar_criterios_juridico(p_cnpj_unidade text)
RETURNS jsonb AS $$
DECLARE
  v_config record;
  v_cobrancas record;
  v_score_risco record;
  v_acordos_quebrados integer;
  v_reincidencia_6_meses integer;
  v_cobrancas_ignoradas integer;
  v_resultado jsonb;
  v_deve_acionar boolean := false;
  v_motivos text[] := '{}';
  v_valor_total numeric := 0;
  v_dias_atraso_max integer := 0;
BEGIN
  -- Busca configuração
  SELECT * INTO v_config FROM criterios_juridico WHERE id = 'default';
  
  -- Busca dados das cobranças da unidade
  SELECT 
    COUNT(*) as total_cobrancas,
    SUM(CASE WHEN status = 'em_aberto' THEN valor_atualizado ELSE 0 END) as valor_em_aberto,
    MAX(CASE WHEN status = 'em_aberto' THEN dias_em_atraso ELSE 0 END) as max_dias_atraso
  INTO v_cobrancas
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  v_valor_total := COALESCE(v_cobrancas.valor_em_aberto, 0);
  v_dias_atraso_max := COALESCE(v_cobrancas.max_dias_atraso, 0);
  
  -- Critério 1: Valor total em aberto > limite
  IF v_valor_total > v_config.valor_minimo_acionamento THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'valor_alto');
  END IF;
  
  -- Critério 2: Cobranças ignoradas (sem tratativas há mais de X dias)
  SELECT COUNT(*) INTO v_cobrancas_ignoradas
  FROM cobrancas_franqueados c
  WHERE c.cnpj = p_cnpj_unidade 
    AND c.status = 'em_aberto'
    AND NOT EXISTS (
      SELECT 1 FROM tratativas_cobranca t 
      WHERE t.titulo_id = c.id 
        AND t.data_interacao > (now() - interval '15 days')
        AND t.tipo_interacao != 'mensagem_automatica'
    );
    
  IF v_cobrancas_ignoradas >= v_config.quantidade_cobrancas_ignoradas THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'cobrancas_ignoradas');
  END IF;
  
  -- Critério 3: Acordo descumprido
  SELECT COUNT(*) INTO v_acordos_quebrados
  FROM acordos_parcelamento 
  WHERE cnpj_unidade = p_cnpj_unidade 
    AND status_acordo = 'quebrado';
    
  IF v_acordos_quebrados > 0 THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'acordo_descumprido');
  END IF;
  
  -- Critério 4: Score de risco = 0
  SELECT * INTO v_score_risco 
  FROM score_risco_unidades 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  IF v_score_risco.score_atual IS NOT NULL AND v_score_risco.score_atual <= v_config.score_minimo_acionamento THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'score_zero');
  END IF;
  
  -- Critério 5: Reincidência nos últimos 6 meses
  SELECT COUNT(DISTINCT DATE_TRUNC('month', created_at)) INTO v_reincidencia_6_meses
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND created_at > (now() - interval '6 months')
    AND status IN ('em_aberto', 'vencido');
    
  IF v_reincidencia_6_meses >= v_config.meses_reincidencia_limite THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'reincidencia_6_meses');
  END IF;
  
  -- Monta resultado
  v_resultado := jsonb_build_object(
    'deve_acionar', v_deve_acionar,
    'motivos', v_motivos,
    'valor_total', v_valor_total,
    'dias_atraso_max', v_dias_atraso_max,
    'cobrancas_ignoradas', v_cobrancas_ignoradas,
    'acordos_quebrados', v_acordos_quebrados,
    'score_atual', COALESCE(v_score_risco.score_atual, 0),
    'reincidencia_meses', v_reincidencia_6_meses
  );
  
  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar notificação extrajudicial
CREATE OR REPLACE FUNCTION gerar_notificacao_extrajudicial(
  p_cnpj_unidade text,
  p_motivo_acionamento motivo_acionamento_enum,
  p_responsavel text DEFAULT 'sistema_automatico'
)
RETURNS uuid AS $$
DECLARE
  v_config record;
  v_unidade record;
  v_criterios jsonb;
  v_conteudo_notificacao text;
  v_notificacao_id uuid;
  v_data_prazo timestamptz;
BEGIN
  -- Busca configuração e dados da unidade
  SELECT * INTO v_config FROM criterios_juridico WHERE id = 'default';
  
  SELECT * INTO v_unidade 
  FROM unidades_franqueadas 
  WHERE codigo_unidade = p_cnpj_unidade;
  
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_cnpj_unidade;
  END IF;
  
  -- Busca critérios atuais
  SELECT verificar_criterios_juridico(p_cnpj_unidade) INTO v_criterios;
  
  -- Calcula data do prazo
  v_data_prazo := now() + (v_config.prazo_resposta_notificacao_dias || ' days')::interval;
  
  -- Gera conteúdo da notificação substituindo variáveis
  v_conteudo_notificacao := v_config.template_notificacao_extrajudicial;
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{nome_franqueado}}', v_unidade.nome_franqueado);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{codigo_unidade}}', v_unidade.codigo_unidade);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{dias_em_aberto}}', (v_criterios->>'dias_atraso_max')::text);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{valor_total}}', to_char((v_criterios->>'valor_total')::numeric, 'FM999G999G999D00'));
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{prazo_resposta}}', v_config.prazo_resposta_notificacao_dias::text);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{motivo_acionamento}}', p_motivo_acionamento::text);
  
  -- Busca data de vencimento mais antiga
  DECLARE
    v_data_vencimento_antiga date;
  BEGIN
    SELECT MIN(data_vencimento) INTO v_data_vencimento_antiga
    FROM cobrancas_franqueados 
    WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
    
    v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{data_vencimento_antiga}}', 
      COALESCE(v_data_vencimento_antiga::text, 'N/A'));
  END;
  
  -- Insere notificação
  INSERT INTO notificacoes_extrajudiciais (
    cnpj_unidade,
    tipo_notificacao,
    destinatario_email,
    destinatario_whatsapp,
    conteudo_notificacao,
    data_prazo_resposta
  ) VALUES (
    p_cnpj_unidade,
    'extrajudicial',
    v_unidade.email_franqueado,
    v_unidade.telefone_franqueado,
    v_conteudo_notificacao,
    v_data_prazo
  ) RETURNING id INTO v_notificacao_id;
  
  -- Atualiza status da unidade
  UPDATE unidades_franqueadas 
  SET 
    juridico_status = 'notificado',
    data_ultimo_acionamento = now()
  WHERE codigo_unidade = p_cnpj_unidade;
  
  -- Registra no log jurídico
  INSERT INTO juridico_log (
    cnpj_unidade,
    tipo_acao,
    motivo_acionamento,
    valor_em_aberto,
    responsavel,
    status_anterior,
    status_novo
  ) VALUES (
    p_cnpj_unidade,
    'notificacao_extrajudicial',
    p_motivo_acionamento,
    (v_criterios->>'valor_total')::numeric,
    p_responsavel,
    v_unidade.juridico_status,
    'notificado'
  );
  
  RETURN v_notificacao_id;
END;
$$ LANGUAGE plpgsql;

-- Função para processar acionamento jurídico automático
CREATE OR REPLACE FUNCTION processar_acionamento_juridico_automatico()
RETURNS integer AS $$
DECLARE
  v_unidade record;
  v_criterios jsonb;
  v_acionamentos integer := 0;
  v_motivo_principal motivo_acionamento_enum;
BEGIN
  -- Busca unidades ativas que não estão em processo jurídico
  FOR v_unidade IN 
    SELECT codigo_unidade, juridico_status
    FROM unidades_franqueadas 
    WHERE status_unidade = 'ativa' 
      AND juridico_status NOT IN ('notificado', 'em_analise', 'pre_processo', 'acionado')
  LOOP
    -- Verifica critérios para cada unidade
    SELECT verificar_criterios_juridico(v_unidade.codigo_unidade) INTO v_criterios;
    
    -- Se deve acionar
    IF (v_criterios->>'deve_acionar')::boolean THEN
      -- Determina motivo principal
      IF 'valor_alto' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'valor_alto';
      ELSIF 'acordo_descumprido' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'acordo_descumprido';
      ELSIF 'cobrancas_ignoradas' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'cobrancas_ignoradas';
      ELSIF 'score_zero' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'score_zero';
      ELSE
        v_motivo_principal := 'reincidencia_6_meses';
      END IF;
      
      -- Gera notificação
      PERFORM gerar_notificacao_extrajudicial(
        v_unidade.codigo_unidade,
        v_motivo_principal,
        'sistema_automatico'
      );
      
      v_acionamentos := v_acionamentos + 1;
    END IF;
  END LOOP;
  
  RETURN v_acionamentos;
END;
$$ LANGUAGE plpgsql;

-- Função para resolver acionamento após quitação
CREATE OR REPLACE FUNCTION resolver_acionamento_juridico(p_cnpj_unidade text)
RETURNS void AS $$
DECLARE
  v_valor_em_aberto numeric;
BEGIN
  -- Verifica se ainda há débitos em aberto
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_em_aberto
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
  
  -- Se não há mais débitos, resolve o acionamento
  IF v_valor_em_aberto = 0 THEN
    -- Atualiza status da unidade
    UPDATE unidades_franqueadas 
    SET juridico_status = 'resolvido'
    WHERE codigo_unidade = p_cnpj_unidade;
    
    -- Registra resolução no log
    INSERT INTO juridico_log (
      cnpj_unidade,
      tipo_acao,
      motivo_acionamento,
      valor_em_aberto,
      responsavel,
      status_novo
    ) VALUES (
      p_cnpj_unidade,
      'resolucao_automatica',
      'valor_alto', -- Motivo genérico para resolução
      0,
      'sistema_automatico',
      'resolvido'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para resolver acionamento quando cobrança é quitada
CREATE OR REPLACE FUNCTION trigger_resolver_acionamento()
RETURNS trigger AS $$
BEGIN
  -- Se status mudou para quitado
  IF OLD.status != 'quitado' AND NEW.status = 'quitado' THEN
    PERFORM resolver_acionamento_juridico(NEW.cnpj);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger
DROP TRIGGER IF EXISTS trigger_resolver_acionamento_juridico ON cobrancas_franqueados;
CREATE TRIGGER trigger_resolver_acionamento_juridico
  AFTER UPDATE ON cobrancas_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION trigger_resolver_acionamento();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_juridico_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_notificacoes_extrajudiciais_updated_at
  BEFORE UPDATE ON notificacoes_extrajudiciais
  FOR EACH ROW
  EXECUTE FUNCTION update_juridico_updated_at();

CREATE TRIGGER update_criterios_juridico_updated_at
  BEFORE UPDATE ON criterios_juridico
  FOR EACH ROW
  EXECUTE FUNCTION update_juridico_updated_at();

-- Habilita RLS
ALTER TABLE juridico_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_extrajudiciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterios_juridico ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Juridico can manage all data" 
ON juridico_log 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Juridico can manage notificacoes" 
ON notificacoes_extrajudiciais 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Admins can manage criterios juridico" 
ON criterios_juridico 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);