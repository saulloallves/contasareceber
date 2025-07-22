/*
  # Criação da tabela de documentos gerados

  1. Nova Tabela
    - `documentos_gerados`
      - `id` (uuid, primary key)
      - `tipo_documento` (enum)
      - `titulo_id` (uuid, foreign key)
      - `unidade_id` (uuid, foreign key)
      - `conteudo_html` (text)
      - `arquivo_pdf_url` (text)
      - `data_criacao` (timestamp)
      - `gerado_por` (text)

  2. Enums
    - `tipo_documento_enum` para tipos de notificação

  3. Segurança
    - Enable RLS
    - Políticas para diferentes perfis
*/

-- Enum para tipos de documento
CREATE TYPE tipo_documento_enum AS ENUM (
  'notificacao_inadimplencia',
  'notificacao_ausencia_tratativas',
  'notificacao_vencimento',
  'notificacao_quebra_acordo',
  'notificacao_preventiva',
  'carta_encerramento'
);

-- Tabela de documentos gerados
CREATE TABLE IF NOT EXISTS documentos_gerados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento tipo_documento_enum NOT NULL,
  titulo_id uuid REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES unidades_franqueadas(id),
  conteudo_html text NOT NULL,
  arquivo_pdf_url text,
  data_criacao timestamptz DEFAULT now(),
  gerado_por text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_documentos_tipo ON documentos_gerados(tipo_documento);
CREATE INDEX idx_documentos_titulo_id ON documentos_gerados(titulo_id);
CREATE INDEX idx_documentos_unidade_id ON documentos_gerados(unidade_id);
CREATE INDEX idx_documentos_data_criacao ON documentos_gerados(data_criacao DESC);

-- Enable RLS
ALTER TABLE documentos_gerados ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Juridico can manage documents" 
ON documentos_gerados 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_documentos_gerados_updated_at
  BEFORE UPDATE ON documentos_gerados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();