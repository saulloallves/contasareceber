/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Settings, Save, RotateCcw, Download, CheckCircle,
  AlertCircle, Info, DollarSign, MessageSquare,
  Bug, Users, Shield, Bell, Mail,
  AlertTriangle, Globe, RefreshCw, XCircle,
} from "lucide-react";
import { ConfiguracaoService } from "../services/configuracaoService";
import { ConfiguracaoCobranca, LogSistema } from "../types/configuracao";
import { GestaoUsuarios } from "./Usuarios/GestaoUsuarios";
import { NotificacaoAutomaticaService } from "../services/notificacaoAutomaticaService";

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
  const [configSeguranca, setConfigSeguranca] = useState<any>(null);
  const [tentativasLogin, setTentativasLogin] = useState<any[]>([]);
  const [configNotificacao, setConfigNotificacao] = useState({
    whatsapp_ativo: true,
    email_ativo: true,
    enviar_apenas_em_atraso: false,
    valor_minimo_notificacao: 0,
    template_whatsapp: "",
    template_email_assunto: "",
    template_email_corpo: "",
  });
  const [ipsBloqueados, setIpsBloqueados] = useState<any[]>([]);
  const [alertasSeguranca, setAlertasSeguranca] = useState<any[]>([]);
  const [novoIP, setNovoIP] = useState({ ip: '', motivo: '' });
  const [salvandoSeguranca, setSalvandoSeguranca] = useState(false);

  const configuracaoService = new ConfiguracaoService();
  const notificacaoAutomaticaService = new NotificacaoAutomaticaService();

  useEffect(() => {
    if (abaSelecionada === "configuracoes") {
      carregarConfiguracao();
    } else if (abaSelecionada === "logs") {
      carregarLogs();
    } else if (abaSelecionada === "notificacoes") {
      carregarConfiguracaoNotificacao();
    } else if (abaSelecionada === "seguranca") {
      carregarDadosSeguranca();
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

  const carregarConfiguracaoNotificacao = async () => {
    setCarregando(true);
    try {
      const dados = await notificacaoAutomaticaService.buscarConfiguracaoNotificacao();
      setConfigNotificacao(dados);
    } catch (error) {
      mostrarMensagem("erro", "Erro ao carregar configurações de notificação");
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracaoNotificacao = async () => {
    setSalvando(true);
    try {
      await notificacaoAutomaticaService.salvarConfiguracaoNotificacao(configNotificacao, "usuario_atual");
      mostrarMensagem("sucesso", "Configurações de notificação salvas com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao salvar configurações de notificação: ${error}`);
    } finally {
      setSalvando(false);
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

  const carregarDadosSeguranca = async () => {
    setCarregando(true);
    try {
      const [configData, tentativasData, ipsData, alertasData] = await Promise.all([
        configuracaoService.buscarConfiguracaoSeguranca(),
        configuracaoService.buscarTentativasLogin(20),
        configuracaoService.buscarIPsBloqueados(),
        configuracaoService.buscarAlertasSeguranca()
      ]);
      
      setConfigSeguranca(configData);
      setTentativasLogin(tentativasData);
      setIpsBloqueados(ipsData);
      setAlertasSeguranca(alertasData);
    } catch (error) {
      mostrarMensagem("erro", "Erro ao carregar dados de segurança");
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracaoSeguranca = async () => {
    if (!configSeguranca) return;

    setSalvandoSeguranca(true);
    try {
      const validacao = configuracaoService.validarConfiguracaoSeguranca(configSeguranca);
      if (!validacao.valido) {
        mostrarMensagem("erro", `Erros de validação: ${validacao.erros.join(', ')}`);
        return;
      }

      await configuracaoService.salvarConfiguracaoSeguranca(configSeguranca, "usuario_atual");
      mostrarMensagem("sucesso", "Configurações de segurança salvas com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao salvar configurações: ${error}`);
    } finally {
      setSalvandoSeguranca(false);
    }
  };

  const bloquearIP = async () => {
    if (!novoIP.ip || !novoIP.motivo) {
      mostrarMensagem("erro", "IP e motivo são obrigatórios");
      return;
    }

    try {
      await configuracaoService.bloquearIP(novoIP.ip, novoIP.motivo, "usuario_atual");
      setNovoIP({ ip: '', motivo: '' });
      carregarDadosSeguranca();
      mostrarMensagem("sucesso", "IP bloqueado com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao bloquear IP: ${error}`);
    }
  };

  const desbloquearIP = async (ip: string) => {
    if (!confirm(`Tem certeza que deseja desbloquear o IP ${ip}?`)) return;

    try {
      await configuracaoService.desbloquearIP(ip, "usuario_atual");
      carregarDadosSeguranca();
      mostrarMensagem("sucesso", "IP desbloqueado com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao desbloquear IP: ${error}`);
    }
  };

  const resolverAlerta = async (alertaId: string) => {
    const acao = prompt("Descreva a ação tomada para resolver este alerta:");
    if (!acao) return;

    try {
      await configuracaoService.resolverAlertaSeguranca(alertaId, acao, "usuario_atual");
      carregarDadosSeguranca();
      mostrarMensagem("sucesso", "Alerta resolvido com sucesso!");
    } catch (error) {
      mostrarMensagem("erro", `Erro ao resolver alerta: ${error}`);
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

    return configuracaoService.gerarPreviewMensagem(
      config.texto_padrao_mensagem
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
            <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Configurações e Controle de Acesso
              </h1>
              <p className="text-gray-600">
                Gestão completa do sistema, permissões e logs
              </p>
            </div>
          </div>

          {abaSelecionada === "configuracoes" && config && (
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
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
              {
                id: "notificacoes",
                label: "Notificações Automáticas",
                icon: Bell,
              },
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
              <div className="space-y-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
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
              <div className="space-y-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
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
            <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex items-center mb-4">
                <MessageSquare className="w-6 h-6 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Template da Mensagem Padrão
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
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Variáveis que você pode usar no texto:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "{{cliente}}",
                        "{{codigo_unidade}}",
                        "{{cnpj}}",
                        "{{valor_original}}",
                        "{{valor_atualizado}}",
                        "{{data_vencimento}}",
                        "{{dias_atraso}}",
                        "{{tipo_cobranca}}",
                        "{{data_atual}}",
                        "{{link_negociacao}}",
                      ].map((variavel) => (
                        <code
                          key={variavel}
                          className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs font-mono"
                        >
                          {variavel}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview da Mensagem (Exemplo)
                  </label>
                  <div className="bg-white border border-gray-300 rounded-lg p-4 h-full">
                    <div className="bg-green-100 rounded-lg p-3 max-w-sm shadow-sm">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                        {previewMensagem()}
                      </pre>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Esta é uma simulação de como a mensagem aparecerá no
                      WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Sistema */}
            <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
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
              Configurações de Segurança e Controle de Acesso
            </h3>

            {configSeguranca && (
              <div className="space-y-8">
                {/* Políticas de Senha */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center mb-6">
                    <Shield className="w-6 h-6 text-blue-600 mr-3" />
                    <h4 className="text-xl font-semibold text-gray-800">Políticas de Senha</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Comprimento Mínimo
                      </label>
                      <input
                        type="number"
                        min="6"
                        max="50"
                        value={configSeguranca.senha_comprimento_minimo}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_comprimento_minimo: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiração (dias)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="365"
                        value={configSeguranca.senha_expiracao_dias}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_expiracao_dias: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requer_maiuscula"
                        checked={configSeguranca.senha_requer_maiuscula}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_requer_maiuscula: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="requer_maiuscula" className="ml-2 text-sm text-gray-700">
                        Letra maiúscula
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requer_minuscula"
                        checked={configSeguranca.senha_requer_minuscula}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_requer_minuscula: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="requer_minuscula" className="ml-2 text-sm text-gray-700">
                        Letra minúscula
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requer_numero"
                        checked={configSeguranca.senha_requer_numero}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_requer_numero: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="requer_numero" className="ml-2 text-sm text-gray-700">
                        Número
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requer_especial"
                        checked={configSeguranca.senha_requer_especial}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          senha_requer_especial: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="requer_especial" className="ml-2 text-sm text-gray-700">
                        Caractere especial
                      </label>
                    </div>
                  </div>
                </div>

                {/* Controle de Tentativas de Login */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center mb-6">
                    <AlertTriangle className="w-6 h-6 text-orange-600 mr-3" />
                    <h4 className="text-xl font-semibold text-gray-800">Controle de Tentativas de Login</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Máximo de Tentativas
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="20"
                        value={configSeguranca.max_tentativas_login}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          max_tentativas_login: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duração do Bloqueio (minutos)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        value={configSeguranca.duracao_bloqueio_minutos}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          duracao_bloqueio_minutos: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timeout da Sessão (minutos)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        value={configSeguranca.timeout_sessao_minutos}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          timeout_sessao_minutos: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="log_tentativas"
                        checked={configSeguranca.log_tentativas_falhas}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          log_tentativas_falhas: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="log_tentativas" className="ml-2 text-sm text-gray-700">
                        Registrar tentativas de login falhadas
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="notificar_admin"
                        checked={configSeguranca.notificar_admin_tentativas}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          notificar_admin_tentativas: e.target.checked
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="notificar_admin" className="ml-2 text-sm text-gray-700">
                        Notificar admin sobre tentativas suspeitas
                      </label>
                    </div>
                  </div>
                </div>

                {/* Controle de IPs */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center mb-6">
                    <Globe className="w-6 h-6 text-purple-600 mr-3" />
                    <h4 className="text-xl font-semibold text-gray-800">Controle de Acesso por IP</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Whitelist */}
                    <div>
                      <div className="flex items-center mb-4">
                        <input
                          type="checkbox"
                          id="whitelist_ativo"
                          checked={configSeguranca.ip_whitelist_ativo}
                          onChange={(e) => setConfigSeguranca({
                            ...configSeguranca,
                            ip_whitelist_ativo: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="whitelist_ativo" className="ml-2 text-sm font-medium text-gray-700">
                          Ativar Whitelist de IPs
                        </label>
                      </div>
                      
                      <textarea
                        value={configSeguranca.ips_permitidos.join('\n')}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          ips_permitidos: e.target.value.split('\n').filter(ip => ip.trim())
                        })}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="192.168.1.0/24&#10;10.0.0.1&#10;203.45.67.89"
                        disabled={!configSeguranca.ip_whitelist_ativo}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Um IP por linha. Suporta CIDR (ex: 192.168.1.0/24)
                      </p>
                    </div>
                    
                    {/* Blacklist */}
                    <div>
                      <div className="flex items-center mb-4">
                        <input
                          type="checkbox"
                          id="blacklist_ativo"
                          checked={configSeguranca.ip_blacklist_ativo}
                          onChange={(e) => setConfigSeguranca({
                            ...configSeguranca,
                            ip_blacklist_ativo: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="blacklist_ativo" className="ml-2 text-sm font-medium text-gray-700">
                          Ativar Blacklist de IPs
                        </label>
                      </div>
                      
                      <textarea
                        value={configSeguranca.ips_bloqueados.join('\n')}
                        onChange={(e) => setConfigSeguranca({
                          ...configSeguranca,
                          ips_bloqueados: e.target.value.split('\n').filter(ip => ip.trim())
                        })}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="45.123.45.67&#10;192.168.100.50"
                        disabled={!configSeguranca.ip_blacklist_ativo}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        IPs bloqueados permanentemente
                      </p>
                    </div>
                  </div>
                  
                  {/* Adicionar IP Manualmente */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-800 mb-3">Bloquear IP Manualmente</h5>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={novoIP.ip}
                        onChange={(e) => setNovoIP({...novoIP, ip: e.target.value})}
                        placeholder="192.168.1.100"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={novoIP.motivo}
                        onChange={(e) => setNovoIP({...novoIP, motivo: e.target.value})}
                        placeholder="Motivo do bloqueio"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={bloquearIP}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Bloquear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tentativas de Login Recentes */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                      <h4 className="text-xl font-semibold text-gray-800">Tentativas de Login Recentes</h4>
                    </div>
                    <button
                      onClick={carregarDadosSeguranca}
                      className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data/Hora
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            IP
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tentativasLogin.map((tentativa) => (
                          <tr key={tentativa.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatarData(tentativa.data_tentativa)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {tentativa.email_tentativa}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {tentativa.ip_origem}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                tentativa.sucesso 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {tentativa.sucesso ? 'SUCESSO' : 'FALHA'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {tentativa.motivo_falha || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* IPs Bloqueados */}
                {ipsBloqueados.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-6">
                      <XCircle className="w-6 h-6 text-red-600 mr-3" />
                      <h4 className="text-xl font-semibold text-gray-800">IPs Bloqueados Atualmente</h4>
                    </div>
                    
                    <div className="space-y-3">
                      {ipsBloqueados.map((ip) => (
                        <div key={ip.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div>
                            <div className="font-medium text-red-800">{ip.endereco_ip}</div>
                            <div className="text-sm text-red-600">{ip.motivo_bloqueio}</div>
                            <div className="text-xs text-gray-500">
                              Bloqueado em {formatarData(ip.data_bloqueio)} por {ip.bloqueado_por}
                            </div>
                          </div>
                          <button
                            onClick={() => desbloquearIP(ip.endereco_ip)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Desbloquear
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas de Segurança */}
                {alertasSeguranca.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center mb-6">
                      <Bell className="w-6 h-6 text-yellow-600 mr-3" />
                      <h4 className="text-xl font-semibold text-gray-800">Alertas de Segurança</h4>
                    </div>
                    
                    <div className="space-y-4">
                      {alertasSeguranca.filter(a => !a.resolvido).map((alerta) => (
                        <div key={alerta.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                                <h5 className="font-medium text-yellow-800">{alerta.titulo}</h5>
                              </div>
                              <p className="text-yellow-700 mb-2">{alerta.descricao}</p>
                              <div className="text-xs text-gray-600">
                                {alerta.ip_origem && `IP: ${alerta.ip_origem} • `}
                                {alerta.usuario_afetado && `Usuário: ${alerta.usuario_afetado} • `}
                                Detectado em {formatarData(alerta.data_deteccao)}
                              </div>
                            </div>
                            <button
                              onClick={() => resolverAlerta(alerta.id!)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              Resolver
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão Salvar */}
                <div className="flex justify-end">
                  <button
                    onClick={salvarConfiguracaoSeguranca}
                    disabled={salvandoSeguranca}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvandoSeguranca ? "Salvando..." : "Salvar Configurações de Segurança"}
                  </button>
                </div>
              </div>
            )}
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
                    O sistema enviará automaticamente WhatsApp e/ou Email quando
                    uma nova cobrança for registrada
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Configurações Gerais
                </h4>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="whatsapp_ativo"
                      checked={configNotificacao.whatsapp_ativo}
                      onChange={(e) =>
                        setConfigNotificacao({
                          ...configNotificacao,
                          whatsapp_ativo: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="whatsapp_ativo"
                      className="ml-2 text-sm font-medium text-gray-700"
                    >
                      Enviar notificação via WhatsApp
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email_ativo"
                      checked={configNotificacao.email_ativo}
                      onChange={(e) =>
                        setConfigNotificacao({
                          ...configNotificacao,
                          email_ativo: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="email_ativo"
                      className="ml-2 text-sm font-medium text-gray-700"
                    >
                      Enviar notificação via Email
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="apenas_em_atraso"
                      checked={configNotificacao.enviar_apenas_em_atraso}
                      onChange={(e) =>
                        setConfigNotificacao({
                          ...configNotificacao,
                          enviar_apenas_em_atraso: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="apenas_em_atraso"
                      className="ml-2 text-sm font-medium text-gray-700"
                    >
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
                      onChange={(e) =>
                        setConfigNotificacao({
                          ...configNotificacao,
                          valor_minimo_notificacao:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Configurações Gerais */}
                <h4 className="font-semibold text-gray-800 mb-4">
                  Variáveis Disponíveis
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    "{{cliente}}",
                    "{{codigo_unidade}}",
                    "{{cnpj}}",
                    "{{valor_original}}",
                    "{{valor_atualizado}}",
                    "{{data_vencimento}}",
                    "{{dias_atraso}}",
                    "{{tipo_cobranca}}",
                    "{{data_atual}}",
                    "{{link_negociacao}}",
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

            {/* Template WhatsApp */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 text-green-600 mr-2" />
                Template WhatsApp
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mensagem do WhatsApp
                  </label>
                  <textarea
                    value={
                      configNotificacao.template_whatsapp ||
                      `Olá, {{cliente}}! 👋
 
 Uma nova cobrança foi registrada para sua unidade {{codigo_unidade}}.
 
 📋 *Detalhes:*
 • Valor: {{valor_atualizado}}
 • Vencimento: {{data_vencimento}}
 • Tipo: {{tipo_cobranca}}
 
 Para negociar ou esclarecer dúvidas, entre em contato conosco.
 
 _Mensagem automática do sistema de cobrança_`
                    }
                    onChange={(e) =>
                      setConfigNotificacao({
                        ...configNotificacao,
                        template_whatsapp: e.target.value,
                      })
                    }
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Digite a mensagem do WhatsApp..."
                  />
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 mb-2">
                    Preview WhatsApp:
                  </h5>
                  <div className="bg-white rounded-lg p-3 border border-green-300 max-w-sm">
                    <div className="text-sm text-gray-800 whitespace-pre-line">
                      {(
                        configNotificacao.template_whatsapp ||
                        `Olá, João Silva! 👋
 
 Uma nova cobrança foi registrada para sua unidade CP001.
 
 📋 *Detalhes:*
 • Valor: R$ 1.250,00
 • Vencimento: 15/02/2024
 • Tipo: Royalties
 
 Para negociar ou esclarecer dúvidas, entre em contato conosco.
 
 _Mensagem automática do sistema de cobrança_`
                      )
                        .replace(/\{\{cliente\}\}/g, "João Silva")
                        .replace(/\{\{codigo_unidade\}\}/g, "CP001")
                        .replace(/\{\{valor_atualizado\}\}/g, "R$ 1.250,00")
                        .replace(/\{\{data_vencimento\}\}/g, "15/02/2024")
                        .replace(/\{\{tipo_cobranca\}\}/g, "Royalties")
                        .replace(/\{\{cnpj\}\}/g, "12.345.678/0001-99")
                        .replace(/\{\{dias_atraso\}\}/g, "5")
                        .replace(
                          /\{\{data_atual\}\}/g,
                          new Date().toLocaleDateString("pt-BR")
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Email */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                <Mail className="w-5 h-5 text-blue-600 mr-2" />
                Template Email
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assunto do Email
                  </label>
                  <input
                    type="text"
                    value={
                      configNotificacao.template_email_assunto ||
                      "Nova Cobrança Registrada - {{codigo_unidade}}"
                    }
                    onChange={(e) =>
                      setConfigNotificacao({
                        ...configNotificacao,
                        template_email_assunto: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Assunto do email..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corpo do Email
                  </label>
                  <textarea
                    value={
                      configNotificacao.template_email_corpo ||
                      `Prezado(a) {{cliente}},
 
 Informamos que foi registrada uma nova cobrança para sua unidade {{codigo_unidade}}.
 
 Detalhes da Cobrança:
 - Valor: {{valor_atualizado}}
 - Data de Vencimento: {{data_vencimento}}
 - Tipo: {{tipo_cobranca}}
 
 Para esclarecimentos ou negociação, entre em contato através dos nossos canais oficiais.
 
 Atenciosamente,
 Equipe Financeira`
                    }
                    onChange={(e) =>
                      setConfigNotificacao({
                        ...configNotificacao,
                        template_email_corpo: e.target.value,
                      })
                    }
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o corpo do email..."
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-800 mb-2">
                    Preview Email:
                  </h5>
                  <div className="bg-white rounded-lg p-4 border border-blue-300">
                    <div className="border-b border-gray-200 pb-2 mb-3">
                      <strong>Assunto:</strong>{" "}
                      {(
                        configNotificacao.template_email_assunto ||
                        "Nova Cobrança Registrada - {{codigo_unidade}}"
                      ).replace(/\{\{codigo_unidade\}\}/g, "CP001")}
                    </div>
                    <div className="text-sm text-gray-800 whitespace-pre-line">
                      {(
                        configNotificacao.template_email_corpo ||
                        `Prezado(a) {{cliente}},
 
 Informamos que foi registrada uma nova cobrança para sua unidade {{codigo_unidade}}.
 
 Detalhes da Cobrança:
 - Valor: {{valor_atualizado}}
 - Data de Vencimento: {{data_vencimento}}
 - Tipo: {{tipo_cobranca}}
 
 Para esclarecimentos ou negociação, entre em contato através dos nossos canais oficiais.
 
 Atenciosamente,
 Equipe Financeira`
                      )
                        .replace(/\{\{cliente\}\}/g, "João Silva")
                        .replace(/\{\{codigo_unidade\}\}/g, "CP001")
                        .replace(/\{\{valor_atualizado\}\}/g, "R$ 1.250,00")
                        .replace(/\{\{data_vencimento\}\}/g, "15/02/2024")
                        .replace(/\{\{tipo_cobranca\}\}/g, "Royalties")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={salvando}
              onClick={salvarConfiguracaoNotificacao}
            >
              {salvando ? "Salvando..." : "Salvar Configurações de Notificação"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
