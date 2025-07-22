import React, { useState, useEffect } from 'react';
import { 
  Target, TrendingUp, AlertTriangle, Clock, Zap, Settings, 
  Download, RefreshCw, Eye, ArrowUp, ArrowDown, Play, Pause,
  BarChart3, Users, DollarSign, Calendar, Filter
} from 'lucide-react';
import { PriorizacaoService } from '../services/priorizacaoService';
import { FilaCobranca, EstatisticasPriorizacao, CriterioPriorizacao } from '../types/priorizacao';

export function PainelPriorizacao() {
  const [filaCobranca, setFilaCobranca] = useState<FilaCobranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasPriorizacao | null>(null);
  const [modalAberto, setModalAberto] = useState<'configurar' | 'escalar' | 'detalhes' | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<FilaCobranca | null>(null);
  const [criterios, setCriterios] = useState<CriterioPriorizacao | null>(null);
  const [automacaoAtiva, setAutomacaoAtiva] = useState(true);
  const [filtros, setFiltros] = useState({
    nivel: '',
    status: '',
    valorMin: '',
    limite: 50
  });

  const priorizacaoService = new PriorizacaoService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [filaData, statsData] = await Promise.all([
        priorizacaoService.gerarFilaCobranca(filtros.limite),
        priorizacaoService.buscarEstatisticasPriorizacao()
      ]);
      
      // Aplica filtros locais
      let filaFiltrada = filaData;
      
      if (filtros.nivel) {
        filaFiltrada = filaFiltrada.filter(item => item.nivel_escalonamento.toString() === filtros.nivel);
      }
      
      if (filtros.status) {
        filaFiltrada = filaFiltrada.filter(item => item.status_atual === filtros.status);
      }
      
      if (filtros.valorMin) {
        filaFiltrada = filaFiltrada.filter(item => item.valor_total >= parseFloat(filtros.valorMin));
      }
      
      setFilaCobranca(filaFiltrada);
      setEstatisticas(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const atualizarPriorizacao = async () => {
    setProcessando(true);
    try {
      const unidadesAtualizadas = await priorizacaoService.atualizarPriorizacaoGeral();
      alert(`${unidadesAtualizadas} unidades atualizadas na fila de priorização!`);
      carregarDados();
    } catch (error) {
      alert(`Erro na atualização: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const executarAcoesAutomaticas = async () => {
    setProcessando(true);
    try {
      const acoes = await priorizacaoService.executarAcoesAutomaticas();
      alert(`${acoes.length} ações automáticas executadas!`);
      carregarDados();
    } catch (error) {
      alert(`Erro ao executar ações: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const forcarEscalonamento = async (cnpjUnidade: string, novoNivel: number) => {
    const motivo = prompt('Motivo do escalonamento manual:');
    if (!motivo) return;

    try {
      await priorizacaoService.forcarEscalonamento(cnpjUnidade, novoNivel, motivo, 'usuario_atual');
      alert('Escalonamento realizado com sucesso!');
      carregarDados();
    } catch (error) {
      alert(`Erro ao escalar: ${error}`);
    }
  };

  const exportarFila = async () => {
    try {
      const csv = await priorizacaoService.exportarFilaPriorizacao();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fila-priorizacao-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Erro ao exportar fila');
    }
  };

  const getNivelColor = (nivel: number) => {
    switch (nivel) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-yellow-100 text-yellow-800';
      case 3: return 'bg-orange-100 text-orange-800';
      case 4: return 'bg-red-100 text-red-800';
      case 5: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNivelLabel = (nivel: number) => {
    switch (nivel) {
      case 1: return 'Aviso Amistoso';
      case 2: return 'Cobrança Formal';
      case 3: return 'Reunião Obrigatória';
      case 4: return 'Acordo Final';
      case 5: return 'Jurídico';
      default: return `Nível ${nivel}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critica': return 'bg-red-100 text-red-800';
      case 'ativa_atraso': return 'bg-orange-100 text-orange-800';
      case 'negociacao': return 'bg-blue-100 text-blue-800';
      case 'acordo': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600 font-bold';
    if (score >= 60) return 'text-orange-600 font-semibold';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Priorização Inteligente de Cobrança</h1>
              <p className="text-gray-600">Automação baseada em critérios de urgência e impacto financeiro</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-2">Automação:</span>
              <button
                onClick={() => setAutomacaoAtiva(!automacaoAtiva)}
                className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  automacaoAtiva 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {automacaoAtiva ? <Play className="w-4 h-4 mr-1" /> : <Pause className="w-4 h-4 mr-1" />}
                {automacaoAtiva ? 'Ativa' : 'Pausada'}
              </button>
            </div>
            
            <button
              onClick={exportarFila}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            
            <button
              onClick={executarAcoesAutomaticas}
              disabled={processando || !automacaoAtiva}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {processando ? 'Executando...' : 'Executar Ações'}
            </button>
            
            <button
              onClick={atualizarPriorizacao}
              disabled={processando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${processando ? 'animate-spin' : ''}`} />
              {processando ? 'Atualizando...' : 'Atualizar Fila'}
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.total_unidades_fila}</div>
              <div className="text-sm text-blue-800">Unidades na Fila</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{estatisticas.unidades_criticas}</div>
              <div className="text-sm text-red-800">Críticas (Nível 4-5)</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{formatarMoeda(estatisticas.valor_total_priorizado)}</div>
              <div className="text-sm text-green-800">Valor Total</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{estatisticas.taxa_escalonamento_automatico.toFixed(1)}%</div>
              <div className="text-sm text-purple-800">Taxa Automação</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.tempo_medio_resolucao.toFixed(0)} dias</div>
              <div className="text-sm text-yellow-800">Tempo Médio</div>
            </div>
          </div>
        )}

        {/* Níveis de Escalonamento */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Níveis de Escalonamento Automático
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
              <h4 className="font-medium text-green-700 mb-2">🟢 Nível 1 (0-5 dias)</h4>
              <p className="text-gray-600">Aviso amistoso automático</p>
            </div>
            <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-500">
              <h4 className="font-medium text-yellow-700 mb-2">🟡 Nível 2 (6-15 dias)</h4>
              <p className="text-gray-600">Cobrança formal com juros</p>
            </div>
            <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500">
              <h4 className="font-medium text-orange-700 mb-2">🟠 Nível 3 (16-30 dias)</h4>
              <p className="text-gray-600">Reunião obrigatória</p>
            </div>
            <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
              <h4 className="font-medium text-red-700 mb-2">🔴 Nível 4 (31-45 dias)</h4>
              <p className="text-gray-600">Acordo última instância</p>
            </div>
            <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
              <h4 className="font-medium text-purple-700 mb-2">🟣 Nível 5 (45+ dias)</h4>
              <p className="text-gray-600">Escalonamento jurídico</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros da Fila</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filtros.nivel}
              onChange={(e) => setFiltros({...filtros, nivel: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Níveis</option>
              <option value="1">Nível 1 - Aviso Amistoso</option>
              <option value="2">Nível 2 - Cobrança Formal</option>
              <option value="3">Nível 3 - Reunião Obrigatória</option>
              <option value="4">Nível 4 - Acordo Final</option>
              <option value="5">Nível 5 - Jurídico</option>
            </select>
            
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({...filtros, status: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="critica">Crítica</option>
              <option value="ativa_atraso">Ativa com Atraso</option>
              <option value="negociacao">Em Negociação</option>
              <option value="acordo">Com Acordo</option>
            </select>
            
            <input
              type="number"
              value={filtros.valorMin}
              onChange={(e) => setFiltros({...filtros, valorMin: e.target.value})}
              placeholder="Valor mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={filtros.limite}
              onChange={(e) => setFiltros({...filtros, limite: parseInt(e.target.value)})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={200}>Top 200</option>
            </select>
          </div>
        </div>

        {/* Fila de Priorização */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nível
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dias Atraso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Próxima Ação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carregando ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                      Carregando fila de priorização...
                    </div>
                  </td>
                </tr>
              ) : filaCobranca.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma unidade na fila de priorização
                  </td>
                </tr>
              ) : (
                filaCobranca.map((item) => (
                  <tr key={item.cnpj_unidade} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          item.posicao <= 5 ? 'bg-red-100 text-red-800' :
                          item.posicao <= 15 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.posicao}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.nome_franqueado}</div>
                        <div className="text-sm text-gray-500">{item.cnpj_unidade}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(item.score_priorizacao, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-medium ${getScoreColor(item.score_priorizacao)}`}>
                          {item.score_priorizacao}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getNivelColor(item.nivel_escalonamento)}`}>
                        {getNivelLabel(item.nivel_escalonamento)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        {formatarMoeda(item.valor_total)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        item.dias_atraso > 45 ? 'text-red-600' :
                        item.dias_atraso > 30 ? 'text-orange-600' :
                        item.dias_atraso > 15 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {item.dias_atraso} dias
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status_atual)}`}>
                        {item.status_atual.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{item.proxima_acao}</div>
                        <div className="text-sm text-gray-500">{formatarData(item.data_proxima_acao)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setItemSelecionado(item);
                            setModalAberto('detalhes');
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {item.nivel_escalonamento < 5 && (
                          <button
                            onClick={() => forcarEscalonamento(item.cnpj_unidade, item.nivel_escalonamento + 1)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Escalar nível"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        )}
                        {item.nivel_escalonamento > 1 && (
                          <button
                            onClick={() => forcarEscalonamento(item.cnpj_unidade, item.nivel_escalonamento - 1)}
                            className="text-green-600 hover:text-green-900"
                            title="Reduzir nível"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {modalAberto === 'detalhes' && itemSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Detalhes da Priorização - {itemSelecionado.nome_franqueado}
              </h3>
              <button onClick={() => setModalAberto(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Score Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Composição do Score</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Valor em Aberto:</span>
                    <span className="font-medium">{formatarMoeda(itemSelecionado.valor_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dias de Atraso:</span>
                    <span className="font-medium">{itemSelecionado.dias_atraso} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Score Total:</span>
                    <span className={`font-bold ${getScoreColor(itemSelecionado.score_priorizacao)}`}>
                      {itemSelecionado.score_priorizacao} pontos
                    </span>
                  </div>
                </div>
              </div>

              {/* Nível Atual */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Nível de Escalonamento Atual</h4>
                <div className="flex items-center">
                  <span className={`px-3 py-2 rounded-full text-sm font-medium ${getNivelColor(itemSelecionado.nivel_escalonamento)}`}>
                    {getNivelLabel(itemSelecionado.nivel_escalonamento)}
                  </span>
                  <div className="ml-4">
                    <div className="text-sm text-blue-700">Próxima Ação:</div>
                    <div className="font-medium text-blue-800">{itemSelecionado.proxima_acao}</div>
                  </div>
                </div>
              </div>

              {/* Status da Unidade */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">Status da Unidade</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(itemSelecionado.status_atual)}`}>
                  {itemSelecionado.status_atual.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
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