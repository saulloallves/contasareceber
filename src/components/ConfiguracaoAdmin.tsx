/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Settings, 
  Users, Shield, Bell,
  AlertTriangle, Globe, RefreshCw, XCircle,
} from "lucide-react";
import { ConfiguracaoService } from "../services/configuracaoService";
import { LogSistema } from "../types/configuracao";
import { GestaoUsuarios } from "./Usuarios/GestaoUsuarios";
import { toast } from "react-hot-toast";

export function ConfiguracaoAdmin() {
  const [abaSelecionada, setAbaSelecionada] = useState<
  "usuarios" | "logs" | "seguranca"
  >("usuarios");
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtrosLogs, setFiltrosLogs] = useState({
    usuario: "",
    acao: "",
    dataInicio: "",
    dataFim: "",
  });
  const [configSeguranca, setConfigSeguranca] = useState<any>(null);
  const [tentativasLogin, setTentativasLogin] = useState<any[]>([]);
  const [ipsBloqueados, setIpsBloqueados] = useState<any[]>([]);
  const [alertasSeguranca, setAlertasSeguranca] = useState<any[]>([]);
  const [novoIP, setNovoIP] = useState({ ip: '', motivo: '' });
  const [salvandoSeguranca, setSalvandoSeguranca] = useState(false);

  const configuracaoService = new ConfiguracaoService();

  useEffect(() => {
    if (abaSelecionada === "usuarios") {
      // Para a aba de usuários, apenas definir como não carregando
      setCarregando(false);
    } else if (abaSelecionada === "logs") {
      carregarLogs();
    } else if (abaSelecionada === "seguranca") {
      carregarDadosSeguranca();
    }
  }, [abaSelecionada]);

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
    switch (tipo) {
      case "sucesso":
        toast.success(texto);
        break;
      case "erro":
        toast.error(texto);
        break;
      case "info":
        toast(texto);
        break;
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  if (carregando && (abaSelecionada === "logs" || abaSelecionada === "seguranca")) {
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
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "usuarios", label: "Gestão de Usuários", icon: Users },
              { id: "logs", label: "Logs e Auditoria", icon: Shield },
              { id: "seguranca", label: "Segurança", icon: Shield },
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
      </div>
    </div>
  );
}
