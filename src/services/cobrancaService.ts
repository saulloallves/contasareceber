/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "../lib/supabaseClient";
import {
  CobrancaFranqueado,
  QuitacaoCobranca,
  ResultadoQuitacao,
  TrativativaCobranca,
  EnvioMensagem,
  ResultadoEnvioCobranca,
} from "../types/cobranca";

// Tipo auxiliar para histórico de envios (whatsapp/email)
type HistoricoEnvio = {
  id: string;
  canal: "whatsapp" | "email";
  tipo: string;
  cliente?: string;
  cnpj?: string;
  numero_telefone?: string;
  mensagem_enviada?: string;
  mensagem?: string;
  status_envio?: string;
  erro_detalhes?: string;
  data_envio: string;
  destinatario?: string;
  assunto?: string;
  usuario?: string;
  metadados?: Record<string, unknown>;
};

export class CobrancaService {
  // Garante que apenas colunas válidas sejam enviadas para update/insert
  private sanitizeUpdatePayload(
    dados: Partial<CobrancaFranqueado>
  ): Record<string, unknown> {
    if (!dados) return {};
    const {
      // id e unidades_franqueadas são ignorados propositalmente
  cnpj,
  cpf,
      cliente,
      cliente_codigo,
      tipo_cobranca,
      email_cobranca,
      descricao,
      valor_original,
      valor_recebido,
      data_vencimento,
      data_vencimento_original,
      dias_em_atraso,
      valor_atualizado,
      status,
      telefone,
      referencia_importacao,
      hash_titulo,
      nivel_criticidade,
  unidade_id_fk,
  franqueado_id_fk,
  importacao_id_fk, // FK para a tabela importacoes_planilha
    } = dados as any;

    const payload: Record<string, unknown> = {
  cnpj,
  cpf,
      cliente,
      cliente_codigo,
      tipo_cobranca,
      email_cobranca,
      descricao,
      valor_original,
      valor_recebido,
      data_vencimento,
      data_vencimento_original,
      dias_em_atraso,
      valor_atualizado,
      status,
      telefone,
      referencia_importacao,
      hash_titulo,
      nivel_criticidade,
  unidade_id_fk,
  franqueado_id_fk,
  importacao_id_fk,
    };

    // Remove chaves undefined para evitar updates nulos desnecessários
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    return payload;
  }
  async buscarCobrancas(
    filtros: Record<string, unknown> = {}
  ): Promise<CobrancaFranqueado[]> {
  // Observação: joins embutidos removidos para evitar ambiguidade de relacionamentos no PostgREST
  // Caso precise de dados de unidade/franqueado, a UI resolve via serviços dedicados após o fetch.
      let query = supabase.from("cobrancas_franqueados").select("*");

      // Filtros básicos
      if (filtros.status) {
        query = query.eq("status", filtros.status);
      }

      if (filtros.dataInicio) {
        query = query.gte("data_vencimento", filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte("data_vencimento", filtros.dataFim);
      }

      if (filtros.cnpj) {
        const cnpjFiltro = String(filtros.cnpj);
        const cnpjNumerico = cnpjFiltro.replace(/\D/g, "");
        // Aplica filtro exato apenas quando CNPJ completo (14 dígitos)
        if (cnpjNumerico.length === 14) {
          query = query.eq("cnpj", cnpjNumerico);
        }
        // Para valores parciais, não filtra no banco (o front aplica includes em dígitos)
      }
      if ((filtros as any).cpf) {
        const cpfFiltro = String((filtros as any).cpf);
        const cpfNumerico = cpfFiltro.replace(/\D/g, "");
        // Aplica filtro exato apenas quando CPF completo (11 dígitos)
        if (cpfNumerico.length === 11) {
          query = query.eq("cpf", cpfNumerico);
        }
        // Para valores parciais, não filtra no banco (o front aplica includes em dígitos)
      }

      // Filtro por tipo de documento (cpf/cnpj)
      if ((filtros as any).tipoDocumento === "cpf") {
        // CPF válido: coluna 'cpf' NÃO nula e NÃO vazia
        query = query.not("cpf", "is", null).neq("cpf", "");
      } else if ((filtros as any).tipoDocumento === "cnpj") {
        // CNPJ: registros onde 'cpf' é nulo OU vazio (dados antigos podem ter "")
        query = query.or("cpf.is.null,cpf.eq.");
      }

      // Filtros de valor
      if (filtros.valorMin) {
        const valorMin = typeof filtros.valorMin === 'string' 
          ? parseFloat(filtros.valorMin) 
          : filtros.valorMin;
        if (!isNaN(valorMin as number)) {
          query = query.gte("valor_atualizado", valorMin);
        }
      }

      if (filtros.valorMax) {
        const valorMax = typeof filtros.valorMax === 'string' 
          ? parseFloat(filtros.valorMax) 
          : filtros.valorMax;
        if (!isNaN(valorMax as number)) {
          query = query.lte("valor_atualizado", valorMax);
        }
      }

      // Filtro por tipo de cobrança
      if (filtros.tipoCobranca || filtros.tipo_debito) {
        const tipo = filtros.tipoCobranca || filtros.tipo_debito;
        query = query.eq("tipo_cobranca", tipo);
      }

      // Filtro apenas inadimplentes
      if (filtros.apenasInadimplentes) {
        query = query.neq("status", "quitado");
      }

      // Ordenação
      const colunaOrdenacao = filtros.colunaOrdenacao as string || "data_vencimento";
      const direcaoOrdenacao = filtros.direcaoOrdenacao as string || "desc";
      
      return query.order(colunaOrdenacao, { ascending: direcaoOrdenacao === "asc" });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar cobranças: ${error.message}`);
    }

    if (!data) {
      return [];
    }

    // Aplica filtros locais que não podem ser feitos no banco
    let resultados = data;

    // Filtro por busca (nome da unidade, código, CNPJ)
    if (filtros.busca) {
      const termoBusca = (filtros.busca as string).toLowerCase();
      resultados = resultados.filter((cobranca) => {
        const nomeUnidade = cobranca.unidades_franqueadas?.nome_unidade?.toLowerCase() || 
                            cobranca.cliente?.toLowerCase() || '';
        const codigoUnidade = cobranca.unidades_franqueadas?.codigo_unidade?.toLowerCase() || '';
        const cnpj = cobranca.cnpj?.replace(/\D/g, '') || '';
        const cpf = cobranca.cpf?.replace(/\D/g, '') || '';
        
        return nomeUnidade.includes(termoBusca) ||
               codigoUnidade.includes(termoBusca) ||
               cnpj.includes(termoBusca.replace(/\D/g, '')) ||
               cpf.includes(termoBusca.replace(/\D/g, ''));
      });
    }

    return resultados;
  }

  async quitarCobranca(dados: QuitacaoCobranca): Promise<ResultadoQuitacao> {
    const {
      cobrancaId,
      valorPago,
      formaPagamento,
      observacoes,
      usuario,
    } = dados;

    const { data: cobranca, error: cobrancaError } = await supabase
      .from("cobrancas_franqueados")
      .select("*")
      .eq("id", cobrancaId)
      .single();

    if (cobrancaError || !cobranca) {
      throw new Error(`Erro ao buscar cobrança: ${cobrancaError?.message}`);
    }

    const valorRestante = cobranca.valor_original - valorPago;
    const novoStatus = valorRestante <= 0 ? "quitado" : "parcialmente_pago";

    // Monta as observações consolidadas
    let observacoesConsolidadas = cobranca.observacoes || "";
    const novaObservacao = `\n[${new Date().toLocaleString("pt-BR")}] Pagamento registrado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorPago)} via ${formaPagamento}${observacoes ? ` - ${observacoes}` : ""}. Usuário: ${usuario}`;
    observacoesConsolidadas += novaObservacao;

    const { error: updateError } = await supabase
      .from("cobrancas_franqueados")
      .update({
        valor_recebido: (cobranca.valor_recebido || 0) + valorPago,
        status: novoStatus,
        data_ultima_atualizacao: new Date().toISOString(),
        observacoes: observacoesConsolidadas,
      })
      .eq("id", cobrancaId);

    if (updateError) {
      throw new Error(`Erro ao atualizar cobrança: ${updateError.message}`);
    }

    // Log da operação para auditoria
    console.log(`Quitação processada - Cobrança ID: ${cobrancaId}, Valor: ${valorPago}, Status: ${novoStatus}, Usuário: ${usuario}`);

    return {
      sucesso: true,
      mensagem: "Quitação processada com sucesso",
      isQuitacaoTotal: novoStatus === "quitado",
      valorRestante: valorRestante > 0 ? valorRestante : 0,
    };
  }

  async registrarTratativa(tratativa: TrativativaCobranca): Promise<void> {
    const { error } = await supabase.from("tratativas_cobranca").insert(tratativa);

    if (error) {
      throw new Error(`Erro ao registrar tratativa: ${error.message}`);
    }

    if (tratativa.status_cobranca_resultante) {
      const { error: updateError } = await supabase
        .from("cobrancas_franqueados")
        .update({ status: tratativa.status_cobranca_resultante })
        .eq("id", tratativa.titulo_id);

      if (updateError) {
        throw new Error(
          `Erro ao atualizar status da cobrança: ${updateError.message}`
        );
      }
    }
  }

  async enviarMensagemCobranca(mensagem: EnvioMensagem): Promise<void> {
    const { error } = await supabase
      .from("envios_mensagem")
      .insert(mensagem);

    if (error) {
      throw new Error(`Erro ao registrar mensagem enviada: ${error.message}`);
    }
  }

  async enviarCobrancasEmLote(
    cobrancas: string[]
  ): Promise<ResultadoEnvioCobranca> {
    const resultado: ResultadoEnvioCobranca = {
      sucesso: true,
      total_envios: cobrancas.length,
      envios_sucesso: 0,
      envios_falha: 0,
      detalhes: [],
    };

    for (const cobrancaId of cobrancas) {
      try {
        const { data: cobranca, error } = await supabase
          .from("cobrancas_franqueados")
          .select("*")
          .eq("id", cobrancaId)
          .single();

        if (error || !cobranca) {
          throw new Error(`Erro ao buscar cobrança: ${error?.message}`);
        }

        await this.enviarMensagemCobranca({
          titulo_id: cobrancaId,
          cliente: cobranca.cliente,
          cnpj: cobranca.cnpj,
          telefone: cobranca.telefone || "",
          mensagem_enviada: "Mensagem padrão de cobrança",
          status_envio: "enviado",
        });

        resultado.envios_sucesso++;
        resultado.detalhes.push({
          titulo_id: cobrancaId,
          cliente: cobranca.cliente,
          status: "sucesso",
        });
    } catch (error: unknown) {
        resultado.envios_falha++;
        resultado.detalhes.push({
          titulo_id: cobrancaId,
          cliente: "Desconhecido",
      status: "falha",
      erro: (error as Error).message,
        });
      }
    }

    resultado.sucesso = resultado.envios_falha === 0;
    return resultado;
  }

  /**
   * Atualiza uma cobrança específica
   */
  async atualizarCobranca(
    id: string,
    dados: Partial<CobrancaFranqueado>
  ): Promise<void> {
    const payload = this.sanitizeUpdatePayload(dados);
    const { error } = await supabase
      .from("cobrancas_franqueados")
      .update({ ...payload, data_ultima_atualizacao: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao atualizar cobrança: ${error.message}`);
    }
  }

  /**
   * Busca histórico de envios (WhatsApp/Email) vinculados a uma cobrança
   * Utiliza o campo cobranca_id nas tabelas de logs para vincular mensagens
   */
  async buscarHistoricoEnvios(cobrancaId: string): Promise<HistoricoEnvio[]> {
    const historico: HistoricoEnvio[] = [];

    // 1) Logs de WhatsApp via n8n em 'logs_envio_whatsapp'
    try {
      const { data, error } = await supabase
        .from("logs_envio_whatsapp")
        .select("id, destinatario, mensagem_enviada, instancia_evolution, sucesso, evolution_message_id, erro_detalhes, data_envio, created_at, cobranca_id")
        .eq("cobranca_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "whatsapp",
            tipo: "whatsapp_n8n",
            numero_telefone: row.destinatario,
            mensagem_enviada: row.mensagem_enviada || "Mensagem não capturada",
            status_envio: row.sucesso ? "sucesso" : "falha",
            erro_detalhes: row.erro_detalhes,
            data_envio: row.data_envio || row.created_at,
            metadados: {
              evolution_message_id: row.evolution_message_id,
              instancia_evolution: row.instancia_evolution,
            },
          }))
        );
      }
    } catch (e) {
      console.warn("Falha ao buscar logs_envio_whatsapp:", e);
    }

    // 2) Logs de e-mail via n8n em 'logs_envio_email'
    try {
      const { data, error } = await supabase
        .from("logs_envio_email")
        .select("id, destinatario, mensagem, sucesso, message_id, erro_detalhes, data_envio, created_at, cobranca_id")
        .eq("cobranca_id", cobrancaId)
        .order("data_envio", { ascending: false });

      if (!error && data) {
        historico.push(
          ...data.map((row: any): HistoricoEnvio => ({
            id: row.id,
            canal: "email",
            tipo: "email_n8n",
            destinatario: row.destinatario,
            mensagem: row.mensagem || "Conteúdo do email não capturado",
            status_envio: row.sucesso ? "sucesso" : "falha",
            erro_detalhes: row.erro_detalhes,
            data_envio: row.data_envio || row.created_at,
            metadados: {
              message_id: row.message_id,
            },
          }))
        );
      }
    } catch (e) {
      console.warn("Falha ao buscar logs_envio_email:", e);
    }
    // Ordena por data desc como fallback
    historico.sort((a, b) => new Date(b.data_envio || 0).getTime() - new Date(a.data_envio || 0).getTime());
    return historico;
  }
}

export const cobrancaService = new CobrancaService();
