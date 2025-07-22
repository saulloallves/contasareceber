/*
  # Sistema de Templates Jurídicos e Gatilhos Automáticos

  1. Novas Tabelas
    - `templates_juridicos`
      - `id` (uuid, primary key)
      - `nome` (text)
      - `tipo_debito` (enum)
      - `categoria` (enum)
      - `corpo_mensagem` (text)
      - `canal_envio` (enum)
      - `prazo_resposta_dias` (integer)
      - `ativo` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `gatilhos_automaticos`
      - `id` (uuid, primary key)
      - `nome` (text)
      - `condicoes` (text[])
      - `template_id` (uuid, foreign key)
      - `ativo` (boolean)
      - `prioridade` (enum)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `historico_disparos_templates`
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key)
      - `gatilho_id` (uuid, foreign key, optional)
      - `cnpj_unidade` (text)
      - `canal_utilizado` (text)
      - `mensagem_enviada` (text)
      - `data_envio` (timestamp)
      - `visualizado` (boolean)
      - `resultado` (enum)
      - `created_at` (timestamp)

  2. Enums
    - `tipo_debito_enum`: royalty, aluguel, insumo, multa
    - `categoria_template_enum`: notificacao, advertencia, proposta_acordo, intimacao_juridica
    - `canal_envio_enum`: whatsapp, email, painel
    - `prioridade_enum`: baixa, media, alta
    - `resultado_disparo_enum`: aceito, recusado, ignorado, respondido

  3. Segurança
    - Enable RLS em todas as tabelas
    - Políticas para diferentes níveis de usuário
*/

-- Criar enums
CREATE TYPE tipo_debito_enum AS ENUM ('royalty', 'aluguel', 'insumo', 'multa');
CREATE TYPE categoria_template_enum AS ENUM ('notificacao', 'advertencia', 'proposta_acordo', 'intimacao_juridica');
CREATE TYPE canal_envio_enum AS ENUM ('whatsapp', 'email', 'painel');
CREATE TYPE prioridade_enum AS ENUM ('baixa', 'media', 'alta');
CREATE TYPE resultado_disparo_enum AS ENUM ('aceito', 'recusado', 'ignorado', 'respondido');

-- Tabela de templates jurídicos
CREATE TABLE IF NOT EXISTS templates_juridicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_debito tipo_debito_enum NOT NULL,
  categoria categoria_template_enum NOT NULL,
  corpo_mensagem text NOT NULL,
  canal_envio canal_envio_enum NOT NULL DEFAULT 'email',
  prazo_resposta_dias integer NOT NULL DEFAULT 15,
  acoes_apos_resposta text[],
  anexo_documento_url text,
  ativo boolean NOT NULL DEFAULT true,
  total_disparos integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de gatilhos automáticos
