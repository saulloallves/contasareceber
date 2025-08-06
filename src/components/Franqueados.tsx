/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit,
  Filter,
  Download,
  Mail,
  Phone,
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../services/databaseService";

export function Franqueados() {
  const [franqueados, setFranqueados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<"criar" | "editar" | null>(
    null
  );
  const [franqueadoSelecionado, setFranqueadoSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);

  useEffect(() => {
    carregarFranqueados();
  }, []);

  const carregarFranqueados = async () => {
    setCarregando(true);
    try {
      // Busca franqueados e suas unidades vinculadas
      const { data, error } = await supabase
        .from("franqueados")
        .select(
          `
          *,
          franqueado_unidades:franqueado_unidades!inner(ativo, unidade_id, unidades_franqueadas:unidade_id (id, codigo_unidade, nome_unidade, cidade, estado, status_unidade))
        `
        )
        .order("nome_completo");
      setFranqueados(data || []);
    } catch (error) {
      alert(`Erro ao carregar franqueados: ${error}`);
    } finally {
      setCarregando(false);
    }
  };

  const carregarUnidades = async () => {
    const { data, error } = await supabase
      .from("unidades_franqueadas")
      .select(
        "id, codigo_unidade, nome_unidade, cidade, estado, status_unidade"
      );
    setUnidades(data || []);
  };

  const abrirModalCriar = () => {
    setFormData({
      nome_completo: "",
      cpf_rnm: "",
      email: "",
      telefone: "",
      tipo_franqueado: "principal",
    });
    setModalAberto("criar");
  };

  const abrirModalEditar = (franqueado: any) => {
    setFranqueadoSelecionado(franqueado);
    setFormData(franqueado);
    setModalAberto("editar");
    carregarUnidades();
  };

  const fecharModal = () => {
    setModalAberto(null);
    setFranqueadoSelecionado(null);
    setFormData({});
  };

  const salvarFranqueado = async () => {
    if (!formData.nome_completo || !formData.cpf_rnm) {
      alert("Nome e CPF/RNM são obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      let franqueadoId = formData.id;
      if (modalAberto === "criar") {
        // Cria franqueado
        const { data, error } = await supabase
          .from("franqueados")
          .insert({
            nome_completo: formData.nome_completo,
            cpf_rnm: formData.cpf_rnm,
            email: formData.email,
            telefone: formData.telefone,
            tipo_franqueado: formData.tipo_franqueado,
          })
          .select()
          .single();
        if (error) throw error;
        franqueadoId = data.id;
      } else if (modalAberto === "editar" && franqueadoSelecionado) {
        // Atualiza franqueado
        const { error } = await supabase
          .from("franqueados")
          .update({
            nome_completo: formData.nome_completo,
            cpf_rnm: formData.cpf_rnm,
            email: formData.email,
            telefone: formData.telefone,
            tipo_franqueado: formData.tipo_franqueado,
          })
          .eq("id", franqueadoSelecionado.id);
        if (error) throw error;
      }
      fecharModal();
      carregarFranqueados();
    } catch (error) {
      alert(`Erro ao salvar franqueado: ${error}`);
    } finally {
      setSalvando(false);
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
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Franqueados</h1>
              <p className="text-gray-600">
                Gestão dos franqueados e vínculos com unidades
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={abrirModalCriar}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Franqueado
            </button>
          </div>
        </div>

        {/* Tabela de Franqueados */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPF/RNM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidades Vinculadas
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
                      Carregando franqueados...
                    </div>
                  </td>
                </tr>
              ) : franqueados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Nenhum franqueado encontrado
                  </td>
                </tr>
              ) : (
                franqueados.map((franqueado) => (
                  <tr key={franqueado.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="font-medium text-gray-800">
                          {franqueado.nome_completo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {franqueado.cpf_rnm}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {franqueado.tipo_franqueado}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {franqueado.email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {franqueado.telefone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {franqueado.franqueado_unidades?.length > 0 ? (
                        <ul className="space-y-1">
                          {franqueado.franqueado_unidades.map((v: any) => (
                            <li
                              key={v.unidade_id}
                              className="flex items-center"
                            >
                              <Building2 className="w-4 h-4 text-purple-600 mr-1" />
                              <span className="font-medium text-gray-800">
                                {v.unidades_franqueadas?.codigo_unidade}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {v.unidades_franqueadas?.nome_unidade}
                              </span>
                              <span className="ml-2 text-xs text-gray-400">
                                {v.unidades_franqueadas?.cidade}/
                                {v.unidades_franqueadas?.estado}
                              </span>
                              <span
                                className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                  v.unidades_franqueadas?.status_unidade
                                )}`}
                              >
                                {getStatusIcon(
                                  v.unidades_franqueadas?.status_unidade
                                )}
                                {v.unidades_franqueadas?.status_unidade?.toUpperCase()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Sem unidades
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => abrirModalEditar(franqueado)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Editar franqueado"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {modalAberto === "criar"
                  ? "Novo Franqueado"
                  : "Editar Franqueado"}
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
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome_completo || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome_completo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do franqueado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF/RNM *
                </label>
                <input
                  type="text"
                  value={formData.cpf_rnm || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cpf_rnm: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="CPF ou RNM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Franqueado
                </label>
                <select
                  value={formData.tipo_franqueado || "principal"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo_franqueado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="principal">Principal</option>
                  <option value="socio">Sócio</option>
                  <option value="operador">Operador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, telefone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarFranqueado}
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
