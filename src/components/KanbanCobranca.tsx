/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {
  CircleDollarSign,
  Filter,
  RefreshCw,
  Download,
  MessageSquare,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  User,
  Phone,
  Mail,
  Eye,
  Edit,
  Save,
  X,
  CreditCard,
  Package,
  Scale,
  Ban,
} from "lucide-react";
import { KanbanService } from "../services/kanbanService";
import { cobrancaService } from "../services/cobrancaService";
import { n8nService } from "../services/n8nService";
import { emailService } from "../services/emailService";
import { CardCobranca, ColunaKanban, FiltrosKanban, EstatisticasKanban } from "../types/kanban";
import { formatarCNPJCPF, formatarMoeda } from "../utils/formatters";
import { connectionService } from "../services/connectionService";
import { toast } from "react-hot-toast";

export function KanbanCobranca() {
  const [colunas, setColunas] = useState<ColunaKanban[]>([]);
  const [cards, setCards] = useState<CardCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosKanban>({});
  const [estatisticas, setEstatisticas] = useState<EstatisticasKanban | null>(null);
  const [agrupadoPorUnidade, setAgrupadoPorUnidade] = useState(true);
  const [modalObservacao, setModalObservacao] = useState<{
    aberto: boolean;
    cardId: string;
    observacaoAtual: string;
  }>({ aberto: false, cardId: "", observacaoAtual: "" });
  const [modalDetalhes, setModalDetalhes] = useState<{
    aberto: boolean;
    card: CardCobranca | null;
  }>({ aberto: false, card: null });
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);
  const [processandoAcao, setProcessandoAcao] = useState<string | null>(null);

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

  // Monitora status de conexão
  useEffect(() => {
    const removeListener = connectionService.addStatusListener((status) => {
      if (!status.isConnected) {
        console.warn('⚠️ Conexão perdida detectada no Kanban');
      }
    });
    
    return removeListener;
  }, []);

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    
    if (source.droppableId === destination.droppableId) return;

    const card = cards.find(c => c.id === draggableId);
    if (!card) return;

    // Verificar regras de negócio para parcelamentos - VERSÃO ATUALIZADA
    const sourceColumn = colunas.find(c => c.id === source.droppableId);
    const destColumn = colunas.find(c => c.id === destination.droppableId);
    
    if (!sourceColumn || !destColumn) return;

    // Regra 1: Impedir movimento de cobranças parceladas originais para colunas incompatíveis
    if (card.status_atual === 'parcelado' && !['parcelado', 'juridico', 'perda'].includes(destination.droppableId)) {
      toast.error("Cobranças parceladas só podem ser movidas para Jurídico ou Perda. Para alterar o parcelamento, use a gestão de acordos.");
      return;
    }

    // Regra 2: Parcelas futuras só podem ser quitadas, permanecer como parcelas ou ir para inadimplência/jurídico
    if (card.status_atual === 'parcelas' && !['quitado', 'parcelas', 'inadimplencia', 'juridico'].includes(destination.droppableId)) {
      toast.error("Parcelas futuras só podem ser quitadas, permanecer como parcelas ou ir para inadimplência/jurídico se vencidas.");
      return;
    }

    // Regra 3: Impedir movimento de parcelas para negociação (parcelas não são negociáveis individualmente)
    if (card.status_atual === 'parcelas' && destination.droppableId === 'em_negociacao') {
      toast.error("Parcelas individuais não podem ser negociadas. Para renegociar, use a gestão de acordos do parcelamento original.");
      return;
    }

    // Regra 4: Confirmação para movimentos críticos
    if (['perda', 'juridico'].includes(destination.droppableId)) {
      const confirmacao = confirm(`Tem certeza que deseja mover "${card.nome_unidade}" para "${destColumn.nome}"?`);
      if (!confirmacao) return;
    }

    // Regra 5: Validação especial para quitação de parcelas
    if (card.status_atual === 'parcelas' && destination.droppableId === 'quitado') {
      const confirmacao = confirm(`Confirma o pagamento da parcela "${card.nome_unidade}"?\n\nEsta ação marcará a parcela como paga no sistema de acordos.`);
      if (!confirmacao) return;
    }
    try {
      await kanbanService.moverCard(
        draggableId,
        source.droppableId,
        destination.droppableId,
        "usuario_atual",
        `Movido via Kanban de ${sourceColumn.nome} para ${destColumn.nome}`
      );

      // Atualiza localmente para feedback imediato
      setCards(prevCards => 
        prevCards.map(c => 
          c.id === draggableId 
            ? { ...c, status_atual: destination.droppableId }
            : c
        )
      );

      toast.success(`Card movido para ${destColumn.nome}`);
      
      // Recarrega dados após um breve delay
      setTimeout(carregarDados, 1000);
    } catch (error) {
      console.error("Erro ao mover card:", error);
      toast.error("Erro ao mover card");
    }
  };

  const executarAcaoRapida = async (cardId: string, acao: string) => {
    setProcessandoAcao(cardId);
    try {
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      switch (acao) {
        case "whatsapp":
          await enviarWhatsApp(card);
          break;
        case "email":
          await enviarEmail(card);
          break;
        case "detalhes":
          setModalDetalhes({ aberto: true, card });
          break;
        default:
          await kanbanService.executarAcaoRapida(cardId, acao, "usuario_atual", agrupadoPorUnidade);
      }
      
      if (acao !== "detalhes") {
        toast.success(`Ação ${acao} executada com sucesso`);
        carregarDados();
      }
    } catch (error) {
      console.error(`Erro ao executar ação ${acao}:`, error);
      toast.error(`Erro ao executar ação ${acao}`);
    } finally {
      setProcessandoAcao(null);
    }
  };

  const enviarWhatsApp = async (card: CardCobranca) => {
    try {
      // Busca dados da unidade para obter telefone
      const { data: unidade } = await cobrancaService.buscarCobrancas({
        cnpj: card.cnpj || card.cpf,
        incluirParcelas: false
      });

      if (!unidade || unidade.length === 0) {
        throw new Error("Dados da unidade não encontrados");
      }

      const telefone = unidade[0]?.telefone;
      if (!telefone) {
        throw new Error("Telefone não cadastrado para esta unidade");
      }

      const mensagem = `Olá! Temos uma pendência financeira em aberto para sua unidade.

💰 Valor: ${formatarMoeda(card.valor_total)}
📅 Vencimento: ${new Date(card.data_vencimento_antiga).toLocaleDateString('pt-BR')}

Para regularizar ou negociar, entre em contato conosco.

_Sistema de Cobrança Cresci e Perdi_`;

      await n8nService.enviarWhatsApp({
        number: telefone,
        text: mensagem,
        instanceName: "automacoes_3",
        metadata: {
          tipo: "cobranca_kanban",
          cardId: card.id,
          origem: "kanban"
        }
      });

    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      throw error;
    }
  };

  const enviarEmail = async (card: CardCobranca) => {
    try {
      // Busca dados da unidade para obter email
      const { data: unidade } = await cobrancaService.buscarCobrancas({
        cnpj: card.cnpj || card.cpf,
        incluirParcelas: false
      });

      if (!unidade || unidade.length === 0) {
        throw new Error("Dados da unidade não encontrados");
      }

      const email = unidade[0]?.email_cobranca;
      if (!email) {
        throw new Error("Email não cadastrado para esta unidade");
      }

      await emailService.enviarMensagemCobranca(
        "padrao",
        "",
        { email_franqueado: email, nome_franqueado: card.nome_unidade },
        {
          id: card.id,
          cliente: card.nome_unidade,
          cnpj: card.cnpj,
          cpf: card.cpf,
          valor_atualizado: card.valor_total,
          valor_original: card.valor_original || card.valor_total,
          data_vencimento: card.data_vencimento_antiga
        }
      );

    } catch (error) {
      console.error("Erro ao enviar email:", error);
      throw error;
    }
  };

  const abrirModalObservacao = (card: CardCobranca) => {
    setModalObservacao({
      aberto: true,
      cardId: card.id,
      observacaoAtual: card.observacoes || ""
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
      toast.success("Observação salva com sucesso");
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar observação:", error);
      toast.error("Erro ao salvar observação");
    } finally {
      setSalvandoObservacao(false);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await kanbanService.exportarKanban(filtros, agrupadoPorUnidade);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanban-cobrancas-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Dados exportados com sucesso");
    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  const getCardsPorColuna = (colunaId: string) => {
    return cards.filter(card => card.status_atual === colunaId);
  };

  const getCorCriticidade = (criticidade: string) => {
    switch (criticidade) {
      case "critica": return "border-l-4 border-red-500 bg-red-50";
      case "atencao": return "border-l-4 border-yellow-500 bg-yellow-50";
      default: return "border-l-4 border-gray-300 bg-white";
    }
  };

  const getIconeStatus = (status: string) => {
    switch (status) {
      case "em_aberto": return <AlertTriangle className="w-4 h-4 text-gray-600" />;
      case "em_negociacao": return <MessageSquare className="w-4 h-4 text-yellow-600" />;
      case "parcelado": return <CreditCard className="w-4 h-4 text-purple-600" />;
      case "parcelas": return <Package className="w-4 h-4 text-blue-600" />;
      case "inadimplencia": return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "juridico": return <Scale className="w-4 h-4 text-blue-600" />;
      case "perda": return <Ban className="w-4 h-4 text-red-700" />;
      case "quitado": return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const CardComponent = ({ card, index }: { card: CardCobranca; index: number }) => {
    const isParcelaIndividual = card.status_atual === 'parcelas';
    const isCobrancaParcelada = card.status_atual === 'parcelado';
    const isParcelamentoRelacionado = isParcelaIndividual || isCobrancaParcelada;
    
    return (
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`
              ${getCorCriticidade(card.criticidade)}
              rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-all duration-200
              ${snapshot.isDragging ? 'rotate-2 shadow-lg' : ''}
              ${isParcelaIndividual ? 'border-l-4 border-blue-500 bg-blue-50' : ''}
              ${isCobrancaParcelada ? 'border-l-4 border-purple-500 bg-purple-50' : ''}
            `}
          >
            {/* Header do Card */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getIconeStatus(card.status_atual)}
                  <h3 className="font-semibold text-gray-800 text-sm truncate">
                    {card.nome_unidade}
                  </h3>
                  {isParcelaIndividual && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      📅 Parcela
                    </span>
                  )}
                  {isCobrancaParcelada && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      🗂️ Parcelado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1">
                  {formatarCNPJCPF(card.cnpj || card.cpf || "")}
                </p>
                {agrupadoPorUnidade && card.quantidade_titulos > 1 && (
                  <p className="text-xs text-blue-600 font-medium">
                    {card.quantidade_titulos} título(s)
                  </p>
                )}
                {isParcelamentoRelacionado && (
                  <p className="text-xs text-purple-600 font-medium">
                    {isParcelaIndividual ? '💳 Parcela de acordo' : '📋 Cobrança parcelada'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-lg text-gray-900">
                  {formatarMoeda(card.valor_total)}
                </p>
                {card.valor_original && card.valor_original !== card.valor_total && (
                  <p className="text-xs text-gray-500 line-through">
                    {formatarMoeda(card.valor_original)}
                  </p>
                )}
              </div>
            </div>

            {/* Informações do Card */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Vencimento:</span>
                <span className="font-medium">
                  {new Date(card.data_vencimento_antiga).toLocaleDateString('pt-BR')}
                </span>
              </div>
              
              {card.data_vencimento_recente !== card.data_vencimento_antiga && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Mais recente:</span>
                  <span className="font-medium">
                    {new Date(card.data_vencimento_recente).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Responsável:</span>
                <span className="font-medium">{card.responsavel_atual}</span>
              </div>

              {card.descricao_cobranca && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  {card.descricao_cobranca}
                </div>
              )}

              {/* Informações específicas de parcelamento */}
              {isParcelamentoRelacionado && (
                <div className="text-xs bg-purple-50 border border-purple-200 p-2 rounded">
                  {isParcelaIndividual && (
                    <p className="text-purple-700">
                      💳 Esta é uma parcela individual de um acordo de parcelamento
                    </p>
                  )}
                  {isCobrancaParcelada && (
                    <p className="text-purple-700">
                      📋 Cobrança original foi parcelada em acordo
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Observações */}
            {card.observacoes && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p className="text-yellow-800 line-clamp-2">{card.observacoes}</p>
              </div>
            )}

            {/* Ações do Card */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-1">
                {/* Ações condicionais baseadas no tipo de cobrança */}
                {!isParcelaIndividual && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executarAcaoRapida(card.id, "whatsapp");
                      }}
                      disabled={processandoAcao === card.id}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                      title="Enviar WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        executarAcaoRapida(card.id, "email");
                      }}
                      disabled={processandoAcao === card.id}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                      title="Enviar Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                {/* Ação especial para parcelas */}
                {isParcelaIndividual && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executarAcaoRapida(card.id, "registrar_pagamento");
                    }}
                    disabled={processandoAcao === card.id}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                    title="Registrar Pagamento"
                  >
                    <CreditCard className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirModalObservacao(card);
                  }}
                  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  title="Adicionar Observação"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  executarAcaoRapida(card.id, "detalhes");
                }}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                title="Ver Detalhes"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const ColunaComponent = ({ coluna }: { coluna: ColunaKanban }) => {
    const cardsColuna = getCardsPorColuna(coluna.id);
    const valorTotal = cardsColuna.reduce((sum, card) => sum + card.valor_total, 0);

    return (
      <div className="bg-gray-50 rounded-lg p-4 min-h-[600px] w-80 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{coluna.nome}</h3>
            <p className="text-xs text-gray-600">{coluna.descricao}</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-gray-700">
              {cardsColuna.length}
            </div>
            <div className="text-xs text-gray-500">
              {formatarMoeda(valorTotal)}
            </div>
          </div>
        </div>

        <Droppable droppableId={coluna.id}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`
                min-h-[500px] transition-colors duration-200
                ${snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg' : ''}
              `}
            >
              {cardsColuna.map((card, index) => (
                <CardComponent key={card.id} card={card} index={index} />
              ))}
              {provided.placeholder}
              
              {cardsColuna.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-sm">Nenhum card nesta coluna</p>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <CircleDollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Kanban de Cobranças</h1>
              <p className="text-gray-600">
                Gestão visual do fluxo de cobrança e parcelamentos
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="agrupar"
                checked={agrupadoPorUnidade}
                onChange={(e) => setAgrupadoPorUnidade(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="agrupar" className="text-sm text-gray-700">
                Agrupar por unidade
              </label>
            </div>

            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>

            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-lg font-bold text-blue-600">{estatisticas.total_cards}</div>
              <div className="text-sm text-blue-800">Total de Cards</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-lg font-bold text-red-600">{estatisticas.cards_criticos}</div>
              <div className="text-sm text-red-800">Cards Críticos</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-lg font-bold text-orange-600">{estatisticas.inadimplentes_perda}</div>
              <div className="text-sm text-orange-800">Inadimplência/Perda</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-lg font-bold text-green-600">
                {formatarMoeda(estatisticas.valor_total_fluxo)}
              </div>
              <div className="text-sm text-green-800">Valor Total</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="text"
              value={filtros.unidade || ""}
              onChange={(e) => setFiltros({ ...filtros, unidade: e.target.value })}
              placeholder="Buscar unidade/CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            
            <select
              value={filtros.tipo_debito || ""}
              onChange={(e) => setFiltros({ ...filtros, tipo_debito: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos os Tipos</option>
              <option value="Franchising - Royalties">Royalties</option>
              <option value="Vendas - Vendas">Vendas</option>
              <option value="Franchising - Tx de Propagand">Taxa de Propaganda</option>
              <option value="- Multa/Infração">Multa/Infração</option>
              <option value="Franchising - Tx de Franquia">Taxa de Franquia</option>
            </select>

            <select
              value={filtros.responsavel || ""}
              onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos os Responsáveis</option>
              <option value="Equipe Cobrança">Equipe Cobrança</option>
              <option value="Jurídico">Jurídico</option>
              <option value="Diretoria">Diretoria</option>
            </select>

            <select
              value={filtros.criticidade || ""}
              onChange={(e) => setFiltros({ ...filtros, criticidade: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todas as Criticidades</option>
              <option value="normal">Normal</option>
              <option value="atencao">Atenção</option>
              <option value="critica">Crítica</option>
            </select>

            <input
              type="number"
              value={filtros.valor_min || ""}
              onChange={(e) => setFiltros({ ...filtros, valor_min: parseFloat(e.target.value) || undefined })}
              placeholder="Valor mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />

            <button
              onClick={() => setFiltros({})}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="h-full overflow-x-auto">
            <div className="flex space-x-4 p-6 min-w-max">
              {colunas
                .filter(coluna => coluna.ativa)
                .sort((a, b) => a.ordem - b.ordem)
                .map(coluna => (
                  <ColunaComponent key={coluna.id} coluna={coluna} />
                ))}
            </div>
          </div>
        </DragDropContext>
      </div>

      {/* Modal de Observação */}
      {modalObservacao.aberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Adicionar Observação</h3>
              <button
                onClick={() => setModalObservacao({ aberto: false, cardId: "", observacaoAtual: "" })}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={modalObservacao.observacaoAtual}
              onChange={(e) => setModalObservacao(prev => ({ ...prev, observacaoAtual: e.target.value }))}
              placeholder="Digite sua observação..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="flex space-x-3 mt-4">
              <button
                onClick={salvarObservacao}
                disabled={salvandoObservacao}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoObservacao ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {salvandoObservacao ? "Salvando..." : "Salvar"}
              </button>
              
              <button
                onClick={() => setModalObservacao({ aberto: false, cardId: "", observacaoAtual: "" })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalDetalhes.aberto && modalDetalhes.card && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Detalhes - {modalDetalhes.card.nome_unidade}
              </h3>
              <button
                onClick={() => setModalDetalhes({ aberto: false, card: null })}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Informações Básicas</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Código:</span>
                      <span className="font-medium">{modalDetalhes.card.codigo_unidade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">CNPJ/CPF:</span>
                      <span className="font-medium">{formatarCNPJCPF(modalDetalhes.card.cnpj || modalDetalhes.card.cpf || "")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <span className="font-medium">{modalDetalhes.card.tipo_debito}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{modalDetalhes.card.status_atual}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Valores</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Total:</span>
                      <span className="font-bold text-lg">{formatarMoeda(modalDetalhes.card.valor_total)}</span>
                    </div>
                    {modalDetalhes.card.valor_original && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor Original:</span>
                        <span className="font-medium">{formatarMoeda(modalDetalhes.card.valor_original)}</span>
                      </div>
                    )}
                    {modalDetalhes.card.valor_recebido && modalDetalhes.card.valor_recebido > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor Recebido:</span>
                        <span className="font-medium text-green-600">{formatarMoeda(modalDetalhes.card.valor_recebido)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quantidade:</span>
                      <span className="font-medium">{modalDetalhes.card.quantidade_titulos} título(s)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Datas */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Cronologia</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vencimento Mais Antigo:</span>
                    <span className="font-medium">{new Date(modalDetalhes.card.data_vencimento_antiga).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vencimento Mais Recente:</span>
                    <span className="font-medium">{new Date(modalDetalhes.card.data_vencimento_recente).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Última Ação:</span>
                    <span className="font-medium">{new Date(modalDetalhes.card.data_ultima_acao).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Responsável:</span>
                    <span className="font-medium">{modalDetalhes.card.responsavel_atual}</span>
                  </div>
                </div>
              </div>

              {/* Observações */}
              {modalDetalhes.card.observacoes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Observações</h4>
                  <p className="text-yellow-700 text-sm">{modalDetalhes.card.observacoes}</p>
                </div>
              )}

              {/* Última Ação */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Última Ação</h4>
                <p className="text-blue-700 text-sm">{modalDetalhes.card.ultima_acao}</p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModalDetalhes({ aberto: false, card: null })}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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