/*
  # Corrigir política RLS para criação de perfis de usuário

  1. Políticas de Segurança
    - Adicionar política de INSERT para permitir que usuários criem seus próprios perfis
    - Manter políticas existentes de SELECT e UPDATE
    - Garantir que usuários só possam criar perfis com seu próprio auth.uid()

  2. Segurança
    - A política garante que auth.uid() = id, impedindo criação de perfis para outros usuários
    - Mantém a segurança existente para outras operações
*/

-- Adicionar política para permitir que usuários criem seus próprios perfis
CREATE POLICY "Users can create own profile"
  ON usuarios_sistema
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);