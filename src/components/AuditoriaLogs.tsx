import React, { useState, useEffect } from 'react';
import { 
  Shield, Search, Filter, Download, Eye, AlertTriangle, 
  Clock, User, Globe, FileText, Settings, RefreshCw,
  Calendar, Database, Edit, Trash2, Send, LogIn, LogOut,
  CheckCircle, XCircle, Activity, Target, Bell
} from 'lucide-react';
import { AuditoriaService } from '../services/auditoriaService';
import { LogAuditoria, FiltrosAuditoria, EstatisticasAuditoria, ConfiguracaoAuditoria } from '../types/auditoria';

export function AuditoriaLogs() {
  const [abaSelecionada, setAbaSelecionada] = useState<'logs' | 'configuracoes' | 'alertas'>('logs');
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});
  const [estatisticas, setEstatisticas] = useState<EstatisticasAuditoria | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoAuditoria | null>(null);
  const [exportando, setExportando] = useState(false);
  const [alertas, setAlertas] = useState<any[]>([]);

  const auditoriaService = new AuditoriaService();

  useEffect(() => {
    carregarDados();
  }, [abaSelecionada, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      if (abaSelecionada === 'logs') {
        const [logsData, statsData] = await Promise.all([
          auditoriaService.buscarLogs(filtros),
          auditoriaService.buscarEstatisticas(filtros)
        ]);
        setLogs(logsData);
        setEstatisticas(statsData);
      } else if (abaSelecionada === 'configuracoes') {
        const configData = await auditoriaService.buscarConfiguracao();
        setConfiguracao(configData);
      } else if (abaSelecionada === 'alertas') {
        const alertasData = await auditoriaService.buscarAlertasAuditoria();
        setAlertas(alertasData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const exportarLogs = async (formato: 'xlsx' | 'csv') => {
    setExportando(true);
    try {
      const dados = await auditoriaService.exportarLogs(filtros, formato);
      const blob = new Blob([dados], { 
        type: formato === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria-logs-${new Date().toISOString().split('T')[0]}.${formato}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Erro ao exportar logs');
    } finally {
      setExportando(false);
    }
  };

  const salvarConfiguracao = async () => {
    if (!configuracao) return;

    try {
      await auditoriaService.atualizarConfiguracao(configuracao);
      alert('Configuração salva com sucesso!');
    } catch (error) {
      alert('Erro ao salvar configuração');
    }
  };

  const getAcaoIcon = (acao: string) => {
    switch (acao) {
      case 'login':
        return <LogIn className="w-4 h-4 text-green-600" />;
      case 'logout':
        return <LogOut className="w-4 h-4 text-gray-600" />;
      case 'criar':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'editar':
        return <Edit className="w-4 h-4 text-yellow-600" />;
      case 'excluir':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'enviar':
        return <Send className="w-4 h-4 text-purple-600" />;
      case 'exportar':
        return <Download className="w-4 h-4 text-orange-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAcaoColor = (acao: string) => {
    switch (acao) {
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'logout':
        return 'bg-gray-100 text-gray-800';
      case 'criar':
        return 'bg-blue-100 text-blue-800';
      case 'editar':
        return 'bg-yellow-100 text-yellow-800';
      case 'excluir':
        return 'bg-red-100 text-red-800';
      case 'enviar':
        return 'bg-purple-100 text-purple-800';
      case 'exportar':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiscoColor = (nivel: string) => {
    switch (nivel) {
      case 'alto':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medio':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'baixo':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Auditoria e Logs do Sistema</h1>
              <p className="text-gray-600">Rastreamento completo de ações e controle de acesso</p>
            </div>
          </div>
          
          {abaSelecionada === 'logs' && (
            <div className="flex space-x-3">
              <button
                onClick={() => exportarLogs('csv')}
                disabled={exportando}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportando ? 'Exportando...' : 'CSV'}
              </button>
              <button
                onClick={() => exportarLogs('xlsx')}
                disabled={exportando}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {exportando ? 'Exportando...' : 'Excel'}
              </button>
              <button
                onClick={carregarDados}
                disabled={carregando}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          )}
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'logs', label: 'Histórico de Ações', icon: Activity },
              { id: 'alertas', label: 'Alertas de Auditoria', icon: Bell },
              { id: 'configuracoes', label: 'Configurações', icon: Settings }
            ].map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {aba.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Estatísticas */}
        {abaSelecionada === 'logs' && estatisticas && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{estatisticas.total_acoes}</div>
              <div className="text-sm text-blue-800">Total de Ações</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{estatisticas.usuarios_ativos}</div>
              <div className="text-sm text-green-800">Usuários Ativos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{estatisticas.acoes_hoje}</div>
              <div className="text-sm text-yellow-800">Ações Hoje</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{estatisticas.alertas_ativos}</div>
              <div className="text-sm text-red-800">Alertas Ativos</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{estatisticas.acoes_sensíveis}</div>
              <div className="text-sm text-purple-800">Ações Sensíveis</div>
            </div>
          </div>
        )}

        {/* Conteúdo das abas */}
        {abaSelecionada === 'logs' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input
                  type="text"
                  value={filtros.usuario || ''}
                  onChange={(e) => setFiltros({...filtros, usuario: e.target.value})}
                  placeholder="Usuário"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                
                <select
                  value={filtros.acao || ''}
                  onChange={(e) => setFiltros({...filtros, acao: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas as Ações</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="criar">Criar</option>
                  <option value="editar">Editar</option>
                  <option value="excluir">Excluir</option>
                  <option value="enviar">Enviar</option>
                  <option value="exportar">Exportar</option>
                </select>
                
                <select
                  value={filtros.entidade || ''}
                  onChange={(e) => setFiltros({...filtros, entidade: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas as Entidades</option>
                  <option value="cobranca">Cobrança</option>
                  <option value="unidade">Unidade</option>
                  <option value="reuniao">Reunião</option>
                  <option value="acordo">Acordo</option>
                  <option value="usuario">Usuário</option>
                </select>
                
                <input
                  type="date"
                  value={filtros.data_inicio || ''}
                  onChange={(e) => setFiltros({...filtros, data_inicio: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                
                <input
                  type="date"
                  value={filtros.data_fim || ''}
                  onChange={(e) => setFiltros({...filtros, data_fim: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
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
                      Entidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Detalhes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP/Canal
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                          Carregando logs...
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Nenhum log encontrado
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatarData(log.data_acao)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{log.usuario}</div>
                              <div className="text-sm text-gray-500">{log.usuario_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getAcaoIcon(log.acao)}
                            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getAcaoColor(log.acao)}`}>
                              {log.acao.toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{log.entidade_afetada}</div>
                            <div className="text-sm text-gray-500">{log.entidade_id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={log.detalhes}>
                            {log.detalhes}
                          </div>
                          {log.valores_envolvidos && (
                            <div className="text-sm text-green-600">
                              {formatarValor(log.valores_envolvidos)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{log.ip_origem}</div>
                          <div className="text-sm text-gray-500">{log.canal_origem}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {abaSelecionada === 'alertas' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Alertas de Auditoria</h3>
            
            {alertas.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum alerta de auditoria ativo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertas.map((alerta) => (
                  <div key={alerta.id} className={`border rounded-lg p-6 ${getRiscoColor(alerta.nivel_risco)}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800">{alerta.titulo}</h4>
                          <p className="text-gray-600">{alerta.descricao}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiscoColor(alerta.nivel_risco)}`}>
                        {alerta.nivel_risco.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Detectado em:</span> {formatarData(alerta.data_deteccao)}
                      </div>
                      <div>
                        <span className="font-medium">Usuário:</span> {alerta.usuario_envolvido}
                      </div>
                      <div>
                        <span className="font-medium">Entidade:</span> {alerta.entidade_afetada}
                      </div>
                    </div>
                    
                    {alerta.acao_recomendada && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <span className="font-medium text-blue-800">Ação Recomendada:</span>
                        <p className="text-blue-700">{alerta.acao_recomendada}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaSelecionada === 'configuracoes' && configuracao && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Configurações de Auditoria</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Ações Registradas</h4>
                <div className="space-y-3">
                  {Object.entries(configuracao.acoes_registradas).map(([acao, ativo]) => (
                    <div key={acao} className="flex items-center justify-between">
                      <span className="text-gray-700 capitalize">{acao.replace('_', ' ')}</span>
                      <input
                        type="checkbox"
                        checked={ativo}
                        onChange={(e) => setConfiguracao({
                          ...configuracao,
                          acoes_registradas: {
                            ...configuracao.acoes_registradas,
                            [acao]: e.target.checked
                          }
                        })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">Alertas Automáticos</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor limite para alerta (R$)
                    </label>
                    <input
                      type="number"
                      value={configuracao.valor_limite_alerta}
                      onChange={(e) => setConfiguracao({
                        ...configuracao,
                        valor_limite_alerta: parseFloat(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tentativas de login para alerta
                    </label>
                    <input
                      type="number"
                      value={configuracao.tentativas_login_alerta}
                      onChange={(e) => setConfiguracao({
                        ...configuracao,
                        tentativas_login_alerta: parseInt(e.target.value) || 3
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tempo de retenção (meses)
                    </label>
                    <input
                      type="number"
                      value={configuracao.tempo_retencao_meses}
                      onChange={(e) => setConfiguracao({
                        ...configuracao,
                        tempo_retencao_meses: parseInt(e.target.value) || 12
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Backup e Integração</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="backup_automatico"
                    checked={configuracao.backup_automatico}
                    onChange={(e) => setConfiguracao({
                      ...configuracao,
                      backup_automatico: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="backup_automatico" className="ml-2 text-sm text-gray-700">
                    Backup automático dos logs
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="notificacao_alertas"
                    checked={configuracao.notificacao_alertas}
                    onChange={(e) => setConfiguracao({
                      ...configuracao,
                      notificacao_alertas: e.target.checked
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="notificacao_alertas" className="ml-2 text-sm text-gray-700">
                    Notificações de alertas por email
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={salvarConfiguracao}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Salvar Configurações
            </button>
          </div>
        )}
      </div>
    </div>
  );
}