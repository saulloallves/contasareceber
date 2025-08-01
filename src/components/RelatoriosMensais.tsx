import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  FileText, Download, Filter, Calendar, TrendingUp, TrendingDown, 
  DollarSign, Users, AlertTriangle, CheckCircle, Clock, Scale,
  Target, Zap, Eye, RefreshCw, Building2, Mail, Phone, MapPin,
  BarChart3, PieChart as PieChartIcon, Activity, Award
} from 'lucide-react';
import { RelatoriosService } from '../services/relatoriosService';
import { RelatorioMensal, FiltroRelatorio, IndicadorEstrategico, RelatorioDetalhado } from '../types/relatorios';

const CORES = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#6366F1',
  gray: '#6B7280'
};

export function RelatoriosMensais() {
  const [abaSelecionada, setAbaSelecionada] = useState<'visao-geral' | 'detalhado' | 'indicadores' | 'exportacao'>('visao-geral');
  const [relatorios, setRelatorios] = useState<RelatorioMensal[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadorEstrategico[]>([]);
  const [relatorioDetalhado, setRelatorioDetalhado] = useState<RelatorioDetalhado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [exportando, setExportando] = useState(false);
  
  const [filtros, setFiltros] = useState<FiltroRelatorio>({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    incluir_quitados: true
  });

  const [filtrosDetalhado, setFiltrosDetalhado] = useState<FiltroRelatorio>({
    dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    incluir_quitados: true
  });

  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<any[]>([]);
  const [estatisticasRapidas, setEstatisticasRapidas] = useState<any>(null);

  useEffect(() => {
    carregarDados();
    carregarUnidades();
    carregarEstatisticasRapidas();
  }, []);

  useEffect(() => {
    if (abaSelecionada === 'detalhado') {
      carregarRelatorioDetalhado();
    }
  }, [filtrosDetalhado, abaSelecionada]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [relatoriosData, indicadoresData] = await Promise.all([
        RelatoriosService.listarRelatorios(filtros),
        RelatoriosService.obterIndicadoresEstrategicos()
      ]);
      
      setRelatorios(relatoriosData);
      setIndicadores(indicadoresData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarUnidades = async () => {
    try {
      const { data } = await supabase
        .from('unidades_franqueadas')
        .select('codigo_unidade, nome_franqueado, cidade, estado')
        .eq('status_unidade', 'ativa')
        .order('nome_franqueado');

      setUnidadesDisponiveis(data || []);
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const carregarEstatisticasRapidas = async () => {
    try {
      const stats = await RelatoriosService.obterEstatisticasRapidas();
      setEstatisticasRapidas(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas rápidas:', error);
    }
  };

  const carregarRelatorioDetalhado = async () => {
    try {
      const relatorio = await RelatoriosService.gerarRelatorioDetalhado(filtrosDetalhado);
      setRelatorioDetalhado(relatorio);
    } catch (error) {
      console.error('Erro ao carregar relatório detalhado:', error);
    }
  };

  const gerarRelatorioMensal = async () => {
    if (!filtros.mes || !filtros.ano) {
      alert('Mês e ano são obrigatórios');
      return;
    }

    setGerandoRelatorio(true);
    try {
      const relatorio = await RelatoriosService.gerarRelatorioMensal(filtros.mes, filtros.ano);
      alert('Relatório mensal gerado com sucesso!');
      carregarDados();
    } catch (error) {
      alert(`Erro ao gerar relatório: ${error}`);
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const exportarRelatorio = async (relatorioId: string, formato: 'pdf' | 'xlsx' | 'csv') => {
    setExportando(true);
    try {
      const url = await RelatoriosService.exportarRelatorio(relatorioId, formato, {
        formato,
        incluir_graficos: true,
        incluir_detalhes: true,
        incluir_historico: false,
        periodo_historico_meses: 6
      });

      // Simula download
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-${relatorioId}.${formato}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      alert(`Erro ao exportar: ${error}`);
    } finally {
      setExportando(false);
    }
  };

  const enviarRelatorio = async (relatorioId: string) => {
    const emails = prompt('Digite os emails separados por vírgula:');
    if (!emails) return;

    try {
      await RelatoriosService.enviarRelatorio(relatorioId, emails.split(',').map(e => e.trim()));
      alert('Relatório enviado com sucesso!');
    } catch (error) {
      alert(`Erro ao enviar relatório: ${error}`);
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

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Relatórios e Análises</h1>
              <p className="text-gray-600">Visão completa do sistema de cobrança e indicadores estratégicos</p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              onClick={gerarRelatorioMensal}
              disabled={gerandoRelatorio}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              {gerandoRelatorio ? 'Gerando...' : 'Gerar Relatório'}
            </button>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        {estatisticasRapidas && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-blue-700">Total de Cobranças</p>
                  <p className="text-3xl font-bold text-blue-600">{estatisticasRapidas.total_cobrancas}</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-full">
                  <FileText className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-sm text-blue-600">
                {estatisticasRapidas.cobrancas_em_aberto} em aberto
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-red-700">Valor Total</p>
                  <p className="text-3xl font-bold text-red-600">
                    {formatarMoeda(estatisticasRapidas.valor_total)}
                  </p>
                </div>
                <div className="p-3 bg-red-500 rounded-full">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-sm text-red-600">
                {formatarPercentual(estatisticasRapidas.percentual_inadimplencia)} inadimplência
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-green-700">Valor Recuperado</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatarMoeda(estatisticasRapidas.valor_recuperado)}
                  </p>
                </div>
                <div className="p-3 bg-green-500 rounded-full">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-sm text-green-600">
                {formatarPercentual(estatisticasRapidas.taxa_recuperacao)} taxa de recuperação
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-purple-700">Cobranças Vencidas</p>
                  <p className="text-3xl font-bold text-purple-600">{estatisticasRapidas.cobrancas_vencidas}</p>
                </div>
                <div className="p-3 bg-purple-500 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-sm text-purple-600">
                Requer atenção imediata
              </div>
            </div>
          </div>
        )}

        {/* Navegação por Abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'visao-geral', label: 'Visão Geral', icon: BarChart3 },
              { id: 'detalhado', label: 'Relatório Detalhado', icon: FileText },
              { id: 'indicadores', label: 'Indicadores Estratégicos', icon: Target },
              { id: 'exportacao', label: 'Exportação', icon: Download }
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
          <div className="space-y-8">
            {/* Filtros */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                  <select
                    value={filtros.mes || ''}
                    onChange={(e) => setFiltros({...filtros, mes: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2024, i, 1).toLocaleDateString('pt-BR', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <select
                    value={filtros.ano || ''}
                    onChange={(e) => setFiltros({...filtros, ano: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({length: 5}, (_, i) => {
                      const ano = new Date().getFullYear() - i;
                      return <option key={ano} value={ano}>{ano}</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                  <select
                    value={filtros.unidade || ''}
                    onChange={(e) => setFiltros({...filtros, unidade: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as Unidades</option>
                    {unidadesDisponiveis.map(unidade => (
                      <option key={unidade.codigo_unidade} value={unidade.codigo_unidade}>
                        {unidade.codigo_unidade} - {unidade.nome_franqueado}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={filtros.estado || ''}
                    onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os Estados</option>
                    <option value="SP">São Paulo</option>
                    <option value="RJ">Rio de Janeiro</option>
                    <option value="MG">Minas Gerais</option>
                    <option value="RS">Rio Grande do Sul</option>
                    <option value="PR">Paraná</option>
                    <option value="SC">Santa Catarina</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Cobrança</label>
                  <select
                    value={filtros.tipo_cobranca || ''}
                    onChange={(e) => setFiltros({...filtros, tipo_cobranca: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os Tipos</option>
                    <option value="royalties">Royalties</option>
                    <option value="insumos">Insumos</option>
                    <option value="aluguel">Aluguel</option>
                    <option value="multa">Multa</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={carregarDados}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            </div>

            {/* Relatórios Mensais */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800">Relatórios Mensais Gerados</h3>
              
              {relatorios.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum relatório encontrado</p>
                  <p className="text-sm text-gray-500 mt-2">Gere um novo relatório usando os filtros acima</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {relatorios.map((relatorio) => (
                    <div key={relatorio.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800">
                            Relatório {relatorio.referencia_mes}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Gerado em {new Date(relatorio.gerado_em).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          relatorio.status_envio === 'enviado' ? 'bg-green-100 text-green-800' :
                          relatorio.status_envio === 'erro' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {relatorio.status_envio.toUpperCase()}
                        </span>
                      </div>

                      {/* Métricas do Relatório */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-lg font-bold text-red-600">
                            {formatarMoeda(relatorio.dados_consolidados.total_inadimplente)}
                          </div>
                          <div className="text-sm text-red-800">Total Inadimplente</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-lg font-bold text-green-600">
                            {formatarMoeda(relatorio.dados_consolidados.total_recuperado)}
                          </div>
                          <div className="text-sm text-green-800">Total Recuperado</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-lg font-bold text-blue-600">
                            {relatorio.dados_consolidados.unidades_inadimplentes}
                          </div>
                          <div className="text-sm text-blue-800">Unidades Inadimplentes</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="text-lg font-bold text-purple-600">
                            {formatarPercentual(relatorio.dados_consolidados.taxa_recuperacao)}
                          </div>
                          <div className="text-sm text-purple-800">Taxa Recuperação</div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => exportarRelatorio(relatorio.id, 'pdf')}
                          disabled={exportando}
                          className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </button>
                        <button
                          onClick={() => exportarRelatorio(relatorio.id, 'xlsx')}
                          disabled={exportando}
                          className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Excel
                        </button>
                        <button
                          onClick={() => enviarRelatorio(relatorio.id)}
                          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Enviar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {abaSelecionada === 'detalhado' && (
          <div className="space-y-8">
            {/* Filtros Detalhados */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Filtros Avançados</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                  <input
                    type="date"
                    value={filtrosDetalhado.dataInicio || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, dataInicio: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={filtrosDetalhado.dataFim || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, dataFim: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Específica</label>
                  <select
                    value={filtrosDetalhado.unidade || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, unidade: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as Unidades</option>
                    {unidadesDisponiveis.map(unidade => (
                      <option key={unidade.codigo_unidade} value={unidade.codigo_unidade}>
                        {unidade.codigo_unidade} - {unidade.nome_franqueado}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filtrosDetalhado.status || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os Status</option>
                    <option value="em_aberto">Em Aberto</option>
                    <option value="quitado">Quitado</option>
                    <option value="negociando">Negociando</option>
                    <option value="em_tratativa_juridica">Jurídico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={filtrosDetalhado.valor_min || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, valor_min: parseFloat(e.target.value) || undefined})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Máximo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={filtrosDetalhado.valor_max || ''}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, valor_max: parseFloat(e.target.value) || undefined})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="999999,99"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="incluir_quitados"
                    checked={filtrosDetalhado.incluir_quitados || false}
                    onChange={(e) => setFiltrosDetalhado({...filtrosDetalhado, incluir_quitados: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="incluir_quitados" className="ml-2 text-sm text-gray-700">
                    Incluir cobranças quitadas
                  </label>
                </div>
              </div>
            </div>

            {/* Relatório Detalhado */}
            {relatorioDetalhado && (
              <div className="space-y-6">
                {/* Resumo Executivo */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Resumo Executivo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatarMoeda(relatorioDetalhado.resumo_executivo.total_carteira)}
                      </div>
                      <div className="text-sm text-gray-600">Total da Carteira</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatarMoeda(relatorioDetalhado.resumo_executivo.inadimplencia_atual)}
                      </div>
                      <div className="text-sm text-gray-600">Inadimplência Atual</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatarMoeda(relatorioDetalhado.resumo_executivo.recuperacao_periodo)}
                      </div>
                      <div className="text-sm text-gray-600">Recuperado no Período</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {relatorioDetalhado.resumo_executivo.casos_criticos}
                      </div>
                      <div className="text-sm text-gray-600">Casos Críticos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatarPercentual(relatorioDetalhado.resumo_executivo.eficiencia_cobranca)}
                      </div>
                      <div className="text-sm text-gray-600">Eficiência</div>
                    </div>
                  </div>
                </div>

                {/* Top 10 Unidades */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Unidades por Valor em Aberto</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor em Aberto</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Recuperado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Inadimplência</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {relatorioDetalhado.unidades.slice(0, 10).map((unidade, index) => (
                          <tr key={unidade.codigo} className="hover:bg-gray-50">
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
                                <div className="text-sm font-medium text-gray-900">{unidade.nome}</div>
                                <div className="text-sm text-gray-500">{unidade.codigo}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                              {formatarMoeda(unidade.valor_em_aberto)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                              {formatarMoeda(unidade.valor_recuperado)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                                  <div 
                                    className="bg-red-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(unidade.percentual_inadimplencia, 100)}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">{formatarPercentual(unidade.percentual_inadimplencia)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                unidade.status === 'regular' ? 'bg-green-100 text-green-800' :
                                unidade.status === 'atencao' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {unidade.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dados Jurídicos e Parcelamentos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Scale className="w-5 h-5 text-red-600 mr-2" />
                      Casos Jurídicos
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Casos Escalonados:</span>
                        <span className="font-bold text-red-600">{relatorioDetalhado.juridico.casos_escalonados}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Valor Envolvido:</span>
                        <span className="font-bold text-red-600">{formatarMoeda(relatorioDetalhado.juridico.valor_envolvido)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Casos Resolvidos:</span>
                        <span className="font-bold text-green-600">{relatorioDetalhado.juridico.casos_resolvidos}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Tempo Médio Resolução:</span>
                        <span className="font-bold text-blue-600">{relatorioDetalhado.juridico.tempo_medio_resolucao.toFixed(0)} dias</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Target className="w-5 h-5 text-green-600 mr-2" />
                      Parcelamentos
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Propostas Enviadas:</span>
                        <span className="font-bold text-blue-600">{relatorioDetalhado.parcelamentos.propostas_enviadas}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Propostas Aceitas:</span>
                        <span className="font-bold text-green-600">{relatorioDetalhado.parcelamentos.propostas_aceitas}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Valor Parcelado:</span>
                        <span className="font-bold text-green-600">{formatarMoeda(relatorioDetalhado.parcelamentos.valor_parcelado)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Taxa de Sucesso:</span>
                        <span className="font-bold text-purple-600">{formatarPercentual(relatorioDetalhado.parcelamentos.taxa_sucesso)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas Críticos */}
                {relatorioDetalhado.alertas_criticos.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Alertas Críticos
                    </h4>
                    <div className="space-y-4">
                      {relatorioDetalhado.alertas_criticos.map((alerta, index) => (
                        <div key={index} className="bg-white rounded-lg p-4 border border-red-200">
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-semibold text-red-800">{alerta.tipo}</h5>
                              <p className="text-red-700 text-sm">{alerta.descricao}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-600">{alerta.unidades_afetadas}</div>
                              <div className="text-sm text-red-600">unidades</div>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-red-600">
                            Valor envolvido: {formatarMoeda(alerta.valor_envolvido)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'indicadores' && (
          <div className="space-y-8">
            <h3 className="text-xl font-bold text-gray-800">Indicadores Estratégicos</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {indicadores.map((indicador, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">{indicador.nome}</h4>
                    <div className="flex items-center">
                      {getVariacaoIcon(indicador.variacao_percentual)}
                      <span className={`ml-1 font-semibold ${getVariacaoColor(indicador.variacao_percentual)}`}>
                        {Math.abs(indicador.variacao_percentual).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Atual:</span>
                      <span className="font-bold text-gray-900">
                        {indicador.nome.includes('Taxa') || indicador.nome.includes('%') 
                          ? formatarPercentual(indicador.valor_atual)
                          : indicador.nome.includes('Valor') || indicador.nome.includes('Total')
                          ? formatarMoeda(indicador.valor_atual)
                          : indicador.valor_atual.toFixed(0)
                        }
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Anterior:</span>
                      <span className="text-gray-700">
                        {indicador.nome.includes('Taxa') || indicador.nome.includes('%') 
                          ? formatarPercentual(indicador.valor_anterior)
                          : indicador.nome.includes('Valor') || indicador.nome.includes('Total')
                          ? formatarMoeda(indicador.valor_anterior)
                          : indicador.valor_anterior.toFixed(0)
                        }
                      </span>
                    </div>

                    {indicador.meta && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Meta:</span>
                        <div className="flex items-center">
                          <span className="text-gray-700 mr-2">
                            {indicador.nome.includes('Taxa') || indicador.nome.includes('%') 
                              ? formatarPercentual(indicador.meta)
                              : indicador.nome.includes('Valor') || indicador.nome.includes('Total')
                              ? formatarMoeda(indicador.meta)
                              : indicador.meta.toFixed(0)
                            }
                          </span>
                          {indicador.status_meta === 'atingida' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-sm text-gray-600">{indicador.descricao}</p>
                    </div>

                    {/* Barra de progresso para meta */}
                    {indicador.meta && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            indicador.status_meta === 'atingida' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{ 
                            width: `${Math.min((indicador.valor_atual / indicador.meta) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Gráfico de Tendências */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Tendências dos Indicadores</h4>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Gráfico de tendências será implementado</p>
                  <p className="text-sm text-gray-500">Mostrará evolução dos indicadores ao longo do tempo</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {abaSelecionada === 'exportacao' && (
          <div className="space-y-8">
            <h3 className="text-xl font-bold text-gray-800">Exportação de Relatórios</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Exportação Rápida */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Exportação Rápida</h4>
                <div className="space-y-4">
                  <button
                    onClick={() => exportarRelatorio('current', 'pdf')}
                    disabled={exportando}
                    className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {exportando ? 'Exportando...' : 'Exportar PDF Atual'}
                  </button>
                  
                  <button
                    onClick={() => exportarRelatorio('current', 'xlsx')}
                    disabled={exportando}
                    className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {exportando ? 'Exportando...' : 'Exportar Excel Atual'}
                  </button>
                  
                  <button
                    onClick={() => exportarRelatorio('current', 'csv')}
                    disabled={exportando}
                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {exportando ? 'Exportando...' : 'Exportar CSV Atual'}
                  </button>
                </div>
              </div>

              {/* Configurações de Exportação */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Configurações de Exportação</h4>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="incluir_graficos"
                      defaultChecked
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="incluir_graficos" className="ml-2 text-sm text-gray-700">
                      Incluir gráficos e visualizações
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="incluir_detalhes"
                      defaultChecked
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="incluir_detalhes" className="ml-2 text-sm text-gray-700">
                      Incluir detalhes por unidade
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="incluir_historico"
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="incluir_historico" className="ml-2 text-sm text-gray-700">
                      Incluir histórico de 6 meses
                    </label>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Período do Histórico (meses)
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value={3}>3 meses</option>
                      <option value={6}>6 meses</option>
                      <option value={12}>12 meses</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Histórico de Exportações */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Relatórios Disponíveis para Download</h4>
              
              {relatorios.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum relatório disponível</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Geração</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gerado Por</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {relatorios.map((relatorio) => (
                        <tr key={relatorio.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {relatorio.referencia_mes}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(relatorio.gerado_em).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {relatorio.gerado_por}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              relatorio.status_envio === 'enviado' ? 'bg-green-100 text-green-800' :
                              relatorio.status_envio === 'erro' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {relatorio.status_envio.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => exportarRelatorio(relatorio.id, 'pdf')}
                                className="text-red-600 hover:text-red-900"
                                title="Baixar PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => exportarRelatorio(relatorio.id, 'xlsx')}
                                className="text-green-600 hover:text-green-900"
                                title="Baixar Excel"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => enviarRelatorio(relatorio.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Enviar por email"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}