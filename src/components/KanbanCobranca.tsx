/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  Filter,
  Download,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  BarChart3,
  Users,
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  MessageSquare,
  Calendar,
  FileText,
  Target,
  TrendingUp,
  X,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { KanbanService } from "../services/kanbanService";
import {
  CardCobranca,
  ColunaKanban,
  FiltrosKanban,
  EstatisticasKanban,
} from "../types/kanban";
import { formatarCNPJCPF, formatarMoeda } from "../utils/formatters";
import { toast } from "react-hot-toast";

export function KanbanCobranca() {
  const [colunas, setColunas] = useState<ColunaKanban[]>([]);
  const [cards, setCards] = useState<CardCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosKanban>({});
  const [filtrosAvancados, setFiltrosAvancados] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasKanban | null>(
    null
  );
  const [agrupadoPorUnidade, setAgrupadoPorUnidade] = useState(false);
  const [modalObservacao, setModalObservacao] = useState<{
    aberto: boolean;
    cardId: string;
    observacaoAtual: string;
  }>({ aberto: false, cardId: "", observacaoAtual: "" });
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);

  const kanbanService = useMemo(() => new KanbanService(), []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [colunasData, cardsData, estatisticasData] = await Promise.all([
        kanbanService.buscarColunas(),
        kanbanService.buscarCards(filtros, agrupadoPorUnidade),
        kanbanService.buscarEstatisticas(agrupadoPorUnidade),
      ]);

      setColunas(colunasData);
      setCards(cardsData);
      setEstatisticas(estatisticasData);
    } catch (error) {
      console.error("Erro ao carregar dados do Kanban:", error);
      toast.error("Erro ao carregar dados do Kanban");
    } finally {
      setCarregando(false);
    }
  }, [kanbanService, filtros, agrupadoPorUnidade]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    if (source.droppableId === destination.droppableId) return;

    try {
      await kanbanService.moverCard(
        draggableId,
        source.droppableId,
        destination.droppableId,
        "usuario_atual",
        "Movimentação via Kanban"
      );

      toast.success("Card movido com sucesso!");
      carregarDados();
    } catch (error) {
      console.error("Erro ao mover card:", error);
      toast.error("Erro ao mover card");
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await kanbanService.exportarKanban(filtros, agrupadoPorUnidade);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kanban-cobrancas-${new Date()
        .toISOString()
        .split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar dados");
    }
  };

  const abrirModalObservacao = (card: CardCobranca) => {
    setModalObservacao({
      aberto: true,
      cardId: card.id,
      observacaoAtual: card.observacoes || "",
    });
  };

  const salvarObservacao = async () => {
    setSalvandoObservacao(true);
    try {
      await kanbanService.atualizarObservacao(
        modalObservacao.cardId,
        modalObservacao.observacaoAtual,
        "usuario_atual",
        agrupadoPorUnidade
      );

      setModalObservacao({ aberto: false, cardId: "", observacaoAtual: "" });
      toast.success("Observação salva com sucesso!");
      carregarDados();
    } catch (error) {
      toast.error("Erro ao salvar observação");
    } finally {
      setSalvandoObservacao(false);
    }
  };

  const limparFiltros = () => {
    setFiltros({});
  };

  const getCardsPorColuna = (colunaId: string) => {
    return cards.filter((card) => card.status_atual === colunaId);
  };

  const getCriticidadeColor = (criticidade: string) => {
    switch (criticidade) {
      case "critica":
        return "border-l-4 border-red-500 bg-red-50";
      case "atencao":
        return "border-l-4 border-yellow-500 bg-yellow-50";
      default:
        return "border-l-4 border-gray-300 bg-white";
    }
  };

  const getCriticidadeBadge = (criticidade: string) => {
    switch (criticidade) {
      case "critica":
        return "bg-red-100 text-red-800 border-red-300";
      case "atencao":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const formatarTipoDebito = (tipo: string) => {
    const tipos: Record<string, string> = {
      "Franchising - Royalties": "Royalties",
      "Vendas - Vendas": "Vendas",
      "Franchising - Tx de Propagand": "Propaganda",
      "- Multa/Infração": "Multa",
      "Franchising - Tx de Franquia": "Taxa",
    };
    return tipos[tipo] || tipo;
  };

  return (
    <div className="max-w-full mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Kanban de Cobranças
              </h1>
              <p className="text-gray-600">
                Gestão visual do fluxo de cobranças
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAgrupadoPorUnidade(!agrupadoPorUnidade)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                agrupadoPorUnidade
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {agrupadoPorUnidade ? <Users className="w-4 h-4 mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
              {agrupadoPorUnidade ? "Por Unidade" : "Individual"}
            </button>

            <button
              onClick={() => setFiltrosAvancados(!filtrosAvancados)}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
              {filtrosAvancados ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </button>

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_cards}
              </div>
              <div className="text-sm text-blue-800">Total de Cards</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {estatisticas.cards_criticos}
              </div>
              <div className="text-sm text-red-800">Cards Críticos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.inadimplentes_perda}
              </div>
              <div className="text-sm text-yellow-800">
                Inadimplentes/Perda
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {formatarMoeda(estatisticas.valor_total_fluxo)}
              </div>
              <div className="text-sm text-green-800">Valor Total</div>
            </div>
          </div>
        )}

        {/* Filtros Avançados */}
        {filtrosAvancados && (
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Filtros Avançados
              </h3>
              <button
                onClick={limparFiltros}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar Filtros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Busca por Nome */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filtros.unidade || ""}
                    onChange={(e) =>
                      setFiltros({ ...filtros, unidade: e.target.value })
                    }
                    placeholder="Buscar por nome da unidade"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Documento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Documento
                </label>
                <input
                  type="text"
                  value={filtros.unidade || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, unidade: e.target.value })
                  }
                  placeholder="00.000.000/0000-00 ou CPF"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Status da Cobrança */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status da Cobrança
                </label>
                <select
                  value={filtros.responsavel || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, responsavel: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos os Status</option>
                  <option value="Equipe Cobrança">Em Aberto</option>
                  <option value="Jurídico">Jurídico</option>
                </select>
              </div>

              {/* Valor Mínimo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Mínimo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filtros.valor_min || ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      valor_min: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Valor Máximo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Máximo (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={filtros.valor_max || ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      valor_max: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="999.999,99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Tipo de Cobrança */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Cobrança
                </label>
                <select
                  value={filtros.tipo_debito || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, tipo_debito: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="Franchising - Royalties">Royalties</option>
                  <option value="Vendas - Vendas">Vendas</option>
                  <option value="Franchising - Tx de Propagand">Propaganda</option>
                  <option value="- Multa/Infração">Multa</option>
                  <option value="Franchising - Tx de Franquia">Taxa</option>
                </select>
              </div>

              {/* Data Vencimento (De) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Vencimento (De)
                </label>
                <input
                  type="date"
                  value={filtros.data_vencimento_inicio || ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      data_vencimento_inicio: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Data Vencimento (Até) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Vencimento (Até)
                </label>
                <input
                  type="date"
                  value={filtros.data_vencimento_fim || ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      data_vencimento_fim: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Criticidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Criticidade
                </label>
                <select
                  value={filtros.criticidade || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, criticidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todas</option>
                  <option value="normal">Normal</option>
                  <option value="atencao">Atenção</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável
                </label>
                <select
                  value={filtros.responsavel || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, responsavel: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos</option>
                  <option value="Equipe Cobrança">Equipe Cobrança</option>
                  <option value="Jurídico">Jurídico</option>
                </select>
              </div>

              {/* Dias Parado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dias Parado (Min)
                </label>
                <input
                  type="number"
                  value={filtros.dias_parado_min || ""}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      dias_parado_min: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex space-x-6 overflow-x-auto pb-6">
          {colunas.map((coluna) => {
            const cardsColuna = getCardsPorColuna(coluna.id);
            const valorTotalColuna = cardsColuna.reduce(
              (sum, card) => sum + card.valor_total,
              0
            );

            return (
              <div
                key={coluna.id}
                className="flex-shrink-0 w-80 bg-gray-100 rounded-lg"
              >
                {/* Header da Coluna */}
                <div
                  className="p-4 rounded-t-lg text-white font-semibold"
                  style={{ backgroundColor: coluna.cor }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{coluna.nome}</h3>
                      <p className="text-sm opacity-90">{coluna.descricao}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {cardsColuna.length}
                      </div>
                      <div className="text-xs opacity-90">
                        {formatarMoeda(valorTotalColuna)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cards da Coluna */}
                <Droppable droppableId={coluna.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-4 min-h-96 space-y-3 ${
                        snapshot.isDraggingOver ? "bg-blue-50" : ""
                      }`}
                    >
                      {carregando ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : cardsColuna.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Building2 className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm">Nenhuma cobrança</p>
                        </div>
                      ) : (
                        cardsColuna.map((card, index) => (
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
                                className={`p-4 rounded-lg shadow-sm border cursor-move transition-all duration-200 ${
                                  snapshot.isDragging
                                    ? "shadow-lg rotate-2 scale-105"
                                    : "hover:shadow-md"
                                } ${getCriticidadeColor(card.criticidade)}`}
                              >
                                {/* Header do Card */}
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-800 text-sm leading-tight truncate">
                                      {card.nome_unidade}
                                    </h4>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {formatarCNPJCPF(card.codigo_unidade)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => abrirModalObservacao(card)}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                    title="Adicionar observação"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Informações Financeiras */}
                                <div className="space-y-2 mb-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">
                                      Valor Total:
                                    </span>
                                    <span className="font-bold text-gray-800 text-sm">
                                      {formatarMoeda(card.valor_total)}
                                    </span>
                                  </div>
                                  {card.valor_original &&
                                    card.valor_original !== card.valor_total && (
                                      <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-600">
                                          Valor Original:
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {formatarMoeda(card.valor_original)}
                                        </span>
                                      </div>
                                    )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">
                                      Cobranças:
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {card.quantidade_titulos}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">
                                      Vencimento:
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(
                                        card.data_vencimento_antiga
                                      ).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getCriticidadeBadge(
                                      card.criticidade
                                    )}`}
                                  >
                                    {card.criticidade.toUpperCase()}
                                  </span>
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                                    {formatarTipoDebito(card.tipo_debito)}
                                  </span>
                                </div>

                                {/* Informações da Parcela (se aplicável) */}
                                {card.is_parcela && (
                                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-3">
                                    <div className="flex items-center text-xs text-purple-700">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      <span>
                                        Parcela {card.parcela_numero || "?"}/
                                        {card.parcelas_total || "?"}
                                      </span>
                                    </div>
                                    {card.parcelamento_origem && (
                                      <div className="text-xs text-purple-600 mt-1">
                                        Origem: {card.parcelamento_origem}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Última Ação */}
                                <div className="text-xs text-gray-500">
                                  <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span className="truncate">
                                      {card.ultima_acao}
                                    </span>
                                  </div>
                                  <div className="mt-1">
                                    {new Date(
                                      card.data_ultima_acao
                                    ).toLocaleDateString("pt-BR")}
                                  </div>
                                </div>

                                {/* Observações */}
                                {card.observacoes && (
                                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                    <div className="flex items-start">
                                      <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                      <span className="line-clamp-2">
                                        {card.observacoes}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Ações Rápidas */}
                                <div className="flex space-x-2 mt-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast("Funcionalidade em desenvolvimento");
                                    }}
                                    className="flex-1 flex items-center justify-center px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    title="Enviar WhatsApp"
                                  >
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    WhatsApp
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toast("Funcionalidade em desenvolvimento");
                                    }}
                                    className="flex-1 flex items-center justify-center px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                    title="Agendar reunião"
                                  >
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Reunião
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modal de Observação */}
      {modalObservacao.aberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Adicionar Observação
              </h3>
              <button
                onClick={() =>
                  setModalObservacao({
                    aberto: false,
                    cardId: "",
                    observacaoAtual: "",
                  })
                }
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={modalObservacao.observacaoAtual}
              onChange={(e) =>
                setModalObservacao({
                  ...modalObservacao,
                  observacaoAtual: e.target.value,
                })
              }
              placeholder="Digite sua observação..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />

            <div className="flex space-x-3 mt-4">
              <button
                onClick={salvarObservacao}
                disabled={salvandoObservacao}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {salvandoObservacao ? "Salvando..." : "Salvar"}
              </button>
              <button
                onClick={() =>
                  setModalObservacao({
                    aberto: false,
                    cardId: "",
                    observacaoAtual: "",
                  })
                }
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