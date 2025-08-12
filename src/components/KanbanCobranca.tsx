/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, } from "react-beautiful-dnd";
import { MessageSquare, Calendar, DollarSign, AlertTriangle, Filter, Download, RefreshCw, Edit, X, Save, CircleDollarSign, Lock, } from "lucide-react";
import { KanbanService } from "../services/kanbanService";
import { CardCobranca, ColunaKanban, FiltrosKanban, EstatisticasKanban, } from "../types/kanban";
import { formatarCNPJCPF, formatarMoeda, formatarData, } from "../utils/formatters";
import { supabase } from "../lib/supabaseClient";
import { n8nService } from "../services/n8nService";

type UnitKanbanCard = {
  codigo_unidade: string;
  nome_unidade: string;
  cnpj: string;
  tipo_debito: string;
  data_vencimento_antiga: string;
  valor_total: number;
  status_atual: string;
  responsavel_atual: string;
  dias_parado: number;
  charges: CardCobranca[];
  observacoes?: string;
};

export function KanbanCobranca() {
  const [colunas, setColunas] = useState<ColunaKanban[]>([]);
  const [cards, setCards] = useState<CardCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosKanban>({});
  const [estatisticas, setEstatisticas] = useState<EstatisticasKanban | null>(null);
  const [unitSelecionada, setUnitSelecionada] = useState<UnitKanbanCard | null>(null);
  const [modalAberto, setModalAberto] = useState<"detalhes" | "acao" | "observacao" | null>(null);
  const [observacaoEditando, setObservacaoEditando] = useState("");
  const [processando, setProcessando] = useState(false);
  const [aba, setAba] = useState<"unidade" | "individual">("unidade");
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<CardCobranca | null>(null);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [movimentoPendente, setMovimentoPendente] = useState<DropResult | null>(null);
  const [movimentacaoIndividualFeita, setMovimentacaoIndividualFeita] = useState(false);
  const [unidadesComStatusMisto, setUnidadesComStatusMisto] = useState< Set<string> >(new Set());
  const [showMixedStatusWarning, setShowMixedStatusWarning] = useState(false);
  const [todasCobrancasUnidade, setTodasCobrancasUnidade] = useState< CardCobranca[] >([]);
  const [filtrosAvancados, setFiltrosAvancados] = useState({ nomeUnidade: "", cnpj: "", codigo: "", statusCobranca: "", valorMin: "", valorMax: "", tipoCobranca: "", });
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false);
  const [quantidadesTotaisPorUnidade, setQuantidadesTotaisPorUnidade] = useState<Record<string, number>>({});
  const [modalConfirmacaoWhatsAppUnidade, setModalConfirmacaoWhatsAppUnidade] = useState(false);
  const [unidadeParaWhatsApp, setUnidadeParaWhatsApp] = useState<UnitKanbanCard | null>(null);
  const kanbanService = new KanbanService();

  // Função para limpar estados do modal
  const limparEstadosModal = () => {
    setUnitSelecionada(null);
    setCobrancaSelecionada(null);
    setTodasCobrancasUnidade([]);
    setObservacaoEditando("");
    setModalAberto(null);
    setModalConfirmacaoWhatsAppUnidade(false);
    setUnidadeParaWhatsApp(null);
  };

  // Função para obter quantidade total de cobranças de uma unidade
  const obterQuantidadeTotalCobrancas = (cnpj: string): number => {
    return quantidadesTotaisPorUnidade[cnpj] || 0;
  };

  // Função para detectar unidades com status misto
  const detectarUnidadesComStatusMisto = async (): Promise<Set<string>> => {
    try {
      const { data: cobrancas, error } = await supabase
        .from("cobrancas_franqueados")
        .select("cnpj, status")
        .neq("status", "quitado"); // Ignora quitados para análise

      if (error) {
        console.error("Erro ao detectar status misto:", error);
        return new Set();
      }

      const unidadesMistas = new Set<string>();
      const statusPorUnidade = new Map<string, Set<string>>();

      // Agrupa status por unidade
      cobrancas?.forEach((cobranca) => {
        if (!statusPorUnidade.has(cobranca.cnpj)) {
          statusPorUnidade.set(cobranca.cnpj, new Set());
        }
        statusPorUnidade.get(cobranca.cnpj)!.add(cobranca.status);
      });

      // Identifica unidades com múltiplos status
      statusPorUnidade.forEach((statusSet, cnpj) => {
        if (statusSet.size > 1) {
          unidadesMistas.add(cnpj);
        }
      });

      return unidadesMistas;
    } catch (error) {
      console.error("Erro ao detectar unidades com status misto:", error);
      return new Set();
    }
  };

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      // Converte filtros avançados para o formato esperado pelo serviço
      const filtrosServico: FiltrosKanban = {};

      if (filtrosAvancados.tipoCobranca) {
        filtrosServico.tipo_debito = filtrosAvancados.tipoCobranca as any;
      }

      if (filtrosAvancados.valorMin) {
        filtrosServico.valor_min = parseFloat(filtrosAvancados.valorMin);
      }

      if (filtrosAvancados.valorMax) {
        filtrosServico.valor_max = parseFloat(filtrosAvancados.valorMax);
      }

      const [colunasData, cardsData, statsData] = await Promise.all([
        kanbanService.buscarColunas(),
        kanbanService.buscarCards(filtrosServico, aba === "unidade"),
        kanbanService.buscarEstatisticas(aba === "unidade"),
      ]);
      setColunas(colunasData);

      // Aplica filtros locais que não são suportados pelo serviço
      let cardsFiltrados = cardsData;

      if (filtrosAvancados.nomeUnidade) {
        cardsFiltrados = cardsFiltrados.filter((card) =>
          card.nome_unidade
            .toLowerCase()
            .includes(filtrosAvancados.nomeUnidade.toLowerCase())
        );
      }

      if (filtrosAvancados.cnpj) {
        cardsFiltrados = cardsFiltrados.filter((card) =>
          card.cnpj.includes(filtrosAvancados.cnpj)
        );
      }

      if (filtrosAvancados.codigo) {
        cardsFiltrados = cardsFiltrados.filter((card) =>
          card.codigo_unidade
            .toLowerCase()
            .includes(filtrosAvancados.codigo.toLowerCase())
        );
      }

      if (filtrosAvancados.statusCobranca) {
        cardsFiltrados = cardsFiltrados.filter(
          (card) => card.status_atual === filtrosAvancados.statusCobranca
        );
      }

      setCards(cardsFiltrados);
      setEstatisticas(statsData);

      // Calcula quantidades totais de cobranças por unidade
      if (aba === "unidade") {
        // Busca todas as cobranças (sem filtros) para calcular totais corretos
        const todasCobrancasSemFiltro = await kanbanService.buscarCards(
          {},
          false
        );
        const quantidadesPorUnidade: Record<string, number> = {};

        todasCobrancasSemFiltro.forEach((card) => {
          const key = card.cnpj; // Usando CNPJ como chave única da unidade
          quantidadesPorUnidade[key] = (quantidadesPorUnidade[key] || 0) + 1;
        });

        setQuantidadesTotaisPorUnidade(quantidadesPorUnidade);
      }

      // Detecta unidades com status misto automaticamente
      if (aba === "unidade") {
        const unidadesMistas = await detectarUnidadesComStatusMisto();
        setUnidadesComStatusMisto(unidadesMistas);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dados do Kanban:", error);
      alert("Erro ao carregar dados do Kanban. Verifique a conexão.");
    } finally {
      setCarregando(false);
    }
  }, [filtros, aba, filtrosAvancados]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    carregarDados();
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltrosAvancados({
      nomeUnidade: "",
      cnpj: "",
      codigo: "",
      statusCobranca: "",
      valorMin: "",
      valorMax: "",
      tipoCobranca: "",
    });
    setFiltros({});
    carregarDados();
  };

  // Agrupa cards por unidade
  const getUnitCardsByColuna = (colunaId: string): UnitKanbanCard[] => {
    const filtered = cards.filter((card) => card.status_atual === colunaId);
    const unitMap: Record<string, UnitKanbanCard> = {};

    filtered.forEach((card) => {
      if (!unitMap[card.codigo_unidade]) {
        unitMap[card.codigo_unidade] = {
          codigo_unidade: card.codigo_unidade,
          nome_unidade: card.nome_unidade,
          cnpj: card.cnpj,
          tipo_debito: card.tipo_debito,
          data_vencimento_antiga: card.data_vencimento_antiga,
          valor_total: 0,
          status_atual: card.status_atual,
          responsavel_atual: card.responsavel_atual,
          dias_parado: card.dias_parado,
          charges: [],
          observacoes: card.observacoes,
        };
      }
      unitMap[card.codigo_unidade].charges.push(card);
      unitMap[card.codigo_unidade].valor_total += card.valor_total;

      if (
        !unitMap[card.codigo_unidade].data_vencimento_antiga ||
        new Date(card.data_vencimento_antiga) <
          new Date(unitMap[card.codigo_unidade].data_vencimento_antiga)
      ) {
        unitMap[card.codigo_unidade].data_vencimento_antiga =
          card.data_vencimento_antiga;
      }

      if (card.dias_parado > unitMap[card.codigo_unidade].dias_parado) {
        unitMap[card.codigo_unidade].dias_parado = card.dias_parado;
      }

      if (card.observacoes) {
        unitMap[card.codigo_unidade].observacoes = card.observacoes;
      }
    });

    return Object.values(unitMap);
  };

  // Handler para drag-and-drop agrupado por unidade
  const onDragEndUnidade = (result: DropResult) => {
    if (
      !result.destination ||
      result.source.droppableId === result.destination.droppableId
    ) {
      return;
    }

    // Verifica se é uma unidade com status misto no modo agrupado
    if (aba === "unidade" && unidadesComStatusMisto.has(result.draggableId)) {
      setShowMixedStatusWarning(true);
      return;
    }

    // Verifica se já houve movimentação individual e está tentando mover agrupado
    if (aba === "unidade" && movimentacaoIndividualFeita) {
      alert(
        "⚠️ ATENÇÃO: Você já moveu cobranças individuais nesta sessão.\n\n" +
          "Para evitar inconsistências, agora você deve trabalhar apenas no modo INDIVIDUAL.\n\n" +
          "Clique em 'Cobranças Individuais' para continuar movendo as cobranças uma por uma."
      );
      return;
    }

    setMovimentoPendente(result);
    setModalConfirmacaoAberto(true);
  };

  const confirmarMovimentoUnidade = async () => {
    if (!movimentoPendente || !movimentoPendente.destination) return;

    const { source, destination, draggableId } = movimentoPendente;
    console.log(
      `Movendo unidade: ${draggableId} de ${source.droppableId} para ${destination.droppableId}`
    );

    setProcessando(true);
    setModalConfirmacaoAberto(false);

    try {
      // Busca a unidade pelo codigo_unidade na coluna de origem
      const unit = getUnitCardsByColuna(source.droppableId).find(
        (u) => u.codigo_unidade === draggableId
      );

      if (!unit) {
        throw new Error(`Unidade ${draggableId} não encontrada na coluna ${source.droppableId}`);
      }

      console.log(
        `Movendo ${unit.charges.length} cobranças da unidade ${unit.nome_unidade}`
      );

      // CORREÇÃO: Buscar cobranças individuais usando KanbanService com modo individual
      // Em vez de usar cards do estado (que pode ter dados agrupados), busca diretamente do banco
      console.log(`Buscando cobranças individuais da unidade CNPJ: ${unit.cnpj}`);
      
      const todasCobrancasIndividuais = await kanbanService.buscarCards({}, false); // false = modo individual
      const cobrancasUnidade = todasCobrancasIndividuais.filter(card => card.cnpj === unit.cnpj);
      
      console.log(`Total de cobranças individuais encontradas para a unidade: ${cobrancasUnidade.length}`);
      
      if (cobrancasUnidade.length === 0) {
        throw new Error(`Nenhuma cobrança individual encontrada para a unidade ${unit.nome_unidade}`);
      }

      // Valida que todas as cobranças têm UUIDs válidos
      const cobrancasComUUIDInvalido = cobrancasUnidade.filter(card => 
        !card.id || card.id.length !== 36 || !card.id.includes('-')
      );
      
      if (cobrancasComUUIDInvalido.length > 0) {
        console.error('Cobranças com UUID inválido:', cobrancasComUUIDInvalido);
        throw new Error(`Encontradas ${cobrancasComUUIDInvalido.length} cobranças com UUID inválido`);
      }

      // Move todas as cobranças da unidade para o status de destino
      await Promise.all(
        cobrancasUnidade.map(async (card) => {
          console.log(`Movendo cobrança UUID: ${card.id} de ${card.status_atual} para ${destination!.droppableId}`);
          return kanbanService.moverCard(
            card.id, // UUID correto da cobrança individual
            destination!.droppableId,
            "usuario_atual",
            `Movimentação manual via Kanban (em massa) - Unidade: ${unit.nome_unidade}`
          );
        })
      );

      console.log(
        `Todas as ${cobrancasUnidade.length} cobranças da unidade ${unit.nome_unidade} foram movidas com sucesso`
      );

      // Recarrega os dados para refletir as mudanças
      await carregarDados();
      
    } catch (error) {
      console.error("Erro ao mover cobranças da unidade:", error);
      alert(`Erro ao mover unidade: ${error}`);
      // Recarrega os dados mesmo em caso de erro para garantir consistência
      await carregarDados();
    } finally {
      setProcessando(false);
      setMovimentoPendente(null);
    }
  };

  // Handler para drag-and-drop individual
  const onDragEndIndividual = async (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    console.log(
      `Movendo card individual: ${draggableId} de ${source.droppableId} para ${destination.droppableId}`
    );

    // Se está no modo individual, marca que houve movimentação individual
    if (aba === "individual") {
      setMovimentacaoIndividualFeita(true);
    }

    // Atualização otimista da UI: primeiro atualiza a UI localmente
    const originalCards = [...cards];
    const updatedCards = cards.map((card) =>
      card.id === draggableId
        ? { ...card, status_atual: destination.droppableId }
        : card
    );
    setCards(updatedCards);

    setProcessando(true);
    try {
      await kanbanService.moverCard(
        draggableId,
        destination.droppableId,
        "usuario_atual",
        "Movimentação manual via Kanban"
      );

      console.log(`Card ${draggableId} movido com sucesso`);
      // Não recarrega os dados imediatamente - mantém a atualização otimista
    } catch (error) {
      console.error("Erro ao mover cobrança, revertendo:", error);
      alert(`Erro ao mover cobrança: ${error}`);
      // Se falhar, reverte para o estado original
      setCards(originalCards);
    } finally {
      setProcessando(false);
    }
  };

  // Função para buscar todas as cobranças de uma unidade específica
  const buscarTodasCobrancasUnidade = async (cnpj: string) => {
    try {
      const todasCobrancas = await kanbanService.buscarCards({}, false); // Busca todas as cobranças individuais
      const cobrancasUnidade = todasCobrancas.filter(
        (card) => card.cnpj === cnpj
      );
      setTodasCobrancasUnidade(cobrancasUnidade);

      // Atualiza o mapa de quantidades para garantir que esteja sincronizado
      setQuantidadesTotaisPorUnidade((prev) => ({
        ...prev,
        [cnpj]: cobrancasUnidade.length,
      }));
    } catch (error) {
      console.error("Erro ao buscar todas as cobranças da unidade:", error);
      setTodasCobrancasUnidade([]);
    }
  };

  const executarAcao = async (cardId: string, acao: string) => {
    setProcessando(true);
    try {
      console.log(`Executando ação '${acao}' no card ${cardId}`);
      await kanbanService.executarAcaoRapida(
        cardId,
        acao,
        "usuario_atual",
        aba === "unidade"
      );
      carregarDados();
      limparEstadosModal();
      console.log(`Ação '${acao}' executada com sucesso`);
    } catch (error) {
      console.error("Erro ao executar ação:", error);
      alert(`Erro ao executar ação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const salvarObservacao = async () => {
    if (!observacaoEditando.trim()) return;

    setProcessando(true);
    try {
      const cardId = unitSelecionada?.codigo_unidade || cobrancaSelecionada?.id;
      if (cardId) {
        await kanbanService.atualizarObservacao(
          cardId,
          observacaoEditando,
          "usuario_atual",
          aba === "unidade"
        );
        carregarDados();
        limparEstadosModal();
      }
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      alert(`Erro ao salvar observação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const enviarWhatsAppCobranca = async (cobranca: CardCobranca) => {
    setProcessando(true);
    try {
      // Buscar telefone da unidade franqueada
      console.log(`Buscando telefone para CNPJ: ${cobranca.cnpj}`);

      const { data: unidade, error } = await supabase
        .from("unidades_franqueadas")
        .select("telefone_unidade")
        .eq("codigo_interno", cobranca.cnpj)
        .single();

      if (error) {
        console.error("Erro ao buscar unidade:", error);
        alert("Erro ao buscar informações da unidade para envio do WhatsApp.");
        return;
      }

      const telefoneRaw = unidade?.telefone_unidade;
      console.log(`Telefone bruto encontrado: ${telefoneRaw}`);

      // Criar mensagem personalizada para a cobrança individual
      const mensagem = `
🔔 *Notificação de Cobrança* 🔔

Prezado(a) ${cobranca.nome_unidade},

Identificamos uma cobrança pendente em sua conta:

💰 *Valor:* ${formatarMoeda(cobranca.valor_total)}
📅 *Vencimento:* ${formatarData(cobranca.data_vencimento_antiga)}
🏷️ *Tipo:* ${formatarTipoDebito(cobranca.tipo_debito)}
📋 *Status:* ${formatarStatusCobranca(cobranca.status_atual)}

Para regularizar sua situação, entre em contato conosco o mais breve possível.

_Equipe de Cobrança_
      `.trim();

      console.log(`Enviando WhatsApp para cobrança ${cobranca.id}`);

      // O n8nService agora valida e trata o telefone automaticamente
      const resultado = await n8nService.enviarWhatsApp({
        number: telefoneRaw,
        text: mensagem,
        instanceName: "automacoes_3",
        metadata: {
          cobrancaId: cobranca.id,
          cnpj: cobranca.cnpj,
          valor: cobranca.valor_total,
          tipo: "cobranca_individual",
          telefoneOriginal: telefoneRaw,
        },
      });

      if (resultado.success) {
        alert("✅ WhatsApp enviado com sucesso!");
        console.log(
          `WhatsApp enviado com sucesso. Message ID: ${resultado.messageId}`
        );

        // Opcional: registrar o envio no banco de dados
        // await registrarEnvioWhatsApp(cobranca.id, resultado.messageId);
      } else {
        throw new Error("Falha no envio do WhatsApp");
      }
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      alert(`❌ Erro ao enviar WhatsApp: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const enviarWhatsAppUnidade = async (unidade: UnitKanbanCard) => {
    setProcessando(true);
    try {
      // Buscar telefone da unidade franqueada
      console.log(`Buscando telefone para CNPJ: ${unidade.cnpj}`);

      const { data: unidadeData, error } = await supabase
        .from("unidades_franqueadas")
        .select("telefone_unidade")
        .eq("codigo_interno", unidade.cnpj)
        .single();

      if (error) {
        console.error("Erro ao buscar unidade:", error);
        alert("Erro ao buscar informações da unidade para envio do WhatsApp.");
        return;
      }

      const telefoneRaw = unidadeData?.telefone_unidade;
      console.log(`Telefone bruto encontrado: ${telefoneRaw}`);

      // Buscar todas as cobranças da unidade para a mensagem completa
      const todasCobrancas = await kanbanService.buscarCards({}, false);
      const cobrancasUnidade = todasCobrancas.filter(
        (card) => card.cnpj === unidade.cnpj
      );

      const valorTotalGeral = cobrancasUnidade.reduce(
        (total, cobranca) => total + cobranca.valor_total,
        0
      );
      const vencimentoMaisAntigo = cobrancasUnidade
        .map((c) => c.data_vencimento_antiga)
        .sort()[0];

      // Criar lista das cobranças para a mensagem
      const listaCobrancas = cobrancasUnidade
        .sort(
          (a, b) =>
            new Date(a.data_vencimento_antiga).getTime() -
            new Date(b.data_vencimento_antiga).getTime()
        )
        .map(
          (cobranca, index) =>
            `${index + 1}. ${formatarTipoDebito(
              cobranca.tipo_debito
            )} - ${formatarMoeda(cobranca.valor_total)} (Venc: ${formatarData(
              cobranca.data_vencimento_antiga
            )})`
        )
        .join("\n");

      // Criar mensagem personalizada para cobranças agrupadas
      const mensagem = `
🔔 *Notificação de Cobranças Pendentes* 🔔

Prezado(a) ${unidade.nome_unidade},

Identificamos ${cobrancasUnidade.length} cobrança(s) pendente(s) em sua conta:

💰 *Valor Total:* ${formatarMoeda(valorTotalGeral)}
📅 *Vencimento mais antigo:* ${formatarData(vencimentoMaisAntigo)}

*📋 Detalhamento das Cobranças:*
${listaCobrancas}

Para regularizar sua situação, entre em contato conosco o mais breve possível.

_Equipe de Cobrança_
      `.trim();

      console.log(
        `Enviando WhatsApp agrupado para unidade ${unidade.codigo_unidade}`
      );

      // O n8nService agora valida e trata o telefone automaticamente
      const resultado = await n8nService.enviarWhatsApp({
        number: telefoneRaw,
        text: mensagem,
        instanceName: "automacoes_3",
        metadata: {
          unidadeCodigo: unidade.codigo_unidade,
          cnpj: unidade.cnpj,
          valorTotal: valorTotalGeral,
          quantidadeCobrancas: cobrancasUnidade.length,
          tipo: "cobranca_agrupada",
          telefoneOriginal: telefoneRaw,
        },
      });

      if (resultado.success) {
        alert("✅ WhatsApp agrupado enviado com sucesso!");
        console.log(
          `WhatsApp agrupado enviado com sucesso. Message ID: ${resultado.messageId}`
        );
      } else {
        throw new Error("Falha no envio do WhatsApp");
      }
    } catch (error) {
      console.error("Erro ao enviar WhatsApp agrupado:", error);
      alert(`❌ Erro ao enviar WhatsApp agrupado: ${error}`);
    } finally {
      setProcessando(false);
      setModalConfirmacaoWhatsAppUnidade(false);
      setUnidadeParaWhatsApp(null);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await kanbanService.exportarKanban(
        filtros,
        aba === "unidade"
      );
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kanban-cobrancas-${aba}-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Erro ao exportar dados");
    }
  };

  const getCriticidadeColor = (criticidade: string, status?: string) => {
    // Se estiver quitado, sempre verde independente da criticidade
    if (status === "quitado") {
      return "border-green-500 bg-green-50";
    }
    
    switch (criticidade) {
      case "critica":
        return "border-red-500 bg-red-50";
      case "atencao":
        return "border-yellow-500 bg-yellow-50";
      default:
        return "border-gray-300 bg-white";
    }
  };

  const getCriticidadeBadge = (criticidade: string, status?: string) => {
    // Se estiver quitado, sempre verde independente da criticidade
    if (status === "quitado") {
      return "bg-green-100 text-green-800";
    }
    
    switch (criticidade) {
      case "critica":
        return "bg-red-100 text-red-800";
      case "atencao":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const getCriticidadeTexto = (criticidade: string, status?: string) => {
    // Se estiver quitado, mostra QUITADO
    if (status === "quitado") {
      return "QUITADO";
    }
    
    return criticidade?.toUpperCase() || "NORMAL";
  };

  const formatarStatusCobranca = (status: string) => {
    const statusMap: Record<string, string> = {
      em_aberto: "Em Aberto",
      notificado: "Notificado",
      reuniao_agendada: "Reunião Agendada",
      em_negociacao: "Em Negociação",
      proposta_enviada: "Proposta Enviada",
      aguardando_pagamento: "Aguardando Pagamento",
      pagamento_parcial: "Pagamento Parcial",
      quitado: "Quitado",
      ignorado: "Ignorado",
      notificacao_formal: "Notificação Formal",
      escalado_juridico: "Escalado Jurídico",
      inadimplencia_critica: "Inadimplência Crítica",
      cobrado: "Cobrado",
      negociando: "Negociando",
      em_tratativa_juridica: "Em Tratativa Jurídica",
      em_tratativa_critica: "Em Tratativa Crítica",
    };
    return (
      statusMap[status] ||
      status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  const formatarTipoDebito = (tipo: string) => {
    const tipoMap: Record<string, string> = {
      royalties: "Royalties",
      insumos: "Insumos",
      aluguel: "Aluguel",
      multa: "Multa",
      taxa: "Taxa",
      outros: "Outros",
    };
    return tipoMap[tipo] || tipo.replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderCardUnidade = (unit: UnitKanbanCard, index: number) => {
    const temStatusMisto = unidadesComStatusMisto.has(unit.cnpj);

    return (
      <Draggable
        key={unit.codigo_unidade}
        draggableId={unit.codigo_unidade}
        index={index}
        isDragDisabled={temStatusMisto}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`p-4 mb-3 rounded-lg border-2 cursor-pointer transition-all ${
              snapshot.isDragging ? "shadow-lg rotate-2" : "hover:shadow-md"
            } ${getCriticidadeColor(
              unit.charges[0]?.criticidade || "normal",
              unit.status_atual
            )} ${temStatusMisto ? "opacity-60" : ""}`}
            onClick={() => {
              // Limpa o estado da cobrança individual antes de abrir modal da unidade
              setCobrancaSelecionada(null);
              setUnitSelecionada(unit);
              // Busca todas as cobranças da unidade, não apenas as da coluna atual
              buscarTodasCobrancasUnidade(unit.cnpj);
              setModalAberto("detalhes");
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <CircleDollarSign className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">
                    {unit.nome_unidade}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {formatarCNPJCPF(unit.cnpj)}
                  </p>
                </div>
              </div>
              {temStatusMisto && (
                <div
                  className="flex items-center text-orange-600"
                  title="Unidade com status misto - bloqueada"
                >
                  <Lock className="w-4 h-4" />
                </div>
              )}
            </div>

            {temStatusMisto && (
              <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                ⚠️ Status misto detectado - use modo individual
              </div>
            )}

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor Total:</span>
                <span className="font-semibold text-red-600">
                  {formatarMoeda(unit.valor_total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cobranças:</span>
                <span className="font-medium">
                  {obterQuantidadeTotalCobrancas(unit.cnpj)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vencimento:</span>
                <span className="font-medium">
                  {formatarData(unit.data_vencimento_antiga)}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticidadeBadge(
                  unit.charges[0]?.criticidade || "normal",
                  unit.status_atual
                )}`}
              >
                {getCriticidadeTexto(unit.charges[0]?.criticidade || "normal", unit.status_atual)}
              </span>
              <span className="text-xs text-gray-500">
                {unit.responsavel_atual}
              </span>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const renderCardIndividual = (card: CardCobranca, index: number) => {
    return (
      <Draggable key={card.id} draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`p-4 mb-3 rounded-lg border-2 cursor-pointer transition-all ${
              snapshot.isDragging ? "shadow-lg rotate-2" : "hover:shadow-md"
            } ${getCriticidadeColor(card.criticidade, card.status_atual)}`}
            onClick={() => {
              // Limpa o estado da unidade antes de abrir modal da cobrança individual
              setUnitSelecionada(null);
              setTodasCobrancasUnidade([]);
              setCobrancaSelecionada(card);
              setModalAberto("detalhes");
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm">
                    {card.nome_unidade}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {formatarCNPJCPF(card.cnpj)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor:</span>
                <span className="font-semibold text-red-600">
                  {formatarMoeda(card.valor_total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vencimento:</span>
                <span className="font-medium">
                  {formatarData(card.data_vencimento_antiga)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <span className="font-medium">{card.tipo_debito}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getCriticidadeBadge(
                  card.criticidade,
                  card.status_atual
                )}`}
              >
                {getCriticidadeTexto(card.criticidade, card.status_atual)}
              </span>
              <span className="text-xs text-gray-500">
                {card.responsavel_atual}
              </span>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const unidadesMistasCount = unidadesComStatusMisto.size;

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <CircleDollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Kanban de Cobranças
              </h1>
              <p className="text-gray-600">
                Gestão visual do fluxo de cobrança
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_cards}
              </div>
              <div className="text-sm text-blue-800">Total de Cards</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">
                {estatisticas.cards_criticos}
              </div>
              <div className="text-sm text-red-800">Cards Críticos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.cards_parados}
              </div>
              <div className="text-sm text-yellow-800">Cards Parados</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatarMoeda(estatisticas.valor_total_fluxo)}
              </div>
              <div className="text-sm text-green-800">Valor Total</div>
            </div>
          </div>
        )}

        {/* Seletor de Modo */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  if (movimentacaoIndividualFeita) {
                    if (
                      confirm(
                        "⚠️ ATENÇÃO: Você moveu cobranças individuais nesta sessão.\n\n" +
                          "Alternar para modo agrupado pode causar inconsistências.\n\n" +
                          "Recomendamos recarregar a página antes de usar o modo agrupado.\n\n" +
                          "Deseja continuar mesmo assim?"
                      )
                    ) {
                      setAba("unidade");
                      setMovimentacaoIndividualFeita(false);
                    }
                  } else {
                    setAba("unidade");
                  }
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  aba === "unidade"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-800"
                } ${movimentacaoIndividualFeita ? "opacity-50" : ""}`}
                disabled={movimentacaoIndividualFeita}
                title={
                  movimentacaoIndividualFeita
                    ? "Modo bloqueado - houve movimentação individual"
                    : ""
                }
              >
                Por Unidade
                {unidadesMistasCount > 0 && (
                  <span className="ml-2 px-2 py-1 bg-orange-500 text-white rounded-full text-xs">
                    {unidadesMistasCount} bloqueadas
                  </span>
                )}
                {movimentacaoIndividualFeita && (
                  <Lock className="w-4 h-4 ml-2" />
                )}
              </button>
              <button
                onClick={() => setAba("individual")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  aba === "individual"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                Por Cobrança
                {movimentacaoIndividualFeita && (
                  <span className="ml-2 px-2 py-1 bg-green-500 text-white rounded-full text-xs">
                    Ativo
                  </span>
                )}
              </button>
            </div>

            {movimentacaoIndividualFeita && (
              <div className="flex items-center px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-600 mr-2" />
                <span className="text-sm text-orange-800 font-medium">
                  Modo Individual Ativo - Continue movendo uma por uma
                </span>
              </div>
            )}
          </div>

          {/* Botão de Filtros */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFiltrosAvancados(!showFiltrosAvancados)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFiltrosAvancados ? "Ocultar Filtros" : "Mostrar Filtros"}
            </button>

            {(Object.values(filtrosAvancados).some((v) => v !== "") ||
              Object.values(filtros).some((v) => v !== "")) && (
              <button
                onClick={limparFiltros}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Filtros Avançados */}
        {showFiltrosAvancados && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Filter className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">
                Filtros Avançados
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Unidade
                </label>
                <input
                  type="text"
                  value={filtrosAvancados.nomeUnidade}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      nomeUnidade: e.target.value,
                    })
                  }
                  placeholder="Buscar por nome..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={filtrosAvancados.cnpj}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      cnpj: e.target.value,
                    })
                  }
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código da Unidade
                </label>
                <input
                  type="text"
                  value={filtrosAvancados.codigo}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      codigo: e.target.value,
                    })
                  }
                  placeholder="Código..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status da Cobrança
                </label>
                <select
                  value={filtrosAvancados.statusCobranca}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      statusCobranca: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os Status</option>
                  <option value="em_aberto">Em Aberto</option>
                  <option value="notificado">Notificado</option>
                  <option value="reuniao_agendada">Reunião Agendada</option>
                  <option value="em_negociacao">Em Negociação</option>
                  <option value="proposta_enviada">Proposta Enviada</option>
                  <option value="aguardando_pagamento">
                    Aguardando Pagamento
                  </option>
                  <option value="pagamento_parcial">Pagamento Parcial</option>
                  <option value="quitado">Quitado</option>
                  <option value="ignorado">Ignorado</option>
                  <option value="notificacao_formal">Notificação Formal</option>
                  <option value="escalado_juridico">Escalado Jurídico</option>
                  <option value="inadimplencia_critica">
                    Inadimplência Crítica
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Mínimo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filtrosAvancados.valorMin}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      valorMin: e.target.value,
                    })
                  }
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Máximo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filtrosAvancados.valorMax}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      valorMax: e.target.value,
                    })
                  }
                  placeholder="999.999,99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cobrança
                </label>
                <select
                  value={filtrosAvancados.tipoCobranca}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      tipoCobranca: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="royalties">Royalties</option>
                  <option value="insumos">Insumos</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="multa">Multa</option>
                  <option value="taxa">Taxa</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={aplicarFiltros}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>

            {/* Indicador de filtros ativos */}
            {Object.values(filtrosAvancados).some((v) => v !== "") && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <Filter className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    Filtros ativos:{" "}
                    {
                      Object.values(filtrosAvancados).filter((v) => v !== "")
                        .length
                    }
                  </span>
                </div>
                <button
                  onClick={limparFiltros}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpar todos
                </button>
              </div>
            )}
          </div>
        )}

        {/* Avisos */}
        {aba === "unidade" && unidadesMistasCount > 0 && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
              <div>
                <p className="text-orange-800 font-medium">
                  {unidadesMistasCount} unidade(s) com status misto detectada(s)
                </p>
                <p className="text-orange-700 text-sm">
                  Essas unidades estão bloqueadas no modo agrupado. Use o modo
                  "Por Cobrança" para movê-las individualmente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <DragDropContext
          onDragEnd={aba === "unidade" ? onDragEndUnidade : onDragEndIndividual}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {colunas
              .filter((col) => col.ativa)
              .map((coluna) => (
                <div key={coluna.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800 text-sm">
                      {coluna.nome}
                    </h3>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: coluna.cor }}
                    ></div>
                  </div>

                  <Droppable droppableId={coluna.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[200px] transition-colors ${
                          snapshot.isDraggingOver ? "bg-blue-50" : ""
                        }`}
                      >
                        {aba === "unidade"
                          ? getUnitCardsByColuna(coluna.id).map((unit, index) =>
                              renderCardUnidade(unit, index)
                            )
                          : cards
                              .filter((card) => card.status_atual === coluna.id)
                              .map((card, index) =>
                                renderCardIndividual(card, index)
                              )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
          </div>
        </DragDropContext>

        {carregando && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Carregando Kanban...</span>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Movimento */}
      {modalConfirmacaoAberto && movimentoPendente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              Confirmar Movimentação
            </h3>
            <p className="text-gray-700 mb-6">
              Deseja mover todas as cobranças desta unidade para a nova coluna?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={confirmarMovimentoUnidade}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Movendo..." : "Confirmar"}
              </button>
              <button
                onClick={() => {
                  setModalConfirmacaoAberto(false);
                  setMovimentoPendente(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Status Misto */}
      {showMixedStatusWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <Lock className="w-6 h-6 text-orange-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">
                Unidade Bloqueada
              </h3>
            </div>
            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                Esta unidade possui cobranças com status diferentes e não pode
                ser movida no modo agrupado.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-orange-800 text-sm font-medium">
                  💡 Solução: Use o modo "Por Cobrança" para mover as cobranças
                  individualmente.
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setAba("individual");
                  setShowMixedStatusWarning(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ir para Modo Individual
              </button>
              <button
                onClick={() => setShowMixedStatusWarning(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalAberto === "detalhes" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                {unitSelecionada ? (
                  <>
                    <CircleDollarSign className="w-6 h-6 text-blue-600 mr-2" />
                    <h3 className="text-lg font-semibold text-blue-800">
                      Detalhes da Unidade
                    </h3>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-6 h-6 text-green-600 mr-2" />
                    <h3 className="text-lg font-semibold text-green-800">
                      Detalhes da Cobrança
                    </h3>
                  </>
                )}
              </div>
              <button
                onClick={limparEstadosModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal de Unidade */}
            {unitSelecionada && !cobrancaSelecionada && (
              <div className="space-y-4">
                {/* Informações da Unidade */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">
                    Informações da Unidade
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Nome da Unidade
                      </label>
                      <p className="text-gray-800">
                        {unitSelecionada.nome_unidade}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        CNPJ
                      </label>
                      <p className="text-gray-800">
                        {formatarCNPJCPF(unitSelecionada.cnpj)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Valor Total
                      </label>
                      <p className="text-red-600 font-semibold">
                        {formatarMoeda(unitSelecionada.valor_total)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Quantidade de Cobranças
                      </label>
                      <p className="text-gray-800">
                        {obterQuantidadeTotalCobrancas(unitSelecionada.cnpj)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lista de Cobranças da Unidade */}
                {todasCobrancasUnidade.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">
                      Cobranças desta Unidade ({todasCobrancasUnidade.length})
                    </h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {todasCobrancasUnidade.map((cobranca, index) => (
                        <div
                          key={cobranca.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-800">
                                #{index + 1} -{" "}
                                {formatarMoeda(cobranca.valor_total)}
                              </span>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticidadeBadge(
                                  cobranca.criticidade,
                                  cobranca.status_atual
                                )}`}
                              >
                                {formatarStatusCobranca(cobranca.status_atual)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>
                                Venc:{" "}
                                {formatarData(cobranca.data_vencimento_antiga)}
                              </span>
                              <span>
                                {formatarTipoDebito(cobranca.tipo_debito)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações da Unidade */}
                {unitSelecionada.observacoes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">
                      Observações
                    </h4>
                    <p className="text-yellow-700 text-sm">
                      {unitSelecionada.observacoes}
                    </p>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="bg-white border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Ações para Toda a Unidade
                  </h4>
                  
                  {unitSelecionada.status_atual === "quitado" ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-green-600 font-bold">✓</span>
                        </div>
                        <div>
                          <p className="text-green-800 font-medium">Unidade Quitada</p>
                          <p className="text-green-700 text-sm">Todas as cobranças desta unidade foram quitadas. Não é possível realizar ações de cobrança.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setUnidadeParaWhatsApp(unitSelecionada);
                          setModalConfirmacaoWhatsAppUnidade(true);
                        }}
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() =>
                          executarAcao(unitSelecionada.codigo_unidade, "reuniao")
                        }
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Reunião
                      </button>
                      <button
                        onClick={() => {
                          setObservacaoEditando(
                            unitSelecionada.observacoes || ""
                          );
                          setModalAberto("observacao");
                        }}
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Observação
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal de Cobrança Individual */}
            {cobrancaSelecionada && !unitSelecionada && (
              <div className="space-y-4">
                {/* Informações da Cobrança Individual */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-3">
                    Detalhes da Cobrança
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Cliente
                      </label>
                      <p className="text-gray-800">
                        {cobrancaSelecionada.nome_unidade}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        CNPJ
                      </label>
                      <p className="text-gray-800">
                        {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Valor
                      </label>
                      <p className="text-red-600 font-semibold">
                        {formatarMoeda(cobrancaSelecionada.valor_total)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Vencimento
                      </label>
                      <p className="text-gray-800">
                        {formatarData(
                          cobrancaSelecionada.data_vencimento_antiga
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Status
                      </label>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticidadeBadge(
                          cobrancaSelecionada.criticidade,
                          cobrancaSelecionada.status_atual
                        )}`}
                      >
                        {formatarStatusCobranca(
                          cobrancaSelecionada.status_atual
                        )}
                      </span>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        Tipo
                      </label>
                      <p className="text-gray-800">
                        {formatarTipoDebito(cobrancaSelecionada.tipo_debito)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="bg-white border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">
                    Ações para Esta Cobrança
                  </h4>
                  
                  {cobrancaSelecionada.status_atual === "quitado" ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-green-600 font-bold">✓</span>
                        </div>
                        <div>
                          <p className="text-green-800 font-medium">Cobrança Quitada</p>
                          <p className="text-green-700 text-sm">Esta cobrança já foi quitada. Não é possível realizar ações.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex space-x-3">
                      <button
                        onClick={() =>
                          enviarWhatsAppCobranca(cobrancaSelecionada)
                        }
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        WhatsApp
                      </button>
                      <button
                        onClick={() =>
                          executarAcao(cobrancaSelecionada.id, "reuniao")
                        }
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Reunião
                      </button>
                      <button
                        onClick={() => {
                          setObservacaoEditando(
                            cobrancaSelecionada.observacoes || ""
                          );
                          setModalAberto("observacao");
                        }}
                        disabled={processando}
                        className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Observação
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Observação */}
      {modalAberto === "observacao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Adicionar Observação</h3>
              <button
                onClick={limparEstadosModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <textarea
              value={observacaoEditando}
              onChange={(e) => setObservacaoEditando(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Digite sua observação..."
            />

            <div className="flex space-x-3 mt-4">
              <button
                onClick={salvarObservacao}
                disabled={processando || !observacaoEditando.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2 inline" />
                {processando ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={limparEstadosModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação WhatsApp Unidade */}
      {modalConfirmacaoWhatsAppUnidade && unidadeParaWhatsApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <MessageSquare className="w-6 h-6 text-green-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-800">
                Confirmar Envio WhatsApp
              </h3>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-700">
                Esta ação irá enviar uma mensagem WhatsApp para a unidade{" "}
                <strong>{unidadeParaWhatsApp.nome_unidade}</strong> informando
                sobre <strong>todas as cobranças pendentes</strong>.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm">
                  <p>
                    <strong>Unidade:</strong> {unidadeParaWhatsApp.nome_unidade}
                  </p>
                  <p>
                    <strong>Quantidade de cobranças:</strong>{" "}
                    {obterQuantidadeTotalCobrancas(unidadeParaWhatsApp.cnpj)}
                  </p>
                  <p>
                    <strong>Valor total aproximado:</strong>{" "}
                    {formatarMoeda(unidadeParaWhatsApp.valor_total)}
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-yellow-800 text-sm font-medium">
                  ⚠️ A mensagem incluirá o detalhamento de todas as cobranças
                  pendentes da unidade.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => enviarWhatsAppUnidade(unidadeParaWhatsApp)}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? "Enviando..." : "Confirmar Envio"}
              </button>
              <button
                onClick={() => {
                  setModalConfirmacaoWhatsAppUnidade(false);
                  setUnidadeParaWhatsApp(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
