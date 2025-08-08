/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Building2,
  Settings,
  Phone,
  Mail,
  Instagram,
  MapPin,
  Calendar,
  Clock,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../services/databaseService";

const STATUS_COLORS: Record<string, string> = {
  "OPERAÇÃO": "bg-green-100 text-green-800 border-green-300",
  "INATIVA": "bg-gray-100 text-gray-700 border-gray-300",
  "IMPLANTAÇÃO": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "SEM STATUS": "bg-gray-100 text-gray-500 border-gray-300",
};

const STATUS_OPTIONS = [
  { value: "OPERAÇÃO", label: "OPERAÇÃO" },
  { value: "INATIVA", label: "INATIVA" },
  { value: "IMPLANTAÇÃO", label: "IMPLANTAÇÃO" },
];

function getStatusProps(status: string | null | undefined) {
  if (!status) return { label: "Sem Status", color: STATUS_COLORS["SEM STATUS"] };
  const normalized = status.trim().toUpperCase();
  if (STATUS_COLORS[normalized]) {
    return { label: normalized, color: STATUS_COLORS[normalized] };
  }
  return { label: "Sem Status", color: STATUS_COLORS["SEM STATUS"] };
}

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
    try {
      const { data, error } = await supabase
      .from("unidades_franqueadas")
      .select(
        `
        *,
        franqueado_unidades!unidade_id(
          ativo, 
          franqueado_id, 
          franqueados!franqueado_id (
            id, 
            nome_completo, 
            email, 
            telefone, 
            tipo_franqueado
          )
        )
      `
      )
        .order("nome_unidade");

      if (error) {
        console.error('Erro ao carregar unidades:', error);
        setUnidades([]);
      } else {
        setUnidades(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      setUnidades([]);
    } finally {
      setCarregando(false);
    }
  };

  const carregarFranqueados = async () => {
    const { data } = await supabase
      .from("franqueados")
      .select("id, nome_completo, email, telefone, tipo_franqueado");
    setFranqueados(data || []);
  };

  const abrirModalEdicao = (unidade: any) => {
    setUnidadeSelecionada(unidade);
    setFormData({
      id: unidade.id,
      nome_unidade: unidade.nome_unidade || "",
      codigo_unidade: unidade.codigo_unidade || "",
      codigo_interno: unidade.codigo_interno || "",
      cidade: unidade.cidade || "",
      estado: unidade.estado || "",
      endereco_completo: unidade.endereco_completo || "",
      telefone_unidade: unidade.telefone_unidade || "",
      email_unidade: unidade.email_unidade || "",
      instagram_unidade: unidade.instagram_unidade || "",
      horario_seg_sex: unidade.horario_seg_sex || "08:00 - 18:00",
      horario_sabado: unidade.horario_sabado || "08:00 - 14:00",
      horario_domingo: unidade.horario_domingo || "Fechado",
      cep: unidade.cep || "",
      observacoes_unidade: unidade.observacoes_unidade || "",
      juridico_status: unidade.juridico_status || "regular",
      status_unidade: unidade.status_unidade ?? "",
    });
    setFranqueadoVinculo(
      unidade.franqueado_unidades?.find((v: any) => v.ativo)?.franqueado_id ||
        ""
    );
    setModalAberto(true);
  };

  const abrirModalNova = () => {
    setUnidadeSelecionada(null);
    setFormData({
      status_unidade: "",
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
    setSalvando(false);
  };

  const salvarUnidade = async () => {
    if (!formData.nome_unidade) {
      alert("Nome da unidade é obrigatório");
      return;
    }
    if (!formData.codigo_unidade) {
      alert("Código da unidade é obrigatório");
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
        const { id, franqueado_unidades, ...dadosParaAtualizar } = formData;
        const { error } = await supabase
          .from("unidades_franqueadas")
          .update({
            ...dadosParaAtualizar,
            updated_at: new Date().toISOString()
          })
          .eq("id", unidadeSelecionada.id);
        if (error) throw error;
        unidadeId = unidadeSelecionada.id;
      }
      if (unidadeId) {
        const { error: errorDesativar } = await supabase
          .from("franqueado_unidades")
          .update({ ativo: false })
          .eq("unidade_id", unidadeId)
          .eq("ativo", true);
        if (errorDesativar) {
          console.warn("Erro ao desativar vínculos anteriores:", errorDesativar);
        }
        if (franqueadoVinculo) {
          const { error: errorVinculo } = await supabase
            .from("franqueado_unidades")
            .insert({
            unidade_id: unidadeId,
            franqueado_id: franqueadoVinculo,
            ativo: true,
          });
          if (errorVinculo) {
            console.warn("Erro ao criar vínculo:", errorVinculo);
          }
        }
      }
      alert("Unidade salva com sucesso!");
      fecharModal();
      carregarDados();
    } catch (error) {
      console.error("Erro detalhado ao salvar unidade:", error);
      alert(`Erro ao salvar unidade: ${error}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const unidadesFiltradas = unidades.filter((u) => {
    const termo = busca.toLowerCase();
    return (
      u.nome_unidade?.toLowerCase().includes(termo) ||
      u.codigo_unidade?.toLowerCase().includes(termo) ||
      u.cidade?.toLowerCase().includes(termo) ||
      u.estado?.toLowerCase().includes(termo)
    );
  });

  const CardUnidade = ({ unidade }: { unidade: any }) => {
    const NOME_MAX = 32;
    const CODIGO_MAX = 16;
    const statusRaw = unidade.status_unidade || "";
    const { label: statusLabel, color: statusColor } = getStatusProps(statusRaw);

    return (
      <div
        className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col min-h-[120px] max-w-full w-full cursor-pointer hover:shadow-lg transition-all duration-150"
        style={{ minWidth: 0 }}
        title="Clique para editar"
        onClick={() => abrirModalEdicao(unidade)}
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
              {truncateText(unidade.nome_unidade, NOME_MAX)}
            </div>
            <div className="text-xs text-gray-500">
              Código: <span className="font-semibold">#{truncateText(unidade.codigo_unidade, CODIGO_MAX)}</span>
            </div>
          </div>
          <Settings className="w-5 h-5 text-gray-300" />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}
            style={{ letterSpacing: "0.03em" }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    );
  };

  // --- MODAL LAYOUT ---
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
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"></path></svg>
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-7 7V21a1 1 0 01-2 0v-7.293l-7-7A1 1 0 013 6V4z"></path></svg>
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

      {/* Grid de Cards - 4 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-7">
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
          <div className="bg-white rounded-xl p-0 max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-8 pt-6 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-800 leading-tight">
                    {formData.nome_unidade || "Nova Unidade"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Código: <span className="font-semibold">#{formData.codigo_unidade || "Novo"}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-700 text-2xl px-2"
                title="Fechar"
              >
                ×
              </button>
            </div>

            {/* Status e Ações */}
            <div className="flex flex-wrap items-center gap-3 px-8 pt-4 pb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusProps(formData.status_unidade).color}`}>
                {getStatusProps(formData.status_unidade).label}
              </span>
            </div>

            <form
              className="px-8 py-4 space-y-8"
              onSubmit={e => {
                e.preventDefault();
                salvarUnidade();
              }}
            >
              {/* Informações Básicas */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Informações Básicas</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Nome do Grupo</label>
                    <input
                      type="text"
                      name="nome_unidade"
                      value={formData.nome_unidade || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Código da Unidade</label>
                    <input
                      type="text"
                      name="codigo_unidade"
                      value={formData.codigo_unidade || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      required
                    />
                    <span className="text-xs text-gray-400 mt-1">Código não pode ser editado</span>
                  </div>
                </div>
              </section>

              {/* Informações de Contato */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-lg text-gray-800">Informações de Contato</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Telefone</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="telefone_unidade"
                        value={formData.telefone_unidade || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="não possui"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="email_unidade"
                        value={formData.email_unidade || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="não informado"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Instagram</label>
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="instagram_unidade"
                        value={formData.instagram_unidade || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="não informado"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Horário de Funcionamento */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-lg text-gray-800">Horário de Funcionamento</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Segunda a Sexta</label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="horario_seg_sex"
                        value={formData.horario_seg_sex || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="08:00 às 18:00"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Sábado</label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="horario_sabado"
                        value={formData.horario_sabado || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="08:00 às 14:00"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Domingo</label>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="horario_domingo"
                        value={formData.horario_domingo || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="Fechado"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Endereço</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      name="endereco_completo"
                      value={formData.endereco_completo || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      placeholder="Rua, número, bairro"
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Cidade</label>
                    <input
                      type="text"
                      name="cidade"
                      value={formData.cidade || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Estado</label>
                    <input
                      type="text"
                      name="estado"
                      value={formData.estado || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      placeholder="Estado"
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">CEP</label>
                    <input
                      type="text"
                      name="cep"
                      value={formData.cep || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      placeholder="CEP"
                    />
                  </div>
                </div>
              </section>

              {/* Observações */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Observações</h4>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <textarea
                    name="observacoes_unidade"
                    value={formData.observacoes_unidade || ""}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 resize-none"
                    rows={2}
                    placeholder="Observações relevantes sobre a unidade"
                  />
                </div>
              </section>

              {/* Status */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-5 h-5 text-gray-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Status</h4>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col max-w-xs">
                  <label className="text-xs text-gray-500 font-semibold mb-1">Status da Unidade</label>
                  <select
                    name="status_unidade"
                    value={formData.status_unidade || ""}
                    onChange={handleInputChange}
                    className="bg-white border border-gray-300 rounded-md px-3 py-2 text-base font-medium text-gray-800 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Sem Status</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Botões de ação */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-8">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-6 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                  disabled={salvando}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
