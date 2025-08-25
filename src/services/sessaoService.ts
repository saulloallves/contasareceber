/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './databaseService';
import { connectionService } from './connectionService';

export interface SessaoUsuario {
  id?: string;
  usuario_id: string;
  token_sessao: string;
  ip_origem: string;
  user_agent?: string;
  data_inicio: string;
  data_ultimo_acesso: string;
  ativa: boolean;
  created_at?: string;
}

export interface UsuarioOnline {
  usuario_id: string;
  nome_completo: string;
  email: string;
  avatar_url?: string;
  data_ultimo_acesso: string;
  ip_origem: string;
  tempo_sessao_minutos: number;
  ativa: boolean;
}

export class SessaoService {
  /**
   * Cria nova sessão quando usuário faz login
   */
  async criarSessao(usuarioId: string): Promise<string> {
    console.log('🔄 Iniciando criação de sessão para usuário:', usuarioId);
    
    // Verifica se já existe uma sessão ativa no sessionStorage
    const sessionKey = `active_session_${usuarioId}`;
    const existingToken = sessionStorage.getItem(sessionKey);
    
    if (existingToken) {
      console.log('🔄 Verificando sessão existente no sessionStorage...');
      
      // Verifica se a sessão ainda é válida no banco
      const { data: sessaoValida, error } = await supabase
        .from('sessoes_usuario')
        .select('id, token_sessao')
        .eq('token_sessao', existingToken)
        .eq('ativa', true)
        .eq('usuario_id', usuarioId)
        .maybeSingle();
      
      if (!error && sessaoValida) {
        console.log('✅ Sessão existente válida, reutilizando...');
        // Atualiza último acesso da sessão existente
        await this.atualizarUltimoAcesso(existingToken);
        this.iniciarHeartbeat(existingToken);
        return existingToken;
      } else {
        console.log('⚠️ Sessão no sessionStorage inválida, removendo...');
        sessionStorage.removeItem(sessionKey);
      }
    }
    
    try {
      console.log('🆕 Criando nova sessão no banco de dados...');
      
      // Primeiro, desativa todas as sessões anteriores do usuário
      console.log('🔄 Desativando sessões anteriores...');
      await supabase
        .from('sessoes_usuario')
        .update({ ativa: false })
        .eq('usuario_id', usuarioId)
        .eq('ativa', true);
      
      // Gera token único para a sessão
      const tokenSessao = this.gerarTokenSessao();
      
      // Obtém informações do navegador
      const ipOrigem = await this.obterIP();
      const userAgent = navigator.userAgent;

      // Cria nova sessão
      const { data, error } = await supabase
        .from('sessoes_usuario')
        .insert({
          usuario_id: usuarioId,
          token_sessao: tokenSessao,
          ip_origem: ipOrigem,
          user_agent: userAgent,
          data_inicio: new Date().toISOString(),
          data_ultimo_acesso: new Date().toISOString(),
          ativa: true
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar sessão: ${error.message}`);
      }

      console.log('✅ Sessão criada com sucesso:', data.id);
      
      // Salva token no sessionStorage para manter sessão apenas durante a aba
      sessionStorage.setItem(sessionKey, tokenSessao);
      localStorage.setItem('session_token', tokenSessao);

      // Inicia heartbeat para manter sessão ativa
      this.iniciarHeartbeat(tokenSessao);

      return tokenSessao;
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
      throw error;
    }
  }

  /**
   * Atualiza último acesso da sessão (heartbeat)
   */
  async atualizarUltimoAcesso(tokenSessao?: string): Promise<void> {
    try {
      const token = tokenSessao || localStorage.getItem('session_token');
      if (!token) return;

      // console.log('💓 Atualizando heartbeat para token:', token.substring(0, 20) + '...');
      
      const { error } = await supabase
        .from('sessoes_usuario')
        .update({
          data_ultimo_acesso: new Date().toISOString()
        })
        .eq('token_sessao', token)
        .eq('ativa', true);

      if (error) {
        console.warn('⚠️ Erro ao atualizar último acesso:', error);
      } else {
        // console.log('✅ Heartbeat atualizado com sucesso');
      }
    } catch (error) {
      console.warn('⚠️ Erro ao atualizar último acesso:', error);
    }
  }

  /**
   * Encerra sessão quando usuário faz logout
   */
  async encerrarSessao(tokenSessao?: string): Promise<void> {
    try {
      const token = tokenSessao || localStorage.getItem('session_token');
      if (!token) {
        console.log('⚠️ Nenhum token encontrado para encerrar sessão');
        return;
      }
      
      console.log('🔚 Encerrando sessão para token:', token.substring(0, 20) + '...');

      const { error } = await supabase
        .from('sessoes_usuario')
        .update({
          ativa: false
        })
        .eq('token_sessao', token);

      if (error) {
        console.warn('⚠️ Erro ao encerrar sessão:', error);
      } else {
        console.log('✅ Sessão encerrada com sucesso');
      }

      // Remove tokens do storage
      const { data: currentUser } = await supabase.auth.getUser();
      if (currentUser.user) {
        sessionStorage.removeItem(`active_session_${currentUser.user.id}`);
      }
      localStorage.removeItem('session_token');

      // Para heartbeat
      this.pararHeartbeat();
    } catch (error) {
      console.warn('⚠️ Erro ao encerrar sessão:', error);
    }
  }

  /**
   * Busca usuários online
   */
  async buscarUsuariosOnline(): Promise<UsuarioOnline[]> {
    try {
      // Considera online se último acesso foi há menos de 5 minutos E sessão está ativa
      const limiteOnline = new Date();
      limiteOnline.setMinutes(limiteOnline.getMinutes() - 5);
      
      console.log('🔍 Buscando usuários online desde:', limiteOnline.toISOString());

      // Tenta buscar sessões ativas com join
      let data, error;
      
      try {
        const result = await supabase
          .from('sessoes_usuario')
          .select(`
            usuario_id,
            ip_origem,
            data_inicio,
            data_ultimo_acesso,
            ativa,
            usuarios_sistema (
              nome_completo,
              email,
              avatar_url
            )
          `)
          .eq('ativa', true)
          .gte('data_ultimo_acesso', limiteOnline.toISOString())
          .order('data_ultimo_acesso', { ascending: false });
          
        data = result.data;
        error = result.error;
      } catch (fetchError) {
        console.warn('⚠️ Erro ao buscar sessões com join, tentando sem join:', fetchError);
        
        // Fallback: busca apenas sessões sem join
        try {
          const sessionsResult = await supabase
            .from('sessoes_usuario')
            .select('usuario_id, ip_origem, data_inicio, data_ultimo_acesso, ativa')
            .eq('ativa', true)
            .gte('data_ultimo_acesso', limiteOnline.toISOString())
            .order('data_ultimo_acesso', { ascending: false });
            
          if (sessionsResult.error) {
            throw sessionsResult.error;
          }
          
          // Busca dados dos usuários separadamente
          const usuariosIds = sessionsResult.data?.map(s => s.usuario_id) || [];
          const usuariosResult = await supabase
            .from('usuarios_sistema')
            .select('id, nome_completo, email, avatar_url')
            .in('id', usuariosIds);
            
          // Combina os dados manualmente
          data = sessionsResult.data?.map(sessao => ({
            ...sessao,
            usuarios_sistema: usuariosResult.data?.find(u => u.id === sessao.usuario_id) || {
              nome_completo: 'Usuário Desconhecido',
              email: '',
              avatar_url: null
            }
          }));
          error = null;
        } catch (fallbackError) {
          console.error('❌ Fallback também falhou:', fallbackError);
          return [];
        }
      }

      if (error) {
        console.error('❌ Erro ao buscar usuários online:', error);
        return [];
      }

      console.log('👥 Sessões ativas encontradas:', data?.length || 0);
      
      return data?.map(sessao => {
        const usuario = (sessao as any).usuarios_sistema;
        const inicioSessao = new Date(sessao.data_inicio);
        const agora = new Date();
        const tempoSessaoMinutos = Math.floor((agora.getTime() - inicioSessao.getTime()) / (1000 * 60));

        console.log(`👤 Usuário online: ${usuario?.nome_completo || 'Desconhecido'} - Último acesso: ${sessao.data_ultimo_acesso}`);
        
        return {
          usuario_id: sessao.usuario_id,
          nome_completo: usuario?.nome_completo || 'Usuário Desconhecido',
          email: usuario?.email || '',
          avatar_url: usuario?.avatar_url,
          data_ultimo_acesso: sessao.data_ultimo_acesso,
          ip_origem: sessao.ip_origem,
          tempo_sessao_minutos: tempoSessaoMinutos,
          ativa: sessao.ativa
        };
      }) || [];
    } catch (error) {
      console.error('Erro ao buscar usuários online:', error);
      return [];
    }
  }

  /**
   * Verifica se usuário específico está online
   */
  async verificarUsuarioOnline(usuarioId: string): Promise<boolean> {
    try {
      const limiteOnline = new Date();
      limiteOnline.setMinutes(limiteOnline.getMinutes() - 5);

      const { data, error } = await supabase
        .from('sessoes_usuario')
        .select('id')
        .eq('usuario_id', usuarioId)
        .eq('ativa', true)
        .gte('data_ultimo_acesso', limiteOnline.toISOString())
        .limit(1);

      if (error) {
        console.warn('Erro ao verificar usuário online:', error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      console.warn('Erro ao verificar usuário online:', error);
      return false;
    }
  }

  /**
   * Limpa sessões expiradas (executar periodicamente)
   */
  async limparSessoesExpiradas(): Promise<number> {
    try {
      // Considera expirada se último acesso foi há mais de 120 segundos
      const limiteExpiracao = new Date();
      limiteExpiracao.setSeconds(limiteExpiracao.getSeconds() - 120);
      
      console.log('🧹 Limpando sessões expiradas antes de:', limiteExpiracao.toISOString());

      const { data, error } = await supabase
        .from('sessoes_usuario')
        .update({ ativa: false })
        .eq('ativa', true)
        .lt('data_ultimo_acesso', limiteExpiracao.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Erro ao limpar sessões: ${error.message}`);
      }

      console.log('✅ Sessões limpas:', data?.length || 0);
      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao limpar sessões expiradas:', error);
      return 0;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private gerarTokenSessao(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async obterIP(): Promise<string> {
    try {
      // Em produção, usar serviço real de IP
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async desativarSessoesAnteriores(usuarioId: string): Promise<void> {
    try {
      console.log('🔄 Desativando sessões anteriores para usuário:', usuarioId);
      
      const { error } = await supabase
        .from('sessoes_usuario')
        .update({ ativa: false })
        .eq('usuario_id', usuarioId)
        .eq('ativa', true);
        
      if (error) {
        console.error('❌ Erro ao desativar sessões anteriores:', error);
        throw error;
      }
        
      console.log('✅ Sessões anteriores desativadas');
    } catch (error) {
      console.error('❌ Erro ao desativar sessões anteriores:', error);
      throw error;
    }
  }

  private heartbeatInterval: number | null = null;

  private iniciarHeartbeat(tokenSessao: string): void {
    // Para heartbeat anterior se existir
    this.pararHeartbeat();

    console.log('💓 Iniciando heartbeat para token:', tokenSessao.substring(0, 20) + '...');
    
    // Atualiza último acesso a cada 60 segundos (sessão expira em 120s)
    this.heartbeatInterval = window.setInterval(() => {
      this.atualizarUltimoAcesso(tokenSessao);
    }, 60 * 1000); // 60 segundos
    
    // Primeira atualização imediata
    setTimeout(() => {
      this.atualizarUltimoAcesso(tokenSessao);
    }, 5000); // 5 segundos após login
  }

  private pararHeartbeat(): void {
    if (this.heartbeatInterval) {
      console.log('🛑 Parando heartbeat');
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Força logout de um usuário específico (admin)
   */
  async forcarLogoutUsuario(usuarioId: string): Promise<void> {
    try {
      console.log('🚫 Forçando logout do usuário:', usuarioId);
      
      const { error } = await supabase
        .from('sessoes_usuario')
        .update({ ativa: false })
        .eq('usuario_id', usuarioId)
        .eq('ativa', true);

      if (error) {
        throw new Error(`Erro ao forçar logout: ${error.message}`);
      }
      
      console.log('✅ Logout forçado com sucesso');
    } catch (error) {
      console.error('Erro ao forçar logout:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas de sessões
   */
  async buscarEstatisticasSessoes(): Promise<{
    usuarios_online: number;
    sessoes_ativas: number;
    tempo_medio_sessao: number;
    picos_acesso_hoje: number;
  }> {
    try {
      const agora = new Date();
      const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const limiteOnline = new Date();
      limiteOnline.setMinutes(limiteOnline.getMinutes() - 10);

      const [sessoes, sessoesHoje] = await Promise.all([
        supabase
          .from('sessoes_usuario')
          .select('usuario_id, data_inicio, data_ultimo_acesso, ativa')
          .eq('ativa', true)
          .gte('data_ultimo_acesso', limiteOnline.toISOString()),
        
        supabase
          .from('sessoes_usuario')
          .select('data_inicio')
          .gte('data_inicio', inicioHoje.toISOString())
      ]);

      const usuariosOnline = new Set(sessoes.data?.map(s => s.usuario_id)).size;
      const sessoesAtivas = sessoes.data?.length || 0;
      
      // Calcula tempo médio de sessão
      const tempoMedio = sessoes.data?.reduce((acc, s) => {
        const inicio = new Date(s.data_inicio);
        const ultimoAcesso = new Date(s.data_ultimo_acesso);
        const duracao = (ultimoAcesso.getTime() - inicio.getTime()) / (1000 * 60); // em minutos
        return acc + duracao;
      }, 0) || 0;

      const tempoMedioSessao = sessoesAtivas > 0 ? Math.round(tempoMedio / sessoesAtivas) : 0;

      console.log('📊 Estatísticas de sessões:', {
        usuarios_online: usuariosOnline,
        sessoes_ativas: sessoesAtivas,
        tempo_medio_sessao: tempoMedioSessao,
        picos_acesso_hoje: sessoesHoje.data?.length || 0
      });
      
      return {
        usuarios_online: usuariosOnline,
        sessoes_ativas: sessoesAtivas,
        tempo_medio_sessao: tempoMedioSessao,
        picos_acesso_hoje: sessoesHoje.data?.length || 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas de sessões:', error);
      return {
        usuarios_online: 0,
        sessoes_ativas: 0,
        tempo_medio_sessao: 0,
        picos_acesso_hoje: 0
      };
    }
  }
  
  /**
   * Limpa todas as sessões inativas (limpeza manual)
   */
  async limparTodasSessoesInativas(): Promise<number> {
    try {
      console.log('🧹 Limpando todas as sessões inativas...');
      
      const { data, error } = await supabase
        .from('sessoes_usuario')
        .delete()
        .eq('ativa', false)
        .select('id');

      if (error) {
        throw new Error(`Erro ao limpar sessões inativas: ${error.message}`);
      }

      console.log('✅ Sessões inativas removidas:', data?.length || 0);
      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao limpar sessões inativas:', error);
      return 0;
    }
  }
}

export const sessaoService = new SessaoService();