CREATE OR REPLACE FUNCTION public.atualizar_campos_calculados()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Generate hash_titulo if not provided
  IF NEW.hash_titulo IS NULL THEN
    NEW.hash_titulo := gerar_hash_titulo(NEW.cnpj, NEW.valor_original, NEW.data_vencimento);
  END IF;
  
  -- Calculate dias_em_atraso
  NEW.dias_em_atraso := calcular_dias_em_atraso(NEW.data_vencimento);
  
  -- Calculate valor_atualizado
  NEW.valor_atualizado := calcular_valor_atualizado(NEW.valor_original, NEW.dias_em_atraso);
  
  -- Update data_ultima_atualizacao
  NEW.data_ultima_atualizacao := now();
  
  -- Auto-update status based on payment, only if status is not being changed manually
  -- If it's an UPDATE and the status is being changed, respect the new value.
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    IF NEW.valor_recebido IS NOT NULL AND NEW.valor_recebido > 0 THEN
        IF NEW.valor_recebido >= NEW.valor_atualizado THEN
            NEW.status := 'quitado';
        ELSE
            NEW.status := 'negociando';
        END IF;
    ELSIF NEW.dias_em_atraso > 0 THEN
        NEW.status := 'em_aberto';
    ELSE
        NEW.status := 'a_vencer';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;
