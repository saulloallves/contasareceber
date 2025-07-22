import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Edit, Trash2, Eye, EyeOff, Shield, 
  Mail, Phone, Calendar, CheckCircle, XCircle, Filter,
  Search, RefreshCw, Lock, Unlock, AlertTriangle, Settings,
  Globe, MapPin, Building2, BarChart3, Download
} from 'lucide-react';
import { ConfiguracaoService } from '../../services/configuracaoService';
import { Usuario, PermissaoUsuario, EstatisticasUsuarios, FiltrosUsuarios, LogSeguranca } from '../../types/configuracao';

export function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasUsuarios | null>(null);
  const [logsSeguranca, setLogsSeguranca] = useState<LogSeguranca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | 'permissoes' | 'logs' | null>(null);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<Partial<Usuario>>({});
  const [filtros, setFiltros] = useState<FiltrosUsuarios>({});
  const [abaSelecionada, setAbaSelecionada] = useState<'usuarios' | 'logs' | 'estatisticas'>('usuarios');

  const configuracaoService = new ConfiguracaoService();

  useEffect(() => {
    carregarDados();
  }, [filtros, abaSelecionada]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [usuariosData, statsData] = await Promise.all([
        configuracaoService.buscarUsuarios(filtros),
        configuracaoService.buscarEstatisticasUsuarios()
      ]);
      
      setUsuarios(usuariosData);
      setEstatisticas(statsData);

      if (abaSelecionada === 'logs') {
        const logsData = await configuracaoService.buscarLogsSeguranca({
          dataInicio: filtros.data_inicio,
          dataFim: filtros.data_fim,
          limite: 50
        });
        setLogsSeguranca(logsData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalCriar = () => {
    setFormData({
      nome_completo: '',
      email: '',
      telefone: '',
      cargo: '',
      nivel_permissao: 'observador',
      area_atuacao: 'global',
      ativo: true,
      verificacao_ip_ativa: false
    });
    setModalAberto('criar');
  };

  const abrirModalEditar = (usuario: Usuario) => {
    setUsuarioSelecionado(usuario);
    setFormData(usuario);
    setModalAberto('editar');
  };

  const abrirModalPermissoes = (usuario: Usuario) => {
    setUsuarioSelecionado(usuario);
    setFormData(usuario);
    setModalAberto('permissoes');
  };

  const abrirModalLogs = (usuario: Usuario) => {
    setUsuarioSelecionado(usuario);
    setModalAberto('logs');
  };

  const fecharModal = () => {
    setModalAberto(null);
    setUsuarioSelecionado(null);
    setFormData({});
  };

  const salvarUsuario = async () => {
    if (!formData.nome_completo || !formData.email || !formData.nivel_permissao) {
      alert('Nome, email e nível de permissão são obrigatórios');
      return;
    }

    try {
      if (modalAberto === 'criar') {
        await configuracaoService.criarUsuario(formData as Omit<Usuario, 'id' | 'created_at' | 'updated_at'>);
      } else if (modalAberto === 'editar' && usuarioSelecionado) {
        await configuracaoService.atualizarUsuario(
          usuarioSelecionado.id!,
          formData,
          'usuario_atual'
        );
      }
      
      fecharModal();
      carregarDados();
    } catch (error) {
      alert(`Erro ao salvar usuário: ${error}`);
    }
  };

  const alterarStatus = async (id: string, novoStatus: boolean) => {
    try {
      await configuracaoService.atualizarUsuario(
        id,
        { ativo: novoStatus },
        'usuario_atual'
      );
      carregarDados();
    } catch (error) {
      alert(`Erro ao alterar status: ${error}`);
    }
  };

  const bloquearUsuario = async (id: string) => {
    const motivo = prompt('Motivo do bloqueio:');
    if (!motivo) return;

    try {
      await configuracaoService.bloquearUsuario(id, motivo, 24);
      alert('Usuário bloqueado por 24 horas');
      carregarDados();
    } catch (error) {
      alert(`Erro ao bloquear usuário: ${error}`);
    }
  };

  const exportarDados = async () => {
    try {
      const dados = usuarios.map(u => ({
        nome: u.nome_completo,
        email: u.email,
        cargo: u.cargo,
        nivel: u.nivel_permissao,
        area: u.area_atuacao,
        status: u.ativo ? 'Ativo' : 'Inativo',
        ultimo_acesso: u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : 'Nunca'
      }));

      const csv = [
        'Nome,Email,Cargo,Nível,Área,Status,Último Acesso',
        ...dados.map(d => `${d.nome},${d.email},${d.cargo},${d.nivel},${d.area},${d.status},${d.ultimo_acesso}`)
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usuarios-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Erro ao exportar dados');
    }
  };

  const getPermissaoLabel = (nivel: string) => {
    const permissoes = configuracaoService.getPermissoesPorNivel();
    return permissoes[nivel]?.nivel || nivel;
  };

  const getPermissaoColor = (nivel: string) => {
    const colors: Record<string, string> = {
      'admin_master': 'bg-red-100 text-red-800',
      'gestor_juridico': 'bg-purple-100 text-purple-800',
      'cobranca': 'bg-blue-100 text-blue-800',
      'analista_financeiro': 'bg-green-100 text-green-800',
      'gestor_regional': 'bg-yellow-100 text-yellow-800',
      'suporte': 'bg-gray-100 text-gray-800',
      'franqueado': 'bg-orange-100 text-orange-800',
      'observador': 'bg-indigo-100 text-indigo-800'
    };
    return colors[nivel] || 'bg-gray-100 text-gray-800';
  };

  const getAreaIcon = (area: string) => {
    switch (area) {
      case 'global': return <Globe className="w-4 h-4" />;
      case 'regional': return <MapPin className="w-4 h-4" />;
      case 'unidade_especifica': return <Building2 className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getTipoEventoColor = (tipo: string) => {
    switch (tipo) {
      case 'login_sucesso': return 'bg-green-100 text-green-800';
      case 'login_falha': return 'bg-red-100 text-red-800';
      case 'acesso_negado': return 'bg-orange-100 text-orange-800';
      case 'ip_suspeito': return 'bg-purple-100 text-purple-800';
      case 'bloqueio_automatico': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Usuários e Acessos</h1>
          <p className="text-gray-600">Controle completo de usuários, permissões e segurança</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportarDados}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </button>
          <button
            onClick={abrirModalCriar}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'usuarios', label: 'Usuários', icon: Users },
            { id: 'logs', label: 'Logs de Segurança', icon: Shield },
            { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 }
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
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{estatisticas.total_usuarios}</div>
            <div className="text-sm text-blue-800">Total de Usuários</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{estatisticas.usuarios_ativos}</div>
            <div className="text-sm text-green-800">Usuários Ativos</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{estatisticas.usuarios_inativos}</div>
            <div className="text-sm text-red-800">Usuários Inativos</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">{estatisticas.logins_mes_atual}</div>
            <div className="text-sm text-purple-800">Logins Este Mês</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">{estatisticas.tentativas_bloqueadas}</div>
            <div className="text-sm text-orange-800">Tentativas Bloqueadas</div>
          </div>
        </div>
      )}

      {/* Conteúdo das Abas */}
      {abaSelecionada === 'usuarios' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Filter className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={filtros.nivel_permissao || ''}
                onChange={(e) => setFiltros({...filtros, nivel_permissao: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as Permissões</option>
                <option value="admin_master">Admin Master</option>
                <option value="cobranca">Cobrança</option>
                <option value="gestor_juridico">Gestor Jurídico</option>
                <option value="analista_financeiro">Analista Financeiro</option>
                <option value="gestor_regional">Gestor Regional</option>
                <option value="suporte">Suporte</option>
                <option value="observador">Observador</option>
              </select>
              <select
                value={filtros.ativo !== undefined ? filtros.ativo.toString() : ''}
                onChange={(e) => setFiltros({...filtros, ativo: e.target.value ? e.target.value === 'true' : undefined})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Status</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <select
                value={filtros.area_atuacao || ''}
                onChange={(e) => setFiltros({...filtros, area_atuacao: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as Áreas</option>
                <option value="global">Global</option>
                <option value="regional">Regional</option>
                <option value="unidade_especifica">Unidade Específica</option>
              </select>
              <input
                type="text"
                value={filtros.busca || ''}
                onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
                placeholder="Buscar por nome, email ou cargo"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setFiltros({})}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Permissão
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Área de Atuação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Último Acesso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                          Carregando usuários...
                        </div>
                      </td>
                    </tr>
                  ) : usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => (
                      <tr key={usuario.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <Users className="w-6 h-6 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{usuario.nome_completo}</div>
                              <div className="text-sm text-gray-600">{usuario.email}</div>
                              <div className="text-xs text-gray-500">{usuario.cargo}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissaoColor(usuario.nivel_permissao)}`}>
                            {getPermissaoLabel(usuario.nivel_permissao)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            {getAreaIcon(usuario.area_atuacao || 'global')}
                            <span className="ml-2">{usuario.area_atuacao?.replace('_', ' ').toUpperCase() || 'GLOBAL'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {usuario.ativo ? (
                              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 mr-2" />
                            )}
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              usuario.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {usuario.ativo ? 'ATIVO' : 'INATIVO'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usuario.ultimo_acesso ? formatarData(usuario.ultimo_acesso) : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => abrirModalEditar(usuario)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar usuário"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalPermissoes(usuario)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Configurar permissões"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalLogs(usuario)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Ver logs"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => alterarStatus(usuario.id!, !usuario.ativo)}
                              className={`${usuario.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                              title={usuario.ativo ? 'Desativar' : 'Ativar'}
                            >
                              {usuario.ativo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            {usuario.ativo && (
                              <button
                                onClick={() => bloquearUsuario(usuario.id!)}
                                className="text-orange-600 hover:text-orange-900"
                                title="Bloquear temporariamente"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaSelecionada === 'logs' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Logs de Segurança</h3>
          
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
                    Evento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logsSeguranca.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarData(log.data_evento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(log as any).usuarios_sistema?.nome_completo || log.email_tentativa}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoEventoColor(log.tipo_evento)}`}>
                        {log.tipo_evento.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip_origem}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.detalhes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaSelecionada === 'estatisticas' && estatisticas && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Estatísticas de Usuários</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Distribuição por Nível</h4>
              <div className="space-y-3">
                {Object.entries(estatisticas.por_nivel).map(([nivel, quantidade]) => (
                  <div key={nivel} className="flex justify-between items-center">
                    <span className="text-gray-700">{getPermissaoLabel(nivel)}</span>
                    <span className="font-medium">{quantidade}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Distribuição por Área</h4>
              <div className="space-y-3">
                {Object.entries(estatisticas.por_area).map(([area, quantidade]) => (
                  <div key={area} className="flex justify-between items-center">
                    <div className="flex items-center">
                      {getAreaIcon(area)}
                      <span className="ml-2 text-gray-700">{area.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <span className="font-medium">{quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {(modalAberto === 'criar' || modalAberto === 'editar') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {modalAberto === 'criar' ? 'Novo Usuário' : 'Editar Usuário'}
              </h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={formData.nome_completo || ''}
                  onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@exemplo.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="tel"
                  value={formData.telefone || ''}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  value={formData.cargo || ''}
                  onChange={(e) => setFormData({...formData, cargo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Cargo do usuário"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Permissão *</label>
                <select
                  value={formData.nivel_permissao || 'observador'}
                  onChange={(e) => setFormData({...formData, nivel_permissao: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="observador">Observador</option>
                  <option value="suporte">Suporte</option>
                  <option value="analista_financeiro">Analista Financeiro</option>
                  <option value="cobranca">Cobrança</option>
                  <option value="gestor_regional">Gestor Regional</option>
                  <option value="gestor_juridico">Gestor Jurídico</option>
                  <option value="admin_master">Admin Master</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área de Atuação</label>
                <select
                  value={formData.area_atuacao || 'global'}
                  onChange={(e) => setFormData({...formData, area_atuacao: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="global">Global</option>
                  <option value="regional">Regional</option>
                  <option value="unidade_especifica">Unidade Específica</option>
                </select>
              </div>
            </div>

            {formData.area_atuacao === 'unidade_especifica' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Código da Unidade</label>
                <input
                  type="text"
                  value={formData.codigo_unidade_vinculada || ''}
                  onChange={(e) => setFormData({...formData, codigo_unidade_vinculada: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Código da unidade específica"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-6 mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo !== false}
                  onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="ml-2 text-sm font-medium text-gray-700">
                  Usuário ativo
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="verificacao_ip"
                  checked={formData.verificacao_ip_ativa || false}
                  onChange={(e) => setFormData({...formData, verificacao_ip_ativa: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="verificacao_ip" className="ml-2 text-sm font-medium text-gray-700">
                  Verificação de IP ativa
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={salvarUsuario}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {modalAberto === 'criar' ? 'Criar Usuário' : 'Salvar Alterações'}
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

      {/* Modal de Permissões */}
      {modalAberto === 'permissoes' && usuarioSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Configurar Permissões - {usuarioSelecionado.nome_completo}</h3>
              <button onClick={fecharModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                Nível atual: <span className="font-medium">{getPermissaoLabel(usuarioSelecionado.nivel_permissao)}</span>
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(configuracaoService.getPermissoesPorNivel()[usuarioSelecionado.nivel_permissao]?.permissoes || {}).map(([permissao, ativo]) => (
                  <div key={permissao} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={ativo}
                      disabled
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700 capitalize">
                      {permissao.replace('_', ' ')}
                    </label>
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <Shield className="w-4 h-4 inline mr-1" />
                  As permissões são definidas pelo nível de acesso. Para alterar permissões específicas, 
                  edite o usuário e altere seu nível de permissão.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}