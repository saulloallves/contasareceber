import { supabase } from './databaseService';
import { CobrancaFranqueado } from '../types/cobranca';

export interface NotificacaoConfig {
  whatsapp_ativo: boolean;
  email_ativo: boolean;
  template_whatsapp: string;
  template_email_assunto: string;
  template_email_corpo: string;
  enviar_apenas_em_atraso: boolean;
  valor_minimo_notificacao: number;
}

export interface ResultadoNotificacao {
  whatsapp: {
    enviado: boolean;
    erro?: string;
  };
  email: {
    enviado: boolean;
    erro?: string;
  };
}

export class NotificacaoAutomaticaService {
  /**
   * Envia notificação automática para nova cobrança
   */
  async enviarNotificacaoNovaCobranca(cobrancaId: string): Promise<ResultadoNotificacao> {
    try {
      // Busca dados completos da cobrança
      const { data: cobranca, error: errorCobranca } = await supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            email_franqueado,
            telefone_franqueado,
            codigo_unidade
          )
        `)
        .eq('id', cobrancaId)
        .single();

      if (errorCobranca || !cobranca) {
        throw new Error('Cobrança não encontrada');
      }

      // Busca configurações de notificação
      const config = await this.buscarConfiguracaoNotificacao();

      // Verifica se deve enviar notificação
      if (!this.deveEnviarNotificacao(cobranca, config)) {
        return {
          whatsapp: { enviado: false },
          email: { enviado: false }
        };
      }

      const unidade = (cobranca as any).unidades_franqueadas;
      const resultado: ResultadoNotificacao = {
        whatsapp: { enviado: false },
        email: { enviado: false }
      };

      // Envia WhatsApp se configurado
      if (config.whatsapp_ativo && unidade?.telefone_franqueado) {
        try {
          await this.enviarWhatsApp(cobranca, unidade, config);
          resultado.whatsapp.enviado = true;
        } catch (error) {
          resultado.whatsapp.erro = String(error);
        }
      }

      // Envia Email se configurado
      if (config.email_ativo && unidade?.email_franqueado) {
        try {
          await this.enviarEmail(cobranca, unidade, config);
          resultado.email.enviado = true;
        } catch (error) {
          resultado.email.erro = String(error);
        }
      }

      // Registra log da notificação
      await this.registrarLogNotificacao(cobrancaId, resultado);

      return resultado;
    } catch (error) {
      console.error('Erro ao enviar notificação automática:', error);
      throw error;
    }
  }

  /**
   * Verifica se deve enviar notificação baseado nas configurações
   */
  private deveEnviarNotificacao(cobranca: any, config: NotificacaoConfig): boolean {
    // Verifica valor mínimo
    if ((cobranca.valor_atualizado || cobranca.valor_original) < config.valor_minimo_notificacao) {
      return false;
    }

    // Verifica se deve enviar apenas para cobranças em atraso
    if (config.enviar_apenas_em_atraso) {
      const hoje = new Date();
      const vencimento = new Date(cobranca.data_vencimento);
      if (vencimento >= hoje) {
        return false; // Não está em atraso
      }
    }

    // Verifica se já foi enviada notificação para esta cobrança
    return !this.jaFoiNotificada(cobranca.id);
  }

  /**
   * Envia notificação via WhatsApp
   */
  private async enviarWhatsApp(cobranca: any, unidade: any, config: NotificacaoConfig): Promise<void> {
    const mensagem = this.gerarMensagemWhatsApp(cobranca, unidade, config);
    
    // Busca configurações do WhatsApp
    const { data: configWhatsApp } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .in('chave', ['whatsapp_token', 'whatsapp_phone_id']);

    if (!configWhatsApp || configWhatsApp.length < 2) {
      throw new Error('Configurações do WhatsApp não encontradas');
    }

    const token = configWhatsApp.find(c => c.chave === 'whatsapp_token')?.valor;
    const phoneId = configWhatsApp.find(c => c.chave === 'whatsapp_phone_id')?.valor;

    if (!token || !phoneId) {
      throw new Error('Token ou Phone ID do WhatsApp não configurados');
    }

    // Formata telefone
    const telefone = this.formatarTelefone(unidade.telefone_franqueado);

    // Envia mensagem
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'text',
        text: {
          body: mensagem
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro WhatsApp: ${errorData.error?.message || response.statusText}`);
    }

    // Registra envio
    await supabase
      .from('envios_mensagem')
      .insert({
        titulo_id: cobranca.id,
        cliente: cobranca.cliente,
        cnpj: cobranca.cnpj,
        telefone: telefone,
        mensagem_enviada: mensagem,
        status_envio: 'sucesso',
        referencia_importacao: 'NOTIFICACAO_AUTOMATICA'
      });
  }

  /**
   * Envia notificação via Email
   */
  private async enviarEmail(cobranca: any, unidade: any, config: NotificacaoConfig): Promise<void> {
    const assunto = this.aplicarVariaveis(config.template_email_assunto, cobranca, unidade);
    const corpo = this.aplicarVariaveis(config.template_email_corpo, cobranca, unidade);

    // Busca configurações de email
    const { data: configEmail } = await supabase
      .from('configuracoes_sistema')
      .select('valor')
      .in('chave', ['smtp_host', 'smtp_user', 'smtp_password']);

    // Em produção, integrar com serviço de email real (SendGrid, AWS SES, etc.)
    // Por enquanto, simula o envio
    console.log('Enviando email:', {
      para: unidade.email_franqueado,
      assunto,
      corpo
    });

    // Registra log do envio de email
    await supabase
      .from('logs_sistema')
      .insert({
        usuario_id: 'sistema_automatico',
        acao: 'envio_email_automatico',
        tabela_afetada: 'cobrancas_franqueados',
        registro_id: cobranca.id,
        dados_novos: {
          destinatario: unidade.email_franqueado,
          assunto,
          tipo: 'notificacao_nova_cobranca'
        }
      });
  }

  /**
   * Gera mensagem personalizada para WhatsApp
   */
  private gerarMensagemWhatsApp(cobranca: any, unidade: any, config: NotificacaoConfig): string {
    return this.aplicarVariaveis(config.template_whatsapp, cobranca, unidade);
  }

  /**
   * Aplica variáveis aos templates
   */
  private aplicarVariaveis(template: string, cobranca: any, unidade: any): string {
    const variaveis = {
      '{{cliente}}': unidade.nome_franqueado || cobranca.cliente,
      '{{codigo_unidade}}': unidade.codigo_unidade || 'N/A',
      '{{cnpj}}': this.formatarCNPJ(cobranca.cnpj),
      '{{valor_original}}': this.formatarMoeda(cobranca.valor_original),
      '{{valor_atualizado}}': this.formatarMoeda(cobranca.valor_atualizado || cobranca.valor_original),
      '{{data_vencimento}}': this.formatarData(cobranca.data_vencimento),
      '{{dias_atraso}}': this.calcularDiasAtraso(cobranca.data_vencimento).toString(),
      '{{tipo_cobranca}}': cobranca.tipo_cobranca || 'Cobrança',
      '{{data_atual}}': this.formatarData(new Date().toISOString()),
      '{{link_negociacao}}': 'https://calendly.com/crescieperdi/negociacao'
    };

    let mensagem = template;
    Object.entries(variaveis).forEach(([variavel, valor]) => {
      const regex = new RegExp(variavel.replace(/[{}]/g, '\\$&'), 'g');
      mensagem = mensagem.replace(regex, valor);
    });

    return mensagem;
  }

  /**
   * Busca configuração de notificação
   */
  async buscarConfiguracaoNotificacao(): Promise<NotificacaoConfig> {
    const { data, error } = await supabase
      .from('configuracao_notificacao_automatica')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data) {
      // Retorna configuração padrão
      return {
        whatsapp_ativo: true,
        email_ativo: true,
        template_whatsapp: `Olá, {{cliente}}! 👋

Uma nova cobrança foi registrada para sua unidade {{codigo_unidade}}.

📋 *Detalhes:*
• Valor: {{valor_atualizado}}
• Vencimento: {{data_vencimento}}
• Tipo: {{tipo_cobranca}}

Para negociar ou esclarecer dúvidas, entre em contato conosco.

_Mensagem automática do sistema de cobrança_`,
        template_email_assunto: 'Nova Cobrança Registrada - {{codigo_unidade}}',
        template_email_corpo: `Prezado(a) {{cliente}},

Informamos que foi registrada uma nova cobrança para sua unidade {{codigo_unidade}}.

Detalhes da Cobrança:
- Valor: {{valor_atualizado}}
- Data de Vencimento: {{data_vencimento}}
- Tipo: {{tipo_cobranca}}

Para esclarecimentos ou negociação, entre em contato através dos nossos canais oficiais.

Atenciosamente,
Equipe Financeira`,
        enviar_apenas_em_atraso: false,
        valor_minimo_notificacao: 0
      };
    }

    return data;
  }

  /**
   * Salva configuração de notificação
   */
  async salvarConfiguracaoNotificacao(config: NotificacaoConfig, usuario: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('configuracao_notificacao_automatica')
        .upsert({
          id: 'default',
          ...config,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Erro ao salvar configuração de notificação: ${error.message}`);
      }

      // Registra log da alteração
      await supabase
        .from('logs_sistema')
        .insert({
          usuario_id: usuario,
          acao: 'atualizar_configuracao_notificacao',
          tabela_afetada: 'configuracao_notificacao_automatica',
          registro_id: 'default',
          dados_novos: config
        });
    } catch (error) {
      console.error('Erro ao salvar configuração de notificação:', error);
      throw error;
    }
  }

  /**
   * Verifica se já foi enviada notificação para esta cobrança
   */
  private async jaFoiNotificada(cobrancaId: string): Promise<boolean> {
    const { data } = await supabase
      .from('envios_mensagem')
      .select('id')
      .eq('titulo_id', cobrancaId)
      .eq('referencia_importacao', 'NOTIFICACAO_AUTOMATICA')
      .limit(1);

    return (data?.length || 0) > 0;
  }

  /**
   * Registra log da notificação
   */
  private async registrarLogNotificacao(cobrancaId: string, resultado: ResultadoNotificacao): Promise<void> {
    await supabase
      .from('logs_sistema')
      .insert({
        usuario_id: 'sistema_automatico',
        acao: 'notificacao_automatica',
        tabela_afetada: 'cobrancas_franqueados',
        registro_id: cobrancaId,
        dados_novos: resultado
      });
  }

  /**
   * Métodos auxiliares de formatação
   */
  private formatarTelefone(telefone: string): string {
    const apenasNumeros = telefone.replace(/\D/g, '');
    if (apenasNumeros.length === 11) {
      return `55${apenasNumeros}`;
    }
    return apenasNumeros;
  }

  private formatarCNPJ(cnpj: string): string {
    const apenasNumeros = cnpj.replace(/\D/g, '');
    if (apenasNumeros.length === 14) {
      return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cnpj;
  }

  private formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  private formatarData(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  private calcularDiasAtraso(dataVencimento: string): number {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }
}