/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import {
  Calculator,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  Eye,
  Send,
  Calendar,
  Target,
  ArrowRight,
} from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { formatarCNPJCPF, formatarMoeda } from "../utils/formatters";
import toast from 'react-hot-toast';
import { EstatisticasParcelamento } from "../types/simulacaoParcelamento";
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
        <div className="flex flex-row gap-8 w-full">
          {/* Nova Simulação */}
          <div 
            onClick={() => setTelaAtiva('nova-simulacao')}
            className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl hover:border-blue-300 transition-all duration-300 cursor-pointer group"
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
                Selecionar cobranças
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
            className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl hover:border-green-300 transition-all duration-300 cursor-pointer group"
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

  return null;
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
      toast.error('Nome de quem aceitou é obrigatório');
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
      
      toast.success('Aceite registrado com sucesso! As parcelas foram criadas automaticamente.');
      fecharModalAceite();
      carregarPropostas();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao registrar aceite: ${msg}`);
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
                            onClick={() => toast('Funcionalidade de visualização será implementada')}
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-auto overflow-y-auto">
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