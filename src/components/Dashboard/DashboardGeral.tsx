/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Users, AlertTriangle,
  CheckCircle, RefreshCw, Filter, Download, Clock
} from 'lucide-react';
import { DashboardService } from '../../services/dashboardService';
// tipos específicos não utilizados diretamente aqui
import { formatMonetaryResponsive } from '../../utils/monetaryUtils';

export function DashboardGeral() {
  const [indicadores, setIndicadores] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    periodo: '30',
    status: '',
    tipo: ''
  });

  const dashboardService = useMemo(() => new DashboardService(), []);

  // Normaliza o objeto de indicadores para garantir campos e defaults
  const normalizarIndicadores = useCallback((data: any) => {
    // Retorna o primeiro valor numérico válido dentre os informados; caso contrário 0
    const pickNum = (...vals: any[]) => {
      for (const v of vals) {
        if (v !== undefined && v !== null) {
          const n = Number(v);
          if (!Number.isNaN(n)) return n;
        }
      }
      return 0;
    };
    // Retorna o primeiro array válido dentre os informados; caso contrário []
    const pickArr = (...vals: any[]) => {
      for (const v of vals) {
        if (Array.isArray(v)) return v;
      }
      return [];
    };
    return {
      // Totais (aceita camelCase, snake_case e campos com sufixo _mes)
      totalEmAberto: pickNum(
        data?.totalEmAberto,
        data?.total_em_aberto,
        data?.total_em_aberto_mes
      ),
      totalQuitado: pickNum(
        data?.totalQuitado,
        data?.total_quitado,
        data?.total_pago_mes
      ),
      totalNegociando: pickNum(
        data?.totalNegociando,
        data?.total_negociando,
        data?.total_negociando_mes
      ),

      // Variações (aceita camelCase, snake_case e mapeia do comparativo_mes_anterior)
      variacaoEmAberto: pickNum(
        data?.variacaoEmAberto,
        data?.variacao_em_aberto,
        data?.comparativo_mes_anterior?.variacao_em_aberto
      ),
      variacaoQuitado: pickNum(
        data?.variacaoQuitado,
        data?.variacao_quitado,
        data?.comparativo_mes_anterior?.variacao_pago
      ),
      variacaoNegociando: pickNum(
        data?.variacaoNegociando,
        data?.variacao_negociando,
        data?.comparativo_mes_anterior?.variacao_inadimplencia
      ),
      variacaoUnidades: pickNum(
        data?.variacaoUnidades,
        data?.variacao_unidades
      ),

      // Métricas auxiliares
      unidadesInadimplentes: pickNum(
        data?.unidadesInadimplentes,
        data?.unidades_inadimplentes
      ),
      ticketMedio: pickNum(
        data?.ticketMedio,
        data?.ticket_medio,
        data?.ticket_medio_dividas
      ),
      alertasAtivos: pickArr(
        data?.alertasAtivos,
        data?.alertas_ativos
      ),
      proximasReunioesCount: pickNum(
        data?.proximasReunioesCount,
        data?.proximas_reunioes_count
      ),
      acoesRecentesCount: pickNum(
        data?.acoesRecentesCount,
        data?.acoes_recentes_count
      ),
    };
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const indicadoresData = await dashboardService.buscarIndicadoresMensais();
      // Garante que os campos usados no UI existam
      setIndicadores(normalizarIndicadores(indicadoresData));
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setCarregando(false);
    }
  }, [dashboardService, normalizarIndicadores]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados, filtros]);

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
    if (valor > 0) return <TrendingUp className="w-4 h-4" />;
    if (valor < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  const getVariacaoColor = (valor: number) => {
    if (valor > 0) return 'text-green-600';
    if (valor < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const renderMonetaryValue = (value: number, colorClass: string = '') => {
    const { formatted, className, shouldTruncate } = formatMonetaryResponsive(value, {
      compact: value >= 1000000 // Use compact notation for values >= 1M
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

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!indicadores) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Erro ao carregar dados do dashboard</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Geral</h1>
          <p className="text-gray-600">Visão geral da inadimplência da rede</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={carregarDados}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </button>
          <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filtros.periodo}
            onChange={(e) => setFiltros({...filtros, periodo: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="em_aberto">Em Aberto</option>
            <option value="negociando">Negociando</option>
            <option value="quitado">Quitado</option>
          </select>
          <select
            value={filtros.tipo}
            onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Tipos</option>
            <option value="royalties">Royalties</option>
            <option value="insumos">Insumos</option>
            <option value="multas">Multas</option>
          </select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-red-500 rounded-full flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-red-700">Total Inadimplentes</p>
              {renderMonetaryValue(indicadores.totalEmAberto, 'text-red-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`font-semibold ${getVariacaoColor(indicadores.variacaoEmAberto)}`}>
                  {getVariacaoIcon(indicadores.variacaoEmAberto)}
                  {formatarPercentual(Math.abs(indicadores.variacaoEmAberto))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-green-500 rounded-full flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-green-700">Valor Recuperado</p>
              {renderMonetaryValue(indicadores.totalQuitado, 'text-green-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`font-semibold ${getVariacaoColor(indicadores.variacaoQuitado)}`}>
                  {getVariacaoIcon(indicadores.variacaoQuitado)}
                  {formatarPercentual(Math.abs(indicadores.variacaoQuitado))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-yellow-500 rounded-full flex-shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-yellow-700">Em Negociação</p>
              {renderMonetaryValue(indicadores.totalNegociando, 'text-yellow-600')}
              <div className="mt-2 flex items-center text-sm">
                <span className={`font-semibold ${getVariacaoColor(indicadores.variacaoNegociando)}`}>
                  {getVariacaoIcon(indicadores.variacaoNegociando)}
                  {formatarPercentual(Math.abs(indicadores.variacaoNegociando))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-blue-500 rounded-full flex-shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-blue-700">Unidades Inadimplentes</p>
              <p className="monetary-value text-blue-600">{indicadores.unidadesInadimplentes ?? 0}</p>
              <p className="text-xs text-blue-500 mt-1">
                Ticket médio: 
                <span className="font-semibold ml-1">
                  {formatMonetaryResponsive(indicadores.ticketMedio ?? 0, { compact: true }).formatted}
                </span>
              </p>
              <div className="mt-2 flex items-center text-sm">
                <span className={`font-semibold ${getVariacaoColor(indicadores.variacaoUnidades)}`}>
                  {getVariacaoIcon(indicadores.variacaoUnidades)}
                  {formatarPercentual(Math.abs(indicadores.variacaoUnidades))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas Automáticos */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <div className="p-2 bg-orange-100 rounded-lg mr-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          Alertas Automáticos
        </h3>
        <div className="space-y-4">
          {(indicadores.alertasAtivos?.length ?? 0) > 0 ? (
            (indicadores.alertasAtivos || []).map((alerta: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-5 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl shadow-sm">
                <div className="flex items-center">
                  <div className="p-2 bg-red-500 rounded-full mr-4">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-800">{alerta.titulo}</p>
                    <p className="text-sm text-red-600">Valor total: {formatarMoeda(Number(alerta.valor ?? 0))}</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors shadow-md">
                  {alerta.acao ?? 'Ver'}
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>Nenhum alerta ativo no momento</p>
            </div>
          )}
          
          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-500 rounded-full mr-4">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-yellow-800">{indicadores.proximasReunioesCount} reuniões agendadas para esta semana</p>
                <p className="text-sm text-yellow-600">Próximos 7 dias</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors shadow-md">
              Gerenciar
            </button>
          </div>
          
          <div className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500 rounded-full mr-4">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-800">Relatório mensal pronto para envio</p>
                <p className="text-sm text-blue-600">{indicadores.acoesRecentesCount} ações nas últimas 24h</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors shadow-md">
              Ver Relatório
            </button>
          </div>
        </div>
      </div>

      {/* Próximas Reuniões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            Próximas Reuniões
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                <div>
                  <p className="font-semibold text-gray-800">Franquia Centro - SP</p>
                  <p className="text-sm text-gray-600">Hoje, 14:00 - Negociação</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  Agendada
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            Ações Recentes
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                <div>
                  <p className="font-semibold text-gray-800">Cobrança enviada</p>
                  <p className="text-sm text-gray-600">Franquia Norte - RJ • Há 2 horas</p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}