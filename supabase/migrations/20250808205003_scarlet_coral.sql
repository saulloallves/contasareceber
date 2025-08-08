/*
  # Corrigir políticas RLS para unidades e franqueados

  1. Políticas de Leitura
    - Permitir que usuários autenticados leiam dados de franqueados
    - Permitir que usuários autenticados leiam dados de unidades
    - Permitir que usuários autenticados leiam vínculos franqueado-unidades

  2. Segurança
    - Manter RLS ativo para proteção
    - Políticas permissivas para usuários autenticados
    - Acesso total para service_role
*/

-- Garantir que RLS está ativo nas tabelas
ALTER TABLE public.franqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franqueado_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_franqueadas ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "Allow authenticated users to read franqueados" ON public.franqueados;
DROP POLICY IF EXISTS "Allow authenticated users to read franqueado_unidades" ON public.franqueado_unidades;
DROP POLICY IF EXISTS "Allow authenticated users to read unidades" ON public.unidades_franqueadas;

-- Criar políticas para franqueados
CREATE POLICY "Authenticated users can read franqueados"
ON public.franqueados FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage franqueados"
ON public.franqueados FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Criar políticas para franqueado_unidades
CREATE POLICY "Authenticated users can read franqueado_unidades"
ON public.franqueado_unidades FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage franqueado_unidades"
ON public.franqueado_unidades FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Verificar se já existe política para unidades_franqueadas, se não criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'unidades_franqueadas' 
    AND policyname = 'Users can manage unidades data'
  ) THEN
    CREATE POLICY "Users can manage unidades data"
    ON public.unidades_franqueadas FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Garantir políticas para service_role (acesso total)
CREATE POLICY "Service role full access franqueados"
ON public.franqueados FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access franqueado_unidades"
ON public.franqueado_unidades FOR ALL
TO service_role
USING (true)
WITH CHECK (true);