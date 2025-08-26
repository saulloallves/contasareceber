/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import {
  Calculator,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Eye,
  Send,
  Calendar,
  Target,
  BarChart3,
  ArrowRight,
  Zap,
  Settings,
} from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { UnidadesService } from "../services/unidadesService";
import { CobrancaService } from "../services/cobrancaService";
import { formatarCNPJCPF, formatarMoeda } from "../utils/formatters";
import { SimulacaoParcelamentoType, EstatisticasParcelamento } from "../types/simulacaoParcelamento";
import { GerarSimulacaoParcelamento } from "./GerarSimulacaoParcelamento";

export function SimulacaoParcelamento() {
  const [telaAtiva, setTelaAtiva] = useState<'hub' | 'nova-simulacao' | 'propostas' | 'configuracoes'>('hub');
  const [estatisticas, setEstatisticas] = useState<EstatisticasParcelamento | null>(null);
  const [carregando, setCarregando] = useState(true);

  const simulacaoService = new SimulacaoParcelamentoService();

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    setCarregando(true);
    try {
      const stats = await simulacaoService.buscarEstatisticas();
      setEstatisticas(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setCarregando(false);
    }
  };

  const formatarPercentual = (valor: number) => {
    return `${valor.toFixed(1)}%`;
  };

  // HUB Principal
  if (telaAtiva === 'hub') {
    return (
      <div className="max-w-full mx-auto p-6">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Central de Parcelamentos
              </h1>
              <p className="text-gray-600">
                Gerencie simulações, propostas e acordos de parcelamento
              </p>
            </div>
          </div>

          {/* Estatísticas Rápidas */}
          {estatisticas && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{estatisticas.total_simulacoes}</div>
                <div className="text-sm text-blue-800">Total de Simulações</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-2xl font-bold text-green-600">{estatisticas.propostas_aceitas}</div>
                <div className="text-sm text-green-800">Propostas Aceitas</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{formatarPercentual(estatisticas.taxa_conversao)}</div>
                <div className="text-sm text-yellow-800">Taxa de Conversão</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{formatarMoeda(estatisticas.valor_total_parcelado)}</div>
                <div className="text-sm text-purple-800">Valor Total Parcelado</div>
              </div>
            </div>
          )}
        </div>

        {/* Cards de Acesso Rápido */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Nova Simulação */}
          <div 
            onClick={() => setTelaAtiva('nova-simulacao')}
            className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mr-4 group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Nova Simulação</h3>
                <p className="text-gray-600">Criar nova proposta de parcelamento</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <Target className="w-4 h-4 mr-2 text-blue-500" />
                Selecionar cobranças por CNPJ/CPF
              </div>
              <div className="flex items-center">
                <Calculator className="w-4 h-4 mr-2 text-blue-500" />
                Simular parcelamento de 3 a 42x
              </div>
              <div className="flex items-center">
                <Send className="w-4 h-4 mr-2 text-blue-500" />
                Enviar proposta via WhatsApp/Email
              </div>
            </div>
            <div className="mt-6 flex items-center text-blue-600 font-medium group-hover:text-blue-700">
              Iniciar Nova Simulação
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>

          {/* Acompanhar Propostas */}
          <div 
            onClick={() => setTelaAtiva('propostas')}
            className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl hover:border-green-300 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg mr-4 group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Acompanhar Propostas</h3>
                <p className="text-gray-600">Gerenciar propostas enviadas</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <Eye className="w-4 h-4 mr-2 text-green-500" />
                Visualizar propostas enviadas
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                Registrar aceites de propostas
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-green-500" />
                Acompanhar status e prazos
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center text-green-600 font-medium group-hover:text-green-700">
                Gerenciar Propostas
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
              {estatisticas && estatisticas.propostas_enviadas > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {estatisticas.propostas_enviadas} ativas
                </span>
              )}
            </div>
          </div>

          {/* Relatórios e Análises */}
          <div 
            onClick={() => setTelaAtiva('configuracoes')}
            className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl hover:border-purple-300 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Relatórios & Config</h3>
                <p className="text-gray-600">Análises e configurações</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-purple-500" />
                Relatórios de performance
              </div>
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-2 text-purple-500" />
                Configurações de parcelamento
              </div>
              <div className="flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-purple-500" />
                Análises de conversão
              </div>
            </div>
            <div className="mt-6 flex items-center text-purple-600 font-medium group-hover:text-purple-700">
              Ver Relatórios
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar componentes específicos baseado na tela ativa
  if (telaAtiva === 'nova-simulacao') {
    return <GerarSimulacaoParcelamento onVoltar={() => setTelaAtiva('hub')} />;
  }

  if (telaAtiva === 'propostas') {
    return <GerenciarPropostas onVoltar={() => setTelaAtiva('hub')} />;
  }

  if (telaAtiva === 'configuracoes') {
    return <ConfiguracoesParcelamento onVoltar={() => setTelaAtiva('hub')} />;
  }

  return null;
}

