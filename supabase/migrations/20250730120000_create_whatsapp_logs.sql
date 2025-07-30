CREATE TABLE public.logs_envio_whatsapp (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    destinatario text NOT NULL,
    mensagem_enviada text NULL,
    instancia_evolution text NULL,
    sucesso boolean NOT NULL,
    evolution_message_id text NULL,
    erro_detalhes text NULL,
    data_envio timestamp with time zone NULL DEFAULT now(),
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT logs_envio_whatsapp_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_logs_whatsapp_data_envio ON public.logs_envio_whatsapp USING btree (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_logs_whatsapp_destinatario ON public.logs_envio_whatsapp USING btree (destinatario);
CREATE INDEX IF NOT EXISTS idx_logs_whatsapp_sucesso ON public.logs_envio_whatsapp USING btree (sucesso);
