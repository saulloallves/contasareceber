/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Info,
  DollarSign,
  Calendar,
  Clock,
  MessageSquare,
  Link,
  Bug,
  Users,
  Shield,
  Bell,
} from "lucide-react";
import { ConfiguracaoService } from "../services/configuracaoService";
import { ConfiguracaoCobranca, LogSistema } from "../types/configuracao";
import { GestaoUsuarios } from "./Usuarios/GestaoUsuarios";

export function ConfiguracaoAdmin() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    "configuracoes" | "usuarios" | "logs" | "seguranca" | "notificacoes"
  >("configuracoes");
  const [config, setConfig] = useState<ConfiguracaoCobranca | null>(null);
  const [configOriginal, setConfigOriginal] =
    useState<ConfiguracaoCobranca | null>(null);
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{
    tipo: "sucesso" | "erro" | "info";
    texto: string;
  } | null>(null);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);
  const [filtrosLogs, setFiltrosLogs] = useState({
    usuario: "",
    acao: "",
    dataInicio: "",
    dataFim: "",
  });
  const [configNotificacao, setConfigNotificacao] = useState({
    whatsapp_ativo: true,
    email_ativo: true,
    enviar_apenas_em_atraso: false,
    valor_minimo_notificacao: 0
  });

  const configuracaoService = new ConfiguracaoService();

  useEffect(() => {
    if (abaSelecionada === "configuracoes") {
      carregarConfiguracao();
    } else if (abaSelecionada === "logs") {
      carregarLogs();
    }
  }, [abaSelecionada]);

  useEffect(() => {
    // Verifica se há alterações pendentes
    if (config && configOriginal) {
      const temAlteracoes =
        JSON.stringify(config) !== JSON.stringify(configOriginal);
      setAlteracoesPendentes(temAlteracoes);
    }
  }, [config, configOriginal]);

  const carregarConfiguracao = async () => {
    setCarregando(true);
    try {
      const dados = await configuracaoService.buscarConfiguracao();
      if (dados) {
        setConfig(dados);
        setConfigOriginal(JSON.parse(JSON.stringify(dados))); // Deep copy
      }
    } catch (error) {
      mostrarMensagem("erro", "Erro ao carregar configurações");
    } finally {
      setCarregando(false);
    }
  };

  const carregarLogs = async () => {
    setCarregando(true);
    try {
      const dados = await configuracaoService.buscarLogs(filtrosLogs);
      setLogs(dados);
    } catch (error) {
      mostrarMensagem("erro", "Erro ao carregar logs");
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracao = async () => {
    if (!config) return;

    setSalvando(true);
    try {
      await configuracaoService.atualizarConfiguracao(config, "usuario_atual");
      setConfigOriginal(JSON.parse(JSON.stringify(config))); // Atualiza original
      mostrarMensagem("sucesso", "Configurações salvas com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao salvar: ${error}`);
    } finally {
      setSalvando(false);
    }
  };

  const resetarConfiguracao = async () => {
    if (
      !confirm(
        "Tem certeza que deseja resetar todas as configurações para os valores padrão?"
      )
    ) {
      return;
    }

    setSalvando(true);
    try {
      await configuracaoService.resetarConfiguracao();
      await carregarConfiguracao();
      mostrarMensagem("info", "Configurações resetadas para valores padrão");
    } catch (error) {
      mostrarMensagem("erro", "Erro ao resetar configurações");
    } finally {
      setSalvando(false);
    }
  };

  const exportarConfiguracao = async () => {
    try {
      const blob = await configuracaoService.exportarConfiguracao();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `configuracao-cobranca-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      mostrarMensagem("sucesso", "Configuração exportada com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", "Erro ao exportar configuração");
    }
  };

  const mostrarMensagem = (
    tipo: "sucesso" | "erro" | "info",
    texto: string
  ) => {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 5000);
  };

  const atualizarCampo = (campo: keyof ConfiguracaoCobranca, valor: any) => {
    if (!config) return;
    setConfig({ ...config, [campo]: valor });
  };

  const previewMensagem = () => {
    if (!config) return "";

    return configuracaoService.aplicarTemplateMensagem(
      config.texto_padrao_mensagem,
      {
        cliente: "João da Silva",
        data_vencimento: "15/01/2024",
        valor_atualizado: "R$ 1.250,00",
        link_negociacao: config.link_base_agendamento,
      }
    );
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  if (carregando && abaSelecionada === "configuracoes") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Settings className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Configurações Gerais e Controle de Acessos
              </h1>
              <p className="text-gray-600">
                Gestão completa do sistema e permissões
              </p>
            </div>
          </div>

          {abaSelecionada === "configuracoes" && (
            <div className="flex space-x-3">
              <button
                onClick={exportarConfiguracao}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
              <button
                onClick={resetarConfiguracao}
                disabled={salvando}
                className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Resetar
              </button>
              <button
                onClick={salvarConfiguracao}
                disabled={salvando || !alteracoesPendentes}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de feedback */}
        {mensagem && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center ${
              mensagem.tipo === "sucesso"
                ? "bg-green-50 border border-green-200 text-green-800"
                : mensagem.tipo === "erro"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            {mensagem.tipo === "sucesso" ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : mensagem.tipo === "erro" ? (
              <AlertCircle className="w-5 h-5 mr-2" />
            ) : (
              <Info className="w-5 h-5 mr-2" />
            )}
            {mensagem.texto}
          </div>
        )}

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              {
                id: "configuracoes",
                label: "Configurações do Sistema",
                icon: Settings,
              },
              { id: "usuarios", label: "Gestão de Usuários", icon: Users },
              { id: "logs", label: "Logs e Auditoria", icon: Shield },
              { id: "seguranca", label: "Segurança", icon: Shield },
              { id: "notificacoes", label: "Notificações Automáticas", icon: Bell },
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

        {/* Conteúdo das abas */}
        {abaSelecionada === "configuracoes" && config && (
          <div>
            {/* Indicador de alterações pendentes */}
            {alteracoesPendentes && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center text-yellow-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span className="font-medium">
                    Você tem alterações não salvas
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Parâmetros Financeiros */}
              <div className="space-y-6">
                <div className="flex items-center mb-4">
                  <DollarSign className="w-6 h-6 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Parâmetros Financeiros
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentual de Multa (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.percentual_multa}
                    onChange={(e) =>
                      atualizarCampo(
                        "percentual_multa",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Percentual de multa aplicado sobre o valor original
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Juros Diário (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="10"
                    value={config.percentual_juros_dia}
                    onChange={(e) =>
                      atualizarCampo(
                        "percentual_juros_dia",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Percentual de juros aplicado por dia de atraso
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tempo de Tolerância (dias)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={config.tempo_tolerancia_dias}
                    onChange={(e) =>
                      atualizarCampo(
                        "tempo_tolerancia_dias",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Dias após vencimento antes de iniciar cobrança
                  </p>
                </div>
              </div>

              {/* Parâmetros de Envio */}
              <div className="space-y-6">
                <div className="flex items-center mb-4">
                  <MessageSquare className="w-6 h-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    Parâmetros de Envio
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dia do Disparo Mensal
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={config.dia_disparo_mensal}
                    onChange={(e) =>
                      atualizarCampo(
                        "dia_disparo_mensal",
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Dia do mês para disparo automático de cobranças
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canal de Envio
                  </label>
                  <select
                    value={config.canal_envio}
                    onChange={(e) =>
                      atualizarCampo("canal_envio", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link de Agendamento
                  </label>
                  <input
                    type="url"
                    value={config.link_base_agendamento}
                    onChange={(e) =>
                      atualizarCampo("link_base_agendamento", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://calendly.com/sua-empresa/negociacao"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    URL base para agendamento de negociações
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="modo_debug"
                    checked={config.modo_debug}
                    onChange={(e) =>
                      atualizarCampo("modo_debug", e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="modo_debug"
                    className="ml-2 text-sm font-medium text-gray-700"
                  >
                    Modo Debug
                  </label>
                  <Bug className="w-4 h-4 text-gray-400 ml-2" />
                </div>
              </div>
            </div>

            {/* Template da Mensagem */}
            <div className="mt-8">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-6 h-6 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Template da Mensagem
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texto Padrão da Mensagem
                  </label>
                  <textarea
                    value={config.texto_padrao_mensagem}
                    onChange={(e) =>
                      atualizarCampo("texto_padrao_mensagem", e.target.value)
                    }
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Digite o template da mensagem..."
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    <p className="font-medium mb-1">Variáveis disponíveis:</p>
                    <div className="flex flex-wrap gap-2">
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {"{{cliente}}"}
                      </code>
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {"{{valor_atualizado}}"}
                      </code>
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {"{{data_vencimento}}"}
                      </code>
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {"{{link_negociacao}}"}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview da Mensagem
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-48 overflow-y-auto">
                    <div className="bg-green-100 rounded-lg p-3 max-w-xs">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                        {previewMensagem()}
                      </pre>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Exemplo de como a mensagem aparecerá no WhatsApp
                  </p>
                </div>
              </div>
            </div>

            {/* Informações do Sistema */}
            <div className="mt-8 bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Info className="w-6 h-6 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Informações do Sistema
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">
                    Última Atualização:
                  </span>
                  <p className="text-gray-600">
                    {config.updated_at
                      ? new Date(config.updated_at).toLocaleString("pt-BR")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Última Importação:
                  </span>
                  <p className="text-gray-600">
                    {config.ultima_data_importacao
                      ? new Date(config.ultima_data_importacao).toLocaleString(
                          "pt-BR"
                        )
                      : "Nenhuma importação realizada"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p
                    className={`font-medium ${
                      config.modo_debug ? "text-yellow-600" : "text-green-600"
                    }`}
                  >
                    {config.modo_debug ? "Modo Debug Ativo" : "Produção"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {abaSelecionada === "usuarios" && <GestaoUsuarios />}

        {abaSelecionada === "logs" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Logs de Auditoria
            </h3>

            {/* Filtros de Logs */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  value={filtrosLogs.usuario}
                  onChange={(e) =>
                    setFiltrosLogs({ ...filtrosLogs, usuario: e.target.value })
                  }
                  placeholder="Usuário"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={filtrosLogs.acao}
                  onChange={(e) =>
                    setFiltrosLogs({ ...filtrosLogs, acao: e.target.value })
                  }
                  placeholder="Ação"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={filtrosLogs.dataInicio}
                  onChange={(e) =>
                    setFiltrosLogs({
                      ...filtrosLogs,
                      dataInicio: e.target.value,
                    })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={carregarLogs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Filtrar
                </button>
              </div>
            </div>

            {/* Tabela de Logs */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tabela
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {carregando ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        Nenhum log encontrado
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatarData(log.data_acao!)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(log as any).usuarios_sistema?.nome_completo ||
                            log.usuario_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.acao}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.tabela_afetada || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_origem || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaSelecionada === "seguranca" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Configurações de Segurança
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <Shield className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <h4 className="font-semibold text-yellow-800">
                    Recursos de Segurança Implementados
                  </h4>
                  <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                    <li>
                      • Row Level Security (RLS) ativo em todas as tabelas
                    </li>
                    <li>• Logs de auditoria para todas as ações</li>
                    <li>• Controle granular de permissões por usuário</li>
                    <li>• Validação de dados antes de salvar</li>
                    <li>• Bloqueio de edição em registros finalizados</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Políticas de Senha
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Mínimo 8 caracteres</li>
                  <li>• Pelo menos 1 letra maiúscula</li>
                  <li>• Pelo menos 1 número</li>
                  <li>• Bloqueio após 5 tentativas</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Controle de Sessão
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Timeout automático em 2 horas</li>
                  <li>• Logout em múltiplas abas</li>
                  <li>• Registro de IP e User-Agent</li>
                  <li>• Detecção de acesso suspeito</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {abaSelecionada === "notificacoes" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Configurações de Notificação Automática
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center">
                <Bell className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <h4 className="font-semibold text-blue-800">
                    Notificação Automática de Novas Cobranças
                  </h4>
                  <p className="text-blue-700 text-sm mt-1">
                    O sistema enviará automaticamente WhatsApp e/ou Email quando uma nova cobrança for registrada
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Configurações Gerais</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="whatsapp_ativo"
                      checked={configNotificacao.whatsapp_ativo}
                      onChange={(e) => setConfigNotificacao({
                        ...configNotificacao,
                        whatsapp_ativo: e.target.checked
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="whatsapp_ativo" className="ml-2 text-sm font-medium text-gray-700">
                      Enviar notificação via WhatsApp
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email_ativo"
                      checked={configNotificacao.email_ativo}
                      onChange={(e) => setConfigNotificacao({
                        ...configNotificacao,
                        email_ativo: e.target.checked
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="email_ativo" className="ml-2 text-sm font-medium text-gray-700">
                      Enviar notificação via Email
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="apenas_em_atraso"
                      checked={configNotificacao.enviar_apenas_em_atraso}
                      onChange={(e) => setConfigNotificacao({
                        ...configNotificacao,
                        enviar_apenas_em_atraso: e.target.checked
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="apenas_em_atraso" className="ml-2 text-sm font-medium text-gray-700">
                      Enviar apenas para cobranças em atraso
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor mínimo para notificação (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={configNotificacao.valor_minimo_notificacao}
                      onChange={(e) => setConfigNotificacao({
                        ...configNotificacao,
                        valor_minimo_notificacao: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Variáveis Disponíveis</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    '{{cliente}}',
                    '{{codigo_unidade}}',
                    '{{cnpj}}',
                    '{{valor_original}}',
                    '{{valor_atualizado}}',
                    '{{data_vencimento}}',
                    '{{dias_atraso}}',
                    '{{tipo_cobranca}}',
                    '{{data_atual}}',
                    '{{link_negociacao}}'
                  ].map((variavel) => (
                    <code
                      key={variavel}
                      className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs"
                    >
                      {variavel}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <button
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Salvar Configurações de Notificação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}