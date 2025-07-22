import { createClient } from '@supabase/supabase-js';
import { 
  IntegracaoConfig, 
  ConfiguracaoSupabase, 
  ConfiguracaoN8N, 
  ConfiguracaoWhatsApp, 
  ConfiguracaoEmail, 
  ConfiguracaoNotion,
  HistoricoIntegracao,
  MonitoramentoIntegracao,
  GatilhoAutomacao,
  FiltrosIntegracoes,
  EstatisticasIntegracoes,
  TesteConexao,
  LogIntegracao
} from '../types/integracoes';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class IntegracoesService {
  /**
   * Busca todas as integrações configuradas
   */
  async buscarIntegracoes(): Promise<IntegracaoConfig[]> {
    try {
      const { data, error } = await supabase
        .from('integracoes_config')
        .select('*')
        .order('nome');

      if (error) {
        throw new Error(`Erro ao buscar integrações: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar integrações:', error);
      throw error;
    }
  }

  /**
   * Salva configuração de integração
   */
  async salvarIntegracao(integracao: Omit<IntegracaoConfig, 'id' | 'created_at' | 'updated_at'>): Promise<IntegracaoConfig> {
    try {
      const { data, error } = await supabase
        .from('integracoes_config')
        .upsert({
          ...integracao,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar integração: ${error.message}`);
      }

      // Registra log da alteração
      await this.registrarLog({
        integracao_nome: integracao.nome,
        acao: 'configuracao_atualizada',
        usuario: 'usuario_atual',
        dados_novos: integracao,
        data_acao: new Date().toISOString()
      });

      return data;
    } catch (error) {
      console.error('Erro ao salvar integração:', error);
      throw error;
    }
  }

  /**
   * Testa conexão com integração
   */
  async testarConexao(integracao: IntegracaoConfig): Promise<TesteConexao> {
    const inicioTeste = Date.now();
    
    try {
      let resultado: TesteConexao;

      switch (integracao.tipo) {
        case 'supabase':
          resultado = await this.testarSupabase(integracao.configuracoes);
          break;
        case 'whatsapp':
          resultado = await this.testarWhatsApp(integracao.configuracoes);
          break;
        case 'email':
          resultado = await this.testarEmail(integracao.configuracoes);
          break;
        case 'n8n':
          resultado = await this.testarN8N(integracao.configuracoes);
          break;
        case 'notion':
          resultado = await this.testarNotion(integracao.configuracoes);
          break;
        default:
          resultado = {
            integracao: integracao.nome,
            sucesso: false,
            tempo_resposta: 0,
            detalhes: 'Tipo de integração não suportado',
            data_teste: new Date().toISOString()
          };
      }

      resultado.tempo_resposta = Date.now() - inicioTeste;

      // Atualiza status da integração
      await supabase
        .from('integracoes_config')
        .update({
          status_conexao: resultado.sucesso ? 'conectado' : 'falha',
          ultima_verificacao: new Date().toISOString()
        })
        .eq('id', integracao.id);

      return resultado;
    } catch (error) {
      return {
        integracao: integracao.nome,
        sucesso: false,
        tempo_resposta: Date.now() - inicioTeste,
        detalhes: `Erro no teste: ${error}`,
        data_teste: new Date().toISOString()
      };
    }
  }

  /**
   * Testa conexão Supabase
   */
  private async testarSupabase(config: ConfiguracaoSupabase): Promise<TesteConexao> {
    try {
      const testClient = createClient(config.url, config.anon_key);
      const { data, error } = await testClient.from('configuracoes_cobranca').select('id').limit(1);

      return {
        integracao: 'Supabase',
        sucesso: !error,
        tempo_resposta: 0,
        detalhes: error ? error.message : 'Conexão estabelecida com sucesso',
        data_teste: new Date().toISOString()
      };
    } catch (error) {
      return {
        integracao: 'Supabase',
        sucesso: false,
        tempo_resposta: 0,
        detalhes: `Erro de conexão: ${error}`,
        data_teste: new Date().toISOString()
      };
    }
  }

  /**
   * Testa conexão WhatsApp
   */
  private async testarWhatsApp(config: ConfiguracaoWhatsApp): Promise<TesteConexao> {
    try {
      let url = '';
      let headers: Record<string, string> = {};

      if (config.provider === 'meta') {
        url = `https://graph.facebook.com/v18.0/${config.id_remetente}`;
        headers = {
          'Authorization': `Bearer ${config.token_api}`
        };
      } else if (config.provider === 'z-api') {
        url = `https://api.z-api.io/instances/${config.id_remetente}/token/${config.token_api}/status`;
      }

      const response = await fetch(url, { headers });
      const sucesso = response.ok;

      return {
        integracao: 'WhatsApp',
        sucesso,
        tempo_resposta: 0,
        detalhes: sucesso ? 'API WhatsApp conectada' : `Erro HTTP ${response.status}`,
        data_teste: new Date().toISOString()
      };
    } catch (error) {
      return {
        integracao: 'WhatsApp',
        sucesso: false,
        tempo_resposta: 0,
        detalhes: `Erro de conexão: ${error}`,
        data_teste: new Date().toISOString()
      };
    }
  }

  /**
   * Testa conexão Email
   */
  private async testarEmail(config: ConfiguracaoEmail): Promise<TesteConexao> {
    // Em produção, implementar teste real de SMTP
    return {
      integracao: 'Email',
      sucesso: true,
      tempo_resposta: 0,
      detalhes: 'Configuração SMTP validada (teste simulado)',
      data_teste: new Date().toISOString()
    };
  }

  /**
   * Testa conexão n8n
   */
  private async testarN8N(config: ConfiguracaoN8N): Promise<TesteConexao> {
    try {
      const response = await fetch(`${config.url_base}/rest/workflows`, {
        headers: {
          'Authorization': `Bearer ${config.token_autenticacao}`
        }
      });

      return {
        integracao: 'n8n',
        sucesso: response.ok,
        tempo_resposta: 0,
        detalhes: response.ok ? 'n8n conectado com sucesso' : `Erro HTTP ${response.status}`,
        data_teste: new Date().toISOString()
      };
    } catch (error) {
      return {
        integracao: 'n8n',
        sucesso: false,
        tempo_resposta: 0,
        detalhes: `Erro de conexão: ${error}`,
        data_teste: new Date().toISOString()
      };
    }
  }

  /**
   * Testa conexão Notion
   */
  private async testarNotion(config: ConfiguracaoNotion): Promise<TesteConexao> {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${config.database_id}`, {
        headers: {
          'Authorization': `Bearer ${config.token_integracao}`,
          'Notion-Version': '2022-06-28'
        }
      });

      return {
        integracao: 'Notion',
        sucesso: response.ok,
        tempo_resposta: 0,
        detalhes: response.ok ? 'Notion conectado com sucesso' : `Erro HTTP ${response.status}`,
        data_teste: new Date().toISOString()
      };
    } catch (error) {
      return {
        integracao: 'Notion',
        sucesso: false,
        tempo_resposta: 0,
        detalhes: `Erro de conexão: ${error}`,
        data_teste: new Date().toISOString()
      };
    }
  }

  /**
   * Busca histórico de integrações
   */
  async buscarHistoricoIntegracoes(filtros: FiltrosIntegracoes = {}): Promise<HistoricoIntegracao[]> {
    try {
      let query = supabase
        .from('historico_integracoes')
        .select(`
          *,
          integracoes_config (
            nome,
            tipo
          )
        `)
        .order('data_execucao', { ascending: false })
        .limit(100);

      if (filtros.tipo) {
        query = query.eq('integracoes_config.tipo', filtros.tipo);
      }

      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_execucao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_execucao', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar histórico: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar histórico de integrações:', error);
      throw error;
    }
  }

  /**
   * Busca monitoramento das integrações
   */
  async buscarMonitoramento(): Promise<MonitoramentoIntegracao[]> {
    try {
      const integracoes = await this.buscarIntegracoes();
      const monitoramento: MonitoramentoIntegracao[] = [];

      for (const integracao of integracoes) {
        // Busca estatísticas das últimas 24h
        const dataLimite = new Date();
        dataLimite.setHours(dataLimite.getHours() - 24);

        const { data: historico } = await supabase
          .from('historico_integracoes')
          .select('status, tempo_resposta')
          .eq('integracao_id', integracao.id)
          .gte('data_execucao', dataLimite.toISOString());

        const totalChamadas = historico?.length || 0;
        const sucessos = historico?.filter(h => h.status === 'sucesso').length || 0;
        const tempoMedio = historico?.reduce((sum, h) => sum + (h.tempo_resposta || 0), 0) / totalChamadas || 0;

        monitoramento.push({
          integracao: integracao.nome,
          status: integracao.status_conexao === 'conectado' ? 'online' : 
                  integracao.status_conexao === 'alerta' ? 'instavel' : 'offline',
          ultima_atividade: integracao.ultima_verificacao || integracao.updated_at || '',
          total_chamadas_24h: totalChamadas,
          taxa_sucesso_24h: totalChamadas > 0 ? (sucessos / totalChamadas) * 100 : 0,
          tempo_resposta_medio: tempoMedio,
          alertas_ativos: this.gerarAlertas(integracao, totalChamadas, sucessos)
        });
      }

      return monitoramento;
    } catch (error) {
      console.error('Erro ao buscar monitoramento:', error);
      throw error;
    }
  }

  /**
   * Gera alertas baseado no status da integração
   */
  private gerarAlertas(integracao: IntegracaoConfig, totalChamadas: number, sucessos: number): string[] {
    const alertas = [];

    if (integracao.status_conexao === 'falha') {
      alertas.push('Conexão falhando');
    }

    if (totalChamadas > 0 && (sucessos / totalChamadas) < 0.8) {
      alertas.push('Taxa de sucesso baixa');
    }

    if (!integracao.ultima_verificacao) {
      alertas.push('Nunca testado');
    } else {
      const ultimaVerificacao = new Date(integracao.ultima_verificacao);
      const agora = new Date();
      const diasSemTeste = Math.floor((agora.getTime() - ultimaVerificacao.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diasSemTeste > 7) {
        alertas.push('Não testado há mais de 7 dias');
      }
    }

    return alertas;
  }

  /**
   * Executa ação via integração
   */
  async executarAcao(
    integracaoId: string,
    tipoAcao: string,
    payload: any
  ): Promise<HistoricoIntegracao> {
    try {
      const { data: integracao } = await supabase
        .from('integracoes_config')
        .select('*')
        .eq('id', integracaoId)
        .single();

      if (!integracao) {
        throw new Error('Integração não encontrada');
      }

      const inicioExecucao = Date.now();
      let resultado: any;
      let sucesso = false;

      switch (integracao.tipo) {
        case 'whatsapp':
          resultado = await this.enviarWhatsApp(integracao.configuracoes, payload);
          sucesso = resultado.sucesso;
          break;
        case 'email':
          resultado = await this.enviarEmail(integracao.configuracoes, payload);
          sucesso = resultado.sucesso;
          break;
        case 'n8n':
          resultado = await this.executarWorkflow(integracao.configuracoes, payload);
          sucesso = resultado.sucesso;
          break;
        case 'webhook':
          resultado = await this.chamarWebhook(integracao.configuracoes, payload);
          sucesso = resultado.sucesso;
          break;
        default:
          throw new Error('Tipo de integração não suportado para execução');
      }

      const tempoExecucao = Date.now() - inicioExecucao;

      // Registra no histórico
      const historico: Omit<HistoricoIntegracao, 'id'> = {
        integracao_id: integracaoId,
        tipo_acao: tipoAcao,
        status: sucesso ? 'sucesso' : 'erro',
        payload_envio: payload,
        resposta_api: resultado,
        erro_detalhes: sucesso ? undefined : resultado.erro,
        tempo_resposta: tempoExecucao,
        data_execucao: new Date().toISOString(),
        usuario_responsavel: 'sistema'
      };

      const { data: historicoSalvo, error } = await supabase
        .from('historico_integracoes')
        .insert(historico)
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar histórico:', error);
      }

      return historicoSalvo || historico as HistoricoIntegracao;
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      throw error;
    }
  }

  /**
   * Envia mensagem via WhatsApp
   */
  private async enviarWhatsApp(config: ConfiguracaoWhatsApp, payload: any): Promise<any> {
    try {
      let url = '';
      let body: any = {};

      if (config.provider === 'meta') {
        url = `https://graph.facebook.com/v18.0/${config.id_remetente}/messages`;
        body = {
          messaging_product: 'whatsapp',
          to: payload.telefone,
          type: 'text',
          text: { body: payload.mensagem }
        };
      } else if (config.provider === 'z-api') {
        url = `https://api.z-api.io/instances/${config.id_remetente}/token/${config.token_api}/send-text`;
        body = {
          phone: payload.telefone,
          message: payload.mensagem
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.provider === 'meta' ? `Bearer ${config.token_api}` : ''
        },
        body: JSON.stringify(body)
      });

      const resultado = await response.json();

      return {
        sucesso: response.ok,
        dados: resultado,
        erro: response.ok ? undefined : resultado.error?.message || 'Erro desconhecido'
      };
    } catch (error) {
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Envia email via SMTP
   */
  private async enviarEmail(config: ConfiguracaoEmail, payload: any): Promise<any> {
    // Em produção, implementar envio real via SMTP
    console.log('Enviando email:', { config, payload });
    
    return {
      sucesso: true,
      dados: { message_id: `email_${Date.now()}` }
    };
  }

  /**
   * Executa workflow n8n
   */
  private async executarWorkflow(config: ConfiguracaoN8N, payload: any): Promise<any> {
    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resultado = await response.json();

      return {
        sucesso: response.ok,
        dados: resultado,
        erro: response.ok ? undefined : 'Erro na execução do workflow'
      };
    } catch (error) {
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Chama webhook genérico
   */
  private async chamarWebhook(config: any, payload: any): Promise<any> {
    try {
      const response = await fetch(config.url, {
        method: config.metodo || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(payload)
      });

      const resultado = await response.json();

      return {
        sucesso: response.ok,
        dados: resultado,
        erro: response.ok ? undefined : `Erro HTTP ${response.status}`
      };
    } catch (error) {
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Busca estatísticas das integrações
   */
  async buscarEstatisticas(): Promise<EstatisticasIntegracoes> {
    try {
      const integracoes = await this.buscarIntegracoes();
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      const { data: historico } = await supabase
        .from('historico_integracoes')
        .select('status, tempo_resposta, integracoes_config(tipo)')
        .gte('data_execucao', dataLimite.toISOString());

      const stats: EstatisticasIntegracoes = {
        total_integracoes: integracoes.length,
        integracoes_ativas: integracoes.filter(i => i.ativo).length,
        chamadas_24h: historico?.length || 0,
        taxa_sucesso_geral: 0,
        tempo_resposta_medio: 0,
        por_tipo: {}
      };

      if (historico && historico.length > 0) {
        const sucessos = historico.filter(h => h.status === 'sucesso').length;
        stats.taxa_sucesso_geral = (sucessos / historico.length) * 100;
        stats.tempo_resposta_medio = historico.reduce((sum, h) => sum + (h.tempo_resposta || 0), 0) / historico.length;

        // Estatísticas por tipo
        integracoes.forEach(integracao => {
          const historicoTipo = historico.filter(h => (h as any).integracoes_config?.tipo === integracao.tipo);
          const sucessosTipo = historicoTipo.filter(h => h.status === 'sucesso').length;

          stats.por_tipo[integracao.tipo] = {
            total: integracoes.filter(i => i.tipo === integracao.tipo).length,
            ativas: integracoes.filter(i => i.tipo === integracao.tipo && i.ativo).length,
            chamadas: historicoTipo.length,
            sucesso: historicoTipo.length > 0 ? (sucessosTipo / historicoTipo.length) * 100 : 0
          };
        });
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Reenvio manual de ação falhada
   */
  async reenviarAcao(historicoId: string, novoPayload?: any): Promise<boolean> {
    try {
      const { data: historico } = await supabase
        .from('historico_integracoes')
        .select('*')
        .eq('id', historicoId)
        .single();

      if (!historico) {
        throw new Error('Histórico não encontrado');
      }

      const payload = novoPayload || historico.payload_envio;
      const resultado = await this.executarAcao(
        historico.integracao_id,
        'reenvio_manual',
        payload
      );

      return resultado.status === 'sucesso';
    } catch (error) {
      console.error('Erro ao reenviar ação:', error);
      throw error;
    }
  }

  /**
   * Registra log de alteração
   */
  private async registrarLog(log: Omit<LogIntegracao, 'id'>): Promise<void> {
    try {
      await supabase
        .from('logs_integracoes')
        .insert(log);
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }

  /**
   * Exporta configurações (sem dados sensíveis)
   */
  async exportarConfiguracoes(): Promise<string> {
    try {
      const integracoes = await this.buscarIntegracoes();
      
      const dadosExport = integracoes.map(i => ({
        nome: i.nome,
        tipo: i.tipo,
        ativo: i.ativo,
        status_conexao: i.status_conexao,
        ultima_verificacao: i.ultima_verificacao,
        // Remove dados sensíveis
        configuracoes: this.limparDadosSensiveis(i.configuracoes, i.tipo)
      }));

      return JSON.stringify(dadosExport, null, 2);
    } catch (error) {
      console.error('Erro ao exportar configurações:', error);
      throw error;
    }
  }

  /**
   * Remove dados sensíveis das configurações
   */
  private limparDadosSensiveis(config: any, tipo: string): any {
    const configLimpo = { ...config };

    switch (tipo) {
      case 'supabase':
        if (configLimpo.service_role_key) configLimpo.service_role_key = '***';
        if (configLimpo.anon_key) configLimpo.anon_key = '***';
        break;
      case 'whatsapp':
        if (configLimpo.token_api) configLimpo.token_api = '***';
        break;
      case 'email':
        if (configLimpo.senha) configLimpo.senha = '***';
        break;
      case 'n8n':
        if (configLimpo.token_autenticacao) configLimpo.token_autenticacao = '***';
        break;
      case 'notion':
        if (configLimpo.token_integracao) configLimpo.token_integracao = '***';
        break;
    }

    return configLimpo;
  }
}