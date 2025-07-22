/*
  # Create cobrancas_franqueados table

  1. New Tables
    - `cobrancas_franqueados`
      - `id` (uuid, primary key)
      - `cnpj` (text, required) - identificador da unidade
      - `cliente` (text, required) - nome da unidade ou responsável
      - `valor_original` (numeric) - valor bruto do título
      - `valor_recebido` (numeric, default 0) - valor que já foi pago
      - `data_vencimento` (date, required)
      - `dias_em_atraso` (integer, calculated)
      - `valor_atualizado` (numeric, calculated)
      - `status` (text, default 'em_aberto') - em_aberto, negociando, quitado, vencido
      - `data_ultima_atualizacao` (timestamp)
      - `referencia_importacao` (text) - ID da importação da planilha
      - `hash_titulo` (text, unique) - CNPJ + vencimento + valor para evitar duplicatas
      - `telefone` (text) - para envio de mensagens

  2. Security
    - Enable RLS on `cobrancas_franqueados` table
    - Add policy for authenticated users to manage all data

  3. Functions and Triggers
    - Function to generate hash_titulo
    - Function to calculate dias_em_atraso
    - Function to calculate valor_atualizado (10% multa + 0.033% juros/dia)
    - Triggers to auto-update calculated fields
*/

-- Create the main table
CREATE TABLE IF NOT EXISTS cobrancas_franqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  cliente text NOT NULL,
  valor_original numeric NOT NULL,
  valor_recebido numeric DEFAULT 0 NOT NULL,
  data_vencimento date NOT NULL,
  dias_em_atraso integer,
  valor_atualizado numeric,
  status text DEFAULT 'em_aberto' NOT NULL,
  data_ultima_atualizacao timestamptz DEFAULT now(),
  referencia_importacao text,
  hash_titulo text,
  telefone text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cobrancas_franqueados ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can manage cobrancas data"
  ON cobrancas_franqueados
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_cnpj ON cobrancas_franqueados(cnpj);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas_franqueados(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_vencimento ON cobrancas_franqueados(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_referencia ON cobrancas_franqueados(referencia_importacao);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_hash_titulo ON cobrancas_franqueados(hash_titulo) WHERE hash_titulo IS NOT NULL;

-- Function to generate hash_titulo
CREATE OR REPLACE FUNCTION gerar_hash_titulo(p_cnpj text, p_valor numeric, p_data_vencimento date)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(p_cnpj || '|' || p_valor::text || '|' || p_data_vencimento::text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate dias_em_atraso
CREATE OR REPLACE FUNCTION calcular_dias_em_atraso(p_data_vencimento date)
RETURNS integer AS $$
BEGIN
  RETURN GREATEST(0, EXTRACT(DAY FROM (CURRENT_DATE - p_data_vencimento))::integer);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate valor_atualizado
CREATE OR REPLACE FUNCTION calcular_valor_atualizado(p_valor_original numeric, p_dias_atraso integer)
RETURNS numeric AS $$
DECLARE
  multa numeric := 0;
  juros numeric := 0;
  valor_final numeric;
BEGIN
  -- Se não há atraso, retorna valor original
  IF p_dias_atraso <= 0 THEN
    RETURN p_valor_original;
  END IF;
  
  -- Multa de 10% sobre valor original
  multa := p_valor_original * 0.10;
  
  -- Juros de 0.033% ao dia sobre valor original
  juros := p_valor_original * 0.00033 * p_dias_atraso;
  
  valor_final := p_valor_original + multa + juros;
  
  RETURN ROUND(valor_final, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-update calculated fields
CREATE OR REPLACE FUNCTION atualizar_campos_calculados()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate hash_titulo if not provided
  IF NEW.hash_titulo IS NULL THEN
    NEW.hash_titulo := gerar_hash_titulo(NEW.cnpj, NEW.valor_original, NEW.data_vencimento);
  END IF;
  
  -- Calculate dias_em_atraso
  NEW.dias_em_atraso := calcular_dias_em_atraso(NEW.data_vencimento);
  
  -- Calculate valor_atualizado
  NEW.valor_atualizado := calcular_valor_atualizado(NEW.valor_original, NEW.dias_em_atraso);
  
  -- Update data_ultima_atualizacao
  NEW.data_ultima_atualizacao := now();
  
  -- Auto-update status based on payment
  IF NEW.valor_recebido >= NEW.valor_atualizado THEN
    NEW.status := 'quitado';
  ELSIF NEW.valor_recebido > 0 THEN
    NEW.status := 'negociando';
  ELSIF NEW.dias_em_atraso > 0 THEN
    NEW.status := 'em_aberto';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_atualizar_campos_calculados
  BEFORE INSERT OR UPDATE ON cobrancas_franqueados
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_campos_calculados();