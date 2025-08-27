import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, Area, AreaChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Users,
  Download, Filter, RefreshCw, AlertTriangle, CheckCircle,
  Target, Zap, Bell, Eye
} from 'lucide-react';
import { DashboardService } from '../services/dashboardService';
import { toast } from 'react-hot-toast';
import { DashboardData, FiltrosDashboard, IndicadoresMensais, UnidadeRisco, AlertaAutomatico } from '../types/dashboard';
import { formatMonetaryResponsive } from '../utils/monetaryUtils';

const CORES = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#6366F1',
  gray: '#6B7280'
};

export function Dashboard() {
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresMensais | null>(null);
  const [unidadesRisco, setUnidadesRisco] = useState<UnidadeRisco[]>([]);
  const [alertas, setAlertas] = useState<AlertaAutomatico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosDashboard>({});
  const [exportando, setExportando] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState<'geral' | 'unidades' | 'evolucao' | 'alertas'>('geral');

  const dashboardService = useMemo(() => new DashboardService(), []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [dadosDashboard, indicadoresMensais, unidadesRiscoData, alertasData] = await Promise.all([
        dashboardService.buscarDadosDashboard(filtros),
        dashboardService.buscarIndicadoresMensais(),
        dashboardService.buscarUnidadesRisco(10),
        dashboardService.buscarAlertasAutomaticos()
      ]);
      
  setDados(dadosDashboard as DashboardData);
      setIndicadores(indicadoresMensais);
      setUnidadesRisco(unidadesRiscoData);
      setAlertas(alertasData);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setCarregando(false);
    }
  }, [dashboardService, filtros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  

  const aplicarFiltros = () => {
    carregarDados();
  };

  const exportarDados = async () => {
    if (!dados) return;
    
    setExportando(true);
    try {
      const blob = await dashboardService.exportarParaExcel(dados);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-inadimplencia-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar:', error);
    } finally {
      setExportando(false);
    }
  };

  const gerarAlertasAutomaticos = async () => {
    try {
  const novosAlertas = await dashboardService.gerarAlertasAutomaticos();
  toast.success(`${novosAlertas} novos alertas gerados!`);
      carregarDados();
    } catch (error) {
      console.error('Erro ao gerar alertas:', error);
      toast.error('Erro ao gerar alertas');
    }
  };

  const resolverAlerta = async (alertaId: string) => {
    const observacoes = prompt('Observações sobre a resolução (opcional):');
    try {
      await dashboardService.resolverAlerta(alertaId, observacoes || undefined);
      carregarDados();
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
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

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const renderMonetaryValue = (value: number, colorClass: string = '') => {
    const { formatted, className, shouldTruncate } = formatMonetaryResponsive(value, {
      compact: value >= 1000000
    });

    return (
      <div 
        className={`${className} ${colorClass} ${shouldTruncate ? 'monetary-truncate' : ''}`}
        title={shouldTruncate ? formatarMoeda(value) : undefined}
      >
        {formatted}
      </div>
    );
  };

  const getVariacaoColor = (valor: number) => {
    if (valor > 0) return 'text-green-600';
    if (valor < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVariacaoIcon = (valor: number) => {
    if (valor > 0) return <TrendingUp className="w-4 h-4" />;
    if (valor < 0) return <TrendingDown className="w-4 h-4" />;
    return <Target className="w-4 h-4" />;
  };

  const getRiscoColor = (nivel: string) => {
    switch (nivel) {
      case 'critico': return 'bg-red-100 text-red-800';
      case 'alto': return 'bg-orange-100 text-orange-800';
      case 'medio': return 'bg-yellow-100 text-yellow-800';
      case 'baixo': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgenciaColor = (urgencia: string) => {
    switch (urgencia) {
      case 'critica': return 'bg-red-100 text-red-800 border-red-200';
      case 'alta': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'media': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'baixa': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dados || !indicadores) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Erro ao carregar dados do dashboard</p>
        </div>
      </div>
    );
  }

  const dadosPizza = [
    { name: 'Em Aberto', value: dados.visaoGeral.percentuais.emAberto, color: CORES.danger },
    { name: 'Quitados', value: dados.visaoGeral.percentuais.quitados, color: CORES.success },
    { name: 'Negociando', value: dados.visaoGeral.percentuais.negociando, color: CORES.warning }
  ];

  const dadosFaixasAtraso = [
    { name: '1-30 dias', valor: dados.visaoGeral.faixasAtraso.ate30 },
    { name: '31-90 dias', valor: dados.visaoGeral.faixasAtraso.de31a90 },
    { name: '91-180 dias', valor: dados.visaoGeral.faixasAtraso.de91a180 },
    { name: '180+ dias', valor: dados.visaoGeral.faixasAtraso.mais180 }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Painel Geral da Inadimplência</h1>
          <p className="text-gray-600">Indicadores estratégicos e visão executiva da rede</p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <button
            onClick={gerarAlertasAutomaticos}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Gerar Alertas
          </button>
          <button
            onClick={carregarDados}
            disabled={carregando}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={exportarDados}
            disabled={exportando}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {exportando ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {([
            { id: 'geral', label: 'Visão Geral', icon: Target },
            { id: 'unidades', label: 'Unidades de Risco', icon: Users },
            { id: 'evolucao', label: 'Evolução Temporal', icon: TrendingUp },
            { id: 'alertas', label: 'Alertas Automáticos', icon: Bell }
          ] as { id: 'geral' | 'unidades' | 'evolucao' | 'alertas'; label: string; icon: React.ComponentType<{ className?: string }> }[]).map((aba) => {
            const Icon = aba.icon;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaSelecionada(aba.id)}
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

      {/* Indicadores Mensais Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-red-500 rounded-full flex-shrink-0">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-red-700">Total em Aberto (Mês)</p>
              {renderMonetaryValue(indicadores.total_em_aberto_mes, 'text-red-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(indicadores.comparativo_mes_anterior.variacao_em_aberto)}`}>
                  {getVariacaoIcon(indicadores.comparativo_mes_anterior.variacao_em_aberto)}
                  <span className="ml-1">{Math.abs(indicadores.comparativo_mes_anterior.variacao_em_aberto).toFixed(1)}%</span>
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
              <p className="text-sm font-medium text-green-700">Total Recuperado (Mês)</p>
              {renderMonetaryValue(indicadores.total_pago_mes, 'text-green-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(indicadores.comparativo_mes_anterior.variacao_pago)}`}>
                  {getVariacaoIcon(indicadores.comparativo_mes_anterior.variacao_pago)}
                  <span className="ml-1">{Math.abs(indicadores.comparativo_mes_anterior.variacao_pago).toFixed(1)}%</span>
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
                {formatarPercentual(indicadores.percentual_inadimplencia)}
              </p>
              <div className="mt-2 flex items-center text-sm">
                <span className={`flex items-center font-semibold ${getVariacaoColor(-indicadores.comparativo_mes_anterior.variacao_inadimplencia)}`}>
                  {getVariacaoIcon(-indicadores.comparativo_mes_anterior.variacao_inadimplencia)}
                  <span className="ml-1">{Math.abs(indicadores.comparativo_mes_anterior.variacao_inadimplencia).toFixed(1)}pp</span>
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-blue-500 rounded-full flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-blue-700">Unidades Inadimplentes</p>
              <p className="monetary-value text-blue-600">
                {indicadores.unidades_inadimplentes}
              </p>
              <div className="flex items-center text-sm">
                <span className="text-blue-600 font-semibold">
                  Ticket médio: {formatarMoeda(indicadores.ticket_medio_dividas)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {abaSelecionada === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribuição por Status */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição por Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatarPercentual(Number(value ?? 0))}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatarPercentual(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Faixas de Atraso */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Valores por Faixa de Atraso</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosFaixasAtraso}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatarMoeda(value)} />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Bar dataKey="valor" fill={CORES.primary} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {abaSelecionada === 'unidades' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Unidades em Maior Risco</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor em Aberto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nível de Risco
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ação Recomendada
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unidadesRisco.map((unidade, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{unidade.nome_unidade}</div>
                        <div className="text-sm text-gray-500">{unidade.cnpj}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        {formatarMoeda(unidade.valor_em_aberto)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {unidade.dias_sem_pagamento} dias sem pagamento
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarData(unidade.ultimo_contato)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiscoColor(unidade.nivel_risco)}`}>
                        {unidade.nivel_risco.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {unidade.acao_recomendada}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaSelecionada === 'evolucao' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Evolução dos Últimos 12 Meses</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={dados.evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatarMoeda(value)} />
              <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="valorRecebido" 
                stackId="1" 
                stroke={CORES.success} 
                fill={CORES.success}
                name="Valor Recebido"
              />
              <Area 
                type="monotone" 
                dataKey="valorRecuperado" 
                stackId="1" 
                stroke={CORES.info} 
                fill={CORES.info}
                name="Valor Recuperado"
              />
              <Line 
                type="monotone" 
                dataKey="valorInadimplente" 
                stroke={CORES.danger}
                name="Valor Inadimplente"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {abaSelecionada === 'alertas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Alertas Automáticos Ativos</h3>
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              {alertas.filter(a => !a.resolvido).length} alertas ativos
            </span>
          </div>
          
          {alertas.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum alerta ativo no momento</p>
            </div>
          ) : (
            alertas.map((alerta) => (
              <div key={alerta.id} className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${getUrgenciaColor(alerta.urgencia)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                      <h4 className="text-lg font-semibold text-gray-800">{alerta.titulo}</h4>
                      <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${getUrgenciaColor(alerta.urgencia)}`}>
                        {alerta.urgencia.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3">{alerta.descricao}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Unidade:</span> {alerta.nome_unidade}
                      </div>
                      <div>
                        <span className="font-medium">CNPJ:</span> {alerta.cnpj_unidade}
                      </div>
                      <div>
                        <span className="font-medium">Data:</span> {formatarData(alerta.data_criacao)}
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium text-blue-800">Ação Sugerida:</span>
                      <p className="text-blue-700">{alerta.acao_sugerida}</p>
                    </div>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <button
                      onClick={() => resolverAlerta(alerta.id)}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Resolver
                    </button>
                    <button className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      <Eye className="w-4 h-4 mr-1" />
                      Detalhes
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="date"
            placeholder="Data Início"
            value={filtros.dataInicio || ''}
            onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            placeholder="Data Fim"
            value={filtros.dataFim || ''}
            onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filtros.status || ''}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="em_aberto">Em Aberto</option>
            <option value="quitado">Quitado</option>
            <option value="negociando">Negociando</option>
          </select>
          <button
            onClick={aplicarFiltros}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
}