/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Filter,
  MapPin,
  Phone,
  Mail,
  User,
  Search,
  Settings,
} from "lucide-react";
import { supabase } from "../services/databaseService";

const STATUS_COLORS: Record<string, string> = {
  ativa: "bg-green-100 text-green-800",
  inaugurando: "bg-yellow-100 text-yellow-800",
  fechada: "bg-red-100 text-red-800",
  em_tratativa: "bg-orange-100 text-orange-800",
};

function truncateText(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

export function CadastroUnidades() {
  const [unidades, setUnidades] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [franqueados, setFranqueados] = useState<any[]>([]);
  const [franqueadoVinculo, setFranqueadoVinculo] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [showFiltros, setShowFiltros] = useState(false);

  useEffect(() => {
    carregarDados();
    carregarFranqueados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("unidades_franqueadas")
      .select(
        `
        *,
        franqueado_unidades:franqueado_unidades!inner(ativo, franqueado_id, franqueados:franqueado_id (id, nome_completo, email, telefone, tipo_franqueado))
      `
      )
      .order("nome_unidade");
    setUnidades(data || []);
    setCarregando(false);
  };

  const carregarFranqueados = async () => {
    const { data } = await supabase
      .from("franqueados")
      .select("id, nome_completo, email, telefone, tipo_franqueado");
    setFranqueados(data || []);
  };

  const abrirModalEdicao = (unidade: any) => {
    setUnidadeSelecionada(unidade);
    setFormData(unidade);
    setFranqueadoVinculo(
      unidade.franqueado_unidades?.find((v: any) => v.ativo)?.franqueado_id ||
        ""
    );
    setModalAberto(true);
  };

  const abrirModalNova = () => {
    setUnidadeSelecionada(null);
    setFormData({
      status_unidade: "ativa",
      nome_unidade: "",
      codigo_unidade: "",
      codigo_interno: "",
      cidade: "",
      estado: "",
      endereco_completo: "",
      telefone_unidade: "",
      email_unidade: "",
      instagram_unidade: "",
      horario_seg_sex: "08:00 - 18:00",
      horario_sabado: "08:00 - 14:00",
      horario_domingo: "Fechado",
      cep: "",
      observacoes_unidade: "",
      juridico_status: "regular",
    });
    setFranqueadoVinculo("");
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setUnidadeSelecionada(null);
    setFormData({});
    setFranqueadoVinculo("");
  };

  const salvarUnidade = async () => {
    if (!formData.nome_unidade) {
      alert("Nome da unidade é obrigatório");
      return;
    }
    setSalvando(true);
    try {
      let unidadeId = formData.id;
      if (!unidadeSelecionada) {
        const { data, error } = await supabase
          .from("unidades_franqueadas")
          .insert(formData)
          .select()
          .single();
        if (error) throw error;
        unidadeId = data.id;
      } else {
        const { error } = await supabase
          .from("unidades_franqueadas")
          .update(formData)
          .eq("id", unidadeSelecionada.id);
        if (error) throw error;
      }
      if (unidadeId) {
        await supabase
          .from("franqueado_unidades")
          .update({ ativo: false })
          .eq("unidade_id", unidadeId)
          .eq("ativo", true);
        if (franqueadoVinculo) {
          await supabase.from("franqueado_unidades").insert({
            unidade_id: unidadeId,
            franqueado_id: franqueadoVinculo,
            ativo: true,
          });
        }
      }
      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar unidade: ${error}`);
    } finally {
      setSalvando(false);
    }
  };

  // Filtro de busca
  const unidadesFiltradas = unidades.filter((u) => {
    const termo = busca.toLowerCase();
    return (
      u.nome_unidade?.toLowerCase().includes(termo) ||
      u.codigo_unidade?.toLowerCase().includes(termo) ||
      u.cidade?.toLowerCase().includes(termo) ||
      u.estado?.toLowerCase().includes(termo)
    );
  });

  // Card visual padronizado
  const CardUnidade = ({ unidade }: { unidade: any }) => (
    <div
      className="bg-white rounded-xl shadow-lg border border-gray-100 p-5 flex flex-col min-h-[210px] cursor-pointer hover:shadow-xl transition-all duration-150"
      onClick={() => abrirModalEdicao(unidade)}
      title="Clique para editar"
    >
      <div className="flex items-center mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
          <Building2 className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-bold text-gray-800 uppercase text-base leading-tight truncate"
            style={{ maxWidth: "100%" }}
            title={unidade.nome_unidade}
          >
            {truncateText(unidade.nome_unidade, 20)}
            {unidade.cidade && unidade.estado && (
              <span className="ml-1 text-gray-500 font-normal text-sm">
                / {unidade.cidade} {unidade.estado}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Código:{" "}
            <span className="font-semibold">#{unidade.codigo_unidade}</span>
          </div>
        </div>
        <Settings className="w-5 h-5 text-gray-300" />
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            STATUS_COLORS[unidade.status_unidade] || "bg-gray-100 text-gray-800"
          }`}
        >
          {unidade.status_unidade?.toUpperCase() || "N/A"}
        </span>
        {unidade.franqueado_unidades?.length > 0 &&
          unidade.franqueado_unidades[0]?.franqueados && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold flex items-center">
              <User className="w-3 h-3 mr-1" />
              {unidade.franqueado_unidades[0].franqueados.nome_completo}
            </span>
          )}
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="text-xs text-gray-500 mb-1 truncate">
          {unidade.endereco_completo}
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Phone className="w-3 h-3 mr-1" />
          {unidade.telefone_unidade || "-"}
        </div>
        <div className="flex items-center text-xs text-gray-500">
          <Mail className="w-3 h-3 mr-1" />
          {unidade.email_unidade || "-"}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400 truncate">
          {unidade.observacoes_unidade || " "}
        </span>
        <span className="text-xs text-gray-400">
          {unidade.juridico_status && unidade.juridico_status !== "regular"
            ? `Jurídico: ${unidade.juridico_status}`
            : ""}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Unidades</h1>
            <p className="text-gray-600">
              Gerencie todas as unidades do sistema
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
          <div className="flex-1 flex items-center bg-white rounded-lg shadow-sm px-4 py-2 border border-gray-200">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, código ou cidade..."
              className="flex-1 bg-transparent outline-none text-gray-800"
            />
            <button
              className="ml-2 text-gray-500 hover:text-blue-600"
              onClick={() => setShowFiltros((v) => !v)}
              title="Filtros"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={abrirModalNova}
            className="px-4 py-2 bg-yellow-400 text-white rounded-lg font-semibold hover:bg-yellow-500 transition-all"
          >
            + Nova Unidade
          </button>
        </div>
        {showFiltros && (
          <div className="mt-3 bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex flex-wrap gap-3">
            <span className="text-xs text-gray-500">
              Filtros avançados em breve...
            </span>
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          Mostrando {unidadesFiltradas.length} de {unidades.length} unidades
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {carregando ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
            Carregando unidades...
          </div>
        ) : unidadesFiltradas.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            Nenhuma unidade encontrada
          </div>
        ) : (
          unidadesFiltradas.map((unidade) => (
            <CardUnidade key={unidade.id} unidade={unidade} />
          ))
        )}
      </div>

      {/* Modal de Edição/Cadastro */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {unidadeSelecionada ? "Editar Unidade" : "Nova Unidade"}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Todos os campos do banco */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Unidade *
                </label>
                <input
                  type="text"
                  value={formData.nome_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome da unidade"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código da Unidade
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
                <input
                  type="text"
                  value={formData.estado || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, estado: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="SP"
                />
              </div>
              <div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone_unidade || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      telefone_unidade: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email_unidade || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email_unidade: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="unidade@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.instagram_unidade || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      instagram_unidade: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="@instagram"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário Seg-Sex
                </label>
                <input
                  type="text"
                  value={formData.horario_seg_sex || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      horario_seg_sex: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="08:00 - 18:00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário Sábado
                </label>
                <input
                  type="text"
                  value={formData.horario_sabado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      horario_sabado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="08:00 - 14:00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horário Domingo
                </label>
                <input
                  type="text"
                  value={formData.horario_domingo || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      horario_domingo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Fechado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={formData.cep || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cep: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="00000-000"
                />
              </div>
              <div className="md:col-span-2">
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
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações sobre a unidade..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Jurídico
                </label>
                <input
                  type="text"
                  value={formData.juridico_status || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      juridico_status: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="regular, notificado, acionado, etc."
                />
              </div>
            </div>
            {/* Vínculo com Franqueado */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Franqueado Vinculado
              </label>
              <select
                value={franqueadoVinculo}
                onChange={(e) => setFranqueadoVinculo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sem vínculo</option>
                {franqueados.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome_completo} ({f.email})
                  </option>
                ))}
              </select>
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
