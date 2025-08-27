/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./databaseService";
import {
  CardCobranca,
  ColunaKanban,
  MovimentacaoCard,
  FiltrosKanban,
  EstatisticasKanban,
  LogMovimentacao,
} from "../types/kanban";
import { TrativativasService } from "./tratativasService";

export class KanbanService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Busca todas as colunas do Kanban
   */
  async buscarColunas(): Promise<ColunaKanban[]> {
    try {
      // Colunas do Kanban na ordem e nomes definidos pelo cliente
      const colunas = [
        {
          id: "em_aberto",
          nome: "📥 Atrasadas",
          descricao: "Valor atrasado em aberto",
          cor: "#6B7280",
          ordem: 1,
          ativa: true,
        },
        {
          id: "em_negociacao",
          nome: "🤝 Negociando",
          descricao: "Negociando",
          cor: "#F59E0B",
          ordem: 2,
          ativa: true,
        },
        {
          id: "parcelado",
          nome: "🗂️ Parcelado",
          descricao: "Cobrança parcelada",
          cor: "#7031AF",
          ordem: 3,
          ativa: true,
        },
        {
          id: "parcelas",
          nome: "📅 Parcelas Futuras",
          descricao: "Parcelas de parcelamentos a vencer",
          cor: "#8B5CF6",
          ordem: 4,
          ativa: true,
        },
        {
          id: "inadimplencia",
          nome: "❌ Inadimplência",
          descricao: "Cobrança atrasada mais de 30 dias",
          cor: "#8d4925",
          ordem: 5,
          ativa: true,
        },
        {
          id: "juridico",
          nome: "⚖️ Jurídico",
          descricao: "Cobrança no jurídico",
          cor: "#31A3FB",
          ordem: 6,
          ativa: true,
        },
        {
          id: "perda",
          nome: "🚫 Perda",
          descricao: "Cobrança perdida a mais de 180 dias",
          cor: "#FF0A0E",
          ordem: 7,
          ativa: true,
        },
        {
          id: "quitado",
          nome: "✅ Quitado",
          descricao: "Totalmente quitado",
          cor: "#2EBF11",
          ordem: 8,
          ativa: true,
        },
      ];
      
      // Ordena as colunas alfabeticamente pelo nome (removendo emojis para ordenação)
      return colunas.sort((a, b) => {
        const nomeA = a.nome.replace(/[^\w\s]/gi, '').trim();
        const nomeB = b.nome.replace(/[^\w\s]/gi, '').trim();
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
    } catch (error) {
      console.error("Erro ao buscar colunas:", error);
      return [];
    }
  }

  /**
   * Busca cards do Kanban com opção de agrupamento.
   */
  async buscarCards(
    filtros: FiltrosKanban = {},
    agruparPorUnidade: boolean = false
  ): Promise<CardCobranca[]> {
    try {
      // Seleção de colunas para a tabela principal (com a junção que funciona)
      const selectComJoin = `
          id, cnpj, cpf, cliente, valor_original, valor_atualizado, valor_recebido,
          is_parcela,
          data_vencimento, status, tipo_cobranca, descricao, created_at,
          observacoes, unidade_id_fk,
          unidades_franqueadas!unidade_id_fk (
            id, codigo_unidade, nome_unidade, cidade, estado
          )
        `;

      // Seleção de colunas para a tabela de quitadas (sem a junção e sem a coluna removida)
      const selectSemJoin = `
          id, cnpj, cpf, cliente, valor_original, valor_atualizado, valor_recebido,
          data_vencimento, status, tipo_cobranca, descricao, created_at,
          observacoes, unidade_id_fk
        `;

      // Query para buscar cobranças que NÃO estão quitadas
      let queryNaoQuitadas = supabase
        .from("cobrancas_franqueados")
        .select(selectComJoin)
        .not("status", "eq", "quitado")
        .range(0, 5000);

      // Query para buscar as cobranças da nova tabela de quitadas
      let queryQuitadas = supabase
        .from("cobrancas_quitadas")
        .select(selectSemJoin)
        .range(0, 5000);

      if (filtros.tipo_debito) {
        // O nome da coluna no banco é 'tipo_cobranca'
        queryNaoQuitadas = queryNaoQuitadas.eq(
          "tipo_cobranca",
          filtros.tipo_debito
        );
        queryQuitadas = queryQuitadas.eq("tipo_cobranca", filtros.tipo_debito);
      }

      // Aplica filtros que funcionam em ambas as tabelas diretamente
      if (filtros.valor_min) {
        queryNaoQuitadas = queryNaoQuitadas.gte(
          "valor_atualizado",
          filtros.valor_min
        );
        queryQuitadas = queryQuitadas.gte(
          "valor_atualizado",
          filtros.valor_min
        );
      }
      if (filtros.valor_max) {
        queryNaoQuitadas = queryNaoQuitadas.lte(
          "valor_atualizado",
          filtros.valor_max
        );
        queryQuitadas = queryQuitadas.lte(
          "valor_atualizado",
          filtros.valor_max
        );
      }
      // Aplica filtro de unidade (CNPJ/Código) apenas na query que suporta o join
      if (filtros.unidade) {
        const orFilter = `cnpj.ilike.%${filtros.unidade}%,unidades_franqueadas.codigo_unidade.ilike.%${filtros.unidade}%`;
        queryNaoQuitadas = queryNaoQuitadas.or(orFilter);
        // Para a query de quitadas, o filtro de unidade será aplicado depois da junção manual
      }

      // Executa as duas consultas em paralelo para otimizar o tempo
      const [
        { data: naoQuitadasData, error: naoQuitadasError },
        { data: quitadasData, error: quitadasError },
      ] = await Promise.all([queryNaoQuitadas, queryQuitadas]);

      if (naoQuitadasError) {
        throw new Error(
          `Erro ao buscar cobranças pendentes: ${naoQuitadasError.message}`
        );
      }
      if (quitadasError) {
        throw new Error(
          `Erro ao buscar cobranças quitadas: ${quitadasError.message}`
        );
      }

      // --- JUNÇÃO MANUAL PARA COBRANÇAS QUITADAS ---
      let quitadasComUnidade: any[] = [];
      if (quitadasData && quitadasData.length > 0) {
        const unidadeIds = [
          ...new Set(
            quitadasData.map((c) => c.unidade_id_fk).filter((id) => id)
          ),
        ];

        if (unidadeIds.length > 0) {
          const { data: unidadesData, error: unidadesError } = await supabase
            .from("unidades_franqueadas")
            .select("id, codigo_unidade, nome_unidade, cidade, estado")
            .in("id", unidadeIds);

          if (unidadesError) {
            throw new Error(
              `Erro ao buscar unidades para cobranças quitadas: ${unidadesError.message}`
            );
          }

          const unidadesMap = new Map(unidadesData.map((u) => [u.id, u]));

          quitadasComUnidade = quitadasData.map((cobranca) => ({
            ...cobranca,
            unidades_franqueadas:
              unidadesMap.get(cobranca.unidade_id_fk) || null,
          }));
        } else {
          quitadasComUnidade = quitadasData.map((cobranca) => ({
            ...cobranca,
            unidades_franqueadas: null,
          }));
        }
      }
      // --- FIM DA JUNÇÃO MANUAL ---

      // Aplica o filtro de unidade para os quitados agora que temos os dados da unidade
      if (filtros.unidade) {
        const filtroLowerCase = filtros.unidade.toLowerCase();
        quitadasComUnidade = quitadasComUnidade.filter((c) => {
          const unidade = c.unidades_franqueadas;
          const cnpjMatch =
            c.cnpj && c.cnpj.toLowerCase().includes(filtroLowerCase);
          const nomeMatch =
            unidade &&
            unidade.nome_unidade &&
            unidade.nome_unidade.toLowerCase().includes(filtroLowerCase);
          const codigoMatch =
            unidade &&
            unidade.codigo_unidade &&
            unidade.codigo_unidade.toLowerCase().includes(filtroLowerCase);
          return cnpjMatch || nomeMatch || codigoMatch;
        });
      }

      // Combina os resultados das duas consultas em um único array
      const todas = [...(naoQuitadasData || []), ...quitadasComUnidade];

      // Separa parcelas das cobranças normais
      const parcelas = todas.filter((c) => c.is_parcela === true);
      const naoParcelas = todas.filter((c) => !c.is_parcela);

      // Logs de depuração (sanitizados) para entender dataset retornado em tempo de execução
      try {
        const sampleMap = (arr: any[]) =>
          (arr || []).slice(0, 6).map((c) => ({
            id: c.id,
            status: c.status,
            is_parcela: !!c.is_parcela,
            cnpj_tail: c.cnpj ? String(c.cnpj).slice(-4) : null,
            unidade_id_fk: c.unidade_id_fk || null,
          }));

        console.debug("[kanbanService] buscarCards: counts ->", {
          todas: (todas || []).length,
          naoParcelas: naoParcelas.length,
          parcelas: parcelas.length,
        });
        console.debug(
          "[kanbanService] buscarCards: sample naoParcelas ->",
          sampleMap(naoParcelas)
        );
        console.debug(
          "[kanbanService] buscarCards: sample parcelas ->",
          sampleMap(parcelas)
        );
      } catch (e) {
        // não falha a execução por logs
        console.warn("[kanbanService] erro ao gerar logs de depuração", e);
      }

      if (
        (!naoParcelas || naoParcelas.length === 0) &&
        (!parcelas || parcelas.length === 0)
      ) {
        return [];
      }

      // Primeiro trata as cobranças não-parcelas (que podem ser agrupadas)
      let resultadoNaoParcelas: CardCobranca[] = [];
      if (naoParcelas.length > 0) {
        if (agruparPorUnidade) {
          resultadoNaoParcelas = this.agruparCobrancasPorUnidade(
            naoParcelas,
            filtros
          );
        } else {
          resultadoNaoParcelas = this.criarCardsIndividuais(
            naoParcelas,
            filtros
          );
        }
      }

      // Em seguida, cria cards individuais para as parcelas e os anexa, garantindo visibilidade
      const cartasParcelas =
        parcelas.length > 0
          ? this.criarCardsIndividuais(parcelas, filtros)
          : [];

      return [...resultadoNaoParcelas, ...cartasParcelas];
    } catch (error) {
      console.error("Erro ao buscar cards:", error);
      return [];
    }
  }

  /**
   * Cria cards individuais para cada cobrança
   */
  private criarCardsIndividuais(
    cobrancas: any[],
    filtros: FiltrosKanban
  ): CardCobranca[] {
    return cobrancas
      .map((cobranca) => {
        const unidade = cobranca.unidades_franqueadas;
        const valorAtual = cobranca.valor_atualizado || cobranca.valor_original;

        // Para parcelas, ajustar o nome para mostrar informações da parcela
        let nomeUnidade = unidade?.nome_unidade || cobranca.cliente;
        let descricaoCobranca = cobranca.descricao;

        if (cobranca.is_parcela) {
          nomeUnidade = `${nomeUnidade} - ${cobranca.cliente}`;
          descricaoCobranca = `Parcela de parcelamento - ${
            cobranca.descricao || ""
          }`;
        }

        // Helper local para procurar valores de metadados com nomes alternativos
        const getFirst = (obj: any, keys: string[]) => {
          for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) return obj[k];
          }
          return null;
        };

        const generatedId = `gen-${
          cobranca.cnpj || cobranca.cliente || "card"
        }-${cobranca.data_vencimento || ""}-${Math.floor(
          Math.random() * 1000000
        )}`;
        const card: CardCobranca = {
          id: cobranca.id || generatedId, // UUID direto do banco ou gerado como fallback
          codigo_unidade: unidade?.codigo_unidade || cobranca.cnpj,
          nome_unidade: nomeUnidade,
          cnpj: cobranca.cnpj,
          cpf: cobranca.cpf || "",
          tipo_debito: this.determinarTipoDebito([cobranca]),
          valor_total: valorAtual,
          valor_original: cobranca.valor_original || 0,
          data_vencimento_antiga: cobranca.data_vencimento,
          data_vencimento_recente: cobranca.data_vencimento,
          status_atual: this.determinarStatusKanban(cobranca.status),
          ultima_acao: this.determinarUltimaAcao(cobranca),
          data_ultima_acao: cobranca.created_at || new Date().toISOString(),
          responsavel_atual: this.determinarResponsavel(cobranca.status),
          criticidade: this.determinarCriticidadeIndividual(
            cobranca.data_vencimento
          ),
          data_entrada_etapa: cobranca.created_at || new Date().toISOString(),
          descricao_cobranca: descricaoCobranca,
          valor_recebido: cobranca.valor_recebido || 0,
          quantidade_titulos: 1,
          observacoes: cobranca.observacoes || "",
          // Propaga metadados de parcelamento, se existirem (com vários fallbacks)
          is_parcela: !!cobranca.is_parcela,
          parcela_numero:
            getFirst(cobranca, [
              "parcela_numero",
              "parcela_num",
              "numero_parcela",
              "parcela",
              "parcelaNumero",
            ]) || null,
          parcelas_total:
            getFirst(cobranca, [
              "parcelas_total",
              "total_parcelas",
              "qtd_parcelas",
              "nro_parcelas",
              "parcelasTotal",
            ]) || null,
          parcelamento_origem:
            getFirst(cobranca, [
              "parcelamento_origem",
              "origem_parcelamento",
              "origem",
              "origem_parcela",
            ]) || null,
        };
        return card;
      })
      .filter((card) => this.aplicarFiltrosCard(card, filtros));
  }

  /**
   * Agrupa cobranças por unidade (CNPJ ou CPF) - VERSÃO CORRIGIDA
   */
  private agruparCobrancasPorUnidade(
    cobrancas: any[],
    filtros: FiltrosKanban
  ): CardCobranca[] {
    const cardsMap = new Map<
      string,
      CardCobranca & { _statusList?: string[]; _observacoesList?: string[] }
    >();
    cobrancas.forEach((cobranca) => {
      // Se for parcela, não agrupa - cada parcela deve ser exibida individualmente
      if (cobranca.is_parcela) {
        return; // será tratada por criarCardsIndividuais separadamente
      }

      // LÓGICA CPF: A chave de agrupamento é o CNPJ ou, se não houver, o CPF.
      const chaveUnidade = cobranca.cnpj || cobranca.cpf;
      if (!chaveUnidade) return; // Ignora cobranças sem um documento

      if (!cardsMap.has(chaveUnidade)) {
        const unidade = cobranca.unidades_franqueadas;
        cardsMap.set(chaveUnidade, {
          id: chaveUnidade, // A ID do card agrupado é o próprio documento
          codigo_unidade: unidade?.codigo_unidade || chaveUnidade,
          nome_unidade:
            unidade?.nome_unidade || cobranca.cliente || "Franqueado(a)",
          cnpj: cobranca.cnpj || "",
          cpf: cobranca.cpf || "",
          tipo_debito: "Franchising - Royalties",
          valor_total: 0,
          valor_original: 0,
          data_vencimento_antiga: cobranca.data_vencimento,
          data_vencimento_recente: cobranca.data_vencimento,
          status_atual: "em_aberto",
          ultima_acao: "Cobranças agrupadas",
          data_ultima_acao: cobranca.created_at || new Date().toISOString(),
          responsavel_atual: "Equipe Cobrança",
          dias_parado: 0,
          criticidade: "normal",
          data_entrada_etapa: cobranca.created_at || new Date().toISOString(),
          quantidade_titulos: 0,
          _statusList: [],
          _observacoesList: [],
          observacoes: "",
        } as any);
      }

      const card = cardsMap.get(chaveUnidade)!;
      const valorAtual = cobranca.valor_atualizado || cobranca.valor_original;
      card.valor_total += valorAtual;
      card.valor_original =
        (card.valor_original || 0) + (cobranca.valor_original || 0);
      card.quantidade_titulos = (card.quantidade_titulos || 0) + 1;

      if (
        new Date(cobranca.data_vencimento) <
        new Date(card.data_vencimento_antiga)
      ) {
        card.data_vencimento_antiga = cobranca.data_vencimento;
      }
      if (
        new Date(cobranca.data_vencimento) >
        new Date(card.data_vencimento_recente)
      ) {
        card.data_vencimento_recente = cobranca.data_vencimento;
      }

      const statusAtual = this.determinarStatusKanban(cobranca.status);
      card._statusList!.push(statusAtual);
      if (cobranca.observacoes) {
        card._observacoesList!.push(cobranca.observacoes);
      }

      if (new Date(cobranca.created_at) > new Date(card.data_ultima_acao)) {
        card.data_ultima_acao = cobranca.created_at;
        card.ultima_acao = this.determinarUltimaAcao(cobranca);
      }
    });

    const cards = Array.from(cardsMap.values()).map((card) => {
      let statusFinal = "em_aberto";
      if (card._statusList && card._statusList.length > 0) {
        const unique = new Set(card._statusList);
        if (unique.size === 1) {
          statusFinal = card._statusList[0];
        } else {
          statusFinal = "misto";
        }
      }

      const observacaoFinal =
        card._observacoesList?.find((obs) => obs && obs.trim() !== "") || "";
      const cobrancasDoCard = cobrancas.filter(
        (c) => (c.cnpj || c.cpf) === (card.cnpj || card.cpf)
      );

      // Removendo as propriedades temporárias e garantindo a tipagem correta
      const finalCard: CardCobranca = {
        ...card,
        tipo_debito: this.determinarTipoDebito(cobrancasDoCard),
        criticidade: this.determinarCriticidade(card),
        status_atual: statusFinal,
        observacoes: observacaoFinal,
      };

      delete (finalCard as any)._statusList;
      delete (finalCard as any)._observacoesList;

      return finalCard;
    });

    // Ordena os cards alfabeticamente pelo nome da unidade
    const cardsFiltrados = cards.filter((card) => this.aplicarFiltrosCard(card, filtros));
    return cardsFiltrados.sort((a, b) => {
      return a.nome_unidade.localeCompare(b.nome_unidade, 'pt-BR');
    });
    const cardsFiltrados = cards.filter((card) => this.aplicarFiltrosCard(card, filtros));
    return cardsFiltrados.sort((a, b) => {
      return a.nome_unidade.localeCompare(b.nome_unidade, 'pt-BR');
    });
  }

  /**
   * Registra a movimentação de um Card.
   * @param cardOrUnitId - O UUID da cobrança ou o CNPJ/CPF da unidade.
   * @param statusOrigem - O status da coluna de onde o card está saindo.
   * @param novoStatus - O status da coluna para onde o card está indo.
   * @param usuario - O usuário que está realizando a ação.
   * @param motivo - O motivo da movimentação.
   */
  async moverCard(
    cardOrUnitId: string,
    statusOrigem: string,
    novoStatus: string,
    usuario: string,
    motivo: string
  ): Promise<void> {
    try {
      console.log(
        `🔄 Iniciando movimentação de ${cardOrUnitId} de '${statusOrigem}' para '${novoStatus}'`
      );

      const isMovingToQuitado = novoStatus === "quitado";
      const isMovingFromQuitado = statusOrigem === "quitado";
      const isIndividualMove =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          cardOrUnitId
        );

      // ===== LÓGICA DE FILTRO CORRIGIDA =====
      // Cria um filtro OR para cobrir tanto CNPJ quanto CPF quando for um movimento de unidade
      const unitFilter = `cnpj.eq.${cardOrUnitId},cpf.eq.${cardOrUnitId}`;

      // --- CENÁRIO 1: Movendo PARA a coluna 'Quitado' ---
      if (isMovingToQuitado && !isMovingFromQuitado) {
        const query = supabase.from("cobrancas_franqueados").select("*");
        const { data: cobrancas, error: fetchError } = isIndividualMove
          ? await query.eq("id", cardOrUnitId)
          : await query.or(unitFilter);

        if (fetchError)
          throw new Error(
            `Erro ao buscar cobranças para quitar: ${fetchError.message}`
          );
        if (!cobrancas || cobrancas.length === 0)
          throw new Error("Cobrança(s) de origem não encontrada(s).");

        const cobrancasParaQuitar = cobrancas.map((c) => {
          c.status = "quitado";
          delete (c as any).kanban_manual_change;
          return c;
        });

        const { error: insertError } = await supabase
          .from("cobrancas_quitadas")
          .insert(cobrancasParaQuitar);
        if (insertError)
          throw new Error(
            `Erro ao inserir em cobranças quitadas: ${insertError.message}`
          );

        const idsParaDeletar = cobrancas.map((c) => c.id);
        const { error: deleteError } = await supabase
          .from("cobrancas_franqueados")
          .delete()
          .in("id", idsParaDeletar);
        if (deleteError)
          throw new Error(
            `Erro ao deletar de cobranças franqueados: ${deleteError.message}`
          );

        console.log(
          `✅ ${cobrancas.length} cobrança(s) movida(s) para a tabela de quitadas.`
        );
      }

      // --- CENÁRIO 2: Movendo DE VOLTA da coluna 'Quitado' ---
      else if (isMovingFromQuitado && !isMovingToQuitado) {
        const query = supabase.from("cobrancas_quitadas").select("*");
        const { data: cobrancas, error: fetchError } = isIndividualMove
          ? await query.eq("id", cardOrUnitId)
          : await query.or(unitFilter);

        if (fetchError)
          throw new Error(
            `Erro ao buscar cobranças para reabrir: ${fetchError.message}`
          );
        if (!cobrancas || cobrancas.length === 0)
          throw new Error(
            "Cobrança(s) quitada(s) de origem não encontrada(s)."
          );

        const cobrancasParaReabrir = cobrancas.map((c) => {
          c.status = this.mapearStatusKanbanParaCobranca(novoStatus);
          return c;
        });

        const { error: insertError } = await supabase
          .from("cobrancas_franqueados")
          .insert(cobrancasParaReabrir);
        if (insertError)
          throw new Error(
            `Erro ao inserir de volta em cobranças franqueados: ${insertError.message}`
          );

        const idsParaDeletar = cobrancas.map((c) => c.id);
        const { error: deleteError } = await supabase
          .from("cobrancas_quitadas")
          .delete()
          .in("id", idsParaDeletar);
        if (deleteError)
          throw new Error(
            `Erro ao deletar de cobranças quitadas: ${deleteError.message}`
          );

        console.log(
          `✅ ${cobrancas.length} cobrança(s) retornada(s) para a tabela de franqueados.`
        );
      }

      // --- CENÁRIO 3: Movimentação padrão (dentro de cobranças_franqueados) ---
      else if (!isMovingToQuitado && !isMovingFromQuitado) {
        const novoStatusMapeado =
          this.mapearStatusKanbanParaCobranca(novoStatus);
        const query = supabase
          .from("cobrancas_franqueados")
          .update({ status: novoStatusMapeado, kanban_manual_change: true });

        const { error: updateError } = isIndividualMove
          ? await query.eq("id", cardOrUnitId)
          : await query.or(unitFilter);

        if (updateError)
          throw new Error(`Erro ao atualizar status: ${updateError.message}`);

        console.log(
          `✅ Status de ${cardOrUnitId} atualizado para ${novoStatusMapeado}.`
        );
      } else {
        console.log(
          "Movimentação na mesma tabela de origem, nenhuma ação de migração necessária."
        );
      }

      await this.registrarMovimentacao({
        card_id: cardOrUnitId,
        status_origem: statusOrigem,
        status_destino: novoStatus,
        usuario,
        motivo,
        data_movimentacao: new Date().toISOString(),
        automatica: false,
      });
    } catch (error) {
      console.error("❌ Erro fatal ao mover card:", error);
      throw error;
    }
  }

  /**
   * Executa ação rápida em um card
   */
  async executarAcaoRapida(
    cardId: string,
    acao: string,
    usuario: string,
    agrupadoPorUnidade: boolean = false
  ): Promise<void> {
    try {
      const cards = await this.buscarCards({}, agrupadoPorUnidade);
      const card = cards.find((c) => c.id === cardId);

      if (!card) {
        throw new Error("Card não encontrado");
      }

      let novoStatus = card.status_atual;
      let descricaoAcao = "";

      switch (acao) {
        case "whatsapp":
          descricaoAcao = "Mensagem WhatsApp enviada";
          if (card.status_atual === "em_aberto") {
            novoStatus = "em_negociacao"; // Exemplo de mudança de status
          }
          break;
        default:
          descricaoAcao = `Ação ${acao} executada`;
      }

      if (novoStatus !== card.status_atual) {
        await this.moverCard(
          cardId,
          card.status_atual,
          novoStatus,
          usuario,
          descricaoAcao
        );
      } else {
        await this.registrarLog({
          card_id: cardId,
          acao: acao,
          usuario: usuario,
          data_acao: new Date().toISOString(),
          detalhes: descricaoAcao,
        });
      }
    } catch (error) {
      console.error("Erro ao executar ação rápida:", error);
      throw error;
    }
  }

  /**
   * Atualiza observação de um card ou de todas as cobranças de uma unidade
   */
  async atualizarObservacao(
    id: string, // Pode ser o UUID da cobrança ou o CNPJ da unidade
    observacao: string,
    _usuario: string, // _usuario para indicar que não será usado diretamente aqui
    agrupadoPorUnidade: boolean = false
  ): Promise<void> {
    try {
      if (agrupadoPorUnidade) {
        // Se for uma unidade, atualiza a observação em TODAS as cobranças com o mesmo CNPJ
        console.log(
          `Atualizando observação para todas as cobranças do CNPJ: ${id}`
        );
        const { error } = await supabase
          .from("cobrancas_franqueados")
          .update({ observacoes: observacao })
          .or(`cnpj.eq.${id},cpf.eq.${id}`); // O 'id' aqui é o CNPJ ou CPF

        if (error) {
          throw new Error(
            `Erro ao atualizar observações da unidade: ${error.message}`
          );
        }
      } else {
        // Se for uma cobrança individual, atualiza apenas ela
        console.log(`Atualizando observação para a cobrança ID: ${id}`);
        const { error } = await supabase
          .from("cobrancas_franqueados")
          .update({ observacoes: observacao })
          .eq("id", id); // O 'id' aqui é o UUID

        if (error) {
          throw new Error(
            `Erro ao atualizar observação individual: ${error.message}`
          );
        }
      }
      console.log("✅ Observação salva com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao atualizar observação:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas do Kanban
   */
  async buscarEstatisticas(
    _agruparPorUnidade?: boolean
  ): Promise<EstatisticasKanban> {
    try {
      void _agruparPorUnidade;
      // Busca todas as cobranças diretamente do banco, sem agrupamento
      const { data: brutas } = await supabase
        .from("cobrancas_franqueados")
        .select("valor_original, status")
        .range(0, 5000);
      // Considera apenas cobranças realmente em aberto
      const abertas = (brutas || []).filter(
        (c: any) => c.status !== "quitado" && c.status !== "perda"
      );
      const totalOriginalAberto = abertas.reduce(
        (sum: number, c: any) => sum + (Number(c.valor_original) || 0),
        0
      );
      // O restante permanece igual
      const cards = await this.buscarCards({}, false);
      const inadimplentesPerda = cards.filter(
        (c) => c.status_atual === "inadimplencia" || c.status_atual === "perda"
      ).length;
      const stats: EstatisticasKanban = {
        total_cards: cards.length,
        cards_criticos: cards.filter((c) => c.criticidade === "critica").length,
        inadimplentes_perda: inadimplentesPerda,
        valor_total_fluxo: cards.reduce((sum, c) => sum + c.valor_total, 0),
        valor_total_original_aberto: totalOriginalAberto,
        valor_total_atualizado_aberto: 0, // não usado
        distribuicao_por_status: {},
      };
      cards.forEach((card) => {
        stats.distribuicao_por_status[card.status_atual] =
          (stats.distribuicao_por_status[card.status_atual] || 0) + 1;
      });
      return stats;
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      return {
        total_cards: 0,
        cards_criticos: 0,
        inadimplentes_perda: 0,
        valor_total_fluxo: 0,
        distribuicao_por_status: {},
      };
    }
  }

  /**
   * Exporta dados do Kanban
   */
  async exportarKanban(
    filtros: FiltrosKanban = {},
    agrupadoPorUnidade: boolean = false
  ): Promise<string> {
    try {
      const cards = await this.buscarCards(filtros, agrupadoPorUnidade);

      const cabecalho = [
        "ID",
        "Código Unidade",
        "Nome Unidade",
        "CNPJ",
        "Tipo Débito",
        "Valor Total",
        "Status Atual",
        "Responsável",
        "Dias Parado",
        "Última Ação",
        "Data Última Ação",
        "Criticidade",
        agrupadoPorUnidade ? "Qtd Títulos" : "Descrição",
      ].join(",");

      const linhas = cards.map((card) =>
        [
          card.id,
          card.codigo_unidade,
          card.nome_unidade,
          card.cnpj,
          card.tipo_debito,
          card.valor_total.toFixed(2),
          card.status_atual,
          card.responsavel_atual,
          card.ultima_acao.replace(/,/g, ";"),
          new Date(card.data_ultima_acao).toLocaleDateString("pt-BR"),
          card.criticidade,
          agrupadoPorUnidade
            ? card.quantidade_titulos || 1
            : card.descricao_cobranca || "",
        ].join(",")
      );

      return [cabecalho, ...linhas].join("\n");
    } catch (error) {
      console.error("Erro ao exportar Kanban:", error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private determinarTipoDebito(
    cobrancas: any[]
  ):
    | "Franchising - Royalties"
    | "Vendas - Vendas"
    | "Franchising - Tx de Propagand"
    | "- Multa/Infração"
    | "Franchising - Tx de Franquia" {
    const tipos = cobrancas.map(
      (c) => c.tipo_cobranca || "Franchising - Royalties"
    );
    const contagem = tipos.reduce(
      (acc: Record<string, number>, tipo: string) => {
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const tipoMaisFrequente = Object.entries(contagem).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0]?.[0];

    return (tipoMaisFrequente as any) || "";
  }

  private determinarStatusKanban(statusCobranca: string): string {
    const mapeamento: Record<string, string> = {
      em_aberto: "em_aberto",
      em_negociacao: "em_negociacao",
      negociando: "em_negociacao",
      parcelado: "parcelado",
      parcelas: "parcelas",
      quitado: "quitado",
      juridico: "juridico",
      inadimplencia: "inadimplencia",
      perda: "perda",
      escalado_juridico: "juridico",
      em_tratativa_juridica: "juridico",
      inadimplencia_critica: "inadimplencia",
    };
    if (!(statusCobranca in mapeamento)) {
      console.warn("Status desconhecido no Kanban:", statusCobranca);
      return statusCobranca; // Retorna o status original, nunca força em_aberto
    }
    return mapeamento[statusCobranca];
  }

  private mapearStatusKanbanParaCobranca(statusKanban: string): string {
    // Não converte mais status, apenas retorna o mesmo status (identidade)
    return statusKanban;
  }

  private determinarResponsavel(status: string): string {
    const responsaveis: Record<string, string> = {
      em_aberto: "Equipe Cobrança",
      negociando: "Equipe Cobrança",
      em_tratativa_juridica: "Jurídico",
    };
    return responsaveis[status] || "Equipe Cobrança";
  }

  private determinarUltimaAcao(cobranca: any): string {
    const acoes: Record<string, string> = {
      em_aberto: "Cobrança atrasada em sistema",
      negociando: "Em processo de negociação",
      parcelado: "Cobrança parcelada",
      parcelas: "Parcela de parcelamento",
      quitado: "Débito quitado",
      em_tratativa_juridica: "Escalado para jurídico",
    };
    return acoes[cobranca.status] || "Cobrança registrada no sistema";
  }

  private determinarCriticidade(
    card: CardCobranca
  ): "normal" | "atencao" | "critica" {
    if (
      card.tipo_debito === "Franchising - Royalties" ||
      card.quantidade_titulos >= 2
    )
      return "critica";
    if (card.valor_total > 9000) return "atencao";
    return "normal";
  }

  private determinarCriticidadeIndividual(
    dataVencimento: string
  ): "normal" | "atencao" | "critica" {
    const diasAtraso = this.calcularDiasAtraso(dataVencimento);

    if (diasAtraso > 30) return "critica";
    if (diasAtraso >= 20) return "atencao";
    return "normal";
  }

  private calcularDiasAtraso(dataVencimento: string): number {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diferenca = hoje.getTime() - vencimento.getTime();
    return Math.max(0, Math.floor(diferenca / (1000 * 60 * 60 * 24)));
  }

  private aplicarFiltrosCard(
    card: CardCobranca,
    filtros: FiltrosKanban
  ): boolean {
    if (filtros.tipo_debito && card.tipo_debito !== filtros.tipo_debito)
      return false;
    if (
      filtros.responsavel &&
      !card.responsavel_atual
        .toLowerCase()
        .includes(filtros.responsavel.toLowerCase())
    )
      return false;
    if (filtros.criticidade && card.criticidade !== filtros.criticidade)
      return false;
    return true;
  }

  private async registrarMovimentacao(
    movimentacao: MovimentacaoCard
  ): Promise<void> {
    try {
      // Em um sistema real, isso seria salvo em uma tabela específica
      console.log("Movimentação registrada:", movimentacao);
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
    }
  }

  private async registrarLog(log: LogMovimentacao): Promise<void> {
    try {
      // Em um sistema real, isso seria salvo em uma tabela específica
      console.log("Log registrado:", log);
    } catch (error) {
      console.error("Erro ao registrar log:", error);
    }
  }
}
