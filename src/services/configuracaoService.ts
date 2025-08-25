/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './databaseService';
import { ConfiguracaoCobranca, ValidacaoConfiguracao, Usuario, LogSistema, ConfiguracaoSistema, PermissaoUsuario, LogSeguranca, EstatisticasUsuarios, ConfiguracaoSeguranca, TentativaLogin, IPBloqueado, AlertaSeguranca } from '../types/configuracao';

export class ConfiguracaoService {
  /**
   * Cria usuário no Auth (via Edge Function) e upsert em usuarios_sistema.
   * Requer que o usuário logado seja admin_master.
   */
  async criarUsuarioAdmin(
    payload: Omit<Usuario, 'id' | 'created_at' | 'updated_at'> & { password?: string }
  ): Promise<{ id: string; invited: boolean }> {
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
        }
      });

      if (error) {
        // Trata erros específicos do Supabase Auth
        if (error.message?.includes('A user with this email address has already been registered')) {
          throw new Error('Um usuário com este e-mail já está registrado no sistema.');
        }
        if (error.message?.includes('email address has already been registered')) {
          throw new Error('Um usuário com este e-mail já está registrado no sistema.');
        }
        if (error.message?.includes('already been registered')) {
          throw new Error('Um usuário com este e-mail já está registrado no sistema.');
        }
        
        // Outros erros genéricos
        throw new Error(error.message || 'Erro ao criar usuário no sistema');
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

    return validacoes;
  }

  /**
   * Registra log das alterações de configuração
   */
  async registrarLogAlteracoes(
    configAnterior: ConfiguracaoCobranca,
    configNova: Partial<ConfiguracaoCobranca>,
    usuario: string
  ): Promise<void> {
    try {
      const alteracoes: Record<string, { anterior: any; novo: any }> = {};

      Object.keys(configNova).forEach(chave => {
        const valorAnterior = (configAnterior as any)[chave];
        const valorNovo = (configNova as any)[chave];
        
        if (valorAnterior !== valorNovo) {
          alteracoes[chave] = {
            anterior: valorAnterior,
            novo: valorNovo
          };
        }
      });

      if (Object.keys(alteracoes).length > 0) {
        await this.registrarLog({
          usuario_id: usuario,
          acao: 'atualizar_configuracao',
          tabela_afetada: 'configuracoes_cobranca',
          registro_id: 'default',
          dados_anteriores: configAnterior,
          dados_novos: configNova
        });
      }
    } catch (error) {
      console.error('Erro ao registrar log de alterações:', error);
    }
  }

  /**
   * Busca todos os usuários do sistema
   */
  async buscarUsuarios(filtros: {
    nivel?: string;
    ativo?: boolean;
    busca?: string;
  } = {}): Promise<Usuario[]> {
    try {
      console.log('🔍 Admin master buscando todos os usuários...');
      
      // Como esta tela só é acessível por admin_master, usa Edge Function diretamente
      const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('admin-get-users', {
        body: { filtros }
      });

      if (edgeError) {
        console.error('❌ Erro na Edge Function:', edgeError);
        throw new Error(`Erro ao buscar usuários: ${edgeError.message}`);
      }

      if (!edgeData?.users) {
        console.warn('⚠️ Edge Function não retornou usuários');
        return [];
      }

      console.log('✅ Usuários encontrados:', edgeData.users.length);
      return edgeData.users;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas dos usuários
   */
  async buscarEstatisticasUsuarios(): Promise<EstatisticasUsuarios> {
    try {
      console.log('📊 Buscando estatísticas de usuários...');
      
      // Usa Edge Function para buscar todos os usuários
      const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('admin-get-users', {
        body: { filtros: {} }
      });

      if (edgeError) {
        console.warn('⚠️ Erro ao buscar usuários para estatísticas:', edgeError);
        return this.getEstatisticasVazias();
      }

      const usuarios = edgeData?.users || [];
      console.log('📊 Calculando estatísticas para:', usuarios.length, 'usuários');

      const stats: EstatisticasUsuarios = {
        total_usuarios: usuarios.length,
        usuarios_ativos: usuarios.filter((u: any) => u.ativo !== false).length,
        usuarios_inativos: usuarios.filter((u: any) => u.ativo === false).length,
        por_nivel: {},
        logins_mes_atual: 0, // Será implementado quando logs_seguranca existir
        tentativas_bloqueadas: 0 // Será implementado quando logs_seguranca existir
      };

      // Estatísticas por nível
      usuarios.forEach((u: any) => {
        stats.por_nivel[u.nivel_permissao] = (stats.por_nivel[u.nivel_permissao] || 0) + 1;
      });

      console.log('📈 Estatísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return this.getEstatisticasVazias();
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
      console.log('🔄 Tentando atualizar usuário:', id, dadosAtualizacao);
      
      // Admin master sempre usa Edge Function para bypass de RLS
      const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('admin-update-user', {
        body: {
          userId: id,
          updateData: dadosAtualizacao
        }
      });

      if (edgeError) {
        console.error('❌ Erro na Edge Function:', edgeError);
        throw new Error(edgeError.message || 'Erro ao atualizar usuário');
      }

      if (!edgeData?.success) {
        console.error('❌ Edge Function retornou falha:', edgeData);
        throw new Error(edgeData?.error || 'Falha ao atualizar usuário');
      }

      console.log('✅ Usuário atualizado via Edge Function');
      return edgeData.user;
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
      console.log('🔒 Bloqueando usuário:', id, 'Motivo:', motivoBloqueio);
      
      // Usa Edge Function para admin_master
      const { data: edgeData, error: edgeError } = await (supabase as any).functions.invoke('admin-update-user', {
        body: {
          userId: id,
          updateData: {
            ativo: false,
            bloqueado_ate: new Date(Date.now() + duracaoHoras * 60 * 60 * 1000).toISOString()
          }
        }
      });

      if (edgeError) {
        console.error('❌ Erro na Edge Function ao bloquear:', edgeError);
        throw new Error(edgeError.message || 'Erro ao bloquear usuário');
      }

      if (!edgeData?.success) {
        console.error('❌ Edge Function retornou falha ao bloquear:', edgeData);
        throw new Error(edgeData?.error || 'Falha ao bloquear usuário');
      }

      console.log('✅ Usuário bloqueado com sucesso via Edge Function');

      // Força logout de todas as sessões ativas do usuário
      try {
        const { error: logoutError } = await supabase
          .from('sessoes_usuario')
          .update({ ativa: false })
          .eq('usuario_id', id)
          .eq('ativa', true);

        if (logoutError) {
          console.warn('⚠️ Erro ao forçar logout das sessões:', logoutError);
        } else {
          console.log('✅ Sessões do usuário encerradas');
        }
      } catch (sessionError) {
        console.warn('⚠️ Erro ao encerrar sessões:', sessionError);
      }

      // Registra log de segurança
      try {
        await this.registrarLogSeguranca({
          usuario_id: id,
          email_tentativa: '',
          ip_origem: 'sistema',
          tipo_evento: 'bloqueio_automatico',
          detalhes: motivoBloqueio,
          data_evento: new Date().toISOString()
        });
      } catch (logError) {
        console.warn('⚠️ Erro ao registrar log de segurança:', logError);
      }
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
      const { error } = await supabase
        .from('tentativas_login')
        .insert({
          email_tentativa: log.email_tentativa,
          ip_origem: log.ip_origem,
          user_agent: log.user_agent,
          sucesso: log.tipo_evento === 'login_sucesso',
          motivo_falha: log.tipo_evento === 'login_sucesso' ? null : log.detalhes,
          data_tentativa: log.data_evento,
          bloqueado_automaticamente: log.tipo_evento === 'bloqueio_automatico'
        });

      if (error) {
        console.error('Erro ao registrar log de segurança:', error);
      }
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
      let query = supabase
        .from('tentativas_login')
        .select('*')
        .order('data_tentativa', { ascending: false })
        .limit(filtros.limite || 100);

      if (filtros.dataInicio) {
        query = query.gte('data_tentativa', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_tentativa', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar logs de segurança: ${error.message}`);
      }

      // Mapeia para o formato LogSeguranca
      return data?.map(tentativa => ({
        id: tentativa.id,
        usuario_id: tentativa.email_tentativa, // Usando email como identificador
        email_tentativa: tentativa.email_tentativa,
        ip_origem: tentativa.ip_origem,
        user_agent: tentativa.user_agent,
        tipo_evento: tentativa.sucesso ? 'login_sucesso' : 'login_falha',
        detalhes: tentativa.motivo_falha,
        data_evento: tentativa.data_tentativa
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar logs de segurança:', error);
      return [];
    }
  }

  /**
   * Registra tentativa de login
   */
  async registrarTentativaLogin(
    email: string,
    ip: string,
    userAgent: string,
    sucesso: boolean,
    motivoFalha?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('tentativas_login')
        .insert({
          email_tentativa: email,
          ip_origem: ip,
          user_agent: userAgent,
          sucesso,
          motivo_falha: motivoFalha,
          data_tentativa: new Date().toISOString(),
          bloqueado_automaticamente: false
        });

      if (error) {
        console.error('Erro ao registrar tentativa de login:', error);
      }
    } catch (error) {
      console.error('Erro ao registrar tentativa de login:', error);
    }
  }

  /**
   * Cria alerta de segurança
   */
  async criarAlertaSeguranca(
    tipo: AlertaSeguranca['tipo'],
    titulo: string,
    descricao: string,
    ipOrigem?: string,
    usuarioAfetado?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('alertas_seguranca')
        .insert({
          tipo,
          titulo,
          descricao,
          ip_origem: ipOrigem,
          usuario_afetado: usuarioAfetado,
          data_deteccao: new Date().toISOString(),
          resolvido: false
        });

      if (error) {
        console.error('Erro ao criar alerta de segurança:', error);
      }
    } catch (error) {
      console.error('Erro ao criar alerta de segurança:', error);
    }
  }

  /**
   * Verifica se IP está na whitelist
   */
  async verificarIPWhitelist(ip: string): Promise<boolean> {
    try {
      const config = await this.buscarConfiguracaoSeguranca();
      
      if (!config.ip_whitelist_ativo) {
        return true; // Se whitelist não está ativa, permite todos os IPs
      }

      // Verifica se o IP está na lista de permitidos
      return config.ips_permitidos.some(ipPermitido => {
        if (ipPermitido.includes('/')) {
          // CIDR notation - implementar verificação de subnet se necessário
          return ip.startsWith(ipPermitido.split('/')[0]);
        }
        return ip === ipPermitido;
      });
    } catch (error) {
      console.error('Erro ao verificar whitelist:', error);
      return true; // Em caso de erro, permite acesso
    }
  }

  /**
   * Verifica se IP está bloqueado
   */
  async verificarIPBloqueado(ip: string): Promise<boolean> {
    try {
      const config = await this.buscarConfiguracaoSeguranca();
      
      // Verifica blacklist de configuração
      if (config.ip_blacklist_ativo && config.ips_bloqueados.includes(ip)) {
        return true;
      }

      // Verifica tabela de IPs bloqueados
      const { data, error } = await supabase
        .from('ips_bloqueados')
        .select('id')
        .eq('endereco_ip', ip)
        .eq('ativo', true)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar IP bloqueado:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Erro ao verificar IP bloqueado:', error);
      return false;
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
        .select('*')
        .order('data_acao', { ascending: false })
        .limit(filtros.limite || 100);

      if (filtros.usuario) {
        query = query.ilike('usuario_id', `%${filtros.usuario}%`);
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
    }
  }

  /**
   * Busca configuração de segurança
   */
  async buscarConfiguracaoSeguranca(): Promise<ConfiguracaoSeguranca> {
    try {
      const { data, error } = await supabase
        .from('configuracao_seguranca')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error || !data) {
        // Retorna configuração padrão
        return {
          id: 'default',
          senha_comprimento_minimo: 8,
          senha_requer_maiuscula: true,
          senha_requer_minuscula: true,
          senha_requer_numero: true,
          senha_requer_especial: false,
          senha_expiracao_dias: 90,
          senha_historico_bloqueio: 5,
          max_tentativas_login: 5,
          duracao_bloqueio_minutos: 30,
          reset_tentativas_apos_minutos: 60,
          ip_whitelist_ativo: false,
          ips_permitidos: [],
          ip_blacklist_ativo: false,
          ips_bloqueados: [],
          timeout_sessao_minutos: 120,
          log_tentativas_falhas: true,
          notificar_admin_tentativas: true,
          email_notificacao_admin: 'admin@crescieperdi.com.br'
        };
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar configuração de segurança:', error);
      throw error;
    }
  }

  /**
   * Salva configuração de segurança
   */
  async salvarConfiguracaoSeguranca(config: ConfiguracaoSeguranca, usuario: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('configuracao_seguranca')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Erro ao salvar configuração de segurança: ${error.message}`);
      }

      // Registra log
      await this.registrarLog({
        usuario_id: usuario,
        acao: 'atualizar_configuracao_seguranca',
        tabela_afetada: 'configuracao_seguranca',
        registro_id: 'default',
        dados_novos: config
      });
    } catch (error) {
      console.error('Erro ao salvar configuração de segurança:', error);
      throw error;
    }
  }

  /**
   * Busca tentativas de login recentes
   */
  async buscarTentativasLogin(limite: number = 50): Promise<TentativaLogin[]> {
    try {
      const { data, error } = await supabase
        .from('tentativas_login')
        .select('*')
        .order('data_tentativa', { ascending: false })
        .limit(limite);

      if (error) {
        throw new Error(`Erro ao buscar tentativas de login: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar tentativas de login:', error);
      return [];
    }
  }

  /**
   * Busca IPs bloqueados
   */
  async buscarIPsBloqueados(): Promise<IPBloqueado[]> {
    try {
      const { data, error } = await supabase
        .from('ips_bloqueados')
        .select('*')
        .eq('ativo', true)
        .order('data_bloqueio', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar IPs bloqueados: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar IPs bloqueados:', error);
      return [];
    }
  }

  /**
   * Adiciona IP à lista de bloqueados
   */
  async bloquearIP(ip: string, motivo: string, usuario: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ips_bloqueados')
        .insert({
          endereco_ip: ip,
          motivo_bloqueio: motivo,
          bloqueado_por: usuario,
          data_bloqueio: new Date().toISOString(),
          ativo: true
        });

      if (error) {
        throw new Error(`Erro ao bloquear IP: ${error.message}`);
      }
      
      // Registra log
      await this.registrarLog({
        usuario_id: usuario,
        acao: 'bloquear_ip',
        tabela_afetada: 'ips_bloqueados',
        dados_novos: { ip, motivo }
      });
    } catch (error) {
      console.error('Erro ao bloquear IP:', error);
      throw error;
    }
  }

  /**
   * Remove IP da lista de bloqueados
   */
  async desbloquearIP(ip: string, usuario: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ips_bloqueados')
        .update({ ativo: false })
        .eq('endereco_ip', ip)
        .eq('ativo', true);

      if (error) {
        throw new Error(`Erro ao desbloquear IP: ${error.message}`);
      }
      
      // Registra log
      await this.registrarLog({
        usuario_id: usuario,
        acao: 'desbloquear_ip',
        tabela_afetada: 'ips_bloqueados',
        dados_novos: { ip }
      });
    } catch (error) {
      console.error('Erro ao desbloquear IP:', error);
      throw error;
    }
  }

  /**
   * Busca alertas de segurança
   */
  async buscarAlertasSeguranca(): Promise<AlertaSeguranca[]> {
    try {
      const { data, error } = await supabase
        .from('alertas_seguranca')
        .select('*')
        .order('data_deteccao', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Erro ao buscar alertas de segurança: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar alertas de segurança:', error);
      return [];
    }
  }

  /**
   * Resolve alerta de segurança
   */
  async resolverAlertaSeguranca(alertaId: string, acaoTomada: string, usuario: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alertas_seguranca')
        .update({
          resolvido: true,
          acao_tomada: acaoTomada
        })
        .eq('id', alertaId);

      if (error) {
        throw new Error(`Erro ao resolver alerta: ${error.message}`);
      }
      
      // Registra log
      await this.registrarLog({
        usuario_id: usuario,
        acao: 'resolver_alerta_seguranca',
        tabela_afetada: 'alertas_seguranca',
        registro_id: alertaId,
        dados_novos: { acaoTomada }
      });
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      throw error;
    }
  }

  /**
   * Valida configuração de segurança
   */
  validarConfiguracaoSeguranca(config: ConfiguracaoSeguranca): { valido: boolean; erros: string[] } {
    const erros: string[] = [];

    if (config.senha_comprimento_minimo < 6 || config.senha_comprimento_minimo > 50) {
      erros.push('Comprimento mínimo da senha deve estar entre 6 e 50 caracteres');
    }

    if (config.senha_expiracao_dias < 30 || config.senha_expiracao_dias > 365) {
      erros.push('Expiração da senha deve estar entre 30 e 365 dias');
    }

    if (config.max_tentativas_login < 3 || config.max_tentativas_login > 20) {
      erros.push('Máximo de tentativas deve estar entre 3 e 20');
    }

    if (config.duracao_bloqueio_minutos < 5 || config.duracao_bloqueio_minutos > 1440) {
      erros.push('Duração do bloqueio deve estar entre 5 minutos e 24 horas');
    }

    if (config.timeout_sessao_minutos < 30 || config.timeout_sessao_minutos > 480) {
      erros.push('Timeout da sessão deve estar entre 30 minutos e 8 horas');
    }

    // Valida IPs se whitelist estiver ativo
    if (config.ip_whitelist_ativo && config.ips_permitidos.length === 0) {
      erros.push('Whitelist ativo deve ter pelo menos um IP permitido');
    }

    // Valida formato dos IPs
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipsInvalidos = [...config.ips_permitidos, ...config.ips_bloqueados]
      .filter(ip => ip && !ipRegex.test(ip));
    
    if (ipsInvalidos.length > 0) {
      erros.push(`IPs com formato inválido: ${ipsInvalidos.join(', ')}`);
    }

    return {
      valido: erros.length === 0,
      erros
    };
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

  /**
   * Retorna estatísticas vazias em caso de erro
   */
  private getEstatisticasVazias(): EstatisticasUsuarios {
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