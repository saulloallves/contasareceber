/*
  # Criar bucket de storage para avatars

  1. Storage
    - Criar bucket 'avatars' público
    - Configurar políticas de acesso
    - Permitir upload de imagens

  2. Security
    - Usuários podem fazer upload de seus próprios avatars
    - Arquivos são públicos para visualização
    - Validação de tipo de arquivo
*/

-- Criar bucket para avatars se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários vejam todos os avatars (são públicos)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Política para permitir que usuários autenticados façam upload
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários atualizem seus próprios avatars
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuários deletem seus próprios avatars
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);