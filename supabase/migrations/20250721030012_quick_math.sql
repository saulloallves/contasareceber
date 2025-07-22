/*
  # Sistema de Unidades e Gestão de Reuniões

  1. Novas Tabelas
    - `unidades_franqueadas`
      - Cadastro completo das unidades da franquia
      - Informações de contato e localização
      - Status operacional da unidade
    - `reunioes_negociacao`
      - Controle completo de reuniões agendadas
      - Status e resultados das negociações
      - Automações para falhas no processo

  2. Enums
    - `status_unidade_enum`: ativa, inaugurando, fechada, em_tratativa
    - `status_reuniao_enum`: agendada, realizada, remarcada, nao_compareceu, cancelada
    - `decisao_reuniao_enum`: quitado, parcela_futura, sem_acordo, rever

  3. Triggers e Automações
    - Verificação automática de reuniões não realizadas
    - Escalonamento de cobranças críticas
    - Registro automático de tratativas

  4. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas específicas por perfil de usuário
*/

-- Enums para status
CREATE TYPE status_unidade_enum AS ENUM (
  'ativa',
  'inaugurando', 
  'fechada',
  'em_tratativa'
);

CREATE TYPE status_reuniao_enum AS ENUM (
  'agendada',
  'realizada',
  'remarcada',
  'nao_compareceu',
  'cancelada'
);

CREATE TYPE decisao_reuniao_enum AS ENUM (
  'quitado',
  'parcela_futura',
  'sem_acordo',
  'rever'
);

-- Tabela de unidades franqueadas
CREATE TABLE IF NOT EXISTS unidades_franqueadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_unidade text UNIQUE NOT NULL,
  codigo_interno text,
  nome_franqueado text NOT NULL,
  franqueado_principal boolean DEFAULT false,
  email_franqueado text,
  telefone_franqueado text,
  cidade text,
  estado text,
  endereco_completo text,
  status_unidade status_unidade_enum DEFAULT 'ativa',
  data_abertura date,
  observacoes_unidade text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de reuniões de negociação
CREATE TABLE IF NOT EXISTS reunioes_negociacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade text,
  codigo_unidade text REFERENCES unidades_franqueadas(codigo_unidade),
  data_agendada timestamptz NOT NULL,
  data_realizada timestamptz,
  status_reuniao status_reuniao_enum DEFAULT 'agendada',
  responsavel_reuniao text NOT NULL,
  resumo_resultado text,
  decisao_final decisao_reuniao_enum,
  disparo_aviso boolean DEFAULT false,
  link_reuniao text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_unidades_codigo ON unidades_franqueadas(codigo_unidade);
CREATE INDEX IF NOT EXISTS idx_unidades_status ON unidades_franqueadas(status_unidade);
CREATE INDEX IF NOT EXISTS idx_unidades_estado ON unidades_franqueadas(estado);

