import { createClient } from '@supabase/supabase-js';
import { BloqueioUnidade, ConfiguracaoBloqueio, HistoricoBloqueio, FiltrosBloqueio, EstatisticasBloqueio, CriterioBloqueio, NotificacaoBloqueio, TipoAcesso } from '../types/bloqueio';
import { TrativativasService } from './tratativasService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class BloqueioService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Verifica critérios de bloqueio para uma unidade
   */
  async verificarCriteriosBloqueio(cnpjUnidade: string): Promise<CriterioBloqueio> {
    try {
      const config = await this.buscarConfiguracao();
      
      // Busca dados da unidade
      const [cobrancas, scoreRisco, reunioes, acordos] = await Promise.all([
        this.buscarCobrancasUnidade(cnpjUnidade),
        this.buscarScoreRisco(cnpjUnidade),
        this.buscarReunioes(cnpjUnidade),
        this.buscarAcordos(cnpjUnidade)
      ]);

      // Calcula valor total em aberto
      const valorEmAberto = cobrancas
        .filter(c => c.status === 'em_aberto')
        .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);

      // Verifica critérios principais
      const criterios = {
        valor_alto: valorEmAberto >= config.valor_minimo_bloqueio,
        score_baixo: scoreRisco && scoreRisco.score_atual < config.score_minimo_bloqueio,
        nao_compareceu: reunioes.some(r => r.status_reuniao === 'nao_compareceu'),
        quebrou_acordo: acordos.some(a => a.status_acordo === 'quebrado'),
        recusou_negociacao: this.verificarRecusaNegociacao(cnpjUnidade)
      };

      // Determina se deve bloquear
      const deveBloquear = criterios.valor_alto || criterios.score_baixo || 
                          criterios.nao_compareceu || criterios.quebrou_acordo || 
                          criterios.recusou_negociacao;

      // Determina motivo principal
      let motivo = '';
      let urgencia: 'baixa' | 'media' | 'alta' | 'critica' = 'baixa';
      
      if (criterios.valor_alto) {
        motivo = `Valor em aberto superior a R$ ${config.valor_minimo_bloqueio.toFixed(2)}`;
        urgencia = valorEmAberto > config.valor_minimo_bloqueio * 2 ? 'critica' : 'alta';
      } else if (criterios.score_baixo) {
        motivo = `Score de risco baixo (${scoreRisco?.score_atual || 0} pontos)`;
        urgencia = 'alta';
      } else if (criterios.quebrou_acordo) {
        motivo = 'Quebra de acordo de parcelamento';
        urgencia = 'critica';
      } else if (criterios.nao_compareceu) {
        motivo = 'Não comparecimento a reunião agendada';
        urgencia = 'media';
      } else if (criterios.recusou_negociacao) {
        motivo = 'Recusa explícita de negociação';
        urgencia = 'alta';
      }

      // Determina acessos a bloquear baseado na urgência
      let acessosBloquear: TipoAcesso[] = [];
      
      switch (urgencia) {
        case 'critica':
          acessosBloquear = ['solutto', 'giragrama', 'campanhas', 'eventos', 'girabot', 'painel_franqueado'];
          break;
        case 'alta':
          acessosBloquear = ['solutto', 'giragrama', 'campanhas', 'girabot'];
          break;
        case 'media':
          acessosBloquear = ['campanhas', 'eventos'];
          break;
        default:
          acessosBloquear = config.acessos_bloqueados_padrao;
      }

      return {
        deve_bloquear: deveBloquear,
        motivo,
        acessos_bloquear: acessosBloquear,
        urgencia
      };
    } catch (error) {
      console.error('Erro ao verificar critérios de bloqueio:', error);
      return {
        deve_bloquear: false,
        motivo: 'Erro na verificação',
        acessos_bloquear: [],
        urgencia: 'baixa'
      };
    }
  }

  /**
   * Executa bloqueio de uma unidade
   */
  async executarBloqueio(cnpjUnidade: string, criterio: CriterioBloqueio): Promise<BloqueioUnidade> {
    try {
      // Busca dados da unidade
      const valorEmAberto = await this.calcularValorEmAberto(cnpjUnidade);
      const scoreRisco = await this.buscarScoreRisco(cnpjUnidade);

      // Cria registro de bloqueio
      const bloqueio: Omit<BloqueioUnidade, 'id' | 'created_at' | 'updated_at'> = {
        cnpj_unidade: cnpjUnidade,
        status_bloqueio: 'ativo',
        motivo_bloqueio: this.mapearMotivoEnum(criterio.motivo),
        valor_em_aberto: valorEmAberto,
        score_risco: scoreRisco?.score_atual,
        data_bloqueio: new Date().toISOString(),
        notificacoes_enviadas: 0,
        acessos_bloqueados: criterio.acessos_bloquear,
        observacoes: `Bloqueio automático: ${criterio.motivo}`
      };

      const { data: bloqueioSalvo, error } = await supabase
        .from('bloqueios_unidades')
        .insert(bloqueio)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar bloqueio: ${error.message}`);
      }

      // Executa bloqueios nos sistemas externos
      await this.executarBloqueiosExternos(cnpjUnidade, criterio.acessos_bloquear);

      // Registra no histórico
      await this.registrarHistorico(cnpjUnidade, 'bloqueio', criterio.motivo);

      // Envia notificação
      await this.enviarNotificacaoBloqueio(cnpjUnidade, criterio.motivo);

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        '', // Será preenchido via trigger se houver título ativo
        'sistema_bloqueio',
        `Unidade bloqueada automaticamente: ${criterio.motivo}`,
        'bloqueado'
      );

      return bloqueioSalvo;
    } catch (error) {
      console.error('Erro ao executar bloqueio:', error);
      throw error;
    }
  }

  /**
   * Executa desbloqueio após regularização
   */
  async executarDesbloqueio(cnpjUnidade: string, motivo: string = 'Regularização de débitos'): Promise<void> {
    try {
      // Atualiza status do bloqueio
      const { error } = await supabase
        .from('bloqueios_unidades')
        .update({
          status_bloqueio: 'desbloqueado',
          data_desbloqueio: new Date().toISOString(),
          observacoes: motivo
        })
        .eq('cnpj_unidade', cnpjUnidade)
        .eq('status_bloqueio', 'ativo');

      if (error) {
        throw new Error(`Erro ao desbloquear: ${error.message}`);
      }

      // Busca acessos que estavam bloqueados
      const { data: bloqueio } = await supabase
        .from('bloqueios_unidades')
        .select('acessos_bloqueados')
        .eq('cnpj_unidade', cnpjUnidade)
        .eq('status_bloqueio', 'desbloqueado')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (bloqueio) {
        // Executa desbloqueios nos sistemas externos
        await this.executarDesbloqueiosExternos(cnpjUnidade, bloqueio.acessos_bloqueados);
      }

      // Registra no histórico
      await this.registrarHistorico(cnpjUnidade, 'desbloqueio', motivo);

      // Envia notificação de desbloqueio
      await this.enviarNotificacaoDesbloqueio(cnpjUnidade);

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        '',
        'sistema_bloqueio',
        `Unidade desbloqueada: ${motivo}`,
        'em_aberto'
      );
    } catch (error) {
      console.error('Erro ao executar desbloqueio:', error);
      throw error;
    }
  }

  /**
   * Verifica bloqueios em lote (execução diária)
   */
  async verificarBloqueiosLote(): Promise<number> {
    try {
      // Busca unidades ativas
      const { data: unidades } = await supabase
        .from('unidades_franqueadas')
        .select('codigo_unidade')
        .eq('status_unidade', 'ativa');

      if (!unidades) return 0;

      let bloqueiosExecutados = 0;

      for (const unidade of unidades) {
        try {
          // Verifica se já está bloqueada
          const { data: bloqueioExistente } = await supabase
            .from('bloqueios_unidades')
            .select('id')
            .eq('cnpj_unidade', unidade.codigo_unidade)
            .eq('status_bloqueio', 'ativo')
            .single();

          if (bloqueioExistente) continue; // Já bloqueada

          // Verifica critérios
          const criterio = await this.verificarCriteriosBloqueio(unidade.codigo_unidade);
          
          if (criterio.deve_bloquear) {
            // Verifica período de carência
            const podeBloquear = await this.verificarPeriodoCarencia(unidade.codigo_unidade);
            
            if (podeBloquear) {
              await this.executarBloqueio(unidade.codigo_unidade, criterio);
              bloqueiosExecutados++;
            }
          }
        } catch (error) {
          console.error(`Erro ao verificar bloqueio da unidade ${unidade.codigo_unidade}:`, error);
        }
      }

      return bloqueiosExecutados;
    } catch (error) {
      console.error('Erro na verificação em lote:', error);
      throw error;
    }
  }

  /**
   * Verifica desbloqueios automáticos
   */
  async verificarDesbloqueiosAutomaticos(): Promise<number> {
    try {
      // Busca unidades bloqueadas
      const { data: bloqueadas } = await supabase
        .from('bloqueios_unidades')
        .select('cnpj_unidade, motivo_bloqueio')
        .eq('status_bloqueio', 'ativo');

      if (!bloqueadas) return 0;

      let desbloqueiosExecutados = 0;

      for (const bloqueio of bloqueadas) {
        try {
          // Verifica se débitos foram regularizados
          const valorEmAberto = await this.calcularValorEmAberto(bloqueio.cnpj_unidade);
          
          if (valorEmAberto === 0) {
            await this.executarDesbloqueio(bloqueio.cnpj_unidade, 'Débitos regularizados automaticamente');
            desbloqueiosExecutados++;
          }
        } catch (error) {
          console.error(`Erro ao verificar desbloqueio da unidade ${bloqueio.cnpj_unidade}:`, error);
        }
      }

      return desbloqueiosExecutados;
    } catch (error) {
      console.error('Erro na verificação de desbloqueios:', error);
      throw error;
    }
  }

  /**
   * Busca bloqueios com filtros
   */
  async buscarBloqueios(filtros: FiltrosBloqueio = {}) {
    try {
      let query = supabase
        .from('bloqueios_unidades')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado,
            email_franqueado,
            telefone_franqueado
          )
        `)
        .order('created_at', { ascending: false });

      if (filtros.status_bloqueio) {
        query = query.eq('status_bloqueio', filtros.status_bloqueio);
      }

      if (filtros.motivo_bloqueio) {
        query = query.eq('motivo_bloqueio', filtros.motivo_bloqueio);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_bloqueio', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_bloqueio', filtros.dataFim);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      if (filtros.valor_min) {
        query = query.gte('valor_em_aberto', filtros.valor_min);
      }

      if (filtros.score_max) {
        query = query.lte('score_risco', filtros.score_max);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar bloqueios: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar bloqueios:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas dos bloqueios
   */
  async buscarEstatisticas(): Promise<EstatisticasBloqueio> {
    try {
      const { data: bloqueios } = await supabase
        .from('bloqueios_unidades')
        .select('*');

      if (!bloqueios) {
        return this.getEstatisticasVazias();
      }

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      const stats: EstatisticasBloqueio = {
        total_bloqueados: bloqueios.filter(b => b.status_bloqueio === 'ativo').length,
        total_pendentes: bloqueios.filter(b => b.status_bloqueio === 'pendente').length,
        total_desbloqueados_mes: bloqueios.filter(b => 
          b.status_bloqueio === 'desbloqueado' && 
          new Date(b.data_desbloqueio || '') >= inicioMes
        ).length,
        valor_total_bloqueado: bloqueios
          .filter(b => b.status_bloqueio === 'ativo')
          .reduce((sum, b) => sum + b.valor_em_aberto, 0),
        por_motivo: {},
        por_tipo_acesso: {},
        tempo_medio_desbloqueio: 0,
        efetividade_bloqueio: 0
      };

      // Estatísticas por motivo
      bloqueios.forEach(b => {
        stats.por_motivo[b.motivo_bloqueio] = (stats.por_motivo[b.motivo_bloqueio] || 0) + 1;
        
        // Por tipo de acesso
        b.acessos_bloqueados.forEach(acesso => {
          stats.por_tipo_acesso[acesso] = (stats.por_tipo_acesso[acesso] || 0) + 1;
        });
      });

      // Calcula tempo médio de desbloqueio
      const desbloqueados = bloqueios.filter(b => b.status_bloqueio === 'desbloqueado' && b.data_bloqueio && b.data_desbloqueio);
      if (desbloqueados.length > 0) {
        const tempos = desbloqueados.map(b => {
          const inicio = new Date(b.data_bloqueio!);
          const fim = new Date(b.data_desbloqueio!);
          return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        });
        stats.tempo_medio_desbloqueio = tempos.reduce((sum, t) => sum + t, 0) / tempos.length;
      }

      // Calcula efetividade (% de desbloqueios por regularização)
      const totalFinalizados = bloqueios.filter(b => ['desbloqueado'].includes(b.status_bloqueio)).length;
      if (totalFinalizados > 0) {
        const regularizados = desbloqueados.filter(b => 
          b.observacoes?.includes('regulariz') || b.observacoes?.includes('débitos')
        ).length;
        stats.efetividade_bloqueio = (regularizados / totalFinalizados) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return this.getEstatisticasVazias();
    }
  }

  /**
   * Executa bloqueios em sistemas externos
   */
  private async executarBloqueiosExternos(cnpjUnidade: string, acessos: TipoAcesso[]): Promise<void> {
    const config = await this.buscarConfiguracao();

    for (const acesso of acessos) {
      try {
        switch (acesso) {
          case 'solutto':
            if (config.webhook_solutto_url) {
              await this.chamarWebhook(config.webhook_solutto_url, {
                action: 'block',
                cnpj: cnpjUnidade,
                reason: 'inadimplencia'
              });
            }
            break;
          case 'giragrama':
            if (config.webhook_giragrama_url) {
              await this.chamarWebhook(config.webhook_giragrama_url, {
                action: 'block',
                cnpj: cnpjUnidade,
                service: 'media_sending'
              });
            }
            break;
          // Outros sistemas podem ser adicionados aqui
        }
      } catch (error) {
        console.error(`Erro ao bloquear acesso ${acesso} para ${cnpjUnidade}:`, error);
      }
    }
  }

  /**
   * Executa desbloqueios em sistemas externos
   */
  private async executarDesbloqueiosExternos(cnpjUnidade: string, acessos: TipoAcesso[]): Promise<void> {
    const config = await this.buscarConfiguracao();

    for (const acesso of acessos) {
      try {
        switch (acesso) {
          case 'solutto':
            if (config.webhook_solutto_url) {
              await this.chamarWebhook(config.webhook_solutto_url, {
                action: 'unblock',
                cnpj: cnpjUnidade
              });
            }
            break;
          case 'giragrama':
            if (config.webhook_giragrama_url) {
              await this.chamarWebhook(config.webhook_giragrama_url, {
                action: 'unblock',
                cnpj: cnpjUnidade,
                service: 'media_sending'
              });
            }
            break;
        }
      } catch (error) {
        console.error(`Erro ao desbloquear acesso ${acesso} para ${cnpjUnidade}:`, error);
      }
    }
  }

  /**
   * Chama webhook externo
   */
  private async chamarWebhook(url: string, dados: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        throw new Error(`Webhook falhou: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Erro ao chamar webhook:', error);
      throw error;
    }
  }

  /**
   * Envia notificação de bloqueio
   */
  private async enviarNotificacaoBloqueio(cnpjUnidade: string, motivo: string): Promise<void> {
    try {
      const config = await this.buscarConfiguracao();
      const { data: unidade } = await supabase
        .from('unidades_franqueadas')
        .select('nome_franqueado, codigo_unidade, email_franqueado, telefone_franqueado')
        .eq('codigo_unidade', cnpjUnidade)
        .single();

      if (!unidade) return;

      const notificacao: NotificacaoBloqueio = {
        destinatario: unidade.email_franqueado || '',
        assunto: 'Acesso suspenso por pendência financeira',
        mensagem: config.template_notificacao_bloqueio
          .replace('{{nome_franqueado}}', unidade.nome_franqueado)
          .replace('{{codigo_unidade}}', unidade.codigo_unidade)
          .replace('{{motivo}}', motivo),
        canal: 'email',
        template_usado: 'bloqueio_automatico'
      };

      // Em produção, integrar com serviço de email real
      console.log('Notificação de bloqueio enviada:', notificacao);

      // Atualiza contador de notificações
      await supabase
        .from('bloqueios_unidades')
        .update({ 
          notificacoes_enviadas: supabase.rpc('increment_notificacoes', { cnpj: cnpjUnidade })
        })
        .eq('cnpj_unidade', cnpjUnidade)
        .eq('status_bloqueio', 'ativo');
    } catch (error) {
      console.error('Erro ao enviar notificação de bloqueio:', error);
    }
  }

  /**
   * Envia notificação de desbloqueio
   */
  private async enviarNotificacaoDesbloqueio(cnpjUnidade: string): Promise<void> {
    try {
      const config = await this.buscarConfiguracao();
      const { data: unidade } = await supabase
        .from('unidades_franqueadas')
        .select('nome_franqueado, codigo_unidade, email_franqueado')
        .eq('codigo_unidade', cnpjUnidade)
        .single();

      if (!unidade) return;

      const notificacao: NotificacaoBloqueio = {
        destinatario: unidade.email_franqueado || '',
        assunto: 'Acessos reativados - Situação regularizada',
        mensagem: config.template_notificacao_desbloqueio
          .replace('{{nome_franqueado}}', unidade.nome_franqueado)
          .replace('{{codigo_unidade}}', unidade.codigo_unidade),
        canal: 'email',
        template_usado: 'desbloqueio_automatico'
      };

      // Em produção, integrar com serviço de email real
      console.log('Notificação de desbloqueio enviada:', notificacao);
    } catch (error) {
      console.error('Erro ao enviar notificação de desbloqueio:', error);
    }
  }

  /**
   * Registra ação no histórico
   */
  private async registrarHistorico(
    cnpjUnidade: string, 
    acao: 'bloqueio' | 'desbloqueio' | 'notificacao' | 'tentativa_acesso',
    motivo: string,
    detalhes?: any
  ): Promise<void> {
    try {
      const historico: Omit<HistoricoBloqueio, 'id' | 'created_at'> = {
        cnpj_unidade: cnpjUnidade,
        acao,
        motivo,
        usuario_responsavel: 'sistema_automatico',
        detalhes,
        data_acao: new Date().toISOString()
      };

      await supabase
        .from('historico_bloqueios')
        .insert(historico);
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
    }
  }

  /**
   * Verifica período de carência
   */
  private async verificarPeriodoCarencia(cnpjUnidade: string): Promise<boolean> {
    try {
      const config = await this.buscarConfiguracao();
      
      // Busca cobrança mais antiga em aberto
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('data_vencimento')
        .eq('cnpj', cnpjUnidade)
        .eq('status', 'em_aberto')
        .order('data_vencimento', { ascending: true })
        .limit(1)
        .single();

      if (!cobranca) return false;

      const vencimento = new Date(cobranca.data_vencimento);
      const hoje = new Date();
      const diasAtraso = Math.floor((hoje.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

      return diasAtraso >= config.dias_carencia;
    } catch (error) {
      console.error('Erro ao verificar período de carência:', error);
      return false;
    }
  }

  /**
   * Verifica recusa de negociação
   */
  private async verificarRecusaNegociacao(cnpjUnidade: string): Promise<boolean> {
    try {
      // Busca tratativas que indiquem recusa
      const { data: tratativas } = await supabase
        .from('tratativas_cobranca')
        .select('descricao')
        .in('titulo_id', 
          supabase
            .from('cobrancas_franqueados')
            .select('id')
            .eq('cnpj', cnpjUnidade)
        )
        .ilike('descricao', '%recus%')
        .limit(1);

      return (tratativas?.length || 0) > 0;
    } catch (error) {
      console.error('Erro ao verificar recusa:', error);
      return false;
    }
  }

  /**
   * Busca configuração do sistema
   */
  private async buscarConfiguracao(): Promise<ConfiguracaoBloqueio> {
    const { data, error } = await supabase
      .from('configuracao_bloqueios')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        id: 'default',
        valor_minimo_bloqueio: 5000,
        score_minimo_bloqueio: 50,
        dias_carencia: 5,
        notificacoes_antes_bloqueio: 2,
        acessos_bloqueados_padrao: ['campanhas', 'eventos'],
        template_notificacao_bloqueio: `Olá, {{nome_franqueado}},

Identificamos que sua unidade {{codigo_unidade}} permanece inadimplente. Por isso, alguns acessos e benefícios estão temporariamente bloqueados.

Motivo: {{motivo}}

Para regularização imediata e reativação dos acessos, entre em contato com o setor financeiro ou acesse sua central de cobrança.

Agradecemos sua atenção.
Equipe Cresci e Perdi`,
        template_notificacao_desbloqueio: `Olá, {{nome_franqueado}},

Informamos que os acessos da unidade {{codigo_unidade}} foram reativados após a regularização da situação financeira.

Agradecemos pela atenção e colaboração.
Equipe Cresci e Perdi`,
        ativo: true
      };
    }

    return data;
  }

  /**
   * Busca dados auxiliares
   */
  private async buscarCobrancasUnidade(cnpjUnidade: string) {
    const { data } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('cnpj', cnpjUnidade);
    return data || [];
  }

  private async buscarScoreRisco(cnpjUnidade: string) {
    const { data } = await supabase
      .from('score_risco_unidades')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade)
      .single();
    return data;
  }

  private async buscarReunioes(cnpjUnidade: string) {
    const { data } = await supabase
      .from('reunioes_negociacao')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade);
    return data || [];
  }

  private async buscarAcordos(cnpjUnidade: string) {
    const { data } = await supabase
      .from('acordos_parcelamento')
      .select('*')
      .eq('cnpj_unidade', cnpjUnidade);
    return data || [];
  }

  private async calcularValorEmAberto(cnpjUnidade: string): Promise<number> {
    const cobrancas = await this.buscarCobrancasUnidade(cnpjUnidade);
    return cobrancas
      .filter(c => c.status === 'em_aberto')
      .reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);
  }

  private mapearMotivoEnum(motivo: string): 'inadimplencia' | 'score_baixo' | 'nao_comparecimento' | 'quebra_acordo' | 'recusa_negociacao' {
    if (motivo.includes('valor') || motivo.includes('débito')) return 'inadimplencia';
    if (motivo.includes('score') || motivo.includes('risco')) return 'score_baixo';
    if (motivo.includes('comparec')) return 'nao_comparecimento';
    if (motivo.includes('acordo') || motivo.includes('quebra')) return 'quebra_acordo';
    if (motivo.includes('recus')) return 'recusa_negociacao';
    return 'inadimplencia';
  }

  private getEstatisticasVazias(): EstatisticasBloqueio {
    return {
      total_bloqueados: 0,
      total_pendentes: 0,
      total_desbloqueados_mes: 0,
      valor_total_bloqueado: 0,
      por_motivo: {},
      por_tipo_acesso: {},
      tempo_medio_desbloqueio: 0,
      efetividade_bloqueio: 0
    };
  }

  /**
   * Exporta dados dos bloqueios
   */
  async exportarBloqueios(filtros: FiltrosBloqueio = {}): Promise<string> {
    try {
      const bloqueios = await this.buscarBloqueios(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'CNPJ',
        'Nome Franqueado',
        'Status Bloqueio',
        'Motivo',
        'Valor em Aberto',
        'Score Risco',
        'Data Bloqueio',
        'Data Desbloqueio',
        'Acessos Bloqueados',
        'Notificações Enviadas'
      ].join(',');

      // Dados
      const linhas = bloqueios.map(bloqueio => [
        bloqueio.cnpj_unidade,
        (bloqueio as any).unidades_franqueadas?.nome_franqueado || '',
        bloqueio.status_bloqueio,
        bloqueio.motivo_bloqueio,
        bloqueio.valor_em_aberto.toFixed(2),
        bloqueio.score_risco || '',
        bloqueio.data_bloqueio ? new Date(bloqueio.data_bloqueio).toLocaleDateString('pt-BR') : '',
        bloqueio.data_desbloqueio ? new Date(bloqueio.data_desbloqueio).toLocaleDateString('pt-BR') : '',
        bloqueio.acessos_bloqueados.join(';'),
        bloqueio.notificacoes_enviadas
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar bloqueios:', error);
      throw error;
    }
  }
}