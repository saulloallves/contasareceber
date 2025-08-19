-- PASSO 1: Adicionar a coluna de referência na tabela de cobranças
-- Esta coluna irá "carimbar" cada cobrança com o ID da importação que a processou.
ALTER TABLE public.cobrancas_franqueados
ADD COLUMN importacao_id_fk UUID;

-- PASSO 2: (Opcional, mas altamente recomendado) Criar a chave estrangeira
-- Isso garante a integridade referencial com sua tabela de logs de importação.
ALTER TABLE public.cobrancas_franqueados
ADD CONSTRAINT fk_cobrancas_to_importacao_log
FOREIGN KEY (importacao_id_fk)
REFERENCES public.importacoes_planilha(id)
ON DELETE SET NULL; -- Se um log for apagado, a referência na cobrança fica nula.

-- PASSO 3: (Opcional, mas altamente recomendado) Criar um índice para performance
-- A função de conciliação usará esta coluna intensivamente. O índice é crucial.
CREATE INDEX IF NOT EXISTS idx_cobrancas_importacao_id_fk
ON public.cobrancas_franqueados(importacao_id_fk);


-- PASSO 4: Criar a função "agente" de conciliação
-- Esta é a inteligência que marca as cobranças como quitadas.
CREATE OR REPLACE FUNCTION public.marcar_cobrancas_quitadas(p_importacao_id UUID)
RETURNS jsonb AS $$
DECLARE
  quitadas_count integer;
  updated_ids uuid[];
BEGIN
  -- A lógica central: atualiza para 'quitado' todas as cobranças em aberto
  -- que NÃO foram processadas na importação atual (identificada por p_importacao_id).
  WITH updated_rows AS (
    UPDATE public.cobrancas_franqueados
    SET
      status = 'quitado',
      updated_at = now() -- Importante para rastrear a data da quitação automática
    WHERE
      (status = 'em_aberto' OR status = 'parcialmente_pago')
      AND (importacao_id_fk IS NULL OR importacao_id_fk <> p_importacao_id)
    RETURNING id
  )
  SELECT count(*), array_agg(id) INTO quitadas_count, updated_ids FROM updated_rows;

  -- Retorna um objeto JSON para o n8n. Isso permite que você logue o resultado
  -- e até mesmo atualize seu log de importação com o número de cobranças quitadas.
  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Processo de conciliação finalizado.',
    'registros_quitados', quitadas_count
  );
END;
$$ LANGUAGE plpgsql;