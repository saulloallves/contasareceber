import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, Plus, Edit, Eye, Shield,
  CheckCircle, XCircle, Filter,
  RefreshCw, Lock, Unlock, AlertTriangle, Settings,
  Globe, MapPin, Building2, BarChart3, Download, Wifi, WifiOff, Clock
} from 'lucide-react';
import { ConfiguracaoService } from '../../services/configuracaoService';
import { sessaoService, UsuarioOnline } from '../../services/sessaoService';
import { Usuario, EstatisticasUsuarios, FiltrosUsuarios, LogSeguranca } from '../../types/configuracao';

export function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosOnline, setUsuariosOnline] = useState<UsuarioOnline[]>([]);
  const [estatisticasSessoes, setEstatisticasSessoes] = useState<any>(null);
  const [estatisticas, setEstatisticas] = useState<EstatisticasUsuarios | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<'criar' | 'editar' | 'permissoes' | 'logs' | null>(null);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState<Partial<Usuario>>({});
  const [filtros, setFiltros] = useState<FiltrosUsuarios>({});
  const [abaSelecionada, setAbaSelecionada] = useState<'usuarios' | 'sessoes' | 'estatisticas'>('usuarios');
  const [senhaGerada, setSenhaGerada] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const configuracaoService = useMemo(() => new ConfiguracaoService(), []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      console.log('🔄 Carregando dados com filtros:', filtros);
      
      const [usuariosData, statsData, usuariosOnlineData, statsSessoesData] = await Promise.all([
        configuracaoService.buscarUsuarios(filtros),
        configuracaoService.buscarEstatisticasUsuarios(),
        sessaoService.buscarUsuariosOnline(),
        sessaoService.buscarEstatisticasSessoes()
      ]);
      
      console.log('👥 Usuários carregados:', usuariosData.length, usuariosData);
      console.log('📊 Estatísticas carregadas:', statsData);
      console.log('🟢 Usuários online:', usuariosOnlineData.length, usuariosOnlineData);
      
      setUsuarios(usuariosData);
      setUsuariosOnline(usuariosOnlineData);
      setEstatisticasSessoes(statsSessoesData);
      setEstatisticas(statsData);

    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setCarregando(false);
    }
  }, [configuracaoService, filtros]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // removido: usamos a versão memoizada acima

  const abrirModalCriar = () => {
    setFormData({
      nome_completo: '',
      email: '',
      telefone: '',
      cargo: '',
      nivel_permissao: 'observador',
      ativo: true,
      verificacao_ip_ativa: false
    });
    setSenhaGerada('');
    setMostrarSenha(false);
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


  const fecharModal = () => {
    setModalAberto(null);
    setUsuarioSelecionado(null);
    setFormData({});
    setSenhaGerada('');
    setMostrarSenha(false);
  };

  const forcarLogout = async (usuarioId: string, nomeUsuario: string) => {
    if (!confirm(`Tem certeza que deseja forçar o logout de ${nomeUsuario}?`)) {
      return;
    }

    try {
      await sessaoService.forcarLogoutUsuario(usuarioId);
      alert('Logout forçado com sucesso!');
      carregarDados();
    } catch (error) {
      alert(`Erro ao forçar logout: ${error}`);
    }
  };

  const limparSessoesExpiradas = async () => {
    try {
      const sessoesLimpas = await sessaoService.limparSessoesExpiradas();
      alert(`${sessoesLimpas} sessões expiradas foram limpas`);
      carregarDados();
    } catch (error) {
      alert(`Erro ao limpar sessões: ${error}`);
    }
  };

  const verificarStatusOnline = (usuarioId: string): boolean => {
    return usuariosOnline.some(u => u.usuario_id === usuarioId);
  };

  const obterDadosSessao = (usuarioId: string): UsuarioOnline | null => {
    return usuariosOnline.find(u => u.usuario_id === usuarioId) || null;
  };
  const gerarSenha = async () => {
    try {
      // Busca configurações de segurança para gerar senha conforme as regras
      const configSeguranca = await configuracaoService.buscarConfiguracaoSeguranca();
      
      const comprimento = Math.max(configSeguranca.senha_comprimento_minimo, 12);
      let caracteres = '';
      
      // Caracteres obrigatórios baseados na configuração
      if (configSeguranca.senha_requer_minuscula) {
        caracteres += 'abcdefghijklmnopqrstuvwxyz';
      }
      if (configSeguranca.senha_requer_maiuscula) {
        caracteres += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      }
      if (configSeguranca.senha_requer_numero) {
        caracteres += '0123456789';
      }
      if (configSeguranca.senha_requer_especial) {
        caracteres += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      }
      
      // Se nenhuma regra específica, usa caracteres básicos
      if (!caracteres) {
        caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      }
      
      let senha = '';
      
      // Garante pelo menos um caractere de cada tipo obrigatório
      if (configSeguranca.senha_requer_minuscula) {
        senha += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
      }
      if (configSeguranca.senha_requer_maiuscula) {
        senha += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
      }
      if (configSeguranca.senha_requer_numero) {
        senha += '0123456789'[Math.floor(Math.random() * 10)];
      }
      if (configSeguranca.senha_requer_especial) {
        senha += '!@#$%^&*'[Math.floor(Math.random() * 8)];
      }
      
      // Completa o resto da senha com caracteres aleatórios
      for (let i = senha.length; i < comprimento; i++) {
        senha += caracteres[Math.floor(Math.random() * caracteres.length)];
      }
      
      // Embaralha a senha para não ter padrão previsível
      senha = senha.split('').sort(() => Math.random() - 0.5).join('');
      
      setSenhaGerada(senha);
      setMostrarSenha(true);
    } catch (error) {
      console.error('Erro ao gerar senha:', error);
      alert('Erro ao gerar senha. Usando configuração padrão.');
      
      // Fallback: gera senha simples se não conseguir buscar configurações
      const senhaFallback = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-4).toUpperCase() + Math.floor(Math.random() * 100);
      setSenhaGerada(senhaFallback);
      setMostrarSenha(true);
    }
  };

  const copiarSenha = () => {
    navigator.clipboard.writeText(senhaGerada).then(() => {
      alert('Senha copiada para a área de transferência!');
    }).catch(() => {
      alert('Não foi possível copiar a senha. Copie manualmente.');
    });
  };

  const salvarUsuario = async () => {
    if (!formData.nome_completo || !formData.email || !formData.nivel_permissao) {
      alert('Nome, email e nível de permissão são obrigatórios');
      return;
    }

    try {
      if (modalAberto === 'criar') {
        if (!senhaGerada) {
          alert('Gere uma senha para o usuário antes de criar a conta');
          return;
        }
        
        await configuracaoService.criarUsuarioAdmin({
          ...(formData as Omit<Usuario, 'id' | 'created_at' | 'updated_at'>),
          password: senhaGerada,
        });
        
        alert(`Usuário criado com sucesso!\n\nSenha gerada: ${senhaGerada}\n\nAnote esta senha e repasse ao usuário com segurança.`);
      } else if (modalAberto === 'editar' && usuarioSelecionado) {
        await configuracaoService.atualizarUsuario(
          usuarioSelecionado.id!,
          formData,
          'usuario_atual'
        );
      }
      
      fecharModal();
      carregarDados();
    } catch (e) {
     const errorMessage = e instanceof Error ? e.message : String(e);
     alert(`Erro ao salvar usuário: ${errorMessage}`);
    }
  };

  const alterarStatus = async (id: string, novoStatus: boolean) => {
    try {
      console.log('🔄 Alterando status do usuário:', id, 'para:', novoStatus);
      
      await configuracaoService.atualizarUsuario(
        id,
        { ativo: novoStatus },
        'usuario_atual'
      );
      
      console.log('✅ Status alterado com sucesso');
      carregarDados();
    } catch (e) {
      console.error('❌ Erro ao alterar status:', e);
      alert(`Erro ao alterar status do usuário: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
    }
  };

  const bloquearUsuario = async (id: string) => {
    const motivo = prompt('Motivo do bloqueio:');
    if (!motivo) return;

    try {
      console.log('🔒 Iniciando bloqueio do usuário:', id);
      await configuracaoService.bloquearUsuario(id, motivo, 24);
      console.log('✅ Usuário bloqueado com sucesso');
      alert('Usuário bloqueado por 24 horas com sucesso!');
      carregarDados();
    } catch (error: any) {
      console.error('❌ Erro ao bloquear usuário:', error);
      alert(`Erro ao bloquear usuário: ${error?.message || error}`);
    }
  };

  const exportarDados = async () => {
    try {
      const dados = usuarios.map(u => ({
        nome: u.nome_completo,
        email: u.email,
        cargo: u.cargo,
        nivel: u.nivel_permissao,
        status: u.ativo ? 'Ativo' : 'Inativo',
        online: verificarStatusOnline(u.id!) ? 'Online' : 'Offline',
        ultimo_acesso: u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString('pt-BR') : 'Nunca'
      }));

      const csv = [
        'Nome,Email,Cargo,Nível,Status,Online,Último Acesso',
        ...dados.map(d => `${d.nome},${d.email},${d.cargo},${d.nivel},${d.status},${d.online},${d.ultimo_acesso}`)
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
    } catch {
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

  const formatarTempoSessao = (minutos: number) => {
    if (minutos < 60) {
      return `${minutos}min`;
    }
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    return `${horas}h ${minutosRestantes}min`;
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
          {abaSelecionada === 'sessoes' && (
            <button
              onClick={limparSessoesExpiradas}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Clock className="w-4 h-4 mr-2" />
              Limpar Expiradas
            </button>
          )}
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
            { id: 'sessoes', label: 'Sessões Online', icon: Wifi },
            { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 }
          ].map((aba) => {
            const Icon = aba.icon;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaSelecionada(aba.id as 'usuarios' | 'sessoes' | 'estatisticas')}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  abaSelecionada === aba.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {aba.label}
                {aba.id === 'sessoes' && usuariosOnline.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full">
                    {usuariosOnline.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{estatisticas.total_usuarios}</div>
            <div className="text-sm text-blue-800">Total de Usuários</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{estatisticas.usuarios_ativos}</div>
            <div className="text-sm text-green-800">Usuários Ativos</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-emerald-600">{usuariosOnline.length}</div>
            <div className="text-sm text-emerald-800">Online Agora</div>
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Online
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
                    usuarios.map((usuario) => {
                      const isOnline = verificarStatusOnline(usuario.id!);
                      const dadosSessao = obterDadosSessao(usuario.id!);
                      
                      return (
                        <tr key={usuario.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="relative">
                                {usuario.avatar_url ? (
                                  <img
                                    src={usuario.avatar_url}
                                    alt={usuario.nome_completo}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                                    <Users className="w-6 h-6 text-white" />
                                  </div>
                                )}
                                {/* Indicador de status online */}
                                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 border-2 border-white rounded-full ${
                                  isOnline ? 'bg-green-400' : 'bg-gray-400'
                                }`}></div>
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {isOnline ? (
                                <Wifi className="w-5 h-5 text-green-600 mr-2" />
                              ) : (
                                <WifiOff className="w-5 h-5 text-gray-400 mr-2" />
                              )}
                              <div>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  isOnline 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                                {dadosSessao && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formatarTempoSessao(dadosSessao.tempo_sessao_minutos)}
                                  </div>
                                )}
                              </div>
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
                              {isOnline && (
                                <button
                                  onClick={() => forcarLogout(usuario.id!, usuario.nome_completo)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Forçar logout"
                                >
                                  <WifiOff className="w-4 h-4" />
                                </button>
                              )}
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaSelecionada === 'sessoes' && (
        <div className="space-y-6">
          {/* Estatísticas de Sessões */}
          {estatisticasSessoes && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{estatisticasSessoes.usuarios_online}</div>
                <div className="text-sm text-green-800">Usuários Online</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{estatisticasSessoes.sessoes_ativas}</div>
                <div className="text-sm text-blue-800">Sessões Ativas</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{estatisticasSessoes.tempo_medio_sessao}min</div>
                <div className="text-sm text-purple-800">Tempo Médio</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{estatisticasSessoes.picos_acesso_hoje}</div>
                <div className="text-sm text-yellow-800">Acessos Hoje</div>
              </div>
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-800">Usuários Online</h3>
          
          {usuariosOnline.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
              <WifiOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum usuário online no momento</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tempo de Sessão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Último Acesso
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usuariosOnline.map((usuarioOnline) => (
                      <tr key={usuarioOnline.usuario_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="relative">
                              {usuarioOnline.avatar_url ? (
                                <img
                                  src={usuarioOnline.avatar_url}
                                  alt={usuarioOnline.nome_completo}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-md">
                                  <Users className="w-5 h-5 text-white" />
                                </div>
                              )}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{usuarioOnline.nome_completo}</div>
                              <div className="text-sm text-gray-600">{usuarioOnline.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-sm font-medium text-green-600">
                              {formatarTempoSessao(usuarioOnline.tempo_sessao_minutos)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatarData(usuarioOnline.data_ultimo_acesso)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {usuarioOnline.ip_origem}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => forcarLogout(usuarioOnline.usuario_id, usuarioOnline.nome_completo)}
                            className="text-red-600 hover:text-red-900"
                            title="Forçar logout"
                          >
                            <WifiOff className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <h4 className="font-semibold text-gray-800 mb-4">Atividade do Sistema</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Logins este mês</span>
                  <span className="font-medium">{estatisticas.logins_mes_atual}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Tentativas bloqueadas</span>
                  <span className="font-medium">{estatisticas.tentativas_bloqueadas}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Usuários online agora</span>
                  <span className="font-medium text-green-600">{usuariosOnline.length}</span>
                </div>
                {estatisticasSessoes && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Tempo médio de sessão</span>
                    <span className="font-medium">{estatisticasSessoes.tempo_medio_sessao} min</span>
                  </div>
                )}
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
                  onChange={(e) => setFormData({...formData, nivel_permissao: e.target.value as Usuario['nivel_permissao']})}
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
              
              {modalAberto === 'criar' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senhaGerada}
                        onChange={(e) => setSenhaGerada(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Clique em 'Gerar Senha' ou digite uma senha"
                      />
                      {senhaGerada && (
                        <button
                          type="button"
                          onClick={() => setMostrarSenha(!mostrarSenha)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {mostrarSenha ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={gerarSenha}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap"
                    >
                      Gerar Senha
                    </button>
                    {senhaGerada && (
                      <button
                        type="button"
                        onClick={copiarSenha}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                        title="Copiar senha"
                      >
                        📋
                      </button>
                    )}
                  </div>
                  {senhaGerada && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Senha gerada conforme as regras de segurança do sistema
                    </p>
                  )}
                </div>
              )}
              
            </div>
            
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