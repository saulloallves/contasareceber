/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Calculator,
  Send,
  Download,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  MessageSquare,
  Mail,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import {
  SimulacaoParcelamento,
  PropostaParcelamento,
  FiltrosSimulacao,
  EstatisticasParcelamento,
} from "../types/simulacaoParcelamento";
import { cobrancaService } from "../services/cobrancaService";
import { formatarCNPJCPF, formatarMoeda } from "../utils/formatters";
import toast from "react-hot-toast";

export function SimulacaoParcelamento() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<PropostaParcelamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosSimulacao>({});
  const [modalAberto, setModalAberto] = useState<
    "simular" | "visualizar" | "enviar" | null
  >(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
  const [simulacao, setSimulacao] = useState<SimulacaoParcelamento | null>(
    null
  );
  const [formSimulacao, setFormSimulacao] = useState({
    quantidade_parcelas: 3,
    data_primeira_parcela: "",
    valor_entrada: 0,
  });
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasParcelamento | null>(null);
  const [propostaSelecionada, setPropostaSelecionada] = useState<any>(null);
  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const simulacaoService = new SimulacaoParcelamentoService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [cobrancasData, propostasData, statsData] = await Promise.all([
        cobrancaService.buscarCobrancas({
          status: "em_aberto",
          apenasInadimplentes: true,
        }),
        simulacaoService.buscarPropostas(filtros),
        simulacaoService.buscarEstatisticas(),
      ]);

      setCobrancas(cobrancasData);
      setPropostas(propostasData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalSimular = (cobranca: any) => {
    setCobrancaSelecionada(cobranca);
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: amanha.toISOString().split("T")[0],
      valor_entrada: 0,
    });
    setSimulacao(null);
    setModalAberto("simular");
  };

  const abrirModalVisualizar = (proposta: any) => {
    setPropostaSelecionada(proposta);
    setModalAberto("visualizar");
  };

  const abrirModalEnviar = (proposta: any) => {
    setPropostaSelecionada(proposta);
    setModalAberto("enviar");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setPropostaSelecionada(null);
    setSimulacao(null);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: "",
      valor_entrada: 0,
    });
  };

  const validarQuantidadeParcelas = (quantidade: number): boolean => {
    if (quantidade < 2) {
      toast.error("Número mínimo de parcelas é 2");
      return false;
    }
    if (quantidade > 42) {
      toast.error("Número máximo de parcelas é 42");
      return false;
    }
    return true;
  };

  const simularParcelamento = async () => {
    if (!cobrancaSelecionada || !formSimulacao.data_primeira_parcela) {
      toast.error("Cobrança e data da primeira parcela são obrigatórios");
      return;
    }

    // Validação da quantidade de parcelas
    if (!validarQuantidadeParcelas(formSimulacao.quantidade_parcelas)) {
      return;
    }

    setProcessando(true);
    try {
      const simulacaoResult = await simulacaoService.simularParcelamento(
        cobrancaSelecionada.id,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );
      setSimulacao(simulacaoResult);
      toast.success("Simulação realizada com sucesso!");
    } catch (error) {
      console.error("Erro na simulação:", error);
      toast.error(`Erro na simulação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const salvarSimulacao = async () => {
    if (!simulacao) return;

    setProcessando(true);
    try {
      const simulacaoId = await simulacaoService.salvarSimulacao(simulacao);
      const proposta = await simulacaoService.gerarProposta(
        simulacaoId,
        ["whatsapp", "email"],
        "usuario_atual"
      );
      fecharModal();
      carregarDados();
      toast.success("Proposta criada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar simulação:", error);
      toast.error(`Erro ao salvar: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const enviarWhatsApp = async () => {
    if (!propostaSelecionada) return;

    setEnviandoWhatsApp(true);
    try {
      const sucesso = await simulacaoService.enviarPropostaWhatsApp(
        propostaSelecionada.id
      );
      if (sucesso) {
        toast.success("Proposta enviada via WhatsApp!");
        carregarDados();
      } else {
        toast.error("Falha no envio via WhatsApp");
      }
    } catch (error) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast.error(`Erro no WhatsApp: ${error}`);
    } finally {
      setEnviandoWhatsApp(false);
    }
  };

  const enviarEmail = async () => {
    if (!propostaSelecionada) return;

    setEnviandoEmail(true);
    try {
      const sucesso = await simulacaoService.enviarPropostaEmail(
        propostaSelecionada.id
      );
      if (sucesso) {
        toast.success("Proposta enviada via Email!");
        carregarDados();
      } else {
        toast.error("Falha no envio via Email");
      }
    } catch (error) {
      console.error("Erro ao enviar Email:", error);
      toast.error(`Erro no Email: ${error}`);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await simulacaoService.exportarPropostas(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `simulacoes-parcelamento-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      toast.error("Erro ao exportar dados");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "enviada":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "aceita":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "recusada":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "expirada":
        return <XCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "enviada":
        return "bg-blue-100 text-blue-800";
      case "aceita":
        return "bg-green-100 text-green-800";
      case "recusada":
        return "bg-red-100 text-red-800";
      case "expirada":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const handleQuantidadeParcelasChange = (value: string) => {
    const quantidade = parseInt(value) || 0;
    
    // Atualiza o estado mesmo se inválido para mostrar o valor digitado
    setFormSimulacao({
      ...formSimulacao,
      quantidade_parcelas: quantidade,
    });

    // Limpa simulação anterior se quantidade mudou
    if (simulacao && quantidade !== simulacao.quantidade_parcelas) {
      setSimulacao(null);
    }
  };

  const incrementarParcelas = () => {
    const novaQuantidade = Math.min(formSimulacao.quantidade_parcelas + 1, 42);
    setFormSimulacao({
      ...formSimulacao,
      quantidade_parcelas: novaQuantidade,
    });
    if (simulacao) setSimulacao(null);
  };

  const decrementarParcelas = () => {
    const novaQuantidade = Math.max(formSimulacao.quantidade_parcelas - 1, 2);
    setFormSimulacao({
      ...formSimulacao,
      quantidade_parcelas: novaQuantidade,
    });
    if (simulacao) setSimulacao(null);
  };

  const isQuantidadeValida = () => {
    return formSimulacao.quantidade_parcelas >= 2 && formSimulacao.quantidade_parcelas <= 42;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Calculator className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Simulação de Parcelamento
              </h1>
              <p className="text-gray-600">
                Simule e envie propostas de parcelamento personalizadas
              </p>
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
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_simulacoes}
              </div>
              <div className="text-sm text-blue-800">Total Simulações</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.propostas_enviadas}
              </div>
              <div className="text-sm text-green-800">Propostas Enviadas</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.propostas_aceitas}
              </div>
              <div className="text-sm text-yellow-800">Propostas Aceitas</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.taxa_conversao.toFixed(1)}%
              </div>
              <div className="text-sm text-purple-800">Taxa de Conversão</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-600">
                {formatarMoeda(estatisticas.valor_total_parcelado)}
              </div>
              <div className="text-sm text-indigo-800">Valor Parcelado</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">
              Filtros e Busca
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              value={filtros.cnpj || ""}
              onChange={(e) => setFiltros({ ...filtros, cnpj: e.target.value })}
              placeholder="CNPJ/CPF"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />

            <select
              value={filtros.status_proposta || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, status_proposta: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Todos os Status</option>
              <option value="enviada">Enviada</option>
              <option value="aceita">Aceita</option>
              <option value="recusada">Recusada</option>
              <option value="expirada">Expirada</option>
            </select>

            <input
              type="date"
              value={filtros.data_inicio || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, data_inicio: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />

            <input
              type="text"
              value={filtros.enviado_por || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, enviado_por: e.target.value })
              }
              placeholder="Enviado por"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Tabela de Cobranças para Simulação */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Cobranças Disponíveis para Parcelamento
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CNPJ/CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Original
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Atualizado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dias Atraso
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
                        <RefreshCw className="w-6 h-6 animate-spin text-green-600 mr-2" />
                        Carregando cobranças...
                      </div>
                    </td>
                  </tr>
                ) : cobrancas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhuma cobrança disponível para parcelamento
                    </td>
                  </tr>
                ) : (
                  cobrancas.slice(0, 20).map((cobranca) => (
                    <tr key={cobranca.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {cobranca.cliente}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatarCNPJCPF(cobranca.cnpj || cobranca.cpf || "")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatarMoeda(cobranca.valor_original)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-red-600">
                          {formatarMoeda(
                            cobranca.valor_atualizado || cobranca.valor_original
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {cobranca.dias_em_atraso || 0} dias
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => abrirModalSimular(cobranca)}
                          className="text-green-600 hover:text-green-900"
                          title="Simular parcelamento"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Propostas */}
        <div className="overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Propostas de Parcelamento
          </h3>
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
                  CNPJ/CPF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Parcelas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
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
              {propostas.map((proposta) => (
                <tr key={proposta.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatarData(proposta.created_at!)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {(proposta as any).cobrancas_franqueados?.cliente}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatarCNPJCPF(proposta.cnpj_unidade)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(proposta as any).simulacoes_parcelamento
                        ?.quantidade_parcelas || "N/A"}
                      x
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600">
                      {formatarMoeda(
                        (proposta as any).simulacoes_parcelamento
                          ?.valor_total_parcelamento || 0
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(proposta.status_proposta)}
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          proposta.status_proposta
                        )}`}
                      >
                        {proposta.status_proposta.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => abrirModalVisualizar(proposta)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Visualizar proposta"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {proposta.status_proposta === "enviada" && (
                        <button
                          onClick={() => abrirModalEnviar(proposta)}
                          className="text-green-600 hover:text-green-900"
                          title="Reenviar proposta"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Simulação */}
      {modalAberto === "simular" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Simular Parcelamento - {cobrancaSelecionada.cliente}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Informações da Cobrança */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">
                  Dados da Cobrança:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Cliente:</span>
                    <p className="font-medium">{cobrancaSelecionada.cliente}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">CNPJ/CPF:</span>
                    <p className="font-medium">
                      {formatarCNPJCPF(
                        cobrancaSelecionada.cnpj || cobrancaSelecionada.cpf || ""
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Original:</span>
                    <p className="font-medium">
                      {formatarMoeda(cobrancaSelecionada.valor_original)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Atualizado:</span>
                    <p className="font-medium text-red-600">
                      {formatarMoeda(
                        cobrancaSelecionada.valor_atualizado ||
                          cobrancaSelecionada.valor_original
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Vencimento:</span>
                    <p className="font-medium">
                      {formatarData(cobrancaSelecionada.data_vencimento)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Dias em Atraso:</span>
                    <p className="font-medium">
                      {cobrancaSelecionada.dias_em_atraso || 0} dias
                    </p>
                  </div>
                </div>
              </div>

              {/* Parâmetros da Simulação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade de Parcelas *
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={decrementarParcelas}
                      disabled={formSimulacao.quantidade_parcelas <= 2}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="2"
                      max="42"
                      value={formSimulacao.quantidade_parcelas}
                      onChange={(e) => handleQuantidadeParcelasChange(e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg text-center font-medium focus:ring-2 focus:ring-green-500 ${
                        isQuantidadeValida()
                          ? "border-gray-300"
                          : "border-red-300 bg-red-50"
                      }`}
                      placeholder="Digite o número de parcelas"
                    />
                    <button
                      type="button"
                      onClick={incrementarParcelas}
                      disabled={formSimulacao.quantidade_parcelas >= 42}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Mínimo: 2 parcelas | Máximo: 42 parcelas
                  </div>
                  {!isQuantidadeValida() && (
                    <div className="mt-1 text-xs text-red-600 flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Valor deve estar entre 2 e 42 parcelas
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data da Primeira Parcela *
                  </label>
                  <input
                    type="date"
                    value={formSimulacao.data_primeira_parcela}
                    onChange={(e) =>
                      setFormSimulacao({
                        ...formSimulacao,
                        data_primeira_parcela: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                    onChange={(e) =>
                      setFormSimulacao({
                        ...formSimulacao,
                        valor_entrada: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Deixe 0 para sem entrada"
                  />
                </div>
              </div>

              <button
                onClick={simularParcelamento}
                disabled={
                  processando ||
                  !formSimulacao.data_primeira_parcela ||
                  !isQuantidadeValida()
                }
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Simulando..." : "Simular Parcelamento"}
              </button>

              {/* Resultado da Simulação */}
              {simulacao && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-green-800 mb-4">
                    Resultado da Simulação
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Valor Original:
                      </span>
                      <p className="text-lg font-bold text-gray-800">
                        {formatarMoeda(simulacao.valor_original)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Valor Atualizado:
                      </span>
                      <p className="text-lg font-bold text-red-600">
                        {formatarMoeda(simulacao.valor_atualizado)}
                      </p>
                    </div>
                    {simulacao.valor_entrada && simulacao.valor_entrada > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Entrada:
                        </span>
                        <p className="text-lg font-bold text-green-600">
                          {formatarMoeda(simulacao.valor_entrada)}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Parcelas:
                      </span>
                      <p className="text-lg font-bold text-blue-600">
                        {simulacao.quantidade_parcelas}x{" "}
                        {formatarMoeda(simulacao.parcelas[0]?.valor || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">
                      Cronograma de Pagamentos:
                    </h5>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {simulacao.valor_entrada && simulacao.valor_entrada > 0 && (
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <span className="font-medium text-green-800">
                            Entrada ({formatarData(simulacao.data_primeira_parcela)}):
                          </span>
                          <span className="font-medium text-green-600">
                            {formatarMoeda(simulacao.valor_entrada)}
                          </span>
                        </div>
                      )}
                      {simulacao.parcelas.map((parcela, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 hover:bg-gray-50 rounded"
                        >
                          <div>
                            <span className="font-medium">
                              Parcela {parcela.numero}
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                              ({formatarData(parcela.data_vencimento)})
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {formatarMoeda(parcela.valor)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Multa: {formatarMoeda(parcela.multa)} | Juros:{" "}
                              {formatarMoeda(parcela.juros_mora)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-blue-800">
                        Total do Parcelamento:
                      </span>
                      <span className="text-xl font-bold text-blue-600">
                        {formatarMoeda(simulacao.valor_total_parcelamento)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Multa aplicada: {simulacao.percentual_multa}% | Juros de
                        mora: {simulacao.percentual_juros_mora}%
                      </p>
                      {simulacao.economia_total &&
                        simulacao.economia_total > 0 && (
                          <p className="text-green-600 font-medium">
                            Economia com entrada:{" "}
                            {formatarMoeda(simulacao.economia_total)}
                          </p>
                        )}
                    </div>
                  </div>

                  <button
                    onClick={salvarSimulacao}
                    disabled={processando}
                    className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processando ? "Criando Proposta..." : "Criar Proposta"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {modalAberto === "visualizar" && propostaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes da Proposta</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Informações da Proposta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatarMoeda(
                      (propostaSelecionada as any).simulacoes_parcelamento
                        ?.valor_total_parcelamento || 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Valor Total da Proposta
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {formatarMoeda(
                      (propostaSelecionada as any).simulacoes_parcelamento
                        ?.valor_entrada || 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Entrada</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {(propostaSelecionada as any).simulacoes_parcelamento
                      ?.quantidade_parcelas || 0}
                    x{" "}
                    {formatarMoeda(
                      (propostaSelecionada as any).simulacoes_parcelamento
                        ?.parcelas?.[0]?.valor || 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Parcelas</div>
                </div>
              </div>

              {/* Cronograma */}
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  Cronograma de Pagamentos
                </h4>
                <div className="max-h-60 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Parcela
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Valor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Vencimento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Multa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Juros Mora
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(propostaSelecionada as any).simulacoes_parcelamento
                        ?.parcelas?.map((parcela: any, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {parcela.numero}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatarMoeda(parcela.valor)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatarData(parcela.data_vencimento)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {formatarMoeda(parcela.multa)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {formatarMoeda(parcela.juros_mora)}
                          </td>
                        </tr>
                      )) || (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            Dados de parcelas não disponíveis
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mensagem da Proposta */}
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  Mensagem da Proposta
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {propostaSelecionada.mensagem_proposta}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Envio */}
      {modalAberto === "enviar" && propostaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Enviar Proposta</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">
                  Resumo da Proposta:
                </h4>
                <div className="space-y-1 text-sm text-blue-700">
                  <p>
                    Cliente:{" "}
                    {(propostaSelecionada as any).cobrancas_franqueados?.cliente}
                  </p>
                  <p>
                    Parcelas:{" "}
                    {(propostaSelecionada as any).simulacoes_parcelamento
                      ?.quantidade_parcelas || "N/A"}
                    x
                  </p>
                  <p>
                    Total:{" "}
                    {formatarMoeda(
                      (propostaSelecionada as any).simulacoes_parcelamento
                        ?.valor_total_parcelamento || 0
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={enviarWhatsApp}
                  disabled={enviandoWhatsApp}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {enviandoWhatsApp ? "Enviando..." : "Enviar via WhatsApp"}
                </button>

                <button
                  onClick={enviarEmail}
                  disabled={enviandoEmail}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {enviandoEmail ? "Enviando..." : "Enviar via Email"}
                </button>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={fecharModal}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}