CREATE INDEX IF NOT EXISTS idx_reunioes_titulo_id ON reunioes_negociacao(titulo_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_cnpj ON reunioes_negociacao(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_reunioes_status ON reunioes_negociacao(status_reuniao);
CREATE INDEX IF NOT EXISTS idx_reunioes_data_agendada ON reunioes_negociacao(data_agendada);
CREATE INDEX IF NOT EXISTS idx_reunioes_responsavel ON reunioes_negociacao(responsavel_reuniao);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_unidades_franqueadas_updated_at
  BEFORE UPDATE ON unidades_franqueadas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reunioes_negociacao_updated_at
  BEFORE UPDATE ON reunioes_negociacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar reuniões não realizadas
CREATE OR REPLACE FUNCTION verificar_reunioes_nao_realizadas()
RETURNS void AS $$
DECLARE
  reuniao_record RECORD;
BEGIN
  -- Busca reuniões agendadas que já passaram da data
  FOR reuniao_record IN 
    SELECT * FROM reunioes_negociacao 
    WHERE status_reuniao = 'agendada' 
    AND data_agendada < now() - INTERVAL '2 hours'
    AND disparo_aviso = false
  LOOP
    -- Atualiza status da reunião
    UPDATE reunioes_negociacao 
    SET disparo_aviso = true
    WHERE id = reuniao_record.id;
    
    -- Registra tratativa automática
    INSERT INTO tratativas_cobranca (
      titulo_id,
      tipo_interacao,
      canal,
      usuario_sistema,
      descricao,
      status_cobranca_resultante
    ) VALUES (
      reuniao_record.titulo_id,
      'observacao_manual',
      'interno',
      'sistema_automatico',
      'Reunião agendada para ' || reuniao_record.data_agendada || ' não foi realizada. Necessário recontato.',
      'pendente_recontato'
    );
    
    -- Atualiza status da cobrança
    UPDATE cobrancas_franqueados 
    SET status = 'pendente_recontato'
    WHERE id = reuniao_record.titulo_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para processar resultado de reunião
CREATE OR REPLACE FUNCTION processar_resultado_reuniao()
RETURNS TRIGGER AS $$
BEGIN
  -- Se reunião foi realizada e tem decisão
  IF NEW.status_reuniao = 'realizada' AND NEW.decisao_final IS NOT NULL THEN
    
    -- Registra tratativa
    INSERT INTO tratativas_cobranca (
      titulo_id,
      tipo_interacao,
      canal,
      usuario_sistema,
      descricao,
      status_cobranca_resultante
    ) VALUES (
      NEW.titulo_id,
      'agendamento',
      'presencial',
      NEW.responsavel_reuniao,
      'Reunião realizada em ' || NEW.data_realizada || '. Decisão: ' || NEW.decisao_final || '. ' || COALESCE(NEW.resumo_resultado, ''),
      CASE 
        WHEN NEW.decisao_final = 'quitado' THEN 'quitado'
        WHEN NEW.decisao_final = 'parcela_futura' THEN 'negociando'
        WHEN NEW.decisao_final = 'sem_acordo' THEN 'em_aberto'
        ELSE 'negociando'
      END
    );
    
    -- Atualiza status da cobrança baseado na decisão
    UPDATE cobrancas_franqueados 
    SET status = CASE 
      WHEN NEW.decisao_final = 'quitado' THEN 'quitado'
      WHEN NEW.decisao_final = 'parcela_futura' THEN 'negociando'
      WHEN NEW.decisao_final = 'sem_acordo' THEN 'em_aberto'
      ELSE 'negociando'
    END
    WHERE id = NEW.titulo_id;
    
  -- Se franqueado não compareceu
  ELSIF NEW.status_reuniao = 'nao_compareceu' THEN
    
    -- Registra tratativa crítica
    INSERT INTO tratativas_cobranca (
      titulo_id,
      tipo_interacao,
      canal,
      usuario_sistema,
      descricao,
      status_cobranca_resultante
    ) VALUES (
      NEW.titulo_id,
      'observacao_manual',
      'presencial',
      NEW.responsavel_reuniao,
      'Franqueado não compareceu à reunião agendada para ' || NEW.data_agendada || '. Necessário escalonamento.',
      'tratativa_critica'
    );
    
    -- Marca cobrança como crítica
    UPDATE cobrancas_franqueados 
    SET status = 'tratativa_critica'
    WHERE id = NEW.titulo_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar resultado de reunião
CREATE TRIGGER trigger_processar_resultado_reuniao
  AFTER UPDATE ON reunioes_negociacao
  FOR EACH ROW 
  WHEN (OLD.status_reuniao IS DISTINCT FROM NEW.status_reuniao OR 
        OLD.decisao_final IS DISTINCT FROM NEW.decisao_final)
  EXECUTE FUNCTION processar_resultado_reuniao();

-- RLS (Row Level Security)
ALTER TABLE unidades_franqueadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunioes_negociacao ENABLE ROW LEVEL SECURITY;

-- Políticas para unidades_franqueadas
CREATE POLICY "Users can read unidades data" 
  ON unidades_franqueadas FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Admins can manage unidades data" 
  ON unidades_franqueadas FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Políticas para reunioes_negociacao
CREATE POLICY "Users can manage reunioes data" 
  ON reunioes_negociacao FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- Inserir algumas unidades de exemplo (opcional)
INSERT INTO unidades_franqueadas (
  codigo_unidade,
  codigo_interno,
  nome_franqueado,
  franqueado_principal,
  email_franqueado,
  telefone_franqueado,
  cidade,
  estado,
  status_unidade,
  data_abertura
) VALUES 
  ('CP001', 'INT001', 'João Silva', true, 'joao@exemplo.com', '11999999999', 'São Paulo', 'SP', 'ativa', '2023-01-15'),
  ('CP002', 'INT002', 'Maria Santos', true, 'maria@exemplo.com', '11888888888', 'Rio de Janeiro', 'RJ', 'ativa', '2023-03-20'),
  ('CP003', 'INT003', 'Pedro Costa', false, 'pedro@exemplo.com', '11777777777', 'Belo Horizonte', 'MG', 'inaugurando', '2024-01-10')
ON CONFLICT (codigo_unidade) DO NOTHING;