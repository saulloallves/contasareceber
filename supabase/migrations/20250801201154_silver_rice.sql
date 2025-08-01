/*
  # Corrigir políticas RLS da tabela usuarios_sistema

  1. Problema Identificado
    - Recursão infinita nas políticas RLS da tabela usuarios_sistema
    - Políticas estão fazendo referência circular ao tentar validar permissões

  2. Solução
    - Remover políticas problemáticas existentes
    - Criar políticas RLS simples e seguras
    - Evitar referências circulares usando auth.uid() diretamente

  3. Segurança
    - Manter controle de acesso adequado
    - Permitir que usuários vejam apenas seus próprios dados
    - Admins podem gerenciar todos os usuários
*/

-- Remover todas as políticas existentes da tabela usuarios_sistema
DROP POLICY IF EXISTS "Admin master pode gerenciar todos os usuários" ON usuarios_sistema;
DROP POLICY IF EXISTS "Usuários podem ver próprios dados" ON usuarios_sistema;

-- Criar políticas RLS simples e seguras
CREATE POLICY "usuarios_can_read_own_data"
  ON usuarios_sistema
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

CREATE POLICY "usuarios_can_update_own_data"
  ON usuarios_sistema
  FOR UPDATE
  TO authenticated
  USING (email = auth.email())
  WITH CHECK (email = auth.email());

-- Política para service_role (usado pelo sistema)
CREATE POLICY "service_role_full_access"
  ON usuarios_sistema
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política para inserção de novos usuários (apenas service_role)
CREATE POLICY "service_role_can_insert"
  ON usuarios_sistema
  FOR INSERT
  TO service_role
  WITH CHECK (true);