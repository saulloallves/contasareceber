/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './databaseService';
import { ConfiguracaoCobranca, ValidacaoConfiguracao, Usuario, LogSistema, ConfiguracaoSistema, PermissaoUsuario, LogSeguranca, EstatisticasUsuarios } from '../types/configuracao';

export class ConfiguracaoService {
  /**
   * Cria usuário no Auth (via Edge Function) e upsert em usuarios_sistema.
   * Requer que o usuário logado seja admin_master.
   */
  async criarUsuarioAdmin(
    payload: Omit<Usuario, 'id' | 'created_at' | 'updated_at'> & { password?: string }
  ): Promise<{ id: string; invited: boolean }>
  {
    try {
      // Validações rápidas no front
      if (!payload.nome_completo || !payload.email || !payload.cargo || !payload.nivel_permissao) {
        throw new Error('Preencha nome, email, cargo e nível de permissão');
      }

      // Evitar duplicidade básica pelo email na tabela local
      const { data: existente } = await supabase
        .from('usuarios_sistema')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle();
      if (existente?.id) {
        throw new Error('Email já cadastrado no sistema');
      }

      const { data, error } = await (supabase as any).functions.invoke('admin-create-user', {
        body: {
          email: payload.email,
          password: payload.password,
          nome_completo: payload.nome_completo,
          telefone: payload.telefone,
          cargo: payload.cargo,
          nivel_permissao: payload.nivel_permissao,
          ativo: payload.ativo ?? true,
          codigo_unidade_vinculada: payload.codigo_unidade_vinculada,
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar usuário');
      }

      return { id: data.id, invited: Boolean(data.invited) };
    } catch (err) {
      console.error('Erro ao criar usuário (admin):', err);
      throw err;
    }
  }
  /**
   * Busca a configuração atual do sistema
   */
  async buscarConfiguracao(): Promise<ConfiguracaoCobranca | null> {
    try {
      const { data, error } = await supabase
        .from('configuracoes_cobranca')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar configuração: ${error.message}`);
      }

      // Se não existe configuração, retorna configuração padrão
      if (!data) {
        const configPadrao: ConfiguracaoCobranca = {
          id: 'default',
          percentual_multa: 2.0,
          percentual_juros_dia: 0.033,
          dia_disparo_mensal: 15,
          tempo_tolerancia_dias: 3,
          texto_padrao_mensagem: `Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? {{link_negociacao}}

_Esta é uma mensagem automática do sistema de cobrança._`,
          link_base_agendamento: 'https://calendly.com/sua-empresa/negociacao',
          canal_envio: 'whatsapp',
          modo_debug: false,
          // ultima_data_importacao omitida até primeira importação
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Cria configuração padrão no banco
        await supabase
          .from('configuracoes_cobranca')
          .insert(configPadrao);
          
          // Fallback: query direta simples
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      return null;
    }
  }

  /**
   * Atualiza a configuração do sistema
   */
  async atualizarConfiguracao(
    configuracao: Partial<ConfiguracaoCobranca>,
    usuario: string
  ): Promise<boolean> {
    try {
      // Busca configuração atual para log
      const configAtual = await this.buscarConfiguracao();

            console.error('❌ Erro no fallback:', fallbackError.message);
            console.log('⚠️ Retornando apenas usuário atual devido às políticas RLS');
            
            // Se tudo falhar, retorna apenas o usuário atual
            const { data: currentUserData } = await supabase
              .from('usuarios_sistema')
              .select('*')
              .eq('id', currentUser.user?.id)
              .single();
            
            return currentUserData ? [currentUserData] : [];
          }
          
          console.log('✅ Usuários encontrados via fallback:', fallbackData?.length || 0);
          return fallbackData || [];
        }

        console.log('✅ Usuários encontrados via RPC:', rpcData?.length || 0);
        return rpcData || [];
      }

      // Para outros usuários, retorna apenas o próprio perfil
      console.log('🔒 Usuário não é admin_master, retornando apenas próprio perfil');
      const { data: ownProfile, error } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('id', currentUser.user?.id)
        .single();
      
      if (error) {
        console.error('❌ Erro ao buscar próprio perfil:', error);
        return [];
      }
      
      return ownProfile ? [ownProfile] : [];
    } catch (error) {
      console.error('Erro geral ao buscar usuários:', error);
      return [];
    }
  }

  /**
   * Busca estatísticas dos usuários
   */
  async buscarEstatisticasUsuarios(): Promise<EstatisticasUsuarios> {
    try {
      // Para estatísticas, vamos usar os dados que conseguimos buscar
      const usuarios = await this.buscarUsuarios();
      
      console.log('📊 Calculando estatísticas para:', usuarios?.length || 0, 'usuários');

      const stats: EstatisticasUsuarios = {
        total_usuarios: usuarios?.length || 0,
        usuarios_ativos: usuarios?.filter(u => u.ativo).length || 0,
        usuarios_inativos: usuarios?.filter(u => !u.ativo).length || 0,
        por_nivel: {},
        logins_mes_atual: 0, // Será implementado quando logs_seguranca existir
        tentativas_bloqueadas: 0 // Será implementado quando logs_seguranca existir
      };

      // Estatísticas por nível
      usuarios?.forEach(u => {
        stats.por_nivel[u.nivel_permissao] = (stats.por_nivel[u.nivel_permissao] || 0) + 1;
      });

      console.log('📈 Estatísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        total_usuarios: 0,
        usuarios_ativos: 0,
        usuarios_inativos: 0,
        por_nivel: {},
        logins_mes_atual: 0,
        tentativas_bloqueadas: 0
      };
    }
  }
      const validacoes = this.validarConfiguracao(configuracao);
      const erros = validacoes.filter(v => !v.valido);
      
      if (erros.length > 0) {
        throw new Error(`Erros de validação: ${erros.map(e => e.mensagem).join(', ')}`);
      }

      const { error } = await supabase
        .from('configuracoes_cobranca')
        .update({
          ...configuracao,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'default');

      if (error) {
        throw new Error(`Erro ao atualizar configuração: ${error.message}`);
      }

      // Registra log das alterações
      if (configAtual) {
        await this.registrarLogAlteracoes(configAtual, configuracao, usuario);
      }

      return true;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  /**
   * Valida os campos da configuração
   */
  validarConfiguracao(config: Partial<ConfiguracaoCobranca>): ValidacaoConfiguracao[] {
    const validacoes: ValidacaoConfiguracao[] = [];

    // Valida percentual de multa
    if (config.percentual_multa !== undefined) {
      if (config.percentual_multa < 0 || config.percentual_multa > 100) {
        validacoes.push({
          campo: 'percentual_multa',
          valido: false,
          mensagem: 'Percentual de multa deve estar entre 0 e 100'
        });
      } else {
        validacoes.push({
          campo: 'percentual_multa',
          valido: true
        });
      }
    }

    // Valida percentual de juros diário
    if (config.percentual_juros_dia !== undefined) {
      if (config.percentual_juros_dia < 0 || config.percentual_juros_dia > 10) {
        validacoes.push({
          campo: 'percentual_juros_dia',
          valido: false,
          mensagem: 'Percentual de juros diário deve estar entre 0 e 10'
        });
      } else {
        validacoes.push({
          campo: 'percentual_juros_dia',
          valido: true
        });
      }
    }

    // Valida dia do disparo mensal
    if (config.dia_disparo_mensal !== undefined) {
      if (config.dia_disparo_mensal < 1 || config.dia_disparo_mensal > 31) {
        validacoes.push({
          campo: 'dia_disparo_mensal',
          valido: false,
          mensagem: 'Dia do disparo deve estar entre 1 e 31'
        });
      } else {
        validacoes.push({
          campo: 'dia_disparo_mensal',
          valido: true
        });
      }
    }

    // Valida tempo de tolerância
    if (config.tempo_tolerancia_dias !== undefined) {
      if (config.tempo_tolerancia_dias < 0 || config.tempo_tolerancia_dias > 30) {
        validacoes.push({
          campo: 'tempo_tolerancia_dias',
          valido: false,
          mensagem: 'Tempo de tolerância deve estar entre 0 e 30 dias'
        });
      } else {
        validacoes.push({
          campo: 'tempo_tolerancia_dias',
          valido: true
        });
      }
    }

    // Valida texto da mensagem
    if (config.texto_padrao_mensagem !== undefined) {
      if (!config.texto_padrao_mensagem.trim()) {
        validacoes.push({
          campo: 'texto_padrao_mensagem',
          valido: false,
          mensagem: 'Texto da mensagem não pode estar vazio'
        });
      } else if (!config.texto_padrao_mensagem.includes('{{cliente}}')) {
        validacoes.push({
          campo: 'texto_padrao_mensagem',
          valido: false,
          mensagem: 'Texto deve conter a variável {{cliente}}'
        });
      } else {
        validacoes.push({
          campo: 'texto_padrao_mensagem',
          valido: true
        });
      }
    }

    // Valida link de agendamento
    if (config.link_base_agendamento !== undefined) {
      try {
        new URL(config.link_base_agendamento);
        validacoes.push({
          campo: 'link_base_agendamento',
          valido: true
        });
      } catch {
        validacoes.push({
          campo: 'link_base_agendamento',
          valido: false,
          mensagem: 'Link de agendamento deve ser uma URL válida'
        });
      }
    }

    return validacoes;
  }

  /**
   * Registra log de alterações
   */
  private async registrarLogAlteracoes(
    configAnterior: ConfiguracaoCobranca,
    configNova: Partial<ConfiguracaoCobranca>,
    usuario: string
  ): Promise<void> {
    try {
      const alteracoes = [];

      for (const [campo, valorNovo] of Object.entries(configNova)) {
        const valorAnterior = (configAnterior as any)[campo];
        if (valorAnterior !== valorNovo) {
          alteracoes.push({
            campo_alterado: campo,
            valor_anterior: String(valorAnterior),
            valor_novo: String(valorNovo),
            usuario,
            data_alteracao: new Date().toISOString()
          });
        }
      }

      if (alteracoes.length > 0) {
        await supabase
          .from('historico_alteracoes_config')
          .insert(alteracoes);
      }
    } catch (error) {
      console.error('Erro ao registrar log de alterações:', error);
    }
  }

  /**
   * Busca usuários do sistema
   */
  async buscarUsuarios(filtros: {
    nivel?: string;
    ativo?: boolean;
    busca?: string;
  } = {}): Promise<Usuario[]> {
    try {
      // Tenta primeiro com service_role para admin_master
      const { data: currentUser } = await supabase.auth.getUser();
      
      // Busca o perfil do usuário atual para verificar se é admin_master
      const { data: userProfile } = await supabase
        .from('usuarios_sistema')
        .select('nivel_permissao')
        .eq('id', currentUser.user?.id)
        .single();

      // Se não é admin_master, retorna apenas o próprio usuário
      if (!userProfile || userProfile.nivel_permissao !== 'admin_master') {
        console.log('🔒 Usuário não é admin_master, retornando apenas próprio perfil');
        const { data: ownProfile, error } = await supabase
          .from('usuarios_sistema')
          .select('*')
          .eq('id', currentUser.user?.id)
          .single();
        
        if (error) {
          console.error('❌ Erro ao buscar próprio perfil:', error);
          return [];
        }
        
        return ownProfile ? [ownProfile] : [];
      }

      // Para admin_master, usa RPC function que bypassa RLS
      console.log('👑 Usuário é admin_master, buscando todos os usuários via RPC');
      
      const { data, error } = await supabase.rpc('get_all_users_admin', {
        p_nivel_filtro: filtros.nivel || null,
        p_ativo_filtro: filtros.ativo,
        p_busca_filtro: filtros.busca || null
      });

      if (error) {
        console.error('❌ Erro na RPC function, tentando query direta:', error);
        
        // Fallback: tenta query direta (pode falhar devido ao RLS)
        let query = supabase
          .from('usuarios_sistema')
          .select('*')
          .order('nome_completo');

        if (filtros.nivel) {
          query = query.eq('nivel_permissao', filtros.nivel);
        }

        if (filtros.ativo !== undefined) {
          query = query.eq('ativo', filtros.ativo);
        }

        if (filtros.busca) {
          query = query.or(`nome_completo.ilike.%${filtros.busca}%,email.ilike.%${filtros.busca}%,cargo.ilike.%${filtros.busca}%`);
        }

        const { data: fallbackData, error: fallbackError } = await query;
        
        if (fallbackError) {
          console.error('❌ Erro no fallback também:', fallbackError);
          return [];
        }
        
        console.log('✅ Usuários encontrados via fallback:', fallbackData?.length || 0);
        return fallbackData || [];
      }

      console.log('✅ Usuários encontrados via RPC:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  /**
   * Busca estatísticas dos usuários
   */
  async buscarEstatisticasUsuarios(): Promise<EstatisticasUsuarios> {
    try {
      // Tenta usar RPC function para admin_master
      const { data: currentUser } = await supabase.auth.getUser();
      
      const { data: userProfile } = await supabase
        .from('usuarios_sistema')
        .select('nivel_permissao')
        .eq('id', currentUser.user?.id)
        .single();

      let usuarios: any[] = [];

      if (userProfile?.nivel_permissao === 'admin_master') {
        // Admin master pode ver estatísticas de todos
        const { data: allUsers, error } = await supabase.rpc('get_all_users_admin');
        
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_users_admin', {
          console.warn('⚠️ Erro na RPC para estatísticas, usando fallback');
          // Fallback para query direta
          const { data: fallbackUsers } = await supabase
            .from('usuarios_sistema')
            .select('nivel_permissao, ativo, ultimo_acesso');
          usuarios = fallbackUsers || [];
        } else {
          usuarios = allUsers || [];
        }
      } else {
        // Outros usuários veem apenas estatísticas básicas
        usuarios = userProfile ? [userProfile] : [];
      }

      console.log('📊 Dados para estatísticas:', usuarios?.length || 0, usuarios);

      // Logs de segurança serão implementados quando a tabela for criada
      const logsSeguranca: any[] = [];

      const stats: EstatisticasUsuarios = {
        total_usuarios: usuarios?.length || 0,
        usuarios_ativos: usuarios?.filter(u => u.ativo).length || 0,
        usuarios_inativos: usuarios?.filter(u => !u.ativo).length || 0,
        por_nivel: {},
        logins_mes_atual: logsSeguranca?.filter(l => l.tipo_evento === 'login_sucesso').length || 0,
        tentativas_bloqueadas: logsSeguranca?.filter(l => l.tipo_evento === 'bloqueio_automatico').length || 0
      };

      // Estatísticas por nível
      usuarios?.forEach(u => {
        stats.por_nivel[u.nivel_permissao] = (stats.por_nivel[u.nivel_permissao] || 0) + 1;
      });

      console.log('📈 Estatísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        total_usuarios: 0,
        usuarios_ativos: 0,
        usuarios_inativos: 0,
        por_nivel: {},
        logins_mes_atual: 0,
        tentativas_bloqueadas: 0
      };
    }
  }

  /**
   * Cria novo usuário
   */
  async criarUsuario(usuario: Omit<Usuario, 'id' | 'created_at' | 'updated_at'>): Promise<Usuario> {
    try {
      // Verifica se email já existe
      const { data: usuarioExistente } = await supabase
        .from('usuarios_sistema')
        .select('id')
        .eq('email', usuario.email)
        .single();

      if (usuarioExistente) {
        throw new Error('Email já cadastrado no sistema');
      }

      // Define permissões padrão baseadas no nível
      const permissoesPadrao = this.getPermissoesPorNivel()[usuario.nivel_permissao]?.permissoes || {};
      const usuarioCompleto = {
        ...usuario,
        permissoes_customizadas: permissoesPadrao,
        tentativas_login: 0,
        verificacao_ip_ativa: false
      };

      const { data, error } = await supabase
        .from('usuarios_sistema')
        .insert(usuarioCompleto)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar usuário: ${error.message}`);
      }

      // Registra log
      await this.registrarLog({
        usuario_id: data.id,
        acao: 'criar_usuario',
        dados_novos: usuario
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualiza usuário existente
   */
  async atualizarUsuario(
    id: string,
    dadosAtualizacao: Partial<Usuario>,
    usuarioLogado: string
  ): Promise<Usuario> {
    try {
      // Busca dados atuais
      const { data: usuarioAtual } = await supabase
        .from('usuarios_sistema')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('usuarios_sistema')
        .update(dadosAtualizacao)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar usuário: ${error.message}`);
      }

      // Registra log
      await this.registrarLog({
        usuario_id: usuarioLogado,
        acao: 'atualizar_usuario',
        tabela_afetada: 'usuarios_sistema',
        registro_id: id,
        dados_anteriores: usuarioAtual,
        dados_novos: dadosAtualizacao
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Bloqueia usuário temporariamente
   */
  async bloquearUsuario(id: string, motivoBloqueio: string, duracaoHoras: number = 24): Promise<void> {
    try {
      const dataDesbloqueio = new Date();
      dataDesbloqueio.setHours(dataDesbloqueio.getHours() + duracaoHoras);

      const { error } = await supabase
        .from('usuarios_sistema')
        .update({
          ativo: false,
          bloqueado_ate: dataDesbloqueio.toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao bloquear usuário: ${error.message}`);
      }

      // Registra log de segurança
      await this.registrarLogSeguranca({
        usuario_id: id,
        email_tentativa: '',
        ip_origem: 'sistema',
        tipo_evento: 'bloqueio_automatico',
        detalhes: motivoBloqueio,
        data_evento: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error);
      throw error;
    }
  }

  /**
   * Registra log de segurança
   */
  async registrarLogSeguranca(log: Omit<LogSeguranca, 'id'>): Promise<void> {
    try {
      // Logs de segurança serão implementados quando a tabela for criada
      console.log('Log de segurança registrado:', log);
    } catch (error) {
      console.error('Erro ao registrar log de segurança:', error);
    }
  }

  /**
   * Busca logs de segurança
   */
  async buscarLogsSeguranca(filtros: {
    usuario_id?: string;
    tipo_evento?: string;
    dataInicio?: string;
    dataFim?: string;
    limite?: number;
  } = {}): Promise<LogSeguranca[]> {
    try {
      // Logs de segurança serão implementados quando a tabela for criada
      console.log('Buscando logs de segurança com filtros:', filtros);
      return [];
    } catch (error) {
      console.error('Erro ao buscar logs de segurança:', error);
      return [];
    }
  }

  /**
   * Busca logs do sistema
   */
  async buscarLogs(filtros: {
    usuario?: string;
    acao?: string;
    dataInicio?: string;
    dataFim?: string;
    limite?: number;
  } = {}): Promise<LogSistema[]> {
    try {
      let query = supabase
        .from('logs_sistema')
        .select(`
          *,
          usuarios_sistema (
            nome_completo,
            email
          )
        `)
        .order('data_acao', { ascending: false })
        .limit(filtros.limite || 100);

      if (filtros.usuario) {
        query = query.ilike('usuarios_sistema.nome_completo', `%${filtros.usuario}%`);
      }

      if (filtros.acao) {
        query = query.eq('acao', filtros.acao);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_acao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_acao', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar logs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      throw error;
    }
  }

  /**
   * Registra log de ação no sistema
   */
  async registrarLog(log: Omit<LogSistema, 'id' | 'created_at'>): Promise<void> {
    try {
      await supabase
        .from('logs_sistema')
        .insert({
          ...log,
          data_acao: new Date().toISOString(),
          ip_origem: 'unknown', // Em produção, capturar IP real
          user_agent: navigator.userAgent
        });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
          console.error('❌ Erro na RPC function:', rpcError.message);
          console.log('🔄 Tentando query direta com service_role...');
  }

  /**
   * Busca permissões por nível
   */
  getPermissoesPorNivel(): Record<string, PermissaoUsuario> {
    return {
      admin_master: {
        nivel: 'Admin Master',
        descricao: 'Acesso total ao sistema, incluindo configurações e logs',
        permissoes: {
          dashboard: true,
          cobrancas: true,
          reunioes: true,
          juridico: true,
          configuracoes: true,
          usuarios: true,
          relatorios: true,
          importacao: true,
          exportacao: true
        }
      },
      cobranca: {
        nivel: 'Cobrança',
        descricao: 'Acesso completo à régua, reuniões, acordos e mensagens',
        permissoes: {
          dashboard: true,
          cobrancas: true,
          reunioes: true,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: true,
          exportacao: true
        }
      },
      gestor_juridico: {
        nivel: 'Gestor Jurídico',
        descricao: 'Acesso a casos escalonados e relatórios jurídicos',
        permissoes: {
          dashboard: true,
          cobrancas: false,
          reunioes: false,
          juridico: true,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: false,
          exportacao: true
        }
      },
      analista_financeiro: {
        nivel: 'Analista Financeiro',
        descricao: 'Acesso a dashboards e relatórios',
        permissoes: {
          dashboard: true,
          cobrancas: false,
          reunioes: false,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: false,
          exportacao: true
        }
      },
      gestor_regional: {
        nivel: 'Gestor Regional',
        descricao: 'Acesso às unidades da sua região',
        permissoes: {
          dashboard: true,
          cobrancas: true,
          reunioes: true,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: false,
          exportacao: true
        }
      },
      suporte: {
        nivel: 'Suporte',
        descricao: 'Visualização sem edição, acompanhamento geral',
        permissoes: {
          dashboard: true,
          cobrancas: false,
          reunioes: false,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: false,
          exportacao: false
        }
      },
      franqueado: {
        nivel: 'Franqueado',
        descricao: 'Visualiza apenas suas cobranças e histórico',
        permissoes: {
          dashboard: false,
          cobrancas: false,
          reunioes: false,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: false,
          importacao: false,
          exportacao: false
        }
      },
      observador: {
        nivel: 'Observador',
        descricao: 'Acesso somente leitura a painéis e listas',
        permissoes: {
          dashboard: true,
          cobrancas: false,
          reunioes: false,
          juridico: false,
          configuracoes: false,
          usuarios: false,
          relatorios: true,
          importacao: false,
          exportacao: false
        }
      }
    };
  }

  /**
   * Verifica se usuário tem permissão para ação
   */
  verificarPermissao(nivelUsuario: string, acao: keyof PermissaoUsuario['permissoes']): boolean {
    const permissoes = this.getPermissoesPorNivel();
    return permissoes[nivelUsuario]?.permissoes[acao] || false;
  }

  /**
   * Busca configurações do sistema
   */
  async buscarConfiguracoesSistema(categoria?: string): Promise<ConfiguracaoSistema[]> {
    try {
      let query = supabase
        .from('configuracoes_sistema')
        .select('*')
        .order('categoria')
        .order('chave');

      if (categoria) {
        query = query.eq('categoria', categoria);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar configurações: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar configurações do sistema:', error);
      throw error;
    }
  }

  /**
   * Atualiza configuração do sistema
   */
  async atualizarConfiguracaoSistema(
    chave: string,
    valor: string,
    usuario: string
  ): Promise<void> {
    try {
      // Busca configuração atual
      const { data: configAtual } = await supabase
        .from('configuracoes_sistema')
        .select('*')
        .eq('chave', chave)
        .single();

      if (!configAtual) {
        throw new Error('Configuração não encontrada');
      }

      // Atualiza
      const { error } = await supabase
        .from('configuracoes_sistema')
        .update({ 
          valor,
          updated_at: new Date().toISOString()
        })
        .eq('chave', chave);

      if (error) {
        throw new Error(`Erro ao atualizar configuração: ${error.message}`);
      }

      // Registra log
      await this.registrarLog({
        usuario_id: usuario,
        acao: 'atualizar_configuracao_sistema',
        tabela_afetada: 'configuracoes_sistema',
        registro_id: chave,
        dados_anteriores: { valor: configAtual.valor },
        dados_novos: { valor }
      });
    } catch (error) {
      console.error('Erro ao atualizar configuração do sistema:', error);
      throw error;
    }
  }

  /**
   * Reseta configuração para valores padrão
   */
  async resetarConfiguracao(): Promise<boolean> {
    try {
      const configPadrao: Partial<ConfiguracaoCobranca> = {
        percentual_multa: 2.0,
        percentual_juros_dia: 0.033,
        dia_disparo_mensal: 15,
        tempo_tolerancia_dias: 3,
        texto_padrao_mensagem: `Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? {{link_negociacao}}

_Esta é uma mensagem automática do sistema de cobrança._`,
        link_base_agendamento: 'https://calendly.com/sua-empresa/negociacao',
        canal_envio: 'whatsapp' as const,
        modo_debug: false
      };

      return await this.atualizarConfiguracao(configPadrao, 'sistema_reset');
    } catch (error) {
      console.error('Erro ao resetar configuração:', error);
      return false;
    }
  }

  /**
   * Exporta configuração atual
   */
  async exportarConfiguracao(): Promise<Blob> {
    try {
      const config = await this.buscarConfiguracao();
      if (!config) throw new Error('Configuração não encontrada');

      const dadosExport = {
        configuracao: config,
        exportado_em: new Date().toISOString(),
        versao: '1.0'
      };

      const json = JSON.stringify(dadosExport, null, 2);
      return new Blob([json], { type: 'application/json' });
    } catch (error) {
      console.error('Erro ao exportar configuração:', error);
      throw error;
    }
  }

  /**
   * Aplica template de mensagem com variáveis
   */
  aplicarTemplateMensagem(template: string, variaveis: Record<string, string>): string {
    let mensagem = template;
    
    Object.entries(variaveis).forEach(([chave, valor]) => {
      const regex = new RegExp(`{{${chave}}}`, 'g');
      mensagem = mensagem.replace(regex, valor);
    });

    return mensagem;
  }

  /**
   * Gera preview da mensagem com dados de exemplo
   */
  gerarPreviewMensagem(template: string): string {
    const variaveisExemplo = {
      'cliente': 'João da Silva',
      'codigo_unidade': 'CP001',
      'cnpj': '12.345.678/0001-99',
      'valor_original': 'R$ 1.000,00',
      'valor_atualizado': 'R$ 1.250,00',
      'data_vencimento': '15/01/2024',
      'dias_atraso': '5',
      'tipo_cobranca': 'Royalties',
      'data_atual': new Date().toLocaleDateString('pt-BR'),
      'link_negociacao': 'https://calendly.com/sua-empresa/negociacao'
    };

    return this.aplicarTemplateMensagem(template, variaveisExemplo);
  }

  /**
   * Calcula valor atualizado com multa e juros
   */
  calcularValorAtualizado(
    valorOriginal: number,
    diasAtraso: number,
    percentualMulta: number,
    percentualJurosDia: number
  ): number {
    if (diasAtraso <= 0) return valorOriginal;

    const multa = valorOriginal * (percentualMulta / 100);
    const juros = valorOriginal * (percentualJurosDia / 100) * diasAtraso;
    
    return valorOriginal + multa + juros;
  }
}