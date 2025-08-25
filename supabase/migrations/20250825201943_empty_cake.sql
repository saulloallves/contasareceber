/*
  # Adicionar coluna ativo na tabela usuarios_sistema

  1. Modificações na Tabela
    - Adiciona coluna `ativo` (boolean) na tabela `usuarios_sistema`
    - Define valor padrão como `true` para usuários existentes
    - Permite controle de ativação/desativação de usuários

  2. Segurança
    - Mantém políticas RLS existentes
    - Não afeta dados existentes (todos ficam ativos por padrão)
*/

-- Adiciona a coluna ativo na tabela usuarios_sistema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios_sistema' AND column_name = 'ativo'
  ) THEN
    ALTER TABLE usuarios_sistema ADD COLUMN ativo boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Cria índice para otimizar consultas por status ativo
CREATE INDEX IF NOT EXISTS idx_usuarios_sistema_ativo 
ON usuarios_sistema (ativo);

-- Atualiza todos os usuários existentes para ativo = true (caso a coluna já existisse como NULL)
UPDATE usuarios_sistema 
SET ativo = true 
WHERE ativo IS NULL;