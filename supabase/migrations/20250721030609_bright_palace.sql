/*
  # Sistema de Escalonamento para Jurídico/Diretoria

  1. Nova Tabela
    - `escalonamentos_cobranca`
      - `id` (uuid, primary key)
      - `titulo_id` (uuid, foreign key)
      - `cnpj_unidade` (text)
      - `data_escalonamento` (timestamptz)
      - `motivo_escalonamento` (text)
      - `enviado_para` (text)
      - `nivel` (enum)
      - `documento_gerado` (boolean)
      - `responsavel_designado` (text)
      - `status` (enum)

  2. Enums
    - `nivel_escalonamento_enum`
    - `status_escalonamento_enum`

  3. Funções
    - `verificar_criterios_escalonamento()`
    - `processar_escalonamento_automatico()`

  4. Triggers
    - Verificação automática após mudanças em cobranças e tratativas
*/

-- Criar enums
CREATE TYPE nivel_escalonamento_enum AS ENUM ('juridico', 'diretoria', 'auditoria');
CREATE TYPE status_escalonamento_enum AS ENUM ('pendente', 'em_analise', 'encerrado', 'resolvido');

-- Criar tabela de escalonamentos
CREATE TABLE IF NOT EXISTS escalonamentos_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade text,
  data_escalonamento timestamptz DEFAULT now(),
  motivo_escalonamento text NOT NULL,
  enviado_para text DEFAULT 'juridico@franquia.com',
  nivel nivel_escalonamento_enum DEFAULT 'juridico',
  documento_gerado boolean DEFAULT false,
  responsavel_designado text,
  status status_escalonamento_enum DEFAULT 'pendente',
  valor_total_envolvido numeric DEFAULT 0,
  quantidade_titulos integer DEFAULT 1,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_escalonamentos_titulo_id ON escalonamentos_cobranca(titulo_id);
CREATE INDEX idx_escalonamentos_cnpj ON escalonamentos_cobranca(cnpj_unidade);
CREATE INDEX idx_escalonamentos_status ON escalonamentos_cobranca(status);
CREATE INDEX idx_escalonamentos_nivel ON escalonamentos_cobranca(nivel);
CREATE INDEX idx_escalonamentos_data ON escalonamentos_cobranca(data_escalonamento DESC);

-- RLS
ALTER TABLE escalonamentos_cobranca ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Juridico can manage escalonamentos" 
ON escalonamentos_cobranca 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Função para verificar critérios de escalonamento
CREATE OR REPLACE FUNCTION verificar_criterios_escalonamento(p_titulo_id uuid)
RETURNS TABLE(
  deve_escalar boolean,
  motivo text,
  nivel nivel_escalonamento_enum,
  valor_envolvido numeric
) AS $$
DECLARE
  v_cobranca record;
  v_reunioes_falhadas integer;
  v_valor_total_unidade numeric;
  v_meses_consecutivos integer;
  v_acordo_nao_cumprido boolean;
  v_tratativas_resolutivas integer;
BEGIN
  -- Busca dados da cobrança
  SELECT * INTO v_cobranca 
  FROM cobrancas_franqueados 
  WHERE id = p_titulo_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Título não encontrado', 'juridico'::nivel_escalonamento_enum, 0::numeric;
    RETURN;
  END IF;
  
  -- Verifica se já foi escalado
  IF EXISTS (
    SELECT 1 FROM escalonamentos_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND status IN ('pendente', 'em_analise')
  ) THEN
    RETURN QUERY SELECT false, 'Já escalado', 'juridico'::nivel_escalonamento_enum, 0::numeric;
    RETURN;
  END IF;

  -- Critério 1: Atraso > 90 dias sem tratativas resolutivas
  IF v_cobranca.dias_em_atraso > 90 THEN
    SELECT COUNT(*) INTO v_tratativas_resolutivas
    FROM tratativas_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND tipo_interacao IN ('proposta_aceita', 'acordo_fechado', 'pagamento_parcial');
    
    IF v_tratativas_resolutivas = 0 THEN
      RETURN QUERY SELECT 
        true, 
        'Atraso superior a 90 dias sem tratativas resolutivas',
        'juridico'::nivel_escalonamento_enum,
        v_cobranca.valor_atualizado;
      RETURN;
    END IF;
  END IF;

  -- Critério 2: 3+ reuniões falhadas
  SELECT COUNT(*) INTO v_reunioes_falhadas
  FROM reunioes_negociacao 
  WHERE titulo_id = p_titulo_id 
  AND status_reuniao IN ('remarcada', 'nao_compareceu');
  
  IF v_reunioes_falhadas >= 3 THEN
    RETURN QUERY SELECT 
      true, 
      'Três ou mais reuniões remarcadas/não realizadas',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Critério 3: Valor total da unidade > R$ 20.000
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total_unidade
  FROM cobrancas_franqueados 
  WHERE cnpj = v_cobranca.cnpj 
  AND status = 'em_aberto';
  
  IF v_valor_total_unidade > 20000 THEN
    RETURN QUERY SELECT 
      true, 
      'Valor total em aberto da unidade superior a R$ 20.000',
      'diretoria'::nivel_escalonamento_enum,
      v_valor_total_unidade;
    RETURN;
  END IF;

  -- Critério 4: Status crítico manual
  IF v_cobranca.status = 'em_tratativa_critica' THEN
    RETURN QUERY SELECT 
      true, 
      'Marcado manualmente como tratativa crítica',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Critério 5: Acordo não cumprido
  SELECT EXISTS(
    SELECT 1 FROM tratativas_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND tipo_interacao = 'proposta_aceita'
    AND created_at < now() - interval '30 days'
  ) AND v_cobranca.valor_recebido = 0 INTO v_acordo_nao_cumprido;
  
  IF v_acordo_nao_cumprido THEN
    RETURN QUERY SELECT 
      true, 
      'Acordo firmado não cumprido após 30 dias',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Nenhum critério atendido
  RETURN QUERY SELECT false, 'Nenhum critério de escalonamento atendido', 'juridico'::nivel_escalonamento_enum, 0::numeric;
