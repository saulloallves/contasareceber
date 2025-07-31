CREATE TABLE "public"."reunioes_juridico" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "unidade_id_fk" uuid NOT NULL REFERENCES "public"."unidades_franqueadas"(id),
    "escalonamento_id_fk" uuid REFERENCES "public"."escalonamentos_cobranca"(id),
    "status" text NOT NULL DEFAULT 'convite_enviado',
    "link_calendly" text,
    "data_hora_reuniao" timestamp with time zone,
    "presenca_franqueado" boolean,
    "tratativas_acordadas" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "public"."reunioes_juridico" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total para service_role"
ON "public"."reunioes_juridico"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir leitura para usuários autenticados"
ON "public"."reunioes_juridico"
FOR SELECT
TO authenticated
USING (true);
