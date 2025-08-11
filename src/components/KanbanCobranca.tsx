/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, } from "react-beautiful-dnd";
import { 
  MessageSquare, Calendar, Scale, Mail,
  Clock, DollarSign, AlertTriangle, CheckCircle, User,
  Filter, Download, RefreshCw, Edit, X,
  Save, CircleDollarSign,
  Lock,
  Unlock,
  Info,
} from "lucide-react";
import { KanbanService } from "../services/kanbanService";
import { CardCobranca, ColunaKanban, FiltrosKanban, EstatisticasKanban, } from "../types/kanban";
import { formatarCNPJCPF, formatarMoeda, formatarData, } from "../utils/formatters";

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
  const [estatisticas, setEstatisticas] = useState<EstatisticasKanban | null>(
    null
  );
  const [unitSelecionada, setUnitSelecionada] = useState<UnitKanbanCard | null>(
    null
  );
  const [modalAberto, setModalAberto] = useState<
    "detalhes" | "acao" | "observacao" | null
  >(null);
  const [observacaoEditando, setObservacaoEditando] = useState("");
  const [processando, setProcessando] = useState(false);
  const [aba, setAba] = useState<"unidade" | "individual">("unidade");
  const [cobrancaSelecionada, setCobrancaSelecionada] =
    useState<CardCobranca | null>(null);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [movimentoPendente, setMovimentoPendente] = useState<DropResult | null>(
    null
  );
  const [movimentacaoIndividualFeita, setMovimentacaoIndividualFeita] = useState(false);
  const [unidadesComStatusMisto, setUnidadesComStatusMisto] = useState<Set<string>>(new Set());
  const [showMixedStatusWarning, setShowMixedStatusWarning] = useState(false);

  const kanbanService = new KanbanService();

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [colunasData, cardsData, statsData] = await Promise.all([
        kanbanService.buscarColunas(),
        kanbanService.buscarCards(filtros),
        kanbanService.buscarEstatisticas(),
      ]);
      setColunas(colunasData);
      setCards(cardsData);
      setEstatisticas(statsData);
      
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
  }, [filtros, aba]);

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  // Função para detectar unidades com status misto
  const detectarUnidadesComStatusMisto = async (): Promise<Set<string>> => {
    try {
      const { data: cobrancas, error } = await supabase
        .from('cobrancas_franqueados')
        .select('cnpj, status')
        .neq('status', 'quitado'); // Ignora quitados para análise

      if (error) {
        console.error('Erro ao detectar status misto:', error);
        return new Set();
      }

      const unidadesMistas = new Set<string>();
      const statusPorUnidade = new Map<string, Set<string>>();

      // Agrupa status por unidade
      cobrancas?.forEach(cobranca => {
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
      console.error('Erro ao detectar unidades com status misto:', error);
      return new Set();
    }
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
    if (!result.destination || result.source.droppableId === result.destination.droppableId) {
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
    console.log(`Movendo unidade: ${draggableId} de ${source.droppableId} para ${destination.droppableId}`);
    
    setProcessando(true);
    setModalConfirmacaoAberto(false);

    try {
      const unit = getUnitCardsByColuna(source.droppableId).find(
        (u) => u.codigo_unidade === draggableId
      );
      
      if (unit) {
        console.log(`Movendo ${unit.charges.length} cobranças da unidade ${unit.nome_unidade}`);
        
        await Promise.all(
          unit.charges.map((card) =>
            kanbanService.moverCard(
              card.id,
              destination!.droppableId,
              "usuario_atual",
              "Movimentação manual via Kanban (em massa)"
            )
          )
        );
        
        console.log(`Todas as cobranças da unidade ${unit.nome_unidade} foram movidas`);
        await carregarDados();
      } else {
        throw new Error(`Unidade ${draggableId} não encontrada`);
      }
    } catch (error) {
      console.error("Erro ao mover card da unidade:", error);
      alert(`Erro ao mover unidade: ${error}`);
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

    console.log(`Movendo card individual: ${draggableId} de ${source.droppableId} para ${destination.droppableId}`);

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

  const executarAcao = async (cardId: string, acao: string) => {
    setProcessando(true);
    try {
      console.log(`Executando ação '${acao}' no card ${cardId}`);
      await kanbanService.executarAcaoRapida(cardId, acao, "usuario_atual");
      carregarDados();
      setModalAberto(null);
      console.log(`Ação '${acao}' executada com sucesso`);
    } catch (error) {
      console.error("Erro ao executar ação:", error);
      alert(`Erro ao executar ação: ${error}`);
    } finally {
      setProcessando(false);
    }
  }
}