/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Filter,
  Download,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { UnidadesService } from "../services/unidadesService";
import { UnidadeFranqueada, FiltrosUnidades } from "../types/unidades";

export function CadastroUnidades() {
  const [unidades, setUnidades] = useState<UnidadeFranqueada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosUnidades>({});
  const [modalAberto, setModalAberto] = useState<"criar" | "editar" | null>(
    null
  );
  const [unidadeSelecionada, setUnidadeSelecionada] =
    useState<UnidadeFranqueada | null>(null);
  const [formData, setFormData] = useState<Partial<UnidadeFranqueada>>({});
  const [salvando, setSalvando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<any>(null);

  const unidadesService = new UnidadesService();

  useEffect(() => {
    carregarDados();
  }, [filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [unidadesData, statsData] = await Promise.all([
        unidadesService.buscarUnidades(filtros),
        unidadesService.buscarEstatisticasUnidades(),
      ]);
      setUnidades(unidadesData);
      setEstatisticas(statsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalCriar = () => {
    setFormData({
      status_unidade: "ativa",
      franqueado_principal: true,
    });
    setModalAberto("criar");
  };

  const abrirModalEditar = (unidade: UnidadeFranqueada) => {
    setUnidadeSelecionada(unidade);
    setFormData(unidade);
    setModalAberto("editar");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setUnidadeSelecionada(null);
    setFormData({});
  };

  const salvarUnidade = async () => {
    if (!formData.codigo_unidade || !formData.nome_franqueado) {
      alert("Código da unidade e nome do franqueado são obrigatórios");
      return;
    }

    setSalvando(true);
    try {
      if (modalAberto === "criar") {
        await unidadesService.criarUnidade(
          formData as Omit<
            UnidadeFranqueada,
            "id" | "created_at" | "updated_at"
          >
        );
      } else if (modalAberto === "editar" && unidadeSelecionada) {
        await unidadesService.atualizarUnidade(
          unidadeSelecionada.id!,
          formData
        );
      }

      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar unidade: ${error}`);
    } finally {
      setSalvando(false);
    }
  };

  const removerUnidade = async (unidade: UnidadeFranqueada) => {
    if (
      !confirm(
        `Tem certeza que deseja fechar a unidade ${unidade.codigo_unidade}?`
      )
    ) {
      return;
    }

    try {
      await unidadesService.removerUnidade(unidade.id!);
      carregarDados();
    } catch (error) {
      alert(`Erro ao remover unidade: ${error}`);
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await unidadesService.exportarUnidades(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unidades-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Erro ao exportar dados");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ativa":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "inaugurando":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "fechada":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "em_tratativa":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativa":
        return "bg-green-100 text-green-800";
      case "inaugurando":
        return "bg-yellow-100 text-yellow-800";
      case "fechada":
        return "bg-red-100 text-red-800";
      case "em_tratativa":
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Cadastro de Unidades
              </h1>
              <p className="text-gray-600">
                Gestão completa das unidades franqueadas
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            <button
              onClick={abrirModalCriar}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Unidade
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total}
              </div>
              <div className="text-sm text-blue-800">Total de Unidades</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.por_status.ativa || 0}
              </div>
              <div className="text-sm text-green-800">Unidades Ativas</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.por_status.inaugurando || 0}
              </div>
              <div className="text-sm text-yellow-800">Inaugurando</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.franqueados_principais}
              </div>
              <div className="text-sm text-purple-800">
                Franqueados Principais
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filtros.status || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="ativa">Ativa</option>
                <option value="inaugurando">Inaugurando</option>
                <option value="fechada">Fechada</option>
                <option value="em_tratativa">Em Tratativa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                value={filtros.estado || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, estado: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="SP">São Paulo</option>
                <option value="RJ">Rio de Janeiro</option>
                <option value="MG">Minas Gerais</option>
                <option value="RS">Rio Grande do Sul</option>
                <option value="PR">Paraná</option>
                <option value="SC">Santa Catarina</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={
                  filtros.franqueado_principal !== undefined
                    ? filtros.franqueado_principal.toString()
                    : ""
                }
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    franqueado_principal: e.target.value
                      ? e.target.value === "true"
                      : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Principal</option>
                <option value="false">Secundário</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Busca
              </label>
              <input
                type="text"
                value={filtros.busca || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, busca: e.target.value })
                }
                placeholder="Nome, código ou cidade"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Unidades */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Franqueado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Localização
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contato
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
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Carregando unidades...
                    </div>
                  </td>
                </tr>
              ) : unidades.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Nenhuma unidade encontrada
                  </td>
                </tr>
              ) : (
                unidades.map((unidade) => (
                  <tr key={unidade.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {unidade.codigo_unidade}
                        </div>
                        {unidade.codigo_interno && (
                          <div className="text-sm text-gray-500">
                            Int: {unidade.codigo_interno}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {unidade.nome_franqueado}
                        </div>
                        {unidade.franqueado_principal && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Principal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {unidade.cidade}/{unidade.estado}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {unidade.telefone_franqueado && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-1" />
                            {unidade.telefone_franqueado}
                          </div>
                        )}
                        {unidade.email_franqueado && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="w-4 h-4 mr-1" />
                            {unidade.email_franqueado}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(unidade.status_unidade)}
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            unidade.status_unidade
                          )}`}
                        >
                          {unidade.status_unidade
                            .replace("_", " ")
                            .toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => abrirModalEditar(unidade)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar unidade"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {unidade.status_unidade !== "fechada" && (
                          <button
                            onClick={() => removerUnidade(unidade)}
                            className="text-red-600 hover:text-red-900"
                            title="Fechar unidade"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal de Cadastro/Edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {modalAberto === "criar" ? "Nova Unidade" : "Editar Unidade"}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código da Unidade *
                </label>
                <input
                  type="text"
                  value={formData.codigo_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="CP001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Interno
                </label>
                <input
                  type="text"
                  value={formData.codigo_interno || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_interno: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="INT001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Franqueado *
                </label>
                <input
                  type="text"
                  value={formData.nome_franqueado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nome_franqueado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="João Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status_unidade || "ativa"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status_unidade: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ativa">Ativa</option>
                  <option value="inaugurando">Inaugurando</option>
                  <option value="fechada">Fechada</option>
                  <option value="em_tratativa">Em Tratativa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email_franqueado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email_franqueado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="joao@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone_franqueado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      telefone_franqueado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.cidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.estado || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, estado: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  <option value="SP">São Paulo</option>
                  <option value="RJ">Rio de Janeiro</option>
                  <option value="MG">Minas Gerais</option>
                  <option value="RS">Rio Grande do Sul</option>
                  <option value="PR">Paraná</option>
                  <option value="SC">Santa Catarina</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Abertura
                </label>
                <input
                  type="date"
                  value={formData.data_abertura || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, data_abertura: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="franqueado_principal"
                  checked={formData.franqueado_principal || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      franqueado_principal: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="franqueado_principal"
                  className="ml-2 text-sm font-medium text-gray-700"
                >
                  Franqueado Principal
                </label>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço Completo
              </label>
              <input
                type="text"
                value={formData.endereco_completo || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endereco_completo: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Rua das Flores, 123 - Centro"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.observacoes_unidade || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    observacoes_unidade: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Observações sobre a unidade..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={salvarUnidade}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
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
