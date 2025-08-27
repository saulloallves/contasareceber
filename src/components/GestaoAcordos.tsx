import React, { useState, useEffect } from 'react';
import { 
  Calculator, FileText, CheckCircle, XCircle, Clock, DollarSign, 
  Calendar, Download, Filter, Plus, Eye, CreditCard, AlertTriangle,
  TrendingUp, Users, Target, Percent, Edit
} from 'lucide-react';
import { AcordosService } from '../services/acordosService';
import { toast } from 'react-hot-toast';
import { AcordoParcelamento, SimulacaoParcelamento, FiltrosAcordos, EstatisticasAcordos } from '../types/acordos';

export function GestaoAcordos() {
  const [acordos, setAcordos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosAcordos>({});
  const [modalAberto, setModalAberto] = useState<'simular' | 'visualizar' | 'aceitar' | null>(null);
  const [acordoSelecionado, setAcordoSelecionado] = useState<any>(null);
  const [simulacao, setSimulacao] = useState<SimulacaoParcelamento | null>(null);
  const [formSimulacao, setFormSimulacao] = useState({
    titulo_id: '',
    quantidade_parcelas: 3,
    valor_entrada: 0
  });
  const [modalRenegociacao, setModalRenegociacao] = useState(false);
  const [formRenegociacao, setFormRenegociacao] = useState({
    justificativa: '',
    nova_quantidade_parcelas: 3,
    novo_valor_entrada: 0,
    aprovado_por: ''
  });
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasAcordos | null>(null);

  const acordosService = new AcordosService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [acordosData, statsData] = await Promise.all([
        acordosService.buscarAcordos(filtros),
        acordosService.buscarEstatisticasAcordos()
      ]);
      setAcordos(acordosData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalSimular = () => {
    setFormSimulacao({
      titulo_id: '',
      quantidade_parcelas: 3,
      valor_entrada: 0
    });
    setSimulacao(null);
    setModalAberto('simular');
  };

  const abrirModalVisualizar = (acordo: any) => {
    setAcordoSelecionado(acordo);
    setModalAberto('visualizar');
  };

  const abrirModalAceitar = (acordo: any) => {
    setAcordoSelecionado(acordo);
    setModalAberto('aceitar');
  };

  const abrirModalRenegociar = (acordo: any) => {
    setAcordoSelecionado(acordo);
    setFormRenegociacao({
      justificativa: '',
      nova_quantidade_parcelas: acordo.quantidade_parcelas,
      novo_valor_entrada: acordo.valor_entrada,
      aprovado_por: ''
    });
    setModalRenegociacao(true);
  };

  const fecharModal = () => {
    setModalAberto(null);
    setModalRenegociacao(false);
    setAcordoSelecionado(null);
    setSimulacao(null);
    setFormSimulacao({
      titulo_id: '',
      quantidade_parcelas: 3,
      valor_entrada: 0
    });
    setFormRenegociacao({
      justificativa: '',
      nova_quantidade_parcelas: 3,
      novo_valor_entrada: 0,
      aprovado_por: ''
    });
  };

  const simularParcelamento = async () => {
    if (!formSimulacao.titulo_id) {
      toast.error('ID do título é obrigatório');
      return;
    }

    setProcessando(true);
    try {
      const simulacaoResult = await acordosService.simularParcelamento(
        formSimulacao.titulo_id,
        formSimulacao.quantidade_parcelas,
        formSimulacao.valor_entrada || undefined
      );
      setSimulacao(simulacaoResult);
    } catch (error) {
      toast.error(`Erro na simulação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const criarAcordo = async () => {
    if (!simulacao) return;

    setProcessando(true);
    try {
      await acordosService.criarAcordo(
        formSimulacao.titulo_id,
        simulacao,
        'Acordo criado via painel administrativo'
      );
      fecharModal();
  carregarDados();
  toast.success('Acordo criado com sucesso!');
    } catch (error) {
  toast.error(`Erro ao criar acordo: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const aceitarAcordo = async () => {
    if (!acordoSelecionado) return;

    setProcessando(true);
    try {
      await acordosService.registrarAceite(
        acordoSelecionado.id,
        'painel',
        'admin_ip',
        navigator.userAgent,
        'admin_usuario'
      );
      fecharModal();
  carregarDados();
  toast.success('Acordo aceito e boletos gerados!');
    } catch (error) {
  toast.error(`Erro ao aceitar acordo: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const renegociarAcordo = async () => {
    if (!acordoSelecionado || !formRenegociacao.justificativa || !formRenegociacao.aprovado_por) {
  toast.error('Justificativa e aprovação são obrigatórios');
      return;
    }

    setProcessando(true);
    try {
      await acordosService.renegociarAcordo(
        acordoSelecionado.id,
        formRenegociacao.nova_quantidade_parcelas,
        formRenegociacao.novo_valor_entrada,
        formRenegociacao.justificativa,
        formRenegociacao.aprovado_por
      );
      fecharModal();
  carregarDados();
  toast.success('Acordo renegociado com sucesso!');
    } catch (error) {
  toast.error(`Erro ao renegociar acordo: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await acordosService.exportarAcordos(filtros);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acordos-parcelamento-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'proposto':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'aceito':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cumprindo':
        return <TrendingUp className="w-5 h-5 text-yellow-600" />;
      case 'cumprido':
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      case 'quebrado':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'cancelado':
        return <XCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposto':
        return 'bg-blue-100 text-blue-800';
      case 'aceito':
        return 'bg-green-100 text-green-800';
      case 'cumprindo':
        return 'bg-yellow-100 text-yellow-800';
      case 'cumprido':
        return 'bg-green-100 text-green-800';
      case 'quebrado':
        return 'bg-red-100 text-red-800';
      case 'cancelado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Calculator className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gestão de Acordos de Parcelamento</h1>
              <p className="text-gray-600">Simulação, criação e acompanhamento de acordos</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            <button
              onClick={abrirModalSimular}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Simular Acordo
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.total_acordos}</div>
              <div className="text-sm text-blue-800">Total de Acordos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.acordos_ativos}</div>
              <div className="text-sm text-yellow-800">Acordos Ativos</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{estatisticas.taxa_cumprimento.toFixed(1)}%</div>
              <div className="text-sm text-green-800">Taxa de Cumprimento</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{formatarMoeda(estatisticas.valor_total_acordado)}</div>
              <div className="text-sm text-purple-800">Valor Total Acordado</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={filtros.status_acordo || ''}
              onChange={(e) => setFiltros({...filtros, status_acordo: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Todos os Status</option>
              <option value="proposto">Proposto</option>
              <option value="aceito">Aceito</option>
              <option value="cumprindo">Cumprindo</option>
              <option value="cumprido">Cumprido</option>
              <option value="quebrado">Quebrado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            
            <input
              type="text"
              value={filtros.cnpj || ''}
              onChange={(e) => setFiltros({...filtros, cnpj: e.target.value})}
              placeholder="CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            
            <input
              type="date"
              value={filtros.dataInicio || ''}
              onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            
            <input
              type="number"
              value={filtros.valor_min || ''}
              onChange={(e) => setFiltros({...filtros, valor_min: parseFloat(e.target.value) || undefined})}
              placeholder="Valor mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
            
            <input
              type="number"
              value={filtros.valor_max || ''}
              onChange={(e) => setFiltros({...filtros, valor_max: parseFloat(e.target.value) || undefined})}
              placeholder="Valor máximo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tabela de Acordos */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Original
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entrada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcelas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Acordo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-2"></div>
                      Carregando acordos...
                    </div>
                  </td>
                </tr>
              ) : acordos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Nenhum acordo encontrado
                  </td>
                </tr>
              ) : (
                acordos.map((acordo) => (
                  <tr key={acordo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatarData(acordo.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {acordo.cobrancas_franqueados?.cliente}
                        </div>
                        <div className="text-sm text-gray-500">
                          {acordo.cnpj_unidade}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatarMoeda(acordo.valor_original)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {formatarMoeda(acordo.valor_entrada)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {acordo.quantidade_parcelas}x {formatarMoeda(acordo.valor_parcela)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {formatarMoeda(acordo.valor_total_acordo)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(acordo.status_acordo)}
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(acordo.status_acordo)}`}>
                          {acordo.status_acordo.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => abrirModalVisualizar(acordo)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Visualizar acordo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {acordo.status_acordo === 'proposto' && (
                          <button
                            onClick={() => abrirModalAceitar(acordo)}
                            className="text-green-600 hover:text-green-900"
                            title="Aceitar acordo"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {(acordo.status_acordo === 'aceito' || acordo.status_acordo === 'cumprindo') && (
                          <button
                            onClick={() => abrirModalRenegociar(acordo)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Renegociar acordo"
                          >
                            <Edit className="w-4 h-4" />
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

      {/* Modal de Simulação */}
      {modalAberto === 'simular' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Simular Acordo de Parcelamento</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID do Título *
                  </label>
                  <input
                    type="text"
                    value={formSimulacao.titulo_id}
                    onChange={(e) => setFormSimulacao({...formSimulacao, titulo_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="UUID da cobrança"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade de Parcelas
                  </label>
                  <select
                    value={formSimulacao.quantidade_parcelas}
                    onChange={(e) => setFormSimulacao({...formSimulacao, quantidade_parcelas: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value={1}>1x (à vista)</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                    <option value={5}>5x</option>
                    <option value={6}>6x</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor da Entrada (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSimulacao.valor_entrada}
                    onChange={(e) => setFormSimulacao({...formSimulacao, valor_entrada: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Deixe vazio para entrada mínima"
                  />
                </div>
              </div>
              
              <button
                onClick={simularParcelamento}
                disabled={processando || !formSimulacao.titulo_id}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? 'Simulando...' : 'Simular Parcelamento'}
              </button>

              {/* Resultado da Simulação */}
              {simulacao && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-green-800 mb-4">Resultado da Simulação</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Valor Original:</span>
                      <p className="text-lg font-bold text-gray-800">{formatarMoeda(simulacao.valor_original)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Valor Atualizado:</span>
                      <p className="text-lg font-bold text-red-600">{formatarMoeda(simulacao.valor_atualizado)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Entrada:</span>
                      <p className="text-lg font-bold text-green-600">{formatarMoeda(simulacao.valor_entrada)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Parcelas:</span>
                      <p className="text-lg font-bold text-blue-600">
                        {simulacao.quantidade_parcelas}x {formatarMoeda(simulacao.valor_parcela)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Cronograma de Pagamentos:</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Entrada ({formatarData(simulacao.data_entrada)}):</span>
                        <span className="font-medium">{formatarMoeda(simulacao.valor_entrada)}</span>
                      </div>
                      {simulacao.parcelas.map((parcela, index) => (
                        <div key={index} className="flex justify-between">
                          <span>Parcela {parcela.numero} ({formatarData(parcela.vencimento)}):</span>
                          <span className="font-medium">{formatarMoeda(parcela.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-blue-800">Total do Acordo:</span>
                      <span className="text-xl font-bold text-blue-600">{formatarMoeda(simulacao.valor_total_acordo)}</span>
                    </div>
                    {simulacao.economia_desconto && simulacao.economia_desconto > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        Economia: {formatarMoeda(simulacao.economia_desconto)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={criarAcordo}
                    disabled={processando}
                    className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processando ? 'Criando Acordo...' : 'Criar Acordo'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {modalAberto === 'visualizar' && acordoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes do Acordo</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{formatarMoeda(acordoSelecionado.valor_total_acordo)}</div>
                  <div className="text-sm text-gray-600">Valor Total do Acordo</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{formatarMoeda(acordoSelecionado.valor_entrada)}</div>
                  <div className="text-sm text-gray-600">Entrada</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {acordoSelecionado.quantidade_parcelas}x {formatarMoeda(acordoSelecionado.valor_parcela)}
                  </div>
                  <div className="text-sm text-gray-600">Parcelas</div>
                </div>
              </div>

              {/* Parcelas */}
              {acordoSelecionado.parcelas_acordo && acordoSelecionado.parcelas_acordo.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-4">Cronograma de Parcelas</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parcela</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {acordoSelecionado.parcelas_acordo.map((parcela: any) => (
                          <tr key={parcela.numero_parcela}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {parcela.numero_parcela}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarMoeda(parcela.valor_parcela)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarData(parcela.data_vencimento)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(parcela.status_parcela)}`}>
                                {parcela.status_parcela.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aceite */}
      {modalAberto === 'aceitar' && acordoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Aceitar Acordo</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Resumo do Acordo:</h4>
                <div className="space-y-1 text-sm text-green-700">
                  <p>Entrada: {formatarMoeda(acordoSelecionado.valor_entrada)}</p>
                  <p>Parcelas: {acordoSelecionado.quantidade_parcelas}x {formatarMoeda(acordoSelecionado.valor_parcela)}</p>
                  <p>Total: {formatarMoeda(acordoSelecionado.valor_total_acordo)}</p>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <p className="text-yellow-800 text-sm">
                    Ao aceitar, os boletos serão gerados automaticamente e enviados para o franqueado.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={aceitarAcordo}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? 'Processando...' : 'Aceitar e Gerar Boletos'}
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

      {/* Modal de Renegociação */}
      {modalRenegociacao && acordoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Renegociar Acordo</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Dados do Acordo Atual */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Acordo Atual:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Entrada:</span>
                    <p className="font-medium">{formatarMoeda(acordoSelecionado.valor_entrada)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Parcelas:</span>
                    <p className="font-medium">{acordoSelecionado.quantidade_parcelas}x {formatarMoeda(acordoSelecionado.valor_parcela)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <p className="font-medium">{formatarMoeda(acordoSelecionado.valor_total_acordo)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <p className="font-medium">{acordoSelecionado.status_acordo.toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Justificativa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificativa da Renegociação *
                </label>
                <textarea
                  value={formRenegociacao.justificativa}
                  onChange={(e) => setFormRenegociacao({...formRenegociacao, justificativa: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Descreva o motivo da renegociação..."
                />
              </div>

              {/* Novos Parâmetros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Quantidade de Parcelas
                  </label>
                  <select
                    value={formRenegociacao.nova_quantidade_parcelas}
                    onChange={(e) => setFormRenegociacao({...formRenegociacao, nova_quantidade_parcelas: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value={1}>1x (à vista)</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                    <option value={5}>5x</option>
                    <option value={6}>6x</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Novo Valor da Entrada
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formRenegociacao.novo_valor_entrada}
                    onChange={(e) => setFormRenegociacao({...formRenegociacao, novo_valor_entrada: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Novo valor da entrada"
                  />
                </div>
              </div>

              {/* Aprovação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aprovado por (Diretoria) *
                </label>
                <input
                  type="text"
                  value={formRenegociacao.aprovado_por}
                  onChange={(e) => setFormRenegociacao({...formRenegociacao, aprovado_por: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Nome do diretor que aprovou"
                />
              </div>

              {/* Alerta */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <div>
                    <p className="text-yellow-800 font-medium">Atenção:</p>
                    <p className="text-yellow-700 text-sm">
                      A renegociação cancelará o acordo atual e criará um novo termo. 
                      O histórico será mantido para auditoria.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={renegociarAcordo}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {processando ? 'Renegociando...' : 'Confirmar Renegociação'}
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
    </div>
  );
}