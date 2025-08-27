import React, { useState, useEffect } from 'react';
import { 
  Scale, FileText, AlertTriangle, CheckCircle, XCircle, Clock, 
  Download, Filter, RefreshCw, Eye, Edit, Mail, Phone, MapPin,
  Users, DollarSign, TrendingUp, Target, Zap, Settings, Plus,
  Send, Upload, Trash2, Calendar, User, Building2
} from 'lucide-react';
import { EscalonamentoService } from '../services/escalonamentoService';
import { toast } from 'react-hot-toast';
import { MonitoramentoRisco, AcaoPendente, DashboardRiscos, FiltrosEscalonamento } from '../types/escalonamento';

export function GestaoEscalonamentos() {
  const [abaSelecionada, setAbaSelecionada] = useState<'monitoramento' | 'acoes-pendentes' | 'dashboard' | 'configuracao'>('monitoramento');
  const [unidadesRisco, setUnidadesRisco] = useState<MonitoramentoRisco[]>([]);
  const [acoesPendentes, setAcoesPendentes] = useState<AcaoPendente[]>([]);
  const [dashboardRiscos, setDashboardRiscos] = useState<DashboardRiscos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosEscalonamento>({});

  const escalonamentoService = new EscalonamentoService();

  useEffect(() => {
    carregarDados();
  }, [abaSelecionada, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      switch (abaSelecionada) {
        case 'monitoramento':
          const unidades = await escalonamentoService.monitorarSinaisRisco();
          setUnidadesRisco(unidades);
          break;
        case 'acoes-pendentes':
          const acoes = await escalonamentoService.buscarAcoesPendentes();
          setAcoesPendentes(acoes);
          break;
        case 'dashboard':
          const dashboard = await escalonamentoService.buscarDashboardRiscos();
          setDashboardRiscos(dashboard);
          break;
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const executarGatilhosAutomaticos = async () => {
    setProcessando(true);
    try {
  const gatilhosExecutados = await escalonamentoService.executarGatilhosAutomaticos();
  toast.success(`${gatilhosExecutados} gatilhos automáticos executados!`);
      carregarDados();
    } catch (error) {
  toast.error(`Erro ao executar gatilhos: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const concluirAcao = async (id: string) => {
    const observacoes = prompt('Observações sobre a conclusão (opcional):');
    try {
      await escalonamentoService.concluirAcao(id, observacoes || undefined);
      carregarDados();
    } catch (error) {
  toast.error(`Erro ao concluir ação: ${error}`);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await escalonamentoService.exportarMonitoramento();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitoramento-riscos-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const getRiscoColor = (grau: string) => {
    switch (grau) {
      case 'critico': return 'bg-red-100 text-red-800 border-red-200';
      case 'alto': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medio': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'baixo': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiscoIcon = (grau: string) => {
    switch (grau) {
      case 'critico': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'alto': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medio': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'baixo': return <CheckCircle className="w-5 h-5 text-green-600" />;
      default: return <Target className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'critica': return 'bg-red-100 text-red-800';
      case 'alta': return 'bg-orange-100 text-orange-800';
      case 'media': return 'bg-yellow-100 text-yellow-800';
      case 'baixa': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Alertas de Risco e Ações Imediatas</h1>
              <p className="text-gray-600">Monitoramento proativo e gatilhos automáticos</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={executarGatilhosAutomaticos}
              disabled={processando}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {processando ? 'Executando...' : 'Executar Gatilhos'}
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
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'monitoramento', label: 'Monitoramento de Riscos', icon: Target },
              { id: 'acoes-pendentes', label: 'Ações Pendentes', icon: Clock },
              { id: 'dashboard', label: 'Dashboard de Riscos', icon: TrendingUp },
              { id: 'configuracao', label: 'Configurações', icon: Settings }
            ].map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? 'border-red-500 text-red-600'
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

        {/* Conteúdo das abas */}
        {abaSelecionada === 'monitoramento' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Unidades com Sinais de Risco</h3>
            
            {carregando ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-red-600 mx-auto mb-4" />
                <p className="text-gray-600">Analisando sinais de risco...</p>
              </div>
            ) : unidadesRisco.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-gray-600">Nenhuma unidade com sinais de risco detectados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unidadesRisco.map((unidade) => (
                  <div key={unidade.cnpj_unidade} className={`border rounded-lg p-6 ${getRiscoColor(unidade.grau_risco)}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        {getRiscoIcon(unidade.grau_risco)}
                        <div className="ml-3">
                          <h4 className="text-lg font-semibold text-gray-800">
                            {unidade.nome_franqueado} ({unidade.codigo_unidade})
                          </h4>
                          <p className="text-sm text-gray-600">CNPJ: {unidade.cnpj_unidade}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">
                          {formatarMoeda(unidade.valor_em_risco)}
                        </div>
                        <div className="text-sm text-gray-600">Valor em Risco</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h5 className="font-medium text-gray-800 mb-2">Sinais Detectados:</h5>
                        <ul className="space-y-1">
                          {unidade.sinais_detectados.map((sinal, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                              {sinal}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-800 mb-2">Ações:</h5>
                        <div className="space-y-2 text-sm">
                          <p><strong>Última Ação:</strong> {unidade.ultima_acao}</p>
                          <p><strong>Próxima Ação:</strong> {unidade.proxima_acao_sugerida}</p>
                          <p><strong>Prazo:</strong> {unidade.prazo_acao}</p>
                          <p><strong>Responsável:</strong> {unidade.responsavel_designado}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        <Phone className="w-4 h-4 mr-1" />
                        Contatar
                      </button>
                      <button className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                        <Calendar className="w-4 h-4 mr-1" />
                        Agendar
                      </button>
                      <button className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                        <Scale className="w-4 h-4 mr-1" />
                        Escalar
                      </button>
                      <button className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">
                        <Eye className="w-4 h-4 mr-1" />
                        Detalhes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'acoes-pendentes' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Ações Pendentes</h3>
            
            {carregando ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Carregando ações pendentes...</p>
              </div>
            ) : acoesPendentes.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-gray-600">Nenhuma ação pendente no momento</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unidade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo de Ação
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prioridade
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Envolvido
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prazo Limite
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Responsável
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {acoesPendentes.map((acao) => (
                      <tr key={acao.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{acao.nome_franqueado}</div>
                            <div className="text-sm text-gray-500">{acao.cnpj_unidade}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{acao.tipo_acao.replace('_', ' ').toUpperCase()}</div>
                          <div className="text-sm text-gray-500">{acao.descricao}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPrioridadeColor(acao.prioridade)}`}>
                            {acao.prioridade.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          {formatarMoeda(acao.valor_envolvido)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatarData(acao.data_limite)}</div>
                          <div className={`text-xs ${new Date(acao.data_limite) < new Date() ? 'text-red-600' : 'text-gray-500'}`}>
                            {new Date(acao.data_limite) < new Date() ? 'VENCIDO' : 'No prazo'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {acao.responsavel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => concluirAcao(acao.id!)}
                            className="text-green-600 hover:text-green-900"
                            title="Marcar como concluída"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'dashboard' && dashboardRiscos && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Dashboard de Riscos</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{dashboardRiscos.unidades_em_risco_mes}</div>
                <div className="text-sm text-red-800">Unidades em Risco</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{dashboardRiscos.unidades_criticas}</div>
                <div className="text-sm text-orange-800">Unidades Críticas</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{dashboardRiscos.gatilhos_acionados_mes}</div>
                <div className="text-sm text-blue-800">Gatilhos Acionados</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{dashboardRiscos.taxa_resolucao.toFixed(1)}%</div>
                <div className="text-sm text-green-800">Taxa de Resolução</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Evolução do Risco Médio (6 meses)</h4>
                <div className="space-y-2">
                  {dashboardRiscos.evolucao_risco_medio.map((valor, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-16 text-sm text-gray-600">Mês {index + 1}</div>
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mx-3">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{ width: `${valor}%` }}
                        ></div>
                      </div>
                      <div className="w-12 text-sm text-gray-800">{valor}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Distribuição por Tipo de Risco</h4>
                <div className="space-y-3">
                  {Object.entries(dashboardRiscos.distribuicao_por_tipo).map(([tipo, quantidade]) => (
                    <div key={tipo} className="flex justify-between items-center">
                      <span className="text-gray-700">{tipo}</span>
                      <span className="font-medium">{quantidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Métricas de Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{dashboardRiscos.tempo_medio_resposta}</div>
                  <div className="text-sm text-gray-600">Tempo Médio de Resposta (dias)</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{dashboardRiscos.acoes_pendentes}</div>
                  <div className="text-sm text-gray-600">Ações Pendentes</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{dashboardRiscos.taxa_resolucao.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Taxa de Resolução</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {abaSelecionada === 'configuracao' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Configurações de Risco e Gatilhos</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Critérios de Risco Configurados</h4>
                  <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                    <li>• 2+ cobranças nos últimos 90 dias</li>
                    <li>• Valores &gt; R$ 2.000 em aberto há 30+ dias</li>
                    <li>• Acordos vencidos e não cumpridos</li>
                    <li>• Ausência de resposta por 7+ dias</li>
                    <li>• Histórico de reincidência (6 meses)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Gatilhos Automáticos</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Envio de alerta para responsável</li>
                  <li>• Disparo de mensagem ao franqueado</li>
                  <li>• Marcação de prioridade de contato</li>
                  <li>• Escalonamento automático para jurídico</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Responsáveis por Risco</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Crítico:</strong> juridico@crescieperdi.com</li>
                  <li>• <strong>Alto:</strong> cobranca@crescieperdi.com</li>
                  <li>• <strong>Médio/Baixo:</strong> financeiro@crescieperdi.com</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}