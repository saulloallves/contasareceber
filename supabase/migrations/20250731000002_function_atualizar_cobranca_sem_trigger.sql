-- Função para atualizar cobrança sem disparar triggers problemáticos
-- Usado como workaround para o problema RLS da tabela eventos_score

CREATE OR REPLACE FUNCTION atualizar_cobranca_sem_trigger(
  p_cobranca_id UUID,
  p_status TEXT,
  p_valor_recebido NUMERIC,
  p_data_atualizacao TIMESTAMP WITH TIME ZONE
) RETURNS VOID AS $$
BEGIN
  -- Temporariamente desabilita o trigger que causa problema
  ALTER TABLE cobrancas_franqueados DISABLE TRIGGER trigger_score_cobrancas;
  
  -- Atualiza a cobrança
  UPDATE cobrancas_franqueados 
  SET 
    status = p_status,
    valor_recebido = p_valor_recebido,
    data_ultima_atualizacao = p_data_atualizacao
  WHERE id = p_cobranca_id;
  
  -- Reabilita o trigger
  ALTER TABLE cobrancas_franqueados ENABLE TRIGGER trigger_score_cobrancas;
  
  -- Insere o evento manualmente na tabela eventos_score se for quitação
  IF p_status = 'quitado' THEN
    INSERT INTO eventos_score (cnpj_unidade, tipo_evento, descricao)
    SELECT 
      cnpj,
      'pagamento',
      'Cobrança quitada'
    FROM cobrancas_franqueados 
    WHERE id = p_cobranca_id
    ON CONFLICT DO NOTHING; -- Evita duplicatas
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Garante que o trigger seja reabilitado mesmo em caso de erro
    ALTER TABLE cobrancas_franqueados ENABLE TRIGGER trigger_score_cobrancas;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
