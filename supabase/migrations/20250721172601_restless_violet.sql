-- Migration: Sistema de Renegociação de Acordos
-- Descrição: Adiciona funcionalidades para renegociar acordos existentes com histórico completo

-- 1. Adicionar campo para referenciar acordo anterior
ALTER TABLE acordos_parcelamento 
ADD COLUMN acordo_anterior_id UUID REFERENCES acordos_parcelamento(id);

-- 2. Adicionar status 'renegociado' ao enum
ALTER TYPE status_acordo_enum ADD VALUE IF NOT EXISTS 'renegociado';

-- 3. Criar tabela de histórico de renegociações
CREATE TABLE IF NOT EXISTS historico_renegociacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_anterior_id UUID NOT NULL REFERENCES acordos_parcelamento(id),
  acordo_novo_id UUID NOT NULL REFERENCES acordos_parcelamento(id),
  justificativa TEXT NOT NULL,
  aprovado_por TEXT NOT NULL,
  data_renegociacao TIMESTAMPTZ DEFAULT now(),
  valor_anterior NUMERIC NOT NULL,
  valor_novo NUMERIC NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_historico_renegociacoes_acordo_anterior 
ON historico_renegociacoes(acordo_anterior_id);

CREATE INDEX IF NOT EXISTS idx_historico_renegociacoes_acordo_novo 
ON historico_renegociacoes(acordo_novo_id);

CREATE INDEX IF NOT EXISTS idx_historico_renegociacoes_data 
ON historico_renegociacoes(data_renegociacao DESC);

-- 5. Habilitar RLS
ALTER TABLE historico_renegociacoes ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS
CREATE POLICY "Admins can manage renegociacao history" 
ON historico_renegociacoes 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 7. Função para validar renegociação
CREATE OR REPLACE FUNCTION validar_renegociacao_acordo(
  p_acordo_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_acordo RECORD;
  v_resultado JSONB;
BEGIN
  -- Busca dados do acordo
  SELECT * INTO v_acordo
  FROM acordos_parcelamento
  WHERE id = p_acordo_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pode_renegociar', false,
      'motivo', 'Acordo não encontrado'
    );
  END IF;
  
  -- Verifica status
  IF v_acordo.status_acordo NOT IN ('aceito', 'cumprindo') THEN
    RETURN jsonb_build_object(
      'pode_renegociar', false,
      'motivo', 'Apenas acordos aceitos ou em cumprimento podem ser renegociados'
    );
  END IF;
  
  -- Verifica se já foi renegociado recentemente
  IF EXISTS (
    SELECT 1 FROM historico_renegociacoes 
    WHERE acordo_anterior_id = p_acordo_id 
    AND data_renegociacao > now() - interval '30 days'
  ) THEN
    RETURN jsonb_build_object(
      'pode_renegociar', false,
      'motivo', 'Acordo já foi renegociado nos últimos 30 dias'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'pode_renegociar', true,
    'acordo_atual', row_to_json(v_acordo)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função para processar renegociação
CREATE OR REPLACE FUNCTION processar_renegociacao_acordo(
  p_acordo_id UUID,
  p_justificativa TEXT,
  p_aprovado_por TEXT,
  p_nova_quantidade_parcelas INTEGER,
  p_novo_valor_entrada NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_acordo_atual RECORD;
  v_novo_acordo_id UUID;
  v_validacao JSONB;
BEGIN
  -- Valida se pode renegociar
  v_validacao := validar_renegociacao_acordo(p_acordo_id);
  
  IF NOT (v_validacao->>'pode_renegociar')::boolean THEN
    RAISE EXCEPTION 'Não é possível renegociar: %', v_validacao->>'motivo';
  END IF;
  
  -- Busca acordo atual
  SELECT * INTO v_acordo_atual
  FROM acordos_parcelamento
  WHERE id = p_acordo_id;
  
  -- Arquiva acordo anterior
  UPDATE acordos_parcelamento
  SET 
    status_acordo = 'renegociado',
    observacoes = COALESCE(observacoes, '') || 
      E'\n\nRenegociado em ' || now()::date || 
      '. Justificativa: ' || p_justificativa || 
      '. Aprovado por: ' || p_aprovado_por,
    updated_at = now()
  WHERE id = p_acordo_id;
  
  -- Registra no histórico
  INSERT INTO historico_renegociacoes (
    acordo_anterior_id,
    acordo_novo_id, -- Será atualizado depois
    justificativa,
    aprovado_por,
    valor_anterior,
    valor_novo -- Será atualizado depois
  ) VALUES (
    p_acordo_id,
    gen_random_uuid(), -- Temporário
    p_justificativa,
    p_aprovado_por,
    v_acordo_atual.valor_total_acordo,
    0 -- Será atualizado depois
  );
  
  RETURN v_novo_acordo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger para atualizar histórico quando novo acordo é criado
CREATE OR REPLACE FUNCTION trigger_atualizar_historico_renegociacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o acordo tem referência a acordo anterior, atualiza o histórico
  IF NEW.acordo_anterior_id IS NOT NULL THEN
    UPDATE historico_renegociacoes
    SET 
      acordo_novo_id = NEW.id,
      valor_novo = NEW.valor_total_acordo
    WHERE acordo_anterior_id = NEW.acordo_anterior_id
    AND acordo_novo_id != NEW.id; -- Evita loop
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_historico_renegociacao
  AFTER INSERT ON acordos_parcelamento
  FOR EACH ROW
  EXECUTE FUNCTION trigger_atualizar_historico_renegociacao();

-- 10. View para histórico completo de acordos por unidade
CREATE OR REPLACE VIEW view_historico_acordos_unidade AS
SELECT 
  a.cnpj_unidade,
  a.id as acordo_id,
  a.status_acordo,
  a.valor_total_acordo,
  a.quantidade_parcelas,
  a.created_at as data_acordo,
  a.aceito_em,
  a.acordo_anterior_id,
  hr.justificativa as justificativa_renegociacao,
  hr.aprovado_por as renegociacao_aprovada_por,
  hr.data_renegociacao,
  CASE 
    WHEN a.acordo_anterior_id IS NOT NULL THEN 'Renegociação'
    ELSE 'Original'
  END as tipo_acordo,
  ROW_NUMBER() OVER (
    PARTITION BY a.cnpj_unidade 
    ORDER BY a.created_at
  ) as numero_tentativa
FROM acordos_parcelamento a
LEFT JOIN historico_renegociacoes hr ON hr.acordo_novo_id = a.id
ORDER BY a.cnpj_unidade, a.created_at;

-- 11. Comentários para documentação
COMMENT ON TABLE historico_renegociacoes IS 'Histórico completo de renegociações de acordos';
COMMENT ON COLUMN acordos_parcelamento.acordo_anterior_id IS 'Referência ao acordo que foi renegociado';
COMMENT ON FUNCTION validar_renegociacao_acordo IS 'Valida se um acordo pode ser renegociado';
COMMENT ON FUNCTION processar_renegociacao_acordo IS 'Processa a renegociação de um acordo existente';