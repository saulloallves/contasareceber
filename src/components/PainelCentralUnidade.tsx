import { useState } from "react";
import {
  Building2,
  DollarSign,
  Calendar,
  MessageSquare,
  Users,
  Edit,
  Save,
  Plus,
  Download,
  TrendingUp,
  Search,
  Send,
  Bell,
  Scale,
  RefreshCw,
} from "lucide-react";
import { UnidadeCentralService } from "../services/unidadeCentralService";
import {
  UnidadeCentral,
  CobrancaUnidade,
  ReuniaoUnidade,
  ComunicacaoUnidade,
  DashboardUnidade,
  VinculoFranqueado,
  FiltrosUnidadeCentral,
} from "../types/unidadeCentral";

export function PainelCentralUnidade() {
  const [codigoUnidade, setCodigoUnidade] = useState("");
  const [dadosUnidade, setDadosUnidade] = useState<{
    unidade: UnidadeCentral;
    cobrancas: CobrancaUnidade[];
    reunioes: ReuniaoUnidade[];
    comunicacoes: ComunicacaoUnidade[];
    dashboard: DashboardUnidade;
    vinculos: VinculoFranqueado;
  } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState<
    "dados" | "cobrancas" | "agenda" | "comunicacoes" | "dashboard" | "vinculos"
  >("dados");
  const [editandoDados, setEditandoDados] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState<Partial<UnidadeCentral>>({});
  const [modalAberto, setModalAberto] = useState<
    "reuniao" | "mensagem" | "notificacao" | "escalonamento" | null
  >(null);
  const [formData, setFormData] = useState<any>({});
  const [filtros, setFiltros] = useState<FiltrosUnidadeCentral>({});
  const [processando, setProcessando] = useState(false);

  const unidadeCentralService = new UnidadeCentralService();

  const buscarUnidade = async () => {
    if (!codigoUnidade.trim()) {
      alert("Digite o código da unidade");
      return;
    }

    setCarregando(true);
    try {
      const dados = await unidadeCentralService.buscarUnidadeCompleta(
        codigoUnidade
      );
      if (dados) {
        setDadosUnidade(dados);
        setDadosEdicao(dados.unidade);
      } else {
        alert("Unidade não encontrada");
      }
    } catch (error) {
      alert(`Erro ao buscar unidade: ${error}`);
    } finally {
      setCarregando(false);
    }
  };

  const salvarDadosCadastrais = async () => {
    if (!dadosUnidade) return;

    setProcessando(true);
    try {
      await unidadeCentralService.atualizarDadosCadastrais(
        dadosUnidade.unidade.codigo_unidade,
        dadosEdicao
      );
      setEditandoDados(false);
      buscarUnidade(); // Recarrega dados
    } catch (error) {
      alert(`Erro ao salvar dados: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const abrirModalReuniao = () => {
    setFormData({
      data_hora: "",
      participantes: "usuario_atual",
      observacoes: "",
    });
    setModalAberto("reuniao");
  };

  const abrirModalMensagem = () => {
    setFormData({
      tipo: "whatsapp",
      conteudo: "",
    });
    setModalAberto("mensagem");
  };

  const abrirModalNotificacao = () => {
    setFormData({
      tipo_notificacao: "notificacao_inadimplencia",
      observacoes: "",
    });
    setModalAberto("notificacao");
  };

  const abrirModalEscalonamento = () => {
    setFormData({
      motivo: "",
      valor_envolvido: dadosUnidade?.dashboard.total_em_aberto || 0,
    });
    setModalAberto("escalonamento");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setFormData({});
  };

  const executarAcao = async () => {
    if (!dadosUnidade) return;

    setProcessando(true);
    try {
      switch (modalAberto) {
        case "reuniao":
          await unidadeCentralService.agendarReuniao(
            dadosUnidade.unidade.codigo_unidade,
            formData.data_hora,
            formData.participantes,
            formData.observacoes
          );
          break;
        case "mensagem":
          await unidadeCentralService.enviarMensagemPersonalizada(
            dadosUnidade.unidade.codigo_unidade,
            formData.tipo,
            formData.conteudo
          );
          break;
        case "notificacao":
          await unidadeCentralService.gerarNotificacaoFormal(
            dadosUnidade.unidade.codigo_unidade,
            formData.tipo_notificacao,
            formData.observacoes
          );
          break;
        case "escalonamento":
          await unidadeCentralService.escalarParaJuridico(
            dadosUnidade.unidade.codigo_unidade,
            formData.motivo,
            formData.valor_envolvido
          );
          break;
      }

      fecharModal();
      buscarUnidade(); // Recarrega dados
    } catch (error) {
      alert(`Erro ao executar ação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const exportarDados = async () => {
    if (!dadosUnidade) return;

    try {
      const blob = await unidadeCentralService.exportarDadosUnidade(
        dadosUnidade.unidade.codigo_unidade
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unidade-${dadosUnidade.unidade.codigo_unidade}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Erro ao exportar dados");
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pago":
        return "bg-green-100 text-green-800";
      case "acordo":
        return "bg-blue-100 text-blue-800";
      case "negociacao":
        return "bg-yellow-100 text-yellow-800";
      case "em_aberto":
        return "bg-red-100 text-red-800";
      case "escalonado":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "royalty":
        return "bg-blue-100 text-blue-800";
      case "insumo":
        return "bg-green-100 text-green-800";
      case "taxa_marketing":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header de Busca */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Painel Central da Unidade
              </h1>
              <p className="text-gray-600">
                Visão 360° completa da unidade franqueada
              </p>
            </div>
          </div>

          {dadosUnidade && (
            <div className="flex space-x-3">
              <button
                onClick={exportarDados}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
              <button
                onClick={buscarUnidade}
                disabled={carregando}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
                />
                Atualizar
              </button>
            </div>
          )}
        </div>

        {/* Busca da Unidade */}
        {!dadosUnidade && (
          <div className="max-w-md mx-auto text-center">
            <div className="mb-6">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Buscar Unidade
              </h2>
              <p className="text-gray-600">
                Digite o código da unidade para visualizar informações completas
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={codigoUnidade}
                onChange={(e) => setCodigoUnidade(e.target.value)}
                placeholder="Ex: 0137, 4123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-lg"
              />
              <button
                onClick={buscarUnidade}
                disabled={carregando || !codigoUnidade.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {carregando ? "Buscando..." : "Buscar Unidade"}
              </button>
            </div>
          </div>
        )}

        {/* Dados da Unidade */}
        {dadosUnidade && (
          <div>
            {/* Header da Unidade */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    {dadosUnidade.unidade.nome_unidade}
                  </h2>
                  <p className="text-gray-600">
                    Código: {dadosUnidade.unidade.codigo_unidade} | CNPJ:{" "}
                    {dadosUnidade.unidade.cnpj}
                  </p>
                  <p className="text-gray-600">
                    Franqueado:{" "}
                    {dadosUnidade.unidade.nome_franqueado_responsavel}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">
                    {formatarMoeda(dadosUnidade.dashboard.total_em_aberto)}
                  </div>
                  <div className="text-sm text-gray-600">Total em Aberto</div>
                </div>
              </div>
            </div>

            {/* Navegação por Abas */}
            <div className="border-b border-gray-200 mb-8">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: "dados", label: "Dados Cadastrais", icon: Building2 },
                  { id: "cobrancas", label: "Cobranças", icon: DollarSign },
                  { id: "agenda", label: "Agenda", icon: Calendar },
                  {
                    id: "comunicacoes",
                    label: "Comunicações",
                    icon: MessageSquare,
                  },
                  { id: "dashboard", label: "Dashboard", icon: TrendingUp },
                  { id: "vinculos", label: "Vínculos", icon: Users },
                ].map((aba) => {
                  const Icon = aba.icon;
                  return (
                    <button
                      key={aba.id}
                      onClick={() => setAbaSelecionada(aba.id as any)}
                      className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                        abaSelecionada === aba.id
                          ? "border-blue-500 text-blue-600"
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

            {/* Conteúdo das Abas */}
            {abaSelecionada === "dados" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Dados Cadastrais
                  </h3>
                  <button
                    onClick={() =>
                      editandoDados
                        ? salvarDadosCadastrais()
                        : setEditandoDados(true)
                    }
                    disabled={processando}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editandoDados ? (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {processando ? "Salvando..." : "Salvar"}
                      </>
                    ) : (
                      <>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome da Unidade
                    </label>
                    <input
                      type="text"
                      value={dadosEdicao.nome_unidade || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          nome_unidade: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código Oficial
                    </label>
                    <input
                      type="text"
                      value={dadosEdicao.codigo_oficial_franquia || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          codigo_oficial_franquia: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={dadosEdicao.razao_social || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          razao_social: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Franqueado Responsável
                    </label>
                    <input
                      type="text"
                      value={dadosEdicao.nome_franqueado_responsavel || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          nome_franqueado_responsavel: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Comercial
                    </label>
                    <input
                      type="tel"
                      value={dadosEdicao.whatsapp_comercial || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          whatsapp_comercial: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail Comercial
                    </label>
                    <input
                      type="email"
                      value={dadosEdicao.email_comercial || ""}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          email_comercial: e.target.value,
                        })
                      }
                      disabled={!editandoDados}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço Completo
                  </label>
                  <textarea
                    value={dadosEdicao.endereco_completo || ""}
                    onChange={(e) =>
                      setDadosEdicao({
                        ...dadosEdicao,
                        endereco_completo: e.target.value,
                      })
                    }
                    disabled={!editandoDados}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </div>

                {editandoDados && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setEditandoDados(false);
                        setDadosEdicao(dadosUnidade.unidade);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}

            {abaSelecionada === "cobrancas" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Cobranças da Unidade
                  </h3>
                  <div className="flex space-x-3">
                    <select
                      value={filtros.status_cobranca || ""}
                      onChange={(e) =>
                        setFiltros({
                          ...filtros,
                          status_cobranca: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos os Status</option>
                      <option value="em_aberto">Em Aberto</option>
                      <option value="pago">Pago</option>
                      <option value="acordo">Acordo</option>
                      <option value="negociacao">Negociação</option>
                      <option value="escalonado">Escalonado</option>
                    </select>
                    <select
                      value={filtros.tipo_cobranca || ""}
                      onChange={(e) =>
                        setFiltros({
                          ...filtros,
                          tipo_cobranca: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Todos os Tipos</option>
                      <option value="royalty">Royalty</option>
                      <option value="insumo">Insumo</option>
                      <option value="taxa_marketing">Taxa Marketing</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vencimento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor Original
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor Atualizado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Atraso
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dadosUnidade.cobrancas.map((cobranca) => (
                        <tr key={cobranca.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(
                              cobranca.data_vencimento
                            ).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoColor(
                                cobranca.tipo
                              )}`}
                            >
                              {cobranca.tipo.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatarMoeda(cobranca.valor_original)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            {formatarMoeda(cobranca.valor_atualizado)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cobranca.dias_atraso} dias
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                cobranca.status
                              )}`}
                            >
                              {cobranca.status.replace("_", " ").toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaSelecionada === "agenda" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Agenda e Reuniões
                  </h3>
                  <button
                    onClick={abrirModalReuniao}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agendar Reunião
                  </button>
                </div>

                <div className="space-y-4">
                  {dadosUnidade.reunioes.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Nenhuma reunião agendada</p>
                    </div>
                  ) : (
                    dadosUnidade.reunioes.map((reuniao) => (
                      <div
                        key={reuniao.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                            <span className="font-medium text-gray-800">
                              {formatarData(reuniao.data_hora)}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              reuniao.status
                            )}`}
                          >
                            {reuniao.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Participantes:</strong>{" "}
                          {reuniao.participantes}
                        </p>
                        {reuniao.acoes_realizadas && (
                          <p className="text-sm text-gray-700">
                            <strong>Ações:</strong> {reuniao.acoes_realizadas}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {abaSelecionada === "comunicacoes" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Comunicações
                  </h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={abrirModalMensagem}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Mensagem
                    </button>
                    <button
                      onClick={abrirModalNotificacao}
                      className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      Notificação Formal
                    </button>
                    <button
                      onClick={abrirModalEscalonamento}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <Scale className="w-4 h-4 mr-2" />
                      Escalar Jurídico
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {dadosUnidade.comunicacoes.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Nenhuma comunicação registrada
                      </p>
                    </div>
                  ) : (
                    dadosUnidade.comunicacoes.map((comunicacao) => (
                      <div
                        key={comunicacao.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <MessageSquare className="w-5 h-5 text-green-600 mr-2" />
                            <span className="font-medium text-gray-800">
                              {comunicacao.tipo.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatarData(comunicacao.data_envio)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">
                          {comunicacao.conteudo}
                        </p>
                        <div className="mt-2 text-xs text-gray-500">
                          Status: {comunicacao.status_leitura}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {abaSelecionada === "dashboard" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Dashboard da Unidade
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {formatarMoeda(dadosUnidade.dashboard.total_em_aberto)}
                    </div>
                    <div className="text-sm text-red-800">Total em Aberto</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {formatarMoeda(dadosUnidade.dashboard.total_pago)}
                    </div>
                    <div className="text-sm text-green-800">Total Pago</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {dadosUnidade.dashboard.percentual_inadimplencia.toFixed(
                        1
                      )}
                      %
                    </div>
                    <div className="text-sm text-yellow-800">
                      % Inadimplência
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {dadosUnidade.dashboard.reunioes_mes}
                    </div>
                    <div className="text-sm text-blue-800">Reuniões no Mês</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-800 mb-4">
                      Tendência de Regularização (6 meses)
                    </h4>
                    <div className="space-y-2">
                      {dadosUnidade.dashboard.tendencia_regularizacao.map(
                        (valor, index) => (
                          <div key={index} className="flex items-center">
                            <div className="w-16 text-sm text-gray-600">
                              Mês {index + 1}
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mx-3">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${valor}%` }}
                              ></div>
                            </div>
                            <div className="w-12 text-sm text-gray-800">
                              {valor.toFixed(0)}%
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-800 mb-4">
                      Resumo de Ações
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Acordos Firmados:</span>
                        <span className="font-medium">
                          {dadosUnidade.dashboard.acordos_firmados}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Cobranças Jurídico:
                        </span>
                        <span className="font-medium text-red-600">
                          {dadosUnidade.dashboard.cobrancas_juridico}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Reuniões Realizadas:
                        </span>
                        <span className="font-medium">
                          {dadosUnidade.dashboard.reunioes_mes}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {abaSelecionada === "vinculos" && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Vínculos do Franqueado
                </h3>

                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="font-semibold text-blue-800 mb-4">
                    Franqueado Principal:{" "}
                    {dadosUnidade.vinculos.franqueado_principal}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {dadosUnidade.vinculos.total_unidades}
                      </div>
                      <div className="text-sm text-blue-800">
                        Total de Unidades
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatarMoeda(dadosUnidade.vinculos.valor_total_grupo)}
                      </div>
                      <div className="text-sm text-red-800">
                        Valor Total do Grupo
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {
                          dadosUnidade.vinculos.outras_unidades.filter(
                            (u) => u.status === "ativa"
                          ).length
                        }
                      </div>
                      <div className="text-sm text-green-800">
                        Unidades Ativas
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor em Aberto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dadosUnidade.vinculos.outras_unidades.map((unidade) => (
                        <tr
                          key={unidade.codigo_unidade}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {unidade.codigo_unidade}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {unidade.nome_unidade}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                unidade.status
                              )}`}
                            >
                              {unidade.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            {formatarMoeda(unidade.valor_em_aberto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      {modalAberto === "reuniao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Agendar Reunião</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora
                </label>
                <input
                  type="datetime-local"
                  value={formData.data_hora || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, data_hora: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Participantes
                </label>
                <input
                  type="text"
                  value={formData.participantes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, participantes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome dos participantes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={executarAcao}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Agendando..." : "Agendar"}
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

      {modalAberto === "mensagem" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Enviar Mensagem</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={formData.tipo || "whatsapp"}
                  onChange={(e) =>
                    setFormData({ ...formData, tipo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conteúdo
                </label>
                <textarea
                  value={formData.conteudo || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, conteudo: e.target.value })
                  }
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite sua mensagem..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={executarAcao}
                disabled={processando || !formData.conteudo}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? "Enviando..." : "Enviar"}
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

      {modalAberto === "notificacao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Gerar Notificação Formal
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Notificação
                </label>
                <select
                  value={formData.tipo_notificacao || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo_notificacao: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="notificacao_inadimplencia">
                    Notificação de Inadimplência
                  </option>
                  <option value="notificacao_vencimento">
                    Notificação de Vencimento
                  </option>
                  <option value="notificacao_quebra_acordo">
                    Quebra de Acordo
                  </option>
                  <option value="carta_encerramento">
                    Carta de Encerramento
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações específicas..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={executarAcao}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {processando ? "Gerando..." : "Gerar Notificação"}
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

      {modalAberto === "escalonamento" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Escalar para Jurídico</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Escalonamento
                </label>
                <textarea
                  value={formData.motivo || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, motivo: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva o motivo do escalonamento..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Envolvido
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_envolvido || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      valor_envolvido: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={executarAcao}
                disabled={processando || !formData.motivo}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processando ? "Escalando..." : "Escalar"}
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
