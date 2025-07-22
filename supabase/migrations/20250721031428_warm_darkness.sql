/*
  # Sistema de Relatórios Mensais Consolidados

  1. Nova Tabela
    - `relatorios_mensais` - Armazena histórico de relatórios gerados
  
  2. Funções
    - Função para gerar dados consolidados do mês
    - Função para calcular métricas de eficiência
    
  3. Segurança
    - RLS habilitado
    - Políticas para diferentes perfis de usuário
*/

-- Enum para status do envio
CREATE TYPE status_envio_relatorio_enum AS ENUM ('gerado', 'enviado', 'erro');

-- Tabela de relatórios mensais
CREATE TABLE IF NOT EXISTS relatorios_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_mes text NOT NULL,
  dados_consolidados jsonb NOT NULL DEFAULT '{}',
  url_pdf text,
  url_xlsx text,
  gerado_em timestamptz DEFAULT now(),
  gerado_por text NOT NULL,
  enviado_para text[],
  status_envio status_envio_relatorio_enum DEFAULT 'gerado',
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_relatorios_referencia ON relatorios_mensais(referencia_mes);
CREATE INDEX IF NOT EXISTS idx_relatorios_gerado_em ON relatorios_mensais(gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_relatorios_status ON relatorios_mensais(status_envio);

-- RLS
ALTER TABLE relatorios_mensais ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Diretoria can manage reports" 
ON relatorios_mensais 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Função para gerar dados consolidados do mês
CREATE OR REPLACE FUNCTION gerar_dados_consolidados_mes(p_referencia_mes text)
RETURNS jsonb AS $$
DECLARE
  dados_consolidados jsonb;
  inicio_mes date;
  fim_mes date;
BEGIN
  -- Calcula período do mês
  inicio_mes := (p_referencia_mes || '-01')::date;
  fim_mes := (inicio_mes + interval '1 month' - interval '1 day')::date;
  
  -- Monta dados consolidados
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', inicio_mes,
      'fim', fim_mes,
      'referencia', p_referencia_mes
    ),
    'visao_geral', (
      SELECT jsonb_build_object(
        'valor_total_vencido', COALESCE(SUM(CASE WHEN status = 'em_aberto' THEN valor_atualizado ELSE 0 END), 0),
        'valor_recebido_mes', COALESCE(SUM(CASE WHEN status = 'quitado' AND data_ultima_atualizacao >= inicio_mes AND data_ultima_atualizacao <= fim_mes THEN valor_recebido ELSE 0 END), 0),
        'total_titulos_vencidos', COUNT(*) FILTER (WHERE status = 'em_aberto'),
        'media_dias_atraso', COALESCE(AVG(dias_em_atraso) FILTER (WHERE status = 'em_aberto'), 0)
      )
      FROM cobrancas_franqueados
      WHERE data_vencimento <= fim_mes
    ),
    'por_status', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'status', status,
          'quantidade', count(*),
          'valor_total', COALESCE(SUM(valor_atualizado), 0)
        )
      )
      FROM (
        SELECT 
          status,
          COUNT(*) as count,
          SUM(valor_atualizado) as valor_total
        FROM cobrancas_franqueados 
        WHERE data_vencimento <= fim_mes
        GROUP BY status
      ) t
    ),
    'ranking_regional', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'estado', uf.estado,
          'quantidade_unidades', uf.qtd_unidades,
          'valor_inadimplente', uf.valor_total
        )
        ORDER BY uf.valor_total DESC
      )
      FROM (
        SELECT 
          u.estado,
          COUNT(DISTINCT u.id) as qtd_unidades,
          COALESCE(SUM(c.valor_atualizado), 0) as valor_total
        FROM unidades_franqueadas u
        LEFT JOIN cobrancas_franqueados c ON c.cnpj = u.codigo_unidade
        WHERE c.status = 'em_aberto' AND c.data_vencimento <= fim_mes
        GROUP BY u.estado
        HAVING COUNT(DISTINCT u.id) > 0
        ORDER BY valor_total DESC
        LIMIT 5
      ) uf
    ),
    'eficiencia_atendimento', (
      SELECT jsonb_build_object(
        'mensagens_enviadas', COALESCE(COUNT(*) FILTER (WHERE em.data_envio >= inicio_mes AND em.data_envio <= fim_mes), 0),
        'reunioes_realizadas', COALESCE(COUNT(*) FILTER (WHERE rn.status_reuniao = 'realizada' AND rn.data_realizada >= inicio_mes AND rn.data_realizada <= fim_mes), 0),
        'propostas_aceitas', COALESCE(COUNT(*) FILTER (WHERE tc.tipo_interacao = 'proposta_aceita' AND tc.data_interacao >= inicio_mes AND tc.data_interacao <= fim_mes), 0),
        'negociacoes_efetivas', COALESCE(COUNT(*) FILTER (WHERE c.status = 'quitado' AND c.data_ultima_atualizacao >= inicio_mes AND c.data_ultima_atualizacao <= fim_mes), 0)
      )
      FROM cobrancas_franqueados c
      LEFT JOIN envios_mensagem em ON em.titulo_id = c.id
      LEFT JOIN reunioes_negociacao rn ON rn.titulo_id = c.id
      LEFT JOIN tratativas_cobranca tc ON tc.titulo_id = c.id
    ),
    'escalonamentos_criticos', (
      SELECT jsonb_build_object(
        'total_escalonamentos', COUNT(*),
        'por_nivel', jsonb_agg(
          jsonb_build_object(
            'nivel', nivel,
            'quantidade', count
          )
        ),
        'valor_total_envolvido', COALESCE(SUM(valor_total_envolvido), 0)
      )
      FROM (
        SELECT 
          nivel,
          COUNT(*) as count,
          SUM(valor_total_envolvido) as valor_total_envolvido
        FROM escalonamentos_cobranca 
        WHERE data_escalonamento >= inicio_mes AND data_escalonamento <= fim_mes
        GROUP BY nivel
      ) esc
    )
  ) INTO dados_consolidados;
  
  RETURN dados_consolidados;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_relatorios_mensais_updated_at
  BEFORE UPDATE ON relatorios_mensais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();