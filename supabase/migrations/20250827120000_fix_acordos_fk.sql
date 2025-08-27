-- Remover constraint legada que faz parcelamento_master_id referenciar cobrancas_franqueados
-- e garantir que a FK correta referencie parcelamentos_master.
-- Fazer backup antes de aplicar.

BEGIN;

-- 1) Remover constraint que está apontando para a tabela errada
ALTER TABLE IF EXISTS public.acordos_parcelamento
  DROP CONSTRAINT IF EXISTS acordos_parcelamento_titulo_id_fkey;

-- 2) Garantir que exista apenas uma FK apontando para parcelamentos_master
ALTER TABLE IF EXISTS public.acordos_parcelamento
  DROP CONSTRAINT IF EXISTS fk_acordos_parcelamento_master;

ALTER TABLE IF EXISTS public.acordos_parcelamento
  ADD CONSTRAINT fk_acordos_parcelamento_master
  FOREIGN KEY (parcelamento_master_id)
  REFERENCES public.parcelamentos_master(id)
  ON DELETE CASCADE;

COMMIT;

-- Observações:
-- - Execute esta migração no editor SQL do Supabase ou via CLI após um backup do banco.
-- - A migração remove a FK que fazia `parcelamento_master_id` referenciar `cobrancas_franqueados` (causa do erro).
-- - Após aplicar, os inserts em `acordos_parcelamento` com `parcelamento_master_id` v vindo do `parcelamentos_master` devem funcionar normalmente.