CREATE TABLE IF NOT EXISTS gatilhos_automaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  condicoes text[] NOT NULL,
  template_id uuid NOT NULL REFERENCES templates_juridicos(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  prioridade prioridade_enum NOT NULL DEFAULT 'media',
  total_execucoes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de histórico de disparos
CREATE TABLE IF NOT EXISTS historico_disparos_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES templates_juridicos(id) ON DELETE CASCADE,
  gatilho_id uuid REFERENCES gatilhos_automaticos(id) ON DELETE SET NULL,
  cnpj_unidade text NOT NULL,
  canal_utilizado text NOT NULL,
  mensagem_enviada text NOT NULL,
  data_envio timestamptz NOT NULL DEFAULT now(),
  visualizado boolean NOT NULL DEFAULT false,
  data_visualizacao timestamptz,
  resultado resultado_disparo_enum,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_templates_tipo_debito ON templates_juridicos(tipo_debito);
CREATE INDEX IF NOT EXISTS idx_templates_categoria ON templates_juridicos(categoria);
CREATE INDEX IF NOT EXISTS idx_templates_ativo ON templates_juridicos(ativo);
CREATE INDEX IF NOT EXISTS idx_gatilhos_template_id ON gatilhos_automaticos(template_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_ativo ON gatilhos_automaticos(ativo);
CREATE INDEX IF NOT EXISTS idx_historico_template_id ON historico_disparos_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_historico_cnpj ON historico_disparos_templates(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_historico_data_envio ON historico_disparos_templates(data_envio DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_juridicos_updated_at
  BEFORE UPDATE ON templates_juridicos
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

CREATE TRIGGER update_gatilhos_automaticos_updated_at
  BEFORE UPDATE ON gatilhos_automaticos
  FOR EACH ROW
  EXECUTE FUNCTION update_templates_updated_at();

-- Trigger para atualizar contador de disparos
CREATE OR REPLACE FUNCTION increment_template_disparos()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE templates_juridicos 
  SET total_disparos = COALESCE(total_disparos, 0) + 1
  WHERE id = NEW.template_id;
  
  IF NEW.gatilho_id IS NOT NULL THEN
    UPDATE gatilhos_automaticos 
    SET total_execucoes = COALESCE(total_execucoes, 0) + 1
    WHERE id = NEW.gatilho_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_disparos_counter
  AFTER INSERT ON historico_disparos_templates
  FOR EACH ROW
  EXECUTE FUNCTION increment_template_disparos();

-- Enable RLS
ALTER TABLE templates_juridicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gatilhos_automaticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_disparos_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para templates_juridicos
CREATE POLICY "Jurídico pode gerenciar templates"
  ON templates_juridicos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários podem visualizar templates ativos"
  ON templates_juridicos
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Políticas RLS para gatilhos_automaticos
CREATE POLICY "Jurídico pode gerenciar gatilhos"
  ON gatilhos_automaticos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para historico_disparos_templates
CREATE POLICY "Jurídico pode gerenciar histórico"
  ON historico_disparos_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Inserir templates padrão
INSERT INTO templates_juridicos (nome, tipo_debito, categoria, corpo_mensagem, canal_envio, prazo_resposta_dias) VALUES
(
  'Notificação Padrão - Royalty',
  'royalty',
  'notificacao',
  'Prezado(a) {{nome_unidade}},

Identificamos pendência referente ao pagamento de royalties da unidade {{codigo_unidade}}.

Dados da pendência:
- Valor em aberto: R$ {{valor_total_em_aberto}}
- Dias em atraso: {{dias_em_atraso}}
- Data de vencimento: {{data_vencimento}}

Solicitamos a regularização no prazo de 15 dias corridos.

Para negociação, acesse: {{link_acordo}}

Atenciosamente,
Departamento Jurídico',
  'email',
  15
),
(
  'Advertência - Aluguel',
  'aluguel',
  'advertencia',
  'ADVERTÊNCIA FORMAL

{{nome_unidade}} - {{codigo_unidade}}
CNPJ: {{cnpj}}

Consta em nossos registros débito de aluguel vencido há {{dias_em_atraso}} dias.

Valor atualizado: R$ {{valor_total_em_aberto}}

Esta é uma ADVERTÊNCIA FORMAL. O não pagamento poderá resultar em medidas contratuais cabíveis.

Prazo para regularização: 10 dias úteis.

Departamento Jurídico
Cresci e Perdi',
  'whatsapp',
  10
),
(
  'Proposta de Acordo - Insumos',
  'insumo',
  'proposta_acordo',
  'PROPOSTA DE ACORDO

{{nome_unidade}},

Referente aos débitos de insumos em aberto, propomos acordo para regularização:

Valor total: R$ {{valor_total_em_aberto}}
Proposta: Parcelamento em até 6x

Para aceitar esta proposta, acesse: {{link_acordo}}

Válida por 7 dias corridos.

Setor Financeiro',
  'email',
  7
);

-- Inserir gatilhos padrão
INSERT INTO gatilhos_automaticos (nome, condicoes, template_id, prioridade) VALUES
(
  'Advertência para 2+ boletos vencidos',
  ARRAY['2_boletos_vencidos', 'mesmo_tipo'],
  (SELECT id FROM templates_juridicos WHERE nome = 'Advertência - Aluguel' LIMIT 1),
  'alta'
),
(
  'Proposta automática para valores altos',
  ARRAY['valor_alto', 'sem_acordo_ativo'],
  (SELECT id FROM templates_juridicos WHERE nome = 'Proposta de Acordo - Insumos' LIMIT 1),
  'media'
);