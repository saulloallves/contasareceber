import { useState, useEffect } from "react";
import {
  Filter,
  Download,
  Eye,
  CheckCircle,
  MessageSquare,
  Calendar,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Calculator,
  Send,
  Mail,
} from "lucide-react";
import { CobrancaService } from "../services/cobrancaService";
import { TrativativasService } from "../services/tratativasService";
import { WhatsAppService } from "../services/whatsappService";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { CobrancaFranqueado } from "../types/cobranca";
import { SimulacaoParcelamento } from "../types/simulacaoParcelamento";
import { HistoricoTratativas } from "./HistoricoTratativas";

export function PainelOperacional() {
  const [cobrancas, setCobrancas] = useState<CobrancaFranqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    status: "em_aberto",
    busca: "",
    faixaAtraso: "",
    valorMin: "",
    valorMax: "",
    dataVencimentoInicio: "",
    dataVencimentoFim: "",
    uf: "",
  });
  const [ordenacao, setOrdenacao] = useState({
    campo: "dias_em_atraso",
    direcao: "desc" as "asc" | "desc",
  });
  const [paginacao, setPaginacao] = useState({
    pagina: 1,
    itensPorPagina: 20,
    total: 0,
  });
  const [cobrancaSelecionada, setCobrancaSelecionada] =
    useState<CobrancaFranqueado | null>(null);
  const [modalAberto, setModalAberto] = useState<
    "historico" | "quitacao" | "observacao" | "mensagem" | "parcelamento" | "proposta" | null
  >(null);
  const [dadosModal, setDadosModal] = useState<any>({});
  const [processando, setProcessando] = useState<string | null>(null);
  const [simulacaoAtual, setSimulacaoAtual] = useState<SimulacaoParcelamento | null>(null);
  const [formParcelamento, setFormParcelamento] = useState({
    quantidade_parcelas: 3,
    data_primeira_parcela: '',
    valor_entrada: 0
  });
  const [formProposta, setFormProposta] = useState({
    canais_envio: ['whatsapp'] as ('whatsapp' | 'email')[],
    observacoes: ''
  });

  const cobrancaService = new CobrancaService();
  const tratativasService = new TrativativasService();
  const simulacaoService = new SimulacaoParcelamentoService();
  const whatsappService = new WhatsAppService({
    token: localStorage.getItem("whatsapp_token") || "",
    phone_number_id: localStorage.getItem("whatsapp_phone_id") || "",
  });

  useEffect(() => {
    carregarCobrancas();
  }, [filtros, ordenacao, paginacao.pagina]);

  const carregarCobrancas = async () => {
    setCarregando(true);
    try {
      const dados = await cobrancaService.buscarCobrancas({
        ...filtros,
        ordenacao: `${ordenacao.campo}:${ordenacao.direcao}`,
        pagina: paginacao.pagina,
        limite: paginacao.itensPorPagina,
      });

      setCobrancas(dados.cobrancas || []);
      setPaginacao((prev) => ({ ...prev, total: dados.total || 0 }));
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
    } finally {
      setCarregando(false);
    }
  };

  const aplicarFiltros = () => {
    setPaginacao((prev) => ({ ...prev, pagina: 1 }));
    carregarCobrancas();
  };

  const limparFiltros = () => {
    setFiltros({
      status: "em_aberto",
      busca: "",
      faixaAtraso: "",
      valorMin: "",
      valorMax: "",
      dataVencimentoInicio: "",
      dataVencimentoFim: "",
      uf: "",
    });
  };

  const alterarOrdenacao = (campo: string) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "asc" ? "desc" : "asc",
    }));
  };

  const marcarComoQuitado = async () => {
    if (
      !cobrancaSelecionada ||
      !dadosModal.valorPago ||
      !dadosModal.formaPagamento
    )
      return;

    setProcessando("quitacao");
    try {
      // Atualiza status da cobrança
      await cobrancaService.atualizarCobranca(cobrancaSelecionada.id!, {
        status: "quitado",
        valor_recebido: dadosModal.valorPago,
      });

      // Registra tratativa
      await tratativasService.marcarComoQuitado(
        cobrancaSelecionada.id!,
        "usuario_atual", // Em produção, pegar do contexto
        dadosModal.valorPago,
        dadosModal.formaPagamento,
        dadosModal.observacoes
      );

      setModalAberto(null);
      setDadosModal({});
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao marcar como quitado:", error);
    } finally {
      setProcessando(null);
    }
  };

  const adicionarObservacao = async () => {
    if (!cobrancaSelecionada || !dadosModal.descricao) return;

    setProcessando("observacao");
    try {
      await tratativasService.registrarObservacao(
        cobrancaSelecionada.id!,
        "usuario_atual", // Em produção, pegar do contexto
        dadosModal.descricao,
        dadosModal.novoStatus
      );

      setModalAberto(null);
      setDadosModal({});
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao adicionar observação:", error);
    } finally {
      setProcessando(null);
    }
  };

  const reenviarMensagem = async (cobranca: CobrancaFranqueado) => {
    if (!cobranca.telefone) {
      alert("Telefone não cadastrado para este cliente");
      return;
    }

    setProcessando(`mensagem-${cobranca.id}`);
    try {
      const mensagem = gerarMensagemCobranca(cobranca);
      const resultado = await whatsappService.enviarMensagemWhatsApp(
        cobranca.telefone,
        mensagem
      );

      if (resultado.sucesso) {
        await tratativasService.registrarEnvioMensagem(
          cobranca.id!,
          mensagem,
          "sucesso"
        );
        alert("Mensagem enviada com sucesso!");
      } else {
        alert(`Erro ao enviar mensagem: ${resultado.erro}`);
      }
    } catch (error) {
      console.error("Erro ao reenviar mensagem:", error);
      alert("Erro ao enviar mensagem");
    } finally {
      setProcessando(null);
    }
  };

  const gerarMensagemCobranca = (cobranca: CobrancaFranqueado): string => {
    const valorFormatado = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cobranca.valor_atualizado || cobranca.valor_original);

    const dataVencimento = new Date(
      cobranca.data_vencimento
    ).toLocaleDateString("pt-BR");

    return `Olá, ${cobranca.cliente}!

Consta um débito da sua unidade, vencido em ${dataVencimento}.
Valor atualizado até hoje: *${valorFormatado}*

Deseja regularizar? https://calendly.com/sua-empresa/negociacao

_Esta é uma mensagem automática do sistema de cobrança._`;
  };

  const exportarResultados = async () => {
    try {
      const dados = await cobrancaService.exportarCobrancas(filtros);
      const blob = new Blob([dados], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobrancas-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao exportar:", error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "quitado":
        return "text-green-600 bg-green-100";
      case "negociando":
        return "text-yellow-600 bg-yellow-100";
      case "cobrado":
        return "text-blue-600 bg-blue-100";
      case "em_aberto":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getFaixaAtrasoCor = (dias: number) => {
    if (dias <= 30) return "text-yellow-600";
    if (dias <= 90) return "text-orange-600";
    if (dias <= 180) return "text-red-600";
    return "text-red-800";
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
              <h1 className="text-2xl font-bold text-gray-800">
                Painel Operacional de Cobrança
              </h1>
              <p className="text-gray-600">
                Gestão completa de cobranças e tratativas
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={carregarCobrancas}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
            <button
              onClick={exportarResultados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) =>
                  setFiltros({ ...filtros, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="em_aberto">Em Aberto</option>
                <option value="negociando">Negociando</option>
                <option value="cobrado">Cobrado</option>
                <option value="quitado">Quitado</option>
                <option value="novo">Novo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Busca (Cliente/CNPJ)
              </label>
              <input
                type="text"
                value={filtros.busca}
                onChange={(e) =>
                  setFiltros({ ...filtros, busca: e.target.value })
                }
                placeholder="Nome ou CNPJ"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faixa de Atraso
              </label>
              <select
                value={filtros.faixaAtraso}
                onChange={(e) =>
                  setFiltros({ ...filtros, faixaAtraso: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="0-30">0-30 dias</option>
                <option value="31-90">31-90 dias</option>
                <option value="91-180">91-180 dias</option>
                <option value="180+">180+ dias</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Mínimo
              </label>
              <input
                type="number"
                value={filtros.valorMin}
                onChange={(e) =>
                  setFiltros({ ...filtros, valorMin: e.target.value })
                }
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor Máximo
              </label>
              <input
                type="number"
                value={filtros.valorMax}
                onChange={(e) =>
                  setFiltros({ ...filtros, valorMax: e.target.value })
                }
                placeholder="R$ 999.999,99"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vencimento (Início)
              </label>
              <input
                type="date"
                value={filtros.dataVencimentoInicio}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    dataVencimentoInicio: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vencimento (Fim)
              </label>
              <input
                type="date"
                value={filtros.dataVencimentoFim}
                onChange={(e) =>
                  setFiltros({ ...filtros, dataVencimentoFim: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={aplicarFiltros}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={limparFiltros}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Tabela de Cobranças */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("cliente")}
                >
                  <div className="flex items-center">
                    Cliente
                    {ordenacao.campo === "cliente" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("cnpj")}
                >
                  <div className="flex items-center">
                    CNPJ
                    {ordenacao.campo === "cnpj" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("valor_original")}
                >
                  <div className="flex items-center">
                    Valor Original
                    {ordenacao.campo === "valor_original" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("valor_atualizado")}
                >
                  <div className="flex items-center">
                    Valor Atualizado
                    {ordenacao.campo === "valor_atualizado" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("dias_em_atraso")}
                >
                  <div className="flex items-center">
                    Dias Atraso
                    {ordenacao.campo === "dias_em_atraso" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => alterarOrdenacao("data_vencimento")}
                >
                  <div className="flex items-center">
                    Vencimento
                    {ordenacao.campo === "data_vencimento" &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="w-4 h-4 ml-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 ml-1" />
                      ))}
                  </div>
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
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                      Carregando cobranças...
                    </div>
                  </td>
                </tr>
              ) : cobrancas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              ) : (
                cobrancas.map((cobranca) => (
                  <tr key={cobranca.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {cobranca.cliente}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {cobranca.cnpj}
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
                      <div
                        className={`text-sm font-medium ${getFaixaAtrasoCor(
                          cobranca.dias_em_atraso || 0
                        )}`}
                      >
                        {cobranca.dias_em_atraso || 0} dias
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          cobranca.status
                        )}`}
                      >
                        {cobranca.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatarData(cobranca.data_vencimento)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setCobrancaSelecionada(cobranca);
                            setModalAberto("historico");
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Ver histórico"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {cobranca.status !== "quitado" && (
                          <button
                            onClick={() => {
                              setCobrancaSelecionada(cobranca);
                              setModalAberto("quitacao");
                              setDadosModal({
                                valorPago:
                                  cobranca.valor_atualizado ||
                                  cobranca.valor_original,
                              });
                            }}
                            className="text-green-600 hover:text-green-900"
                            title="Marcar como quitado"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setCobrancaSelecionada(cobranca);
                            setModalAberto("observacao");
                          }}
                          className="text-gray-600 hover:text-gray-900"
                          title="Adicionar observação"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {cobranca.telefone && (
                          <button
                            onClick={() => reenviarMensagem(cobranca)}
                            disabled={processando === `mensagem-${cobranca.id}`}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                            title="Reenviar mensagem"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() =>
                            window.open(
                              "https://calendly.com/sua-empresa/negociacao",
                              "_blank"
                            )
                          }
                          className="text-orange-600 hover:text-orange-900"
                          title="Gerar agendamento"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Mostrando {(paginacao.pagina - 1) * paginacao.itensPorPagina + 1} a{" "}
            {Math.min(
              paginacao.pagina * paginacao.itensPorPagina,
              paginacao.total
            )}{" "}
            de {paginacao.total} resultados
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() =>
                setPaginacao((prev) => ({
                  ...prev,
                  pagina: Math.max(1, prev.pagina - 1),
                }))
              }
              disabled={paginacao.pagina === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm">
              Página {paginacao.pagina} de{" "}
              {Math.ceil(paginacao.total / paginacao.itensPorPagina)}
            </span>
            <button
              onClick={() =>
                setPaginacao((prev) => ({ ...prev, pagina: prev.pagina + 1 }))
              }
              disabled={
                paginacao.pagina >=
                Math.ceil(paginacao.total / paginacao.itensPorPagina)
              }
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Histórico */}
      {modalAberto === "historico" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Histórico de Tratativas</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <HistoricoTratativas
              tituloId={cobrancaSelecionada.id}
              showAddButton={false}
            />
          </div>
        </div>
      )}

      {/* Modal de Quitação */}
      {modalAberto === "quitacao" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Marcar como Quitado</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Pago
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={dadosModal.valorPago || ""}
                  onChange={(e) =>
                    setDadosModal({
                      ...dadosModal,
                      valorPago: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={dadosModal.formaPagamento || ""}
                  onChange={(e) =>
                    setDadosModal({
                      ...dadosModal,
                      formaPagamento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={dadosModal.observacoes || ""}
                  onChange={(e) =>
                    setDadosModal({
                      ...dadosModal,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={marcarComoQuitado}
                  disabled={
                    processando === "quitacao" ||
                    !dadosModal.valorPago ||
                    !dadosModal.formaPagamento
                  }
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processando === "quitacao"
                    ? "Processando..."
                    : "Confirmar Quitação"}
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
        </div>
      )}

      {/* Modal de Observação */}
      {modalAberto === "observacao" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Adicionar Observação</h3>
              <button
                onClick={() => setModalAberto(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observação
                </label>
                <textarea
                  value={dadosModal.descricao || ""}
                  onChange={(e) =>
                    setDadosModal({ ...dadosModal, descricao: e.target.value })
                  }
                  rows={4}
                  placeholder="Descreva a interação ou observação..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alterar Status (opcional)
                </label>
                <select
                  value={dadosModal.novoStatus || ""}
                  onChange={(e) =>
                    setDadosModal({ ...dadosModal, novoStatus: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Manter status atual</option>
                  <option value="em_aberto">Em Aberto</option>
                  <option value="negociando">Negociando</option>
                  <option value="quitado">Quitado</option>
                </select>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={adicionarObservacao}
                  disabled={
                    processando === "observacao" || !dadosModal.descricao
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {processando === "observacao"
                    ? "Salvando..."
                    : "Salvar Observação"}
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
        </div>
      )}
    </div>
  );
}