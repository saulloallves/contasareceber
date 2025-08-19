

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."canal_envio_enum" AS ENUM (
    'whatsapp',
    'email',
    'painel'
);


ALTER TYPE "public"."canal_envio_enum" OWNER TO "postgres";


CREATE TYPE "public"."canal_interacao_enum" AS ENUM (
    'whatsapp',
    'calendly',
    'interno',
    'email',
    'telefone',
    'presencial',
    'outro'
);


ALTER TYPE "public"."canal_interacao_enum" OWNER TO "postgres";


CREATE TYPE "public"."categoria_template_enum" AS ENUM (
    'notificacao',
    'advertencia',
    'proposta_acordo',
    'intimacao_juridica'
);


ALTER TYPE "public"."categoria_template_enum" OWNER TO "postgres";


CREATE TYPE "public"."decisao_reuniao_enum" AS ENUM (
    'quitado',
    'parcela_futura',
    'sem_acordo',
    'rever'
);


ALTER TYPE "public"."decisao_reuniao_enum" OWNER TO "postgres";


CREATE TYPE "public"."juridico_status_enum" AS ENUM (
    'regular',
    'pendente_grave',
    'notificado',
    'em_analise',
    'pre_processo',
    'acionado',
    'resolvido'
);


ALTER TYPE "public"."juridico_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."metodo_aceite_enum" AS ENUM (
    'whatsapp',
    'email',
    'painel',
    'telefone'
);


ALTER TYPE "public"."metodo_aceite_enum" OWNER TO "postgres";


CREATE TYPE "public"."motivo_acionamento_enum" AS ENUM (
    'valor_alto',
    'cobrancas_ignoradas',
    'acordo_descumprido',
    'score_zero',
    'reincidencia_6_meses'
);


ALTER TYPE "public"."motivo_acionamento_enum" OWNER TO "postgres";


CREATE TYPE "public"."nivel_escalonamento_enum" AS ENUM (
    'juridico',
    'diretoria',
    'auditoria'
);


ALTER TYPE "public"."nivel_escalonamento_enum" OWNER TO "postgres";


CREATE TYPE "public"."prioridade_enum" AS ENUM (
    'baixa',
    'media',
    'alta'
);


ALTER TYPE "public"."prioridade_enum" OWNER TO "postgres";


CREATE TYPE "public"."resultado_disparo_enum" AS ENUM (
    'aceito',
    'recusado',
    'ignorado',
    'respondido'
);


ALTER TYPE "public"."resultado_disparo_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_envio_relatorio_enum" AS ENUM (
    'gerado',
    'enviado',
    'erro'
);


ALTER TYPE "public"."status_envio_relatorio_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_escalonamento_enum" AS ENUM (
    'pendente',
    'em_analise',
    'encerrado',
    'resolvido'
);


ALTER TYPE "public"."status_escalonamento_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_proposta_enum" AS ENUM (
    'enviada',
    'aceita',
    'recusada',
    'expirada'
);


ALTER TYPE "public"."status_proposta_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_reuniao_enum" AS ENUM (
    'agendada',
    'realizada',
    'remarcada',
    'nao_compareceu',
    'cancelada'
);


ALTER TYPE "public"."status_reuniao_enum" OWNER TO "postgres";


CREATE TYPE "public"."status_unidade_enum" AS ENUM (
    'ativa',
    'inaugurando',
    'fechada',
    'em_tratativa'
);


ALTER TYPE "public"."status_unidade_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_debito_enum" AS ENUM (
    'royalty',
    'aluguel',
    'insumo',
    'multa'
);


ALTER TYPE "public"."tipo_debito_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_documento_enum" AS ENUM (
    'notificacao_inadimplencia',
    'notificacao_ausencia_tratativas',
    'notificacao_vencimento',
    'notificacao_quebra_acordo',
    'notificacao_preventiva',
    'carta_encerramento'
);


ALTER TYPE "public"."tipo_documento_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_interacao_enum" AS ENUM (
    'mensagem_automatica',
    'resposta_franqueado',
    'agendamento',
    'observacao_manual',
    'proposta_enviada',
    'proposta_aceita',
    'marcado_como_quitado',
    'negociacao_iniciada',
    'pagamento_parcial',
    'acordo_fechado',
    'escalonamento'
);


ALTER TYPE "public"."tipo_interacao_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_notificacao_juridica_enum" AS ENUM (
    'extrajudicial',
    'formal',
    'ultima_chance',
    'pre_judicial',
    'judicial'
);


ALTER TYPE "public"."tipo_notificacao_juridica_enum" OWNER TO "postgres";


CREATE TYPE "public"."tipo_operacao_manual_enum" AS ENUM (
    'cadastro_cobranca',
    'edicao_cobranca',
    'registro_tratativa',
    'geracao_notificacao',
    'cancelamento',
    'quitacao_manual'
);


ALTER TYPE "public"."tipo_operacao_manual_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_campos_calculados"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_documento text;
BEGIN
  -- Escolhe CPF quando presente, senão CNPJ
  v_documento := COALESCE(NEW.cpf, NEW.cnpj);

  -- Generate hash_titulo if not provided
  IF NEW.hash_titulo IS NULL THEN
    -- AQUI ESTÁ A ALTERAÇÃO: Passando NEW.linha_referencia_importada como 4º argumento
    NEW.hash_titulo := public.gerar_hash_titulo(v_documento, NEW.valor_original, NEW.data_vencimento, NEW.linha_referencia_importada);
  END IF;
  
  -- Calculate dias_em_atraso
  NEW.dias_em_atraso := public.calcular_dias_em_atraso(NEW.data_vencimento);
  
  -- Calculate valor_atualizado
  NEW.valor_atualizado := public.calcular_valor_atualizado(NEW.valor_original, NEW.dias_em_atraso);
  
  -- Update data_ultima_atualizacao
  NEW.data_ultima_atualizacao := now();
  
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."atualizar_campos_calculados"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_cnpj_operacao_manual"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se titulo_id está preenchido e cnpj_unidade está vazio, buscar CNPJ
  IF NEW.titulo_id IS NOT NULL AND (NEW.cnpj_unidade IS NULL OR NEW.cnpj_unidade = '') THEN
    SELECT cnpj INTO NEW.cnpj_unidade 
    FROM cobrancas_franqueados 
    WHERE id = NEW.titulo_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."atualizar_cnpj_operacao_manual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_cobranca_sem_trigger"("p_cobranca_id" "uuid", "p_status" "text", "p_valor_recebido" numeric, "p_data_atualizacao" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Temporariamente desabilita o trigger que causa problema
  ALTER TABLE cobrancas_franqueados DISABLE TRIGGER trigger_score_cobrancas;
  
  -- Atualiza a cobrança
  UPDATE cobrancas_franqueados 
  SET 
    status = p_status,
    valor_recebido = p_valor_recebido,
    data_ultima_atualizacao = p_data_atualizacao
  WHERE id = p_cobranca_id;
  
  -- Reabilita o trigger
  ALTER TABLE cobrancas_franqueados ENABLE TRIGGER trigger_score_cobrancas;
  
  -- Insere o evento manualmente na tabela eventos_score se for quitação
  IF p_status = 'quitado' THEN
    INSERT INTO eventos_score (cnpj_unidade, tipo_evento, descricao)
    SELECT 
      cnpj,
      'pagamento',
      'Cobrança quitada'
    FROM cobrancas_franqueados 
    WHERE id = p_cobranca_id
    ON CONFLICT DO NOTHING; -- Evita duplicatas
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Garante que o trigger seja reabilitado mesmo em caso de erro
    ALTER TABLE cobrancas_franqueados ENABLE TRIGGER trigger_score_cobrancas;
    RAISE;
END;
$$;


ALTER FUNCTION "public"."atualizar_cobranca_sem_trigger"("p_cobranca_id" "uuid", "p_status" "text", "p_valor_recebido" numeric, "p_data_atualizacao" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_priorizacao_unidade"("p_cnpj_unidade" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_score INTEGER;
  v_nivel INTEGER;
  v_valor_total NUMERIC;
  v_dias_max INTEGER;
  v_qtd_debitos INTEGER;
  v_tipos_debito TEXT[];
  v_nome_franqueado TEXT;
  v_codigo_unidade TEXT;
BEGIN
  -- Calcula métricas
  v_score := calcular_score_priorizacao(p_cnpj_unidade);
  
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'em_aberto' THEN COALESCE(valor_atualizado, valor_original) ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN status = 'em_aberto' THEN COALESCE(dias_em_atraso, 0) ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'em_aberto' THEN 1 END),
    ARRAY_AGG(DISTINCT COALESCE(tipo_cobranca, 'outros')) FILTER (WHERE status = 'em_aberto')
  INTO v_valor_total, v_dias_max, v_qtd_debitos, v_tipos_debito
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  v_nivel := determinar_nivel_escalonamento(v_dias_max);
  
  -- Busca dados da unidade
  SELECT nome_franqueado, codigo_unidade 
  INTO v_nome_franqueado, v_codigo_unidade
  FROM unidades_franqueadas 
  WHERE codigo_unidade = p_cnpj_unidade;
  
  -- Atualiza ou insere priorização
  INSERT INTO priorizacao_unidades (
    cnpj_unidade,
    codigo_unidade,
    nome_franqueado,
    score_priorizacao,
    nivel_escalonamento,
    valor_total_em_aberto,
    dias_inadimplencia_max,
    quantidade_debitos,
    tipos_debito
  ) VALUES (
    p_cnpj_unidade,
    v_codigo_unidade,
    COALESCE(v_nome_franqueado, 'Franqueado'),
    v_score,
    v_nivel,
    v_valor_total,
    v_dias_max,
    v_qtd_debitos,
    COALESCE(v_tipos_debito, '{}')
  )
  ON CONFLICT (cnpj_unidade) 
  DO UPDATE SET
    score_priorizacao = EXCLUDED.score_priorizacao,
    nivel_escalonamento = EXCLUDED.nivel_escalonamento,
    valor_total_em_aberto = EXCLUDED.valor_total_em_aberto,
    dias_inadimplencia_max = EXCLUDED.dias_inadimplencia_max,
    quantidade_debitos = EXCLUDED.quantidade_debitos,
    tipos_debito = EXCLUDED.tipos_debito,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."atualizar_priorizacao_unidade"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_status_por_tratativa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."atualizar_status_por_tratativa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atualizar_todas_cobrancas_vencidas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$BEGIN
    -- Atualiza a tabela de cobranças
    UPDATE public.cobrancas_franqueados
    SET
        -- Recalcula os dias em atraso usando a função do banco
        dias_em_atraso = public.calcular_dias_em_atraso(data_vencimento),
        
        -- Recalcula o valor atualizado usando a função do banco
        valor_atualizado = public.calcular_valor_atualizado(valor_original, public.calcular_dias_em_atraso(data_vencimento)),
        
        -- Atualiza a data da última modificação
        data_ultima_atualizacao = now()
    WHERE
        -- A condição para a atualização:
        -- A cobrança precisa estar com o status 'em_aberto' E
        status = 'em_aberto' AND
        -- A data de vencimento já deve ter passado
        data_vencimento < CURRENT_DATE;
END;$$;


ALTER FUNCTION "public"."atualizar_todas_cobrancas_vencidas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            tabela_afetada,
            operacao,
            dados_novos,
            usuario,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            'INSERT',
            row_to_json(NEW),
            current_user,
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            tabela_afetada,
            operacao,
            dados_antigos,
            dados_novos,
            usuario,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            'UPDATE',
            row_to_json(OLD),
            row_to_json(NEW),
            current_user,
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            tabela_afetada,
            operacao,
            dados_antigos,
            usuario,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            'DELETE',
            row_to_json(OLD),
            current_user,
            NOW()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_estatisticas_operacoes_manuais"("p_data_inicio" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_data_fim" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  resultado jsonb;
BEGIN
  WITH stats AS (
    SELECT 
      COUNT(*) as total_operacoes,
      COUNT(*) FILTER (WHERE aprovado_por IS NULL) as pendentes_aprovacao,
      jsonb_object_agg(tipo_operacao, count_tipo) as por_tipo,
      jsonb_object_agg(usuario, count_usuario) as por_usuario
    FROM (
      SELECT 
        tipo_operacao,
        usuario,
        COUNT(*) OVER (PARTITION BY tipo_operacao) as count_tipo,
        COUNT(*) OVER (PARTITION BY usuario) as count_usuario
      FROM operacoes_manuais
      WHERE (p_data_inicio IS NULL OR data_operacao >= p_data_inicio)
        AND (p_data_fim IS NULL OR data_operacao <= p_data_fim)
    ) sub
    GROUP BY tipo_operacao, usuario
  )
  SELECT jsonb_build_object(
    'total_operacoes', total_operacoes,
    'operacoes_pendentes_aprovacao', pendentes_aprovacao,
    'por_tipo', por_tipo,
    'por_usuario', por_usuario,
    'valor_total_impactado', 0 -- Será calculado no frontend
  ) INTO resultado
  FROM stats;
  
  RETURN COALESCE(resultado, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."buscar_estatisticas_operacoes_manuais"("p_data_inicio" timestamp with time zone, "p_data_fim" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_dias_em_atraso"("p_data_vencimento" "date") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$BEGIN
  -- p_data_vencimento convertido para date, pois vem como string do sistema
  RETURN GREATEST(0, (CURRENT_DATE - p_data_vencimento::date));
END;$$;


ALTER FUNCTION "public"."calcular_dias_em_atraso"("p_data_vencimento" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_pontuacao_risco"("p_cnpj_unidade" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_config configuracao_risco%ROWTYPE;
  v_pontuacao integer := 0;
  v_nivel_risco text := 'baixo';
  v_historico jsonb := '[]'::jsonb;
  v_alertas jsonb := '[]'::jsonb;
  v_cobrancas_atrasadas integer;
  v_reunioes_nao_compareceu integer;
  v_notificacoes_anteriores integer;
  v_escalonamentos_anteriores integer;
  v_valor_total_aberto numeric;
BEGIN
  -- Busca configuração
  SELECT * INTO v_config FROM configuracao_risco WHERE id = 'default';
  
  -- 1. Cobranças com atraso > 10 dias
  SELECT COUNT(*) INTO v_cobrancas_atrasadas
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND status = 'em_aberto' 
    AND dias_em_atraso > 10;
  
  IF v_cobrancas_atrasadas > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.atraso_10_dias * v_cobrancas_atrasadas);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_cobrancas_atrasadas || ' cobrança(s) com atraso > 10 dias',
      'pontos_adicionados', v_config.atraso_10_dias * v_cobrancas_atrasadas,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 2. Não comparecimento em reuniões
  SELECT COUNT(*) INTO v_reunioes_nao_compareceu
  FROM reunioes_negociacao 
  WHERE cnpj_unidade = p_cnpj_unidade 
    AND status_reuniao = 'nao_compareceu';
  
  IF v_reunioes_nao_compareceu > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.nao_comparecimento * v_reunioes_nao_compareceu);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_reunioes_nao_compareceu || ' não comparecimento(s) em reunião',
      'pontos_adicionados', v_config.nao_comparecimento * v_reunioes_nao_compareceu,
      'pontuacao_total', v_pontuacao
    );
    
    v_alertas := v_alertas || jsonb_build_object(
      'tipo', 'equipe',
      'titulo', 'Não Comparecimento Recorrente',
      'descricao', 'Unidade ' || p_cnpj_unidade || ' não compareceu a ' || v_reunioes_nao_compareceu || ' reunião(ões)',
      'nivel_urgencia', 'media',
      'data_criacao', now(),
      'resolvido', false
    );
  END IF;
  
  -- 3. Notificações anteriores
  SELECT COUNT(*) INTO v_notificacoes_anteriores
  FROM documentos_gerados dg
  JOIN cobrancas_franqueados cf ON dg.titulo_id = cf.id
  WHERE cf.cnpj = p_cnpj_unidade;
  
  IF v_notificacoes_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.notificacao_anterior * v_notificacoes_anteriores);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_notificacoes_anteriores || ' notificação(ões) anterior(es)',
      'pontos_adicionados', v_config.notificacao_anterior * v_notificacoes_anteriores,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 4. Escalonamentos anteriores
  SELECT COUNT(*) INTO v_escalonamentos_anteriores
  FROM escalonamentos_cobranca 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  IF v_escalonamentos_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + (v_config.acionamento_juridico_anterior * v_escalonamentos_anteriores);
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', v_escalonamentos_anteriores || ' acionamento(s) jurídico(s) anterior(es)',
      'pontos_adicionados', v_config.acionamento_juridico_anterior * v_escalonamentos_anteriores,
      'pontuacao_total', v_pontuacao
    );
  END IF;
  
  -- 5. Reincidência com valor alto
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total_aberto
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND status = 'em_aberto';
  
  IF v_valor_total_aberto > v_config.valor_minimo_reincidencia AND v_escalonamentos_anteriores > 0 THEN
    v_pontuacao := v_pontuacao + v_config.reincidencia_valor_alto;
    v_historico := v_historico || jsonb_build_object(
      'data', now(),
      'motivo', 'Reincidência com valor alto (R$ ' || v_valor_total_aberto || ')',
      'pontos_adicionados', v_config.reincidencia_valor_alto,
      'pontuacao_total', v_pontuacao
    );
    
    v_alertas := v_alertas || jsonb_build_object(
      'tipo', 'juridico',
      'titulo', 'Reincidente Valor Alto',
      'descricao', 'Unidade ' || p_cnpj_unidade || ' reincidiu com valor superior a R$ ' || v_config.valor_minimo_reincidencia,
      'nivel_urgencia', 'critica',
      'data_criacao', now(),
      'resolvido', false
    );
  END IF;
  
  -- Determina nível de risco
  IF v_pontuacao >= v_config.limite_risco_critico THEN
    v_nivel_risco := 'critico';
  ELSIF v_pontuacao >= v_config.limite_risco_moderado THEN
    v_nivel_risco := 'moderado';
  ELSE
    v_nivel_risco := 'baixo';
  END IF;
  
  -- Retorna resultado
  RETURN jsonb_build_object(
    'cnpj_unidade', p_cnpj_unidade,
    'pontuacao_atual', v_pontuacao,
    'nivel_risco', v_nivel_risco,
    'historico_pontos', v_historico,
    'alertas_ativos', v_alertas,
    'ultima_atualizacao', now()
  );
END;
$_$;


ALTER FUNCTION "public"."calcular_pontuacao_risco"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_score_priorizacao"("p_cnpj_unidade" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_criterios RECORD;
  v_valor_total NUMERIC := 0;
  v_dias_max INTEGER := 0;
  v_qtd_debitos INTEGER := 0;
  v_tipos_debito TEXT[];
  v_score INTEGER := 0;
  v_peso_valor NUMERIC;
  v_peso_tempo NUMERIC;
  v_peso_multiplicidade NUMERIC;
