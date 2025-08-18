/*
  # Suporte a CPF e vínculo com franqueado em cobrancas_franqueados

  - Torna cnpj opcional (para permitir títulos vinculados por CPF)
  - Adiciona coluna cpf (texto)
  - Adiciona FKs opcionais: unidade_id_fk -> unidades_franqueadas.id e franqueado_id_fk -> franqueados.id
  - Cria índices para performance
  - Ajusta função/trigger de cálculo para gerar hash com COALESCE(cpf, cnpj)
*/

-- 1) Relaxar NOT NULL do CNPJ para permitir registros por CPF
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'cobrancas_franqueados' 
      AND column_name = 'cnpj'
  ) THEN
    BEGIN
      ALTER TABLE public.cobrancas_franqueados 
        ALTER COLUMN cnpj DROP NOT NULL;
    EXCEPTION WHEN others THEN
      -- ignora se já estiver nulo
      NULL;
    END;
  END IF;
END $$;

-- 2) Adicionar coluna CPF (se não existir)
ALTER TABLE public.cobrancas_franqueados 
  ADD COLUMN IF NOT EXISTS cpf text;

-- 3) Adicionar coluna unidade_id_fk (se não existir)
ALTER TABLE public.cobrancas_franqueados 
  ADD COLUMN IF NOT EXISTS unidade_id_fk uuid;

-- 3.1) Garantir a constraint nomeada unidade_id_fk
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'cobrancas_franqueados' 
      AND constraint_name = 'unidade_id_fk'
  ) THEN
    BEGIN
      ALTER TABLE public.cobrancas_franqueados
        ADD CONSTRAINT unidade_id_fk 
        FOREIGN KEY (unidade_id_fk) REFERENCES public.unidades_franqueadas(id) 
        ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      -- Caso já exista com outro nome, ignora
      NULL;
    END;
  END IF;
END $$;

-- 4) Adicionar coluna franqueado_id_fk (se não existir)
ALTER TABLE public.cobrancas_franqueados 
  ADD COLUMN IF NOT EXISTS franqueado_id_fk uuid;

-- 4.1) Garantir a constraint nomeada franqueado_id_fk
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'cobrancas_franqueados' 
      AND constraint_name = 'franqueado_id_fk'
  ) THEN
    BEGIN
      ALTER TABLE public.cobrancas_franqueados
        ADD CONSTRAINT franqueado_id_fk 
        FOREIGN KEY (franqueado_id_fk) REFERENCES public.franqueados(id) 
        ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END $$;

-- 5) Constraint: requer pelo menos um documento (cnpj ou cpf)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'cobrancas_franqueados' 
      AND constraint_name = 'cobrancas_doc_presente_chk'
  ) THEN
    ALTER TABLE public.cobrancas_franqueados 
      ADD CONSTRAINT cobrancas_doc_presente_chk 
      CHECK (cnpj IS NOT NULL OR cpf IS NOT NULL);
  END IF;
END $$;

-- 6) Índices
CREATE INDEX IF NOT EXISTS idx_cobrancas_cpf ON public.cobrancas_franqueados(cpf);
CREATE INDEX IF NOT EXISTS idx_cobrancas_unidade_fk ON public.cobrancas_franqueados(unidade_id_fk);
CREATE INDEX IF NOT EXISTS idx_cobrancas_franqueado_fk ON public.cobrancas_franqueados(franqueado_id_fk);

-- 7) Atualizar função de trigger para usar documento coalescido
CREATE OR REPLACE FUNCTION public.atualizar_campos_calculados()
RETURNS TRIGGER AS $$
DECLARE
  v_documento text;
BEGIN
  -- Escolhe CPF quando presente, senão CNPJ
  v_documento := COALESCE(NEW.cpf, NEW.cnpj);

  -- Generate hash_titulo if not provided
  IF NEW.hash_titulo IS NULL THEN
    NEW.hash_titulo := public.gerar_hash_titulo(v_documento, NEW.valor_original, NEW.data_vencimento);
  END IF;
  
  -- Calculate dias_em_atraso
  NEW.dias_em_atraso := public.calcular_dias_em_atraso(NEW.data_vencimento);
  
  -- Calculate valor_atualizado
  NEW.valor_atualizado := public.calcular_valor_atualizado(NEW.valor_original, NEW.dias_em_atraso);
  
  -- Update data_ultima_atualizacao
  NEW.data_ultima_atualizacao := now();
  
  -- Auto-update status based on payment
  IF COALESCE(NEW.valor_recebido, 0) >= COALESCE(NEW.valor_atualizado, NEW.valor_original) THEN
    NEW.status := 'quitado';
  ELSIF COALESCE(NEW.valor_recebido, 0) > 0 THEN
    NEW.status := 'negociando';
  ELSIF COALESCE(NEW.dias_em_atraso, 0) > 0 THEN
    NEW.status := 'em_aberto';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
