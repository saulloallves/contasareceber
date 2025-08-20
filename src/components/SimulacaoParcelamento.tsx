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
  Grid3X3,
  List,
  Search,
  FileText,
  Building2,
  User,
} from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import {
  ISimulacaoParcelamento,
  PropostaParcelamento,
  FiltrosSimulacao,
  EstatisticasParcelamento,
} from "../types/simulacaoParcelamento";
import { cobrancaService } from "../services/cobrancaService";
import { formatarCNPJCPF, formatarMoeda, formatarData } from "../utils/formatters";
import toast from "react-hot-toast";

export function SimulacaoParcelamento() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [propostas, setPropostas] = useState<PropostaParcelamento[]>([]);
  const [cobrancasSelecionadas, setCobrancasSelecionadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosSimulacao>({});
  const [modalAberto, setModalAberto] = useState<
    "simular" | "visualizar" | "enviar" | null
  >(null);
  const [cobrancasParaSimular, setCobrancasParaSimular] = useState<any[]>([]);
  const [simulacao, setSimulacao] = useState<ISimulacaoParcelamento | null>(
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
  const [visualizacao, setVisualizacao] = useState<"cards" | "lista">("cards");
  const [busca, setBusca] = useState("");
  const [modoSelecao, setModoSelecao] = useState(false);

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

  const toggleSelecaoCobranca = (cobranca: any) => {
    if (!modoSelecao) {
      // Se não está em modo seleção, abre modal diretamente
      abrirModalSimular([cobranca]);
      return;
    }

    const novaSelecao = new Set(cobrancasSelecionadas);
    
    if (novaSelecao.has(cobranca.id)) {
      novaSelecao.delete(cobranca.id);
    } else {
      // Verifica se é do mesmo CPF/CNPJ das já selecionadas
      if (novaSelecao.size > 0) {
        const primeiraCobranca = cobrancas.find(c => novaSelecao.has(c.id));
        const documentoPrimeira = primeiraCobranca?.cnpj || primeiraCobranca?.cpf;
        const documentoAtual = cobranca.cnpj || cobranca.cpf;
        
        if (documentoPrimeira !== documentoAtual) {
          toast.error("Só é possível selecionar cobranças do mesmo CPF/CNPJ");
          return;
        }
      }
      novaSelecao.add(cobranca.id);
    }
    
    setCobrancasSelecionadas(novaSelecao);
  };

  const abrirModalSimular = (cobrancasList: any[]) => {
    setCobrancasParaSimular(cobrancasList);
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

  const simularCobrancasSelecionadas = () => {
    if (cobrancasSelecionadas.size === 0) {
      toast.error("Selecione pelo menos uma cobrança");
      return;
    }
    
    const cobrancasList = Array.from(cobrancasSelecionadas).map(id => 
      cobrancas.find(c => c.id === id)
    ).filter(Boolean);
    
    abrirModalSimular(cobrancasList);
    setModoSelecao(false);
    setCobrancasSelecionadas(new Set());
  };

  const cancelarSelecao = () => {
    setModoSelecao(false);
    setCobrancasSelecionadas(new Set());
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
    setCobrancasParaSimular([]);
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
    if (cobrancasParaSimular.length === 0 || !formSimulacao.data_primeira_parcela) {
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
        cobrancasParaSimular.map(c => c.id), // Array de IDs
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );
      setSimulacao(simulacaoResult);
      toast.success(
        cobrancasParaSimular.length > 1 
          ? `Simulação consolidada realizada para ${cobrancasParaSimular.length} cobranças!`
          : "Simulação realizada com sucesso!"
      );
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

  // Filtrar cobranças baseado na busca
  const cobrancasFiltradas = cobrancas.filter((cobranca) => {
    const termoBusca = busca.toLowerCase();
    return (
      cobranca.cliente.toLowerCase().includes(termoBusca) ||
      (cobranca.cnpj && cobranca.cnpj.includes(termoBusca.replace(/\D/g, ""))) ||
      (cobranca.cpf && cobranca.cpf.includes(termoBusca.replace(/\D/g, "")))
    );
  });

  const CardCobranca = ({ cobranca }: { cobranca: any }) => {
    const valorAtualizado = cobranca.valor_atualizado || cobranca.valor_original;
    const diasAtraso = cobranca.dias_em_atraso || 0;
    const isSelected = cobrancasSelecionadas.has(cobranca.id);
    
    return (
      <div
        className={`rounded-lg shadow-md border p-6 hover:shadow-lg transition-all duration-200 cursor-pointer ${
          isSelected 
            ? 'bg-green-50 border-green-300 ring-2 ring-green-200' 
            : 'bg-white border-gray-200'
        }`}
        onClick={() => toggleSelecaoCobranca(cobranca)}
      >
        {modoSelecao && (
          <div className="absolute top-2 right-2">
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              isSelected 
                ? 'bg-green-500 border-green-500' 
                : 'bg-white border-gray-300'
            }`}>
              {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
            </div>
          </div>
        )}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md mr-4">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                {cobranca.cliente}
              </h3>
              <p className="text-sm text-gray-600">
                {formatarCNPJCPF(cobranca.cnpj || cobranca.cpf || "")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-600">
              {formatarMoeda(valorAtualizado)}
            </div>
            <div className="text-sm text-gray-500">Valor Atualizado</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500">Valor Original</div>
            <div className="text-lg font-semibold text-gray-800">
              {formatarMoeda(cobranca.valor_original)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Vencimento</div>
            <div className="text-lg font-semibold text-gray-800">
              {formatarData(cobranca.data_vencimento)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              diasAtraso > 30 ? 'bg-red-100 text-red-800' :
              diasAtraso > 0 ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {diasAtraso > 0 ? `${diasAtraso} dias atraso` : 'No prazo'}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {modoSelecao ? 'Clique para selecionar' : 'Clique para simular'}
          </div>
        </div>
      </div>
    );
  };

  const LinhaCobranca = ({ cobranca }: { cobranca: any }) => {
    const valorAtualizado = cobranca.valor_atualizado || cobranca.valor_original;
    const diasAtraso = cobranca.dias_em_atraso || 0;
    const isSelected = cobrancasSelecionadas.has(cobranca.id);

    return (
      <tr 
        className={`cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-green-50 hover:bg-green-100' 
            : 'hover:bg-gray-50'
        }`}
        onClick={() => toggleSelecaoCobranca(cobranca)}
      >
        {modoSelecao && (
          <td className="px-6 py-4 whitespace-nowrap">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              isSelected 
                ? 'bg-green-500 border-green-500' 
                : 'bg-white border-gray-300'
            }`}>
              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
          </td>
        )}
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md mr-3">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {cobranca.cliente}
              </div>
              <div className="text-sm text-gray-500">
                {formatarCNPJCPF(cobranca.cnpj || cobranca.cpf || "")}
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatarMoeda(cobranca.valor_original)}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-red-600">
            {formatarMoeda(valorAtualizado)}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatarData(cobranca.data_vencimento)}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            diasAtraso > 30 ? 'bg-red-100 text-red-800' :
            diasAtraso > 0 ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {diasAtraso > 0 ? `${diasAtraso} dias` : 'No prazo'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {modoSelecao ? 'Clique para selecionar' : 'Clique para simular'}
        </td>
      </tr>
    );
  };

  return (
    <div className="max-w-full mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
            <Calculator className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              Simulação de Parcelamento
            </h1>
            <p className="text-gray-600">
              Simule e envie propostas de parcelamento personalizadas
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
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
      </div>

      {/* Controles e Filtros */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Busca */}
          <div className="flex-1 flex items-center bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, CNPJ ou CPF..."
              className="flex-1 bg-transparent outline-none text-gray-800"
            />
          </div>

          {/* Controles de Visualização */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setVisualizacao("cards")}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  visualizacao === "cards"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Grid3X3 className="w-4 h-4 mr-2" />
                Cards
              </button>
              <button
                onClick={() => setVisualizacao("lista")}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  visualizacao === "lista"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <List className="w-4 h-4 mr-2" />
                Lista
              </button>
            </div>

            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>

            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* Informações */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Mostrando {cobrancasFiltradas.length} de {cobrancas.length} cobranças disponíveis para parcelamento
          </span>
          <span>
            Clique em uma cobrança para simular parcelamento
          </span>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Carregando cobranças...</p>
            </div>
          </div>
        ) : cobrancasFiltradas.length === 0 ? (
          <div className="text-center py-12">
            <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Nenhuma cobrança encontrada
            </h3>
            <p className="text-gray-500">
              {busca ? "Tente ajustar os termos de busca" : "Não há cobranças disponíveis para parcelamento"}
            </p>
          </div>
        ) : (
          <>
            {/* Visualização em Cards */}
            {visualizacao === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cobrancasFiltradas.map((cobranca) => (
                  <CardCobranca key={cobranca.id} cobranca={cobranca} />
                ))}
              </div>
            )}

            {/* Visualização em Lista */}
            {visualizacao === "lista" && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Original
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Atualizado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vencimento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status Atraso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cobrancasFiltradas.map((cobranca) => (
                      <LinhaCobranca key={cobranca.id} cobranca={cobranca} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <>
        {/* Modal de Simulação */}
      {modalAberto === "simular" && cobrancasParaSimular.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {cobrancasParaSimular.length > 1 
                  ? `Simular Parcelamento - ${cobrancasParaSimular.length} cobranças selecionadas`
                  : `Simular Parcelamento - ${cobrancasParaSimular[0].cliente}`
                }
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Informações das Cobranças */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">
                  {cobrancasParaSimular.length > 1 
                    ? `Dados das ${cobrancasParaSimular.length} Cobranças Selecionadas:`
                    : "Dados da Cobrança:"
                  }
                </h4>
                
                {cobrancasParaSimular.length === 1 ? (
                  // Exibição para uma cobrança
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Cliente:</span>
                      <p className="font-medium">{cobrancasParaSimular[0].cliente}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">CNPJ/CPF:</span>
                      <p className="font-medium">
                        {formatarCNPJCPF(
                          cobrancasParaSimular[0].cnpj || cobrancasParaSimular[0].cpf || ""
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor Original:</span>
                      <p className="font-medium">
                        {formatarMoeda(cobrancasParaSimular[0].valor_original)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor Atualizado:</span>
                      <p className="font-medium text-red-600">
                        {formatarMoeda(
                          cobrancasParaSimular[0].valor_atualizado ||
                            cobrancasParaSimular[0].valor_original
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Vencimento:</span>
                      <p className="font-medium">
                        {formatarData(cobrancasParaSimular[0].data_vencimento)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Dias em Atraso:</span>
                      <p className="font-medium">
                        {cobrancasParaSimular[0].dias_em_atraso || 0} dias
                      </p>
                    </div>
                  </div>
                ) : (
                  // Exibição para múltiplas cobranças
                  <div className="space-y-4">
                    {/* Resumo consolidado */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white rounded-lg p-4 border">
                      <div>
                        <span className="text-gray-600">Cliente:</span>
                        <p className="font-medium">{cobrancasParaSimular[0].cliente}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">CNPJ/CPF:</span>
                        <p className="font-medium">
                          {formatarCNPJCPF(
                            cobrancasParaSimular[0].cnpj || cobrancasParaSimular[0].cpf || ""
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total de Cobranças:</span>
                        <p className="font-medium text-blue-600">
                          {cobrancasParaSimular.length} cobranças
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Valor Original Total:</span>
                        <p className="font-medium">
                          {formatarMoeda(
                            cobrancasParaSimular.reduce((acc, c) => acc + c.valor_original, 0)
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Valor Atualizado Total:</span>
                        <p className="font-medium text-red-600">
                          {formatarMoeda(
                            cobrancasParaSimular.reduce((acc, c) => 
                              acc + (c.valor_atualizado || c.valor_original), 0
                            )
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Maior Atraso:</span>
                        <p className="font-medium">
                          {Math.max(...cobrancasParaSimular.map(c => c.dias_em_atraso || 0))} dias
                        </p>
                      </div>
                    </div>
                    
                    {/* Lista detalhada das cobranças */}
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Detalhamento das Cobranças:</h5>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {cobrancasParaSimular.map((cobranca, index) => (
                          <div key={cobranca.id} className="flex justify-between items-center p-2 bg-white rounded border text-sm">
                            <div>
                              <span className="font-medium">Cobrança {index + 1}</span>
                              <span className="text-gray-500 ml-2">
                                (Venc: {formatarData(cobranca.data_vencimento)})
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatarMoeda(cobranca.valor_atualizado || cobranca.valor_original)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {cobranca.dias_em_atraso || 0} dias atraso
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
        {modalAberto === 'simular' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <>
                <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Detalhes da Simulação</h3>
                <button
                  onClick={() => setModalVisualizacao(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Informações Gerais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatarMoeda(simulacaoAtual.valor_total_parcelamento)}
                    </div>
                    <div className="text-sm text-blue-800">Valor Total do Parcelamento</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {simulacaoAtual.valor_entrada ? formatarMoeda(simulacaoAtual.valor_entrada) : 'Sem entrada'}
                    </div>
                    <div className="text-sm text-green-800">Entrada</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {simulacaoAtual.quantidade_parcelas}x {formatarMoeda(simulacaoAtual.parcelas[0]?.valor || 0)}
                    </div>
                    <div className="text-sm text-purple-800">Parcelas</div>
                  </div>
                </div>

                {/* Cronograma de Parcelas */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Cronograma de Parcelas</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parcela</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Multa</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Juros Mora</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {simulacaoAtual.parcelas.map((parcela) => (
                          <tr key={parcela.numero}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {parcela.numero}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarMoeda(parcela.valor)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarData(parcela.data_vencimento)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarMoeda(parcela.multa)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarMoeda(parcela.juros_mora)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumo Financeiro */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3">Resumo Financeiro:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Valor Original:</span>
                      <p className="font-medium">{formatarMoeda(simulacaoAtual.valor_original)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor Atualizado:</span>
                      <p className="font-medium text-red-600">{formatarMoeda(simulacaoAtual.valor_atualizado)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Parcelamento:</span>
                      <p className="font-medium text-blue-600">{formatarMoeda(simulacaoAtual.valor_total_parcelamento)}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de Parcelas *
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const novoValor = Math.max(2, quantidadeParcelas - 1);
                {/* Resultado da Simulação */}
                {simulacao && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-green-800 mb-4">Resultado da Simulação</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Valor Original:</span>
                        <p className="text-lg font-bold text-gray-800">{formatarMoeda(simulacao.valor_original)}</p>
        {/* Modal de Visualização */}
        {modalAberto === 'visualizar' && propostaSelecionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Detalhes da Proposta</h3>
                <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
              </div>
              
              <div className="space-y-6">
                {/* Informações da Proposta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento?.valor_total_parcelamento || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Valor Total</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento?.valor_entrada || 0)}
                    </div>
                    <div className="text-sm text-gray-600">Entrada</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {(propostaSelecionada as any).simulacoes_parcelamento?.quantidade_parcelas || 0}x
                    </div>
                    <div className="text-sm text-gray-600">Parcelas</div>
                  </div>
                </div>
                        ))}
                {/* Status da Proposta */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-800">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(propostaSelecionada.status_proposta)}`}>
                      {propostaSelecionada.status_proposta.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Enviado em: {formatarData(propostaSelecionada.created_at)}</p>
                    <p>Por: {propostaSelecionada.enviado_por}</p>
                    {propostaSelecionada.aceito_em && (
                      <p>Aceito em: {formatarData(propostaSelecionada.aceito_em)}</p>
                    )}
                  </div>
                </div>
                      <button
                {/* Cronograma */}
                {(propostaSelecionada as any).simulacoes_parcelamento?.parcelas && (
                  <div>
                    <h5 className="font-medium text-gray-800 mb-3">Cronograma de Parcelas:</h5>
                    <div className="max-h-40 overflow-y-auto">
                      {(propostaSelecionada as any).simulacoes_parcelamento.parcelas.map((parcela: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 border-b border-gray-200">
                          <span>Parcela {parcela.numero}</span>
                          <span>{formatarData(parcela.data_vencimento)}</span>
                          <span className="font-medium">{formatarMoeda(parcela.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}