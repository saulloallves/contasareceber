import React, { useState, useEffect } from 'react';
import { 
  DragDropContext, Droppable, Draggable, DropResult 
} from 'react-beautiful-dnd';
import { 
  MessageSquare, Calendar, Scale, Phone, Mail, Eye, 
  Clock, DollarSign, AlertTriangle, CheckCircle, User,
  Filter, Download, RefreshCw, Plus, Edit, X, Save
} from 'lucide-react';
import { KanbanService } from '../services/kanbanService';
import { CardCobranca, ColunaKanban, FiltrosKanban, EstatisticasKanban } from '../types/kanban';

export function KanbanCobranca() {
  const [colunas, setColunas] = useState<ColunaKanban[]>([]);
  const [cards, setCards] = useState<CardCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosKanban>({});
  const [estatisticas, setEstatisticas] = useState<EstatisticasKanban | null>(null);
  const [cardSelecionado, setCardSelecionado] = useState<CardCobranca | null>(null);
  const [modalAberto, setModalAberto] = useState<'detalhes' | 'acao' | 'observacao' | null>(null);
  const [observacaoEditando, setObservacaoEditando] = useState('');
  const [processando, setProcessando] = useState(false);

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
        kanbanService.buscarEstatisticas()
      ]);
      
      setColunas(colunasData);
      setCards(cardsData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados do Kanban:', error);
    } finally {
      setCarregando(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    setProcessando(true);
    try {
      await kanbanService.moverCard(
        draggableId,
        destination.droppableId,
        'usuario_atual',
        'Movimentação manual via Kanban'
      );
      carregarDados();
    } catch (error) {
      console.error('Erro ao mover card:', error);
    } finally {
      setProcessando(false);
    }
  };

  const executarAcao = async (cardId: string, acao: string) => {
    setProcessando(true);
    try {
      await kanbanService.executarAcaoRapida(cardId, acao, 'usuario_atual');
      carregarDados();
      setModalAberto(null);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
    } finally {
      setProcessando(false);
    }
  };

  const salvarObservacao = async () => {
    if (!cardSelecionado || !observacaoEditando.trim()) return;

    setProcessando(true);
    try {
      await kanbanService.atualizarObservacao(
        cardSelecionado.id,
        observacaoEditando,
        'usuario_atual'
      );
      carregarDados();
      setModalAberto(null);
      setObservacaoEditando('');
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
    } finally {
      setProcessando(false);
    }
  };

  const exportarKanban = async () => {
    try {
      const csv = await kanbanService.exportarKanban(filtros);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanban-cobranca-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar Kanban:', error);
    }
  };

  const getCardsByColuna = (colunaId: string) => {
    return cards.filter(card => card.status_atual === colunaId);
  };

  const getCorCard = (card: CardCobranca) => {
    if (card.dias_parado > 7) return 'border-red-500 bg-red-50';
    if (card.valor_total > 5000) return 'border-orange-500 bg-orange-50';
    if (card.status_atual === 'quitado') return 'border-green-500 bg-green-50';
    return 'border-gray-300 bg-white';
  };

  const getIconeStatus = (status: string) => {
    const icones: Record<string, JSX.Element> = {
      'em_aberto': <Clock className="w-4 h-4 text-gray-600" />,
      'notificado': <MessageSquare className="w-4 h-4 text-blue-600" />,
      'reuniao_agendada': <Calendar className="w-4 h-4 text-purple-600" />,
      'em_negociacao': <User className="w-4 h-4 text-yellow-600" />,
      'proposta_enviada': <Mail className="w-4 h-4 text-orange-600" />,
      'aguardando_pagamento': <Clock className="w-4 h-4 text-blue-600" />,
      'pagamento_parcial': <DollarSign className="w-4 h-4 text-green-600" />,
      'quitado': <CheckCircle className="w-4 h-4 text-green-600" />,
      'ignorado': <AlertTriangle className="w-4 h-4 text-red-600" />,
      'notificacao_formal': <Scale className="w-4 h-4 text-purple-600" />,
      'escalado_juridico': <Scale className="w-4 h-4 text-red-600" />,
      'inadimplencia_critica': <AlertTriangle className="w-4 h-4 text-red-700" />
    };
    return icones[status] || <Clock className="w-4 h-4 text-gray-600" />;
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Kanban de Cobrança</h1>
              <p className="text-gray-600">Acompanhamento visual do fluxo de cobrança por unidade</p>
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
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.total_cards}</div>
              <div className="text-sm text-blue-800">Total de Unidades</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{estatisticas.cards_criticos}</div>
              <div className="text-sm text-red-800">Situação Crítica</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.cards_parados}</div>
              <div className="text-sm text-yellow-800">Parados +7 dias</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{estatisticas.tempo_medio_resolucao.toFixed(0)}</div>
              <div className="text-sm text-green-800">Dias Médios</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatarMoeda(estatisticas.valor_total_fluxo)}</div>
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
              value={filtros.unidade || ''}
              onChange={(e) => setFiltros({...filtros, unidade: e.target.value})}
              placeholder="Código da unidade"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={filtros.tipo_debito || ''}
              onChange={(e) => setFiltros({...filtros, tipo_debito: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Tipos</option>
              <option value="royalties">Royalties</option>
              <option value="insumos">Insumos</option>
              <option value="aluguel">Aluguel</option>
              <option value="multa">Multa</option>
            </select>
            
            <select
              value={filtros.responsavel || ''}
              onChange={(e) => setFiltros({...filtros, responsavel: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos Responsáveis</option>
              <option value="cobranca">Equipe Cobrança</option>
              <option value="juridico">Jurídico</option>
              <option value="financeiro">Financeiro</option>
            </select>
            
            <select
              value={filtros.criticidade || ''}
              onChange={(e) => setFiltros({...filtros, criticidade: e.target.value})}
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
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="overflow-x-auto">
            <div className="flex space-x-4 min-w-max pb-4">
              {colunas.map((coluna) => (
                <div key={coluna.id} className="w-80 bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {getIconeStatus(coluna.id)}
                      <h3 className="ml-2 font-semibold text-gray-800">{coluna.nome}</h3>
                    </div>
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                      {getCardsByColuna(coluna.id).length}
                    </span>
                  </div>
                  
                  <Droppable droppableId={coluna.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-96 space-y-3 ${
                          snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''
                        }`}
                      >
                        {getCardsByColuna(coluna.id).map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-4 rounded-lg border-2 shadow-sm cursor-pointer transition-all ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : 'hover:shadow-md'
                                } ${getCorCard(card)}`}
                                onClick={() => {
                                  setCardSelecionado(card);
                                  setModalAberto('detalhes');
                                }}
                              >
                                {/* Header do Card */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                      {card.codigo_unidade.slice(-2)}
                                    </div>
                                    <div className="ml-2">
                                      <p className="font-semibold text-gray-800 text-sm">{card.nome_unidade}</p>
                                      <p className="text-xs text-gray-500">{card.codigo_unidade}</p>
                                    </div>
                                  </div>
                                  {card.dias_parado > 7 && (
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" title="Parado há mais de 7 dias" />
                                  )}
                                </div>

                                {/* Informações do Débito */}
                                <div className="space-y-2 mb-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Valor Total:</span>
                                    <span className="font-bold text-red-600 text-sm">{formatarMoeda(card.valor_total)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Tipo:</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                      {card.tipo_debito.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Venc. Antiga:</span>
                                    <span className="text-xs text-gray-800">{formatarData(card.data_vencimento_antiga)}</span>
                                  </div>
                                </div>

                                {/* Última Ação */}
                                <div className="bg-gray-50 rounded p-2 mb-3">
                                  <p className="text-xs text-gray-600 mb-1">Última ação:</p>
                                  <p className="text-xs text-gray-800 truncate">{card.ultima_acao}</p>
                                  <p className="text-xs text-gray-500">{formatarData(card.data_ultima_acao)}</p>
                                </div>

                                {/* Responsável */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center">
                                    <User className="w-3 h-3 text-gray-500 mr-1" />
                                    <span className="text-xs text-gray-600">{card.responsavel_atual}</span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {card.dias_parado}d na etapa
                                  </span>
                                </div>

                                {/* Ações Rápidas */}
                                <div className="flex space-x-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      executarAcao(card.id, 'whatsapp');
                                    }}
                                    className="flex-1 p-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                                    title="Enviar WhatsApp"
                                  >
                                    <MessageSquare className="w-3 h-3 mx-auto" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      executarAcao(card.id, 'reuniao');
                                    }}
                                    className="flex-1 p-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                                    title="Agendar Reunião"
                                  >
                                    <Calendar className="w-3 h-3 mx-auto" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCardSelecionado(card);
                                      setObservacaoEditando(card.observacoes || '');
                                      setModalAberto('observacao');
                                    }}
                                    className="flex-1 p-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                                    title="Adicionar Observação"
                                  >
                                    <Edit className="w-3 h-3 mx-auto" />
                                  </button>
                                </div>

                                {/* Observações */}
                                {card.observacoes && (
                                  <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400 rounded">
                                    <p className="text-xs text-yellow-800 truncate">{card.observacoes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      </div>

      {/* Modal de Detalhes */}
      {modalAberto === 'detalhes' && cardSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Detalhes - {cardSelecionado.nome_unidade}
              </h3>
              <button onClick={() => setModalAberto(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Código da Unidade</label>
                  <p className="text-gray-900">{cardSelecionado.codigo_unidade}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome da Unidade</label>
                  <p className="text-gray-900">{cardSelecionado.nome_unidade}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo de Débito</label>
                  <p className="text-gray-900">{cardSelecionado.tipo_debito}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valor Total</label>
                  <p className="text-red-600 font-bold">{formatarMoeda(cardSelecionado.valor_total)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data Vencimento Antiga</label>
                  <p className="text-gray-900">{formatarData(cardSelecionado.data_vencimento_antiga)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Responsável Atual</label>
                  <p className="text-gray-900">{cardSelecionado.responsavel_atual}</p>
                </div>
              </div>

              {/* Última Ação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Última Ação</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-800">{cardSelecionado.ultima_acao}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatarData(cardSelecionado.data_ultima_acao)}</p>
                </div>
              </div>

              {/* Observações */}
              {cardSelecionado.observacoes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">{cardSelecionado.observacoes}</p>
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex space-x-3">
                <button
                  onClick={() => executarAcao(cardSelecionado.id, 'whatsapp')}
                  disabled={processando}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </button>
                <button
                  onClick={() => executarAcao(cardSelecionado.id, 'reuniao')}
                  disabled={processando}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Reunião
                </button>
                <button
                  onClick={() => executarAcao(cardSelecionado.id, 'juridico')}
                  disabled={processando}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Scale className="w-4 h-4 mr-2" />
                  Jurídico
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Observação */}
      {modalAberto === 'observacao' && cardSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Adicionar Observação</h3>
              <button onClick={() => setModalAberto(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observação para {cardSelecionado.nome_unidade}
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
                  {processando ? 'Salvando...' : 'Salvar'}
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