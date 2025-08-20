/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./databaseService";
import { formatarCNPJCPF } from "../utils/formatters";
import {
  ISimulacaoParcelamento,
  ParcelaSimulacao,
  PropostaParcelamento,
  RegistroAceite,
  ConfiguracaoParcelamento,
  FiltrosSimulacao,
  EstatisticasParcelamento,
} from "../types/simulacaoParcelamento";
import { TrativativasService } from "./tratativasService";
import { n8nService } from "./n8nService";
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
    titulosIds: string[],
    quantidadeParcelas: number,
    dataPrimeiraParcela: string,
    valorEntrada?: number
  ): Promise<ISimulacaoParcelamento> {
    try {
      // Busca dados das cobranças
      const { data: cobrancas, error } = await supabase
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
        .in("id", titulosIds);

      if (error || !cobrancas || cobrancas.length === 0) {
        throw new Error("Cobranças não encontradas");
      }

      // Verifica se todas as cobranças são do mesmo CPF/CNPJ
      const primeiroDocumento = cobrancas[0].cnpj || cobrancas[0].cpf;
      const todosMesmoDocumento = cobrancas.every(c => 
        (c.cnpj || c.cpf) === primeiroDocumento
      );

      if (!todosMesmoDocumento) {
        throw new Error("Todas as cobranças devem ser do mesmo CPF/CNPJ");
      }

      // Busca configuração
      const config = await this.buscarConfiguracao();

      // Calcula valores consolidados
      const valorOriginalTotal = cobrancas.reduce((sum, c) => sum + c.valor_original, 0);
      const valorAtualizadoTotal = cobrancas.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

      // Validação de valor mínimo
      if (valorAtualizadoTotal < 500) {
        throw new Error("Valor mínimo para parcelamento é R$ 500,00");
      }

      // Valida parâmetros
      if (
        quantidadeParcelas < 2 ||
        quantidadeParcelas > 42
      ) {
        throw new Error(
          `Quantidade de parcelas deve estar entre 2 e 42`
        );
      }

      const valorParcelar = valorAtualizadoTotal - (valorEntrada || 0);

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

      const simulacao: ISimulacaoParcelamento = {
        titulo_id: titulosIds[0], // Usa o primeiro ID como referência principal
        // Para cobranças por CPF, preservamos o documento disponível (CPF ou CNPJ)
        cnpj_unidade: cobrancas[0].cnpj || cobrancas[0].cpf,
        valor_original: valorOriginalTotal,
        valor_atualizado: valorAtualizadoTotal,
        quantidade_parcelas: quantidadeParcelas,
        valor_entrada: valorEntrada,
        percentual_multa: 10.0,
        percentual_juros_mora: 1.5,
        data_primeira_parcela: dataPrimeiraParcela,
        parcelas,
        valor_total_parcelamento: valorTotalParcelamento,
        economia_total: valorEntrada ? valorEntrada * 0.05 : 0, // 5% de desconto na entrada
        // Adiciona metadados sobre as cobranças consolidadas
        metadados_consolidacao: {
          quantidade_cobrancas: cobrancas.length,
          titulos_ids: titulosIds,
          descricao_cobrancas: cobrancas.map(c => ({
            id: c.id,
            descricao: c.descricao || `Cobrança ${c.data_vencimento}`,
            valor_original: c.valor_original,
            valor_atualizado: c.valor_atualizado || c.valor_original,
            data_vencimento: c.data_vencimento
          }))
        }
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
  async salvarSimulacao(simulacao: ISimulacaoParcelamento): Promise<string> {
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
      const unidade = cobranca?.unidades_franqueadas || null;
      const franqueado = unidade?.franqueado_unidades?.[0]?.franqueados || null;

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
            telefone,
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

      const cobranca = (proposta as any).cobrancas_franqueados;
      const unidade = cobranca?.unidades_franqueadas;
      const telefone =
        cobranca?.telefone ||
        unidade?.telefone_unidade ||
        unidade?.franqueado_unidades?.[0]?.franqueados?.telefone;

      if (!telefone) {
        throw new Error("Telefone não cadastrado para esta unidade.");
      }

      // Pré-registra a tentativa de envio no log
      const { data: logData, error: logError } = await supabase
        .from("logs_envio_whatsapp")
        .insert({
          destinatario: telefone,
          mensagem_enviada: proposta.mensagem_proposta,
          instancia_evolution: "automacoes_3", // Instância padrão n8n
          sucesso: false, // Começa como falha
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Erro ao pré-registrar log do WhatsApp:", logError);
      } else {
        logId = logData.id;
      }

      // Envia mensagem via n8nService
      const resultado = await n8nService.enviarWhatsApp({
        number: telefone,
        text: proposta.mensagem_proposta,
        instanceName: "automacoes_3",
        metadata: {
          tipo: "proposta_parcelamento",
          cobrancaId: proposta.titulo_id, // ID da cobrança original (FK válida)
          propostaId: propostaId, // ID da proposta (para referência)
          origem: "simulacao_parcelamento",
        },
      });

      if (!resultado.success) {
        throw new Error("Falha no envio da mensagem via n8n");
      }

      // Atualiza o log com sucesso
      if (logId) {
        await supabase
          .from("logs_envio_whatsapp")
          .update({
            sucesso: true,
            evolution_message_id: resultado.messageId || "N/A",
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
            email_cobranca,
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

      const cobranca = (proposta as any).cobrancas_franqueados;
      const unidade = cobranca?.unidades_franqueadas;
      const email =
        cobranca?.email_cobranca ||
        unidade?.email_unidade ||
        unidade?.franqueado_unidades?.[0]?.franqueados?.email;

      if (!email) {
        throw new Error("Email não cadastrado para a unidade.");
      }

      // Usa o método do emailService para gerar o corpo do e-mail
      const template = emailService.gerarTemplatePropostaParcelamento(
        (proposta as any).simulacoes_parcelamento,
        (proposta as any).cobrancas_franqueados.unidades_franqueadas,
        (proposta as any).cobrancas_franqueados
      );

      const dadosEmail = {
        destinatario: email,
        nome_destinatario:
          unidade?.franqueado_unidades?.[0]?.franqueados?.nome_completo ||
          cobranca?.cliente ||
          unidade?.nome_unidade,
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto,
        metadata: {
          origem: "frontend",
          via: "n8n",
          tipo: "proposta_parcelamento",
          cobrancaId: proposta.titulo_id, // ID da cobrança original (FK válida)
          propostaId: propostaId, // ID da proposta (para referência)
          cliente:
            unidade?.franqueado_unidades?.[0]?.franqueados?.nome_completo ||
            cobranca?.cliente ||
            "Franqueado(a)",
        },
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

      // Usa a tabela de registros de aceite como fonte oficial de propostas aceitas
      const { data: aceites } = await supabase
        .from("registros_aceite_parcelamento")
        .select("id");

      const stats: EstatisticasParcelamento = {
        total_simulacoes: simulacoes?.length || 0,
        propostas_enviadas: propostas?.length || 0,
        propostas_aceitas: aceites?.length || 0,
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
   * Lista registros de aceite
   */
  async buscarAceites(): Promise<RegistroAceite[]> {
    try {
      const { data, error } = await supabase
        .from("registros_aceite_parcelamento")
        .select("*")
        .order("data_aceite", { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar aceites: ${error.message}`);
      }

      return (data as unknown as RegistroAceite[]) || [];
    } catch (error) {
      console.error("Erro ao buscar aceites:", error);
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
    _cobranca: any,
    unidade: any,
    franqueado: any,
    config: ConfiguracaoParcelamento
  ): string {
    const template = config.template_whatsapp;

    // Nome do destinatário: prioriza franqueado válido; caso contrário, usa o cliente da cobrança
    const nomeCliente =
      franqueado?.nome_completo &&
      franqueado.nome_completo !== "Sem nome cadastrado"
        ? franqueado.nome_completo
        : _cobranca?.cliente || "Franqueado(a)";

    // Documento exibível: CPF > CNPJ; fallback para código da unidade; por fim, rótulo genérico
    const documentoExibivel = _cobranca?.cpf
      ? formatarCNPJCPF(String(_cobranca.cpf))
      : _cobranca?.cnpj
      ? formatarCNPJCPF(String(_cobranca.cnpj))
      : unidade?.codigo_unidade || "Documento";

    const variaveis = {
      "{{cliente}}": nomeCliente,
      "{{codigo_unidade}}": documentoExibivel,
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
