/*
  # Tabela de controle de importações

  1. New Tables
    - `importacoes_planilha`
      - `id` (uuid, primary key)
      - `data_importacao` (timestamp)
      - `usuario` (text)
      - `arquivo_nome` (text)
      - `referencia` (text, unique)
      - `total_registros` (integer)
      - `novos_titulos` (integer)
      - `titulos_atualizados` (integer)
      - `titulos_quitados` (integer)

  2. Security
    - Enable RLS on `importacoes_planilha` table
    - Add policy for authenticated users to manage import records
*/

CREATE TABLE IF NOT EXISTS importacoes_planilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_importacao timestamptz DEFAULT now(),
  usuario text NOT NULL,
  arquivo_nome text NOT NULL,
  referencia text UNIQUE NOT NULL,
  total_registros integer DEFAULT 0,
  novos_titulos integer DEFAULT 0,
  titulos_atualizados integer DEFAULT 0,
  titulos_quitados integer DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE importacoes_planilha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage import records"
  ON importacoes_planilha
  FOR ALL
  TO authenticated
  USING (true);

-- Índice para consultas por referência
CREATE INDEX IF NOT EXISTS idx_importacoes_referencia 
  ON importacoes_planilha(referencia);

-- Índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_importacoes_data 
  ON importacoes_planilha(data_importacao DESC);