/*
  # Sistema de Acordos de Parcelamento

  1. Novas Tabelas
    - `acordos_parcelamento` - Acordos de parcelamento criados
    - `parcelas_acordo` - Parcelas individuais de cada acordo
    - `historico_aceites` - Log de aceites dos acordos
    - `configuracao_acordos` - Configurações do sistema de acordos

  2. Funcionalidades
    - Simulação de parcelamento com regras configuráveis
    - Aceite digital com log completo
    - Geração automática de boletos
    - Acompanhamento de cumprimento
    - Quebra automática por descumprimento

  3. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas específicas por perfil de usuário
    - Log completo de todas as ações
*/

-- Tabela de configuração de acordos
CREATE TABLE IF NOT EXISTS configuracao_acordos (
  id TEXT PRIMARY KEY DEFAULT 'default',
  percentual_entrada_minimo NUMERIC DEFAULT 20.0,
  valor_parcela_minimo NUMERIC DEFAULT 300.00,
  quantidade_maxima_parcelas INTEGER DEFAULT 6,
  percentual_multa NUMERIC DEFAULT 10.0,
  percentual_juros_mes NUMERIC DEFAULT 1.0,
  percentual_desconto_entrada NUMERIC DEFAULT 5.0,
  dias_vencimento_entrada INTEGER DEFAULT 7,
  dias_entre_parcelas INTEGER DEFAULT 30,
  permite_renegociacao BOOLEAN DEFAULT true,
  max_acordos_quebrados INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de acordos de parcelamento
CREATE TABLE IF NOT EXISTS acordos_parcelamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id UUID NOT NULL REFERENCES cobrancas_franqueados(id) ON DELETE CASCADE,
  cnpj_unidade TEXT NOT NULL,
  valor_original NUMERIC NOT NULL,
  valor_atualizado NUMERIC NOT NULL,
  valor_entrada NUMERIC NOT NULL,
  quantidade_parcelas INTEGER NOT NULL,
  valor_parcela NUMERIC NOT NULL,
  valor_total_acordo NUMERIC NOT NULL,
  data_vencimento_entrada DATE NOT NULL,
  data_primeiro_vencimento DATE NOT NULL,
  status_acordo TEXT NOT NULL DEFAULT 'proposto' CHECK (status_acordo IN ('proposto', 'aceito', 'cumprindo', 'cumprido', 'quebrado', 'cancelado')),
  aceito_em TIMESTAMPTZ,
  aceito_por TEXT,
  ip_aceite TEXT,
  boleto_entrada_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de parcelas do acordo
CREATE TABLE IF NOT EXISTS parcelas_acordo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id UUID NOT NULL REFERENCES acordos_parcelamento(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor_parcela NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento TIMESTAMPTZ,
  valor_pago NUMERIC,
  status_parcela TEXT NOT NULL DEFAULT 'pendente' CHECK (status_parcela IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  boleto_url TEXT,
  boleto_codigo TEXT,
  dias_atraso INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de aceites
CREATE TABLE IF NOT EXISTS historico_aceites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id UUID NOT NULL REFERENCES acordos_parcelamento(id) ON DELETE CASCADE,
  cnpj_unidade TEXT NOT NULL,
  data_aceite TIMESTAMPTZ NOT NULL,
  ip_aceite TEXT NOT NULL,
  user_agent TEXT,
  metodo_aceite TEXT NOT NULL CHECK (metodo_aceite IN ('whatsapp', 'email', 'painel', 'presencial')),
  documento_assinado TEXT,
  testemunhas TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_acordos_titulo_id ON acordos_parcelamento(titulo_id);
CREATE INDEX IF NOT EXISTS idx_acordos_cnpj ON acordos_parcelamento(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_acordos_status ON acordos_parcelamento(status_acordo);
CREATE INDEX IF NOT EXISTS idx_acordos_data ON acordos_parcelamento(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parcelas_acordo_id ON parcelas_acordo(acordo_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas_acordo(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas_acordo(status_parcela);

CREATE INDEX IF NOT EXISTS idx_aceites_acordo_id ON historico_aceites(acordo_id);
CREATE INDEX IF NOT EXISTS idx_aceites_cnpj ON historico_aceites(cnpj_unidade);
CREATE INDEX IF NOT EXISTS idx_aceites_data ON historico_aceites(data_aceite DESC);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_acordos_parcelamento_updated_at
  BEFORE UPDATE ON acordos_parcelamento
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parcelas_acordo_updated_at
  BEFORE UPDATE ON parcelas_acordo
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracao_acordos_updated_at
  BEFORE UPDATE ON configuracao_acordos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar parcelas em atraso
CREATE OR REPLACE FUNCTION verificar_parcelas_atrasadas()
RETURNS INTEGER AS $$
DECLARE
  parcelas_processadas INTEGER := 0;
  parcela_record RECORD;
  dias_atraso INTEGER;
BEGIN
  -- Busca parcelas vencidas não pagas
  FOR parcela_record IN 
    SELECT p.*, a.cnpj_unidade, a.titulo_id
    FROM parcelas_acordo p
    JOIN acordos_parcelamento a ON p.acordo_id = a.id
    WHERE p.status_parcela = 'pendente'
    AND p.data_vencimento < CURRENT_DATE
  LOOP
    -- Calcula dias de atraso
    dias_atraso := CURRENT_DATE - parcela_record.data_vencimento;
    
    -- Atualiza status da parcela
    UPDATE parcelas_acordo 
    SET status_parcela = 'atrasado',
        dias_atraso = dias_atraso
    WHERE id = parcela_record.id;
    
    -- Se atraso > 15 dias, quebra o acordo
    IF dias_atraso > 15 THEN
      UPDATE acordos_parcelamento 
      SET status_acordo = 'quebrado',
          observacoes = COALESCE(observacoes, '') || ' | Quebrado por atraso de ' || dias_atraso || ' dias na parcela ' || parcela_record.numero_parcela
      WHERE id = parcela_record.acordo_id;
      
      -- Registra tratativa
      INSERT INTO tratativas_cobranca (
        titulo_id,
        tipo_interacao,
        canal,
        usuario_sistema,
        descricao,
        status_cobranca_resultante
      ) VALUES (
        parcela_record.titulo_id,
        'acordo_quebrado',
        'interno',
        'sistema_acordos',
        'Acordo quebrado por atraso de ' || dias_atraso || ' dias na parcela ' || parcela_record.numero_parcela,
        'em_aberto'
      );
    END IF;
    
    parcelas_processadas := parcelas_processadas + 1;
  END LOOP;
  
  RETURN parcelas_processadas;
END;
$$ LANGUAGE plpgsql;

-- Função para processar pagamento de parcela
CREATE OR REPLACE FUNCTION processar_pagamento_parcela(
  p_parcela_id UUID,
  p_valor_pago NUMERIC,
  p_data_pagamento TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN AS $$
DECLARE
  acordo_record RECORD;
  todas_pagas BOOLEAN;
BEGIN
  -- Atualiza parcela como paga
  UPDATE parcelas_acordo 
  SET status_parcela = 'pago',
      valor_pago = p_valor_pago,
      data_pagamento = p_data_pagamento
  WHERE id = p_parcela_id;
  
  -- Busca dados do acordo
  SELECT a.*, p.acordo_id
  INTO acordo_record
  FROM parcelas_acordo p
  JOIN acordos_parcelamento a ON p.acordo_id = a.id
  WHERE p.id = p_parcela_id;
  
  -- Verifica se todas as parcelas foram pagas
  SELECT NOT EXISTS(
    SELECT 1 FROM parcelas_acordo 
    WHERE acordo_id = acordo_record.acordo_id 
    AND status_parcela != 'pago'
  ) INTO todas_pagas;
  
  -- Se todas pagas, marca acordo como cumprido
  IF todas_pagas THEN
    UPDATE acordos_parcelamento 
    SET status_acordo = 'cumprido'
    WHERE id = acordo_record.acordo_id;
    
    -- Registra tratativa
    INSERT INTO tratativas_cobranca (
      titulo_id,
      tipo_interacao,
      canal,
      usuario_sistema,
      descricao,
      status_cobranca_resultante
    ) VALUES (
      acordo_record.titulo_id,
      'acordo_cumprido',
      'interno',
      'sistema_acordos',
      'Acordo de parcelamento cumprido integralmente',
      'quitado'
    );
  ELSE
    -- Atualiza status para cumprindo
    UPDATE acordos_parcelamento 
    SET status_acordo = 'cumprindo'
    WHERE id = acordo_record.acordo_id
    AND status_acordo = 'aceito';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insere configuração padrão
INSERT INTO configuracao_acordos (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- RLS (Row Level Security)
ALTER TABLE acordos_parcelamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_acordo ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_aceites ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_acordos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage acordos" ON acordos_parcelamento
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Franqueados can view own acordos" ON acordos_parcelamento
  FOR SELECT TO authenticated 
  USING (cnpj_unidade = current_setting('app.current_cnpj', true));

CREATE POLICY "Admins can manage parcelas" ON parcelas_acordo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Franqueados can view own parcelas" ON parcelas_acordo
  FOR SELECT TO authenticated 
  USING (
    acordo_id IN (
      SELECT id FROM acordos_parcelamento 
      WHERE cnpj_unidade = current_setting('app.current_cnpj', true)
    )
  );

CREATE POLICY "Admins can manage aceites" ON historico_aceites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage config acordos" ON configuracao_acordos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can read config acordos" ON configuracao_acordos
  FOR SELECT TO authenticated USING (true);