/*
  # Refatoração do Sistema de Parcelamento

  1. Nova Tabela
    - `parcelamentos_master`
      - `id` (uuid, primary key)
      - `cnpj_unidade` (text, not null)
      - `valor_total_original_parcelado` (numeric, not null)
      - `valor_total_atualizado_parcelado` (numeric, not null)
      - `data_parcelamento` (timestamptz, default now())
      - `status` (enum: proposto, aceito, cancelado, quebrado, cumprido)
      - `observacoes` (text)
      - `created_at` e `updated_at` (timestamptz, default now())

  2. Modificações em Tabelas Existentes
    - `cobrancas_franqueados`: adicionar `parcelamento_master_id`, `is_parcela`, `parcela_origem_id` e status 'parcelado'
    - `simulacoes_parcelamento`: renomear `titulo_id` para `parcelamento_master_id` e adicionar `cobrancas_origem_ids`
    - `propostas_parcelamento`: renomear `titulo_id` para `parcelamento_master_id`
    - `acordos_parcelamento`: renomear `titulo_id` para `parcelamento_master_id`
    - `parcelas_acordo`: adicionar `cobranca_id`
    - `configuracao_parcelamento`: atualizar `quantidade_maxima_parcelas` para 42

  3. Segurança
    - Enable RLS em `parcelamentos_master`
    - Políticas de acesso para usuários autenticados
*/

-- 1. Criar enum para status do parcelamento master
DO $$ BEGIN
  CREATE TYPE status_parcelamento_enum AS ENUM ('proposto', 'aceito', 'cancelado', 'quebrado', 'cumprido');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Criar tabela parcelamentos_master
CREATE TABLE IF NOT EXISTS parcelamentos_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_unidade text NOT NULL,
  valor_total_original_parcelado numeric NOT NULL DEFAULT 0,
  valor_total_atualizado_parcelado numeric NOT NULL DEFAULT 0,
  data_parcelamento timestamptz DEFAULT now(),
  status status_parcelamento_enum DEFAULT 'proposto'::status_parcelamento_enum,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Adicionar colunas à tabela cobrancas_franqueados
DO $$
BEGIN
  -- Adicionar parcelamento_master_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cobrancas_franqueados' AND column_name = 'parcelamento_master_id'
  ) THEN
    ALTER TABLE cobrancas_franqueados ADD COLUMN parcelamento_master_id uuid;
  END IF;

  -- Adicionar is_parcela
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cobrancas_franqueados' AND column_name = 'is_parcela'
  ) THEN
    ALTER TABLE cobrancas_franqueados ADD COLUMN is_parcela boolean DEFAULT FALSE NOT NULL;
  END IF;

  -- Adicionar parcela_origem_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cobrancas_franqueados' AND column_name = 'parcela_origem_id'
  ) THEN
    ALTER TABLE cobrancas_franqueados ADD COLUMN parcela_origem_id uuid;
  END IF;
END $$;

-- 4. Atualizar enum de status para incluir 'parcelado' e 'parcelas'
DO $$
BEGIN
  -- Verificar se os valores já existem no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'parcelado' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_cobranca_enum')
  ) THEN
    ALTER TYPE status_cobranca_enum ADD VALUE 'parcelado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'parcelas' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_cobranca_enum')
  ) THEN
    ALTER TYPE status_cobranca_enum ADD VALUE 'parcelas';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Se o enum não existir, criar com todos os valores
    CREATE TYPE status_cobranca_enum AS ENUM (
      'em_aberto', 'quitado', 'negociando', 'cobrado', 'em_tratativa_juridica', 
      'em_tratativa_critica', 'parcelado', 'parcelas'
    );
END $$;

-- 5. Modificar simulacoes_parcelamento
DO $$
BEGIN
  -- Renomear titulo_id para parcelamento_master_id se ainda não foi feito
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulacoes_parcelamento' AND column_name = 'titulo_id'
  ) THEN
    ALTER TABLE simulacoes_parcelamento RENAME COLUMN titulo_id TO parcelamento_master_id;
  END IF;

  -- Adicionar cobrancas_origem_ids
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulacoes_parcelamento' AND column_name = 'cobrancas_origem_ids'
  ) THEN
    ALTER TABLE simulacoes_parcelamento ADD COLUMN cobrancas_origem_ids uuid[] DEFAULT '{}' NOT NULL;
  END IF;

  -- Adicionar metadados_consolidacao
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simulacoes_parcelamento' AND column_name = 'metadados_consolidacao'
  ) THEN
    ALTER TABLE simulacoes_parcelamento ADD COLUMN metadados_consolidacao jsonb DEFAULT '{}';
  END IF;
