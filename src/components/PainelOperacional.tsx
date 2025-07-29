/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { 
  DollarSign, Calculator, MessageSquare, Mail, 
  Filter, RefreshCw, Eye, X
  } from 'lucide-react';
import { CobrancaService } from '../services/cobrancaService';
import { SimulacaoParcelamentoService } from '../services/simulacaoParcelamentoService';
import { UnidadesService } from '../services/unidadesService';
import { formatarMoeda, formatarData, formatarCNPJCPF } from '../utils/formatters';

export function PainelOperacional() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [filtros, setFiltros] = useState({
    status: '',
    busca: '',
    dataInicio: '',
    dataFim: '',
    valorMin: '',
    valorMax: '',
    apenasInadimplentes: false
  });
  
  // Estados dos modais
  const [modalAberto, setModalAberto] = useState<'simular' | 'proposta' | 'detalhes' | 'mensagem' | null>(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any>(null);
  const [abaDetalhes, setAbaDetalhes] = useState<'cobranca' | 'unidade'>('cobranca');
  const [simulacaoAtual, setSimulacaoAtual] = useState<any>(null);
  
  // Form de simulação
  const [formSimulacao, setFormSimulacao] = useState({
    quantidade_parcelas: 3,
    data_primeira_parcela: '',
    valor_entrada: 0
  });

  // Form de proposta
  const [formProposta, setFormProposta] = useState({
    canais_envio: ['whatsapp'] as ('whatsapp' | 'email')[],
    observacoes: ''
  });

  // Form de mensagem
  const [formMensagem, setFormMensagem] = useState({
    template: 'padrao',
    mensagem_personalizada: '',
    canal: 'whatsapp' as 'whatsapp' | 'email'
  });

  const cobrancaService = new CobrancaService();
  const simulacaoService = new SimulacaoParcelamentoService();
  const unidadesService = new UnidadesService();

  // Templates de mensagem padrão
  const templatesPadrao = {
    padrao: 'Mensagem padrão'
  };

  useEffect(() => {
    carregarCobrancas();
  }, [filtros]);

  const carregarCobrancas = async () => {
    setCarregando(true);
    try {
      const dados = await cobrancaService.buscarCobrancas(filtros);
      setCobrancas(dados);
    } catch (error) {
      console.error('Erro ao carregar cobranças:', error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalSimulacao = (cobranca: any) => {
    setCobrancaSelecionada(cobranca);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: '',
      valor_entrada: 0
    });
    setSimulacaoAtual(null);
    setModalAberto('simular');
  };

  const simularParcelamento = async () => {
    if (!cobrancaSelecionada || !formSimulacao.data_primeira_parcela) {
      alert('Data da primeira parcela é obrigatória');
      return;
    }

    setProcessando(true);
    try {
      const simulacao = await simulacaoService.simularParcelamento(
        cobrancaSelecionada.id,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );
      
      setSimulacaoAtual(simulacao);
    } catch (error) {
      alert(`Erro na simulação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const gerarProposta = async () => {
    if (!simulacaoAtual) return;

    setProcessando(true);
    try {
      // Salva simulação primeiro
      const simulacaoId = await simulacaoService.salvarSimulacao(simulacaoAtual);
      
      // Gera proposta
      const proposta = await simulacaoService.gerarProposta(
        simulacaoId,
        formProposta.canais_envio,
        'usuario_atual'
      );

      // Envia pelos canais selecionados
      const resultados = [];
      
      if (formProposta.canais_envio.includes('whatsapp')) {
        const sucessoWhatsApp = await simulacaoService.enviarPropostaWhatsApp(proposta.id!);
        resultados.push(`WhatsApp: ${sucessoWhatsApp ? 'Enviado' : 'Falha'}`);
      }

      if (formProposta.canais_envio.includes('email')) {
        const sucessoEmail = await simulacaoService.enviarPropostaEmail(proposta.id!);
        resultados.push(`Email: ${sucessoEmail ? 'Enviado' : 'Falha'}`);
      }

      alert(`Proposta gerada e enviada!\n${resultados.join('\n')}`);
      
      fecharModal();
      carregarCobrancas(); // Recarrega para atualizar status
    } catch (error) {
      alert(`Erro ao gerar proposta: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setSimulacaoAtual(null);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: '',
      valor_entrada: 0
    });
    setFormProposta({
      canais_envio: ['whatsapp'],
      observacoes: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'quitado': return 'bg-green-100 text-green-800';
      case 'negociando': return 'bg-yellow-100 text-yellow-800';
      case 'em_aberto': return 'bg-red-100 text-red-800';
      case 'em_tratativa_juridica': return 'bg-purple-100 text-purple-800';
      case 'em_tratativa_critica': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const podeSimularParcelamento = (cobranca: any) => {
    return cobranca.status !== 'quitado' && (cobranca.valor_atualizado || cobranca.valor_original) > 0;
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Painel Operacional de Cobrança</h1>
              <p className="text-gray-600">Gestão diária com simulação de parcelamento integrada</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => carregarCobrancas()}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select
              value={filtros.status}
              onChange={(e) => setFiltros({...filtros, status: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="em_aberto">Em Aberto</option>
              <option value="negociando">Negociando</option>
              <option value="quitado">Quitado</option>
              <option value="em_tratativa_juridica">Tratativa Jurídica</option>
            </select>
            
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
              placeholder="Buscar cliente/CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="number"
              value={filtros.valorMin}
              onChange={(e) => setFiltros({...filtros, valorMin: e.target.value})}
              placeholder="Valor mínimo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="number"
              value={filtros.valorMax}
              onChange={(e) => setFiltros({...filtros, valorMax: e.target.value})}
              placeholder="Valor máximo"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="apenasInadimplentes"
                checked={filtros.apenasInadimplentes}
                onChange={(e) => setFiltros({...filtros, apenasInadimplentes: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="apenasInadimplentes" className="ml-2 text-sm text-gray-700">
                Apenas inadimplentes
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Cobranças */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
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
                      Carregando cobranças...
                    </div>
                  </td>
                </tr>
              ) : cobrancas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              ) : (
                cobrancas.map((cobranca) => (
                  <tr key={cobranca.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cobranca.cliente}</div>
                        <div className="text-sm text-gray-500">{formatarCNPJCPF(cobranca.cnpj)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-red-600">
                          {formatarMoeda(cobranca.valor_atualizado || cobranca.valor_original)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Original: {formatarMoeda(cobranca.valor_original)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{formatarData(cobranca.data_vencimento)}</div>
                        {cobranca.dias_em_atraso > 0 && (
                          <div className="text-sm text-red-600">
                            {cobranca.dias_em_atraso} dias em atraso
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(cobranca.status)}`}>
                        {cobranca.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {cobranca.unidades_franqueadas?.nome_franqueado || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cobranca.unidades_franqueadas?.codigo_unidade || cobranca.cnpj}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {podeSimularParcelamento(cobranca) && (
                          <button
                            onClick={() => abrirModalSimulacao(cobranca)}
                            className="text-green-600 hover:text-green-900"
                            title="Simular Parcelamento"
                          >
                            <Calculator className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver detalhes"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          className="text-purple-600 hover:text-purple-900"
                          title="Enviar mensagem"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
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
      {modalAberto === 'simular' && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Simulação de Parcelamento</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Dados da Cobrança */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-800 mb-2">Dados da Cobrança:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Cliente:</span> {cobrancaSelecionada.cliente}
                </div>
                <div>
                  <span className="font-medium">CNPJ:</span> {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                </div>
                <div>
                  <span className="font-medium">Valor Atualizado:</span> {formatarMoeda(cobrancaSelecionada.valor_atualizado || cobrancaSelecionada.valor_original)}
                </div>
                <div>
                  <span className="font-medium">Vencimento:</span> {formatarData(cobrancaSelecionada.data_vencimento)}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {cobrancaSelecionada.status}
                </div>
                <div>
                  <span className="font-medium">Dias em Atraso:</span> {cobrancaSelecionada.dias_em_atraso || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuração da Simulação */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800">Configurar Parcelamento:</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade de Parcelas
                  </label>
                  <select
                    value={formSimulacao.quantidade_parcelas}
                    onChange={(e) => setFormSimulacao({...formSimulacao, quantidade_parcelas: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                    <option value={5}>5x</option>
                    <option value={6}>6x</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Primeira Parcela *
                  </label>
                  <input
                    type="date"
                    value={formSimulacao.data_primeira_parcela}
                    onChange={(e) => setFormSimulacao({...formSimulacao, data_primeira_parcela: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor de Entrada (opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSimulacao.valor_entrada}
                    onChange={(e) => setFormSimulacao({...formSimulacao, valor_entrada: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0,00"
                  />
                </div>
                
                <button
                  onClick={simularParcelamento}
                  disabled={processando || !formSimulacao.data_primeira_parcela}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processando ? 'Simulando...' : 'Simular Parcelamento'}
                </button>
              </div>

              {/* Resultado da Simulação */}
              {simulacaoAtual && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-4">Resultado da Simulação:</h4>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between">
                      <span>Valor Original:</span>
                      <span className="font-medium">{formatarMoeda(simulacaoAtual.valor_original)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor Atualizado:</span>
                      <span className="font-medium text-red-600">{formatarMoeda(simulacaoAtual.valor_atualizado)}</span>
                    </div>
                    {simulacaoAtual.valor_entrada && (
                      <div className="flex justify-between">
                        <span>Entrada:</span>
                        <span className="font-medium text-green-600">{formatarMoeda(simulacaoAtual.valor_entrada)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Parcelas:</span>
                      <span className="font-medium">{simulacaoAtual.quantidade_parcelas}x {formatarMoeda(simulacaoAtual.parcelas[0].valor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Juros por parcela:</span>
                      <span className="font-medium">{simulacaoAtual.percentual_juros_parcela}%</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-blue-600">{formatarMoeda(simulacaoAtual.valor_total_parcelamento)}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 mb-4">
                    <h5 className="font-medium mb-2">Cronograma:</h5>
                    <div className="space-y-1 text-sm">
                      {simulacaoAtual.parcelas.map((parcela: any, index: number) => (
                        <div key={index} className="flex justify-between">
                          <span>Parcela {parcela.numero} ({formatarData(parcela.data_vencimento)}):</span>
                          <span className="font-medium">{formatarMoeda(parcela.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setModalAberto('proposta')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Gerar Proposta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Proposta */}
      {modalAberto === 'proposta' && simulacaoAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Gerar Proposta de Parcelamento</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Resumo da Simulação */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Resumo da Simulação:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Valor Atualizado: {formatarMoeda(simulacaoAtual.valor_atualizado)}</div>
                  <div>Parcelas: {simulacaoAtual.quantidade_parcelas}x {formatarMoeda(simulacaoAtual.parcelas[0].valor)}</div>
                  <div>Juros: {simulacaoAtual.percentual_juros_parcela}%</div>
                  <div>Total: {formatarMoeda(simulacaoAtual.valor_total_parcelamento)}</div>
                </div>
              </div>

              {/* Canais de Envio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canais de Envio
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="whatsapp"
                      checked={formProposta.canais_envio.includes('whatsapp')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: [...formProposta.canais_envio, 'whatsapp']
                          });
                        } else {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: formProposta.canais_envio.filter(c => c !== 'whatsapp')
                          });
                        }
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label htmlFor="whatsapp" className="ml-2 text-sm text-gray-700 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-1 text-green-600" />
                      WhatsApp
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email"
                      checked={formProposta.canais_envio.includes('email')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: [...formProposta.canais_envio, 'email']
                          });
                        } else {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: formProposta.canais_envio.filter(c => c !== 'email')
                          });
                        }
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label htmlFor="email" className="ml-2 text-sm text-gray-700 flex items-center">
                      <Mail className="w-4 h-4 mr-1 text-blue-600" />
                      Email
                    </label>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={formProposta.observacoes}
                  onChange={(e) => setFormProposta({...formProposta, observacoes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Observações adicionais para a proposta..."
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={gerarProposta}
                disabled={processando || formProposta.canais_envio.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? 'Gerando...' : 'Gerar e Enviar Proposta'}
              </button>
              <button
                onClick={() => setModalAberto('simular')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}