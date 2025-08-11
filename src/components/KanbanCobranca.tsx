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
  };

  const salvarObservacao = async () => {
    if (!unitSelecionada) return;

    setProcessando(true);
    try {
      await kanbanService.atualizarObservacao(
        unitSelecionada.codigo_unidade,
        observacaoEditando
      );
      carregarDados();
      setModalAberto(null);
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      alert(`Erro ao salvar observação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const renderCardUnidade = (unit: UnitKanbanCard, index: number) => {
    const temStatusMisto = unidadesComStatusMisto.has(unit.cnpj);
    const isBlocked = temStatusMisto;

    return (
      <Draggable
        key={unit.codigo_unidade}
        draggableId={unit.codigo_unidade}
        index={index}
        isDragDisabled={isBlocked}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`
              bg-white rounded-lg shadow-sm border p-4 mb-3 cursor-pointer
              hover:shadow-md transition-all duration-200
              ${snapshot.isDragging ? "shadow-lg rotate-2" : ""}
              ${isBlocked ? "opacity-60 cursor-not-allowed" : ""}
            `}
            onClick={() => {
              if (!isBlocked) {
                setUnitSelecionada(unit);
                setModalAberto("detalhes");
              }
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 text-sm">
                  {unit.codigo_unidade}
                </h3>
                {isBlocked && (
                  <div className="flex items-center gap-1">
                    <Lock className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-orange-600 font-medium">
                      Status Misto
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {unit.charges.length} cobrança{unit.charges.length !== 1 ? "s" : ""}
              </span>
            </div>
            
            <p className="text-xs text-gray-600 mb-2 truncate">
              {unit.nome_unidade}
            </p>
            
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-green-600">
                {formatarMoeda(unit.valor_total)}
              </span>
              <span className="text-gray-500">
                {unit.dias_parado}d parado
              </span>
            </div>
            
            {isBlocked && (
              <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                <Info className="w-3 h-3 inline mr-1" />
                Esta unidade tem cobranças com status diferentes. Use o modo "Por Cobrança" para movê-las.
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  const renderCardIndividual = (card: CardCobranca, index: number) => (
    <Draggable key={card.id} draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`
            bg-white rounded-lg shadow-sm border p-4 mb-3 cursor-pointer
            hover:shadow-md transition-all duration-200
            ${snapshot.isDragging ? "shadow-lg rotate-2" : ""}
          `}
          onClick={() => {
            setCobrancaSelecionada(card);
            setModalAberto("detalhes");
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800 text-sm">
              {card.codigo_unidade}
            </h3>
            <span className="text-xs text-gray-500">
              {formatarData(card.data_vencimento_antiga)}
            </span>
          </div>
          
          <p className="text-xs text-gray-600 mb-2 truncate">
            {card.cliente}
          </p>
          
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-green-600">
              {formatarMoeda(card.valor_total)}
            </span>
            <span className="text-gray-500">
              {card.dias_parado}d parado
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Carregando Kanban...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-800">
            Kanban de Cobranças
          </h1>
          
          {/* Seletor de modo */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                if (movimentacaoIndividualFeita) {
                  if (confirm(
                    "⚠️ ATENÇÃO: Você moveu cobranças individuais nesta sessão.\n\n" +
                    "Alternar para modo agrupado pode causar inconsistências.\n\n" +
                    "Recomendamos recarregar a página antes de usar o modo agrupado.\n\n" +
                    "Deseja continuar mesmo assim?"
                  )) {
                    setAba("unidade");
                  }
                } else {
                  setAba("unidade");
                }
              }}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-colors relative
                ${aba === "unidade" 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-800"
                }
                ${movimentacaoIndividualFeita ? "opacity-60" : ""}
              `}
            >
              Por Unidade
              {unidadesComStatusMisto.size > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unidadesComStatusMisto.size}
                </span>
              )}
              {movimentacaoIndividualFeita && (
                <Lock className="w-3 h-3 ml-1 inline text-orange-500" />
              )}
            </button>
            <button
              onClick={() => setAba("individual")}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${aba === "individual" 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-800"
                }
              `}
            >
              Por Cobrança
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarDados}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Avisos */}
      {aba === "unidade" && unidadesComStatusMisto.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {unidadesComStatusMisto.size} unidade{unidadesComStatusMisto.size !== 1 ? "s" : ""} com status misto detectada{unidadesComStatusMisto.size !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm text-orange-700 mt-1">
            Essas unidades têm cobranças com status diferentes e não podem ser movidas em grupo. 
            Use o modo "Por Cobrança" para mover as cobranças individualmente.
          </p>
        </div>
      )}

      {movimentacaoIndividualFeita && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <Info className="w-5 h-5" />
            <span className="font-medium">Modo Individual Ativo</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Você moveu cobranças individuais. Para evitar inconsistências, continue usando o modo "Por Cobrança" 
            ou recarregue a página para resetar.
          </p>
        </div>
      )}

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Total em Aberto</span>
            </div>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {formatarMoeda(estatisticas.valor_total_em_aberto)}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-gray-600">Cobranças Ativas</span>
            </div>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {estatisticas.total_cobrancas_ativas}
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Média Atraso</span>
            </div>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {estatisticas.media_dias_atraso} dias
            </p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Unidades Ativas</span>
            </div>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {estatisticas.unidades_com_pendencias}
            </p>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext
        onDragEnd={aba === "unidade" ? onDragEndUnidade : onDragEndIndividual}
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {colunas.map((coluna) => (
            <div key={coluna.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800 text-sm">
                  {coluna.nome}
                </h2>
                <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs">
                  {aba === "unidade" 
                    ? getUnitCardsByColuna(coluna.id).length
                    : cards.filter(c => c.status_atual === coluna.id).length
                  }
                </span>
              </div>
              
              <Droppable droppableId={coluna.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`
                      min-h-[200px] transition-colors duration-200
                      ${snapshot.isDraggingOver ? "bg-blue-50" : ""}
                    `}
                  >
                    {aba === "unidade" 
                      ? getUnitCardsByColuna(coluna.id).map((unit, index) =>
                          renderCardUnidade(unit, index)
                        )
                      : cards
                          .filter(card => card.status_atual === coluna.id)
                          .map((card, index) => renderCardIndividual(card, index))
                    }
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Modal de Confirmação */}
      {modalConfirmacaoAberto && movimentoPendente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Confirmar Movimentação
            </h3>
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja mover todas as cobranças desta unidade para a nova coluna?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setModalConfirmacaoAberto(false);
                  setMovimentoPendente(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarMovimentoUnidade}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Movendo..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso de Status Misto */}
      {showMixedStatusWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-800">
                Status Misto Detectado
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              Esta unidade possui cobranças com status diferentes. Para evitar inconsistências, 
              você deve mover as cobranças individualmente.
            </p>
            <p className="text-sm text-orange-700 bg-orange-50 p-3 rounded mb-4">
              <strong>Solução:</strong> Use o modo "Por Cobrança" para mover cada cobrança separadamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMixedStatusWarning(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Entendi
              </button>
              <button
                onClick={() => {
                  setShowMixedStatusWarning(false);
                  setAba("individual");
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ir para Modo Individual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais existentes... */}
      {modalAberto === "detalhes" && (unitSelecionada || cobrancaSelecionada) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {aba === "unidade" ? "Detalhes da Unidade" : "Detalhes da Cobrança"}
              </h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {aba === "unidade" && unitSelecionada && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Código</label>
                    <p className="text-gray-800">{unitSelecionada.codigo_unidade}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nome</label>
                    <p className="text-gray-800">{unitSelecionada.nome_unidade}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">CNPJ</label>
                    <p className="text-gray-800">{formatarCNPJCPF(unitSelecionada.cnpj)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Valor Total</label>
                    <p className="text-gray-800 font-semibold">{formatarMoeda(unitSelecionada.valor_total)}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Cobranças ({unitSelecionada.charges.length})</label>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {unitSelecionada.charges.map((charge) => (
                      <div key={charge.id} className="bg-gray-50 p-3 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{charge.cliente}</p>
                            <p className="text-xs text-gray-600">{charge.tipo_debito}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">{formatarMoeda(charge.valor_total)}</p>
                            <p className="text-xs text-gray-600">{formatarData(charge.data_vencimento_antiga)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {aba === "individual" && cobrancaSelecionada && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cliente</label>
                    <p className="text-gray-800">{cobrancaSelecionada.cliente}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Unidade</label>
                    <p className="text-gray-800">{cobrancaSelecionada.codigo_unidade}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Valor</label>
                    <p className="text-gray-800 font-semibold">{formatarMoeda(cobrancaSelecionada.valor_total)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Vencimento</label>
                    <p className="text-gray-800">{formatarData(cobrancaSelecionada.data_vencimento_antiga)}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalAberto(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanCobranca;