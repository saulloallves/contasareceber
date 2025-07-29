/*
  # Adicionar 'escalonamento' ao enum tipo_interacao_enum

  1. Alterações
    - Adiciona o valor 'escalonamento' ao enum tipo_interacao_enum
    - Permite que o sistema registre tratativas de escalonamento

  2. Segurança
    - Operação segura que apenas adiciona um novo valor ao enum
    - Não afeta dados existentes
*/

-- Adiciona o valor 'escalonamento' ao enum tipo_interacao_enum
ALTER TYPE tipo_interacao_enum ADD VALUE IF NOT EXISTS 'escalonamento';