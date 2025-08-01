/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Edit,
  Eye,
  Send,
  Settings,
  Download,
  Filter,
  RefreshCw,
  Zap,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Mail,
  Target,
  Bell,
  Save,
  X,
} from "lucide-react";
import { TemplatesJuridicosService } from "../services/templatesJuridicosService";
import {
  TemplateJuridico,
  GatilhoAutomatico,
  FiltrosTemplates,
  EstatisticasTemplates,
  HistoricoDisparo,
} from "../types/templatesJuridicos";

export function TemplatesJuridicos() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    "templates" | "gatilhos" | "historico" | "configuracoes"
  >("templates");
  const [templates, setTemplates] = useState<TemplateJuridico[]>([]);
  const [gatilhos, setGatilhos] = useState<GatilhoAutomatico[]>([]);
  const [historico, setHistorico] = useState<HistoricoDisparo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosTemplates>({});
  const [modalAberto, setModalAberto] = useState<
    | "criar-template"
    | "editar-template"
    | "criar-gatilho"
    | "visualizar-historico"
    | null
  >(null);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasTemplates | null>(null);

  const templatesService = new TemplatesJuridicosService();

  useEffect(() => {
    carregarDados();
  }, [abaSelecionada, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [templatesData, gatilhosData, statsData] = await Promise.all([
        templatesService.buscarTemplates(filtros),
        templatesService.buscarGatilhos(),
        templatesService.buscarEstatisticas(),
      ]);

      setTemplates(templatesData);
      setGatilhos(gatilhosData);
      setEstatisticas(statsData);

      if (abaSelecionada === "historico") {
        const historicoData = await templatesService.buscarHistoricoDisparos(
          filtros
        );
        setHistorico(historicoData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalCriarTemplate = () => {
    setFormData({
      nome: "",
      tipo_debito: "royalty",
      categoria: "notificacao",
      corpo_mensagem: "",
      canal_envio: "email",
      prazo_resposta_dias: 15,
      ativo: true,
    });
    setModalAberto("criar-template");
  };

  const abrirModalEditarTemplate = (template: TemplateJuridico) => {
    setItemSelecionado(template);
    setFormData(template);
    setModalAberto("editar-template");
  };

  const abrirModalCriarGatilho = () => {
    setFormData({
      nome: "",
      condicoes: [],
      template_id: "",
      ativo: true,
      prioridade: "media",
    });
    setModalAberto("criar-gatilho");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setItemSelecionado(null);
    setFormData({});
  };

  const salvarTemplate = async () => {
    if (!formData.nome || !formData.corpo_mensagem) {
      alert("Nome e corpo da mensagem são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      if (modalAberto === "criar-template") {
        await templatesService.criarTemplate(formData);
      } else if (modalAberto === "editar-template" && itemSelecionado) {
        await templatesService.atualizarTemplate(itemSelecionado.id, formData);
      }

      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar template: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const salvarGatilho = async () => {
    if (!formData.nome || !formData.template_id) {
      alert("Nome e template são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await templatesService.criarGatilho(formData);
      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar gatilho: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const ativarDesativarTemplate = async (id: string, ativo: boolean) => {
    try {
      await templatesService.ativarDesativarTemplate(id, ativo);
      carregarDados();
    } catch (error) {
      alert(`Erro ao ${ativo ? "ativar" : "desativar"} template`);
    }
  };

  const testarTemplate = async (template: TemplateJuridico) => {
    try {
      if (!template.id) {
        alert("Template inválido: ID não encontrado");
        return;
      }
      const preview = await templatesService.gerarPreviewTemplate(template.id, {
        nome_unidade: "Franquia Exemplo",
        codigo_unidade: "0137",
        cnpj: "12.345.678/0001-99",
        valor_total_em_aberto: 2500.0,
        dias_em_atraso: 15,
        tipo_debito: template.tipo_debito,
        data_vencimento: "15/01/2025",
        nome_franqueado_principal: "João Silva",
      });

      alert(`Preview do template:\n\n${preview}`);
    } catch (error) {
      alert("Erro ao gerar preview");
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await templatesService.exportarTemplates(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `templates-juridicos-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Erro ao exportar dados");
    }
  };

  const getTipoDebitoColor = (tipo: string) => {
    switch (tipo) {
      case "royalty":
        return "bg-blue-100 text-blue-800";
      case "aluguel":
        return "bg-green-100 text-green-800";
      case "insumo":
        return "bg-purple-100 text-purple-800";
      case "multa":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoriaIcon = (categoria: string) => {
    switch (categoria) {
      case "notificacao":
        return <Bell className="w-4 h-4 text-blue-600" />;
      case "advertencia":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "proposta_acordo":
        return <FileText className="w-4 h-4 text-green-600" />;
      case "intimacao_juridica":
        return <Target className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "whatsapp":
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case "email":
        return <Mail className="w-4 h-4 text-blue-600" />;
      case "painel":
        return <User className="w-4 h-4 text-purple-600" />;
      default:
        return <Send className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Templates Jurídicos e Gatilhos Automáticos
              </h1>
              <p className="text-gray-600">
                Gestão de comunicações jurídicas por tipo de débito
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
            {abaSelecionada === "templates" && (
              <button
                onClick={abrirModalCriarTemplate}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </button>
            )}
            {abaSelecionada === "gatilhos" && (
              <button
                onClick={abrirModalCriarGatilho}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                Novo Gatilho
              </button>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_templates}
              </div>
              <div className="text-sm text-blue-800">Templates Ativos</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.gatilhos_ativos}
              </div>
              <div className="text-sm text-purple-800">Gatilhos Ativos</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.disparos_mes}
              </div>
              <div className="text-sm text-green-800">Disparos Este Mês</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.taxa_resposta.toFixed(1)}%
              </div>
              <div className="text-sm text-yellow-800">Taxa de Resposta</div>
            </div>
          </div>
        )}

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "templates", label: "Templates Jurídicos", icon: FileText },
              { id: "gatilhos", label: "Gatilhos Automáticos", icon: Zap },
              { id: "historico", label: "Histórico de Disparos", icon: Clock },
              { id: "configuracoes", label: "Configurações", icon: Settings },
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

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filtros.tipo_debito || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, tipo_debito: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Tipos</option>
              <option value="royalty">Royalty</option>
              <option value="aluguel">Aluguel</option>
              <option value="insumo">Insumo</option>
              <option value="multa">Multa</option>
            </select>

            <select
              value={filtros.categoria || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, categoria: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as Categorias</option>
              <option value="notificacao">Notificação</option>
              <option value="advertencia">Advertência</option>
              <option value="proposta_acordo">Proposta de Acordo</option>
              <option value="intimacao_juridica">Intimação Jurídica</option>
            </select>

            <select
              value={
                filtros.ativo !== undefined ? filtros.ativo.toString() : ""
              }
              onChange={(e) =>
                setFiltros({
                  ...filtros,
                  ativo: e.target.value ? e.target.value === "true" : undefined,
                })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>

            <input
              type="text"
              value={filtros.busca || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, busca: e.target.value })
              }
              placeholder="Buscar por nome..."
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Conteúdo das abas */}
        {abaSelecionada === "templates" && (
          <div className="space-y-4">
            {carregando ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Carregando templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum template encontrado</p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      {getCategoriaIcon(template.categoria)}
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {template.nome}
                        </h3>
                        <div className="flex items-center space-x-3 mt-1">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoDebitoColor(
                              template.tipo_debito
                            )}`}
                          >
                            {template.tipo_debito.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">
                            {template.categoria.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          template.ativo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {template.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {template.corpo_mensagem.substring(0, 200)}...
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      {getCanalIcon(template.canal_envio)}
                      <span className="ml-2">
                        Canal: {template.canal_envio}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Prazo: {template.prazo_resposta_dias} dias</span>
                    </div>
                    <div className="flex items-center">
                      <Target className="w-4 h-4 mr-2" />
                      <span>Disparos: {template.total_disparos || 0}</span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => abrirModalEditarTemplate(template)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </button>
                    <button
                      onClick={() => testarTemplate(template)}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </button>
                    <button
                      onClick={() =>
                        ativarDesativarTemplate(template.id!, !template.ativo)
                      }
                      className={`flex items-center px-3 py-2 rounded-lg text-sm ${
                        template.ativo
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-green-600 text-white hover:bg-green-700"
                      }`}
                    >
                      {template.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {abaSelecionada === "gatilhos" && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <div className="flex items-center">
                <Zap className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <h4 className="font-semibold text-yellow-800">
                    Gatilhos Automáticos Configurados
                  </h4>
                  <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                    <li>
                      • 2+ boletos vencidos do mesmo tipo → Advertência
                      automática
                    </li>
                    <li>• Reunião sem comparecimento → Nova notificação</li>
                    <li>• Status "Sem resposta" → Escalonamento jurídico</li>
                    <li>• Débito menor que R$ 5.000 → Proposta formal</li>
                    <li>• Reincidência (3x/ano) → Template jurídico específico</li>
                  </ul>
                </div>
              </div>
            </div>

            {gatilhos.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum gatilho configurado</p>
              </div>
            ) : (
              gatilhos.map((gatilho) => (
                <div
                  key={gatilho.id}
                  className="border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {gatilho.nome}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        gatilho.ativo
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {gatilho.ativo ? "ATIVO" : "INATIVO"}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <strong>Condições:</strong> {gatilho.condicoes.join(", ")}
                    </p>
                    <p>
                      <strong>Template:</strong> {gatilho.template_nome}
                    </p>
                    <p>
                      <strong>Prioridade:</strong> {gatilho.prioridade}
                    </p>
                    <p>
                      <strong>Execuções:</strong> {gatilho.total_execucoes || 0}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {abaSelecionada === "historico" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Canal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historico.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarData(item.data_envio)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.template_nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.unidade_nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.cnpj_unidade}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCanalIcon(item.canal_utilizado)}
                        <span className="ml-2 text-sm text-gray-900">
                          {item.canal_utilizado}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.visualizado
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {item.visualizado ? "VISUALIZADO" : "PENDENTE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.resultado || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {abaSelecionada === "configuracoes" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Configurações de Templates e Gatilhos
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h4 className="font-semibold text-blue-800 mb-4">
                Variáveis Disponíveis para Templates
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  "{{nome_unidade}}",
                  "{{codigo_unidade}}",
                  "{{cnpj}}",
                  "{{valor_total_em_aberto}}",
                  "{{dias_em_atraso}}",
                  "{{tipo_debito}}",
                  "{{data_vencimento}}",
                  "{{link_acordo}}",
                  "{{data_reuniao_marcada}}",
                  "{{nome_franqueado_principal}}",
                ].map((variavel) => (
                  <code
                    key={variavel}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded"
                  >
                    {variavel}
                  </code>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Permissões de Acesso
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Criar/Editar Templates:</span>
                    <span className="font-medium">Jurídico, Admin</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Configurar Gatilhos:</span>
                    <span className="font-medium">Jurídico</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Visualizar Histórico:</span>
                    <span className="font-medium">Jurídico, Supervisor</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Visualizar Templates:</span>
                    <span className="font-medium">Todos (leitura)</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Configurações Gerais
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor limite para gatilho automático (R$)
                    </label>
                    <input
                      type="number"
                      defaultValue={5000}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dias para reincidência
                    </label>
                    <input
                      type="number"
                      defaultValue={90}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="backup_automatico"
                      defaultChecked
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="backup_automatico"
                      className="ml-2 text-sm text-gray-700"
                    >
                      Backup automático de templates
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição de Template */}
      {(modalAberto === "criar-template" ||
        modalAberto === "editar-template") && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {modalAberto === "criar-template"
                  ? "Novo Template Jurídico"
                  : "Editar Template"}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={formData.nome || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Notificação por Reincidência de Royalty"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Débito *
                </label>
                <select
                  value={formData.tipo_debito || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, tipo_debito: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="royalty">Royalty</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="insumo">Insumo</option>
                  <option value="multa">Multa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  value={formData.categoria || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, categoria: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="notificacao">Notificação</option>
                  <option value="advertencia">Advertência</option>
                  <option value="proposta_acordo">Proposta de Acordo</option>
                  <option value="intimacao_juridica">Intimação Jurídica</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal de Envio *
                </label>
                <select
                  value={formData.canal_envio || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, canal_envio: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="painel">Painel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo para Resposta (dias)
                </label>
                <input
                  type="number"
                  value={formData.prazo_resposta_dias || 15}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prazo_resposta_dias: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, ativo: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="ativo"
                  className="ml-2 text-sm font-medium text-gray-700"
                >
                  Template ativo
                </label>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Corpo da Mensagem *
              </label>
              <textarea
                value={formData.corpo_mensagem || ""}
                onChange={(e) =>
                  setFormData({ ...formData, corpo_mensagem: e.target.value })
                }
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Digite o conteúdo do template usando as variáveis disponíveis..."
              />
              <p className="text-sm text-gray-500 mt-2">
                Use variáveis como {{ nome_unidade }},{" "}
                {{ valor_total_em_aberto }}, {{ dias_em_atraso }} etc.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={salvarTemplate}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2 inline" />
                {processando ? "Salvando..." : "Salvar Template"}
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

      {/* Modal de Criação de Gatilho */}
      {modalAberto === "criar-gatilho" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Novo Gatilho Automático</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Gatilho *
                </label>
                <input
                  type="text"
                  value={formData.nome || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Advertência para 2+ boletos vencidos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Associado *
                </label>
                <select
                  value={formData.template_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, template_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um template...</option>
                  {templates
                    .filter((t) => t.ativo)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.nome}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade
                </label>
                <select
                  value={formData.prioridade || "media"}
                  onChange={(e) =>
                    setFormData({ ...formData, prioridade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="gatilho_ativo"
                  checked={formData.ativo !== false}
                  onChange={(e) =>
                    setFormData({ ...formData, ativo: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="gatilho_ativo"
                  className="ml-2 text-sm font-medium text-gray-700"
                >
                  Gatilho ativo
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarGatilho}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Salvar Gatilho"}
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
