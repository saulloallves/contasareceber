-- Apaga as tabelas antigas para garantir uma recriação limpa
DROP TABLE IF EXISTS "public"."envios_mensagem";
DROP TABLE IF EXISTS "public"."alertas_sistema";

-- Recria a tabela 'alertas_sistema' com o tipo de coluna correto
CREATE TABLE IF NOT EXISTS "public"."alertas_sistema" (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    tipo_alerta VARCHAR(50) NOT NULL,
    titulo_id UUID REFERENCES "public"."cobrancas_franqueados"(id) ON DELETE CASCADE, -- CORRIGIDO PARA UUID
    cnpj_unidade VARCHAR(18),
    descricao TEXT NOT NULL,
    nivel_urgencia VARCHAR(20) NOT NULL CHECK (nivel_urgencia IN ('baixa', 'media', 'alta')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('novo', 'em_andamento', 'resolvido')),
    data_criacao TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    data_resolucao TIMESTAMPTZ,
    resolvido_por_id UUID REFERENCES "auth"."users"(id)
);

-- Recria a tabela 'envios_mensagem' com o tipo de coluna correto
CREATE TABLE IF NOT EXISTS "public"."envios_mensagem" (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    titulo_id UUID NOT NULL REFERENCES "public"."cobrancas_franqueados"(id) ON DELETE CASCADE, -- CORRIGIDO PARA UUID
    tipo_envio VARCHAR(50) NOT NULL,
    mensagem_enviada TEXT NOT NULL,
    status_envio VARCHAR(20) NOT NULL CHECK (status_envio IN ('sucesso', 'falha')),
    erro_detalhes TEXT,
    data_envio TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adiciona comentários para clareza
COMMENT ON COLUMN "public"."alertas_sistema"."titulo_id" IS 'FK para o ID (UUID) da cobrança.';
COMMENT ON COLUMN "public"."envios_mensagem"."titulo_id" IS 'FK para o ID (UUID) da cobrança.';

-- Recria os índices
CREATE INDEX IF NOT EXISTS idx_alertas_sistema_status ON "public"."alertas_sistema"(status);
CREATE INDEX IF NOT EXISTS idx_envios_mensagem_titulo_tipo ON "public"."envios_mensagem"(titulo_id, tipo_envio);
