/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import {
  Calculator, Send, MessageSquare, Mail, CheckCircle,
  Clock, FileText, Download, Filter, RefreshCw,
  Eye, AlertTriangle, X,
} from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { SimulacaoParcelamento as SimulacaoParcelamentoType, FiltrosSimulacao, EstatisticasParcelamento, RegistroAceite } from "../types/simulacaoParcelamento";
import { toast } from "react-hot-toast";
import { cobrancaService } from "../services/cobrancaService";
import { supabase } from "../lib/supabaseClient";
import { useUserProfile } from "../hooks/useUserProfile";

export function SimulacaoParcelamento() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    "simular" | "propostas" | "aceites"
  >("simular");
  const [propostas, setPropostas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  // Estados separados de processamento
  const [processandoSimulacao, setProcessandoSimulacao] = useState(false);
  const [processandoProposta, setProcessandoProposta] = useState(false);
  const [processandoAceite, setProcessandoAceite] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosSimulacao>({});
  const [modalAberto, setModalAberto] = useState<
    "simular" | "proposta" | "aceite" | "detalhes" | "selecionarCobranca" | null
  >(null);
  const [simulacaoAtual, setSimulacaoAtual] =
    useState<SimulacaoParcelamentoType | null>(null);
  const [propostaSelecionada, setPropostaSelecionada] = useState<any>(null);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasParcelamento | null>(null);
  const [aceites, setAceites] = useState<RegistroAceite[]>([]);
  const [carregandoAceites, setCarregandoAceites] = useState(false);

  // Autenticação/Perfil para "enviado_por"
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { profile } = useUserProfile(userId);

  useEffect(() => {
    // Captura o usuário autenticado atual
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (uid) setUserId(uid);
    })();
  }, []);

  // Form de simulação
  const [formSimulacao, setFormSimulacao] = useState({
    titulo_id: "",
    quantidade_parcelas: 3,
    data_primeira_parcela: "",
    valor_entrada: 0,
  });

  // Form de proposta
  const [formProposta, setFormProposta] = useState({
    canais_envio: ["whatsapp"] as ("whatsapp" | "email")[],
    observacoes: "",
  });

  // Form de aceite
  const [formAceite, setFormAceite] = useState({
    metodo_aceite: "whatsapp" as const,
    observacoes: "",
  });

  const simulacaoService = useMemo(() => new SimulacaoParcelamentoService(), []);

  // Estado e lógica para seleção de cobrança
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(false);
  // Paginação do modal Selecionar Cobrança
  const [paginaAtual, setPaginaAtual] = useState(1);
  const pageSize = 50;
  // Filtros do modal Selecionar Cobrança
  const [filtroNomeUnidade, setFiltroNomeUnidade] = useState("");
  const [filtroCnpjUnidade, setFiltroCnpjUnidade] = useState("");
  const [filtroCodigoUnidade, setFiltroCodigoUnidade] = useState("");
  const [filtroValorMin, setFiltroValorMin] = useState<string>("");
  const [filtroValorMax, setFiltroValorMax] = useState<string>("");
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any | null>(null);

  const carregarCobrancas = async () => {
    setCarregandoCobrancas(true);
    try {
  // Sempre que buscar novamente, volta para a primeira página
  setPaginaAtual(1);
      const filtrosServico: any = {
        apenasInadimplentes: true,
        colunaOrdenacao: "data_vencimento",
        direcaoOrdenacao: "asc",
      };
  // CNPJ: aplicar filtro local por prefixo (usuário pode digitar só o começo)
      if (filtroValorMin.trim()) filtrosServico.valorMin = parseFloat(filtroValorMin);
      if (filtroValorMax.trim()) filtrosServico.valorMax = parseFloat(filtroValorMax);

      let lista = await cobrancaService.buscarCobrancas(filtrosServico);

      // Filtros locais por nome e código da unidade
      if (filtroCnpjUnidade.trim()) {
        const termoCnpj = filtroCnpjUnidade.replace(/\D/g, "");
        lista = lista.filter((c: any) =>
          (c.cnpj || "").replace(/\D/g, "").startsWith(termoCnpj)
        );
      }
      if (filtroNomeUnidade.trim()) {
        const termo = filtroNomeUnidade.toLowerCase();
        lista = lista.filter((c: any) =>
          (c.unidades_franqueadas?.nome_unidade || c.cliente || "")
            .toLowerCase()
            .includes(termo)
        );
      }
      if (filtroCodigoUnidade.trim()) {
        const termoCod = filtroCodigoUnidade.toLowerCase();
        lista = lista.filter((c: any) =>
          (c.unidades_franqueadas?.codigo_unidade || "")
            .toLowerCase()
            .includes(termoCod)
        );
      }

      // Mantém todas as cobranças filtradas em memória; exibimos 50 por página
      setCobrancas(lista);
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
      toast.error("Erro ao carregar cobranças");
    } finally {
      setCarregandoCobrancas(false);
    }
  };

  // Garante que a página atual seja válida quando o total de itens mudar
  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(cobrancas.length / pageSize));
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [cobrancas]);

  useEffect(() => {
    if (modalAberto === "selecionarCobranca") {
      carregarCobrancas();
    }
  }, [modalAberto]);

  useEffect(() => {
    if (abaSelecionada === "propostas") {
      carregarPropostas();
    }
    if (abaSelecionada === "aceites") {
      carregarAceites();
    }
    carregarEstatisticas();
  }, [abaSelecionada, filtros]);

  const carregarPropostas = async () => {
    setCarregando(true);
    try {
      const dados = await simulacaoService.buscarPropostas(filtros);
      setPropostas(dados);
    } catch (error) {
  console.error("Erro ao carregar propostas:", error);
  toast.error("Erro ao carregar propostas");
    } finally {
      setCarregando(false);
    }
  };

  const carregarEstatisticas = async () => {
    try {
      const stats = await simulacaoService.buscarEstatisticas();
      setEstatisticas(stats);
    } catch (error) {
  console.error("Erro ao carregar estatísticas:", error);
  toast.error("Erro ao carregar estatísticas");
    }
  };

  const carregarAceites = async () => {
    setCarregandoAceites(true);
    try {
      const dados = await simulacaoService.buscarAceites();
      setAceites(dados);
    } catch (error) {
      console.error("Erro ao carregar aceites:", error);
      toast.error("Erro ao carregar aceites");
    } finally {
      setCarregandoAceites(false);
    }
  };

  const simularParcelamento = async () => {
    if (!formSimulacao.titulo_id || !formSimulacao.data_primeira_parcela) {
      toast.error("ID do título e data da primeira parcela são obrigatórios");
      return;
    }

    setProcessandoSimulacao(true);
    try {
      const simulacao = await simulacaoService.simularParcelamento(
        formSimulacao.titulo_id,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );

      setSimulacaoAtual(simulacao);
    } catch (error) {
      toast.error(
        `Erro na simulação: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setProcessandoSimulacao(false);
    }
  };

  const gerarProposta = async () => {
    if (!simulacaoAtual) return;

  setProcessandoProposta(true);
    try {
      // Salva simulação primeiro
      const simulacaoId = await simulacaoService.salvarSimulacao(
        simulacaoAtual
      );

      // Gera proposta
      const proposta = await simulacaoService.gerarProposta(
        simulacaoId,
        formProposta.canais_envio,
    (profile?.nome_completo || profile?.email || "Usuário")
      );

      // Envia pelos canais selecionados
      const resultados = [];

      if (formProposta.canais_envio.includes("whatsapp")) {
        const sucessoWhatsApp = await simulacaoService.enviarPropostaWhatsApp(
          proposta.id!
        );
        resultados.push(`WhatsApp: ${sucessoWhatsApp ? "Enviado" : "Falha"}`);
      }

      if (formProposta.canais_envio.includes("email")) {
        const sucessoEmail = await simulacaoService.enviarPropostaEmail(
          proposta.id!
        );
        resultados.push(`Email: ${sucessoEmail ? "Enviado" : "Falha"}`);
      }

  toast.success(`Proposta gerada e enviada!\n${resultados.join("\n")}`);

      setModalAberto(null);
      setSimulacaoAtual(null);
      setFormSimulacao({
        titulo_id: "",
        quantidade_parcelas: 3,
        data_primeira_parcela: "",
        valor_entrada: 0,
      });
      // Alterna para a aba de propostas e atualiza a lista e as estatísticas imediatamente
      setAbaSelecionada("propostas");
      await carregarPropostas();
      await carregarEstatisticas();
    } catch (error) {
  toast.error(`Erro ao gerar proposta: ${String(error)}`);
    } finally {
  setProcessandoProposta(false);
    }
  };

  const registrarAceite = async () => {
    if (!propostaSelecionada) return;

    setProcessandoAceite(true);
    try {
      await simulacaoService.registrarAceite(
        propostaSelecionada.id,
        formAceite.metodo_aceite,
        "unknown_ip", // TODO: capturar IP real no backend
        navigator.userAgent,
        formAceite.observacoes
      );

      toast.success("Aceite registrado com sucesso!");
      setModalAberto(null);
      setPropostaSelecionada(null);
  // Atualiza propostas, estatísticas e a lista de aceites e alterna para a aba de aceites
  await carregarPropostas();
  await carregarEstatisticas();
  await carregarAceites();
  setAbaSelecionada("aceites");
    } catch (error) {
      toast.error(`Erro ao registrar aceite: ${String(error)}`);
    } finally {
      setProcessandoAceite(false);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await simulacaoService.exportarPropostas(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `propostas-parcelamento-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
  toast.success("Exportação iniciada");
    } catch (error) {
  toast.error(`Erro ao exportar dados: ${String(error)}`);
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "enviada":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "aceita":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "recusada":
        return <X className="w-5 h-5 text-red-600" />;
      case "expirada":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
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
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Calculator className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Simulação de Parcelamento
              </h1>
              <p className="text-gray-600">
                Geração automática de propostas com envio via WhatsApp/Email
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#6b3a10] transition-colors duration-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
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
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.propostas_enviadas}
              </div>
              <div className="text-sm text-purple-800">Propostas Enviadas</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.propostas_aceitas}
              </div>
              <div className="text-sm text-green-800">Propostas Aceitas</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.taxa_conversao.toFixed(1)}%
              </div>
              <div className="text-sm text-yellow-800">Taxa Conversão</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatarMoeda(estatisticas.valor_total_parcelado)}
              </div>
              <div className="text-sm text-orange-800">Valor Parcelado</div>
            </div>
          </div>
        )}

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "simular", label: "Simulador", icon: Calculator },
              { id: "propostas", label: "Propostas Enviadas", icon: Send },
              {
                id: "aceites",
                label: "Aceites Registrados",
                icon: CheckCircle,
              },
            ].map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
        {abaSelecionada === "simular" && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">
              Simulador de Parcelamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID do Título (Cobrança) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formSimulacao.titulo_id}
                      onChange={(e) => {
                        setFormSimulacao({
                          ...formSimulacao,
                          titulo_id: e.target.value,
                        });
                        setCobrancaSelecionada(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="UUID da cobrança"
                    />
                    <button
                      type="button"
                      onClick={() => setModalAberto("selecionarCobranca")}
                      className="px-3 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#6b3a10] transition-colors duration-300 "
                    >
                      Selecionar
                    </button>
                  </div>
                  {cobrancaSelecionada && (
                    <div className="mt-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
                      <div><span className="font-medium">Unidade:</span> {cobrancaSelecionada.unidades_franqueadas?.nome_unidade || cobrancaSelecionada.cliente}</div>
                      <div><span className="font-medium">CNPJ:</span> {cobrancaSelecionada.cnpj}</div>
                      <div className="flex gap-4"><span className="font-medium">Valor:</span> {formatarMoeda(cobrancaSelecionada.valor_atualizado || cobrancaSelecionada.valor_original)} <span className="font-medium">Venc.:</span> {formatarData(cobrancaSelecionada.data_vencimento)}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade de Parcelas
                  </label>
                  <select
                    value={formSimulacao.quantidade_parcelas}
                    onChange={(e) =>
                      setFormSimulacao({
                        ...formSimulacao,
                        quantidade_parcelas: parseInt(e.target.value),
                      })
                    }
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
                    Valor de Entrada (opcional)
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
                    placeholder="0,00"
                  />
                </div>

                <button
                  onClick={simularParcelamento}
                  disabled={processandoSimulacao}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processandoSimulacao ? "Simulando..." : "Simular Parcelamento"}
                </button>
              </div>

              {/* Resultado da Simulação */}
              {simulacaoAtual && (
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">
                    Resultado da Simulação
                  </h4>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between">
                      <span>Valor Original:</span>
                      <span className="font-medium">
                        {formatarMoeda(simulacaoAtual.valor_original)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor Atualizado:</span>
                      <span className="font-medium text-red-600">
                        {formatarMoeda(simulacaoAtual.valor_atualizado)}
                      </span>
                    </div>
                    {simulacaoAtual.valor_entrada && (
                      <div className="flex justify-between">
                        <span>Entrada:</span>
                        <span className="font-medium text-green-600">
                          {formatarMoeda(simulacaoAtual.valor_entrada)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Parcelas:</span>
                      <span className="font-medium">
                        {simulacaoAtual.quantidade_parcelas}x{" "}
                        {formatarMoeda(simulacaoAtual.parcelas?.[0]?.valor || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Multa:</span>
                      <span className="font-medium">
                        10% ({formatarMoeda(simulacaoAtual.parcelas?.[0]?.multa || 0)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Juros Mora:</span>
                      <span className="font-medium">
                        {simulacaoAtual.percentual_juros_mora}% ({formatarMoeda(simulacaoAtual.parcelas?.[0]?.juros_mora || 0)})
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-blue-600">
                        {formatarMoeda(simulacaoAtual.valor_total_parcelamento)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h5 className="font-medium mb-2">Cronograma:</h5>
                    {simulacaoAtual.parcelas.map((parcela, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          Parcela {parcela.numero} (
                          {formatarData(parcela.data_vencimento)}):
                        </span>
                        <span>{formatarMoeda(parcela.valor)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Canais de envio */}
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Canais de envio</h5>
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          id="whatsapp-card"
                          checked={formProposta.canais_envio.includes("whatsapp")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormProposta({
                                ...formProposta,
                                canais_envio: [...formProposta.canais_envio, "whatsapp"],
                              });
                            } else {
                              setFormProposta({
                                ...formProposta,
                                canais_envio: formProposta.canais_envio.filter((c) => c !== "whatsapp"),
                              });
                            }
                          }}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="flex items-center">
                          <MessageSquare className="w-4 h-4 mr-1 text-green-600" />
                          WhatsApp
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          id="email-card"
                          checked={formProposta.canais_envio.includes("email")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormProposta({
                                ...formProposta,
                                canais_envio: [...formProposta.canais_envio, "email"],
                              });
                            } else {
                              setFormProposta({
                                ...formProposta,
                                canais_envio: formProposta.canais_envio.filter((c) => c !== "email"),
                              });
                            }
                          }}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="flex items-center">
                          <Mail className="w-4 h-4 mr-1 text-blue-600" />
                          Email
                        </span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={gerarProposta}
                    disabled={processandoProposta || formProposta.canais_envio.length === 0}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-300"
                  >
                    {processandoProposta ? "Gerando..." : "Gerar e Enviar Proposta"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {abaSelecionada === "propostas" && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  type="text"
                  value={filtros.cnpj || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, cnpj: e.target.value })
                  }
                  placeholder="CNPJ"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />

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

            {/* Lista de Propostas */}
            <div className="space-y-4">
              {carregando ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
                  <p className="text-gray-600">Carregando propostas...</p>
                </div>
              ) : propostas.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhuma proposta encontrada</p>
                </div>
              ) : (
                propostas.map((proposta) => (
                  <div
                    key={proposta.id}
                    className="border border-gray-200 rounded-lg p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {(proposta as any).cobrancas_franqueados
                            ?.unidades_franqueadas?.nome_franqueado ||
                            "Cliente"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          CNPJ: {proposta.cnpj_unidade}
                        </p>
                        <p className="text-sm text-gray-600">
                          {
                            (proposta as any).simulacoes_parcelamento
                              ?.quantidade_parcelas
                          }
                          x de{" "}
                          {formatarMoeda(
                            (proposta as any).simulacoes_parcelamento
                              ?.parcelas?.[0]?.valor || 0
                          )}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(proposta.status_proposta)}
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                            proposta.status_proposta
                          )}`}
                        >
                          {proposta.status_proposta.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Enviado em:</span>{" "}
                        {formatarData(proposta.created_at)}
                      </div>
                      <div>
                        <span className="font-medium">Por:</span>{" "}
                        {proposta.enviado_por}
                      </div>
                      <div>
                        <span className="font-medium">Canais:</span>{" "}
                        {proposta.canais_envio.join(", ")}
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setPropostaSelecionada(proposta);
                          setModalAberto("aceite");
                        }}
                        disabled={proposta.status_proposta !== "enviada"}
                        className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Registrar Aceite
                      </button>
                      <button
                        onClick={() => {
                          setPropostaSelecionada(proposta);
                          setModalAberto("detalhes");
                        }}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalhes
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {abaSelecionada === "aceites" && (
          <div className="space-y-6">
            <div className="flex items-center mb-2">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">Aceites Registrados</h3>
            </div>

            {carregandoAceites ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
                <p className="text-gray-600">Carregando aceites...</p>
              </div>
            ) : aceites.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum aceite registrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aceites.map((a) => (
                  <div key={a.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm text-gray-600">CNPJ</p>
                        <h4 className="text-base font-semibold text-gray-800">{a.cnpj_unidade}</h4>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                        {a.metodo_aceite}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                      <div>
                        <span className="font-medium">Data do aceite:</span> {new Date(a.data_aceite).toLocaleString("pt-BR")}
                      </div>
                      <div>
                        <span className="font-medium">Proposta ID:</span> {a.proposta_id}
                      </div>
                      <div>
                        <span className="font-medium">Título ID:</span> {a.titulo_id}
                      </div>
                    </div>
                    {a.observacoes && (
                      <p className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Observações:</span> {a.observacoes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Proposta */}
      {modalAberto === "proposta" && simulacaoAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Gerar Proposta de Parcelamento
              </h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Resumo da Simulação (igual ao modal da Gestão de Cobranças) */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">
                  Resultado da Simulação
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Valor Original:</span>
                    <span className="font-medium">{formatarMoeda(simulacaoAtual.valor_original)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor Atualizado:</span>
                    <span className="font-medium text-red-600">{formatarMoeda(simulacaoAtual.valor_atualizado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parcelas:</span>
                    <span className="font-medium">{simulacaoAtual.quantidade_parcelas}x {formatarMoeda(simulacaoAtual.parcelas?.[0]?.valor || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multa:</span>
                    <span className="font-medium">10% ({formatarMoeda(simulacaoAtual.parcelas?.[0]?.multa || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Juros Mora:</span>
                    <span className="font-medium">{simulacaoAtual.percentual_juros_mora}% ({formatarMoeda(simulacaoAtual.parcelas?.[0]?.juros_mora || 0)})</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-blue-600">{formatarMoeda(simulacaoAtual.valor_total_parcelamento)}</span>
                  </div>
                </div>

                {/* Cronograma */}
                <div className="bg-white border rounded-lg p-3 mt-3">
                  <h5 className="font-medium mb-2">Cronograma:</h5>
                  <div className="space-y-1 text-sm">
                    {simulacaoAtual.parcelas.map((parcela, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          Parcela {parcela.numero} ({formatarData(parcela.data_vencimento)}):
                        </span>
                        <span>{formatarMoeda(parcela.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canais de envio */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canais de envio
                  </label>
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        id="whatsapp"
                        checked={formProposta.canais_envio.includes("whatsapp")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormProposta({
                              ...formProposta,
                              canais_envio: [...formProposta.canais_envio, "whatsapp"],
                            });
                          } else {
                            setFormProposta({
                              ...formProposta,
                              canais_envio: formProposta.canais_envio.filter((c) => c !== "whatsapp"),
                            });
                          }
                        }}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="flex items-center">
                        <MessageSquare className="w-4 h-4 mr-1 text-green-600" />
                        WhatsApp
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        id="email"
                        checked={formProposta.canais_envio.includes("email")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormProposta({
                              ...formProposta,
                              canais_envio: [...formProposta.canais_envio, "email"],
                            });
                          } else {
                            setFormProposta({
                              ...formProposta,
                              canais_envio: formProposta.canais_envio.filter((c) => c !== "email"),
                            });
                          }
                        }}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="flex items-center">
                        <Mail className="w-4 h-4 mr-1 text-blue-600" />
                        Email
                      </span>
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
                  onChange={(e) =>
                    setFormProposta({
                      ...formProposta,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Observações adicionais para a proposta..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={gerarProposta}
                disabled={processandoProposta || formProposta.canais_envio.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processandoProposta ? "Gerando..." : "Gerar e Enviar Proposta"}
              </button>
              <button
                onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalAberto === "detalhes" && propostaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes da Proposta</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-6">
              {/* Informações da Proposta */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3">Informações da Proposta</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Cliente:</span> {(propostaSelecionada as any).cobrancas_franqueados?.unidades_franqueadas?.nome_franqueado || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">CNPJ:</span> {propostaSelecionada.cnpj_unidade}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(propostaSelecionada.status_proposta)}`}>
                      {propostaSelecionada.status_proposta.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Enviado por:</span> {propostaSelecionada.enviado_por}
                  </div>
                  <div>
                    <span className="font-medium">Data de Envio:</span> {formatarData(propostaSelecionada.created_at)}
                  </div>
                  <div>
                    <span className="font-medium">Canais:</span> {propostaSelecionada.canais_envio.join(', ')}
                  </div>
                  <div>
                    <span className="font-medium">Válida até:</span> {formatarData(propostaSelecionada.data_expiracao)}
                  </div>
                  {propostaSelecionada.aceito_em && (
                    <div>
                      <span className="font-medium">Aceita em:</span> {formatarData(propostaSelecionada.aceito_em)}
                    </div>
                  )}
                </div>
              </div>

              {/* Dados do Parcelamento */}
              {(propostaSelecionada as any).simulacoes_parcelamento && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-3">Dados do Parcelamento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Valor Original:</span> {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento.valor_original)}
                    </div>
                    <div>
                      <span className="font-medium">Valor Atualizado:</span> {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento.valor_atualizado)}
                    </div>
                    <div>
                      <span className="font-medium">Quantidade de Parcelas:</span> {(propostaSelecionada as any).simulacoes_parcelamento.quantidade_parcelas}x
                    </div>
                    <div>
                      <span className="font-medium">Valor por Parcela:</span> {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento.parcelas?.[0]?.valor || 0)}
                    </div>
                    <div>
                      <span className="font-medium">Multa:</span> 10% ({formatarMoeda(((propostaSelecionada as any).simulacoes_parcelamento.parcelas?.[0]?.multa || 0))})
                    </div>
                    <div>
                      <span className="font-medium">Juros Mora:</span> 1.5% ({formatarMoeda(((propostaSelecionada as any).simulacoes_parcelamento.parcelas?.[0]?.juros_mora || 0))})
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Valor Total:</span> 
                      <span className="text-lg font-bold text-green-600 ml-2">
                        {formatarMoeda((propostaSelecionada as any).simulacoes_parcelamento.valor_total_parcelamento)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cronograma de Parcelas */}
              {(propostaSelecionada as any).simulacoes_parcelamento?.parcelas && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Cronograma de Parcelas</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parcela</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Multa</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Juros Mora</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(propostaSelecionada as any).simulacoes_parcelamento.parcelas.map((parcela: any, index: number) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{parcela.numero}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatarMoeda(parcela.valor)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{formatarData(parcela.data_vencimento)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{formatarMoeda(parcela.multa)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{formatarMoeda(parcela.juros_mora)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Mensagem Enviada */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-3">Mensagem Enviada ao Cliente</h4>
                <div className="bg-white border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {propostaSelecionada.mensagem_proposta}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aceite */}
      {modalAberto === "aceite" && propostaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Registrar Aceite da Proposta
              </h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">Proposta:</h4>
                <div className="text-sm text-green-700">
                  <p>
                    Cliente:{" "}
                    {
                      (propostaSelecionada as any).cobrancas_franqueados
                        ?.unidades_franqueadas?.nome_franqueado
                    }
                  </p>
                  <p>
                    Parcelas:{" "}
                    {
                      (propostaSelecionada as any).simulacoes_parcelamento
                        ?.quantidade_parcelas
                    }
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Aceite
                </label>
                <select
                  value={formAceite.metodo_aceite}
                  onChange={(e) =>
                    setFormAceite({
                      ...formAceite,
                      metodo_aceite: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="telefone">Telefone</option>
                  <option value="painel">Painel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações do Aceite
                </label>
                <textarea
                  value={formAceite.observacoes}
                  onChange={(e) =>
                    setFormAceite({
                      ...formAceite,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Como foi confirmado o aceite..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={registrarAceite}
                disabled={processandoAceite}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processandoAceite ? "Registrando..." : "Confirmar Aceite"}
              </button>
              <button
                onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Selecionar Cobrança */}
      {modalAberto === "selecionarCobranca" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Selecionar Cobrança</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <input
                type="text"
                value={filtroNomeUnidade}
                onChange={(e) => setFiltroNomeUnidade(e.target.value)}
                placeholder="Nome da unidade"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                value={filtroCnpjUnidade}
                onChange={(e) => setFiltroCnpjUnidade(e.target.value)}
                placeholder="CNPJ da unidade"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <input
                type="text"
                value={filtroCodigoUnidade}
                onChange={(e) => setFiltroCodigoUnidade(e.target.value)}
                placeholder="Código da unidade"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={filtroValorMin}
                  onChange={(e) => setFiltroValorMin(e.target.value)}
                  placeholder="Valor mín."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  value={filtroValorMax}
                  onChange={(e) => setFiltroValorMax(e.target.value)}
                  placeholder="Valor máx."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={carregarCobrancas}
                className="px-4 py-2 bg-[#6b3a10] text-white rounded-lg hover:bg-[#a35919] transition-colors duration-200"
              >
                Buscar
              </button>
              <button
                onClick={() => {
                  setFiltroNomeUnidade("");
                  setFiltroCnpjUnidade("");
                  setFiltroCodigoUnidade("");
                  setFiltroValorMin("");
                  setFiltroValorMax("");
                  carregarCobrancas();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Resetar
              </button>
            </div>

            {/* Controles de paginação (topo) */}
            {cobrancas.length > 0 && (
              <div className="flex items-center justify-between mb-3 text-sm text-gray-700">
                {(() => {
                  const total = cobrancas.length;
                  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
                  const inicio = (paginaAtual - 1) * pageSize + 1;
                  const fim = Math.min(paginaAtual * pageSize, total);
                  return (
                    <>
                      <div>
                        Mostrando {inicio}–{fim} de {total}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span>
                          Página {paginaAtual} de {totalPaginas}
                        </span>
                        <button
                          onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Próxima
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {carregandoCobrancas ? (
              <div className="text-center py-6">
                <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" />
                <p className="text-gray-600">Carregando cobranças...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cobrancas.length === 0 ? (
                  <div className="text-center py-6 text-gray-600">Nenhuma cobrança encontrada</div>
                ) : (
                  // Fatia da página atual com 50 itens
                  cobrancas
                    .slice((paginaAtual - 1) * pageSize, (paginaAtual - 1) * pageSize + pageSize)
                    .map((c) => (
                    <div key={c.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        <div className="font-medium text-gray-900">
                          {c.unidades_franqueadas?.nome_unidade || c.cliente}
                        </div>
                        <div className="text-gray-600">CNPJ: {c.cnpj}</div>
                        <div className="flex gap-4">
                          <span>Valor: <span className="font-medium">{formatarMoeda(c.valor_atualizado || c.valor_original)}</span></span>
                          <span>Venc.: <span className="font-medium">{formatarData(c.data_vencimento)}</span></span>
                          <span>Status: <span className="font-medium capitalize">{c.status}</span></span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setCobrancaSelecionada(c);
                          setFormSimulacao((prev) => ({ ...prev, titulo_id: c.id }));
                          setModalAberto(null);
                          toast.success("Cobrança selecionada");
                        }}
                        className="px-3 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#ffc31a] transition-colors duration-200"
                      >
                        Selecionar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Controles de paginação (rodapé) */}
            {cobrancas.length > 0 && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-700">
                {(() => {
                  const total = cobrancas.length;
                  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
                  const inicio = (paginaAtual - 1) * pageSize + 1;
                  const fim = Math.min(paginaAtual * pageSize, total);
                  return (
                    <>
                      <div>
                        Mostrando {inicio}–{fim} de {total}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Anterior
                        </button>
                        <span>
                          Página {paginaAtual} de {totalPaginas}
                        </span>
                        <button
                          onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Próxima
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
