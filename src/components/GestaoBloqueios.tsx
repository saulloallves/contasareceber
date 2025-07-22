import React, { useState, useEffect } from 'react';
import { 
  Shield, Lock, Unlock, AlertTriangle, CheckCircle, XCircle, 
  Download, Filter, RefreshCw, Eye, Settings, Zap, Clock,
  Users, DollarSign, TrendingUp, Target, Mail, Phone
} from 'lucide-react';
import { BloqueioService } from '../services/bloqueioService';
import { BloqueioUnidade, FiltrosBloqueio, EstatisticasBloqueio } from '../types/bloqueio';

export function GestaoBloqueios() {
  const [bloqueios, setBloqueios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosBloqueio>({});
  const [modalAberto, setModalAberto] = useState<'detalhes' | 'verificar' | 'configurar' | null>(null);
  const [bloqueioSelecionado, setBloqueioSelecionado] = useState<any>(null);
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasBloqueio | null>(null);
  const [cnpjVerificacao, setCnpjVerificacao] = useState('');

  const bloqueioService = new BloqueioService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [bloqueiosData, statsData] = await Promise.all([
        bloqueioService.buscarBloqueios(filtros),
        bloqueioService.buscarEstatisticas()
      ]);
      setBloqueios(bloqueiosData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const verificarCriteriosIndividual = async () => {
    if (!cnpjVerificacao.trim()) {
      alert('Digite um CNPJ válido');
      return;
    }

    setProcessando(true);
    try {
      const criterio = await bloqueioService.verificarCriteriosBloqueio(cnpjVerificacao);
      
      if (criterio.deve_bloquear) {
        if (confirm(`Unidade atende critérios de bloqueio:\n\nMotivo: ${criterio.motivo}\nUrgência: ${criterio.urgencia}\n\nDeseja executar o bloqueio?`)) {
          await bloqueioService.executarBloqueio(cnpjVerificacao, criterio);
          alert('Bloqueio executado com sucesso!');
          carregarDados();
        }
      } else {
        alert('Unidade não atende critérios de bloqueio no momento.');
      }
    } catch (error) {
      alert(`Erro ao verificar critérios: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const executarVerificacaoLote = async () => {
    if (!confirm('Deseja executar a verificação em lote de todas as unidades? Esta operação pode demorar alguns minutos.')) {
      return;
    }

    setProcessando(true);
    try {
      const [bloqueios, desbloqueios] = await Promise.all([
        bloqueioService.verificarBloqueiosLote(),
        bloqueioService.verificarDesbloqueiosAutomaticos()
      ]);
      
      alert(`Verificação concluída:\n${bloqueios} novos bloqueios\n${desbloqueios} desbloqueios automáticos`);
      carregarDados();
    } catch (error) {
      alert(`Erro na verificação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const executarDesbloqueioManual = async (cnpjUnidade: string) => {
    const motivo = prompt('Motivo do desbloqueio manual:');
    if (!motivo) return;

    try {
      await bloqueioService.executarDesbloqueio(cnpjUnidade, motivo);
      alert('Desbloqueio executado com sucesso!');
      carregarDados();
    } catch (error) {
      alert(`Erro ao desbloquear: ${error}`);
    }
  };

  const abrirDetalhes = (bloqueio: any) => {
    setBloqueioSelecionado(bloqueio);
    setModalAberto('detalhes');
  };

  const fecharModal = () => {
    setModalAberto(null);
    setBloqueioSelecionado(null);
    setCnpjVerificacao('');
  };

  const exportarDados = async () => {
    try {
      const csv = await bloqueioService.exportarBloqueios(filtros);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bloqueios-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Erro ao exportar dados');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ativo':
        return <Lock className="w-5 h-5 text-red-600" />;
      case 'pendente':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'desbloqueado':
        return <Unlock className="w-5 h-5 text-green-600" />;
      case 'em_analise':
        return <Eye className="w-5 h-5 text-blue-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'desbloqueado':
        return 'bg-green-100 text-green-800';
      case 'em_analise':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMotivoColor = (motivo: string) => {
    switch (motivo) {
      case 'inadimplencia':
        return 'bg-red-100 text-red-800';
      case 'score_baixo':
        return 'bg-orange-100 text-orange-800';
      case 'quebra_acordo':
        return 'bg-purple-100 text-purple-800';
      case 'nao_comparecimento':
        return 'bg-yellow-100 text-yellow-800';
      case 'recusa_negociacao':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarAcessos = (acessos: string[]) => {
    const labels: Record<string, string> = {
      'solutto': 'Solutto',
      'giragrama': 'GiraGrama',
      'campanhas': 'Campanhas',
      'eventos': 'Eventos',
      'girabot': 'GiraBot',
      'painel_franqueado': 'Painel'
    };
    return acessos.map(a => labels[a] || a).join(', ');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-red-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Sistema de Bloqueio Automatizado</h1>
              <p className="text-gray-600">Controle de acessos e benefícios por inadimplência</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setModalAberto('verificar')}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Target className="w-4 h-4 mr-2" />
              Verificar Unidade
            </button>
            <button
              onClick={executarVerificacaoLote}
              disabled={processando}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 mr-2" />
              {processando ? 'Verificando...' : 'Verificação Lote'}
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
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{estatisticas.total_bloqueados}</div>
              <div className="text-sm text-red-800">Bloqueados Ativos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.total_pendentes}</div>
              <div className="text-sm text-yellow-800">Pendentes</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{estatisticas.total_desbloqueados_mes}</div>
              <div className="text-sm text-green-800">Desbloqueados (Mês)</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatarMoeda(estatisticas.valor_total_bloqueado)}</div>
              <div className="text-sm text-purple-800">Valor Bloqueado</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.efetividade_bloqueio.toFixed(1)}%</div>
              <div className="text-sm text-blue-800">Efetividade</div>
            </div>
          </div>
        )}

        {/* Critérios de Bloqueio */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
            Critérios de Bloqueio Automático
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-red-700 mb-2">🔴 Critérios Principais</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Valor em aberto &gt; R$ 5.000</li>
                <li>• Score de risco &lt; 50 pontos</li>
                <li>• Quebra de acordo anterior</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-orange-700 mb-2">🟡 Critérios Adicionais</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Não comparecimento a reunião</li>
                <li>• Recusa explícita de negociação</li>
                <li>• 5 dias úteis após vencimento</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-blue-700 mb-2">🔒 Acessos Bloqueados</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Sistema Solutto</li>
                <li>• Envio de mídias (GiraGrama)</li>
                <li>• Campanhas e eventos</li>
                <li>• GiraBot (respostas automáticas)</li>
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
              value={filtros.status_bloqueio || ''}
              onChange={(e) => setFiltros({...filtros, status_bloqueio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Bloqueado</option>
              <option value="pendente">Pendente</option>
              <option value="desbloqueado">Desbloqueado</option>
              <option value="em_analise">Em Análise</option>
            </select>
            
            <select
              value={filtros.motivo_bloqueio || ''}
              onChange={(e) => setFiltros({...filtros, motivo_bloqueio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todos os Motivos</option>
              <option value="inadimplencia">Inadimplência</option>
              <option value="score_baixo">Score Baixo</option>
              <option value="quebra_acordo">Quebra de Acordo</option>
              <option value="nao_comparecimento">Não Comparecimento</option>
              <option value="recusa_negociacao">Recusa Negociação</option>
            </select>
            
            <input
              type="text"
              value={filtros.cnpj || ''}
              onChange={(e) => setFiltros({...filtros, cnpj: e.target.value})}
              placeholder="CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
            
            <input
              type="date"
              value={filtros.dataInicio || ''}
              onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
            
            <input
              type="number"
              value={filtros.valor_min || ''}
              onChange={(e) => setFiltros({...filtros, valor_min: parseFloat(e.target.value) || undefined})}
              placeholder="Valor mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Tabela de Bloqueios */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor em Aberto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Bloqueio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acessos Bloqueados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-red-600 mr-2" />
                      Carregando bloqueios...
                    </div>
                  </td>
                </tr>
              ) : bloqueios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Nenhum bloqueio encontrado
                  </td>
                </tr>
              ) : (
                bloqueios.map((bloqueio) => (
                  <tr key={bloqueio.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bloqueio.unidades_franqueadas?.nome_franqueado || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">{bloqueio.cnpj_unidade}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(bloqueio.status_bloqueio)}
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bloqueio.status_bloqueio)}`}>
                          {bloqueio.status_bloqueio.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMotivoColor(bloqueio.motivo_bloqueio)}`}>
                        {bloqueio.motivo_bloqueio.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        {formatarMoeda(bloqueio.valor_em_aberto)}
                      </div>
                      {bloqueio.score_risco && (
                        <div className="text-xs text-gray-500">Score: {bloqueio.score_risco}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {bloqueio.data_bloqueio ? formatarData(bloqueio.data_bloqueio) : '-'}
                      </div>
                      {bloqueio.data_desbloqueio && (
                        <div className="text-xs text-green-600">
                          Desbloq: {formatarData(bloqueio.data_desbloqueio)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        {formatarAcessos(bloqueio.acessos_bloqueados)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => abrirDetalhes(bloqueio)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bloqueio.status_bloqueio === 'ativo' && (
                          <button
                            onClick={() => executarDesbloqueioManual(bloqueio.cnpj_unidade)}
                            className="text-green-600 hover:text-green-900"
                            title="Desbloquear manualmente"
                          >
                            <Unlock className="w-4 h-4" />
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

      {/* Modal de Verificação */}
      {modalAberto === 'verificar' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Verificar Critérios de Bloqueio</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ da Unidade
                </label>
                <input
                  type="text"
                  value={cnpjVerificacao}
                  onChange={(e) => setCnpjVerificacao(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  O sistema verificará automaticamente todos os critérios de bloqueio para esta unidade.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={verificarCriteriosIndividual}
                disabled={processando || !cnpjVerificacao.trim()}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {processando ? 'Verificando...' : 'Verificar Critérios'}
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
      {modalAberto === 'detalhes' && bloqueioSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Detalhes do Bloqueio - {bloqueioSelecionado.cnpj_unidade}
              </h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">{formatarMoeda(bloqueioSelecionado.valor_em_aberto)}</div>
                  <div className="text-sm text-red-800">Valor em Aberto</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">{bloqueioSelecionado.score_risco || 'N/A'}</div>
                  <div className="text-sm text-orange-800">Score de Risco</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{bloqueioSelecionado.notificacoes_enviadas}</div>
                  <div className="text-sm text-blue-800">Notificações Enviadas</div>
                </div>
              </div>

              {/* Dados da Unidade */}
              {bloqueioSelecionado.unidades_franqueadas && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Dados da Unidade</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Nome:</span>
                      <p className="text-gray-600">{bloqueioSelecionado.unidades_franqueadas.nome_franqueado}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Localização:</span>
                      <p className="text-gray-600">
                        {bloqueioSelecionado.unidades_franqueadas.cidade}/{bloqueioSelecionado.unidades_franqueadas.estado}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <p className="text-gray-600">{bloqueioSelecionado.unidades_franqueadas.email_franqueado || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Telefone:</span>
                      <p className="text-gray-600">{bloqueioSelecionado.unidades_franqueadas.telefone_franqueado || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Acessos Bloqueados */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Acessos Bloqueados</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {bloqueioSelecionado.acessos_bloqueados.map((acesso: string) => (
                    <div key={acesso} className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <Lock className="w-6 h-6 text-red-600 mx-auto mb-2" />
                      <div className="text-sm font-medium text-red-800">
                        {formatarAcessos([acesso])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Timeline do Bloqueio</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                    <div className="flex items-center">
                      <Lock className="w-5 h-5 text-red-600 mr-3" />
                      <div>
                        <div className="font-medium text-red-800">Bloqueio Executado</div>
                        <div className="text-sm text-red-600">{bloqueioSelecionado.motivo_bloqueio}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatarData(bloqueioSelecionado.data_bloqueio)}
                    </div>
                  </div>
                  
                  {bloqueioSelecionado.data_desbloqueio && (
                    <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                      <div className="flex items-center">
                        <Unlock className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <div className="font-medium text-green-800">Desbloqueio Executado</div>
                          <div className="text-sm text-green-600">{bloqueioSelecionado.observacoes}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatarData(bloqueioSelecionado.data_desbloqueio)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}