BEGIN
  -- Busca critérios
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  -- Calcula métricas da unidade
  SELECT 
    COALESCE(SUM(CASE WHEN status = 'em_aberto' THEN COALESCE(valor_atualizado, valor_original) ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN status = 'em_aberto' THEN COALESCE(dias_em_atraso, 0) ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'em_aberto' THEN 1 END),
    ARRAY_AGG(DISTINCT COALESCE(tipo_cobranca, 'outros')) FILTER (WHERE status = 'em_aberto')
  INTO v_valor_total, v_dias_max, v_qtd_debitos, v_tipos_debito
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  -- Calcula componentes do score
  v_peso_valor := CASE 
    WHEN v_valor_total >= v_criterios.valor_minimo_alta_prioridade THEN 100
    ELSE (v_valor_total / v_criterios.valor_minimo_alta_prioridade) * 100
  END;
  
  v_peso_tempo := LEAST(v_dias_max / 90.0, 1) * 100;
  v_peso_multiplicidade := LEAST(v_qtd_debitos / 5.0, 1) * 100;
  
  -- Score final
  v_score := ROUND(
    (v_peso_valor * v_criterios.peso_valor_em_aberto / 100) +
    (v_peso_tempo * v_criterios.peso_tempo_inadimplencia / 100) +
    (v_peso_multiplicidade * v_criterios.peso_multiplicidade_debitos / 100)
  );
  
  RETURN GREATEST(v_score, 0);
END;
$$;


ALTER FUNCTION "public"."calcular_score_priorizacao"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_score_unidade"("p_cnpj_unidade" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_config JSONB;
  v_cobrancas RECORD;
  v_reunioes RECORD;
  v_acordos RECORD;
  v_score INTEGER := 0;
  v_componentes JSONB := '{}';
  v_nivel_risco TEXT := 'alto';
BEGIN
  -- Busca configuração
  SELECT pesos, limites, criterios_pontuacao INTO v_config
  FROM configuracao_score WHERE id = 'default';
  
  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Configuração de score não encontrada';
  END IF;
  
  -- Aqui seria implementada a lógica completa de cálculo
  -- Por simplicidade, retornando estrutura básica
  
  v_componentes := jsonb_build_object(
    'atraso_medio', jsonb_build_object('valor', 0, 'pontos', 10, 'peso', 25),
    'ocorrencias_90_dias', jsonb_build_object('valor', 0, 'pontos', 10, 'peso', 25),
    'reincidencia', jsonb_build_object('quebrou_acordo', false, 'pontos', 10, 'peso', 20),
    'comparecimento_reunioes', jsonb_build_object('total_reunioes', 0, 'faltas', 0, 'pontos', 5, 'peso', 15),
    'tempo_regularizacao', jsonb_build_object('dias_ultima_regularizacao', 0, 'pontos', 5, 'peso', 15)
  );
  
  v_score := 50; -- Score padrão
  
  -- Determina nível de risco
  IF v_score >= (v_config->'limites'->>'score_baixo_risco')::INTEGER THEN
    v_nivel_risco := 'baixo';
  ELSIF v_score >= (v_config->'limites'->>'score_medio_risco')::INTEGER THEN
    v_nivel_risco := 'medio';
  ELSE
    v_nivel_risco := 'alto';
  END IF;
  
  RETURN jsonb_build_object(
    'score', v_score,
    'nivel_risco', v_nivel_risco,
    'componentes', v_componentes
  );
END;
$$;


ALTER FUNCTION "public"."calcular_score_unidade"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calcular_valor_atualizado"("p_valor_original" numeric, "p_dias_atraso" integer) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  multa numeric := 0;
  juros numeric := 0;
  valor_final numeric;
BEGIN
  -- Se não há atraso, retorna valor original
  IF p_dias_atraso <= 0 THEN
    RETURN p_valor_original;
  END IF;
  
  -- Multa de 10% sobre valor original
  multa := p_valor_original * 0.10;
  
  -- Juros de 0.033% ao dia sobre valor original
  juros := p_valor_original * 0.00033 * p_dias_atraso;
  
  valor_final := p_valor_original + multa + juros;
  
  RETURN ROUND(valor_final, 2);
END;
$$;


ALTER FUNCTION "public"."calcular_valor_atualizado"("p_valor_original" numeric, "p_dias_atraso" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."criar_escalonamento_automatico"("p_cnpj_unidade" "text", "p_titulo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_valor_total numeric;
  v_pontuacao integer;
BEGIN
  -- Verifica se já existe escalonamento pendente
  IF EXISTS (
    SELECT 1 FROM escalonamentos_cobranca 
    WHERE cnpj_unidade = p_cnpj_unidade 
      AND status IN ('pendente', 'em_analise')
  ) THEN
    RETURN;
  END IF;
  
  -- Busca valor total e pontuação
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
  
  SELECT pontuacao_atual INTO v_pontuacao
  FROM pontuacao_risco_unidades 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  -- Cria escalonamento
  INSERT INTO escalonamentos_cobranca (
    titulo_id,
    cnpj_unidade,
    motivo_escalonamento,
    enviado_para,
    nivel,
    documento_gerado,
    status,
    valor_total_envolvido,
    quantidade_titulos,
    observacoes
  ) VALUES (
    p_titulo_id,
    p_cnpj_unidade,
    'Escalonamento automático por risco crítico (' || v_pontuacao || ' pontos)',
    'juridico@crescieperdi.com',
    'juridico',
    false,
    'pendente',
    v_valor_total,
    (SELECT COUNT(*) FROM cobrancas_franqueados WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto'),
    'Escalonamento automático acionado pelo sistema de alertas'
  );
  
  -- Registra alerta
  INSERT INTO alertas_sistema (
    cnpj_unidade,
    tipo_alerta,
    titulo,
    descricao,
    nivel_urgencia,
    acao_automatica
  ) VALUES (
    p_cnpj_unidade,
    'juridico',
    'Escalonamento Automático Acionado',
    'Unidade ' || p_cnpj_unidade || ' foi automaticamente escalonada para o jurídico devido ao risco crítico',
    'critica',
    'escalonamento_automatico'
  );
END;$$;


ALTER FUNCTION "public"."criar_escalonamento_automatico"("p_cnpj_unidade" "text", "p_titulo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."determinar_nivel_escalonamento"("p_dias_atraso" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_criterios RECORD;
BEGIN
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  IF p_dias_atraso <= v_criterios.dias_nivel_1 THEN RETURN 1;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_2 THEN RETURN 2;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_3 THEN RETURN 3;
  ELSIF p_dias_atraso <= v_criterios.dias_nivel_4 THEN RETURN 4;
  ELSE RETURN 5;
  END IF;
END;
$$;


ALTER FUNCTION "public"."determinar_nivel_escalonamento"("p_dias_atraso" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_dados_consolidados_mes"("p_referencia_mes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."gerar_dados_consolidados_mes"("p_referencia_mes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_hash_titulo"("p_documento" "text", "p_valor" numeric, "p_data_vencimento" "date", "p_linha_referencia" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$BEGIN
    RETURN encode(digest(
        COALESCE(p_documento, '') || '|' ||
        p_valor::text || '|' ||
        p_data_vencimento::text || '|' ||
        COALESCE(p_linha_referencia, ''), -- USADO NO CÁLCULO
        'sha256'
    ), 'hex');
END;$$;


ALTER FUNCTION "public"."gerar_hash_titulo"("p_documento" "text", "p_valor" numeric, "p_data_vencimento" "date", "p_linha_referencia" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_notificacao_extrajudicial"("p_cnpj_unidade" "text", "p_motivo_acionamento" "public"."motivo_acionamento_enum", "p_responsavel" "text" DEFAULT 'sistema_automatico'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_config record;
  v_unidade record;
  v_criterios jsonb;
  v_conteudo_notificacao text;
  v_notificacao_id uuid;
  v_data_prazo timestamptz;
BEGIN
  -- Busca configuração e dados da unidade
  SELECT * INTO v_config FROM criterios_juridico WHERE id = 'default';
  
  SELECT * INTO v_unidade 
  FROM unidades_franqueadas 
  WHERE codigo_unidade = p_cnpj_unidade;
  
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_cnpj_unidade;
  END IF;
  
  -- Busca critérios atuais
  SELECT verificar_criterios_juridico(p_cnpj_unidade) INTO v_criterios;
  
  -- Calcula data do prazo
  v_data_prazo := now() + (v_config.prazo_resposta_notificacao_dias || ' days')::interval;
  
  -- Gera conteúdo da notificação substituindo variáveis
  v_conteudo_notificacao := v_config.template_notificacao_extrajudicial;
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{nome_franqueado}}', v_unidade.nome_franqueado);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{codigo_unidade}}', v_unidade.codigo_unidade);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{dias_em_aberto}}', (v_criterios->>'dias_atraso_max')::text);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{valor_total}}', to_char((v_criterios->>'valor_total')::numeric, 'FM999G999G999D00'));
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{prazo_resposta}}', v_config.prazo_resposta_notificacao_dias::text);
  v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{motivo_acionamento}}', p_motivo_acionamento::text);
  
  -- Busca data de vencimento mais antiga
  DECLARE
    v_data_vencimento_antiga date;
  BEGIN
    SELECT MIN(data_vencimento) INTO v_data_vencimento_antiga
    FROM cobrancas_franqueados 
    WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
    
    v_conteudo_notificacao := replace(v_conteudo_notificacao, '{{data_vencimento_antiga}}', 
      COALESCE(v_data_vencimento_antiga::text, 'N/A'));
  END;
  
  -- Insere notificação
  INSERT INTO notificacoes_extrajudiciais (
    cnpj_unidade,
    tipo_notificacao,
    destinatario_email,
    destinatario_whatsapp,
    conteudo_notificacao,
    data_prazo_resposta
  ) VALUES (
    p_cnpj_unidade,
    'extrajudicial',
    v_unidade.email_franqueado,
    v_unidade.telefone_franqueado,
    v_conteudo_notificacao,
    v_data_prazo
  ) RETURNING id INTO v_notificacao_id;
  
  -- Atualiza status da unidade
  UPDATE unidades_franqueadas 
  SET 
    juridico_status = 'notificado',
    data_ultimo_acionamento = now()
  WHERE codigo_unidade = p_cnpj_unidade;
  
  -- Registra no log jurídico
  INSERT INTO juridico_log (
    cnpj_unidade,
    tipo_acao,
    motivo_acionamento,
    valor_em_aberto,
    responsavel,
    status_anterior,
    status_novo
  ) VALUES (
    p_cnpj_unidade,
    'notificacao_extrajudicial',
    p_motivo_acionamento,
    (v_criterios->>'valor_total')::numeric,
    p_responsavel,
    v_unidade.juridico_status,
    'notificado'
  );
  
  RETURN v_notificacao_id;
END;
$$;


ALTER FUNCTION "public"."gerar_notificacao_extrajudicial"("p_cnpj_unidade" "text", "p_motivo_acionamento" "public"."motivo_acionamento_enum", "p_responsavel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gerar_token_acesso_franqueado"("p_cnpj" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token text;
  v_expira_em timestamptz;
BEGIN
  -- Gera token aleatório
  v_token := encode(gen_random_bytes(32), 'hex');
  v_expira_em := now() + interval '15 minutes';
  
  -- Atualiza ou insere registro de auth
  INSERT INTO auth_franqueados (cnpj, token_acesso, token_expira_em, tentativas_login)
  VALUES (p_cnpj, v_token, v_expira_em, 0)
  ON CONFLICT (cnpj) 
  DO UPDATE SET 
    token_acesso = v_token,
    token_expira_em = v_expira_em,
    tentativas_login = 0,
    updated_at = now();
  
  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."gerar_token_acesso_franqueado"("p_cnpj" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '')::text;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_template_disparos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE templates_juridicos 
  SET total_disparos = COALESCE(total_disparos, 0) + 1
  WHERE id = NEW.template_id;
  
  IF NEW.gatilho_id IS NOT NULL THEN
    UPDATE gatilhos_automaticos 
    SET total_execucoes = COALESCE(total_execucoes, 0) + 1
    WHERE id = NEW.gatilho_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_template_disparos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."limpar_sessoes_expiradas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE sessoes_usuario 
  SET ativa = false 
  WHERE ativa = true 
  AND data_ultimo_acesso < now() - INTERVAL '2 hours';
END;
$$;


ALTER FUNCTION "public"."limpar_sessoes_expiradas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_acionamento_juridico_automatico"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_unidade record;
  v_criterios jsonb;
  v_acionamentos integer := 0;
  v_motivo_principal motivo_acionamento_enum;
BEGIN
  -- Busca unidades ativas que não estão em processo jurídico
  FOR v_unidade IN 
    SELECT codigo_unidade, juridico_status
    FROM unidades_franqueadas 
    WHERE status_unidade = 'ativa' 
      AND juridico_status NOT IN ('notificado', 'em_analise', 'pre_processo', 'acionado')
  LOOP
    -- Verifica critérios para cada unidade
    SELECT verificar_criterios_juridico(v_unidade.codigo_unidade) INTO v_criterios;
    
    -- Se deve acionar
    IF (v_criterios->>'deve_acionar')::boolean THEN
      -- Determina motivo principal
      IF 'valor_alto' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'valor_alto';
      ELSIF 'acordo_descumprido' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'acordo_descumprido';
      ELSIF 'cobrancas_ignoradas' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'cobrancas_ignoradas';
      ELSIF 'score_zero' = ANY(ARRAY(SELECT jsonb_array_elements_text(v_criterios->'motivos'))) THEN
        v_motivo_principal := 'score_zero';
      ELSE
        v_motivo_principal := 'reincidencia_6_meses';
      END IF;
      
      -- Gera notificação
      PERFORM gerar_notificacao_extrajudicial(
        v_unidade.codigo_unidade,
        v_motivo_principal,
        'sistema_automatico'
      );
      
      v_acionamentos := v_acionamentos + 1;
    END IF;
  END LOOP;
  
  RETURN v_acionamentos;
END;
$$;


ALTER FUNCTION "public"."processar_acionamento_juridico_automatico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_escalonamento_automatico"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_unidade RECORD;
  v_criterios RECORD;
  v_escalonamentos INTEGER := 0;
BEGIN
  SELECT * INTO v_criterios FROM criterios_priorizacao WHERE id = 'default';
  
  -- Busca unidades que precisam de escalonamento
  FOR v_unidade IN 
    SELECT * FROM priorizacao_unidades 
    WHERE tentativas_contato_nivel >= v_criterios.max_tentativas_por_nivel
    AND nivel_escalonamento < 5
  LOOP
    -- Registra histórico
    INSERT INTO historico_escalonamento (
      cnpj_unidade,
      nivel_anterior,
      nivel_novo,
      motivo_escalonamento,
      score_anterior,
      score_novo,
      acao_automatica
    ) VALUES (
      v_unidade.cnpj_unidade,
      v_unidade.nivel_escalonamento,
      v_unidade.nivel_escalonamento + 1,
      'Escalonamento automático por máximo de tentativas',
      v_unidade.score_priorizacao,
      v_unidade.score_priorizacao,
      true
    );
    
    -- Atualiza nível
    UPDATE priorizacao_unidades 
    SET 
      nivel_escalonamento = nivel_escalonamento + 1,
      tentativas_contato_nivel = 0,
      updated_at = now()
    WHERE cnpj_unidade = v_unidade.cnpj_unidade;
    
    v_escalonamentos := v_escalonamentos + 1;
  END LOOP;
  
  RETURN v_escalonamentos;
END;
$$;


ALTER FUNCTION "public"."processar_escalonamento_automatico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_escalonamento_automatico"("p_titulo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_criterio record;
  v_cobranca record;
  v_escalonamento_id uuid;
BEGIN
  -- Verifica critérios
  SELECT * INTO v_criterio 
  FROM verificar_criterios_escalonamento(p_titulo_id);
  
  IF NOT v_criterio.deve_escalar THEN
    RETURN;
  END IF;
  
  -- Busca dados da cobrança
  SELECT * INTO v_cobranca 
  FROM cobrancas_franqueados 
  WHERE id = p_titulo_id;
  
  -- Cria escalonamento
  INSERT INTO escalonamentos_cobranca (
    titulo_id,
    cnpj_unidade,
    motivo_escalonamento,
    nivel,
    valor_total_envolvido,
    enviado_para
  ) VALUES (
    p_titulo_id,
    v_cobranca.cnpj,
    v_criterio.motivo,
    v_criterio.nivel,
    v_criterio.valor_envolvido,
    CASE 
      WHEN v_criterio.nivel = 'diretoria' THEN 'diretoria@franquia.com'
      WHEN v_criterio.nivel = 'auditoria' THEN 'auditoria@franquia.com'
      ELSE 'juridico@franquia.com'
    END
  ) RETURNING id INTO v_escalonamento_id;
  
  -- Registra tratativa
  INSERT INTO tratativas_cobranca (
    titulo_id,
    tipo_interacao,
    canal,
    usuario_sistema,
    descricao,
    status_cobranca_resultante
  ) VALUES (
    p_titulo_id,
    'escalonamento',
    'interno',
    'sistema_automatico',
    'Caso escalado automaticamente: ' || v_criterio.motivo,
    'em_tratativa_juridica'
  );
  
  -- Atualiza status da cobrança
  UPDATE cobrancas_franqueados 
  SET status = 'em_tratativa_juridica'
  WHERE id = p_titulo_id;
  
END;
$$;


ALTER FUNCTION "public"."processar_escalonamento_automatico"("p_titulo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_evento_risco"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cnpj_unidade text;
  v_pontuacao_resultado jsonb;
BEGIN
  -- Determina CNPJ baseado na tabela de origem
  IF TG_TABLE_NAME = 'cobrancas_franqueados' THEN
    v_cnpj_unidade := NEW.cnpj;
  ELSIF TG_TABLE_NAME = 'reunioes_negociacao' THEN
    v_cnpj_unidade := NEW.cnpj_unidade;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Calcula nova pontuação
  v_pontuacao_resultado := calcular_pontuacao_risco(v_cnpj_unidade);
  
  -- Atualiza ou insere pontuação
  INSERT INTO pontuacao_risco_unidades (
    cnpj_unidade,
    pontuacao_atual,
    nivel_risco,
    historico_pontos,
    alertas_ativos
  ) VALUES (
    v_cnpj_unidade,
    (v_pontuacao_resultado->>'pontuacao_atual')::integer,
    v_pontuacao_resultado->>'nivel_risco',
    v_pontuacao_resultado->'historico_pontos',
    v_pontuacao_resultado->'alertas_ativos'
  )
  ON CONFLICT (cnpj_unidade) 
  DO UPDATE SET
    pontuacao_atual = (v_pontuacao_resultado->>'pontuacao_atual')::integer,
    nivel_risco = v_pontuacao_resultado->>'nivel_risco',
    historico_pontos = v_pontuacao_resultado->'historico_pontos',
    alertas_ativos = v_pontuacao_resultado->'alertas_ativos',
    ultima_atualizacao = now(),
    updated_at = now();
  
  -- Se risco crítico, cria escalonamento automático
  IF (v_pontuacao_resultado->>'nivel_risco') = 'critico' THEN
    PERFORM criar_escalonamento_automatico(v_cnpj_unidade, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."processar_evento_risco"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_evento_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cnpj TEXT;
  v_tipo_evento TEXT;
  v_descricao TEXT;
BEGIN
  -- Determina CNPJ e tipo de evento baseado na tabela
  IF TG_TABLE_NAME = 'cobrancas_franqueados' THEN
    v_cnpj := NEW.cnpj;
    IF TG_OP = 'INSERT' THEN
      v_tipo_evento := 'nova_cobranca';
      v_descricao := 'Nova cobrança criada';
    ELSIF OLD.status != NEW.status AND NEW.status = 'quitado' THEN
      v_tipo_evento := 'pagamento';
      v_descricao := 'Cobrança quitada';
    END IF;
  ELSIF TG_TABLE_NAME = 'reunioes_negociacao' THEN
    v_cnpj := NEW.cnpj_unidade;
    IF NEW.status_reuniao = 'nao_compareceu' THEN
      v_tipo_evento := 'reuniao_faltou';
      v_descricao := 'Não compareceu à reunião';
    END IF;
  ELSIF TG_TABLE_NAME = 'acordos_parcelamento' THEN
    v_cnpj := NEW.cnpj_unidade;
    IF NEW.status_acordo = 'quebrado' THEN
      v_tipo_evento := 'acordo_quebrado';
      v_descricao := 'Acordo de parcelamento quebrado';
    END IF;
  END IF;
  
  -- Registra evento se relevante
  IF v_tipo_evento IS NOT NULL THEN
    INSERT INTO eventos_score (cnpj_unidade, tipo_evento, descricao)
    VALUES (v_cnpj, v_tipo_evento, v_descricao);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."processar_evento_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_pagamento_parcela"("p_parcela_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."processar_pagamento_parcela"("p_parcela_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."processar_resultado_reuniao"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."processar_resultado_reuniao"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_log_acesso"("p_cnpj" "text", "p_ip" "text", "p_user_agent" "text", "p_acao" "text", "p_sucesso" boolean DEFAULT true, "p_detalhes" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO logs_acesso_franqueados (
    cnpj, ip_acesso, user_agent, acao, sucesso, detalhes
  ) VALUES (
    p_cnpj, p_ip, p_user_agent, p_acao, p_sucesso, p_detalhes
  );
END;
$$;


ALTER FUNCTION "public"."registrar_log_acesso"("p_cnpj" "text", "p_ip" "text", "p_user_agent" "text", "p_acao" "text", "p_sucesso" boolean, "p_detalhes" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_log_automatico"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Registra log para operações de UPDATE e DELETE
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO logs_sistema (
      usuario_id,
      acao,
      tabela_afetada,
      registro_id,
      dados_anteriores,
      dados_novos
    ) VALUES (
      COALESCE(current_setting('app.current_user_id', true), 'sistema'),
      'UPDATE',
      TG_TABLE_NAME,
      COALESCE(NEW.id::text, OLD.id::text),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO logs_sistema (
      usuario_id,
      acao,
      tabela_afetada,
      registro_id,
      dados_anteriores
    ) VALUES (
      COALESCE(current_setting('app.current_user_id', true), 'sistema'),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."registrar_log_automatico"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolver_acionamento_juridico"("p_cnpj_unidade" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_valor_em_aberto numeric;
BEGIN
  -- Verifica se ainda há débitos em aberto
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_em_aberto
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade AND status = 'em_aberto';
  
  -- Se não há mais débitos, resolve o acionamento
  IF v_valor_em_aberto = 0 THEN
    -- Atualiza status da unidade
    UPDATE unidades_franqueadas 
    SET juridico_status = 'resolvido'
    WHERE codigo_unidade = p_cnpj_unidade;
    
    -- Registra resolução no log
    INSERT INTO juridico_log (
      cnpj_unidade,
      tipo_acao,
      motivo_acionamento,
      valor_em_aberto,
      responsavel,
      status_novo
    ) VALUES (
      p_cnpj_unidade,
      'resolucao_automatica',
      'valor_alto', -- Motivo genérico para resolução
      0,
      'sistema_automatico',
      'resolvido'
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."resolver_acionamento_juridico"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_resolver_acionamento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Se status mudou para quitado
  IF OLD.status != 'quitado' AND NEW.status = 'quitado' THEN
    PERFORM resolver_acionamento_juridico(NEW.cnpj);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_resolver_acionamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_verificar_escalonamento"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Verifica escalonamento após mudanças relevantes
  PERFORM processar_escalonamento_automatico(NEW.titulo_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_verificar_escalonamento"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_auth_franqueados_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_auth_franqueados_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_configuracao_notificacao_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_configuracao_notificacao_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_integracoes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_integracoes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_juridico_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_juridico_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_parcelamento_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_parcelamento_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_priorizacao_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_priorizacao_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_score_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_score_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_dados_importacao"() RETURNS TABLE("tabela" "text", "problema" "text", "quantidade" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Verificar franqueados sem CPF/RNM
    RETURN QUERY
    SELECT 
        'franqueados'::TEXT,
        'Franqueados sem CPF/RNM'::TEXT,
        COUNT(*)
    FROM franqueados 
    WHERE cpf_rnm IS NULL OR cpf_rnm = '';
    
    -- Verificar franqueados sem nome
    RETURN QUERY
    SELECT 
        'franqueados'::TEXT,
        'Franqueados sem nome'::TEXT,
        COUNT(*)
    FROM franqueados 
    WHERE nome_completo IS NULL OR nome_completo = '';
    
    -- Verificar unidades sem código da unidade
    RETURN QUERY
    SELECT 
        'unidades_franqueadas'::TEXT,
        'Unidades sem código da unidade'::TEXT,
        COUNT(*)
    FROM unidades_franqueadas 
    WHERE codigo_unidade IS NULL OR codigo_unidade = '';
    
    -- Verificar unidades sem CNPJ
    RETURN QUERY
    SELECT 
        'unidades_franqueadas'::TEXT,
        'Unidades sem CNPJ (codigo_interno)'::TEXT,
        COUNT(*)
    FROM unidades_franqueadas 
    WHERE codigo_interno IS NULL OR codigo_interno = '';
    
    -- Verificar vínculos órfãos
    RETURN QUERY
    SELECT 
        'franqueado_unidades'::TEXT,
        'Vínculos com franqueado inexistente'::TEXT,
        COUNT(*)
    FROM franqueado_unidades fu
    LEFT JOIN franqueados f ON fu.franqueado_id = f.id
    WHERE f.id IS NULL;
    
    RETURN QUERY
    SELECT 
        'franqueado_unidades'::TEXT,
        'Vínculos com unidade inexistente'::TEXT,
        COUNT(*)
    FROM franqueado_unidades fu
    LEFT JOIN unidades_franqueadas u ON fu.unidade_id = u.id
    WHERE u.id IS NULL;
END;
$$;


ALTER FUNCTION "public"."validar_dados_importacao"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validar_dados_importacao"() IS 'Função para validar integridade dos dados após importação do NocoDB';



CREATE OR REPLACE FUNCTION "public"."validar_token_franqueado"("p_cnpj" "text", "p_token" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_auth_record auth_franqueados%ROWTYPE;
BEGIN
  -- Busca registro de auth
  SELECT * INTO v_auth_record
  FROM auth_franqueados
  WHERE cnpj = p_cnpj AND token_acesso = p_token;
  
  -- Verifica se existe e não expirou
  IF v_auth_record.id IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_auth_record.token_expira_em < now() THEN
    RETURN false;
  END IF;
  
  -- Atualiza último acesso
  UPDATE auth_franqueados
  SET ultimo_acesso = now()
  WHERE id = v_auth_record.id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."validar_token_franqueado"("p_cnpj" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_criterios_escalonamento"("p_titulo_id" "uuid") RETURNS TABLE("deve_escalar" boolean, "motivo" "text", "nivel" "public"."nivel_escalonamento_enum", "valor_envolvido" numeric)
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_cobranca record;
  v_reunioes_falhadas integer;
  v_valor_total_unidade numeric;
  v_meses_consecutivos integer;
  v_acordo_nao_cumprido boolean;
  v_tratativas_resolutivas integer;
BEGIN
  -- Busca dados da cobrança
  SELECT * INTO v_cobranca 
  FROM cobrancas_franqueados 
  WHERE id = p_titulo_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Título não encontrado', 'juridico'::nivel_escalonamento_enum, 0::numeric;
    RETURN;
  END IF;
  
  -- Verifica se já foi escalado
  IF EXISTS (
    SELECT 1 FROM escalonamentos_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND status IN ('pendente', 'em_analise')
  ) THEN
    RETURN QUERY SELECT false, 'Já escalado', 'juridico'::nivel_escalonamento_enum, 0::numeric;
    RETURN;
  END IF;

  -- Critério 1: Atraso > 90 dias sem tratativas resolutivas
  IF v_cobranca.dias_em_atraso > 90 THEN
    SELECT COUNT(*) INTO v_tratativas_resolutivas
    FROM tratativas_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND tipo_interacao IN ('proposta_aceita', 'acordo_fechado', 'pagamento_parcial');
    
    IF v_tratativas_resolutivas = 0 THEN
      RETURN QUERY SELECT 
        true, 
        'Atraso superior a 90 dias sem tratativas resolutivas',
        'juridico'::nivel_escalonamento_enum,
        v_cobranca.valor_atualizado;
      RETURN;
    END IF;
  END IF;

  -- Critério 2: 3+ reuniões falhadas
  SELECT COUNT(*) INTO v_reunioes_falhadas
  FROM reunioes_negociacao 
  WHERE titulo_id = p_titulo_id 
  AND status_reuniao IN ('remarcada', 'nao_compareceu');
  
  IF v_reunioes_falhadas >= 3 THEN
    RETURN QUERY SELECT 
      true, 
      'Três ou mais reuniões remarcadas/não realizadas',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Critério 3: Valor total da unidade > R$ 20.000
  SELECT COALESCE(SUM(valor_atualizado), 0) INTO v_valor_total_unidade
  FROM cobrancas_franqueados 
  WHERE cnpj = v_cobranca.cnpj 
  AND status = 'em_aberto';
  
  IF v_valor_total_unidade > 20000 THEN
    RETURN QUERY SELECT 
      true, 
      'Valor total em aberto da unidade superior a R$ 20.000',
      'diretoria'::nivel_escalonamento_enum,
      v_valor_total_unidade;
    RETURN;
  END IF;

  -- Critério 4: Status crítico manual
  IF v_cobranca.status = 'em_tratativa_critica' THEN
    RETURN QUERY SELECT 
      true, 
      'Marcado manualmente como tratativa crítica',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Critério 5: Acordo não cumprido
  SELECT EXISTS(
    SELECT 1 FROM tratativas_cobranca 
    WHERE titulo_id = p_titulo_id 
    AND tipo_interacao = 'proposta_aceita'
    AND created_at < now() - interval '30 days'
  ) AND v_cobranca.valor_recebido = 0 INTO v_acordo_nao_cumprido;
  
  IF v_acordo_nao_cumprido THEN
    RETURN QUERY SELECT 
      true, 
      'Acordo firmado não cumprido após 30 dias',
      'juridico'::nivel_escalonamento_enum,
      v_cobranca.valor_atualizado;
    RETURN;
  END IF;

  -- Nenhum critério atendido
  RETURN QUERY SELECT false, 'Nenhum critério de escalonamento atendido', 'juridico'::nivel_escalonamento_enum, 0::numeric;
END;
$_$;


ALTER FUNCTION "public"."verificar_criterios_escalonamento"("p_titulo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_criterios_juridico"("p_cnpj_unidade" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_config record;
  v_cobrancas record;
  v_score_risco record;
  v_acordos_quebrados integer;
  v_reincidencia_6_meses integer;
  v_cobrancas_ignoradas integer;
  v_resultado jsonb;
  v_deve_acionar boolean := false;
  v_motivos text[] := '{}';
  v_valor_total numeric := 0;
  v_dias_atraso_max integer := 0;
BEGIN
  -- Busca configuração
  SELECT * INTO v_config FROM criterios_juridico WHERE id = 'default';
  
  -- Busca dados das cobranças da unidade
  SELECT 
    COUNT(*) as total_cobrancas,
    SUM(CASE WHEN status = 'em_aberto' THEN valor_atualizado ELSE 0 END) as valor_em_aberto,
    MAX(CASE WHEN status = 'em_aberto' THEN dias_em_atraso ELSE 0 END) as max_dias_atraso
  INTO v_cobrancas
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade;
  
  v_valor_total := COALESCE(v_cobrancas.valor_em_aberto, 0);
  v_dias_atraso_max := COALESCE(v_cobrancas.max_dias_atraso, 0);
  
  -- Critério 1: Valor total em aberto > limite
  IF v_valor_total > v_config.valor_minimo_acionamento THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'valor_alto');
  END IF;
  
  -- Critério 2: Cobranças ignoradas (sem tratativas há mais de X dias)
  SELECT COUNT(*) INTO v_cobrancas_ignoradas
  FROM cobrancas_franqueados c
  WHERE c.cnpj = p_cnpj_unidade 
    AND c.status = 'em_aberto'
    AND NOT EXISTS (
      SELECT 1 FROM tratativas_cobranca t 
      WHERE t.titulo_id = c.id 
        AND t.data_interacao > (now() - interval '15 days')
        AND t.tipo_interacao != 'mensagem_automatica'
    );
    
  IF v_cobrancas_ignoradas >= v_config.quantidade_cobrancas_ignoradas THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'cobrancas_ignoradas');
  END IF;
  
  -- Critério 3: Acordo descumprido
  SELECT COUNT(*) INTO v_acordos_quebrados
  FROM acordos_parcelamento 
  WHERE cnpj_unidade = p_cnpj_unidade 
    AND status_acordo = 'quebrado';
    
  IF v_acordos_quebrados > 0 THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'acordo_descumprido');
  END IF;
  
  -- Critério 4: Score de risco = 0
  SELECT * INTO v_score_risco 
  FROM score_risco_unidades 
  WHERE cnpj_unidade = p_cnpj_unidade;
  
  IF v_score_risco.score_atual IS NOT NULL AND v_score_risco.score_atual <= v_config.score_minimo_acionamento THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'score_zero');
  END IF;
  
  -- Critério 5: Reincidência nos últimos 6 meses
  SELECT COUNT(DISTINCT DATE_TRUNC('month', created_at)) INTO v_reincidencia_6_meses
  FROM cobrancas_franqueados 
  WHERE cnpj = p_cnpj_unidade 
    AND created_at > (now() - interval '6 months')
    AND status IN ('em_aberto', 'vencido');
    
  IF v_reincidencia_6_meses >= v_config.meses_reincidencia_limite THEN
    v_deve_acionar := true;
    v_motivos := array_append(v_motivos, 'reincidencia_6_meses');
  END IF;
  
  -- Monta resultado
  v_resultado := jsonb_build_object(
    'deve_acionar', v_deve_acionar,
    'motivos', v_motivos,
    'valor_total', v_valor_total,
    'dias_atraso_max', v_dias_atraso_max,
    'cobrancas_ignoradas', v_cobrancas_ignoradas,
    'acordos_quebrados', v_acordos_quebrados,
    'score_atual', COALESCE(v_score_risco.score_atual, 0),
    'reincidencia_meses', v_reincidencia_6_meses
  );
  
  RETURN v_resultado;
END;
$$;


ALTER FUNCTION "public"."verificar_criterios_juridico"("p_cnpj_unidade" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_escalonamentos_lote"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_unidade record;
  v_novos_escalonamentos integer := 0;
BEGIN
  -- Verifica todas as unidades com cobranças em aberto
  FOR v_unidade IN 
    SELECT DISTINCT cnpj 
    FROM cobrancas_franqueados 
    WHERE status = 'em_aberto'
  LOOP
    -- Recalcula pontuação de risco
    PERFORM calcular_pontuacao_risco(v_unidade.cnpj);
    
    -- Verifica se precisa escalar
    IF EXISTS (
      SELECT 1 FROM pontuacao_risco_unidades 
      WHERE cnpj_unidade = v_unidade.cnpj 
        AND nivel_risco = 'critico'
        AND NOT EXISTS (
          SELECT 1 FROM escalonamentos_cobranca 
          WHERE cnpj_unidade = v_unidade.cnpj 
            AND status IN ('pendente', 'em_analise')
        )
    ) THEN
      -- Busca título principal para escalar
      DECLARE
        v_titulo_id uuid;
      BEGIN
        SELECT id INTO v_titulo_id
        FROM cobrancas_franqueados 
        WHERE cnpj = v_unidade.cnpj 
          AND status = 'em_aberto'
        ORDER BY dias_em_atraso DESC
        LIMIT 1;
        
        IF v_titulo_id IS NOT NULL THEN
          PERFORM criar_escalonamento_automatico(v_unidade.cnpj, v_titulo_id);
          v_novos_escalonamentos := v_novos_escalonamentos + 1;
        END IF;
      END;
    END IF;
  END LOOP;
  
  RETURN v_novos_escalonamentos;
END;
$$;


ALTER FUNCTION "public"."verificar_escalonamentos_lote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_parcelas_atrasadas"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."verificar_parcelas_atrasadas"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_permissao_usuario"("p_email" "text", "p_permissao" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_nivel TEXT;
BEGIN
  SELECT nivel_permissao INTO v_nivel
  FROM usuarios_sistema
  WHERE email = p_email AND ativo = true;
  
  -- Admin master tem todas as permissões
  IF v_nivel = 'admin_master' THEN
    RETURN true;
  END IF;
  
  -- Verifica permissões específicas por nível
  CASE p_permissao
    WHEN 'configuracoes' THEN
      RETURN v_nivel = 'admin_master';
    WHEN 'usuarios' THEN
      RETURN v_nivel = 'admin_master';
    WHEN 'juridico' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico');
    WHEN 'cobrancas' THEN
      RETURN v_nivel IN ('admin_master', 'cobranca', 'analista_financeiro');
    WHEN 'relatorios' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico', 'cobranca', 'analista_financeiro', 'observador');
    WHEN 'dashboard' THEN
      RETURN v_nivel IN ('admin_master', 'gestor_juridico', 'cobranca', 'analista_financeiro', 'observador');
    ELSE
      RETURN false;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."verificar_permissao_usuario"("p_email" "text", "p_permissao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verificar_reunioes_nao_realizadas"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."verificar_reunioes_nao_realizadas"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."acoes_automaticas_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "nivel_escalonamento" integer NOT NULL,
    "acao_executada" "text" NOT NULL,
    "resultado" "text",
    "detalhes" "jsonb" DEFAULT '{}'::"jsonb",
    "data_execucao" timestamp with time zone DEFAULT "now"(),
    "sucesso" boolean DEFAULT true,
    "erro_detalhes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."acoes_automaticas_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."acordos_parcelamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "valor_original" numeric NOT NULL,
    "valor_atualizado" numeric NOT NULL,
    "valor_entrada" numeric NOT NULL,
    "quantidade_parcelas" integer NOT NULL,
    "valor_parcela" numeric NOT NULL,
    "valor_total_acordo" numeric NOT NULL,
    "data_vencimento_entrada" "date" NOT NULL,
    "data_primeiro_vencimento" "date" NOT NULL,
    "status_acordo" "text" DEFAULT 'proposto'::"text" NOT NULL,
    "aceito_em" timestamp with time zone,
    "aceito_por" "text",
    "ip_aceite" "text",
    "boleto_entrada_url" "text",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "acordos_parcelamento_status_acordo_check" CHECK (("status_acordo" = ANY (ARRAY['proposto'::"text", 'aceito'::"text", 'cumprindo'::"text", 'cumprido'::"text", 'quebrado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."acordos_parcelamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alertas_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text",
    "tipo_alerta" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "nivel_urgencia" "text" DEFAULT '''baixa''::text'::"text",
    "data_criacao" timestamp with time zone DEFAULT "now"(),
    "data_resolucao" timestamp with time zone,
    "resolvido" boolean DEFAULT false,
    "acao_automatica" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "alertas_sistema_nivel_urgencia_check" CHECK (("nivel_urgencia" = ANY (ARRAY['baixa'::"text", 'media'::"text", 'alta'::"text", 'critica'::"text"])))
);


ALTER TABLE "public"."alertas_sistema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cobrancas_franqueados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj" "text" DEFAULT 'NULL'::"text",
    "cliente" "text" NOT NULL,
    "valor_original" numeric NOT NULL,
    "valor_recebido" numeric DEFAULT 0,
    "data_vencimento" "date" NOT NULL,
    "dias_em_atraso" integer,
    "valor_atualizado" numeric,
    "status" "text" DEFAULT 'em_aberto'::"text" NOT NULL,
    "data_ultima_atualizacao" timestamp with time zone DEFAULT "now"(),
    "referencia_importacao" "text",
    "hash_titulo" "text",
    "telefone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nivel_criticidade" "text" DEFAULT 'normal'::"text",
    "unidade_id_fk" "uuid",
    "linha_referencia_importada" "text" NOT NULL,
    "descricao" "text",
    "tipo_cobranca" "text",
    "data_vencimento_original" "date",
    "email_cobranca" "text",
    "cliente_codigo" "text",
    "data_acionamento_juridico" timestamp with time zone,
    "kanban_manual_change" boolean DEFAULT false,
    "observacoes" "text",
    "notificacao_automatica_whatsapp" "jsonb" DEFAULT '{"3": false, "7": false, "15": false, "30": false}'::"jsonb",
    "notificacao_automatica_email" "jsonb" DEFAULT '{"3": false, "7": false, "15": false, "30": false}'::"jsonb",
    "cpf" "text",
    "franqueado_id_fk" "uuid",
    CONSTRAINT "cobrancas_doc_presente_chk" CHECK ((("cnpj" IS NOT NULL) OR ("cpf" IS NOT NULL))),
    CONSTRAINT "cobrancas_franqueados_nivel_criticidade_check" CHECK (("nivel_criticidade" = ANY (ARRAY['normal'::"text", 'grave'::"text", 'critico'::"text", 'juridico'::"text"])))
);


ALTER TABLE "public"."cobrancas_franqueados" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cobrancas_franqueados"."unidade_id_fk" IS 'FK para vincular as 2 tabelas';



COMMENT ON COLUMN "public"."cobrancas_franqueados"."linha_referencia_importada" IS 'Referência de Importação Planilha';



COMMENT ON COLUMN "public"."cobrancas_franqueados"."kanban_manual_change" IS 'Indica se o status foi alterado manualmente via Kanban. Resetado automaticamente pela trigger.';



CREATE TABLE IF NOT EXISTS "public"."configuracao_acordos" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "percentual_entrada_minimo" numeric DEFAULT 20.0,
    "valor_parcela_minimo" numeric DEFAULT 300.00,
    "quantidade_maxima_parcelas" integer DEFAULT 6,
    "percentual_multa" numeric DEFAULT 10.0,
    "percentual_juros_mes" numeric DEFAULT 1.0,
    "percentual_desconto_entrada" numeric DEFAULT 5.0,
    "dias_vencimento_entrada" integer DEFAULT 7,
    "dias_entre_parcelas" integer DEFAULT 30,
    "permite_renegociacao" boolean DEFAULT true,
    "max_acordos_quebrados" integer DEFAULT 2,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracao_acordos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracao_email" (
    "id" "text" NOT NULL,
    "nome_remetente" "text",
    "email_padrao" "text",
    "email_retorno" "text",
    "ativo" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracao_email" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracao_parcelamento" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "percentual_juros_parcela" numeric DEFAULT 3.0 NOT NULL,
    "valor_minimo_parcela" numeric DEFAULT 200.0 NOT NULL,
    "quantidade_maxima_parcelas" integer DEFAULT 6 NOT NULL,
    "percentual_entrada_minimo" numeric DEFAULT 20.0,
    "dias_entre_parcelas" integer DEFAULT 30 NOT NULL,
    "prazo_validade_proposta_dias" integer DEFAULT 7 NOT NULL,
    "template_whatsapp" "text" DEFAULT '🏪 *PROPOSTA DE PARCELAMENTO*

Olá, {{cliente}}! 

Temos uma proposta especial para regularizar seu débito:

💰 *Valor Original:* R$ {{valor_original}}
💰 *Valor Atualizado:* R$ {{valor_atualizado}}

📋 *NOSSA PROPOSTA:*
{{#entrada}}💵 Entrada: R$ {{valor_entrada}}{{/entrada}}
📅 {{quantidade_parcelas}}x de R$ {{valor_parcela}}
📊 Juros: {{percentual_juros}}% por parcela
💳 Total: R$ {{valor_total}}

📅 *Primeira parcela:* {{data_primeira_parcela}}

✅ *Aceita a proposta?*
Responda SIM para confirmar.

⏰ Proposta válida até {{data_expiracao}}

_Equipe Financeira - Cresci e Perdi_'::"text" NOT NULL,
    "template_email_assunto" "text" DEFAULT 'Proposta de Parcelamento - {{cliente}}'::"text" NOT NULL,
    "template_email_corpo" "text" DEFAULT 'Prezado(a) {{cliente}},

Temos uma proposta especial para regularizar seu débito da unidade {{codigo_unidade}}.

DETALHES DA PROPOSTA:
- Valor Original: R$ {{valor_original}}
- Valor Atualizado: R$ {{valor_atualizado}}
{{#entrada}}- Entrada: R$ {{valor_entrada}}{{/entrada}}
- Parcelamento: {{quantidade_parcelas}}x de R$ {{valor_parcela}}
- Juros aplicado: {{percentual_juros}}% por parcela
- Valor Total: R$ {{valor_total}}
- Primeira parcela: {{data_primeira_parcela}}

Esta proposta é válida até {{data_expiracao}}.

Para aceitar, responda este email confirmando.

Atenciosamente,
Equipe Financeira'::"text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracao_parcelamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracao_risco" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "atraso_10_dias" integer DEFAULT 1,
    "nao_comparecimento" integer DEFAULT 1,
    "nao_resposta_consecutiva" integer DEFAULT 1,
    "notificacao_anterior" integer DEFAULT 2,
    "parcelamento_nao_cumprido" integer DEFAULT 2,
    "acionamento_juridico_anterior" integer DEFAULT 3,
    "reincidencia_valor_alto" integer DEFAULT 5,
    "limite_risco_baixo" integer DEFAULT 2,
    "limite_risco_moderado" integer DEFAULT 5,
    "limite_risco_critico" integer DEFAULT 6,
    "valor_minimo_reincidencia" numeric DEFAULT 1500.00,
    "max_alertas_por_dia" integer DEFAULT 5,
    "max_acoes_automaticas_semana" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracao_risco" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracao_score" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "pesos" "jsonb" DEFAULT '{"atraso_medio": 25, "reincidencia": 20, "ocorrencias_90_dias": 25, "tempo_regularizacao": 15, "comparecimento_reunioes": 15}'::"jsonb" NOT NULL,
    "limites" "jsonb" DEFAULT '{"score_alto_risco": 0, "score_baixo_risco": 80, "score_medio_risco": 50}'::"jsonb" NOT NULL,
    "criterios_pontuacao" "jsonb" DEFAULT '{"ocorrencias": {"ate_1": 10, "acima_4": 0, "de_2_a_3": 5}, "atraso_medio": {"ate_3_dias": 10, "acima_10_dias": 0, "de_4_a_10_dias": 5}, "regularizacao": {"ate_3_dias": 10, "acima_8_dias": 0, "de_4_a_7_dias": 5}, "comparecimento": {"faltou_1": 5, "todas_reunioes": 10, "faltou_2_ou_mais": 0}}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracao_score" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_cobranca" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "percentual_multa" numeric DEFAULT 2.0,
    "percentual_juros_dia" numeric DEFAULT 0.033,
    "dia_disparo_mensal" integer DEFAULT 15,
    "tempo_tolerancia_dias" integer DEFAULT 3,
    "texto_padrao_mensagem" "text" DEFAULT 'Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? {{link_negociacao}}

_Esta é uma mensagem automática do sistema de cobrança._'::"text",
    "link_base_agendamento" "text" DEFAULT 'https://calendly.com/sua-empresa/negociacao'::"text",
    "canal_envio" "text" DEFAULT 'whatsapp'::"text",
    "modo_debug" boolean DEFAULT false,
    "ultima_data_importacao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "configuracoes_cobranca_canal_envio_check" CHECK (("canal_envio" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'ambos'::"text"])))
);


ALTER TABLE "public"."configuracoes_cobranca" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracoes_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "tipo_valor" "text" DEFAULT 'string'::"text",
    "descricao" "text",
    "categoria" "text" DEFAULT 'sistema'::"text",
    "editavel" boolean DEFAULT true,
    "nivel_permissao_minimo" "text" DEFAULT 'admin_master'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "configuracoes_sistema_categoria_check" CHECK (("categoria" = ANY (ARRAY['cobranca'::"text", 'sistema'::"text", 'integracao'::"text", 'seguranca'::"text"]))),
    CONSTRAINT "configuracoes_sistema_tipo_valor_check" CHECK (("tipo_valor" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'json'::"text"])))
);


ALTER TABLE "public"."configuracoes_sistema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."criterios_juridico" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "valor_minimo_acionamento" numeric DEFAULT 5000.00,
    "dias_sem_retorno_limite" integer DEFAULT 15,
    "quantidade_cobrancas_ignoradas" integer DEFAULT 3,
    "score_minimo_acionamento" integer DEFAULT 0,
    "meses_reincidencia_limite" integer DEFAULT 6,
    "prazo_resposta_notificacao_dias" integer DEFAULT 5,
    "template_notificacao_extrajudicial" "text" DEFAULT 'Prezado(a) {{nome_franqueado}},

Consta em nosso sistema pendência financeira com vencimento superior a {{dias_em_aberto}} dias, no valor de R$ {{valor_total}}.

Esta notificação extrajudicial visa formalizar a ciência da dívida e informar que, caso não haja manifestação no prazo de {{prazo_resposta}} dias úteis, serão adotadas providências legais previstas em contrato.

Dados da Pendência:
- Código da Unidade: {{codigo_unidade}}
- Valor Total em Aberto: R$ {{valor_total}}
- Data de Vencimento mais Antiga: {{data_vencimento_antiga}}
- Motivo do Acionamento: {{motivo_acionamento}}

Para regularização imediata, entre em contato através dos canais oficiais ou acesse sua central de cobrança.

Atenciosamente,
Setor Jurídico – Cresci e Perdi'::"text",
    "email_responsavel_juridico" "text" DEFAULT 'juridico@crescieperdi.com'::"text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."criterios_juridico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."criterios_priorizacao" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "valor_minimo_alta_prioridade" numeric DEFAULT 5000.00,
    "peso_valor_em_aberto" integer DEFAULT 40,
    "peso_tempo_inadimplencia" integer DEFAULT 30,
    "peso_multiplicidade_debitos" integer DEFAULT 15,
    "peso_tipo_debito" "jsonb" DEFAULT '{"multa": 15, "outros": 5, "aluguel": 20, "insumos": 10, "royalties": 25}'::"jsonb",
    "peso_status_unidade" "jsonb" DEFAULT '{"acordo": 0, "critica": 25, "negociacao": 5, "ativa_atraso": 15}'::"jsonb",
    "dias_nivel_1" integer DEFAULT 5,
    "dias_nivel_2" integer DEFAULT 15,
    "dias_nivel_3" integer DEFAULT 30,
    "dias_nivel_4" integer DEFAULT 45,
    "dias_nivel_5" integer DEFAULT 60,
    "max_tentativas_por_nivel" integer DEFAULT 3,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."criterios_priorizacao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_gerados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_documento" "public"."tipo_documento_enum" NOT NULL,
    "titulo_id" "uuid",
    "unidade_id" "uuid",
    "conteudo_html" "text" NOT NULL,
    "arquivo_pdf_url" "text",
    "data_criacao" timestamp with time zone DEFAULT "now"(),
    "gerado_por" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documentos_gerados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalonamentos_cobranca" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text",
    "data_escalonamento" timestamp with time zone DEFAULT "now"(),
    "motivo_escalonamento" "text" NOT NULL,
    "enviado_para" "text" DEFAULT 'juridico@franquia.com'::"text",
    "nivel" "public"."nivel_escalonamento_enum" DEFAULT 'juridico'::"public"."nivel_escalonamento_enum",
    "documento_gerado" boolean DEFAULT false,
    "responsavel_designado" "text",
    "status" "public"."status_escalonamento_enum" DEFAULT 'pendente'::"public"."status_escalonamento_enum",
    "valor_total_envolvido" numeric DEFAULT 0,
    "quantidade_titulos" integer DEFAULT 1,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."escalonamentos_cobranca" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos_risco" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "tipo_evento" "text" NOT NULL,
    "pontos_adicionados" integer NOT NULL,
    "descricao" "text" NOT NULL,
    "titulo_id" "uuid",
    "reuniao_id" "uuid",
    "data_evento" timestamp with time zone DEFAULT "now"(),
    "processado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "eventos_risco_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['atraso'::"text", 'nao_comparecimento'::"text", 'nao_resposta'::"text", 'notificacao'::"text", 'parcelamento_quebrado'::"text", 'acionamento_juridico'::"text", 'reincidencia'::"text"])))
);


ALTER TABLE "public"."eventos_risco" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eventos_score" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text",
    "tipo_evento" "text" NOT NULL,
    "impacto_score" integer DEFAULT 0 NOT NULL,
    "descricao" "text" NOT NULL,
    "data_evento" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "eventos_score_tipo_evento_check" CHECK (("tipo_evento" = ANY (ARRAY['nova_cobranca'::"text", 'pagamento'::"text", 'acordo_quebrado'::"text", 'reuniao_faltou'::"text", 'regularizacao'::"text", 'escalonamento'::"text"])))
);


ALTER TABLE "public"."eventos_score" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."franqueado_unidades" (
    "id" bigint NOT NULL,
    "franqueado_id" "uuid" NOT NULL,
    "unidade_id" "uuid" NOT NULL,
    "ativo" boolean DEFAULT true,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_vinculo" "text"
);


ALTER TABLE "public"."franqueado_unidades" OWNER TO "postgres";


COMMENT ON TABLE "public"."franqueado_unidades" IS 'Tabela de relacionamento many-to-many entre franqueados e unidades - um franqueado pode ter múltiplas unidades';



CREATE SEQUENCE IF NOT EXISTS "public"."franqueado_unidades_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."franqueado_unidades_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."franqueado_unidades_id_seq" OWNED BY "public"."franqueado_unidades"."id";



CREATE TABLE IF NOT EXISTS "public"."franqueados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_completo" "text" NOT NULL,
    "cpf_rnm" "text" NOT NULL,
    "nacionalidade" "text",
    "data_nascimento" "date",
    "tipo_franqueado" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email" character varying(255),
    "telefone" character varying(20),
    "endereco" "text",
    "numero" character varying(20),
    "complemento" "text",
    "bairro" character varying(100),
    "cidade" character varying(100),
    "estado" character varying(100),
    "uf" character varying(2),
    "nocodb_id" integer,
    "data_criacao_nocodb" timestamp with time zone,
    "data_atualizacao_nocodb" timestamp with time zone,
    CONSTRAINT "chk_franqueados_email_format" CHECK ((("email" IS NULL) OR (("email")::"text" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))),
    CONSTRAINT "franqueados_tipo_franqueado_check" CHECK (("tipo_franqueado" = ANY (ARRAY['principal'::"text", 'socio'::"text", 'operador'::"text"])))
);


ALTER TABLE "public"."franqueados" OWNER TO "postgres";


COMMENT ON TABLE "public"."franqueados" IS 'Tabela de franqueados importada do NocoDB - contém dados pessoais e profissionais dos proprietários das unidades';



COMMENT ON COLUMN "public"."franqueados"."cpf_rnm" IS 'CPF ou RNM do franqueado';



COMMENT ON COLUMN "public"."franqueados"."nocodb_id" IS 'ID original do franqueado no NocoDB para referência e sincronização';



CREATE TABLE IF NOT EXISTS "public"."gatilhos_automacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "evento_trigger" "text" NOT NULL,
    "condicoes" "jsonb" DEFAULT '[]'::"jsonb",
    "acoes" "jsonb" DEFAULT '[]'::"jsonb",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "gatilhos_automacao_evento_trigger_check" CHECK (("evento_trigger" = ANY (ARRAY['novo_debito'::"text", 'reuniao_marcada'::"text", 'status_alterado'::"text", 'upload_planilha'::"text", 'escalonamento'::"text"])))
);


ALTER TABLE "public"."gatilhos_automacao" OWNER TO "postgres";


COMMENT ON TABLE "public"."gatilhos_automacao" IS 'Configuração de gatilhos automáticos baseados em eventos';



COMMENT ON COLUMN "public"."gatilhos_automacao"."condicoes" IS 'Condições que devem ser atendidas para disparar o gatilho';



COMMENT ON COLUMN "public"."gatilhos_automacao"."acoes" IS 'Ações a serem executadas quando o gatilho for ativado';



CREATE TABLE IF NOT EXISTS "public"."gatilhos_automaticos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "condicoes" "text"[] NOT NULL,
    "template_id" "uuid" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "prioridade" "public"."prioridade_enum" DEFAULT 'media'::"public"."prioridade_enum" NOT NULL,
    "total_execucoes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gatilhos_automaticos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_aceites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "acordo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "data_aceite" timestamp with time zone NOT NULL,
    "ip_aceite" "text" NOT NULL,
    "user_agent" "text",
    "metodo_aceite" "text" NOT NULL,
    "documento_assinado" "text",
    "testemunhas" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "historico_aceites_metodo_aceite_check" CHECK (("metodo_aceite" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'painel'::"text", 'presencial'::"text"])))
);


ALTER TABLE "public"."historico_aceites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_alteracoes_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campo_alterado" "text" NOT NULL,
    "valor_anterior" "text",
    "valor_novo" "text",
    "usuario" "text" NOT NULL,
    "data_alteracao" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historico_alteracoes_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_disparos_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "gatilho_id" "uuid",
    "cnpj_unidade" "text" NOT NULL,
    "canal_utilizado" "text" NOT NULL,
    "mensagem_enviada" "text" NOT NULL,
    "data_envio" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visualizado" boolean DEFAULT false NOT NULL,
    "data_visualizacao" timestamp with time zone,
    "resultado" "public"."resultado_disparo_enum",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historico_disparos_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_envios_completo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cobranca_id" "uuid" NOT NULL,
    "tipo_envio" character varying(50) NOT NULL,
    "canal" character varying(20) NOT NULL,
    "destinatario" "text" NOT NULL,
    "assunto" "text",
    "mensagem" "text" NOT NULL,
    "usuario" character varying(100) DEFAULT 'Sistema'::character varying,
    "status_envio" character varying(20) DEFAULT 'sucesso'::character varying,
    "erro_detalhes" "text",
    "metadados" "jsonb",
    "data_envio" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "historico_envios_completo_canal_check" CHECK ((("canal")::"text" = ANY ((ARRAY['whatsapp'::character varying, 'email'::character varying, 'sistema'::character varying])::"text"[]))),
    CONSTRAINT "historico_envios_completo_status_envio_check" CHECK ((("status_envio")::"text" = ANY ((ARRAY['sucesso'::character varying, 'falha'::character varying, 'pendente'::character varying])::"text"[]))),
    CONSTRAINT "historico_envios_completo_tipo_envio_check" CHECK ((("tipo_envio")::"text" = ANY ((ARRAY['whatsapp_amigavel'::character varying, 'whatsapp_juridico'::character varying, 'whatsapp_parcelamento'::character varying, 'email_proposta_parcelamento'::character varying, 'email_cobranca_padrao'::character varying, 'email_cobranca_formal'::character varying, 'email_cobranca_urgente'::character varying, 'email_notificacao_extrajudicial'::character varying, 'sistema_escalonamento_juridico'::character varying, 'pre_vencimento_1d'::character varying, 'pre_vencimento_3d'::character varying, 'pre_vencimento_7d'::character varying, 'pos_vencimento_1d'::character varying, 'pos_vencimento_3d'::character varying, 'pos_vencimento_7d'::character varying, 'pos_vencimento_15d'::character varying, 'pos_vencimento_30d'::character varying, 'aviso_debito'::character varying, 'lembrete_pagamento'::character varying, 'notificacao_atraso'::character varying, 'whatsapp_cobranca'::character varying, 'email_cobranca'::character varying, 'sistema_notificacao'::character varying, 'automatico'::character varying])::"text"[])))
);


ALTER TABLE "public"."historico_envios_completo" OWNER TO "postgres";


COMMENT ON TABLE "public"."historico_envios_completo" IS 'Histórico unificado de todos os envios (WhatsApp, Email, Sistema)';



COMMENT ON COLUMN "public"."historico_envios_completo"."cobranca_id" IS 'FK para cobrancas_franqueados(id)';



COMMENT ON COLUMN "public"."historico_envios_completo"."tipo_envio" IS 'Tipo específico do envio';



COMMENT ON COLUMN "public"."historico_envios_completo"."canal" IS 'Canal de comunicação usado';



COMMENT ON COLUMN "public"."historico_envios_completo"."destinatario" IS 'Telefone (WhatsApp) ou Email';



COMMENT ON COLUMN "public"."historico_envios_completo"."assunto" IS 'Assunto do email (NULL para WhatsApp)';



COMMENT ON COLUMN "public"."historico_envios_completo"."metadados" IS 'Dados extras em JSON (valor, dias_atraso, etc.)';



CREATE TABLE IF NOT EXISTS "public"."historico_escalonamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "nivel_anterior" integer NOT NULL,
    "nivel_novo" integer NOT NULL,
    "motivo_escalonamento" "text" NOT NULL,
    "score_anterior" integer DEFAULT 0,
    "score_novo" integer DEFAULT 0,
    "acao_automatica" boolean DEFAULT false,
    "usuario_responsavel" "text",
    "data_escalonamento" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."historico_escalonamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historico_integracoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integracao_id" "uuid",
    "tipo_acao" "text" NOT NULL,
    "status" "text" NOT NULL,
    "payload_envio" "jsonb",
    "resposta_api" "jsonb",
    "erro_detalhes" "text",
    "tempo_resposta" integer,
    "data_execucao" timestamp with time zone DEFAULT "now"(),
    "usuario_responsavel" "text",
    CONSTRAINT "historico_integracoes_status_check" CHECK (("status" = ANY (ARRAY['sucesso'::"text", 'erro'::"text", 'pendente'::"text"])))
);


ALTER TABLE "public"."historico_integracoes" OWNER TO "postgres";


COMMENT ON TABLE "public"."historico_integracoes" IS 'Histórico de execuções e chamadas das integrações';



COMMENT ON COLUMN "public"."historico_integracoes"."payload_envio" IS 'Dados enviados para a integração';



COMMENT ON COLUMN "public"."historico_integracoes"."resposta_api" IS 'Resposta recebida da API externa';



CREATE TABLE IF NOT EXISTS "public"."importacoes_planilha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_importacao" timestamp with time zone DEFAULT "now"(),
    "usuario" "text" NOT NULL,
    "arquivo_nome" "text" NOT NULL,
    "referencia" "text" NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "novos_registros" integer,
    "registros_atualizados" integer,
    "total_registros" integer
);


ALTER TABLE "public"."importacoes_planilha" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integracoes_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "ativo" boolean DEFAULT true,
    "configuracoes" "jsonb" DEFAULT '{}'::"jsonb",
    "status_conexao" "text" DEFAULT 'falha'::"text",
    "ultima_verificacao" timestamp with time zone,
    "ultima_sincronizacao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "integracoes_config_status_conexao_check" CHECK (("status_conexao" = ANY (ARRAY['conectado'::"text", 'alerta'::"text", 'falha'::"text"]))),
    CONSTRAINT "integracoes_config_tipo_check" CHECK (("tipo" = ANY (ARRAY['supabase'::"text", 'n8n'::"text", 'whatsapp'::"text", 'email'::"text", 'notion'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."integracoes_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."integracoes_config" IS 'Configurações das integrações externas do sistema';



COMMENT ON COLUMN "public"."integracoes_config"."configuracoes" IS 'Configurações específicas de cada tipo de integração em formato JSON';



CREATE TABLE IF NOT EXISTS "public"."juridico_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "data_acao" timestamp with time zone DEFAULT "now"(),
    "tipo_acao" "text" NOT NULL,
    "motivo_acionamento" "public"."motivo_acionamento_enum" NOT NULL,
    "valor_em_aberto" numeric DEFAULT 0 NOT NULL,
    "responsavel" "text" NOT NULL,
    "documento_gerado_url" "text",
    "observacoes" "text",
    "status_anterior" "public"."juridico_status_enum",
    "status_novo" "public"."juridico_status_enum",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."juridico_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs_envio_email" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destinatario" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "sucesso" boolean NOT NULL,
    "message_id" "text",
    "erro_detalhes" "text",
    "data_envio" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cobranca_id" "uuid"
);


ALTER TABLE "public"."logs_envio_email" OWNER TO "postgres";


COMMENT ON COLUMN "public"."logs_envio_email"."cobranca_id" IS 'ID da cobrança relacionada para vincular emails de cobrança';



CREATE TABLE IF NOT EXISTS "public"."logs_envio_whatsapp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destinatario" "text" NOT NULL,
    "mensagem_enviada" "text",
    "instancia_evolution" "text",
    "sucesso" boolean NOT NULL,
    "evolution_message_id" "text",
    "erro_detalhes" "text",
    "data_envio" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cobranca_id" "uuid"
);


ALTER TABLE "public"."logs_envio_whatsapp" OWNER TO "postgres";


COMMENT ON COLUMN "public"."logs_envio_whatsapp"."cobranca_id" IS 'ID da cobrança relacionada para vincular mensagens WhatsApp';



CREATE TABLE IF NOT EXISTS "public"."logs_integracoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "integracao_nome" "text" NOT NULL,
    "acao" "text" NOT NULL,
    "usuario" "text" NOT NULL,
    "dados_anteriores" "jsonb",
    "dados_novos" "jsonb",
    "ip_origem" "text",
    "data_acao" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs_integracoes" OWNER TO "postgres";


COMMENT ON TABLE "public"."logs_integracoes" IS 'Logs de alterações nas configurações de integrações';



CREATE TABLE IF NOT EXISTS "public"."logs_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "text" NOT NULL,
    "acao" "text" NOT NULL,
    "tabela_afetada" "text",
    "registro_id" "text",
    "dados_anteriores" "jsonb",
    "dados_novos" "jsonb",
    "ip_origem" "text",
    "user_agent" "text",
    "data_acao" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs_sistema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacoes_extrajudiciais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "tipo_notificacao" "public"."tipo_notificacao_juridica_enum" DEFAULT 'extrajudicial'::"public"."tipo_notificacao_juridica_enum" NOT NULL,
    "data_envio" timestamp with time zone DEFAULT "now"(),
    "destinatario_email" "text",
    "destinatario_whatsapp" "text",
    "conteudo_notificacao" "text" NOT NULL,
    "documento_pdf_url" "text",
    "status_envio" "text" DEFAULT 'pendente'::"text",
    "data_prazo_resposta" timestamp with time zone,
    "respondido" boolean DEFAULT false,
    "data_resposta" timestamp with time zone,
    "observacoes_resposta" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notificacoes_extrajudiciais_status_envio_check" CHECK (("status_envio" = ANY (ARRAY['pendente'::"text", 'enviado'::"text", 'entregue'::"text", 'falha'::"text"])))
);


ALTER TABLE "public"."notificacoes_extrajudiciais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operacoes_manuais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo_operacao" "public"."tipo_operacao_manual_enum" NOT NULL,
    "usuario" "text" NOT NULL,
    "data_operacao" timestamp with time zone DEFAULT "now"(),
    "cnpj_unidade" "text" NOT NULL,
    "titulo_id" "uuid",
    "dados_anteriores" "jsonb" DEFAULT '{}'::"jsonb",
    "dados_novos" "jsonb" DEFAULT '{}'::"jsonb",
    "justificativa" "text" NOT NULL,
    "aprovado_por" "text",
    "ip_origem" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operacoes_manuais" OWNER TO "postgres";


COMMENT ON TABLE "public"."operacoes_manuais" IS 'Log de todas as operações manuais realizadas no sistema';



COMMENT ON COLUMN "public"."operacoes_manuais"."tipo_operacao" IS 'Tipo da operação manual realizada';



COMMENT ON COLUMN "public"."operacoes_manuais"."usuario" IS 'Usuário que realizou a operação';



COMMENT ON COLUMN "public"."operacoes_manuais"."dados_anteriores" IS 'Estado anterior dos dados (para auditoria)';



COMMENT ON COLUMN "public"."operacoes_manuais"."dados_novos" IS 'Novos dados inseridos/alterados';



COMMENT ON COLUMN "public"."operacoes_manuais"."justificativa" IS 'Justificativa obrigatória para a operação';



COMMENT ON COLUMN "public"."operacoes_manuais"."aprovado_por" IS 'Usuário que aprovou a operação (se necessário)';



CREATE TABLE IF NOT EXISTS "public"."parcelas_acordo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "acordo_id" "uuid" NOT NULL,
    "numero_parcela" integer NOT NULL,
    "valor_parcela" numeric NOT NULL,
    "data_vencimento" "date" NOT NULL,
    "data_pagamento" timestamp with time zone,
    "valor_pago" numeric,
    "status_parcela" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "boleto_url" "text",
    "boleto_codigo" "text",
    "dias_atraso" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parcelas_acordo_status_parcela_check" CHECK (("status_parcela" = ANY (ARRAY['pendente'::"text", 'pago'::"text", 'atrasado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."parcelas_acordo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pontuacao_risco_unidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "pontuacao_atual" integer DEFAULT 0,
    "nivel_risco" "text" DEFAULT 'baixo'::"text",
    "historico_pontos" "jsonb" DEFAULT '[]'::"jsonb",
    "alertas_ativos" "jsonb" DEFAULT '[]'::"jsonb",
    "ultima_atualizacao" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pontuacao_risco_unidades_nivel_risco_check" CHECK (("nivel_risco" = ANY (ARRAY['baixo'::"text", 'moderado'::"text", 'critico'::"text"])))
);


ALTER TABLE "public"."pontuacao_risco_unidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."priorizacao_unidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "codigo_unidade" "text",
    "nome_franqueado" "text" NOT NULL,
    "score_priorizacao" integer DEFAULT 0,
    "nivel_escalonamento" integer DEFAULT 1,
    "valor_total_em_aberto" numeric DEFAULT 0,
    "dias_inadimplencia_max" integer DEFAULT 0,
    "quantidade_debitos" integer DEFAULT 0,
    "tipos_debito" "text"[] DEFAULT '{}'::"text"[],
    "status_unidade" "text" DEFAULT 'ativa_atraso'::"text",
    "tentativas_contato_nivel" integer DEFAULT 0,
    "data_ultimo_contato" timestamp with time zone,
    "data_proximo_escalonamento" timestamp with time zone,
    "observacoes_priorizacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "priorizacao_unidades_nivel_escalonamento_check" CHECK ((("nivel_escalonamento" >= 1) AND ("nivel_escalonamento" <= 5))),
    CONSTRAINT "priorizacao_unidades_status_unidade_check" CHECK (("status_unidade" = ANY (ARRAY['critica'::"text", 'ativa_atraso'::"text", 'negociacao'::"text", 'acordo'::"text"])))
);


ALTER TABLE "public"."priorizacao_unidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."propostas_parcelamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "simulacao_id" "uuid" NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "mensagem_proposta" "text" NOT NULL,
    "canais_envio" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "data_envio" timestamp with time zone,
    "enviado_por" "text" NOT NULL,
    "status_proposta" "public"."status_proposta_enum" DEFAULT 'enviada'::"public"."status_proposta_enum" NOT NULL,
    "data_expiracao" timestamp with time zone NOT NULL,
    "aceito_em" timestamp with time zone,
    "aceito_por" "text",
    "ip_aceite" "text",
    "observacoes_aceite" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."propostas_parcelamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registros_aceite_parcelamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposta_id" "uuid" NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "data_aceite" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_aceite" "text" NOT NULL,
    "user_agent" "text",
    "metodo_aceite" "public"."metodo_aceite_enum" NOT NULL,
    "dados_proposta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."registros_aceite_parcelamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorios_mensais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referencia_mes" "text" NOT NULL,
    "dados_consolidados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "url_pdf" "text",
    "url_xlsx" "text",
    "gerado_em" timestamp with time zone DEFAULT "now"(),
    "gerado_por" "text" NOT NULL,
    "enviado_para" "text"[],
    "status_envio" "public"."status_envio_relatorio_enum" DEFAULT 'gerado'::"public"."status_envio_relatorio_enum",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorios_mensais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reunioes_juridico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unidade_id_fk" "uuid" NOT NULL,
    "escalonamento_id_fk" "uuid",
    "status" "text" DEFAULT 'convite_enviado'::"text" NOT NULL,
    "link_calendly" "text",
    "data_hora_reuniao" timestamp with time zone,
    "presenca_franqueado" boolean,
    "tratativas_acordadas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reunioes_juridico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reunioes_negociacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "uuid",
    "cnpj_unidade" "text",
    "codigo_unidade" "text",
    "data_agendada" timestamp with time zone NOT NULL,
    "data_realizada" timestamp with time zone,
    "status_reuniao" "public"."status_reuniao_enum" DEFAULT 'agendada'::"public"."status_reuniao_enum",
    "responsavel_reuniao" "text" NOT NULL,
    "resumo_resultado" "text",
    "decisao_final" "public"."decisao_reuniao_enum",
    "disparo_aviso" boolean DEFAULT false,
    "link_reuniao" "text",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reunioes_negociacao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_risco_unidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "score_atual" integer DEFAULT 0 NOT NULL,
    "nivel_risco" "text" DEFAULT 'alto'::"text" NOT NULL,
    "componentes_score" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "historico_score" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ultima_atualizacao" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "score_range" CHECK ((("score_atual" >= 0) AND ("score_atual" <= 100))),
    CONSTRAINT "score_risco_unidades_nivel_risco_check" CHECK (("nivel_risco" = ANY (ARRAY['baixo'::"text", 'medio'::"text", 'alto'::"text"])))
);


ALTER TABLE "public"."score_risco_unidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessoes_usuario" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid",
    "token_sessao" "text" NOT NULL,
    "ip_origem" "text",
    "user_agent" "text",
    "data_inicio" timestamp with time zone DEFAULT "now"(),
    "data_ultimo_acesso" timestamp with time zone DEFAULT "now"(),
    "ativa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessoes_usuario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simulacoes_parcelamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "cnpj_unidade" "text" NOT NULL,
    "valor_original" numeric DEFAULT 0 NOT NULL,
    "valor_atualizado" numeric DEFAULT 0 NOT NULL,
    "quantidade_parcelas" integer DEFAULT 2 NOT NULL,
    "valor_entrada" numeric DEFAULT 0,
    "percentual_juros_parcela" numeric DEFAULT 3.0 NOT NULL,
    "data_primeira_parcela" "date" NOT NULL,
    "parcelas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "valor_total_parcelamento" numeric DEFAULT 0 NOT NULL,
    "economia_total" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "percentual_juros_mora" numeric DEFAULT 1.5,
    "percentual_multa" numeric DEFAULT '10'::numeric
);


ALTER TABLE "public"."simulacoes_parcelamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates_juridicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo_debito" "public"."tipo_debito_enum" NOT NULL,
    "categoria" "public"."categoria_template_enum" NOT NULL,
    "corpo_mensagem" "text" NOT NULL,
    "canal_envio" "public"."canal_envio_enum" DEFAULT 'email'::"public"."canal_envio_enum" NOT NULL,
    "prazo_resposta_dias" integer DEFAULT 15 NOT NULL,
    "acoes_apos_resposta" "text"[],
    "anexo_documento_url" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "total_disparos" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."templates_juridicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tratativas_cobranca" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "uuid" NOT NULL,
    "data_interacao" timestamp with time zone DEFAULT "now"(),
    "tipo_interacao" "public"."tipo_interacao_enum" NOT NULL,
    "canal" "public"."canal_interacao_enum" DEFAULT 'interno'::"public"."canal_interacao_enum" NOT NULL,
    "usuario_sistema" "text" DEFAULT 'sistema'::"text" NOT NULL,
    "descricao" "text" NOT NULL,
    "status_cobranca_resultante" "text",
    "anexos" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tratativas_cobranca" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unidades_franqueadas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_unidade" "text",
    "codigo_interno" "text",
    "nome_unidade" "text",
    "cidade" "text",
    "estado" "text",
    "endereco_completo" "text",
    "status_unidade" "text",
    "observacoes_unidade" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "juridico_status" "public"."juridico_status_enum" DEFAULT 'regular'::"public"."juridico_status_enum",
    "data_ultimo_acionamento" timestamp with time zone,
    "observacoes_juridicas" "text",
    "telefone_unidade" "text",
    "email_unidade" "text",
    "instagram_unidade" "text",
    "horario_seg_sex" "text" DEFAULT ''::"text",
    "horario_sabado" "text" DEFAULT ''::"text",
    "horario_domingo" "text" DEFAULT ''::"text",
    "endereco_uf" "text",
    "nocodb_id" integer,
    "data_criacao_nocodb" timestamp with time zone,
    "data_atualizacao_nocodb" timestamp with time zone,
    "cep" "text"
);


ALTER TABLE "public"."unidades_franqueadas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."unidades_franqueadas"."codigo_unidade" IS 'Código da unidade para sincronização';



COMMENT ON COLUMN "public"."unidades_franqueadas"."codigo_interno" IS 'CNPJ da unidade';



COMMENT ON COLUMN "public"."unidades_franqueadas"."nome_unidade" IS 'Nome da unidade';



COMMENT ON COLUMN "public"."unidades_franqueadas"."instagram_unidade" IS 'Instagram da unidade';



COMMENT ON COLUMN "public"."unidades_franqueadas"."endereco_uf" IS 'UF da unidade';



COMMENT ON COLUMN "public"."unidades_franqueadas"."nocodb_id" IS 'ID original da unidade no NocoDB para referência e sincronização';



CREATE TABLE IF NOT EXISTS "public"."usuarios_sistema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_completo" "text" NOT NULL,
    "email" "text" NOT NULL,
    "telefone" "text",
    "cargo" "text",
    "codigo_unidade_vinculada" "text",
    "vinculo_multifranqueado" "text",
    "nivel_permissao" "text" DEFAULT 'observador'::"text" NOT NULL,
    "ativo" boolean DEFAULT true,
    "ultimo_acesso" timestamp with time zone,
    "tentativas_login" integer DEFAULT 0,
    "bloqueado_ate" timestamp with time zone,
    "senha_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "usuarios_sistema_nivel_permissao_check" CHECK (("nivel_permissao" = ANY (ARRAY['admin_master'::"text", 'gestor_juridico'::"text", 'cobranca'::"text", 'analista_financeiro'::"text", 'franqueado'::"text", 'observador'::"text"])))
);


ALTER TABLE "public"."usuarios_sistema" OWNER TO "postgres";


ALTER TABLE ONLY "public"."franqueado_unidades" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."franqueado_unidades_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."acoes_automaticas_log"
    ADD CONSTRAINT "acoes_automaticas_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."acordos_parcelamento"
    ADD CONSTRAINT "acordos_parcelamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alertas_sistema"
    ADD CONSTRAINT "alertas_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cobrancas_franqueados"
    ADD CONSTRAINT "cobrancas_franqueados_linha_referencia_importada_key" UNIQUE ("linha_referencia_importada");



ALTER TABLE ONLY "public"."cobrancas_franqueados"
    ADD CONSTRAINT "cobrancas_franqueados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracao_acordos"
    ADD CONSTRAINT "configuracao_acordos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracao_email"
    ADD CONSTRAINT "configuracao_email_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracao_parcelamento"
    ADD CONSTRAINT "configuracao_parcelamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracao_risco"
    ADD CONSTRAINT "configuracao_risco_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracao_score"
    ADD CONSTRAINT "configuracao_score_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_cobranca"
    ADD CONSTRAINT "configuracoes_cobranca_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracoes_sistema"
    ADD CONSTRAINT "configuracoes_sistema_chave_key" UNIQUE ("chave");



ALTER TABLE ONLY "public"."configuracoes_sistema"
    ADD CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."criterios_juridico"
    ADD CONSTRAINT "criterios_juridico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."criterios_priorizacao"
    ADD CONSTRAINT "criterios_priorizacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_gerados"
    ADD CONSTRAINT "documentos_gerados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalonamentos_cobranca"
    ADD CONSTRAINT "escalonamentos_cobranca_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_risco"
    ADD CONSTRAINT "eventos_risco_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_score"
    ADD CONSTRAINT "eventos_score_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franqueado_unidades"
    ADD CONSTRAINT "franqueado_unidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franqueados"
    ADD CONSTRAINT "franqueados_nocodb_id_key" UNIQUE ("nocodb_id");



ALTER TABLE ONLY "public"."franqueados"
    ADD CONSTRAINT "franqueados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gatilhos_automacao"
    ADD CONSTRAINT "gatilhos_automacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gatilhos_automaticos"
    ADD CONSTRAINT "gatilhos_automaticos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_aceites"
    ADD CONSTRAINT "historico_aceites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_alteracoes_config"
    ADD CONSTRAINT "historico_alteracoes_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_disparos_templates"
    ADD CONSTRAINT "historico_disparos_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_envios_completo"
    ADD CONSTRAINT "historico_envios_completo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_escalonamento"
    ADD CONSTRAINT "historico_escalonamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historico_integracoes"
    ADD CONSTRAINT "historico_integracoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."importacoes_planilha"
    ADD CONSTRAINT "importacoes_planilha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integracoes_config"
    ADD CONSTRAINT "integracoes_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."juridico_log"
    ADD CONSTRAINT "juridico_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_envio_email"
    ADD CONSTRAINT "logs_envio_email_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_envio_whatsapp"
    ADD CONSTRAINT "logs_envio_whatsapp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_integracoes"
    ADD CONSTRAINT "logs_integracoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_sistema"
    ADD CONSTRAINT "logs_sistema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificacoes_extrajudiciais"
    ADD CONSTRAINT "notificacoes_extrajudiciais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operacoes_manuais"
    ADD CONSTRAINT "operacoes_manuais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcelas_acordo"
    ADD CONSTRAINT "parcelas_acordo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pontuacao_risco_unidades"
    ADD CONSTRAINT "pontuacao_risco_unidades_cnpj_unidade_key" UNIQUE ("cnpj_unidade");



ALTER TABLE ONLY "public"."pontuacao_risco_unidades"
    ADD CONSTRAINT "pontuacao_risco_unidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."priorizacao_unidades"
    ADD CONSTRAINT "priorizacao_unidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."propostas_parcelamento"
    ADD CONSTRAINT "propostas_parcelamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registros_aceite_parcelamento"
    ADD CONSTRAINT "registros_aceite_parcelamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorios_mensais"
    ADD CONSTRAINT "relatorios_mensais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reunioes_juridico"
    ADD CONSTRAINT "reunioes_juridico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reunioes_negociacao"
    ADD CONSTRAINT "reunioes_negociacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_risco_unidades"
    ADD CONSTRAINT "score_risco_unidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessoes_usuario"
    ADD CONSTRAINT "sessoes_usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessoes_usuario"
    ADD CONSTRAINT "sessoes_usuario_token_sessao_key" UNIQUE ("token_sessao");



ALTER TABLE ONLY "public"."simulacoes_parcelamento"
    ADD CONSTRAINT "simulacoes_parcelamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates_juridicos"
    ADD CONSTRAINT "templates_juridicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tratativas_cobranca"
    ADD CONSTRAINT "tratativas_cobranca_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franqueado_unidades"
    ADD CONSTRAINT "uk_franqueado_unidade_ativo" UNIQUE ("franqueado_id", "unidade_id", "ativo");



ALTER TABLE ONLY "public"."unidades_franqueadas"
    ADD CONSTRAINT "unidades_franqueadas_codigo_unidade_key" UNIQUE ("codigo_unidade");



ALTER TABLE ONLY "public"."unidades_franqueadas"
    ADD CONSTRAINT "unidades_franqueadas_nocodb_id_key" UNIQUE ("nocodb_id");



ALTER TABLE ONLY "public"."unidades_franqueadas"
    ADD CONSTRAINT "unidades_franqueadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuarios_sistema"
    ADD CONSTRAINT "usuarios_sistema_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_aceites_acordo_id" ON "public"."historico_aceites" USING "btree" ("acordo_id");



CREATE INDEX "idx_aceites_cnpj" ON "public"."historico_aceites" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_aceites_data" ON "public"."historico_aceites" USING "btree" ("data_aceite" DESC);



CREATE INDEX "idx_aceites_proposta_id" ON "public"."registros_aceite_parcelamento" USING "btree" ("proposta_id");



CREATE INDEX "idx_aceites_titulo_id" ON "public"."registros_aceite_parcelamento" USING "btree" ("titulo_id");



CREATE INDEX "idx_acoes_automaticas_cnpj" ON "public"."acoes_automaticas_log" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_acoes_automaticas_data" ON "public"."acoes_automaticas_log" USING "btree" ("data_execucao" DESC);



CREATE INDEX "idx_acordos_cnpj" ON "public"."acordos_parcelamento" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_acordos_data" ON "public"."acordos_parcelamento" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_acordos_status" ON "public"."acordos_parcelamento" USING "btree" ("status_acordo");



CREATE INDEX "idx_acordos_titulo_id" ON "public"."acordos_parcelamento" USING "btree" ("titulo_id");



CREATE INDEX "idx_alertas_cnpj" ON "public"."alertas_sistema" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_alertas_resolvido" ON "public"."alertas_sistema" USING "btree" ("resolvido");



CREATE INDEX "idx_alertas_tipo" ON "public"."alertas_sistema" USING "btree" ("tipo_alerta");



CREATE INDEX "idx_cobrancas_cnpj" ON "public"."cobrancas_franqueados" USING "btree" ("cnpj");



CREATE INDEX "idx_cobrancas_cpf" ON "public"."cobrancas_franqueados" USING "btree" ("cpf");



CREATE INDEX "idx_cobrancas_franqueado_fk" ON "public"."cobrancas_franqueados" USING "btree" ("franqueado_id_fk");



CREATE UNIQUE INDEX "idx_cobrancas_hash_titulo" ON "public"."cobrancas_franqueados" USING "btree" ("hash_titulo") WHERE ("hash_titulo" IS NOT NULL);



CREATE INDEX "idx_cobrancas_referencia" ON "public"."cobrancas_franqueados" USING "btree" ("referencia_importacao");



CREATE INDEX "idx_cobrancas_status" ON "public"."cobrancas_franqueados" USING "btree" ("status");



CREATE INDEX "idx_cobrancas_unidade_fk" ON "public"."cobrancas_franqueados" USING "btree" ("unidade_id_fk");



CREATE INDEX "idx_cobrancas_vencimento" ON "public"."cobrancas_franqueados" USING "btree" ("data_vencimento");



CREATE INDEX "idx_configuracoes_id" ON "public"."configuracoes_cobranca" USING "btree" ("id");



CREATE INDEX "idx_configuracoes_sistema_categoria" ON "public"."configuracoes_sistema" USING "btree" ("categoria");



CREATE INDEX "idx_configuracoes_sistema_chave" ON "public"."configuracoes_sistema" USING "btree" ("chave");



CREATE INDEX "idx_documentos_data_criacao" ON "public"."documentos_gerados" USING "btree" ("data_criacao" DESC);



CREATE INDEX "idx_documentos_tipo" ON "public"."documentos_gerados" USING "btree" ("tipo_documento");



CREATE INDEX "idx_documentos_titulo_id" ON "public"."documentos_gerados" USING "btree" ("titulo_id");



CREATE INDEX "idx_documentos_unidade_id" ON "public"."documentos_gerados" USING "btree" ("unidade_id");



CREATE INDEX "idx_escalonamentos_cnpj" ON "public"."escalonamentos_cobranca" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_escalonamentos_data" ON "public"."escalonamentos_cobranca" USING "btree" ("data_escalonamento" DESC);



CREATE INDEX "idx_escalonamentos_nivel" ON "public"."escalonamentos_cobranca" USING "btree" ("nivel");



CREATE INDEX "idx_escalonamentos_status" ON "public"."escalonamentos_cobranca" USING "btree" ("status");



CREATE INDEX "idx_escalonamentos_titulo_id" ON "public"."escalonamentos_cobranca" USING "btree" ("titulo_id");



CREATE INDEX "idx_eventos_risco_cnpj" ON "public"."eventos_risco" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_eventos_risco_data" ON "public"."eventos_risco" USING "btree" ("data_evento" DESC);



CREATE INDEX "idx_eventos_risco_tipo" ON "public"."eventos_risco" USING "btree" ("tipo_evento");



CREATE INDEX "idx_eventos_score_cnpj" ON "public"."eventos_score" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_eventos_score_data" ON "public"."eventos_score" USING "btree" ("data_evento" DESC);



CREATE INDEX "idx_franqueado_unidades_ativo" ON "public"."franqueado_unidades" USING "btree" ("ativo");



CREATE INDEX "idx_franqueado_unidades_franqueado" ON "public"."franqueado_unidades" USING "btree" ("franqueado_id");



CREATE INDEX "idx_franqueado_unidades_unidade" ON "public"."franqueado_unidades" USING "btree" ("unidade_id");



CREATE INDEX "idx_franqueados_cpf" ON "public"."franqueados" USING "btree" ("cpf_rnm");



CREATE INDEX "idx_franqueados_cpf_rnm" ON "public"."franqueados" USING "btree" ("cpf_rnm");



CREATE INDEX "idx_franqueados_email" ON "public"."franqueados" USING "btree" ("email");



CREATE INDEX "idx_franqueados_nocodb_id" ON "public"."franqueados" USING "btree" ("nocodb_id");



CREATE INDEX "idx_franqueados_tipo" ON "public"."franqueados" USING "btree" ("tipo_franqueado");



CREATE INDEX "idx_gatilhos_ativo" ON "public"."gatilhos_automaticos" USING "btree" ("ativo");



CREATE INDEX "idx_gatilhos_evento" ON "public"."gatilhos_automacao" USING "btree" ("evento_trigger");



CREATE INDEX "idx_gatilhos_template_id" ON "public"."gatilhos_automaticos" USING "btree" ("template_id");



CREATE INDEX "idx_historico_alteracoes_data" ON "public"."historico_alteracoes_config" USING "btree" ("data_alteracao" DESC);



CREATE INDEX "idx_historico_canal" ON "public"."historico_envios_completo" USING "btree" ("canal");



CREATE INDEX "idx_historico_cnpj" ON "public"."historico_disparos_templates" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_historico_cobranca_id" ON "public"."historico_envios_completo" USING "btree" ("cobranca_id");



CREATE INDEX "idx_historico_data_envio" ON "public"."historico_disparos_templates" USING "btree" ("data_envio" DESC);



CREATE INDEX "idx_historico_data_execucao" ON "public"."historico_integracoes" USING "btree" ("data_execucao" DESC);



CREATE INDEX "idx_historico_escalonamento_cnpj" ON "public"."historico_escalonamento" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_historico_escalonamento_data" ON "public"."historico_escalonamento" USING "btree" ("data_escalonamento" DESC);



CREATE INDEX "idx_historico_integracao_id" ON "public"."historico_integracoes" USING "btree" ("integracao_id");



CREATE INDEX "idx_historico_status" ON "public"."historico_integracoes" USING "btree" ("status");



CREATE INDEX "idx_historico_template_id" ON "public"."historico_disparos_templates" USING "btree" ("template_id");



CREATE INDEX "idx_historico_tipo_envio" ON "public"."historico_envios_completo" USING "btree" ("tipo_envio");



CREATE INDEX "idx_importacoes_data" ON "public"."importacoes_planilha" USING "btree" ("data_importacao" DESC);



CREATE INDEX "idx_importacoes_referencia" ON "public"."importacoes_planilha" USING "btree" ("referencia");



CREATE INDEX "idx_integracoes_status" ON "public"."integracoes_config" USING "btree" ("status_conexao");



CREATE INDEX "idx_integracoes_tipo" ON "public"."integracoes_config" USING "btree" ("tipo");



CREATE INDEX "idx_juridico_log_cnpj" ON "public"."juridico_log" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_juridico_log_data" ON "public"."juridico_log" USING "btree" ("data_acao" DESC);



CREATE INDEX "idx_juridico_log_motivo" ON "public"."juridico_log" USING "btree" ("motivo_acionamento");



CREATE INDEX "idx_logs_email_cobranca_id" ON "public"."logs_envio_email" USING "btree" ("cobranca_id");



CREATE INDEX "idx_logs_email_data_envio" ON "public"."logs_envio_email" USING "btree" ("data_envio" DESC);



CREATE INDEX "idx_logs_email_destinatario" ON "public"."logs_envio_email" USING "btree" ("destinatario");



CREATE INDEX "idx_logs_email_sucesso" ON "public"."logs_envio_email" USING "btree" ("sucesso");



CREATE INDEX "idx_logs_integracoes_data" ON "public"."logs_integracoes" USING "btree" ("data_acao" DESC);



CREATE INDEX "idx_logs_sistema_acao" ON "public"."logs_sistema" USING "btree" ("acao");



CREATE INDEX "idx_logs_sistema_data" ON "public"."logs_sistema" USING "btree" ("data_acao" DESC);



CREATE INDEX "idx_logs_sistema_usuario" ON "public"."logs_sistema" USING "btree" ("usuario_id");



CREATE INDEX "idx_logs_whatsapp_cobranca_id" ON "public"."logs_envio_whatsapp" USING "btree" ("cobranca_id");



CREATE INDEX "idx_logs_whatsapp_data_envio" ON "public"."logs_envio_whatsapp" USING "btree" ("data_envio" DESC);



CREATE INDEX "idx_logs_whatsapp_destinatario" ON "public"."logs_envio_whatsapp" USING "btree" ("destinatario");



CREATE INDEX "idx_logs_whatsapp_sucesso" ON "public"."logs_envio_whatsapp" USING "btree" ("sucesso");



CREATE INDEX "idx_notificacoes_cnpj" ON "public"."notificacoes_extrajudiciais" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_notificacoes_data" ON "public"."notificacoes_extrajudiciais" USING "btree" ("data_envio" DESC);



CREATE INDEX "idx_notificacoes_status" ON "public"."notificacoes_extrajudiciais" USING "btree" ("status_envio");



CREATE INDEX "idx_notificacoes_tipo" ON "public"."notificacoes_extrajudiciais" USING "btree" ("tipo_notificacao");



CREATE INDEX "idx_operacoes_manuais_cnpj" ON "public"."operacoes_manuais" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_operacoes_manuais_data" ON "public"."operacoes_manuais" USING "btree" ("data_operacao" DESC);



CREATE INDEX "idx_operacoes_manuais_tipo" ON "public"."operacoes_manuais" USING "btree" ("tipo_operacao");



CREATE INDEX "idx_operacoes_manuais_titulo_id" ON "public"."operacoes_manuais" USING "btree" ("titulo_id");



CREATE INDEX "idx_operacoes_manuais_usuario" ON "public"."operacoes_manuais" USING "btree" ("usuario");



CREATE INDEX "idx_parcelas_acordo_id" ON "public"."parcelas_acordo" USING "btree" ("acordo_id");



CREATE INDEX "idx_parcelas_status" ON "public"."parcelas_acordo" USING "btree" ("status_parcela");



CREATE INDEX "idx_parcelas_vencimento" ON "public"."parcelas_acordo" USING "btree" ("data_vencimento");



CREATE INDEX "idx_pontuacao_risco_cnpj" ON "public"."pontuacao_risco_unidades" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_pontuacao_risco_nivel" ON "public"."pontuacao_risco_unidades" USING "btree" ("nivel_risco");



CREATE INDEX "idx_priorizacao_cnpj" ON "public"."priorizacao_unidades" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_priorizacao_nivel" ON "public"."priorizacao_unidades" USING "btree" ("nivel_escalonamento");



CREATE INDEX "idx_priorizacao_score" ON "public"."priorizacao_unidades" USING "btree" ("score_priorizacao" DESC);



CREATE INDEX "idx_propostas_cnpj" ON "public"."propostas_parcelamento" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_propostas_data" ON "public"."propostas_parcelamento" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_propostas_simulacao_id" ON "public"."propostas_parcelamento" USING "btree" ("simulacao_id");



CREATE INDEX "idx_propostas_status" ON "public"."propostas_parcelamento" USING "btree" ("status_proposta");



CREATE INDEX "idx_propostas_titulo_id" ON "public"."propostas_parcelamento" USING "btree" ("titulo_id");



CREATE INDEX "idx_relatorios_gerado_em" ON "public"."relatorios_mensais" USING "btree" ("gerado_em" DESC);



CREATE INDEX "idx_relatorios_referencia" ON "public"."relatorios_mensais" USING "btree" ("referencia_mes");



CREATE INDEX "idx_relatorios_status" ON "public"."relatorios_mensais" USING "btree" ("status_envio");



CREATE INDEX "idx_reunioes_cnpj" ON "public"."reunioes_negociacao" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_reunioes_data_agendada" ON "public"."reunioes_negociacao" USING "btree" ("data_agendada");



CREATE INDEX "idx_reunioes_responsavel" ON "public"."reunioes_negociacao" USING "btree" ("responsavel_reuniao");



CREATE INDEX "idx_reunioes_status" ON "public"."reunioes_negociacao" USING "btree" ("status_reuniao");



CREATE INDEX "idx_reunioes_titulo_id" ON "public"."reunioes_negociacao" USING "btree" ("titulo_id");



CREATE INDEX "idx_score_cnpj" ON "public"."score_risco_unidades" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_score_nivel" ON "public"."score_risco_unidades" USING "btree" ("nivel_risco");



CREATE INDEX "idx_score_valor" ON "public"."score_risco_unidades" USING "btree" ("score_atual");



CREATE INDEX "idx_sessoes_usuario_ativa" ON "public"."sessoes_usuario" USING "btree" ("ativa");



CREATE INDEX "idx_sessoes_usuario_token" ON "public"."sessoes_usuario" USING "btree" ("token_sessao");



CREATE INDEX "idx_simulacoes_cnpj" ON "public"."simulacoes_parcelamento" USING "btree" ("cnpj_unidade");



CREATE INDEX "idx_simulacoes_data" ON "public"."simulacoes_parcelamento" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_simulacoes_titulo_id" ON "public"."simulacoes_parcelamento" USING "btree" ("titulo_id");



CREATE INDEX "idx_templates_ativo" ON "public"."templates_juridicos" USING "btree" ("ativo");



CREATE INDEX "idx_templates_categoria" ON "public"."templates_juridicos" USING "btree" ("categoria");



CREATE INDEX "idx_templates_tipo_debito" ON "public"."templates_juridicos" USING "btree" ("tipo_debito");



CREATE INDEX "idx_tratativas_canal" ON "public"."tratativas_cobranca" USING "btree" ("canal");



CREATE INDEX "idx_tratativas_data_interacao" ON "public"."tratativas_cobranca" USING "btree" ("data_interacao" DESC);



CREATE INDEX "idx_tratativas_status" ON "public"."tratativas_cobranca" USING "btree" ("status_cobranca_resultante");



CREATE INDEX "idx_tratativas_tipo" ON "public"."tratativas_cobranca" USING "btree" ("tipo_interacao");



CREATE INDEX "idx_tratativas_titulo_id" ON "public"."tratativas_cobranca" USING "btree" ("titulo_id");



CREATE INDEX "idx_unidades_codigo" ON "public"."unidades_franqueadas" USING "btree" ("codigo_unidade");



CREATE INDEX "idx_unidades_codigo_interno_new" ON "public"."unidades_franqueadas" USING "btree" ("codigo_interno");



CREATE INDEX "idx_unidades_endereco_cidade" ON "public"."unidades_franqueadas" USING "btree" ("cidade");



CREATE INDEX "idx_unidades_endereco_uf" ON "public"."unidades_franqueadas" USING "btree" ("endereco_uf");



CREATE INDEX "idx_unidades_estado" ON "public"."unidades_franqueadas" USING "btree" ("estado");



CREATE INDEX "idx_unidades_juridico_status" ON "public"."unidades_franqueadas" USING "btree" ("juridico_status");



CREATE INDEX "idx_unidades_nocodb_id" ON "public"."unidades_franqueadas" USING "btree" ("nocodb_id");



CREATE INDEX "idx_unidades_status" ON "public"."unidades_franqueadas" USING "btree" ("status_unidade");



CREATE INDEX "idx_usuarios_sistema_ativo" ON "public"."usuarios_sistema" USING "btree" ("ativo");



CREATE INDEX "idx_usuarios_sistema_email" ON "public"."usuarios_sistema" USING "btree" ("email");



CREATE INDEX "idx_usuarios_sistema_nivel" ON "public"."usuarios_sistema" USING "btree" ("nivel_permissao");



CREATE OR REPLACE TRIGGER "increment_disparos_counter" AFTER INSERT ON "public"."historico_disparos_templates" FOR EACH ROW EXECUTE FUNCTION "public"."increment_template_disparos"();



CREATE OR REPLACE TRIGGER "trigger_atualizar_campos_calculados" BEFORE INSERT OR UPDATE ON "public"."cobrancas_franqueados" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_campos_calculados"();



CREATE OR REPLACE TRIGGER "trigger_atualizar_cnpj_operacao_manual" BEFORE INSERT OR UPDATE ON "public"."operacoes_manuais" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_cnpj_operacao_manual"();



CREATE OR REPLACE TRIGGER "trigger_atualizar_status_por_tratativa" AFTER INSERT ON "public"."tratativas_cobranca" FOR EACH ROW EXECUTE FUNCTION "public"."atualizar_status_por_tratativa"();



CREATE OR REPLACE TRIGGER "trigger_escalonamento_reunioes" AFTER INSERT OR UPDATE ON "public"."reunioes_negociacao" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_verificar_escalonamento"();



CREATE OR REPLACE TRIGGER "trigger_escalonamento_tratativas" AFTER INSERT OR UPDATE ON "public"."tratativas_cobranca" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_verificar_escalonamento"();



CREATE OR REPLACE TRIGGER "trigger_log_configuracoes_cobranca" AFTER DELETE OR UPDATE ON "public"."configuracoes_cobranca" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_log_automatico"();



CREATE OR REPLACE TRIGGER "trigger_log_usuarios_sistema" AFTER DELETE OR UPDATE ON "public"."usuarios_sistema" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_log_automatico"();



CREATE OR REPLACE TRIGGER "trigger_processar_resultado_reuniao" AFTER UPDATE ON "public"."reunioes_negociacao" FOR EACH ROW WHEN ((("old"."status_reuniao" IS DISTINCT FROM "new"."status_reuniao") OR ("old"."decisao_final" IS DISTINCT FROM "new"."decisao_final"))) EXECUTE FUNCTION "public"."processar_resultado_reuniao"();



CREATE OR REPLACE TRIGGER "trigger_resolver_acionamento_juridico" AFTER UPDATE ON "public"."cobrancas_franqueados" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_resolver_acionamento"();



CREATE OR REPLACE TRIGGER "trigger_risco_cobrancas" AFTER INSERT OR UPDATE ON "public"."cobrancas_franqueados" FOR EACH ROW EXECUTE FUNCTION "public"."processar_evento_risco"();



CREATE OR REPLACE TRIGGER "trigger_risco_reunioes" AFTER INSERT OR UPDATE ON "public"."reunioes_negociacao" FOR EACH ROW EXECUTE FUNCTION "public"."processar_evento_risco"();



CREATE OR REPLACE TRIGGER "trigger_score_acordos" AFTER INSERT OR UPDATE ON "public"."acordos_parcelamento" FOR EACH ROW EXECUTE FUNCTION "public"."processar_evento_score"();



CREATE OR REPLACE TRIGGER "trigger_score_cobrancas" AFTER INSERT OR UPDATE ON "public"."cobrancas_franqueados" FOR EACH ROW EXECUTE FUNCTION "public"."processar_evento_score"();



CREATE OR REPLACE TRIGGER "trigger_score_reunioes" AFTER INSERT OR UPDATE ON "public"."reunioes_negociacao" FOR EACH ROW EXECUTE FUNCTION "public"."processar_evento_score"();



CREATE OR REPLACE TRIGGER "update_acordos_parcelamento_updated_at" BEFORE UPDATE ON "public"."acordos_parcelamento" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_configuracao_acordos_updated_at" BEFORE UPDATE ON "public"."configuracao_acordos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_configuracao_parcelamento_updated_at" BEFORE UPDATE ON "public"."configuracao_parcelamento" FOR EACH ROW EXECUTE FUNCTION "public"."update_parcelamento_updated_at"();



CREATE OR REPLACE TRIGGER "update_configuracao_risco_updated_at" BEFORE UPDATE ON "public"."configuracao_risco" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_configuracao_score_updated_at" BEFORE UPDATE ON "public"."configuracao_score" FOR EACH ROW EXECUTE FUNCTION "public"."update_score_updated_at"();



CREATE OR REPLACE TRIGGER "update_configuracoes_cobranca_updated_at" BEFORE UPDATE ON "public"."configuracoes_cobranca" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_configuracoes_sistema_updated_at" BEFORE UPDATE ON "public"."configuracoes_sistema" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_criterios_juridico_updated_at" BEFORE UPDATE ON "public"."criterios_juridico" FOR EACH ROW EXECUTE FUNCTION "public"."update_juridico_updated_at"();



CREATE OR REPLACE TRIGGER "update_criterios_priorizacao_updated_at" BEFORE UPDATE ON "public"."criterios_priorizacao" FOR EACH ROW EXECUTE FUNCTION "public"."update_priorizacao_updated_at"();



CREATE OR REPLACE TRIGGER "update_documentos_gerados_updated_at" BEFORE UPDATE ON "public"."documentos_gerados" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_escalonamentos_cobranca_updated_at" BEFORE UPDATE ON "public"."escalonamentos_cobranca" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_franqueados_updated_at" BEFORE UPDATE ON "public"."franqueados" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gatilhos_automacao_updated_at" BEFORE UPDATE ON "public"."gatilhos_automacao" FOR EACH ROW EXECUTE FUNCTION "public"."update_integracoes_updated_at"();



CREATE OR REPLACE TRIGGER "update_gatilhos_automaticos_updated_at" BEFORE UPDATE ON "public"."gatilhos_automaticos" FOR EACH ROW EXECUTE FUNCTION "public"."update_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_integracoes_config_updated_at" BEFORE UPDATE ON "public"."integracoes_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_integracoes_updated_at"();



CREATE OR REPLACE TRIGGER "update_notificacoes_extrajudiciais_updated_at" BEFORE UPDATE ON "public"."notificacoes_extrajudiciais" FOR EACH ROW EXECUTE FUNCTION "public"."update_juridico_updated_at"();



CREATE OR REPLACE TRIGGER "update_parcelas_acordo_updated_at" BEFORE UPDATE ON "public"."parcelas_acordo" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pontuacao_risco_updated_at" BEFORE UPDATE ON "public"."pontuacao_risco_unidades" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_priorizacao_unidades_updated_at" BEFORE UPDATE ON "public"."priorizacao_unidades" FOR EACH ROW EXECUTE FUNCTION "public"."update_priorizacao_updated_at"();



CREATE OR REPLACE TRIGGER "update_propostas_parcelamento_updated_at" BEFORE UPDATE ON "public"."propostas_parcelamento" FOR EACH ROW EXECUTE FUNCTION "public"."update_parcelamento_updated_at"();



CREATE OR REPLACE TRIGGER "update_relatorios_mensais_updated_at" BEFORE UPDATE ON "public"."relatorios_mensais" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reunioes_negociacao_updated_at" BEFORE UPDATE ON "public"."reunioes_negociacao" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_score_risco_updated_at" BEFORE UPDATE ON "public"."score_risco_unidades" FOR EACH ROW EXECUTE FUNCTION "public"."update_score_updated_at"();



CREATE OR REPLACE TRIGGER "update_simulacoes_parcelamento_updated_at" BEFORE UPDATE ON "public"."simulacoes_parcelamento" FOR EACH ROW EXECUTE FUNCTION "public"."update_parcelamento_updated_at"();



CREATE OR REPLACE TRIGGER "update_templates_juridicos_updated_at" BEFORE UPDATE ON "public"."templates_juridicos" FOR EACH ROW EXECUTE FUNCTION "public"."update_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_unidades_franqueadas_updated_at" BEFORE UPDATE ON "public"."unidades_franqueadas" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_usuarios_sistema_updated_at" BEFORE UPDATE ON "public"."usuarios_sistema" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."acordos_parcelamento"
    ADD CONSTRAINT "acordos_parcelamento_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cobrancas_franqueados"
    ADD CONSTRAINT "cobrancas_franqueados_unidade_id_fk_fkey" FOREIGN KEY ("unidade_id_fk") REFERENCES "public"."unidades_franqueadas"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documentos_gerados"
    ADD CONSTRAINT "documentos_gerados_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_gerados"
    ADD CONSTRAINT "documentos_gerados_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades_franqueadas"("id");



ALTER TABLE ONLY "public"."escalonamentos_cobranca"
    ADD CONSTRAINT "escalonamentos_cobranca_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eventos_risco"
    ADD CONSTRAINT "eventos_risco_reuniao_id_fkey" FOREIGN KEY ("reuniao_id") REFERENCES "public"."reunioes_negociacao"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."eventos_risco"
    ADD CONSTRAINT "eventos_risco_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."franqueado_unidades"
    ADD CONSTRAINT "fk_franqueado_unidades_franqueado" FOREIGN KEY ("franqueado_id") REFERENCES "public"."franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."franqueado_unidades"
    ADD CONSTRAINT "fk_franqueado_unidades_unidade" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades_franqueadas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logs_envio_email"
    ADD CONSTRAINT "fk_logs_email_cobranca_id" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "fk_logs_email_cobranca_id" ON "public"."logs_envio_email" IS 'Foreign Key que garante que cobranca_id referencia uma cobrança válida';



ALTER TABLE ONLY "public"."logs_envio_whatsapp"
    ADD CONSTRAINT "fk_logs_whatsapp_cobranca_id" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "fk_logs_whatsapp_cobranca_id" ON "public"."logs_envio_whatsapp" IS 'Foreign Key que garante que cobranca_id referencia uma cobrança válida';



ALTER TABLE ONLY "public"."operacoes_manuais"
    ADD CONSTRAINT "fk_operacoes_titulo" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cobrancas_franqueados"
    ADD CONSTRAINT "franqueado_id_fk" FOREIGN KEY ("franqueado_id_fk") REFERENCES "public"."franqueados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gatilhos_automaticos"
    ADD CONSTRAINT "gatilhos_automaticos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates_juridicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_aceites"
    ADD CONSTRAINT "historico_aceites_acordo_id_fkey" FOREIGN KEY ("acordo_id") REFERENCES "public"."acordos_parcelamento"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_disparos_templates"
    ADD CONSTRAINT "historico_disparos_templates_gatilho_id_fkey" FOREIGN KEY ("gatilho_id") REFERENCES "public"."gatilhos_automaticos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historico_disparos_templates"
    ADD CONSTRAINT "historico_disparos_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates_juridicos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_envios_completo"
    ADD CONSTRAINT "historico_envios_completo_cobranca_id_fkey" FOREIGN KEY ("cobranca_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historico_integracoes"
    ADD CONSTRAINT "historico_integracoes_integracao_id_fkey" FOREIGN KEY ("integracao_id") REFERENCES "public"."integracoes_config"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parcelas_acordo"
    ADD CONSTRAINT "parcelas_acordo_acordo_id_fkey" FOREIGN KEY ("acordo_id") REFERENCES "public"."acordos_parcelamento"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propostas_parcelamento"
    ADD CONSTRAINT "propostas_parcelamento_simulacao_id_fkey" FOREIGN KEY ("simulacao_id") REFERENCES "public"."simulacoes_parcelamento"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."propostas_parcelamento"
    ADD CONSTRAINT "propostas_parcelamento_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registros_aceite_parcelamento"
    ADD CONSTRAINT "registros_aceite_parcelamento_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reunioes_juridico"
    ADD CONSTRAINT "reunioes_juridico_escalonamento_id_fk_fkey" FOREIGN KEY ("escalonamento_id_fk") REFERENCES "public"."escalonamentos_cobranca"("id");



ALTER TABLE ONLY "public"."reunioes_juridico"
    ADD CONSTRAINT "reunioes_juridico_unidade_id_fk_fkey" FOREIGN KEY ("unidade_id_fk") REFERENCES "public"."unidades_franqueadas"("id");



ALTER TABLE ONLY "public"."reunioes_negociacao"
    ADD CONSTRAINT "reunioes_negociacao_codigo_unidade_fkey" FOREIGN KEY ("codigo_unidade") REFERENCES "public"."unidades_franqueadas"("codigo_unidade");



ALTER TABLE ONLY "public"."reunioes_negociacao"
    ADD CONSTRAINT "reunioes_negociacao_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes_usuario"
    ADD CONSTRAINT "sessoes_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simulacoes_parcelamento"
    ADD CONSTRAINT "simulacoes_parcelamento_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tratativas_cobranca"
    ADD CONSTRAINT "tratativas_cobranca_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."cobrancas_franqueados"("id") ON DELETE CASCADE;



CREATE POLICY "Admin master pode gerenciar configurações" ON "public"."configuracoes_sistema" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_sistema" "u"
  WHERE (("u"."email" = "auth"."email"()) AND ("u"."nivel_permissao" = 'admin_master'::"text") AND ("u"."ativo" = true)))));



CREATE POLICY "Admin master pode ver histórico de alterações" ON "public"."historico_alteracoes_config" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_sistema" "u"
  WHERE (("u"."email" = "auth"."email"()) AND ("u"."nivel_permissao" = 'admin_master'::"text") AND ("u"."ativo" = true)))));



CREATE POLICY "Admin master pode ver todos os logs" ON "public"."logs_sistema" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_sistema" "u"
  WHERE (("u"."email" = "auth"."email"()) AND ("u"."nivel_permissao" = 'admin_master'::"text") AND ("u"."ativo" = true)))));



CREATE POLICY "Admins can manage aceites" ON "public"."historico_aceites" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage acordos" ON "public"."acordos_parcelamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage config acordos" ON "public"."configuracao_acordos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage config parcelamento" ON "public"."configuracao_parcelamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage criterios juridico" ON "public"."criterios_juridico" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage criterios priorizacao" ON "public"."criterios_priorizacao" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage gatilhos automacao" ON "public"."gatilhos_automacao" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage historico escalonamento" ON "public"."historico_escalonamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage integracoes config" ON "public"."integracoes_config" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage operacoes manuais" ON "public"."operacoes_manuais" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage parcelas" ON "public"."parcelas_acordo" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage priorizacao unidades" ON "public"."priorizacao_unidades" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage risk config" ON "public"."configuracao_risco" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage risk data" ON "public"."pontuacao_risco_unidades" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage risk events" ON "public"."eventos_risco" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage score config" ON "public"."configuracao_score" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage score data" ON "public"."score_risco_unidades" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage score events" ON "public"."eventos_score" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can manage unidades data" ON "public"."unidades_franqueadas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can update config" ON "public"."configuracoes_cobranca" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins can view email logs" ON "public"."logs_envio_email" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admins can view logs integracoes" ON "public"."logs_integracoes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can manage franqueado_unidades" ON "public"."franqueado_unidades" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can manage franqueados" ON "public"."franqueados" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can read franqueado_unidades" ON "public"."franqueado_unidades" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read franqueados" ON "public"."franqueados" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Diretoria can manage reports" ON "public"."relatorios_mensais" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Franqueados can view own acordos" ON "public"."acordos_parcelamento" FOR SELECT TO "authenticated" USING (("cnpj_unidade" = "current_setting"('app.current_cnpj'::"text", true)));



CREATE POLICY "Franqueados can view own parcelas" ON "public"."parcelas_acordo" FOR SELECT TO "authenticated" USING (("acordo_id" IN ( SELECT "acordos_parcelamento"."id"
   FROM "public"."acordos_parcelamento"
  WHERE ("acordos_parcelamento"."cnpj_unidade" = "current_setting"('app.current_cnpj'::"text", true)))));



CREATE POLICY "Juridico can manage all data" ON "public"."juridico_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Juridico can manage documents" ON "public"."documentos_gerados" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Juridico can manage escalonamentos" ON "public"."escalonamentos_cobranca" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Juridico can manage notificacoes" ON "public"."notificacoes_extrajudiciais" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Jurídico pode gerenciar gatilhos" ON "public"."gatilhos_automaticos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Jurídico pode gerenciar histórico" ON "public"."historico_disparos_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Jurídico pode gerenciar templates" ON "public"."templates_juridicos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir acesso total para service_role" ON "public"."reunioes_juridico" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir escrita para administradores" ON "public"."configuracao_email" TO "authenticated" USING (("public"."get_my_role"() = 'admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'admin'::"text"));



CREATE POLICY "Permitir leitura para usuários autenticados" ON "public"."configuracao_email" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Permitir leitura para usuários autenticados" ON "public"."reunioes_juridico" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can manage score events" ON "public"."eventos_score" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access franqueado_unidades" ON "public"."franqueado_unidades" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access franqueados" ON "public"."franqueados" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Sistema pode atualizar logs de WhatsApp" ON "public"."logs_envio_whatsapp" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Sistema pode inserir histórico" ON "public"."historico_envios_completo" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Sistema pode inserir logs" ON "public"."logs_sistema" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Sistema pode inserir logs de WhatsApp" ON "public"."logs_envio_whatsapp" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert acoes automaticas log" ON "public"."acoes_automaticas_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert email logs" ON "public"."logs_envio_email" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert historico integracoes" ON "public"."historico_integracoes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert logs integracoes" ON "public"."logs_integracoes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert score events" ON "public"."eventos_score" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Users can manage aceites data" ON "public"."registros_aceite_parcelamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage cobrancas data" ON "public"."cobrancas_franqueados" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage import records" ON "public"."importacoes_planilha" TO "authenticated" USING (true);



CREATE POLICY "Users can manage propostas data" ON "public"."propostas_parcelamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage reunioes data" ON "public"."reunioes_negociacao" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage simulacoes data" ON "public"."simulacoes_parcelamento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage tratativas data" ON "public"."tratativas_cobranca" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage unidades data" ON "public"."unidades_franqueadas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can read config" ON "public"."configuracoes_cobranca" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can read config acordos" ON "public"."configuracao_acordos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can read config parcelamento" ON "public"."configuracao_parcelamento" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can read unidades data" ON "public"."unidades_franqueadas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view acoes automaticas log" ON "public"."acoes_automaticas_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view historico escalonamento" ON "public"."historico_escalonamento" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view historico integracoes" ON "public"."historico_integracoes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view priorizacao unidades" ON "public"."priorizacao_unidades" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuários autenticados podem ver os logs do WhatsApp" ON "public"."logs_envio_whatsapp" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuários podem gerenciar próprias sessões" ON "public"."sessoes_usuario" TO "authenticated" USING (("usuario_id" IN ( SELECT "usuarios_sistema"."id"
   FROM "public"."usuarios_sistema"
  WHERE ("usuarios_sistema"."email" = "auth"."email"()))));



CREATE POLICY "Usuários podem ler configurações básicas" ON "public"."configuracoes_sistema" FOR SELECT TO "authenticated" USING (("categoria" <> 'seguranca'::"text"));



CREATE POLICY "Usuários podem ver histórico completo" ON "public"."historico_envios_completo" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuários podem visualizar templates ativos" ON "public"."templates_juridicos" FOR SELECT TO "authenticated" USING (("ativo" = true));



ALTER TABLE "public"."acoes_automaticas_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."acordos_parcelamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alertas_sistema" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alertas_update_resolvido" ON "public"."alertas_sistema" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."cobrancas_franqueados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracao_acordos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracao_email" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracao_parcelamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracao_risco" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracao_score" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes_cobranca" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracoes_sistema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."criterios_juridico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."criterios_priorizacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documentos_gerados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escalonamentos_cobranca" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eventos_risco" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eventos_score" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."franqueado_unidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."franqueados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gatilhos_automacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gatilhos_automaticos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_aceites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_alteracoes_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_disparos_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_envios_completo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_escalonamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historico_integracoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."importacoes_planilha" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integracoes_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."juridico_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs_envio_email" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs_envio_whatsapp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs_integracoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs_sistema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificacoes_extrajudiciais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operacoes_manuais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parcelas_acordo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pontuacao_risco_unidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."priorizacao_unidades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."propostas_parcelamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_alertas" ON "public"."alertas_sistema" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."registros_aceite_parcelamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relatorios_mensais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reunioes_juridico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reunioes_negociacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."score_risco_unidades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_can_insert" ON "public"."usuarios_sistema" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "service_role_full_access" ON "public"."usuarios_sistema" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full_access_historico" ON "public"."historico_envios_completo" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."sessoes_usuario" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simulacoes_parcelamento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates_juridicos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tratativas_cobranca" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unidades_franqueadas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_can_read_own_data" ON "public"."usuarios_sistema" FOR SELECT TO "authenticated" USING (("email" = "auth"."email"()));



CREATE POLICY "usuarios_can_update_own_data" ON "public"."usuarios_sistema" FOR UPDATE TO "authenticated" USING (("email" = "auth"."email"())) WITH CHECK (("email" = "auth"."email"()));



ALTER TABLE "public"."usuarios_sistema" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."atualizar_campos_calculados"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_campos_calculados"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_campos_calculados"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_cnpj_operacao_manual"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_cnpj_operacao_manual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_cnpj_operacao_manual"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_cobranca_sem_trigger"("p_cobranca_id" "uuid", "p_status" "text", "p_valor_recebido" numeric, "p_data_atualizacao" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_cobranca_sem_trigger"("p_cobranca_id" "uuid", "p_status" "text", "p_valor_recebido" numeric, "p_data_atualizacao" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_cobranca_sem_trigger"("p_cobranca_id" "uuid", "p_status" "text", "p_valor_recebido" numeric, "p_data_atualizacao" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_priorizacao_unidade"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_priorizacao_unidade"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_priorizacao_unidade"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_status_por_tratativa"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_status_por_tratativa"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_status_por_tratativa"() TO "service_role";



GRANT ALL ON FUNCTION "public"."atualizar_todas_cobrancas_vencidas"() TO "anon";
GRANT ALL ON FUNCTION "public"."atualizar_todas_cobrancas_vencidas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."atualizar_todas_cobrancas_vencidas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."buscar_estatisticas_operacoes_manuais"("p_data_inicio" timestamp with time zone, "p_data_fim" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_estatisticas_operacoes_manuais"("p_data_inicio" timestamp with time zone, "p_data_fim" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_estatisticas_operacoes_manuais"("p_data_inicio" timestamp with time zone, "p_data_fim" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_dias_em_atraso"("p_data_vencimento" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_dias_em_atraso"("p_data_vencimento" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_dias_em_atraso"("p_data_vencimento" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_pontuacao_risco"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_pontuacao_risco"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_pontuacao_risco"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_score_priorizacao"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_score_priorizacao"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_score_priorizacao"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_score_unidade"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_score_unidade"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_score_unidade"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calcular_valor_atualizado"("p_valor_original" numeric, "p_dias_atraso" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calcular_valor_atualizado"("p_valor_original" numeric, "p_dias_atraso" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calcular_valor_atualizado"("p_valor_original" numeric, "p_dias_atraso" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."criar_escalonamento_automatico"("p_cnpj_unidade" "text", "p_titulo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."criar_escalonamento_automatico"("p_cnpj_unidade" "text", "p_titulo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."criar_escalonamento_automatico"("p_cnpj_unidade" "text", "p_titulo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."determinar_nivel_escalonamento"("p_dias_atraso" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."determinar_nivel_escalonamento"("p_dias_atraso" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."determinar_nivel_escalonamento"("p_dias_atraso" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_dados_consolidados_mes"("p_referencia_mes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_dados_consolidados_mes"("p_referencia_mes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_dados_consolidados_mes"("p_referencia_mes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_hash_titulo"("p_documento" "text", "p_valor" numeric, "p_data_vencimento" "date", "p_linha_referencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_hash_titulo"("p_documento" "text", "p_valor" numeric, "p_data_vencimento" "date", "p_linha_referencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_hash_titulo"("p_documento" "text", "p_valor" numeric, "p_data_vencimento" "date", "p_linha_referencia" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_notificacao_extrajudicial"("p_cnpj_unidade" "text", "p_motivo_acionamento" "public"."motivo_acionamento_enum", "p_responsavel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_notificacao_extrajudicial"("p_cnpj_unidade" "text", "p_motivo_acionamento" "public"."motivo_acionamento_enum", "p_responsavel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_notificacao_extrajudicial"("p_cnpj_unidade" "text", "p_motivo_acionamento" "public"."motivo_acionamento_enum", "p_responsavel" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gerar_token_acesso_franqueado"("p_cnpj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gerar_token_acesso_franqueado"("p_cnpj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gerar_token_acesso_franqueado"("p_cnpj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_template_disparos"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_template_disparos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_template_disparos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."limpar_sessoes_expiradas"() TO "anon";
GRANT ALL ON FUNCTION "public"."limpar_sessoes_expiradas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."limpar_sessoes_expiradas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_acionamento_juridico_automatico"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_acionamento_juridico_automatico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_acionamento_juridico_automatico"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"("p_titulo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"("p_titulo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_escalonamento_automatico"("p_titulo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_evento_risco"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_evento_risco"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_evento_risco"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_evento_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_evento_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_evento_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_pagamento_parcela"("p_parcela_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."processar_pagamento_parcela"("p_parcela_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_pagamento_parcela"("p_parcela_id" "uuid", "p_valor_pago" numeric, "p_data_pagamento" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."processar_resultado_reuniao"() TO "anon";
GRANT ALL ON FUNCTION "public"."processar_resultado_reuniao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."processar_resultado_reuniao"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_log_acesso"("p_cnpj" "text", "p_ip" "text", "p_user_agent" "text", "p_acao" "text", "p_sucesso" boolean, "p_detalhes" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_log_acesso"("p_cnpj" "text", "p_ip" "text", "p_user_agent" "text", "p_acao" "text", "p_sucesso" boolean, "p_detalhes" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_log_acesso"("p_cnpj" "text", "p_ip" "text", "p_user_agent" "text", "p_acao" "text", "p_sucesso" boolean, "p_detalhes" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_log_automatico"() TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_log_automatico"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_log_automatico"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolver_acionamento_juridico"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolver_acionamento_juridico"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolver_acionamento_juridico"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_resolver_acionamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_resolver_acionamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_resolver_acionamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_verificar_escalonamento"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_verificar_escalonamento"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_verificar_escalonamento"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_auth_franqueados_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_auth_franqueados_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_auth_franqueados_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_configuracao_notificacao_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_configuracao_notificacao_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_configuracao_notificacao_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_integracoes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_integracoes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_integracoes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_juridico_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_juridico_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_juridico_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_parcelamento_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_parcelamento_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_parcelamento_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_priorizacao_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_priorizacao_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_priorizacao_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_score_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_score_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_score_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_dados_importacao"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_dados_importacao"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_dados_importacao"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_token_franqueado"("p_cnpj" "text", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validar_token_franqueado"("p_cnpj" "text", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_token_franqueado"("p_cnpj" "text", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_criterios_escalonamento"("p_titulo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_criterios_escalonamento"("p_titulo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_criterios_escalonamento"("p_titulo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_criterios_juridico"("p_cnpj_unidade" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_criterios_juridico"("p_cnpj_unidade" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_criterios_juridico"("p_cnpj_unidade" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_escalonamentos_lote"() TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_escalonamentos_lote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_escalonamentos_lote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_parcelas_atrasadas"() TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_parcelas_atrasadas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_parcelas_atrasadas"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_permissao_usuario"("p_email" "text", "p_permissao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_permissao_usuario"("p_email" "text", "p_permissao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_permissao_usuario"("p_email" "text", "p_permissao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."verificar_reunioes_nao_realizadas"() TO "anon";
GRANT ALL ON FUNCTION "public"."verificar_reunioes_nao_realizadas"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verificar_reunioes_nao_realizadas"() TO "service_role";
























GRANT ALL ON TABLE "public"."acoes_automaticas_log" TO "anon";
GRANT ALL ON TABLE "public"."acoes_automaticas_log" TO "authenticated";
GRANT ALL ON TABLE "public"."acoes_automaticas_log" TO "service_role";



GRANT ALL ON TABLE "public"."acordos_parcelamento" TO "anon";
GRANT ALL ON TABLE "public"."acordos_parcelamento" TO "authenticated";
GRANT ALL ON TABLE "public"."acordos_parcelamento" TO "service_role";



GRANT ALL ON TABLE "public"."alertas_sistema" TO "anon";
GRANT ALL ON TABLE "public"."alertas_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."alertas_sistema" TO "service_role";



GRANT UPDATE("data_resolucao") ON TABLE "public"."alertas_sistema" TO "authenticated";



GRANT UPDATE("resolvido") ON TABLE "public"."alertas_sistema" TO "authenticated";



GRANT ALL ON TABLE "public"."cobrancas_franqueados" TO "anon";
GRANT ALL ON TABLE "public"."cobrancas_franqueados" TO "authenticated";
GRANT ALL ON TABLE "public"."cobrancas_franqueados" TO "service_role";



GRANT ALL ON TABLE "public"."configuracao_acordos" TO "anon";
GRANT ALL ON TABLE "public"."configuracao_acordos" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracao_acordos" TO "service_role";



GRANT ALL ON TABLE "public"."configuracao_email" TO "anon";
GRANT ALL ON TABLE "public"."configuracao_email" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracao_email" TO "service_role";



GRANT ALL ON TABLE "public"."configuracao_parcelamento" TO "anon";
GRANT ALL ON TABLE "public"."configuracao_parcelamento" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracao_parcelamento" TO "service_role";



GRANT ALL ON TABLE "public"."configuracao_risco" TO "anon";
GRANT ALL ON TABLE "public"."configuracao_risco" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracao_risco" TO "service_role";



GRANT ALL ON TABLE "public"."configuracao_score" TO "anon";
GRANT ALL ON TABLE "public"."configuracao_score" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracao_score" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_cobranca" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_cobranca" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_cobranca" TO "service_role";



GRANT ALL ON TABLE "public"."configuracoes_sistema" TO "anon";
GRANT ALL ON TABLE "public"."configuracoes_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracoes_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."criterios_juridico" TO "anon";
GRANT ALL ON TABLE "public"."criterios_juridico" TO "authenticated";
GRANT ALL ON TABLE "public"."criterios_juridico" TO "service_role";



GRANT ALL ON TABLE "public"."criterios_priorizacao" TO "anon";
GRANT ALL ON TABLE "public"."criterios_priorizacao" TO "authenticated";
GRANT ALL ON TABLE "public"."criterios_priorizacao" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_gerados" TO "anon";
GRANT ALL ON TABLE "public"."documentos_gerados" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_gerados" TO "service_role";



GRANT ALL ON TABLE "public"."escalonamentos_cobranca" TO "anon";
GRANT ALL ON TABLE "public"."escalonamentos_cobranca" TO "authenticated";
GRANT ALL ON TABLE "public"."escalonamentos_cobranca" TO "service_role";



GRANT ALL ON TABLE "public"."eventos_risco" TO "anon";
GRANT ALL ON TABLE "public"."eventos_risco" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_risco" TO "service_role";



GRANT ALL ON TABLE "public"."eventos_score" TO "anon";
GRANT ALL ON TABLE "public"."eventos_score" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_score" TO "service_role";



GRANT ALL ON TABLE "public"."franqueado_unidades" TO "anon";
GRANT ALL ON TABLE "public"."franqueado_unidades" TO "authenticated";
GRANT ALL ON TABLE "public"."franqueado_unidades" TO "service_role";



GRANT ALL ON SEQUENCE "public"."franqueado_unidades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."franqueado_unidades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."franqueado_unidades_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."franqueados" TO "anon";
GRANT ALL ON TABLE "public"."franqueados" TO "authenticated";
GRANT ALL ON TABLE "public"."franqueados" TO "service_role";



GRANT ALL ON TABLE "public"."gatilhos_automacao" TO "anon";
GRANT ALL ON TABLE "public"."gatilhos_automacao" TO "authenticated";
GRANT ALL ON TABLE "public"."gatilhos_automacao" TO "service_role";



GRANT ALL ON TABLE "public"."gatilhos_automaticos" TO "anon";
GRANT ALL ON TABLE "public"."gatilhos_automaticos" TO "authenticated";
GRANT ALL ON TABLE "public"."gatilhos_automaticos" TO "service_role";



GRANT ALL ON TABLE "public"."historico_aceites" TO "anon";
GRANT ALL ON TABLE "public"."historico_aceites" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_aceites" TO "service_role";



GRANT ALL ON TABLE "public"."historico_alteracoes_config" TO "anon";
GRANT ALL ON TABLE "public"."historico_alteracoes_config" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_alteracoes_config" TO "service_role";



GRANT ALL ON TABLE "public"."historico_disparos_templates" TO "anon";
GRANT ALL ON TABLE "public"."historico_disparos_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_disparos_templates" TO "service_role";



GRANT ALL ON TABLE "public"."historico_envios_completo" TO "anon";
GRANT ALL ON TABLE "public"."historico_envios_completo" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_envios_completo" TO "service_role";



GRANT ALL ON TABLE "public"."historico_escalonamento" TO "anon";
GRANT ALL ON TABLE "public"."historico_escalonamento" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_escalonamento" TO "service_role";



GRANT ALL ON TABLE "public"."historico_integracoes" TO "anon";
GRANT ALL ON TABLE "public"."historico_integracoes" TO "authenticated";
GRANT ALL ON TABLE "public"."historico_integracoes" TO "service_role";



GRANT ALL ON TABLE "public"."importacoes_planilha" TO "anon";
GRANT ALL ON TABLE "public"."importacoes_planilha" TO "authenticated";
GRANT ALL ON TABLE "public"."importacoes_planilha" TO "service_role";



GRANT ALL ON TABLE "public"."integracoes_config" TO "anon";
GRANT ALL ON TABLE "public"."integracoes_config" TO "authenticated";
GRANT ALL ON TABLE "public"."integracoes_config" TO "service_role";



GRANT ALL ON TABLE "public"."juridico_log" TO "anon";
GRANT ALL ON TABLE "public"."juridico_log" TO "authenticated";
GRANT ALL ON TABLE "public"."juridico_log" TO "service_role";



GRANT ALL ON TABLE "public"."logs_envio_email" TO "anon";
GRANT ALL ON TABLE "public"."logs_envio_email" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_envio_email" TO "service_role";



GRANT ALL ON TABLE "public"."logs_envio_whatsapp" TO "anon";
GRANT ALL ON TABLE "public"."logs_envio_whatsapp" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_envio_whatsapp" TO "service_role";



GRANT ALL ON TABLE "public"."logs_integracoes" TO "anon";
GRANT ALL ON TABLE "public"."logs_integracoes" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_integracoes" TO "service_role";



GRANT ALL ON TABLE "public"."logs_sistema" TO "anon";
GRANT ALL ON TABLE "public"."logs_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_sistema" TO "service_role";



GRANT ALL ON TABLE "public"."notificacoes_extrajudiciais" TO "anon";
GRANT ALL ON TABLE "public"."notificacoes_extrajudiciais" TO "authenticated";
GRANT ALL ON TABLE "public"."notificacoes_extrajudiciais" TO "service_role";



GRANT ALL ON TABLE "public"."operacoes_manuais" TO "anon";
GRANT ALL ON TABLE "public"."operacoes_manuais" TO "authenticated";
GRANT ALL ON TABLE "public"."operacoes_manuais" TO "service_role";



GRANT ALL ON TABLE "public"."parcelas_acordo" TO "anon";
GRANT ALL ON TABLE "public"."parcelas_acordo" TO "authenticated";
GRANT ALL ON TABLE "public"."parcelas_acordo" TO "service_role";



GRANT ALL ON TABLE "public"."pontuacao_risco_unidades" TO "anon";
GRANT ALL ON TABLE "public"."pontuacao_risco_unidades" TO "authenticated";
GRANT ALL ON TABLE "public"."pontuacao_risco_unidades" TO "service_role";



GRANT ALL ON TABLE "public"."priorizacao_unidades" TO "anon";
GRANT ALL ON TABLE "public"."priorizacao_unidades" TO "authenticated";
GRANT ALL ON TABLE "public"."priorizacao_unidades" TO "service_role";



GRANT ALL ON TABLE "public"."propostas_parcelamento" TO "anon";
GRANT ALL ON TABLE "public"."propostas_parcelamento" TO "authenticated";
GRANT ALL ON TABLE "public"."propostas_parcelamento" TO "service_role";



GRANT ALL ON TABLE "public"."registros_aceite_parcelamento" TO "anon";
GRANT ALL ON TABLE "public"."registros_aceite_parcelamento" TO "authenticated";
GRANT ALL ON TABLE "public"."registros_aceite_parcelamento" TO "service_role";



GRANT ALL ON TABLE "public"."relatorios_mensais" TO "anon";
GRANT ALL ON TABLE "public"."relatorios_mensais" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorios_mensais" TO "service_role";



GRANT ALL ON TABLE "public"."reunioes_juridico" TO "anon";
GRANT ALL ON TABLE "public"."reunioes_juridico" TO "authenticated";
GRANT ALL ON TABLE "public"."reunioes_juridico" TO "service_role";



GRANT ALL ON TABLE "public"."reunioes_negociacao" TO "anon";
GRANT ALL ON TABLE "public"."reunioes_negociacao" TO "authenticated";
GRANT ALL ON TABLE "public"."reunioes_negociacao" TO "service_role";



GRANT ALL ON TABLE "public"."score_risco_unidades" TO "anon";
GRANT ALL ON TABLE "public"."score_risco_unidades" TO "authenticated";
GRANT ALL ON TABLE "public"."score_risco_unidades" TO "service_role";



GRANT ALL ON TABLE "public"."sessoes_usuario" TO "anon";
GRANT ALL ON TABLE "public"."sessoes_usuario" TO "authenticated";
GRANT ALL ON TABLE "public"."sessoes_usuario" TO "service_role";



GRANT ALL ON TABLE "public"."simulacoes_parcelamento" TO "anon";
GRANT ALL ON TABLE "public"."simulacoes_parcelamento" TO "authenticated";
GRANT ALL ON TABLE "public"."simulacoes_parcelamento" TO "service_role";



GRANT ALL ON TABLE "public"."templates_juridicos" TO "anon";
GRANT ALL ON TABLE "public"."templates_juridicos" TO "authenticated";
GRANT ALL ON TABLE "public"."templates_juridicos" TO "service_role";



GRANT ALL ON TABLE "public"."tratativas_cobranca" TO "anon";
GRANT ALL ON TABLE "public"."tratativas_cobranca" TO "authenticated";
GRANT ALL ON TABLE "public"."tratativas_cobranca" TO "service_role";



GRANT ALL ON TABLE "public"."unidades_franqueadas" TO "anon";
GRANT ALL ON TABLE "public"."unidades_franqueadas" TO "authenticated";
GRANT ALL ON TABLE "public"."unidades_franqueadas" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_sistema" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_sistema" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