// Componente para Nova Simulação
function NovaSimulacao({ onVoltar }: { onVoltar: () => void }) {
  const [etapaAtual, setEtapaAtual] = useState<'selecao' | 'simulacao' | 'proposta'>('selecao');
  const [cnpjCpfSelecionado, setCnpjCpfSelecionado] = useState("");
  const [cobrancasDisponiveis, setCobrancasDisponiveis] = useState<any[]>([]);
  const [cobrancasSelecionadas, setCobrancasSelecionadas] = useState<string[]>([]);
  const [simulacao, setSimulacao] = useState<SimulacaoParcelamentoType | null>(null);
  const [formSimulacao, setFormSimulacao] = useState({
    quantidade_parcelas: 6,
    data_primeira_parcela: "",
    valor_entrada: 0,
  });
  const [processando, setProcessando] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const simulacaoService = new SimulacaoParcelamentoService();
  const unidadesService = new UnidadesService();

  useEffect(() => {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 7);
    setFormSimulacao(prev => ({
      ...prev,
      data_primeira_parcela: hoje.toISOString().split('T')[0]
    }));
  }, []);

  const buscarCobrancas = async () => {
    if (!cnpjCpfSelecionado.trim()) {
      alert("Digite um CNPJ ou CPF válido");
      return;
    }

    setCarregando(true);
    try {
      const cobrancas = await simulacaoService.buscarCobrancasParaParcelamento(cnpjCpfSelecionado);
      setCobrancasDisponiveis(cobrancas);
      
      if (cobrancas.length === 0) {
        alert("Nenhuma cobrança disponível para parcelamento encontrada para este CNPJ/CPF");
      } else {
        setEtapaAtual('simulacao');
      }
    } catch (error) {
      alert(`Erro ao buscar cobranças: ${error}`);
    } finally {
      setCarregando(false);
    }
  };

  const simularParcelamento = async () => {
    if (cobrancasSelecionadas.length === 0) {
      alert("Selecione pelo menos uma cobrança");
      return;
    }

    setProcessando(true);
    try {
      const simulacaoResult = await simulacaoService.simularParcelamento(
        cobrancasSelecionadas,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );
      setSimulacao(simulacaoResult);
      setEtapaAtual('proposta');
    } catch (error) {
      alert(`Erro na simulação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const gerarProposta = async (canais: ('whatsapp' | 'email')[]) => {
    if (!simulacao?.id) {
      alert("Simulação não encontrada");
      return;
    }

    setProcessando(true);
    try {
      const proposta = await simulacaoService.gerarProposta(
        simulacao.id,
        canais,
        'usuario_atual'
      );

      // Enviar pelos canais selecionados
      const resultados = [];
      
      if (canais.includes('whatsapp')) {
        const sucessoWhatsApp = await simulacaoService.enviarPropostaWhatsApp(proposta.id!);
        resultados.push(`WhatsApp: ${sucessoWhatsApp ? 'Enviado' : 'Falha'}`);
      }
      
      if (canais.includes('email')) {
        const sucessoEmail = await simulacaoService.enviarPropostaEmail(proposta.id!);
        resultados.push(`Email: ${sucessoEmail ? 'Enviado' : 'Falha'}`);
      }

      alert(`Proposta gerada e enviada!\n\n${resultados.join('\n')}`);
      
      // Voltar ao hub após sucesso
      onVoltar();
    } catch (error) {
      alert(`Erro ao gerar proposta: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const valorTotalSelecionado = cobrancasDisponiveis
    .filter(c => cobrancasSelecionadas.includes(c.id))
    .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header com navegação */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onVoltar}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Nova Simulação de Parcelamento</h1>
              <p className="text-gray-600">Crie uma nova proposta de parcelamento consolidada</p>
            </div>
          </div>
        </div>

        {/* Indicador de Etapas */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${etapaAtual === 'selecao' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                etapaAtual === 'selecao' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <span className="ml-2 font-medium">Seleção</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`flex items-center ${etapaAtual === 'simulacao' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                etapaAtual === 'simulacao' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <span className="ml-2 font-medium">Simulação</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className={`flex items-center ${etapaAtual === 'proposta' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                etapaAtual === 'proposta' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                3
              </div>
              <span className="ml-2 font-medium">Proposta</span>
            </div>
          </div>
        </div>

        {/* Etapa 1: Seleção de Cliente */}
        {etapaAtual === 'selecao' && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">Selecione um Cliente para Parcelamento</h3>
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={cnpjCpfSelecionado}
                  onChange={(e) => setCnpjCpfSelecionado(e.target.value)}
                  placeholder="Digite o CNPJ ou CPF (apenas números)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={buscarCobrancas}
                  disabled={carregando}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {carregando ? 'Buscando...' : 'Buscar Cobranças'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Etapa 2: Simulação */}
        {etapaAtual === 'simulacao' && (
          <div className="space-y-6">
            {/* Resumo da Seleção */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Cobranças Disponíveis - {formatarCNPJCPF(cnpjCpfSelecionado)}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">
                        <input
                          type="checkbox"
                          checked={cobrancasSelecionadas.length === cobrancasDisponiveis.length && cobrancasDisponiveis.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCobrancasSelecionadas(cobrancasDisponiveis.map(c => c.id));
                            } else {
                              setCobrancasSelecionadas([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Descrição</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Valor</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Vencimento</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrancasDisponiveis.map((cobranca) => (
                      <tr key={cobranca.id} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <input
                            type="checkbox"
                            checked={cobrancasSelecionadas.includes(cobranca.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCobrancasSelecionadas([...cobrancasSelecionadas, cobranca.id]);
                              } else {
                                setCobrancasSelecionadas(cobrancasSelecionadas.filter(id => id !== cobranca.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 text-sm text-gray-900">
                          {cobranca.descricao || cobranca.cliente}
                        </td>
                        <td className="py-3 text-sm font-medium text-red-600">
                          {formatarMoeda(cobranca.valor_atualizado || cobranca.valor_original)}
                        </td>
                        <td className="py-3 text-sm text-gray-600">
                          {new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            cobranca.status === 'em_aberto' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {cobranca.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {cobrancasSelecionadas.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">
                      {cobrancasSelecionadas.length} cobrança(s) selecionada(s)
                    </span>
                    <span className="font-bold text-blue-600">
                      Total: {formatarMoeda(valorTotalSelecionado)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Parâmetros da Simulação */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Parâmetros da Simulação</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade de Parcelas
                  </label>
                  <select
                    value={formSimulacao.quantidade_parcelas}
                    onChange={(e) => setFormSimulacao({...formSimulacao, quantidade_parcelas: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({length: 40}, (_, i) => i + 3).map(num => (
                      <option key={num} value={num}>{num}x</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Primeira Parcela
                  </label>
                  <input
                    type="date"
                    value={formSimulacao.data_primeira_parcela}
                    onChange={(e) => setFormSimulacao({...formSimulacao, data_primeira_parcela: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Deixe 0 para sem entrada"
                  />
                </div>
              </div>
              
              <button
                onClick={simularParcelamento}
                disabled={processando || cobrancasSelecionadas.length === 0}
                className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? 'Simulando...' : 'Simular Parcelamento'}
              </button>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setEtapaAtual('selecao')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ← Voltar
              </button>
            </div>
          </div>
        )}

        {/* Etapa 3: Resultado e Proposta */}
        {etapaAtual === 'proposta' && simulacao && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Resultado da Simulação</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Valor Original:</span>
                    <span className="font-medium">{formatarMoeda(simulacao.valor_original)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Valor Atualizado:</span>
                    <span className="font-medium text-red-600">{formatarMoeda(simulacao.valor_atualizado)}</span>
                  </div>
                  {simulacao.valor_entrada && simulacao.valor_entrada > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Entrada:</span>
                      <span className="font-medium text-green-600">{formatarMoeda(simulacao.valor_entrada)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-700">Parcelas:</span>
                    <span className="font-medium text-blue-600">
                      {simulacao.quantidade_parcelas}x {formatarMoeda(simulacao.parcelas[0]?.valor || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {formatarMoeda(simulacao.valor_total_parcelamento)}
                    </div>
                    <div className="text-sm text-gray-600">Valor Total do Parcelamento</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">Cronograma de Parcelas:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {simulacao.parcelas.slice(0, 6).map((parcela, index) => (
                    <div key={index} className="flex justify-between py-1">
                      <span>Parcela {parcela.numero}:</span>
                      <span>{formatarMoeda(parcela.valor)} - {new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                  {simulacao.parcelas.length > 6 && (
                    <div className="text-gray-500 text-center col-span-2">
                      ... e mais {simulacao.parcelas.length - 6} parcelas
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Envio da Proposta */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Enviar Proposta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => gerarProposta(['whatsapp'])}
                  disabled={processando}
                  className="flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5 mr-2" />
                  {processando ? 'Enviando...' : 'Enviar via WhatsApp'}
                </button>
                
                <button
                  onClick={() => gerarProposta(['email'])}
                  disabled={processando}
                  className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5 mr-2" />
                  {processando ? 'Enviando...' : 'Enviar via Email'}
                </button>
              </div>
              
              <button
                onClick={() => gerarProposta(['whatsapp', 'email'])}
                disabled={processando}
                className="w-full mt-4 px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5 mr-2 inline" />
                {processando ? 'Enviando...' : 'Enviar via WhatsApp + Email'}
              </button>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setEtapaAtual('selecao')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ← Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente para Gerenciar Propostas
function GerenciarPropostas({ onVoltar }: { onVoltar: () => void }) {
  const [propostas, setPropostas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    status_proposta: '',
    cnpj: '',
    data_inicio: '',
    data_fim: ''
  });
  const [modalAceite, setModalAceite] = useState<any>(null);
  const [formAceite, setFormAceite] = useState({
    metodo_aceite: 'painel' as 'whatsapp' | 'email' | 'painel' | 'telefone',
    aceito_por: '',
    observacoes: ''
  });
  const [processandoAceite, setProcessandoAceite] = useState(false);

  const simulacaoService = new SimulacaoParcelamentoService();

  useEffect(() => {
    carregarPropostas();
  }, [filtros]);

  const carregarPropostas = async () => {
    setCarregando(true);
    try {
      const dados = await simulacaoService.buscarPropostas(filtros);
      setPropostas(dados);
    } catch (error) {
      console.error('Erro ao carregar propostas:', error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalAceite = (proposta: any) => {
    setModalAceite(proposta);
    setFormAceite({
      metodo_aceite: 'painel',
      aceito_por: '',
      observacoes: ''
    });
  };

  const fecharModalAceite = () => {
    setModalAceite(null);
    setFormAceite({
      metodo_aceite: 'painel',
      aceito_por: '',
      observacoes: ''
    });
  };

  const registrarAceite = async () => {
    if (!modalAceite || !formAceite.aceito_por.trim()) {
      alert('Nome de quem aceitou é obrigatório');
      return;
    }

    setProcessandoAceite(true);
    try {
      await simulacaoService.registrarAceite(
        modalAceite.id,
        formAceite.metodo_aceite,
        'admin_ip',
        navigator.userAgent,
        formAceite.observacoes
      );
      
      alert('Aceite registrado com sucesso! As parcelas foram criadas automaticamente.');
      fecharModalAceite();
      carregarPropostas();
    } catch (error) {
      alert(`Erro ao registrar aceite: ${error}`);
    } finally {
      setProcessandoAceite(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'enviada':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'aceita':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'recusada':
        return <FileText className="w-5 h-5 text-red-600" />;
      case 'expirada':
        return <Calendar className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enviada':
        return 'bg-blue-100 text-blue-800';
      case 'aceita':
        return 'bg-green-100 text-green-800';
      case 'recusada':
        return 'bg-red-100 text-red-800';
      case 'expirada':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isPropostaExpirada = (dataExpiracao: string) => {
    return new Date(dataExpiracao) < new Date();
  };

  const podeRegistrarAceite = (proposta: any) => {
    return proposta.status_proposta === 'enviada' && !isPropostaExpirada(proposta.data_expiracao);
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onVoltar}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Acompanhar Propostas de Parcelamento</h1>
              <p className="text-gray-600">Gerencie propostas enviadas e registre aceites</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filtros.status_proposta}
              onChange={(e) => setFiltros({...filtros, status_proposta: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="enviada">Enviada</option>
              <option value="aceita">Aceita</option>
              <option value="recusada">Recusada</option>
              <option value="expirada">Expirada</option>
            </select>
            
            <input
              type="text"
              value={filtros.cnpj}
              onChange={(e) => setFiltros({...filtros, cnpj: e.target.value})}
              placeholder="CNPJ/CPF"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="date"
              value={filtros.data_inicio}
              onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            
            <input
              type="date"
              value={filtros.data_fim}
              onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabela de Propostas */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Criação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcelas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validade
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
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Carregando propostas...
                    </div>
                  </td>
                </tr>
              ) : propostas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    Nenhuma proposta encontrada
                  </td>
                </tr>
              ) : (
                propostas.map((proposta) => {
                  const simulacaoData = (proposta as any).simulacoes_parcelamento;
                  const expirada = isPropostaExpirada(proposta.data_expiracao);
                  
                  return (
                    <tr key={proposta.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(proposta.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {simulacaoData?.metadados_consolidacao?.quantidade_cobrancas || 1} cobrança(s)
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatarCNPJCPF(proposta.cnpj_unidade)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {formatarMoeda(simulacaoData?.valor_total_parcelamento || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {simulacaoData?.quantidade_parcelas || 0}x {formatarMoeda(simulacaoData?.parcelas?.[0]?.valor || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(proposta.status_proposta)}
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(proposta.status_proposta)}`}>
                            {proposta.status_proposta.toUpperCase()}
                          </span>
                          {expirada && proposta.status_proposta === 'enviada' && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              EXPIRADA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(proposta.data_expiracao).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => alert('Funcionalidade de visualização será implementada')}
                            className="text-blue-600 hover:text-blue-900"
                            title="Visualizar proposta"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {podeRegistrarAceite(proposta) && (
                            <button
                              onClick={() => abrirModalAceite(proposta)}
                              className="text-green-600 hover:text-green-900"
                              title="Registrar aceite"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Aceite */}
      {modalAceite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Registrar Aceite da Proposta</h3>
              <button onClick={fecharModalAceite} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-6">
              {/* Resumo da Proposta */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-3">Resumo da Proposta:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-medium">{formatarCNPJCPF(modalAceite.cnpj_unidade)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Total:</span>
                    <p className="font-medium text-green-600">
                      {formatarMoeda((modalAceite as any).simulacoes_parcelamento?.valor_total_parcelamento || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Parcelas:</span>
                    <p className="font-medium">
                      {(modalAceite as any).simulacoes_parcelamento?.quantidade_parcelas || 0}x {formatarMoeda((modalAceite as any).simulacoes_parcelamento?.parcelas?.[0]?.valor || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Válida até:</span>
                    <p className="font-medium">{new Date(modalAceite.data_expiracao).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>

              {/* Formulário de Aceite */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Método de Aceite *
                  </label>
                  <select
                    value={formAceite.metodo_aceite}
                    onChange={(e) => setFormAceite({...formAceite, metodo_aceite: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="painel">Painel Administrativo</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="telefone">Telefone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome de Quem Aceitou *
                  </label>
                  <input
                    type="text"
                    value={formAceite.aceito_por}
                    onChange={(e) => setFormAceite({...formAceite, aceito_por: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Nome do franqueado ou responsável"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    value={formAceite.observacoes}
                    onChange={(e) => setFormAceite({...formAceite, observacoes: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Observações sobre o aceite..."
                  />
                </div>
              </div>

              {/* Explicação do Processo */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">O que acontece ao registrar o aceite:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• As cobranças originais serão marcadas como "parcelado"</li>
                  <li>• Serão criadas {(modalAceite as any).simulacoes_parcelamento?.quantidade_parcelas || 0} novas cobranças individuais (parcelas)</li>
                  <li>• As parcelas aparecerão na coluna "Parcelas Futuras" do Kanban</li>
                  <li>• Um acordo formal será registrado no sistema</li>
                </ul>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={registrarAceite}
                disabled={processandoAceite || !formAceite.aceito_por.trim()}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processandoAceite ? 'Registrando...' : 'Confirmar Aceite'}
              </button>
              <button
                onClick={fecharModalAceite}
                className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
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

// Componente para Configurações de Parcelamento
function ConfiguracoesParcelamento({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onVoltar}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Configurações de Parcelamento</h1>
              <p className="text-gray-600">Configure parâmetros e visualize relatórios</p>
            </div>
          </div>
        </div>
        
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Em Desenvolvimento</h3>
          <p className="text-gray-600">Esta funcionalidade será implementada em breve.</p>
        </div>
      </div>
    </div>
  );
}