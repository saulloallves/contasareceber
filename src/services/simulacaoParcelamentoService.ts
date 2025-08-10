/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./databaseService";
import {
  SimulacaoParcelamento,
  ParcelaSimulacao,
  PropostaParcelamento,
  RegistroAceite,
  ConfiguracaoParcelamento,
  FiltrosSimulacao,
  EstatisticasParcelamento,
} from "../types/simulacaoParcelamento";
import { TrativativasService } from "./tratativasService";
import {
  evolutionApiService,
  SendTextMessagePayload,
} from "./evolutionApiService";
import { emailService } from "./emailService";

export class SimulacaoParcelamentoService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Simula parcelamento com juros
   */
  async simularParcelamento(
    tituloId: string,
    quantidadeParcelas: number,
    dataPrimeiraParcela: string,
    valorEntrada?: number
  ): Promise<SimulacaoParcelamento> {
    try {
      // Busca dados da cobrança
      const { data: cobranca, error } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          *,
          unidades_franqueadas!left (
            codigo_unidade,
            nome_unidade,
            email_unidade,
            telefone_unidade,
            franqueado_unidades!left (
              franqueados!left (
                nome_completo,
                email,
                telefone
              )
            )
          )
        `
        )
        .eq("id", tituloId)
        .maybeSingle();

      if (error || !cobranca) {
        throw new Error("Cobrança não encontrada");
      }

  // Busca configuração
  const config = await this.buscarConfiguracao();

      // Validação de valor mínimo
      const valorAtualizado =
        cobranca.valor_atualizado || cobranca.valor_original;
      if (valorAtualizado < 500) {
        throw new Error("Valor mínimo para parcelamento é R$ 500,00");
      }
      // Valida parâmetros
      if (
        quantidadeParcelas < 2 ||
        quantidadeParcelas > config.quantidade_maxima_parcelas
      ) {
        throw new Error(
          `Quantidade de parcelas deve estar entre 2 e ${config.quantidade_maxima_parcelas}`
        );
      }

      const valorParcelar = valorAtualizado - (valorEntrada || 0);

      if (valorParcelar <= 0) {
        throw new Error("Valor a parcelar deve ser maior que zero");
      }

      // Calcula parcelas com juros
      const parcelas: ParcelaSimulacao[] = [];
      let valorTotalParcelamento = valorEntrada || 0;

      for (let i = 1; i <= quantidadeParcelas; i++) {
        const valorBaseParcela = valorParcelar / quantidadeParcelas;

        // Calcula multa (10%) e juros de mora (1.5%)
        const multa = valorBaseParcela * 0.1; // 10% de multa
        const jurosMora = valorBaseParcela * 0.015; // 1.5% de juros de mora
        const jurosAplicado = multa + jurosMora;

        const valorParcela = valorBaseParcela + jurosAplicado;

        // Calcula data de vencimento
        const dataVencimento = new Date(dataPrimeiraParcela);
        dataVencimento.setDate(
          dataVencimento.getDate() + (i - 1) * config.dias_entre_parcelas
        );

        parcelas.push({
          numero: i,
          valor: valorParcela,
          data_vencimento: dataVencimento.toISOString().split("T")[0],
          juros_aplicado: jurosAplicado,
          multa: multa,
          juros_mora: jurosMora,
        });

        valorTotalParcelamento += valorParcela;
      }

      // Valida valor mínimo da parcela
      const menorParcela = Math.min(...parcelas.map((p) => p.valor));
      if (menorParcela <= config.valor_minimo_parcela) {
        throw new Error(
          `Valor mínimo da parcela: R$ ${config.valor_minimo_parcela.toFixed(
            2
          )}`
        );
      }

      const simulacao: SimulacaoParcelamento = {
        titulo_id: tituloId,
        cnpj_unidade: cobranca.cnpj,
        valor_original: cobranca.valor_original,
        valor_atualizado: valorAtualizado,
        quantidade_parcelas: quantidadeParcelas,
        valor_entrada: valorEntrada,
        percentual_multa: 10.0,
        percentual_juros_mora: 1.5,
        data_primeira_parcela: dataPrimeiraParcela,
        parcelas,
        valor_total_parcelamento: valorTotalParcelamento,
        economia_total: valorEntrada ? valorEntrada * 0.05 : 0, // 5% de desconto na entrada
      };

      return simulacao;
    } catch (error) {
      console.error("Erro ao simular parcelamento:", error);
      throw error;
    }
  }

  /**
   * Salva simulação no banco
   */
  async salvarSimulacao(simulacao: SimulacaoParcelamento): Promise<string> {
    try {
      const { data, error } = await supabase
        .from("simulacoes_parcelamento")
        .insert(simulacao)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar simulação: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error("Erro ao salvar simulação:", error);
      throw error;
    }
  }

  /**
   * Gera proposta automática
   */
  async gerarProposta(
    simulacaoId: string,
    canaisEnvio: ("whatsapp" | "email")[],
    usuario: string
  ): Promise<PropostaParcelamento> {
    try {
      // Busca dados da simulação
      const { data: simulacao } = await supabase
        .from("simulacoes_parcelamento")
        .select(
          `
          *,
          cobrancas_franqueados!left (
            cliente,
            cnpj,
            unidades_franqueadas!left (
              nome_unidade,
              email_unidade,
              telefone_unidade,
              franqueado_unidades!left (
                franqueados!left (
                  nome_completo,
                  email,
                  telefone
                )
              )
            )
          )
        `
        )
        .eq("id", simulacaoId)
        .single();

      if (!simulacao) {
        throw new Error("Simulação não encontrada");
      }

      const config = await this.buscarConfiguracao();
      const cobranca = (simulacao as any).cobrancas_franqueados;
      const unidade = cobranca.unidades_franqueadas;
      const franqueado = unidade.franqueado_unidades?.[0]?.franqueados;

      // Gera mensagem personalizada
      const mensagem = this.gerarMensagemProposta(
        simulacao,
        cobranca,
        unidade,
        franqueado,
        config
      );

      // Calcula data de expiração
      const dataExpiracao = new Date();
      dataExpiracao.setDate(
        dataExpiracao.getDate() + config.prazo_validade_proposta_dias
      );

      const proposta: Omit<
        PropostaParcelamento,
        "id" | "created_at" | "updated_at"
      > = {
        simulacao_id: simulacaoId,
        titulo_id: simulacao.titulo_id,
        cnpj_unidade: simulacao.cnpj_unidade,
        mensagem_proposta: mensagem,
        canais_envio: canaisEnvio,
        enviado_por: usuario,
        status_proposta: "enviada",
        data_expiracao: dataExpiracao.toISOString(),
      };

      const { data, error } = await supabase
        .from("propostas_parcelamento")
        .insert(proposta)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar proposta: ${error.message}`);
      }

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        simulacao.titulo_id,
        usuario,
        `Proposta de parcelamento gerada: ${
          simulacao.quantidade_parcelas
        }x com juros de ${
          simulacao.percentual_juros_mora
        }%. Válida até ${dataExpiracao.toLocaleDateString("pt-BR")}`
      );

      return data;
    } catch (error) {
      console.error("Erro ao gerar proposta:", error);
      throw error;
    }
  }

  /**
   * Envia proposta via WhatsApp
   */
  async enviarPropostaWhatsApp(propostaId: string): Promise<boolean> {
    let logId: string | null = null;
    try {
      const { data: proposta } = await supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          cobrancas_franqueados!left (
            unidades_franqueadas!left (
              telefone_unidade,
              franqueado_unidades!left (
                franqueados!left (
                  telefone
                )
              )
            )
          )
        `
        )
        .eq("id", propostaId)
        .single();

      if (!proposta) {
        throw new Error("Proposta não encontrada");
      }

      const unidade = (proposta as any).cobrancas_franqueados?.unidades_franqueadas;
      const telefone = unidade?.telefone_unidade || 
                      unidade?.franqueado_unidades?.[0]?.franqueados?.telefone;

      if (!telefone) {
        throw new Error("Telefone não cadastrado para esta unidade.");
      }

      const telefoneFormatado = telefone.replace(/\D/g, "");
      const instanceName = "automacoes_backup";

      const payload: SendTextMessagePayload = {
        instanceName,
        number: telefoneFormatado,
        text: proposta.mensagem_proposta,
      };

      // Pré-registra a tentativa de envio no log
      const { data: logData, error: logError } = await supabase
        .from("logs_envio_whatsapp")
        .insert({
          destinatario: telefoneFormatado,
          mensagem_enviada: proposta.mensagem_proposta,
          instancia_evolution: instanceName,
          sucesso: false, // Começa como falha
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Erro ao pré-registrar log do WhatsApp:", logError);
      } else {
        logId = logData.id;
      }

  const evolutionResponse = await evolutionApiService.sendTextMessage(payload);

      // Atualiza o log com sucesso
      if (logId) {
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: true,
            evolution_message_id: (evolutionResponse as any)?.messageId || (evolutionResponse as any)?.key?.id || "N/A",
          })
          .eq("id", logId);
      }

      await supabase
        .from("propostas_parcelamento")
        .update({
          data_envio: new Date().toISOString(),
          canais_envio: Array.from(
            new Set([...proposta.canais_envio, "whatsapp"])
          ),
        })
        .eq("id", propostaId);

      return true;
    } catch (error) {
      console.error(
        "Erro ao enviar proposta via WhatsApp (API Evolution):",
        error
      );
      // Atualiza o log com o erro
      if (logId) {
        let errorMessage = "Erro desconhecido";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = String(error);
        }
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: false,
            erro_detalhes: errorMessage,
          })
          .eq("id", logId);
      }
      return false;
    }
  }

  /**
   * Envia proposta via Email
   */
  async enviarPropostaEmail(propostaId: string): Promise<boolean> {
    try {
      const { data: proposta, error: propostaError } = await supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          simulacoes_parcelamento!left(*),
          cobrancas_franqueados!left (
            cliente,
            unidades_franqueadas!left (
              email_unidade,
              codigo_unidade,
              nome_unidade,
              franqueado_unidades!left (
                franqueados!left (
                  nome_completo,
                  email
                )
              )
            )
          )
        `
        )
        .eq("id", propostaId)
        .single();

      if (propostaError || !proposta) {
        throw new Error(`Proposta não encontrada: ${propostaError?.message}`);
      }

      const unidade = (proposta as any).cobrancas_franqueados.unidades_franqueadas;
      const email = unidade.email_unidade || 
                   unidade.franqueado_unidades?.[0]?.franqueados?.email;
      
      if (!email) {
        throw new Error("Email não cadastrado para a unidade.");
      }

      const config = await this.buscarConfiguracao();

      // Usa o método do emailService para gerar o corpo do e-mail
      const template = emailService.gerarTemplatePropostaParcelamento(
        (proposta as any).simulacoes_parcelamento,
        (proposta as any).cobrancas_franqueados.unidades_franqueadas,
        (proposta as any).cobrancas_franqueados
      );

      const dadosEmail = {
        destinatario: email,
        nome_destinatario: unidade.nome_unidade || 
                          unidade.franqueado_unidades?.[0]?.franqueados?.nome_completo,
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto,
      };

      // Envia o e-mail
      const resultadoEnvio = await emailService.enviarEmail(dadosEmail);

      if (!resultadoEnvio.sucesso) {
        throw new Error(
          resultadoEnvio.erro || "Erro desconhecido ao enviar e-mail."
        );
      }

      // Atualiza data de envio na sua base de dados
      await supabase
        .from("propostas_parcelamento")
        .update({
          data_envio: new Date().toISOString(),
          canais_envio: Array.from(
            new Set([...proposta.canais_envio, "email"])
          ),
        })
        .eq("id", propostaId);

      return true;
    } catch (error) {
      console.error("Erro ao enviar proposta por email:", error);
      return false;
    }
  }

  /**
   * Registra aceite da proposta
   */
  async registrarAceite(
    propostaId: string,
    metodoAceite: RegistroAceite["metodo_aceite"],
    ipAceite: string,
    userAgent?: string,
    observacoes?: string
  ): Promise<void> {
    try {
      const { data: proposta } = await supabase
        .from("propostas_parcelamento")
        .select("*")
        .eq("id", propostaId)
        .single();

      if (!proposta) {
        throw new Error("Proposta não encontrada");
      }

      await supabase
        .from("propostas_parcelamento")
        .update({
          status_proposta: "aceita",
          aceito_em: new Date().toISOString(),
          aceito_por: "franqueado",
          ip_aceite: ipAceite,
          observacoes_aceite: observacoes,
        })
        .eq("id", propostaId);

      const registroAceite: Omit<RegistroAceite, "id" | "created_at"> = {
        proposta_id: propostaId,
        titulo_id: proposta.titulo_id,
        cnpj_unidade: proposta.cnpj_unidade,
        data_aceite: new Date().toISOString(),
        ip_aceite: ipAceite,
        user_agent: userAgent,
        metodo_aceite: metodoAceite,
        dados_proposta: proposta,
        observacoes,
      };

      await supabase
        .from("registros_aceite_parcelamento")
        .insert(registroAceite);

      await this.tratativasService.registrarObservacao(
        proposta.titulo_id,
        "franqueado",
        `Proposta de parcelamento aceita via ${metodoAceite}. IP: ${ipAceite}. ${
          observacoes || ""
        }`,
        "negociando"
      );

      console.log("Proposta aceita! Gerar boletos para as parcelas.");
    } catch (error) {
      console.error("Erro ao registrar aceite:", error);
      throw error;
    }
  }

  /**
   * Busca propostas com filtros
   */
  async buscarPropostas(filtros: FiltrosSimulacao = {}) {
    try {
      let query = supabase
        .from("propostas_parcelamento")
        .select(
          `
          *,
          simulacoes_parcelamento (*),
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original,
            unidades_franqueadas!left (
              nome_unidade,
              franqueado_unidades!left (
                franqueados!left (
                  nome_completo
                )
              )
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filtros.cnpj) {
        query = query.ilike("cnpj_unidade", `%${filtros.cnpj}%`);
      }

      if (filtros.status_proposta) {
        query = query.eq("status_proposta", filtros.status_proposta);
      }

      if (filtros.data_inicio) {
        query = query.gte("created_at", filtros.data_inicio);
      }

      if (filtros.data_fim) {
        query = query.lte("created_at", filtros.data_fim);
      }

      if (filtros.enviado_por) {
        query = query.ilike("enviado_por", `%${filtros.enviado_por}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar propostas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar propostas:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas
   */
  async buscarEstatisticas(): Promise<EstatisticasParcelamento> {
    try {
      const { data: propostas } = await supabase
        .from("propostas_parcelamento")
        .select("status_proposta, created_at, aceito_em");

      const { data: simulacoes } = await supabase
        .from("simulacoes_parcelamento")
        .select("valor_total_parcelamento");

      const stats: EstatisticasParcelamento = {
        total_simulacoes: simulacoes?.length || 0,
        propostas_enviadas: propostas?.length || 0,
        propostas_aceitas:
          propostas?.filter((p) => p.status_proposta === "aceita").length || 0,
        propostas_recusadas:
          propostas?.filter((p) => p.status_proposta === "recusada").length ||
          0,
        taxa_conversao: 0,
        valor_total_parcelado:
          simulacoes?.reduce((sum, s) => sum + s.valor_total_parcelamento, 0) ||
          0,
        tempo_medio_resposta: 0,
      };

      if (stats.propostas_enviadas > 0) {
        stats.taxa_conversao =
          (stats.propostas_aceitas / stats.propostas_enviadas) * 100;
      }

      return stats;
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      throw error;
    }
  }

  /**
   * Busca configuração
   */
  private async buscarConfiguracao(): Promise<ConfiguracaoParcelamento> {
    const { data, error } = await supabase
      .from("configuracao_parcelamento")
      .select("*")
      .eq("id", "default")
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: "default",
        percentual_juros_parcela: 10.0,
        valor_minimo_parcela: 100.0, // CORRIGIDO
        quantidade_maxima_parcelas: 6,
        percentual_entrada_minimo: 20.0,
        dias_entre_parcelas: 30,
        prazo_validade_proposta_dias: 7,
        template_whatsapp: `🏪 *PROPOSTA DE PARCELAMENTO*

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

_Equipe Financeira - Cresci e Perdi_`,
        template_email_assunto: "Proposta de Parcelamento - {{cliente}}",
        template_email_corpo: `Prezado(a) {{cliente}},

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
Equipe Financeira`,
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data;
  }

  /**
   * Gera mensagem personalizada da proposta
   */
  private gerarMensagemProposta(
    simulacao: any,
    cobranca: any,
    unidade: any,
    franqueado: any,
    config: ConfiguracaoParcelamento
  ): string {
    const template = config.template_whatsapp;

    const variaveis = {
      "{{cliente}}": franqueado?.nome_completo || unidade?.nome_unidade || cobranca?.cliente || "Cliente",
      "{{codigo_unidade}}": unidade?.codigo_unidade || "N/A",
      "{{valor_original}}": this.formatarMoeda(simulacao.valor_original),
      "{{valor_atualizado}}": this.formatarMoeda(simulacao.valor_atualizado),
      "{{valor_entrada}}": simulacao.valor_entrada
        ? this.formatarMoeda(simulacao.valor_entrada)
        : "",
      "{{quantidade_parcelas}}": simulacao.quantidade_parcelas.toString(),
      "{{valor_parcela}}": this.formatarMoeda(simulacao.parcelas[0].valor),
      "{{percentual_juros}}": simulacao.percentual_juros_mora.toString(),
      "{{valor_total}}": this.formatarMoeda(simulacao.valor_total_parcelamento),
      "{{data_primeira_parcela}}": new Date(
        simulacao.data_primeira_parcela
      ).toLocaleDateString("pt-BR"),
      "{{data_expiracao}}": new Date(
        Date.now() + config.prazo_validade_proposta_dias * 24 * 60 * 60 * 1000
      ).toLocaleDateString("pt-BR"),
    };

    let mensagem = template;
    Object.entries(variaveis).forEach(([chave, valor]) => {
      const regex = new RegExp(chave.replace(/[{}]/g, "\\$&"), "g");
      mensagem = mensagem.replace(regex, valor);
    });

    if (!simulacao.valor_entrada) {
      mensagem = mensagem.replace(/{{#entrada}}.*?{{\/entrada}}/g, "");
    } else {
      mensagem = mensagem.replace(/{{#entrada}}|{{\/entrada}}/g, "");
    }

    return mensagem;
  }

  /**
   * Métodos auxiliares
   */
  private formatarMoeda(valor: number): string {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  /**
   * Exporta dados
   */
  async exportarPropostas(filtros: FiltrosSimulacao = {}): Promise<string> {
    try {
      const propostas = await this.buscarPropostas(filtros);

      const cabecalho = [
        "Data Criação",
        "Cliente",
        "CNPJ",
        "Quantidade Parcelas",
        "Valor Total",
        "Status",
        "Enviado Por",
        "Data Aceite",
        "Método Aceite",
      ].join(",");

      const linhas = propostas.map((p) =>
        [
          new Date(p.created_at).toLocaleDateString("pt-BR"),
          (p as any).cobrancas_franqueados?.cliente || "",
          p.cnpj_unidade,
          (p as any).simulacoes_parcelamento?.quantidade_parcelas || "",
          this.formatarMoeda(
            (p as any).simulacoes_parcelamento?.valor_total_parcelamento || 0
          ),
          p.status_proposta,
          p.enviado_por,
          p.aceito_em ? new Date(p.aceito_em).toLocaleDateString("pt-BR") : "",
          "",
        ].join(",")
      );

      return [cabecalho, ...linhas].join("\n");
    } catch (error) {
      console.error("Erro ao exportar propostas:", error);
      throw error;
    }
  }
}