import React, { useState, useEffect } from 'react';
import { 
  Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  BarChart3, Download, Filter, RefreshCw, Eye, Settings, Zap
} from 'lucide-react';
import { ScoreRiscoService } from '../services/scoreRiscoService';
import { ScoreRisco as ScoreRiscoType, FiltrosScore, EstatisticasScore } from '../types/scoreRisco';

export function ScoreRisco() {
  const [scores, setScores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosScore>({});
  const [modalAberto, setModalAberto] = useState<'detalhes' | 'calcular' | null>(null);
  const [scoreSelecionado, setScoreSelecionado] = useState<any>(null);
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasScore | null>(null);
  const [cnpjCalculo, setCnpjCalculo] = useState('');

  const scoreRiscoService = new ScoreRiscoService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [scoresData, statsData] = await Promise.all([
        scoreRiscoService.buscarScores(filtros),
        scoreRiscoService.buscarEstatisticas()
      ]);
      setScores(scoresData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const calcularScoreIndividual = async () => {
    if (!cnpjCalculo.trim()) {
      alert('Digite um CNPJ válido');
      return;
    }

    setProcessando(true);
    try {
      const score = await scoreRiscoService.atualizarScore(cnpjCalculo, 'Cálculo manual via painel');
      setScoreSelecionado(score);
      setModalAberto('detalhes');
      carregarDados();
    } catch (error) {
      alert(`Erro ao calcular score: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const atualizarScoresLote = async () => {
    if (!confirm('Deseja recalcular o score de todas as unidades? Esta operação pode demorar alguns minutos.')) {
      return;
    }

    setProcessando(true);
    try {
      const atualizados = await scoreRiscoService.atualizarScoresLote();
      alert(`${atualizados} scores atualizados com sucesso!`);
      carregarDados();
    } catch (error) {
      alert(`Erro na atualização em lote: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const abrirDetalhes = (score: any) => {
    setScoreSelecionado(score);
    setModalAberto('detalhes');
  };

  const fecharModal = () => {
    setModalAberto(null);
    setScoreSelecionado(null);
    setCnpjCalculo('');
  };

  const exportarDados = async () => {
    try {
      const csv = await scoreRiscoService.exportarScores(filtros);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `score-risco-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Erro ao exportar dados');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getNivelRiscoIcon = (nivel: string) => {
    switch (nivel) {
      case 'baixo':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'medio':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'alto':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Target className="w-5 h-5 text-gray-600" />;
    }
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
              <h1 className="text-2xl font-bold text-gray-800">Score Dinâmico de Risco</h1>
              <p className="text-gray-600">Análise inteligente de inadimplência e conduta</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setModalAberto('calcular')}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Target className="w-4 h-4 mr-2" />
              Calcular Score
            </button>
            <button
              onClick={atualizarScoresLote}
              disabled={processando}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {processando ? 'Atualizando...' : 'Atualizar Lote'}
            </button>
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.total_unidades}</div>
              <div className="text-sm text-blue-800">Total de Unidades</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{estatisticas.distribuicao_risco.baixo}</div>
              <div className="text-sm text-green-800">Baixo Risco</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.distribuicao_risco.medio}</div>
              <div className="text-sm text-yellow-800">Médio Risco</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{estatisticas.distribuicao_risco.alto}</div>
              <div className="text-sm text-red-800">Alto Risco</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{estatisticas.score_medio_geral.toFixed(1)}</div>
              <div className="text-sm text-purple-800">Score Médio</div>
            </div>
          </div>
        )}

        {/* Fórmula do Score */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Fórmula do Score (0-100 pontos)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-blue-700 mb-2">Atraso Médio (25%)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Até 3 dias: 10 pts</li>
                <li>• 4-10 dias: 5 pts</li>
                <li>• 11+ dias: 0 pts</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-green-700 mb-2">Ocorrências 90d (25%)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 0-1: 10 pts</li>
                <li>• 2-3: 5 pts</li>
                <li>• 4+: 0 pts</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-yellow-700 mb-2">Reincidência (20%)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Não quebrou: 10 pts</li>
                <li>• Quebrou acordo: 0 pts</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-purple-700 mb-2">Comparecimento (15%)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Todas: 10 pts</li>
                <li>• Faltou 1: 5 pts</li>
                <li>• Faltou 2+: 0 pts</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-red-700 mb-2">Regularização (15%)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Até 3 dias: 10 pts</li>
                <li>• 4-7 dias: 5 pts</li>
                <li>• 8+ dias: 0 pts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={filtros.nivel_risco || ''}
              onChange={(e) => setFiltros({...filtros, nivel_risco: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Níveis</option>
              <option value="baixo">Baixo Risco</option>
              <option value="medio">Médio Risco</option>
              <option value="alto">Alto Risco</option>
            </select>
            
            <input
              type="number"
              value={filtros.score_min || ''}
              onChange={(e) => setFiltros({...filtros, score_min: parseFloat(e.target.value) || undefined})}
              placeholder="Score mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="number"
              value={filtros.score_max || ''}
              onChange={(e) => setFiltros({...filtros, score_max: parseFloat(e.target.value) || undefined})}
              placeholder="Score máximo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="text"
              value={filtros.cnpj || ''}
              onChange={(e) => setFiltros({...filtros, cnpj: e.target.value})}
              placeholder="CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <button
              onClick={() => setFiltros({})}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Tabela de Scores */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nível Risco
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Componentes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Última Atualização
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                      Carregando scores...
                    </div>
                  </td>
                </tr>
              ) : scores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Nenhum score encontrado
                  </td>
                </tr>
              ) : (
                scores.map((score) => (
                  <tr key={score.cnpj_unidade} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {score.unidades_franqueadas?.nome_franqueado || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">{score.cnpj_unidade}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${getScoreBarColor(score.score_atual)}`}
                            style={{ width: `${score.score_atual}%` }}
                          ></div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(score.score_atual)}`}>
                          {score.score_atual}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getNivelRiscoIcon(score.nivel_risco)}
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {score.nivel_risco.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-600">
                        <div>Atraso: {score.componentes_score.atraso_medio.valor.toFixed(1)}d</div>
                        <div>Ocorrências: {score.componentes_score.ocorrencias_90_dias.valor}</div>
                        <div>Faltas: {score.componentes_score.comparecimento_reunioes.faltas}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatarData(score.ultima_atualizacao)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => abrirDetalhes(score)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cálculo */}
      {modalAberto === 'calcular' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Calcular Score Individual</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ da Unidade
                </label>
                <input
                  type="text"
                  value={cnpjCalculo}
                  onChange={(e) => setCnpjCalculo(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  O score será calculado automaticamente com base nos dados históricos da unidade.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={calcularScoreIndividual}
                disabled={processando || !cnpjCalculo.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {processando ? 'Calculando...' : 'Calcular Score'}
              </button>
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalAberto === 'detalhes' && scoreSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Detalhes do Score - {scoreSelecionado.cnpj_unidade}
              </h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Score Atual */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold">Score Atual</h4>
                  <div className="flex items-center">
                    {getNivelRiscoIcon(scoreSelecionado.nivel_risco)}
                    <span className="ml-2 text-lg font-bold">
                      {scoreSelecionado.score_atual} pontos
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className={`h-4 rounded-full ${getScoreBarColor(scoreSelecionado.score_atual)}`}
                    style={{ width: `${scoreSelecionado.score_atual}%` }}
                  ></div>
                </div>
              </div>

              {/* Componentes do Score */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Componentes do Score</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(scoreSelecionado.componentes_score).map(([chave, componente]: [string, any]) => (
                    <div key={chave} className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-800 mb-2">
                        {chave.replace('_', ' ').toUpperCase()} ({componente.peso}%)
                      </h5>
                      <div className="space-y-1 text-sm">
                        <div>Valor: {typeof componente.valor === 'boolean' ? (componente.valor ? 'Sim' : 'Não') : componente.valor}</div>
                        <div>Pontos: {componente.pontos}/10</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(componente.pontos / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Histórico */}
              {scoreSelecionado.historico_score && scoreSelecionado.historico_score.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-4">Histórico de Variação</h4>
                  <div className="space-y-3">
                    {scoreSelecionado.historico_score.map((historico: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <div className="font-medium text-gray-800">
                            Score: {historico.score} ({historico.nivel_risco})
                          </div>
                          <div className="text-sm text-gray-600">{historico.motivo_alteracao}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatarData(historico.data)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}