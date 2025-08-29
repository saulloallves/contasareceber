/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Users,
  Settings,
  Mail,
  Phone,
  MapPin,
  Info,
  Building2,
  User,
  CheckCircle,
  XCircle,
  Plus,
} from "lucide-react";
import { supabase } from "../services/databaseService";
import { toast } from 'react-hot-toast';

// Hook para obter informações do usuário logado
const useUsuarioLogado = () => {
  const [usuario, setUsuario] = useState<any>(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: usuarioSistema } = await supabase
            .from('usuarios_sistema')
            .select('*')
            .eq('email', user.email)
            .single();
          setUsuario(usuarioSistema);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      } finally {
        setCarregandoUsuario(false);
      }
    };
    carregarUsuario();
  }, []);

  return { usuario, carregandoUsuario };
};

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
  const { usuario } = useUsuarioLogado();
  const [franqueados, setFranqueados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [franqueadoSelecionado, setFranqueadoSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  
  // Estados para modal de unidade e vínculos
  const [modalUnidadeAberto, setModalUnidadeAberto] = useState(false);
  const [unidadeVisualizacao, setUnidadeVisualizacao] = useState<any>(null);
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<any[]>([]);
  const [unidadeSelecionadaVinculo, setUnidadeSelecionadaVinculo] = useState<string>("");
  const [criandoVinculo, setCriandoVinculo] = useState(false);

  // Função para verificar se o usuário é admin master
  const isAdminMaster = () => {
    return usuario?.nivel_permissao === 'admin_master';
  };

  useEffect(() => {
    carregarFranqueados();
  }, []);

  const carregarFranqueados = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("franqueados")
        .select(`
          *,
          franqueado_unidades!franqueado_id(
            ativo,
            unidade_id,
            unidades_franqueadas!unidade_id (
              id,
              nome_unidade,
              codigo_unidade,
              codigo_interno,
              cidade,
              estado,
              status_unidade
            )
          )
        `)
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
      tipo_franqueado: "principal", // Valor padrão válido
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

  // Funções para modal de visualização da unidade
  const abrirModalUnidade = (unidade: any) => {
    setUnidadeVisualizacao(unidade);
    setModalUnidadeAberto(true);
  };

  const fecharModalUnidade = () => {
    setModalUnidadeAberto(false);
    setUnidadeVisualizacao(null);
  };

  // Funções para gerenciar vínculos
  const abrirModalVinculo = async () => {
    try {
      // Carregar unidades disponíveis
      const { data: todasUnidades, error } = await supabase
        .from("unidades_franqueadas")
        .select("id, nome_unidade, codigo_unidade, status_unidade")
        .neq("status_unidade", "INATIVA")
        .order("nome_unidade");

      if (error) throw error;

      // Filtrar unidades que ainda não têm vínculo ativo com este franqueado
      const unidadesVinculadas = franqueadoSelecionado?.franqueado_unidades
        ?.filter((v: any) => v.ativo)
        ?.map((v: any) => v.unidade_id) || [];

      const unidadesLivres = todasUnidades?.filter(
        (u: any) => !unidadesVinculadas.includes(u.id)
      ) || [];

      setUnidadesDisponiveis(unidadesLivres);
      setModalVinculoAberto(true);
    } catch (error) {
      console.error("Erro ao carregar unidades:", error);
      toast.error("Erro ao carregar unidades disponíveis");
    }
  };

  const fecharModalVinculo = () => {
    setModalVinculoAberto(false);
    setUnidadeSelecionadaVinculo("");
    setUnidadesDisponiveis([]);
  };

  const criarVinculo = async () => {
    if (!unidadeSelecionadaVinculo) {
      toast.error("Selecione uma unidade para criar o vínculo");
      return;
    }

    // Se é um novo franqueado, precisa salvar primeiro
    if (!franqueadoSelecionado) {
      toast.error("Salve o franqueado primeiro antes de criar vínculos");
      return;
    }

    setCriandoVinculo(true);
    try {
      const { error } = await supabase
        .from("franqueado_unidades")
        .insert({
          franqueado_id: franqueadoSelecionado.id,
          unidade_id: unidadeSelecionadaVinculo,
          ativo: true,
        });

      if (error) throw error;

      toast.success("Vínculo criado com sucesso!");
      fecharModalVinculo();
      carregarFranqueados(); // Recarregar dados para atualizar a tela
    } catch (error) {
      console.error("Erro ao criar vínculo:", error);
      toast.error("Erro ao criar vínculo");
    } finally {
      fecharModal();
      fecharModalVinculo();
      setCriandoVinculo(false);
    }
  };

  const salvarFranqueado = async () => {
    if (!formData.nome_completo || !formData.cpf_rnm) {
      toast.error("Nome e CPF/RNM são obrigatórios");
      return;
    }

    if (!formData.tipo_franqueado) {
      toast.error("Tipo de franqueado é obrigatório");
      return;
    }

    // Validar se o tipo é um dos valores aceitos
    const tiposValidos = ['principal', 'socio', 'operador'];
    if (!tiposValidos.includes(formData.tipo_franqueado)) {
      toast.error("Tipo de franqueado inválido");
      return;
    }
    
    setSalvando(true);
    try {
      // Filtrar apenas os campos que devem ser salvos na tabela franqueados
      const dadosParaSalvar = {
        nome_completo: formData.nome_completo,
        cpf_rnm: formData.cpf_rnm,
        email: formData.email,
        telefone: formData.telefone,
        tipo_franqueado: formData.tipo_franqueado, // Remover .toLowerCase()
        cidade: formData.cidade,
        estado: formData.estado,
        endereco: formData.endereco,
        observacoes: formData.observacoes,
      };

      if (!franqueadoSelecionado) {
        // Criar novo franqueado
        const { error } = await supabase
          .from("franqueados")
          .insert(dadosParaSalvar);
        if (error) throw error;
      } else {
        // Atualizar franqueado existente
        const { error } = await supabase
          .from("franqueados")
          .update(dadosParaSalvar)
          .eq("id", franqueadoSelecionado.id);
        if (error) throw error;
      }
      
      toast.success("Franqueado salvo com sucesso!");
      fecharModal();
      carregarFranqueados();
    } catch (error) {
      console.error("Erro detalhado ao salvar franqueado:", error);
      toast.error(`Erro ao salvar franqueado: ${(error as any)?.message || error}`);
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
          {isAdminMaster() && (
            <button
              onClick={abrirModalNovo}
              className="px-4 py-2 bg-[#ff9923] text-white rounded-lg font-semibold hover:bg-[#6b3a10] transition-colors duration-300"
            >
              + Novo Franqueado
            </button>
          )}
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

              {/* Vínculos com Unidades */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-lg text-gray-800">Vínculos com Unidades</h4>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  {franqueadoSelecionado?.franqueado_unidades?.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-gray-500 italic">
                          💡 Clique em uma unidade ativa para visualizar seus detalhes
                        </div>
                        <button
                          type="button"
                          onClick={abrirModalVinculo}
                          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar Vínculo
                        </button>
                      </div>
                      
                      {franqueadoSelecionado.franqueado_unidades
                        .filter((vinculo: any) => vinculo.ativo)
                        .map((vinculo: any, index: number) => (
                          <div 
                            key={`${vinculo.unidade_id}-${index}`} 
                            className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all duration-150"
                            onClick={() => abrirModalUnidade(vinculo.unidades_franqueadas)}
                            title="Clique para visualizar detalhes da unidade"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-800 truncate">
                                  {vinculo.unidades_franqueadas?.nome_unidade || "Nome não informado"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Código: #{vinculo.unidades_franqueadas?.codigo_unidade || "N/A"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {vinculo.unidades_franqueadas?.cidade && vinculo.unidades_franqueadas?.estado 
                                    ? `${vinculo.unidades_franqueadas.cidade}, ${vinculo.unidades_franqueadas.estado}`
                                    : "Localização não informada"
                                  }
                                </div>
                                {vinculo.unidades_franqueadas?.status_unidade && (
                                  <div className="text-xs text-purple-600 font-medium mt-1">
                                    Status: {vinculo.unidades_franqueadas.status_unidade}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              <span className="text-xs text-green-600 font-medium">Ativo</span>
                            </div>
                          </div>
                        ))}
                      
                      {/* Vínculos inativos, se houver */}
                      {franqueadoSelecionado.franqueado_unidades
                        .filter((vinculo: any) => !vinculo.ativo)
                        .map((vinculo: any, index: number) => (
                          <div key={`inactive-${vinculo.unidade_id}-${index}`} className="flex items-center justify-between bg-gray-100 rounded-lg p-3 border border-gray-300 opacity-75">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-600 truncate">
                                  {vinculo.unidades_franqueadas?.nome_unidade || "Nome não informado"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Código: #{vinculo.unidades_franqueadas?.codigo_unidade || "N/A"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {vinculo.unidades_franqueadas?.cidade && vinculo.unidades_franqueadas?.estado 
                                    ? `${vinculo.unidades_franqueadas.cidade}, ${vinculo.unidades_franqueadas.estado}`
                                    : "Localização não informada"
                                  }
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <XCircle className="w-5 h-5 text-gray-400" />
                              <span className="text-xs text-gray-500 font-medium">Inativo</span>
                            </div>
                          </div>
                        ))}

                      <div className="text-xs text-gray-500 mt-2">
                        Total de vínculos: {franqueadoSelecionado.franqueado_unidades.length} 
                        ({franqueadoSelecionado.franqueado_unidades.filter((v: any) => v.ativo).length} ativos, {franqueadoSelecionado.franqueado_unidades.filter((v: any) => !v.ativo).length} inativos)
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <div className="text-gray-500 font-medium">
                        {franqueadoSelecionado ? "Nenhuma unidade vinculada" : "Selecionar unidade para vínculo"}
                      </div>
                      <div className="text-sm text-gray-400 mt-1 mb-4">
                        {franqueadoSelecionado 
                          ? "Este franqueado ainda não possui vínculos com unidades"
                          : "Após salvar o franqueado, será possível criar vínculos com unidades"
                        }
                      </div>
                      {franqueadoSelecionado && (
                        <button
                          type="button"
                          onClick={abrirModalVinculo}
                          className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition-colors mx-auto"
                        >
                          <Plus className="w-4 h-4" />
                          Criar Primeiro Vínculo
                        </button>
                      )}
                    </div>
                  )}
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

      {/* Modal de Visualização da Unidade */}
      {modalUnidadeAberto && unidadeVisualizacao && (
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
                    {unidadeVisualizacao.nome_unidade || "Unidade"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Código: <span className="font-semibold">#{unidadeVisualizacao.codigo_unidade || "N/A"}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={fecharModalUnidade}
                className="text-gray-400 hover:text-gray-700 text-2xl px-2"
                title="Fechar"
              >
                ×
              </button>
            </div>

            {/* Badge de Status */}
            <div className="flex flex-wrap items-center gap-3 px-8 pt-4 pb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                {unidadeVisualizacao.status_unidade || "Sem Status"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                Apenas Visualização
              </span>
            </div>

            <div className="px-8 py-4 space-y-8">
              {/* Informações Básicas */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Informações da Unidade</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Nome da Unidade</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.nome_unidade || "Não informado"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Código</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.codigo_unidade || "Não informado"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">CNPJ</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.codigo_interno || "Não informado"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Status</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.status_unidade || "Não informado"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Localização */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-red-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Localização</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Cidade</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.cidade || "Não informado"}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 flex flex-col">
                    <label className="text-xs text-gray-500 font-semibold mb-1">Estado</label>
                    <div className="text-base font-medium text-gray-800">
                      {unidadeVisualizacao.estado || "Não informado"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Botão de fechar */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-8">
                <button
                  type="button"
                  onClick={fecharModalUnidade}
                  className="px-6 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Vínculo */}
      {modalVinculoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-0 max-w-2xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-8 pt-6 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Plus className="w-7 h-7 text-purple-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-800 leading-tight">
                    Criar Vínculo
                  </div>
                  <div className="text-sm text-gray-500">
                    Vincular franqueado a uma unidade
                  </div>
                </div>
              </div>
              <button
                onClick={fecharModalVinculo}
                className="text-gray-400 hover:text-gray-700 text-2xl px-2"
                title="Fechar"
              >
                ×
              </button>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Informações do Franqueado */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Franqueado</h4>
                </div>
                {franqueadoSelecionado ? (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="font-semibold text-blue-800">
                      {franqueadoSelecionado.nome_completo || "N/A"}
                    </div>
                    <div className="text-sm text-blue-600">
                      CPF/RNM: {franqueadoSelecionado.cpf_rnm || "N/A"}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <div className="font-semibold text-amber-800">
                      Novo Franqueado
                    </div>
                    <div className="text-sm text-amber-600">
                      Salve o franqueado primeiro para criar vínculos
                    </div>
                  </div>
                )}
              </section>

              {/* Seleção da Unidade */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-purple-500" />
                  <h4 className="font-semibold text-lg text-gray-800">Selecionar Unidade</h4>
                </div>
                {unidadesDisponiveis.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={unidadeSelecionadaVinculo}
                      onChange={(e) => setUnidadeSelecionadaVinculo(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-base font-medium text-gray-800 focus:border-purple-500 focus:ring-purple-500"
                    >
                      <option value="">-- Selecione uma unidade --</option>
                      {unidadesDisponiveis.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.nome_unidade} - #{unidade.codigo_unidade}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500">
                      {unidadesDisponiveis.length} unidade(s) disponível(is) para vínculo
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <div className="text-gray-500 font-medium">Nenhuma unidade disponível</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Todas as unidades já estão vinculadas a este franqueado
                    </div>
                  </div>
                )}
              </section>

              {/* Botões de ação */}
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={fecharModalVinculo}
                  className="px-6 py-2 rounded-md bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                  disabled={criandoVinculo}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={criarVinculo}
                  disabled={!unidadeSelecionadaVinculo || criandoVinculo || !franqueadoSelecionado}
                  className="px-6 py-2 rounded-md bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!franqueadoSelecionado ? "Salve o franqueado primeiro" : ""}
                >
                  {criandoVinculo ? "Criando..." : "Criar Vínculo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
