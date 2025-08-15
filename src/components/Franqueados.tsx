/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Users,
  Settings,
  Mail,
  Phone,
  MapPin,
  Info,
} from "lucide-react";
import { supabase } from "../services/databaseService";

function truncateText(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function getTipoBadge(tipo: string | undefined) {
  if (!tipo) {
    return {
      label: "Sem Tipo",
      className: "bg-gray-100 text-gray-500 border border-gray-300",
    };
  }
  if (tipo === "principal") {
    return {
      label: "PRINCIPAL",
      className: "bg-green-100 text-green-700 border border-green-300",
    };
  }
  if (tipo === "socio") {
    return {
      label: "SÓCIO",
      className: "bg-yellow-100 text-yellow-700 border border-yellow-300",
    };
  }
  return {
    label: tipo.toUpperCase(),
    className: "bg-gray-100 text-gray-500 border border-gray-300",
  };
}

export function Franqueados() {
  const [franqueados, setFranqueados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [franqueadoSelecionado, setFranqueadoSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregarFranqueados();
  }, []);

  const carregarFranqueados = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("franqueados")
        .select("*")
        .order("nome_completo");
      
      if (error) {
        console.error('Erro ao carregar franqueados:', error);
        setFranqueados([]);
      } else {
        setFranqueados(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar franqueados:', error);
      setFranqueados([]);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalEdicao = (franqueado: any) => {
    setFranqueadoSelecionado(franqueado);
    setFormData({ ...franqueado });
    setModalAberto(true);
  };

  const abrirModalNovo = () => {
    setFranqueadoSelecionado(null);
    setFormData({
      nome_completo: "",
      cpf_rnm: "",
      email: "",
      telefone: "",
      tipo_franqueado: "",
      cidade: "",
      estado: "",
      endereco: "",
      observacoes: "",
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setFranqueadoSelecionado(null);
    setFormData({});
    setSalvando(false);
  };

  const salvarFranqueado = async () => {
    if (!formData.nome_completo || !formData.cpf_rnm) {
      alert("Nome e CPF/RNM são obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      let franqueadoId = formData.id;
      if (!franqueadoSelecionado) {
        const { data, error } = await supabase
          .from("franqueados")
          .insert(formData)
          .select()
          .single();
        if (error) throw error;
        franqueadoId = data.id;
      } else {
        const { id, ...dadosParaAtualizar } = formData;
        const { error } = await supabase
          .from("franqueados")
          .update(dadosParaAtualizar)
          .eq("id", franqueadoSelecionado.id);
        if (error) throw error;
        franqueadoId = franqueadoSelecionado.id;
      }
      alert("Franqueado salvo com sucesso!");
      fecharModal();
      carregarFranqueados();
    } catch (error) {
      alert(`Erro ao salvar franqueado: ${error}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const franqueadosFiltrados = franqueados.filter((f) => {
    const termo = busca.toLowerCase();
    return (
      f.nome_completo?.toLowerCase().includes(termo) ||
      f.cpf_rnm?.toLowerCase().includes(termo) ||
      f.cidade?.toLowerCase().includes(termo) ||
      f.estado?.toLowerCase().includes(termo)
    );
  });

  const CardFranqueado = ({ franqueado }: { franqueado: any }) => {
    const NOME_MAX = 32;
    const CPF_MAX = 16;
    const badge = getTipoBadge(franqueado.tipo_franqueado);
    return (
      <div
        className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col min-h-[120px] max-w-full w-full cursor-pointer hover:shadow-lg transition-all duration-150"
        style={{ minWidth: 0 }}
        title="Clique para editar"
        onClick={() => abrirModalEdicao(franqueado)}
      >
        <div className="flex items-center mb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bold text-gray-800 uppercase text-base leading-tight truncate"
              style={{ maxWidth: "100%" }}
              title={franqueado.nome_completo}
            >
              {truncateText(franqueado.nome_completo, NOME_MAX)}
            </div>
            <div className="text-xs text-gray-500">
              CPF/RNM:{" "}
              <span className="font-semibold">
                #{truncateText(franqueado.cpf_rnm, CPF_MAX)}
              </span>
            </div>
          </div>
          <Settings className="w-5 h-5 text-gray-300" />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
        <div className="flex items-center mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">
              Franqueados
            </h1>
            <p className="text-gray-600">
              Gerencie todos os franqueados do sistema
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
          <div className="flex-1 flex items-center bg-white rounded-lg shadow-sm px-4 py-2 border border-gray-200">
            <svg
              className="w-5 h-5 text-gray-400 mr-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
              ></path>
            </svg>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF ou cidade..."
              className="flex-1 bg-transparent outline-none text-gray-800"
            />
          </div>
          <button
            onClick={abrirModalNovo}
            className="px-4 py-2 bg-[#ff9923] text-white rounded-lg font-semibold hover:bg-[#6b3a10] transition-colors duration-300"
          >
            + Novo Franqueado
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Mostrando {franqueadosFiltrados.length} de {franqueados.length}{" "}
          franqueados
        </div>
      </div>

      {/* Grid de Cards - 4 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-7">
        {carregando ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-2"></div>
            Carregando franqueados...
          </div>
        ) : franqueadosFiltrados.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            Nenhum franqueado encontrado
          </div>
        ) : (
          franqueadosFiltrados.map((franqueado) => (
            <CardFranqueado key={franqueado.id} franqueado={franqueado} />
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
                  <Users className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-800 leading-tight">
                    {formData.nome_completo || "Novo Franqueado"}
                  </div>
                  <div className="text-sm text-gray-500">
                    CPF/RNM:{" "}
                    <span className="font-semibold">
                      #{formData.cpf_rnm || "Novo"}
                    </span>
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

            <form
              className="px-8 py-4 space-y-8"
              onSubmit={(e) => {
                e.preventDefault();
                salvarFranqueado();
              }}
            >
              {/* Informações Básicas */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-lg text-gray-800">
                    Informações Básicas
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      name="nome_completo"
                      value={formData.nome_completo || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      CPF/RNM
                    </label>
                    <input
                      type="text"
                      name="cpf_rnm"
                      value={formData.cpf_rnm || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Contato */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-lg text-gray-800">
                    Contato
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Telefone
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="telefone"
                        value={formData.telefone || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="não possui"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Email
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ""}
                        onChange={handleInputChange}
                        className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 flex-1"
                        placeholder="não informado"
                      />
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Tipo de Franqueado
                    </label>
                    <select
                      name="tipo_franqueado"
                      value={formData.tipo_franqueado || ""}
                      onChange={handleInputChange}
                      className="bg-white border border-gray-300 rounded-md px-3 py-2 text-base font-medium text-gray-800 focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="principal">Principal</option>
                      <option value="socio">Sócio</option>
                      <option value="operador">Operador</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <h4 className="font-semibold text-lg text-gray-800">
                    Endereço
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Cidade
                    </label>
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
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Estado
                    </label>
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
                    <label className="text-xs text-gray-500 font-semibold mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      name="endereco"
                      value={formData.endereco || ""}
                      onChange={handleInputChange}
                      className="bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0"
                      placeholder="Endereço completo"
                    />
                  </div>
                </div>
              </section>

              {/* Observações */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <h4 className="font-semibold text-lg text-gray-800">
                    Observações
                  </h4>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <textarea
                    name="observacoes"
                    value={formData.observacoes || ""}
                    onChange={handleInputChange}
                    className="w-full bg-transparent text-base font-medium text-gray-800 outline-none border-none focus:ring-0 resize-none"
                    rows={2}
                    placeholder="Observações relevantes sobre o franqueado"
                  />
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