END;
$$ LANGUAGE plpgsql;

-- Função para processar escalonamento automático
CREATE OR REPLACE FUNCTION processar_escalonamento_automatico(p_titulo_id uuid)
RETURNS void AS $$
DECLARE
  v_criterio record;
  v_cobranca record;
  v_escalonamento_id uuid;
BEGIN
  -- Verifica critérios
  SELECT * INTO v_criterio 
  FROM verificar_criterios_escalonamento(p_titulo_id);
  
  IF NOT v_criterio.deve_escalar THEN
    RETURN;
  END IF;
  
  -- Busca dados da cobrança
  SELECT * INTO v_cobranca 
  FROM cobrancas_franqueados 
  WHERE id = p_titulo_id;
  
  -- Cria escalonamento
  INSERT INTO escalonamentos_cobranca (
    titulo_id,
    cnpj_unidade,
    motivo_escalonamento,
    nivel,
    valor_total_envolvido,
    enviado_para
  ) VALUES (
    p_titulo_id,
    v_cobranca.cnpj,
    v_criterio.motivo,
    v_criterio.nivel,
    v_criterio.valor_envolvido,
    CASE 
      WHEN v_criterio.nivel = 'diretoria' THEN 'diretoria@franquia.com'
      WHEN v_criterio.nivel = 'auditoria' THEN 'auditoria@franquia.com'
      ELSE 'juridico@franquia.com'
    END
  ) RETURNING id INTO v_escalonamento_id;
  
  -- Registra tratativa
  INSERT INTO tratativas_cobranca (
    titulo_id,
    tipo_interacao,
    canal,
    usuario_sistema,
    descricao,
    status_cobranca_resultante
  ) VALUES (
    p_titulo_id,
    'escalonamento',
    'interno',
    'sistema_automatico',
    'Caso escalado automaticamente: ' || v_criterio.motivo,
    'em_tratativa_juridica'
  );
  
  -- Atualiza status da cobrança
  UPDATE cobrancas_franqueados 
  SET status = 'em_tratativa_juridica'
  WHERE id = p_titulo_id;
  
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificação automática
CREATE OR REPLACE FUNCTION trigger_verificar_escalonamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica escalonamento após mudanças relevantes
  PERFORM processar_escalonamento_automatico(NEW.titulo_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em tratativas
CREATE TRIGGER trigger_escalonamento_tratativas
  AFTER INSERT OR UPDATE ON tratativas_cobranca
  FOR EACH ROW
  EXECUTE FUNCTION trigger_verificar_escalonamento();

-- Aplicar trigger em reuniões
CREATE TRIGGER trigger_escalonamento_reunioes
  AFTER INSERT OR UPDATE ON reunioes_negociacao
  FOR EACH ROW
  EXECUTE FUNCTION trigger_verificar_escalonamento();

-- Trigger para updated_at
CREATE TRIGGER update_escalonamentos_cobranca_updated_at
  BEFORE UPDATE ON escalonamentos_cobranca
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para verificação em lote (executar periodicamente)
CREATE OR REPLACE FUNCTION verificar_escalonamentos_lote()
RETURNS integer AS $$
DECLARE
  v_titulo record;
  v_count integer := 0;
BEGIN
  FOR v_titulo IN 
    SELECT id FROM cobrancas_franqueados 
    WHERE status IN ('em_aberto', 'negociando')
    AND id NOT IN (
      SELECT titulo_id FROM escalonamentos_cobranca 
      WHERE status IN ('pendente', 'em_analise')
    )
  LOOP
    PERFORM processar_escalonamento_automatico(v_titulo.id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;