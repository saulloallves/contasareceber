-- Habilita a Segurança em Nível de Linha (RLS) para a tabela de logs do WhatsApp
ALTER TABLE public.logs_envio_whatsapp ENABLE ROW LEVEL SECURITY;

-- Política para permitir que administradores (ou usuários autenticados, dependendo da sua regra) vejam todos os logs.
-- Altere a verificação de role/permissão conforme necessário.
CREATE POLICY "Usuários autenticados podem ver os logs do WhatsApp"
ON public.logs_envio_whatsapp
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir que o sistema (qualquer serviço autenticado, como as Edge Functions) insira novos logs.
CREATE POLICY "Sistema pode inserir logs de WhatsApp"
ON public.logs_envio_whatsapp
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política para permitir que o sistema atualize os logs (por exemplo, para marcar sucesso/falha).
CREATE POLICY "Sistema pode atualizar logs de WhatsApp"
ON public.logs_envio_whatsapp
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
