/*
  # Create envios_mensagem table

  1. New Tables
    - `envios_mensagem`
      - `id` (uuid, primary key)
      - `titulo_id` (uuid, foreign key to cobrancas_franqueados)
      - `cliente` (text, required)
      - `cnpj` (text, required)
      - `telefone` (text, required)
      - `data_envio` (timestamp)
      - `mensagem_enviada` (text, required)
      - `status_envio` (text, required) - sucesso, falha, reagendado
      - `erro_detalhes` (text) - detalhes do erro se houver
      - `referencia_importacao` (text) - referência da importação que gerou o envio
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `envios_mensagem` table
    - Add policy for authenticated users to manage all data

  3. Indexes
    - Index on titulo_id for foreign key performance
    - Index on data_envio for time-based queries
    - Index on status_envio for filtering
*/

-- Create the envios_mensagem table
CREATE TABLE IF NOT EXISTS envios_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL,
  cliente text NOT NULL,
  cnpj text NOT NULL,
  telefone text NOT NULL,
  data_envio timestamptz DEFAULT now(),
  mensagem_enviada text NOT NULL,
  status_envio text NOT NULL CHECK (status_envio IN ('sucesso', 'falha', 'reagendado')),
  erro_detalhes text,
  referencia_importacao text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE envios_mensagem ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage envios data"
  ON envios_mensagem
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_envios_titulo_id ON envios_mensagem(titulo_id);
CREATE INDEX IF NOT EXISTS idx_envios_data_envio ON envios_mensagem(data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_envios_status ON envios_mensagem(status_envio);
CREATE INDEX IF NOT EXISTS idx_envios_cnpj ON envios_mensagem(cnpj);
CREATE INDEX IF NOT EXISTS idx_envios_referencia ON envios_mensagem(referencia_importacao);

-- Add foreign key constraint (will be created only if cobrancas_franqueados exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cobrancas_franqueados') THEN
    ALTER TABLE envios_mensagem 
    ADD CONSTRAINT fk_envios_titulo 
    FOREIGN KEY (titulo_id) 
    REFERENCES cobrancas_franqueados(id) 
    ON DELETE CASCADE;
  END IF;
END $$;