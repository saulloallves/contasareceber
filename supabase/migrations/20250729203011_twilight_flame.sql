/*
  # Adicionar coluna percentual_juros_mora

  1. Alterações na Tabela
    - `simulacoes_parcelamento`
      - Adicionar coluna `percentual_juros_mora` (numeric, default 1.5)
  
  2. Descrição
    - Adiciona a coluna para armazenar o percentual de juros de mora aplicado nas simulações de parcelamento
    - Valor padrão de 1.5% conforme especificado
*/

-- Adicionar coluna percentual_juros_mora à tabela simulacoes_parcelamento
ALTER TABLE simulacoes_parcelamento 
ADD COLUMN IF NOT EXISTS percentual_juros_mora NUMERIC DEFAULT 1.5;