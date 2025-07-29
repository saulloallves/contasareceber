import { supabase } from './databaseService';
import { LogAuditoria, FiltrosAuditoria, EstatisticasAuditoria, ConfiguracaoAuditoria, AlertaAuditoria } from '../types/auditoria';

export class AuditoriaService {
  /**
   * Registra uma ação no log de auditoria
   */
  async registrarAcao(
    usuario: string,
    acao: string,
    entidadeAfetada: string,
    entidadeId?: string,
    detalhes?: string,
    valoresEnvolvidos?: number,
    dadosAnteriores?: any,
    dadosNovos?: any
  ): Promise<void> {
    try {
      const logEntry: Omit<LogAuditoria, 'id' | 'created_at'> = {
        data_acao: new Date().toISOString(),
        usuario,
        usuario_id: 'current_user_id', // Em produção, pegar do contexto
        acao,
        entidade_afetada: entidadeAfetada,
        entidade_id: entidadeId,
        detalhes: detalhes || '',
        valores_envolvidos: valoresEnvolvidos,
        ip_origem: 'unknown', // Em produção, capturar IP real
        canal_origem: 'web',
        dados_anteriores: dadosAnteriores,
        dados_novos: dadosNovos,
        nivel_risco: this.calcularNivelRisco(acao, valoresEnvolvidos)
      };

      const { error } = await supabase
        .from('logs_auditoria')
        .insert(logEntry);

      if (error) {
        console.error('Erro ao registrar log de auditoria:', error);
      }

      // Verificar se deve gerar alerta
      await this.verificarAlertas(logEntry);
    } catch (error) {
      console.error('Erro ao registrar ação:', error);
    }
  }

