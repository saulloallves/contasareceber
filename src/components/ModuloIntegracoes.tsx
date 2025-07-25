/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Settings,
  Zap,
  MessageSquare,
  Mail,
  Database,
  Globe,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Edit,
  TestTube,
  Download,
  Clock,
  BarChart3,
  Activity,
  Wifi,
  WifiOff,
  Link,
  Send,
  FileText,
} from "lucide-react";
import { IntegracoesService } from "../services/integracoesService";
import {
  IntegracaoConfig,
  MonitoramentoIntegracao,
  HistoricoIntegracao,
  EstatisticasIntegracoes,
  FiltrosIntegracoes,
} from "../types/integracoes";

export function ModuloIntegracoes() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    "configuracoes" | "monitoramento" | "historico" | "estatisticas"
  >("configuracoes");
  const [integracoes, setIntegracoes] = useState<IntegracaoConfig[]>([]);
  const [monitoramento, setMonitoramento] = useState<MonitoramentoIntegracao[]>(
    []
  );
  const [historico, setHistorico] = useState<HistoricoIntegracao[]>([]);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasIntegracoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<
    "configurar" | "testar" | "historico" | "reenviar" | null
  >(null);
  const [integracaoSelecionada, setIntegracaoSelecionada] =
    useState<IntegracaoConfig | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [testando, setTestando] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosIntegracoes>({});

  const integracoesService = new IntegracoesService();

  useEffect(() => {
    carregarDados();
  }, [abaSelecionada, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [integracoesData, monitoramentoData, estatisticasData] =
        await Promise.all([
          integracoesService.buscarIntegracoes(),
          integracoesService.buscarMonitoramento(),
          integracoesService.buscarEstatisticas(),
        ]);

      setIntegracoes(integracoesData);
      setMonitoramento(monitoramentoData);
      setEstatisticas(estatisticasData);

      if (abaSelecionada === "historico") {
        const historicoData =
          await integracoesService.buscarHistoricoIntegracoes(filtros);
        setHistorico(historicoData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalConfigurar = (integracao?: IntegracaoConfig) => {
    setIntegracaoSelecionada(integracao || null);
    setFormData(integracao?.configuracoes || {});
    setModalAberto("configurar");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setIntegracaoSelecionada(null);
    setFormData({});
  };

  const salvarIntegracao = async () => {
    if (!integracaoSelecionada) return;

    try {
      await integracoesService.salvarIntegracao({
        ...integracaoSelecionada,
        configuracoes: formData,
      });
      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar integração: ${error}`);
    }
  };

  const testarConexao = async (integracao: IntegracaoConfig) => {
    setTestando(integracao.id!);
    try {
      const resultado = await integracoesService.testarConexao(integracao);
      alert(
        `Teste ${resultado.sucesso ? "bem-sucedido" : "falhou"}: ${
          resultado.detalhes
        }`
      );
      carregarDados();
    } catch (error) {
      alert(`Erro no teste: ${error}`);
    } finally {
      setTestando(null);
    }
  };

  const reenviarAcao = async (historicoId: string) => {
    try {
      const sucesso = await integracoesService.reenviarAcao(historicoId);
      alert(sucesso ? "Ação reenviada com sucesso!" : "Falha no reenvio");
      carregarDados();
    } catch (error) {
      alert(`Erro ao reenviar: ${error}`);
    }
  };

  const exportarConfiguracoes = async () => {
    try {
      const dados = await integracoesService.exportarConfiguracoes();
      const blob = new Blob([dados], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `integracoes-config-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Erro ao exportar configurações");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "conectado":
      case "online":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "alerta":
      case "instavel":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "falha":
      case "offline":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "conectado":
      case "online":
      case "sucesso":
        return "bg-green-100 text-green-800";
      case "alerta":
      case "instavel":
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      case "falha":
      case "offline":
      case "erro":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "supabase":
        return <Database className="w-6 h-6 text-green-600" />;
      case "whatsapp":
        return <MessageSquare className="w-6 h-6 text-green-600" />;
      case "email":
        return <Mail className="w-6 h-6 text-blue-600" />;
      case "n8n":
        return <Zap className="w-6 h-6 text-purple-600" />;
      case "notion":
        return <FileText className="w-6 h-6 text-gray-600" />;
      case "webhook":
        return <Link className="w-6 h-6 text-orange-600" />;
      default:
        return <Globe className="w-6 h-6 text-gray-600" />;
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  const formatarTempo = (ms: number) => {
    return `${ms}ms`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Módulo de Integrações
              </h1>
              <p className="text-gray-600">
                Comunicação e orquestração externa
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={exportarConfiguracoes}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Config
            </button>
            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        {estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_integracoes}
              </div>
              <div className="text-sm text-blue-800">Total de Integrações</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.integracoes_ativas}
              </div>
              <div className="text-sm text-green-800">Integrações Ativas</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.chamadas_24h}
              </div>
              <div className="text-sm text-purple-800">Chamadas 24h</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.taxa_sucesso_geral.toFixed(1)}%
              </div>
              <div className="text-sm text-yellow-800">Taxa de Sucesso</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-600">
                {formatarTempo(estatisticas.tempo_resposta_medio)}
              </div>
              <div className="text-sm text-gray-800">Tempo Médio</div>
            </div>
          </div>
        )}

        {/* Navegação por Abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "configuracoes", label: "Configurações", icon: Settings },
              { id: "monitoramento", label: "Monitoramento", icon: Activity },
              { id: "historico", label: "Histórico", icon: Clock },
              { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
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
        {abaSelecionada === "configuracoes" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Configurações de Integrações
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integracoes.map((integracao) => (
                <div
                  key={integracao.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {getTipoIcon(integracao.tipo)}
                      <div className="ml-3">
                        <h4 className="text-lg font-semibold text-gray-800">
                          {integracao.nome}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {integracao.tipo.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {getStatusIcon(integracao.status_conexao)}
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          integracao.status_conexao
                        )}`}
                      >
                        {integracao.status_conexao.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span
                        className={
                          integracao.ativo ? "text-green-600" : "text-red-600"
                        }
                      >
                        {integracao.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Última verificação:</span>
                      <span className="text-gray-800">
                        {integracao.ultima_verificacao
                          ? formatarData(integracao.ultima_verificacao)
                          : "Nunca"}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => abrirModalConfigurar(integracao)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Configurar
                    </button>
                    <button
                      onClick={() => testarConexao(integracao)}
                      disabled={testando === integracao.id}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      {testando === integracao.id ? "Testando..." : "Testar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {abaSelecionada === "monitoramento" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Monitoramento em Tempo Real
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Integração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chamadas 24h
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Taxa Sucesso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo Resposta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alertas
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monitoramento.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.integracao}
                        </div>
                        <div className="text-sm text-gray-500">
                          Última atividade:{" "}
                          {formatarData(item.ultima_atividade)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.status === "online" ? (
                            <Wifi className="w-5 h-5 text-green-600 mr-2" />
                          ) : (
                            <WifiOff className="w-5 h-5 text-red-600 mr-2" />
                          )}
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              item.status
                            )}`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.total_chamadas_24h}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${item.taxa_sucesso_24h}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {item.taxa_sucesso_24h.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarTempo(item.tempo_resposta_medio)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.alertas_ativos.length > 0 ? (
                          <div className="space-y-1">
                            {item.alertas_ativos.map((alerta, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full"
                              >
                                {alerta}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-green-600 text-sm">
                            Sem alertas
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaSelecionada === "historico" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Histórico de Execuções
              </h3>

              {/* Filtros */}
              <div className="flex space-x-3">
                <select
                  value={filtros.tipo || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, tipo: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="n8n">n8n</option>
                  <option value="webhook">Webhook</option>
                </select>
                <select
                  value={filtros.status || ""}
                  onChange={(e) =>
                    setFiltros({ ...filtros, status: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os Status</option>
                  <option value="sucesso">Sucesso</option>
                  <option value="erro">Erro</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Integração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historico.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarData(item.data_execucao)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getTipoIcon(
                            (item as any).integracoes_config?.tipo || "webhook"
                          )}
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {(item as any).integracoes_config?.nome || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.tipo_acao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            item.status
                          )}`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.tempo_resposta
                          ? formatarTempo(item.tempo_resposta)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {item.status === "erro" && (
                            <button
                              onClick={() => reenviarAcao(item.id!)}
                              className="text-green-600 hover:text-green-900"
                              title="Reenviar"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaSelecionada === "estatisticas" && estatisticas && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Estatísticas Detalhadas
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Performance por Tipo
                </h4>
                <div className="space-y-4">
                  {Object.entries(estatisticas.por_tipo).map(
                    ([tipo, stats]) => (
                      <div
                        key={tipo}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          {getTipoIcon(tipo)}
                          <span className="ml-2 font-medium text-gray-800">
                            {tipo.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {stats.sucesso.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {stats.chamadas} chamadas
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Resumo Geral
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total de Integrações:</span>
                    <span className="font-medium">
                      {estatisticas.total_integracoes}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Integrações Ativas:</span>
                    <span className="font-medium text-green-600">
                      {estatisticas.integracoes_ativas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chamadas 24h:</span>
                    <span className="font-medium">
                      {estatisticas.chamadas_24h}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Taxa de Sucesso:</span>
                    <span className="font-medium text-green-600">
                      {estatisticas.taxa_sucesso_geral.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tempo Médio:</span>
                    <span className="font-medium">
                      {formatarTempo(estatisticas.tempo_resposta_medio)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Configuração */}
      {modalAberto === "configurar" && integracaoSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Configurar {integracaoSelecionada.nome}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {integracaoSelecionada.tipo === "whatsapp" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Provider
                    </label>
                    <select
                      value={formData.provider || "meta"}
                      onChange={(e) =>
                        setFormData({ ...formData, provider: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="meta">Meta (WhatsApp Business API)</option>
                      <option value="z-api">Z-API</option>
                      <option value="evolution">Evolution API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token API
                    </label>
                    <input
                      type="password"
                      value={formData.token_api || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, token_api: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Token de acesso da API"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID do Remetente
                    </label>
                    <input
                      type="text"
                      value={formData.id_remetente || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          id_remetente: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone Number ID ou Instance ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número Autenticado
                    </label>
                    <input
                      type="text"
                      value={formData.numero_autenticado || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numero_autenticado: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="5511999999999"
                    />
                  </div>
                </>
              )}

              {integracaoSelecionada.tipo === "email" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Servidor SMTP
                      </label>
                      <input
                        type="text"
                        value={formData.servidor_smtp || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            servidor_smtp: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Porta
                      </label>
                      <input
                        type="number"
                        value={formData.porta || 587}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            porta: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usuário
                    </label>
                    <input
                      type="email"
                      value={formData.usuario || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, usuario: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="seu-email@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha
                    </label>
                    <input
                      type="password"
                      value={formData.senha || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, senha: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Senha ou App Password"
                    />
                  </div>
                </>
              )}

              {integracaoSelecionada.tipo === "n8n" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Base
                    </label>
                    <input
                      type="url"
                      value={formData.url_base || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, url_base: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://n8n.exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token de Autenticação
                    </label>
                    <input
                      type="password"
                      value={formData.token_autenticacao || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          token_autenticacao: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Token de acesso"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={formData.webhook_url || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          webhook_url: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="https://n8n.exemplo.com/webhook/..."
                    />
                  </div>
                </>
              )}

              {integracaoSelecionada.tipo === "notion" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token de Integração
                    </label>
                    <input
                      type="password"
                      value={formData.token_integracao || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          token_integracao: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="secret_..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database ID
                    </label>
                    <input
                      type="text"
                      value={formData.database_id || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          database_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ID da database do Notion"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarIntegracao}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salvar Configuração
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
