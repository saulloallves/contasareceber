import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, 
  Download, Filter, RefreshCw, FileText, Target, Award,
  Calendar, CheckCircle, XCircle, Clock, Zap, Eye
} from 'lucide-react';
import { IndicadoresEstrategicosService } from '../services/indicadoresEstrategicosService';
import { IndicadoresEstrategicos, FiltrosIndicadores } from '../types/indicadoresEstrategicos';
import { formatMonetaryResponsive } from '../utils/monetaryUtils';

const CORES = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#6366F1',
  gray: '#6B7280'
};

export function PainelIndicadoresEstrategicos() {
  const [indicadores, setIndicadores] = useState<IndicadoresEstrategicos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosIndicadores>({
    tipo_cobranca: 'todos',
    incluir_quitados: true
  });
  const [abaSelecionada, setAbaSelecionada] = useState<'visao-geral' | 'evolucao' | 'reincidencia' | 'ranking' | 'projecao'>('visao-geral');
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

  const indicadoresService = new IndicadoresEstrategicosService();

  useEffect(() => {
    carregarIndicadores();
  }, [filtros]);

  const carregarIndicadores = async () => {
    setCarregando(true);
    try {
      const dados = await indicadoresService.buscarIndicadoresEstrategicos(filtros);
      setIndicadores(dados);
    } catch (error) {
      console.error('Erro ao carregar indicadores:', error);
    } finally {
      setCarregando(false);
    }
  };

  const gerarRelatorioExecutivo = async () => {
    if (!indicadores) return;

    setGerandoRelatorio(true);
    try {
      const blob = await indicadoresService.gerarRelatorioExecutivo(indicadores);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-estrategico-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const exportarDados = async () => {
    if (!indicadores) return;

    try {
      const csv = await indicadoresService.exportarIndicadores(indicadores);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indicadores-estrategicos-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarPercentual = (valor: number) => {
    return `${valor.toFixed(1)}%`;
  };

  const getVariacaoIcon = (valor: number) => {
    if (valor > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (valor < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Target className="w-4 h-4 text-gray-600" />;
  };

  const getVariacaoColor = (valor: number) => {
    if (valor > 0) return 'text-green-600';
    if (valor < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const renderMonetaryValue = (value: number, colorClass: string = '') => {
    const { formatted, className, shouldTruncate } = formatMonetaryResponsive(value, {
      compact: value >= 1000000
    });

    return (
      <p 
        className={`${className} ${colorClass} ${shouldTruncate ? 'monetary-truncate' : ''}`}
        title={shouldTruncate ? formatarMoeda(value) : undefined}
      >
        {formatted}
      </p>
    );
  };

  const getSituacaoColor = (situacao: string) => {
    switch (situacao) {
      case 'regular': return 'bg-green-100 text-green-800';
      case 'ativa': return 'bg-blue-100 text-blue-800';
      case 'negociacao': return 'bg-yellow-100 text-yellow-800';
      case 'judicial': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando indicadores estratégicos...</p>
        </div>
      </div>
    );
  }

  if (!indicadores) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Erro ao carregar indicadores estratégicos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Indicadores Estratégicos</h1>
          <p className="text-gray-600">Análise executiva de inadimplência e recuperação</p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <button
            onClick={exportarDados}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Dados
          </button>
          <button
            onClick={gerarRelatorioExecutivo}
            disabled={gerandoRelatorio}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            {gerandoRelatorio ? 'Gerando...' : 'Relatório PDF'}
          </button>
          <button
            onClick={carregarIndicadores}
            disabled={carregando}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filtros.tipo_cobranca || 'todos'}
            onChange={(e) => setFiltros({...filtros, tipo_cobranca: e.target.value as any})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="royalties">Royalties</option>
            <option value="insumos">Insumos</option>
          </select>
          
          <input
            type="number"
            placeholder="Valor mínimo"
            onChange={(e) => setFiltros({
              ...filtros, 
              faixa_valor: {
                ...filtros.faixa_valor,
                minimo: parseFloat(e.target.value) || 0
              }
            })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="number"
            placeholder="Valor máximo"
            onChange={(e) => setFiltros({
              ...filtros, 
              faixa_valor: {
                ...filtros.faixa_valor,
                maximo: parseFloat(e.target.value) || 999999
              }
            })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="incluir_quitados"
              checked={filtros.incluir_quitados || false}
              onChange={(e) => setFiltros({...filtros, incluir_quitados: e.target.checked})}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="incluir_quitados" className="ml-2 text-sm text-gray-700">
              Incluir quitados
            </label>
          </div>
        </div>
      </div>

      {/* Cards de Resumo Executivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-red-500 rounded-full flex-shrink-0">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-red-700">Total Devido</p>
              {renderMonetaryValue(indicadores.visao_geral_mensal.total_devido, 'text-red-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(indicadores.visao_geral_mensal.variacao_mes_anterior.devido)}`}>
                  {getVariacaoIcon(indicadores.visao_geral_mensal.variacao_mes_anterior.devido)}
                  <span className="ml-1">{Math.abs(indicadores.visao_geral_mensal.variacao_mes_anterior.devido).toFixed(1)}%</span>
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-green-500 rounded-full flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-green-700">Total Recuperado</p>
              {renderMonetaryValue(indicadores.visao_geral_mensal.total_recuperado, 'text-green-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(indicadores.visao_geral_mensal.variacao_mes_anterior.recuperado)}`}>
                  {getVariacaoIcon(indicadores.visao_geral_mensal.variacao_mes_anterior.recuperado)}
                  <span className="ml-1">{Math.abs(indicadores.visao_geral_mensal.variacao_mes_anterior.recuperado).toFixed(1)}%</span>
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-yellow-500 rounded-full flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-yellow-700">% Inadimplência</p>
              <p className="monetary-value text-yellow-600">
                {formatarPercentual(indicadores.visao_geral_mensal.percentual_inadimplencia)}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(-indicadores.visao_geral_mensal.variacao_mes_anterior.inadimplencia)}`}>
                  {getVariacaoIcon(-indicadores.visao_geral_mensal.variacao_mes_anterior.inadimplencia)}
                  <span className="ml-1">{Math.abs(indicadores.visao_geral_mensal.variacao_mes_anterior.inadimplencia).toFixed(1)}pp</span>
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 border border-purple-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-purple-500 rounded-full flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-purple-700">Unidades Críticas</p>
              <p className="monetary-value text-purple-600">
                {indicadores.reincidencia_criticos.unidades_criticas}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <span className="text-purple-600 font-semibold">
                  {formatarPercentual(indicadores.reincidencia_criticos.indicador_reincidencia_global)} reincidentes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'visao-geral', label: 'Visão Geral', icon: Target },
            { id: 'evolucao', label: 'Evolução Anual', icon: TrendingUp },
            { id: 'reincidencia', label: 'Reincidência', icon: AlertTriangle },
            { id: 'ranking', label: 'Ranking Performance', icon: Award },
            { id: 'projecao', label: 'Projeções', icon: Zap }
          ].map((aba) => {
            const Icon = aba.icon;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaSelecionada(aba.id as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  abaSelecionada === aba.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {aba.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      {abaSelecionada === 'visao-geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição por Tipo */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição por Tipo de Cobrança</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-800">Royalties</p>
                  <p className="text-sm text-blue-600">
                    Devido: {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.royalties.devido)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.royalties.recuperado)}
                  </p>
                  <p className="text-sm text-gray-500">Recuperado</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-800">Insumos</p>
                  <p className="text-sm text-green-600">
                    Devido: {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.insumos.devido)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.insumos.recuperado)}
                  </p>
                  <p className="text-sm text-gray-500">Recuperado</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Outros</p>
                  <p className="text-sm text-gray-600">
                    Devido: {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.outros.devido)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    {formatarMoeda(indicadores.visao_geral_mensal.distribuicao_por_tipo.outros.recuperado)}
                  </p>
                  <p className="text-sm text-gray-500">Recuperado</p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribuição por Região */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição por Região</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Estado</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Devido</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Recuperado</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.visao_geral_mensal.distribuicao_por_regiao.slice(0, 8).map((regiao, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 text-sm font-medium text-gray-900">{regiao.regiao}</td>
                      <td className="py-2 text-sm text-red-600 text-right">{formatarMoeda(regiao.devido)}</td>
                      <td className="py-2 text-sm text-green-600 text-right">{formatarMoeda(regiao.recuperado)}</td>
                      <td className="py-2 text-sm text-gray-500 text-right">{regiao.unidades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaSelecionada === 'evolucao' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolução Anual da Inadimplência</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={indicadores.evolucao_anual}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'percentual_inadimplencia' ? formatarPercentual(Number(value)) : formatarMoeda(Number(value)),
                  name === 'percentual_inadimplencia' ? '% Inadimplência' : 
                  name === 'valor_devido' ? 'Valor Devido' : 'Valor Recuperado'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="percentual_inadimplencia" 
                stroke={CORES.danger} 
                strokeWidth={3}
                name="% Inadimplência"
              />
              <Line 
                type="monotone" 
                dataKey="meta_inadimplencia" 
                stroke={CORES.warning} 
                strokeDasharray="5 5"
                name="Meta"
              />
            </LineChart>
          </ResponsiveContainer>
          
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Devido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Recuperado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Inadimplência</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status vs Meta</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {indicadores.evolucao_anual.slice(-6).map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.mes}/{item.ano}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {formatarMoeda(item.valor_devido)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatarMoeda(item.valor_recuperado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarPercentual(item.percentual_inadimplencia)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.percentual_inadimplencia > (item.meta_inadimplencia || 15) ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Acima da Meta
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Dentro da Meta
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaSelecionada === 'reincidencia' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{indicadores.reincidencia_criticos.top_reincidentes.length}</div>
              <div className="text-sm text-red-800">Top Reincidentes</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatarPercentual(indicadores.reincidencia_criticos.indicador_reincidencia_global)}
              </div>
              <div className="text-sm text-orange-800">% Reincidência Global</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{indicadores.reincidencia_criticos.unidades_criticas}</div>
              <div className="text-sm text-purple-800">Unidades Críticas</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-600">
                {formatarMoeda(indicadores.reincidencia_criticos.valor_total_criticos)}
              </div>
              <div className="text-sm text-gray-800">Valor Críticos</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Unidades Reincidentes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franqueado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ocorrências/Ano</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor 6 Meses</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Situação</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score Risco</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {indicadores.reincidencia_criticos.top_reincidentes.map((unidade, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {unidade.codigo_unidade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {unidade.nome_franqueado}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {unidade.ocorrencias_ano}x
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatarMoeda(unidade.valor_total_6_meses)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSituacaoColor(unidade.situacao_atual)}`}>
                          {unidade.situacao_atual.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className={`h-2 rounded-full ${unidade.score_risco >= 80 ? 'bg-red-500' : unidade.score_risco >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${unidade.score_risco}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{unidade.score_risco}/100</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaSelecionada === 'ranking' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Ranking de Performance por Responsável</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Sucesso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Recuperado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Casos Encerrados</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tempo Médio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meta</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {indicadores.ranking_recuperacao.map((responsavel, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{responsavel.responsavel}</div>
                        <div className="text-sm text-gray-500">{responsavel.especialidade.join(', ')}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${responsavel.percentual_sucesso}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{formatarPercentual(responsavel.percentual_sucesso)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatarMoeda(responsavel.valor_total_recuperado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {responsavel.casos_encerrados_pagamento}/{responsavel.casos_totais}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {responsavel.tempo_medio_recuperacao} dias
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {responsavel.percentual_sucesso >= (responsavel.meta_mensal || 80) ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaSelecionada === 'projecao' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Projeção Próximos 3 Meses</h3>
              <div className="space-y-4">
                {indicadores.projecao_tendencia.projecao_proximos_3_meses.map((projecao, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-800">{projecao.mes}</p>
                      <p className="text-sm text-blue-600">Confiabilidade: {projecao.confiabilidade}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{formatarMoeda(projecao.valor_projetado)}</p>
                      <div className="w-16 bg-blue-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${projecao.confiabilidade}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Fatores de Influência</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Sazonalidade</span>
                  <div className="flex items-center">
                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${indicadores.projecao_tendencia.fatores_influencia.sazonalidade}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{indicadores.projecao_tendencia.fatores_influencia.sazonalidade}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Crescimento da Rede</span>
                  <div className="flex items-center">
                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${indicadores.projecao_tendencia.fatores_influencia.crescimento_rede * 10}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{indicadores.projecao_tendencia.fatores_influencia.crescimento_rede}%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Eficiência Cobrança</span>
                  <div className="flex items-center">
                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${indicadores.projecao_tendencia.fatores_influencia.eficiencia_cobranca}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{indicadores.projecao_tendencia.fatores_influencia.eficiencia_cobranca}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Ações Recomendadas</h3>
            <div className="space-y-4">
              {indicadores.projecao_tendencia.sugestoes_acoes.map((acao, index) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  acao.prioridade === 'alta' ? 'border-red-500 bg-red-50' :
                  acao.prioridade === 'media' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          acao.prioridade === 'alta' ? 'bg-red-100 text-red-800' :
                          acao.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {acao.prioridade.toUpperCase()}
                        </span>
                        <span className="ml-3 text-sm text-gray-600">
                          Impacto: {acao.impacto_estimado}% | Prazo: {acao.prazo_implementacao}
                        </span>
                      </div>
                      <p className="text-gray-800">{acao.acao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}