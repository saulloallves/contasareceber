/*
  # Criar tabela de tratativas de cobrança

  1. Nova Tabela
    - `tratativas_cobranca`
      - `id` (uuid, primary key)
      - `titulo_id` (uuid, foreign key para cobrancas_franqueados)
      - `data_interacao` (timestamp)
      - `tipo_interacao` (enum)
      - `canal` (enum)
      - `usuario_sistema` (text)
      - `descricao` (text)
      - `status_cobranca_resultante` (text)
      - `anexos` (jsonb, opcional)
      - `created_at` (timestamp)

  2. Segurança
    - Enable RLS na tabela `tratativas_cobranca`
    - Add policy para usuários autenticados

  3. Índices
    - Índice por titulo_id para performance
    - Índice por data_interacao para ordenação
    - Índice por tipo_interacao para filtros

  4. Trigger
    - Função para atualizar status da cobrança baseado na última tratativa
*/

-- Criar enum para tipos de interação
CREATE TYPE tipo_interacao_enum AS ENUM (
  'mensagem_automatica',
  'resposta_franqueado', 
  'agendamento',
  'observacao_manual',
  'proposta_enviada',
  'proposta_aceita',
  'marcado_como_quitado',
  'negociacao_iniciada',
  'pagamento_parcial',
  'acordo_fechado'
);

-- Criar enum para canais
CREATE TYPE canal_interacao_enum AS ENUM (
  'whatsapp',
  'calendly',
  'interno',
  'email',
  'telefone',
  'presencial',
  'outro'
);

-- Criar tabela de tratativas
CREATE TABLE IF NOT EXISTS tratativas_cobranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  data_interacao timestamptz DEFAULT now(),
  tipo_interacao tipo_interacao_enum NOT NULL,
  canal canal_interacao_enum NOT NULL DEFAULT 'interno',
  usuario_sistema text NOT NULL DEFAULT 'sistema',
  descricao text NOT NULL,
  status_cobranca_resultante text,
  anexos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tratativas_cobranca ENABLE ROW LEVEL SECURITY;

-- Criar política para usuários autenticados
CREATE POLICY "Users can manage tratativas data"
  ON tratativas_cobranca
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tratativas_titulo_id ON tratativas_cobranca(titulo_id);
CREATE INDEX IF NOT EXISTS idx_tratativas_data_interacao ON tratativas_cobranca(data_interacao DESC);
CREATE INDEX IF NOT EXISTS idx_tratativas_tipo ON tratativas_cobranca(tipo_interacao);
CREATE INDEX IF NOT EXISTS idx_tratativas_canal ON tratativas_cobranca(canal);
CREATE INDEX IF NOT EXISTS idx_tratativas_status ON tratativas_cobranca(status_cobranca_resultante);

-- Função para atualizar status da cobrança baseado na última tratativa
CREATE OR REPLACE FUNCTION atualizar_status_por_tratativa()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza o status da cobrança se foi especificado na tratativa
  IF NEW.status_cobranca_resultante IS NOT NULL THEN
    UPDATE cobrancas_franqueados 
    SET 
      status = NEW.status_cobranca_resultante,
      data_ultima_atualizacao = NEW.data_interacao
    WHERE id = NEW.titulo_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar status automaticamente
CREATE TRIGGER trigger_atualizar_status_por_tratativa
  AFTER INSERT ON tratativas_cobranca
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_status_por_tratativa();

-- Inserir dados de exemplo (opcional)
INSERT INTO tratativas_cobranca (titulo_id, tipo_interacao, canal, usuario_sistema, descricao, status_cobranca_resultante)
SELECT 
  id,
  'observacao_manual'::tipo_interacao_enum,
  'interno'::canal_interacao_enum,
  'admin',
  'Cobrança criada automaticamente via importação de planilha',
  'em_aberto'
FROM cobrancas_franqueados 
WHERE status = 'em_aberto'
LIMIT 5;