/*
  # Tabela para operações manuais

  1. Nova Tabela
    - `operacoes_manuais`
      - `id` (uuid, primary key)
      - `tipo_operacao` (enum)
      - `usuario` (text)
      - `data_operacao` (timestamptz)
      - `cnpj_unidade` (text)
      - `titulo_id` (uuid, nullable)
      - `dados_anteriores` (jsonb)
      - `dados_novos` (jsonb)
      - `justificativa` (text)
      - `aprovado_por` (text, nullable)
      - `ip_origem` (text, nullable)
      - `created_at` (timestamptz)

  2. Enum para tipos de operação
    - cadastro_cobranca
    - edicao_cobranca
    - registro_tratativa
    - geracao_notificacao
    - cancelamento
    - quitacao_manual

  3. Índices para performance
  4. RLS para segurança
*/

-- Criar enum para tipos de operação manual
CREATE TYPE tipo_operacao_manual_enum AS ENUM (
  'cadastro_cobranca',
  'edicao_cobranca', 
  'registro_tratativa',
  'geracao_notificacao',
  'cancelamento',
  'quitacao_manual'
);

-- Criar tabela de operações manuais
CREATE TABLE IF NOT EXISTS operacoes_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_operacao tipo_operacao_manual_enum NOT NULL,
  usuario text NOT NULL,
  data_operacao timestamptz DEFAULT now(),
  cnpj_unidade text NOT NULL,
  titulo_id uuid,
  dados_anteriores jsonb DEFAULT '{}'::jsonb,
  dados_novos jsonb DEFAULT '{}'::jsonb,
  justificativa text NOT NULL,
  aprovado_por text,
  ip_origem text,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_operacoes_manuais_tipo ON operacoes_manuais(tipo_operacao);
CREATE INDEX idx_operacoes_manuais_usuario ON operacoes_manuais(usuario);
CREATE INDEX idx_operacoes_manuais_data ON operacoes_manuais(data_operacao DESC);
CREATE INDEX idx_operacoes_manuais_cnpj ON operacoes_manuais(cnpj_unidade);
CREATE INDEX idx_operacoes_manuais_titulo_id ON operacoes_manuais(titulo_id);

-- Foreign key para título (opcional)
ALTER TABLE operacoes_manuais 
ADD CONSTRAINT fk_operacoes_titulo 
FOREIGN KEY (titulo_id) 
REFERENCES cobrancas_franqueados(id) 
ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE operacoes_manuais ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados
CREATE POLICY "Admins can manage operacoes manuais" 
ON operacoes_manuais 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Função para atualizar CNPJ automaticamente via trigger
CREATE OR REPLACE FUNCTION atualizar_cnpj_operacao_manual()
RETURNS TRIGGER AS $$
BEGIN
  -- Se titulo_id está preenchido e cnpj_unidade está vazio, buscar CNPJ
  IF NEW.titulo_id IS NOT NULL AND (NEW.cnpj_unidade IS NULL OR NEW.cnpj_unidade = '') THEN
    SELECT cnpj INTO NEW.cnpj_unidade 
    FROM cobrancas_franqueados 
    WHERE id = NEW.titulo_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar CNPJ automaticamente
CREATE TRIGGER trigger_atualizar_cnpj_operacao_manual
  BEFORE INSERT OR UPDATE ON operacoes_manuais
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_cnpj_operacao_manual();

-- Função para buscar estatísticas de operações manuais
CREATE OR REPLACE FUNCTION buscar_estatisticas_operacoes_manuais(
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  resultado jsonb;
BEGIN
  WITH stats AS (
    SELECT 
      COUNT(*) as total_operacoes,
      COUNT(*) FILTER (WHERE aprovado_por IS NULL) as pendentes_aprovacao,
      jsonb_object_agg(tipo_operacao, count_tipo) as por_tipo,
      jsonb_object_agg(usuario, count_usuario) as por_usuario
    FROM (
      SELECT 
        tipo_operacao,
        usuario,
        COUNT(*) OVER (PARTITION BY tipo_operacao) as count_tipo,
        COUNT(*) OVER (PARTITION BY usuario) as count_usuario
      FROM operacoes_manuais
      WHERE (p_data_inicio IS NULL OR data_operacao >= p_data_inicio)
        AND (p_data_fim IS NULL OR data_operacao <= p_data_fim)
    ) sub
    GROUP BY tipo_operacao, usuario
  )
  SELECT jsonb_build_object(
    'total_operacoes', total_operacoes,
    'operacoes_pendentes_aprovacao', pendentes_aprovacao,
    'por_tipo', por_tipo,
    'por_usuario', por_usuario,
    'valor_total_impactado', 0 -- Será calculado no frontend
  ) INTO resultado
  FROM stats;
  
  RETURN COALESCE(resultado, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE operacoes_manuais IS 'Log de todas as operações manuais realizadas no sistema';
COMMENT ON COLUMN operacoes_manuais.tipo_operacao IS 'Tipo da operação manual realizada';
COMMENT ON COLUMN operacoes_manuais.usuario IS 'Usuário que realizou a operação';
COMMENT ON COLUMN operacoes_manuais.dados_anteriores IS 'Estado anterior dos dados (para auditoria)';
COMMENT ON COLUMN operacoes_manuais.dados_novos IS 'Novos dados inseridos/alterados';
COMMENT ON COLUMN operacoes_manuais.justificativa IS 'Justificativa obrigatória para a operação';
COMMENT ON COLUMN operacoes_manuais.aprovado_por IS 'Usuário que aprovou a operação (se necessário)';