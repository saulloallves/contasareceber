/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, } from "react-beautiful-dnd";
import { 
  MessageSquare, Calendar, Scale, Mail,
  Clock, DollarSign, AlertTriangle, CheckCircle, User,
  Filter, Download, RefreshCw, Edit, X,
  Save, CircleDollarSign,
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

  const kanbanService = new KanbanService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
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
    } catch (error) {
      console.error("Erro ao carregar dados do Kanban:", error);
    } finally {
      setCarregando(false);
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
    setMovimentoPendente(result);
    setModalConfirmacaoAberto(true);
  };

  const confirmarMovimentoUnidade = async () => {
    if (!movimentoPendente || !movimentoPendente.destination) return;

    const { source, destination, draggableId } = movimentoPendente;
    setProcessando(true);
    setModalConfirmacaoAberto(false);

    try {
      const unit = getUnitCardsByColuna(source.droppableId).find(
        (u) => u.codigo_unidade === draggableId
      );
      if (unit) {
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
        await carregarDados(); // Garante que a UI está sincronizada
      }
    } catch (error) {
      console.error("Erro ao mover card da unidade:", error);
      // Adicionar um feedback de erro para o usuário aqui seria uma boa prática
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

    // Atualização otimista da UI
    const originalCards = cards;
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
      // A UI já foi atualizada otimisticamente. Não é necessário recarregar.
      // Apenas em caso de erro, a UI será revertida.
    } catch (error) {
      console.error("Erro ao mover cobrança, revertendo:", error);
      // Se a chamada falhar, reverte a UI para o estado original
      setCards(originalCards);
    } finally {
      setProcessando(false);
    }
  };

  const executarAcao = async (cardId: string, acao: string) => {
    setProcessando(true);
    try {
      await kanbanService.executarAcaoRapida(cardId, acao, "usuario_atual");
      carregarDados();
      setModalAberto(null);
    } catch (error) {
      console.error("Erro ao executar ação:", error);
    } finally {
      setProcessando(false);
    }
  };

  const salvarObservacao = async () => {
    if (aba === "unidade") {
      if (!unitSelecionada || !observacaoEditando.trim()) return;
      setProcessando(true);
      try {
        await Promise.all(
          unitSelecionada.charges.map((card) =>
            kanbanService.atualizarObservacao(
              card.id,
              observacaoEditando,
              "usuario_atual"
            )
          )
        );
        carregarDados();
        setModalAberto(null);
        setObservacaoEditando("");
      } catch (error) {
        console.error("Erro ao salvar observação:", error);
      } finally {
        setProcessando(false);
      }
    } else if (aba === "individual") {
      if (!cobrancaSelecionada || !observacaoEditando.trim()) return;
      setProcessando(true);
      try {
        await kanbanService.atualizarObservacao(
          cobrancaSelecionada.id,
          observacaoEditando,
          "usuario_atual"
        );
        carregarDados();
        setModalAberto(null);
        setObservacaoEditando("");
      } catch (error) {
        console.error("Erro ao salvar observação:", error);
      } finally {
        setProcessando(false);
      }
    }
  };

  const exportarKanban = async () => {
    try {
      const csv = await kanbanService.exportarKanban(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kanban-cobranca-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao exportar Kanban:", error);
    }
  };

  const getCorCard = (unit: UnitKanbanCard) => {
    if (unit.dias_parado > 7) return "border-red-500 bg-red-50";
    if (unit.valor_total > 5000) return "border-orange-500 bg-orange-50";
    if (unit.status_atual === "quitado") return "border-green-500 bg-green-50";
    return "border-gray-300 bg-white";
  };

  const getCorCardIndividual = (card: CardCobranca) => {
    if (card.dias_parado > 7) return "border-red-500 bg-red-50";
    if (card.valor_total > 5000) return "border-orange-500 bg-orange-50";
    if (card.status_atual === "quitado") return "border-green-500 bg-green-50";
    return "border-gray-300 bg-white";
  };

  const getIconeStatus = (status: string) => {
    const icones: Record<string, JSX.Element> = {
      em_aberto: <Clock className="w-4 h-4 text-gray-600" />,
      notificado: <MessageSquare className="w-4 h-4 text-blue-600" />,
      reuniao_agendada: <Calendar className="w-4 h-4 text-purple-600" />,
      em_negociacao: <User className="w-4 h-4 text-yellow-600" />,
      proposta_enviada: <Mail className="w-4 h-4 text-orange-600" />,
      aguardando_pagamento: <Clock className="w-4 h-4 text-blue-600" />,
      pagamento_parcial: <DollarSign className="w-4 h-4 text-green-600" />,
      quitado: <CheckCircle className="w-4 h-4 text-green-600" />,
      ignorado: <AlertTriangle className="w-4 h-4 text-red-600" />,
      notificacao_formal: <Scale className="w-4 h-4 text-purple-600" />,
      escalado_juridico: <Scale className="w-4 h-4 text-red-600" />,
      inadimplencia_critica: <AlertTriangle className="w-4 h-4 text-red-700" />,
    };
    return icones[status] || <Clock className="w-4 h-4 text-gray-600" />;
  };

  // --- Kanban Board Render ---
  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <CircleDollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Kanban de Cobrança
              </h1>
              <p className="text-gray-600">
                Acompanhamento visual do fluxo de cobrança
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportarKanban}
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

        {/* Abas */}
        <div className="mb-8">
          <div className="flex border-b border-gray-200">
            <button
              className={`px-6 py-2 font-semibold transition-colors ${
                aba === "unidade"
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-gray-500 hover:text-blue-600"
              }`}
              onClick={() => setAba("unidade")}
            >
              Por Unidade
            </button>
            <button
              className={`px-6 py-2 font-semibold transition-colors ${
                aba === "individual"
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-gray-500 hover:text-blue-600"
              }`}
              onClick={() => setAba("individual")}
            >
              Cobranças Individuais
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_cards}
              </div>
              <div className="text-sm text-blue-800">Total de Unidades</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">
                {estatisticas.cards_criticos}
              </div>
              <div className="text-sm text-red-800">Situação Crítica</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.cards_parados}
              </div>
              <div className="text-sm text-yellow-800">Parados +7 dias</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.tempo_medio_resolucao.toFixed(0)}
              </div>
              <div className="text-sm text-green-800">Dias Médios</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {formatarMoeda(estatisticas.valor_total_fluxo)}
              </div>
              <div className="text-sm text-purple-800">Valor Total</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              value={filtros.unidade || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, unidade: e.target.value })
              }
              placeholder="Código da unidade"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={filtros.tipo_debito || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, tipo_debito: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Tipos</option>
              <option value="royalties">Royalties</option>
              <option value="insumos">Insumos</option>
              <option value="aluguel">Aluguel</option>
              <option value="multa">Multa</option>
            </select>
            <select
              value={filtros.responsavel || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, responsavel: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos Responsáveis</option>
              <option value="cobranca">Equipe Cobrança</option>
              <option value="juridico">Jurídico</option>
              <option value="financeiro">Financeiro</option>
            </select>
            <select
              value={filtros.criticidade || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, criticidade: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas Criticidades</option>
              <option value="normal">Normal</option>
              <option value="atencao">Atenção</option>
              <option value="critica">Crítica</option>
            </select>
            <button
              onClick={() => setFiltros({})}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        {aba === "unidade" ? (
          <DragDropContext onDragEnd={onDragEndUnidade}>
            <div className="overflow-x-auto">
              <div className="flex space-x-4 min-w-max pb-4">
                {colunas.map((coluna) => {
                  const unitCards = getUnitCardsByColuna(coluna.id);
                  return (
                    <div
                      key={coluna.id}
                      className="w-80 bg-gray-100 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          {getIconeStatus(coluna.id)}
                          <h3 className="ml-2 font-semibold text-gray-800">
                            {coluna.nome}
                          </h3>
                        </div>
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                          {unitCards.length}
                        </span>
                      </div>
                      <Droppable droppableId={coluna.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-96 space-y-3 ${
                              snapshot.isDraggingOver
                                ? "bg-blue-50 border-2 border-blue-300 border-dashed"
                                : ""
                            }`}
                          >
                            {unitCards.map((unit, index) => (
                              <Draggable
                                key={unit.codigo_unidade}
                                draggableId={unit.codigo_unidade}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`p-4 rounded-lg border-2 shadow-sm cursor-pointer transition-all ${
                                      snapshot.isDragging
                                        ? "shadow-lg rotate-2"
                                        : "hover:shadow-md"
                                    } ${getCorCard(unit)}`}
                                    onClick={() => {
                                      setUnitSelecionada(unit);
                                      setModalAberto("detalhes");
                                    }}
                                  >
                                    {/* Header do Card */}
                                    <div className="flex items-center mb-3">
                                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                        {unit.codigo_unidade.slice(-2)}
                                      </div>
                                      <div className="ml-2">
                                        <p className="font-semibold text-gray-800 text-sm">
                                          {unit.nome_unidade}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {unit.codigo_unidade}
                                        </p>
                                      </div>
                                    </div>
                                    {/* Informações do Débito */}
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Valor Total:
                                        </span>
                                        <span className="font-bold text-red-600 text-sm">
                                          {formatarMoeda(unit.valor_total)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Tipo:
                                        </span>
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                          {unit.tipo_debito?.toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Venc. Antiga:
                                        </span>
                                        <span className="text-xs text-gray-800">
                                          {formatarData(
                                            unit.data_vencimento_antiga
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        ) : (
          <DragDropContext onDragEnd={onDragEndIndividual}>
            <div className="overflow-x-auto">
              <div className="flex space-x-4 min-w-max pb-4">
                {colunas.map((coluna) => {
                  const colunaCards = cards.filter(
                    (card) => card.status_atual === coluna.id
                  );
                  return (
                    <div
                      key={coluna.id}
                      className="w-80 bg-gray-100 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          {getIconeStatus(coluna.id)}
                          <h3 className="ml-2 font-semibold text-gray-800">
                            {coluna.nome}
                          </h3>
                        </div>
                        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                          {colunaCards.length}
                        </span>
                      </div>
                      <Droppable droppableId={coluna.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`min-h-96 space-y-3 ${
                              snapshot.isDraggingOver
                                ? "bg-blue-50 border-2 border-blue-300 border-dashed"
                                : ""
                            }`}
                          >
                            {colunaCards.map((card, index) => (
                              <Draggable
                                key={card.id}
                                draggableId={card.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`p-4 rounded-lg border-2 shadow-sm cursor-pointer transition-all ${
                                      snapshot.isDragging
                                        ? "shadow-lg rotate-2"
                                        : "hover:shadow-md"
                                    } ${getCorCardIndividual(card)}`}
                                    onClick={() => {
                                      setCobrancaSelecionada(card);
                                      setModalAberto("detalhes");
                                    }}
                                  >
                                    <div className="flex items-center mb-3">
                                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                        {card.codigo_unidade?.slice(-2)}
                                      </div>
                                      <div className="ml-2">
                                        <p className="font-semibold text-gray-800 text-sm">
                                          {card.nome_unidade}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {card.codigo_unidade}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Valor:
                                        </span>
                                        <span className="font-bold text-red-600 text-sm">
                                          {formatarMoeda(card.valor_total)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Tipo:
                                        </span>
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                          {card.tipo_debito?.toUpperCase()}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Venc. Antiga:
                                        </span>
                                        <span className="text-xs text-gray-800">
                                          {formatarData(
                                            card.data_vencimento_antiga
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Modal de Confirmação de Movimentação em Massa */}
      {modalConfirmacaoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center mb-6">
              <AlertTriangle className="w-8 h-8 text-yellow-500 mr-4" />
              <h3 className="text-xl font-bold text-gray-800">Confirmação Necessária</h3>
            </div>
            <p className="text-gray-600 mb-8">
              Todas as cobranças dessa unidade terão seu status alterado. Tem certeza que deseja continuar?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setModalConfirmacaoAberto(false);
                  setMovimentoPendente(null);
                  carregarDados(); // Recarrega para reverter a mudança visual otimista
                }}
                disabled={processando}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarMovimentoUnidade}
                disabled={processando}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Unidade */}
      {aba === "unidade" && modalAberto === "detalhes" && unitSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setModalAberto(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-7 h-7" />
            </button>
            {/* Unit Info */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <User className="w-6 h-6 mr-2 text-blue-600" />
                {unitSelecionada.nome_unidade}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="block text-xs text-gray-500">
                    Código da Unidade
                  </span>
                  <span className="font-semibold text-gray-800">
                    {unitSelecionada.codigo_unidade}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">CNPJ</span>
                  <span className="font-semibold text-gray-800">
                    {formatarCNPJCPF(unitSelecionada.cnpj)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">
                    Responsável Atual
                  </span>
                  <span className="font-semibold text-gray-800">
                    {unitSelecionada.responsavel_atual}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <span className="block text-xs text-gray-500">
                    Valor Total
                  </span>
                  <span className="font-bold text-red-600">
                    {formatarMoeda(unitSelecionada.valor_total)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">
                    Venc. Antiga
                  </span>
                  <span className="font-semibold text-gray-800">
                    {formatarData(unitSelecionada.data_vencimento_antiga)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500">
                    Dias Parado
                  </span>
                  <span className="font-semibold text-gray-800">
                    {unitSelecionada.dias_parado} dias
                  </span>
                </div>
              </div>
            </div>
            {/* Charges Grid */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-700 mb-3">
                Cobranças da Unidade
              </h4>
              <ChargesGrid
                charges={unitSelecionada.charges}
                executarAcao={executarAcao}
                setObservacaoEditando={setObservacaoEditando}
                setModalAberto={setModalAberto}
              />
            </div>
            {/* Observações da unidade */}
            {unitSelecionada.observacoes && (
              <div className="mb-4">
                <span className="block text-xs text-gray-500 mb-1">
                  Observações
                </span>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-3 text-yellow-800">
                  {unitSelecionada.observacoes}
                </div>
              </div>
            )}
            {/* Modal action buttons (unit-level) */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  Promise.all(
                    unitSelecionada.charges.map((card) =>
                      executarAcao(card.id, "whatsapp")
                    )
                  );
                }}
                disabled={processando}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                WhatsApp (Todos)
              </button>
              <button
                onClick={() => {
                  Promise.all(
                    unitSelecionada.charges.map((card) =>
                      executarAcao(card.id, "reuniao")
                    )
                  );
                }}
                disabled={processando}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Reunião (Todos)
              </button>
              <button
                onClick={() => {
                  Promise.all(
                    unitSelecionada.charges.map((card) =>
                      executarAcao(card.id, "juridico")
                    )
                  );
                }}
                disabled={processando}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Scale className="w-4 h-4 mr-2" />
                Jurídico (Todos)
              </button>
              <button
                onClick={() => {
                  setObservacaoEditando(unitSelecionada.observacoes || "");
                  setModalAberto("observacao");
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Adicionar Observação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Cobrança Individual */}
      {aba === "individual" &&
        modalAberto === "detalhes" &&
        cobrancaSelecionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
              className="
              bg-white rounded-lg shadow-2xl relative
              w-full
              max-w-[95vw]
              sm:max-w-md
              md:max-w-lg
              lg:max-w-xl
              xl:max-w-2xl
              p-4
              md:p-8
              max-h-[90vh]
              overflow-y-auto
              flex flex-col
            "
              style={{ boxSizing: "border-box" }}
            >
              <button
                onClick={() => setModalAberto(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              >
                <X className="w-7 h-7" />
              </button>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-6 h-6 text-blue-600" />
                  {cobrancaSelecionada.nome_unidade}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-2">
                  <div>
                    <span className="block text-xs text-gray-500">
                      Código da Unidade
                    </span>
                    <span className="font-semibold text-gray-800 break-all">
                      {cobrancaSelecionada.codigo_unidade}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">CNPJ</span>
                    <span className="font-semibold text-gray-800 break-all">
                      {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Valor</span>
                    <span className="font-bold text-red-600">
                      {formatarMoeda(cobrancaSelecionada.valor_total)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">
                      Venc. Antiga
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatarData(cobrancaSelecionada.data_vencimento_antiga)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Tipo</span>
                    <span className="font-semibold text-gray-800 break-all">
                      {cobrancaSelecionada.tipo_debito?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Status</span>
                    <span className="font-semibold text-blue-700 break-all">
                      {cobrancaSelecionada.status_atual}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">
                      Responsável
                    </span>
                    <span className="font-semibold text-gray-800 break-all">
                      {cobrancaSelecionada.responsavel_atual}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">
                      Dias Parado
                    </span>
                    <span className="font-semibold text-gray-800">
                      {cobrancaSelecionada.dias_parado} dias
                    </span>
                  </div>
                </div>
              </div>
              {/* Observações */}
              {cobrancaSelecionada.observacoes && (
                <div className="mb-4">
                  <span className="block text-xs text-gray-500 mb-1">
                    Observações
                  </span>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-3 text-yellow-800">
                    {cobrancaSelecionada.observacoes}
                  </div>
                </div>
              )}
              {/* Modal action buttons (individual) */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
                <button
                  onClick={() =>
                    executarAcao(cobrancaSelecionada.id, "whatsapp")
                  }
                  disabled={processando}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  WhatsApp
                </button>
                <button
                  onClick={() =>
                    executarAcao(cobrancaSelecionada.id, "reuniao")
                  }
                  disabled={processando}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  Reunião
                </button>
                <button
                  onClick={() =>
                    executarAcao(cobrancaSelecionada.id, "juridico")
                  }
                  disabled={processando}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Scale className="w-5 h-5 mr-2" />
                  Jurídico
                </button>
                <button
                  onClick={() => {
                    setObservacaoEditando(
                      cobrancaSelecionada.observacoes || ""
                    );
                    setModalAberto("observacao");
                  }}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit className="w-5 h-5 mr-2" />
                  Adicionar Observação
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal de Observação */}
      {modalAberto === "observacao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Adicionar Observação</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {aba === "unidade"
                    ? `Observação para ${unitSelecionada?.nome_unidade}`
                    : `Observação para cobrança de ${cobrancaSelecionada?.nome_unidade}`}
                </label>
                <textarea
                  value={observacaoEditando}
                  onChange={(e) => setObservacaoEditando(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite sua observação..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={salvarObservacao}
                  disabled={processando || !observacaoEditando.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2 inline" />
                  {processando ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => setModalAberto(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: ChargesGrid for modal
function ChargesGrid({
  charges,
  executarAcao,
  setObservacaoEditando,
  setModalAberto,
}: {
  charges: CardCobranca[];
  executarAcao: (cardId: string, acao: string) => void;
  setObservacaoEditando: (obs: string) => void;
  setModalAberto: (modal: "detalhes" | "acao" | "observacao" | null) => void;
}) {
  // Split charges into columns of max 4
  const columns: CardCobranca[][] = [];
  for (let i = 0; i < charges.length; i += 4) {
    columns.push(charges.slice(i, i + 4));
  }
  return (
    <div className="flex flex-row gap-4 overflow-x-auto">
      {columns.map((col, idx) => (
        <div key={idx} className="flex flex-col gap-4 min-w-[260px]">
          {col.map((charge) => (
            <div
              key={charge.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800 text-sm">
                  {charge.tipo_debito?.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {formatarData(charge.data_vencimento_antiga)}
                </span>
              </div>
              <div className="mb-2">
                <span className="block text-xs text-gray-500">Valor</span>
                <span className="font-bold text-red-600">
                  {formatarMoeda(charge.valor_total)}
                </span>
              </div>
              <div className="mb-2">
                <span className="block text-xs text-gray-500">Status</span>
                <span className="text-xs font-semibold text-blue-700">
                  {charge.status_atual}
                </span>
              </div>
              <div className="mb-2">
                <span className="block text-xs text-gray-500">Responsável</span>
                <span className="text-xs text-gray-800">
                  {charge.responsavel_atual}
                </span>
              </div>
              {/* Ações rápidas */}
              <div className="flex space-x-1 mt-2">
                <button
                  onClick={() => executarAcao(charge.id, "whatsapp")}
                  className="flex-1 p-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                  title="Enviar WhatsApp"
                >
                  <MessageSquare className="w-3 h-3 mx-auto" />
                </button>
                <button
                  onClick={() => executarAcao(charge.id, "reuniao")}
                  className="flex-1 p-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                  title="Agendar Reunião"
                >
                  <Calendar className="w-3 h-3 mx-auto" />
                </button>
                <button
                  onClick={() => {
                    setObservacaoEditando(charge.observacoes || "");
                    setModalAberto("observacao");
                  }}
                  className="flex-1 p-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                  title="Adicionar Observação"
                >
                  <Edit className="w-3 h-3 mx-auto" />
                </button>
              </div>
              {/* Observações */}
              {charge.observacoes && (
                <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 rounded">
                  <p className="text-xs text-yellow-800 truncate">
                    {charge.observacoes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