END $$;

-- 6. Modificar propostas_parcelamento
DO $$
BEGIN
  -- Renomear titulo_id para parcelamento_master_id se ainda não foi feito
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'propostas_parcelamento' AND column_name = 'titulo_id'
  ) THEN
    ALTER TABLE propostas_parcelamento RENAME COLUMN titulo_id TO parcelamento_master_id;
  END IF;
END $$;

-- 7. Modificar acordos_parcelamento
DO $$
BEGIN
  -- Renomear titulo_id para parcelamento_master_id se ainda não foi feito
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'acordos_parcelamento' AND column_name = 'titulo_id'
  ) THEN
    ALTER TABLE acordos_parcelamento RENAME COLUMN titulo_id TO parcelamento_master_id;
  END IF;
END $$;

-- 8. Adicionar cobranca_id à tabela parcelas_acordo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcelas_acordo' AND column_name = 'cobranca_id'
  ) THEN
    ALTER TABLE parcelas_acordo ADD COLUMN cobranca_id uuid;
  END IF;
END $$;

-- 9. Atualizar configuracao_parcelamento para 42 parcelas máximas
UPDATE configuracao_parcelamento 
SET quantidade_maxima_parcelas = 42 
WHERE id = 'default';

-- Se não existir configuração, criar com os novos valores
INSERT INTO configuracao_parcelamento (
  id, 
  percentual_juros_parcela, 
  valor_minimo_parcela, 
  quantidade_maxima_parcelas,
  percentual_entrada_minimo,
  dias_entre_parcelas,
  prazo_validade_proposta_dias,
  template_whatsapp,
  template_email_assunto,
  template_email_corpo,
  ativo
) VALUES (
  'default',
  3.0,
  200.0,
  42, -- Novo máximo de 42 parcelas
  20.0,
  30,
  7,
  '🏪 *PROPOSTA DE PARCELAMENTO*

Olá, {{cliente}}! 

Temos uma proposta especial para regularizar seu(s) débito(s):

💰 *Valor Original:* R$ {{valor_original}}
💰 *Valor Atualizado:* R$ {{valor_atualizado}}

📋 *NOSSA PROPOSTA:*
{{#entrada}}💵 Entrada: R$ {{valor_entrada}}{{/entrada}}
📅 {{quantidade_parcelas}}x de R$ {{valor_parcela}}
📊 Juros: {{percentual_juros}}% por parcela
💳 Total: R$ {{valor_total}}

📅 *Primeira parcela:* {{data_primeira_parcela}}

✅ *Aceita a proposta?*
Responda SIM para confirmar.

⏰ Proposta válida até {{data_expiracao}}

_Equipe Financeira - Cresci e Perdi_',
  'Proposta de Parcelamento - {{cliente}}',
  'Prezado(a) {{cliente}},

Temos uma proposta especial para regularizar seu(s) débito(s).

DETALHES DA PROPOSTA:
- Valor Original: R$ {{valor_original}}
- Valor Atualizado: R$ {{valor_atualizado}}
{{#entrada}}- Entrada: R$ {{valor_entrada}}{{/entrada}}
- Parcelamento: {{quantidade_parcelas}}x de R$ {{valor_parcela}}
- Juros aplicado: {{percentual_juros}}% por parcela
- Valor Total: R$ {{valor_total}}
- Primeira parcela: {{data_primeira_parcela}}

Esta proposta é válida até {{data_expiracao}}.

Para aceitar, responda este email confirmando.

Atenciosamente,
Equipe Financeira',
  true
) ON CONFLICT (id) DO UPDATE SET
  quantidade_maxima_parcelas = 42,
  updated_at = now();

-- 10. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_parcelamentos_master_cnpj ON parcelamentos_master (cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_parcelamentos_master_status ON parcelamentos_master (status);
CREATE INDEX IF NOT EXISTS idx_parcelamentos_master_data ON parcelamentos_master (data_parcelamento DESC);

CREATE INDEX IF NOT EXISTS idx_cobrancas_parcelamento_master ON cobrancas_franqueados (parcelamento_master_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_is_parcela ON cobrancas_franqueados (is_parcela);
CREATE INDEX IF NOT EXISTS idx_cobrancas_parcela_origem ON cobrancas_franqueados (parcela_origem_id);

CREATE INDEX IF NOT EXISTS idx_parcelas_acordo_cobranca ON parcelas_acordo (cobranca_id);

-- 11. Adicionar foreign keys
DO $$
BEGIN
  -- FK parcelamentos_master -> cobrancas_franqueados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_cobrancas_parcelamento_master'
  ) THEN
    ALTER TABLE cobrancas_franqueados 
    ADD CONSTRAINT fk_cobrancas_parcelamento_master 
    FOREIGN KEY (parcelamento_master_id) REFERENCES parcelamentos_master(id) ON DELETE SET NULL;
  END IF;

  -- FK parcela_origem_id -> parcelas_acordo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_cobrancas_parcela_origem'
  ) THEN
    ALTER TABLE cobrancas_franqueados 
    ADD CONSTRAINT fk_cobrancas_parcela_origem 
    FOREIGN KEY (parcela_origem_id) REFERENCES parcelas_acordo(id) ON DELETE SET NULL;
  END IF;

  -- FK cobranca_id -> cobrancas_franqueados
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_parcelas_acordo_cobranca'
  ) THEN
    ALTER TABLE parcelas_acordo 
    ADD CONSTRAINT fk_parcelas_acordo_cobranca 
    FOREIGN KEY (cobranca_id) REFERENCES cobrancas_franqueados(id) ON DELETE SET NULL;
  END IF;

  -- FK simulacoes_parcelamento -> parcelamentos_master
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_simulacoes_parcelamento_master'
  ) THEN
    ALTER TABLE simulacoes_parcelamento 
    ADD CONSTRAINT fk_simulacoes_parcelamento_master 
    FOREIGN KEY (parcelamento_master_id) REFERENCES parcelamentos_master(id) ON DELETE CASCADE;
  END IF;

  -- FK propostas_parcelamento -> parcelamentos_master
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_propostas_parcelamento_master'
  ) THEN
    ALTER TABLE propostas_parcelamento 
    ADD CONSTRAINT fk_propostas_parcelamento_master 
    FOREIGN KEY (parcelamento_master_id) REFERENCES parcelamentos_master(id) ON DELETE CASCADE;
  END IF;

  -- FK acordos_parcelamento -> parcelamentos_master
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_acordos_parcelamento_master'
  ) THEN
    ALTER TABLE acordos_parcelamento 
    ADD CONSTRAINT fk_acordos_parcelamento_master 
    FOREIGN KEY (parcelamento_master_id) REFERENCES parcelamentos_master(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 12. Habilitar RLS na nova tabela
ALTER TABLE parcelamentos_master ENABLE ROW LEVEL SECURITY;

-- 13. Criar políticas RLS para parcelamentos_master
CREATE POLICY "Users can manage parcelamentos master data"
  ON parcelamentos_master
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 14. Criar trigger para updated_at em parcelamentos_master
CREATE OR REPLACE FUNCTION update_parcelamentos_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parcelamentos_master_updated_at
  BEFORE UPDATE ON parcelamentos_master
  FOR EACH ROW
  EXECUTE FUNCTION update_parcelamentos_master_updated_at();

-- 15. Atualizar configuracao_acordos para 42 parcelas máximas também
UPDATE configuracao_acordos 
SET quantidade_maxima_parcelas = 42 
WHERE id = 'default';

-- Se não existir configuração de acordos, criar com os novos valores
INSERT INTO configuracao_acordos (
  id,
  percentual_entrada_minimo,
  valor_parcela_minimo,
  quantidade_maxima_parcelas,
  percentual_multa,
  percentual_juros_mes,
  percentual_desconto_entrada,
  dias_vencimento_entrada,
  dias_entre_parcelas,
  permite_renegociacao,
  max_acordos_quebrados
) VALUES (
  'default',
  20.0,
  300.00,
  42, -- Novo máximo de 42 parcelas
  10.0,
  1.0,
  5.0,
  7,
  30,
  true,
  2
) ON CONFLICT (id) DO UPDATE SET
  quantidade_maxima_parcelas = 42,
  updated_at = now();