  /**
   * Busca logs com filtros
   */
  async buscarLogs(filtros: FiltrosAuditoria = {}): Promise<LogAuditoria[]> {
    try {
      let query = supabase
        .from('logs_auditoria')
        .select('*')
        .order('data_acao', { ascending: false })
        .limit(500);

      if (filtros.usuario) {
        query = query.ilike('usuario', `%${filtros.usuario}%`);
      }

      if (filtros.acao) {
        query = query.eq('acao', filtros.acao);
      }

      if (filtros.entidade) {
        query = query.eq('entidade_afetada', filtros.entidade);
      }

      if (filtros.data_inicio) {
        query = query.gte('data_acao', filtros.data_inicio);
      }

      if (filtros.data_fim) {
        query = query.lte('data_acao', filtros.data_fim);
      }

      if (filtros.nivel_risco) {
        query = query.eq('nivel_risco', filtros.nivel_risco);
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
   * Busca estatísticas de auditoria
   */
  async buscarEstatisticas(filtros: FiltrosAuditoria = {}): Promise<EstatisticasAuditoria> {
    try {
      let query = supabase
        .from('logs_auditoria')
        .select('*');

      // Aplicar filtros se fornecidos
      if (filtros.data_inicio) {
        query = query.gte('data_acao', filtros.data_inicio);
      }
      if (filtros.data_fim) {
        query = query.lte('data_acao', filtros.data_fim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const hoje = new Date().toISOString().split('T')[0];
      const acaosSensiveis = ['excluir', 'editar_valor_alto', 'login_fora_horario'];

      const stats: EstatisticasAuditoria = {
        total_acoes: data?.length || 0,
        usuarios_ativos: new Set(data?.map(log => log.usuario)).size,
        acoes_hoje: data?.filter(log => log.data_acao.startsWith(hoje)).length || 0,
        alertas_ativos: data?.filter(log => log.nivel_risco === 'alto').length || 0,
        acoes_sensíveis: data?.filter(log => acaosSensiveis.includes(log.acao)).length || 0,
        por_acao: {},
        por_usuario: {},
        por_entidade: {}
      };

      // Calcular distribuições
      data?.forEach(log => {
        // Por ação
        stats.por_acao[log.acao] = (stats.por_acao[log.acao] || 0) + 1;
        
        // Por usuário
        stats.por_usuario[log.usuario] = (stats.por_usuario[log.usuario] || 0) + 1;
        
        // Por entidade
        stats.por_entidade[log.entidade_afetada] = (stats.por_entidade[log.entidade_afetada] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Busca alertas de auditoria
   */
  async buscarAlertasAuditoria(): Promise<AlertaAuditoria[]> {
    try {
      const { data, error } = await supabase
        .from('alertas_auditoria')
        .select('*')
        .eq('resolvido', false)
        .order('data_deteccao', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar alertas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      throw error;
    }
  }

  /**
   * Busca configuração de auditoria
   */
  async buscarConfiguracao(): Promise<ConfiguracaoAuditoria> {
    try {
      const { data, error } = await supabase
        .from('configuracao_auditoria')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error || !data) {
        // Retorna configuração padrão
        return {
          id: 'default',
          acoes_registradas: {
            login: true,
            logout: true,
            criar: true,
            editar: true,
            excluir: true,
            enviar: true,
            exportar: true,
            visualizar: false
          },
          valor_limite_alerta: 5000,
          tentativas_login_alerta: 3,
          tempo_retencao_meses: 12,
          backup_automatico: true,
          notificacao_alertas: true,
          horario_padrao_inicio: '08:00',
          horario_padrao_fim: '18:00'
        };
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      throw error;
    }
  }

  /**
   * Atualiza configuração de auditoria
   */
  async atualizarConfiguracao(configuracao: ConfiguracaoAuditoria): Promise<void> {
    try {
      const { error } = await supabase
        .from('configuracao_auditoria')
        .upsert(configuracao);

      if (error) {
        throw new Error(`Erro ao atualizar configuração: ${error.message}`);
      }

      // Registra a alteração
      await this.registrarAcao(
        'usuario_atual',
        'editar',
        'configuracao_auditoria',
        'default',
        'Configuração de auditoria atualizada'
      );
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  }

  /**
   * Exporta logs para CSV ou Excel
   */
  async exportarLogs(filtros: FiltrosAuditoria = {}, formato: 'csv' | 'xlsx'): Promise<string> {
    try {
      const logs = await this.buscarLogs(filtros);
      
      // Cabeçalho
      const cabecalho = [
        'Data/Hora',
        'Usuário',
        'Ação',
        'Entidade Afetada',
        'ID da Entidade',
        'Detalhes',
        'Valores Envolvidos',
        'IP Origem',
        'Canal',
        'Nível de Risco'
      ].join(',');

      // Dados
      const linhas = logs.map(log => [
        new Date(log.data_acao).toLocaleString('pt-BR'),
        log.usuario,
        log.acao,
        log.entidade_afetada,
        log.entidade_id || '',
        (log.detalhes || '').replace(/,/g, ';'),
        log.valores_envolvidos || '',
        log.ip_origem || '',
        log.canal_origem || '',
        log.nivel_risco || ''
      ].join(','));

      const csv = [cabecalho, ...linhas].join('\n');

      // Registra a exportação
      await this.registrarAcao(
        'usuario_atual',
        'exportar',
        'logs_auditoria',
        undefined,
        `Exportação de ${logs.length} logs em formato ${formato.toUpperCase()}`
      );

      return csv;
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
      throw error;
    }
  }

  /**
   * Calcula nível de risco da ação
   */
  private calcularNivelRisco(acao: string, valor?: number): 'baixo' | 'medio' | 'alto' {
    // Ações de alto risco
    if (['excluir', 'login_fora_horario'].includes(acao)) {
      return 'alto';
    }

    // Valores altos
    if (valor && valor > 5000) {
      return 'alto';
    }

    // Ações de médio risco
    if (['editar', 'enviar'].includes(acao)) {
      return 'medio';
    }

    return 'baixo';
  }

  /**
   * Verifica se deve gerar alertas
   */
  private async verificarAlertas(log: Omit<LogAuditoria, 'id' | 'created_at'>): Promise<void> {
    try {
      const config = await this.buscarConfiguracao();
      const alertas: Omit<AlertaAuditoria, 'id' | 'created_at'>[] = [];

      // Alerta para exclusão manual
      if (log.acao === 'excluir' && log.entidade_afetada === 'cobranca') {
        alertas.push({
          tipo: 'exclusao_manual',
          titulo: 'Cobrança excluída manualmente',
          descricao: `Usuário ${log.usuario} excluiu uma cobrança`,
          nivel_risco: 'alto',
          data_deteccao: log.data_acao,
          usuario_envolvido: log.usuario,
          entidade_afetada: log.entidade_afetada,
          acao_recomendada: 'Verificar justificativa da exclusão',
          resolvido: false
        });
      }

      // Alerta para valor alto
      if (log.valores_envolvidos && log.valores_envolvidos > config.valor_limite_alerta) {
        alertas.push({
          tipo: 'valor_alto',
          titulo: 'Modificação de valor alto',
          descricao: `Valor de R$ ${log.valores_envolvidos.toFixed(2)} foi modificado`,
          nivel_risco: 'medio',
          data_deteccao: log.data_acao,
          usuario_envolvido: log.usuario,
          entidade_afetada: log.entidade_afetada,
          acao_recomendada: 'Verificar autorização para alteração',
          resolvido: false
        });
      }

      // Alerta para login fora do horário
      const hora = new Date(log.data_acao).getHours();
      if (log.acao === 'login' && (hora < 8 || hora > 18)) {
        alertas.push({
          tipo: 'login_fora_horario',
          titulo: 'Login fora do horário padrão',
          descricao: `Login realizado às ${new Date(log.data_acao).toLocaleTimeString('pt-BR')}`,
          nivel_risco: 'medio',
          data_deteccao: log.data_acao,
          usuario_envolvido: log.usuario,
          entidade_afetada: 'sistema',
          acao_recomendada: 'Verificar necessidade do acesso',
          resolvido: false
        });
      }

      // Inserir alertas no banco
      if (alertas.length > 0) {
        await supabase
          .from('alertas_auditoria')
          .insert(alertas);
      }
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  }

  /**
   * Resolve um alerta de auditoria
   */
  async resolverAlerta(alertaId: string, observacoes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('alertas_auditoria')
        .update({
          resolvido: true,
          data_resolucao: new Date().toISOString(),
          observacoes_resolucao: observacoes
        })
        .eq('id', alertaId);

      if (error) {
        throw new Error(`Erro ao resolver alerta: ${error.message}`);
      }

      // Registra a resolução
      await this.registrarAcao(
        'usuario_atual',
        'resolver_alerta',
        'alerta_auditoria',
        alertaId,
        `Alerta resolvido. ${observacoes || ''}`
      );
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      throw error;
    }
  }

  /**
   * Limpa logs antigos baseado na configuração
   */
  async limparLogsAntigos(): Promise<number> {
    try {
      const config = await this.buscarConfiguracao();
      const dataLimite = new Date();
      dataLimite.setMonth(dataLimite.getMonth() - config.tempo_retencao_meses);

      const { data, error } = await supabase
        .from('logs_auditoria')
        .delete()
        .lt('data_acao', dataLimite.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Erro ao limpar logs antigos: ${error.message}`);
      }

      const quantidadeRemovida = data?.length || 0;

      // Registra a limpeza
      await this.registrarAcao(
        'sistema',
        'limpeza_automatica',
        'logs_auditoria',
        undefined,
        `${quantidadeRemovida} logs antigos removidos automaticamente`
      );

      return quantidadeRemovida;
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
      throw error;
    }
  }

  /**
   * Gera backup dos logs
   */
  async gerarBackupLogs(): Promise<string> {
    try {
      const logs = await this.buscarLogs();
      const backup = {
        data_backup: new Date().toISOString(),
        total_logs: logs.length,
        logs: logs
      };

      const json = JSON.stringify(backup, null, 2);
      
      // Em produção, enviar para storage externo
      console.log('Backup gerado:', backup.total_logs, 'logs');

      // Registra o backup
      await this.registrarAcao(
        'sistema',
        'backup_automatico',
        'logs_auditoria',
        undefined,
        `Backup de ${logs.length} logs gerado`
      );

      return json;
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      throw error;
    }
  }
}