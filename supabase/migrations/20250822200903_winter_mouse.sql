/*
  # Add avatar_url column to usuarios_sistema table

  1. Schema Changes
    - Add `avatar_url` column to `usuarios_sistema` table
      - `avatar_url` (text, nullable) - URL for user profile picture

  2. Notes
    - Column is nullable to allow existing users without avatars
    - No default value needed as the application handles null values
*/

-- Add avatar_url column to usuarios_sistema table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios_sistema' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE usuarios_sistema ADD COLUMN avatar_url text;
  END IF;
END $$;