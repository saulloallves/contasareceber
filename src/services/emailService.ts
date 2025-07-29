import { supabase } from './databaseService';

export interface ConfiguracaoEmail {
  id: string;
  servidor_smtp: string;
  porta: number;
  usuario: string;
  senha: string;
  nome_remetente: string;
  email_padrao: string;
  email_retorno: string;
  ssl_ativo: boolean;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmailTemplate {
  tipo: 'proposta_parcelamento' | 'cobranca_padrao' | 'cobranca_formal' | 'cobranca_urgente';
  assunto: string;
  corpo_html: string;
  corpo_texto: string;
}

export interface DadosEmail {
  destinatario: string;
  nome_destinatario: string;
  assunto: string;
  corpo_html: string;
  corpo_texto: string;
  anexos?: { nome: string; conteudo: string; tipo: string }[];
}

export interface ResultadoEnvio {
  sucesso: boolean;
  message_id?: string;
  erro?: string;
  detalhes?: any;
}

export class EmailService {
  /**
   * Envia email usando configuração do sistema
   */
  async enviarEmail(dados: DadosEmail): Promise<ResultadoEnvio> {
    try {
      // Busca configuração de email
      const config = await this.buscarConfiguracao();
      
      if (!config.ativo) {
        throw new Error('Serviço de email está desativado');
      }

      // Valida dados obrigatórios
      if (!dados.destinatario || !dados.assunto || !dados.corpo_html) {
        throw new Error('Destinatário, assunto e corpo são obrigatórios');
      }

      // Prepara dados para envio
      const emailData = {
        from: {
          email: config.email_padrao,
          name: config.nome_remetente
        },
        to: [{
          email: dados.destinatario,
          name: dados.nome_destinatario
        }],
        reply_to: {
          email: config.email_retorno,
          name: config.nome_remetente
        },
        subject: dados.assunto,
        html: dados.corpo_html,
        text: dados.corpo_texto,
        attachments: dados.anexos?.map(anexo => ({
          filename: anexo.nome,
          content: anexo.conteudo,
          type: anexo.tipo
        })) || []
      };

      // Envia via API (usando SendGrid como exemplo)
      const resultado = await this.enviarViaSendGrid(emailData, config);

      // Registra log do envio
      await this.registrarLogEnvio(dados, resultado);

      return resultado;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      
      const resultado: ResultadoEnvio = {
        sucesso: false,
        erro: String(error)
      };

      // Registra log do erro
      await this.registrarLogEnvio(dados, resultado);
      
      return resultado;
    }
  }

  /**
   * Envia proposta de parcelamento por email
   */
  async enviarPropostaParcelamento(
    propostaId: string,
    simulacao: any,
    dadosUnidade: any,
    dadosCobranca: any
  ): Promise<ResultadoEnvio> {
    try {
      if (!dadosUnidade.email_franqueado) {
        throw new Error('Email da unidade não cadastrado');
      }

      const template = this.gerarTemplatePropostaParcelamento(simulacao, dadosUnidade, dadosCobranca);
      
      const dados: DadosEmail = {
        destinatario: dadosUnidade.email_franqueado,
        nome_destinatario: dadosUnidade.nome_franqueado || dadosCobranca.cliente,
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto
      };

      const resultado = await this.enviarEmail(dados);

      // Atualiza status da proposta se enviado com sucesso
      if (resultado.sucesso) {
        await supabase
          .from('propostas_parcelamento')
          .update({ 
            data_envio: new Date().toISOString(),
            status_proposta: 'enviada'
          })
          .eq('id', propostaId);
      }

      return resultado;
    } catch (error) {
      console.error('Erro ao enviar proposta por email:', error);
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Envia mensagem de cobrança por email
   */
  async enviarMensagemCobranca(
    cobrancaId: string,
    tipoTemplate: 'padrao' | 'formal' | 'urgente' | 'personalizada',
    mensagemPersonalizada: string,
    dadosUnidade: any,
    dadosCobranca: any
  ): Promise<ResultadoEnvio> {
    try {
      if (!dadosUnidade.email_franqueado) {
        throw new Error('Email da unidade não cadastrado');
      }

      let template: EmailTemplate;
      
      if (tipoTemplate === 'personalizada') {
        template = {
          tipo: 'cobranca_padrao',
          assunto: `Cobrança Pendente - ${dadosUnidade.codigo_unidade || dadosCobranca.cnpj}`,
          corpo_html: this.converterTextoParaHTML(mensagemPersonalizada),
          corpo_texto: mensagemPersonalizada
        };
      } else {
        template = this.gerarTemplateCobranca(tipoTemplate, dadosUnidade, dadosCobranca);
      }

      const dados: DadosEmail = {
        destinatario: dadosUnidade.email_franqueado,
        nome_destinatario: dadosUnidade.nome_franqueado || dadosCobranca.cliente,
        assunto: template.assunto,
        corpo_html: template.corpo_html,
        corpo_texto: template.corpo_texto
      };

      const resultado = await this.enviarEmail(dados);

      // Registra envio na tabela de mensagens
      if (resultado.sucesso) {
        await supabase
          .from('envios_mensagem')
          .insert({
            titulo_id: cobrancaId,
            cliente: dadosCobranca.cliente,
            cnpj: dadosCobranca.cnpj,
            telefone: '', // Email não usa telefone
            mensagem_enviada: template.corpo_texto,
            status_envio: 'sucesso',
            referencia_importacao: 'EMAIL_MANUAL'
          });
      }

      return resultado;
    } catch (error) {
      console.error('Erro ao enviar mensagem por email:', error);
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Busca configuração de email
   */
  async buscarConfiguracao(): Promise<ConfiguracaoEmail> {
    const { data, error } = await supabase
      .from('configuracao_email')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      // Retorna configuração padrão (deve ser configurada pelo admin)
      return {
        id: 'default',
        servidor_smtp: 'smtp.gmail.com',
        porta: 587,
        usuario: 'seu-email@gmail.com',
        senha: 'sua-senha-app',
        nome_remetente: 'Cresci e Perdi - Financeiro',
        email_padrao: 'financeiro@crescieperdi.com',
        email_retorno: 'financeiro@crescieperdi.com',
        ssl_ativo: true,
        ativo: false // Inativo até ser configurado
      };
    }

    return data;
  }

  /**
   * Salva configuração de email
   */
  async salvarConfiguracao(config: Omit<ConfiguracaoEmail, 'created_at' | 'updated_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('configuracao_email')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Erro ao salvar configuração: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de email:', error);
      throw error;
    }
  }

  /**
   * Testa configuração de email
   */
  async testarConfiguracao(emailTeste: string): Promise<ResultadoEnvio> {
    try {
      const dados: DadosEmail = {
        destinatario: emailTeste,
        nome_destinatario: 'Teste',
        assunto: 'Teste de Configuração - Sistema Cresci e Perdi',
        corpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3B82F6;">Teste de Configuração de Email</h2>
            <p>Este é um email de teste para verificar se a configuração está funcionando corretamente.</p>
            <p>Se você recebeu este email, a configuração está funcionando! ✅</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #666;">
              Sistema de Cobrança - Cresci e Perdi<br>
              Enviado em: ${new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        `,
        corpo_texto: `
Teste de Configuração - Sistema Cresci e Perdi

Este é um email de teste para verificar se a configuração está funcionando corretamente.

Se você recebeu este email, a configuração está funcionando! ✅

Sistema de Cobrança - Cresci e Perdi
Enviado em: ${new Date().toLocaleString('pt-BR')}
        `
      };

      return await this.enviarEmail(dados);
    } catch (error) {
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Envia via SendGrid (exemplo de integração)
   */
  private async enviarViaSendGrid(emailData: any, config: ConfiguracaoEmail): Promise<ResultadoEnvio> {
    try {
      // Simula envio de email para teste
      console.log('📧 SIMULANDO ENVIO DE EMAIL:', {
        de: emailData.from,
        para: emailData.to,
        assunto: emailData.subject,
        configuracao: {
          servidor: config.servidor_smtp,
          porta: config.porta,
          usuario: config.usuario,
          ssl: config.ssl_ativo
        }
      });

      // Simula sucesso no envio
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        sucesso: true,
        message_id: messageId,
        detalhes: {
          provider: 'Simulado',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Erro real no envio de email:', error);
      return {
        sucesso: false,
        erro: String(error)
      };
    }
  }

  /**
   * Gera template para proposta de parcelamento
   */
  private gerarTemplatePropostaParcelamento(
    simulacao: any,
    dadosUnidade: any,
    dadosCobranca: any
  ): EmailTemplate {
    const nomeCliente = dadosUnidade.nome_franqueado || dadosCobranca.cliente;
    const codigoUnidade = dadosUnidade.codigo_unidade || dadosCobranca.cnpj;
    
    const assunto = `Proposta de Parcelamento - ${codigoUnidade}`;
    
    const corpo_html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">💰 Proposta de Parcelamento</h1>
            <p style="color: #666; margin: 10px 0 0 0;">Cresci e Perdi - Departamento Financeiro</p>
          </div>
          
          <p>Prezado(a) <strong>${nomeCliente}</strong>,</p>
          
          <p>Temos uma proposta especial para regularizar o débito da unidade <strong>${codigoUnidade}</strong>.</p>
          
          <div style="background-color: #EBF8FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #2563EB; margin-top: 0;">📋 Detalhes da Proposta:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Valor Original:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${this.formatarMoeda(simulacao.valor_original)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Valor Atualizado:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; color: #DC2626;">${this.formatarMoeda(simulacao.valor_atualizado)}</td>
              </tr>
              ${simulacao.valor_entrada ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Entrada:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; color: #059669;">${this.formatarMoeda(simulacao.valor_entrada)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Parcelamento:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${simulacao.quantidade_parcelas}x de ${this.formatarMoeda(simulacao.parcelas[0].valor)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Multa:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">10% (${this.formatarMoeda(simulacao.parcelas[0].multa)})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Juros Mora:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">1.5% (${this.formatarMoeda(simulacao.parcelas[0].juros_mora)})</td>
              </tr>
              <tr style="background-color: #F3F4F6;">
                <td style="padding: 12px 8px; font-weight: bold; font-size: 16px;"><strong>Valor Total:</strong></td>
                <td style="padding: 12px 8px; text-align: right; font-weight: bold; font-size: 16px; color: #2563EB;">${this.formatarMoeda(simulacao.valor_total_parcelamento)}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #F0FDF4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">📅 Cronograma de Pagamentos:</h3>
            ${simulacao.valor_entrada ? `
            <p><strong>Entrada:</strong> ${this.formatarMoeda(simulacao.valor_entrada)} - Vencimento: ${this.formatarData(simulacao.data_primeira_parcela)}</p>
            ` : ''}
            ${simulacao.parcelas.map((parcela: any, index: number) => `
              <p><strong>Parcela ${parcela.numero}:</strong> ${this.formatarMoeda(parcela.valor)} - Vencimento: ${this.formatarData(parcela.data_vencimento)}</p>
            `).join('')}
          </div>
          
          <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400E;"><strong>⏰ Importante:</strong> Esta proposta é válida por 7 dias corridos.</p>
          </div>
          
          <p>Para aceitar esta proposta, responda este email confirmando ou entre em contato conosco através dos canais oficiais.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #3B82F6; color: white; padding: 15px; border-radius: 8px; display: inline-block;">
              <p style="margin: 0; font-weight: bold;">📞 Contato para Dúvidas:</p>
              <p style="margin: 5px 0 0 0;">financeiro@crescieperdi.com | (11) 99999-9999</p>
            </div>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            Atenciosamente,<br>
            <strong>Equipe Financeira - Cresci e Perdi</strong><br>
            Este email foi gerado automaticamente pelo sistema de cobrança.
          </p>
        </div>
      </div>
    `;

    const corpo_texto = `
PROPOSTA DE PARCELAMENTO - ${codigoUnidade}

Prezado(a) ${nomeCliente},

Temos uma proposta especial para regularizar o débito da unidade ${codigoUnidade}.

DETALHES DA PROPOSTA:
- Valor Original: ${this.formatarMoeda(simulacao.valor_original)}
- Valor Atualizado: ${this.formatarMoeda(simulacao.valor_atualizado)}
${simulacao.valor_entrada ? `- Entrada: ${this.formatarMoeda(simulacao.valor_entrada)}` : ''}
- Parcelamento: ${simulacao.quantidade_parcelas}x de ${this.formatarMoeda(simulacao.parcelas[0].valor)}
- Multa: 10% (${this.formatarMoeda(simulacao.parcelas[0].multa)})
- Juros Mora: 1.5% (${this.formatarMoeda(simulacao.parcelas[0].juros_mora)})
- Valor Total: ${this.formatarMoeda(simulacao.valor_total_parcelamento)}

CRONOGRAMA:
${simulacao.valor_entrada ? `Entrada: ${this.formatarMoeda(simulacao.valor_entrada)} - ${this.formatarData(simulacao.data_primeira_parcela)}` : ''}
${simulacao.parcelas.map((parcela: any) => `Parcela ${parcela.numero}: ${this.formatarMoeda(parcela.valor)} - ${this.formatarData(parcela.data_vencimento)}`).join('\n')}

IMPORTANTE: Esta proposta é válida por 7 dias corridos.

Para aceitar, responda este email confirmando ou entre em contato:
📧 financeiro@crescieperdi.com
📞 (11) 99999-9999

Atenciosamente,
Equipe Financeira - Cresci e Perdi
    `;

    return {
      tipo: 'proposta_parcelamento',
      assunto,
      corpo_html,
      corpo_texto
    };
  }

  /**
   * Gera template para mensagem de cobrança
   */
  private gerarTemplateCobranca(
    tipo: 'padrao' | 'formal' | 'urgente',
    dadosUnidade: any,
    dadosCobranca: any
  ): EmailTemplate {
    const nomeCliente = dadosUnidade.nome_franqueado || dadosCobranca.cliente;
    const codigoUnidade = dadosUnidade.codigo_unidade || dadosCobranca.cnpj;
    const valorAtualizado = dadosCobranca.valor_atualizado || dadosCobranca.valor_original;
    const diasAtraso = dadosCobranca.dias_em_atraso || 0;

    const templates = {
      padrao: {
        assunto: `Cobrança Pendente - ${codigoUnidade}`,
        corpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3B82F6;">Cobrança Pendente</h2>
            <p>Olá, <strong>${nomeCliente}</strong>!</p>
            <p>Consta um débito da sua unidade <strong>${codigoUnidade}</strong>, vencido em <strong>${this.formatarData(dadosCobranca.data_vencimento)}</strong>.</p>
            <p>Valor atualizado até hoje: <strong style="color: #DC2626;">${this.formatarMoeda(valorAtualizado)}</strong></p>
            ${diasAtraso > 0 ? `<p>Dias em atraso: <strong>${diasAtraso} dias</strong></p>` : ''}
            <p>Para regularizar ou esclarecer dúvidas, entre em contato conosco.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Esta é uma mensagem automática do sistema de cobrança.</p>
          </div>
        `,
        corpo_texto: `Olá, ${nomeCliente}!\n\nConsta um débito da sua unidade ${codigoUnidade}, vencido em ${this.formatarData(dadosCobranca.data_vencimento)}.\nValor atualizado: ${this.formatarMoeda(valorAtualizado)}\n${diasAtraso > 0 ? `Dias em atraso: ${diasAtraso} dias\n` : ''}Para regularizar, entre em contato conosco.\n\nEquipe Financeira`
      },
      formal: {
        assunto: `Notificação de Pendência Financeira - ${codigoUnidade}`,
        corpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #DC2626;">Notificação de Pendência Financeira</h2>
            <p>Prezado(a) <strong>${nomeCliente}</strong>,</p>
            <p>Identificamos pendência financeira em aberto referente à sua unidade <strong>${codigoUnidade}</strong>.</p>
            <div style="background-color: #FEF2F2; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #DC2626; margin-top: 0;">Dados da Pendência:</h3>
              <ul>
                <li>Valor original: ${this.formatarMoeda(dadosCobranca.valor_original)}</li>
                <li>Valor atualizado: <strong>${this.formatarMoeda(valorAtualizado)}</strong></li>
                <li>Data de vencimento: ${this.formatarData(dadosCobranca.data_vencimento)}</li>
                <li>Dias em atraso: <strong>${diasAtraso} dias</strong></li>
              </ul>
            </div>
            <p><strong>Solicitamos regularização no prazo de 5 dias úteis.</strong></p>
            <hr>
            <p>Atenciosamente,<br><strong>Equipe Financeira - Cresci e Perdi</strong></p>
          </div>
        `,
        corpo_texto: `Prezado(a) ${nomeCliente},\n\nIdentificamos pendência financeira da unidade ${codigoUnidade}.\n\nDados:\n- Valor: ${this.formatarMoeda(valorAtualizado)}\n- Vencimento: ${this.formatarData(dadosCobranca.data_vencimento)}\n- Atraso: ${diasAtraso} dias\n\nSolicitamos regularização em 5 dias úteis.\n\nEquipe Financeira`
      },
      urgente: {
        assunto: `🚨 URGENTE - Débito Vencido ${codigoUnidade}`,
        corpo_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #FEE2E2; border: 2px solid #DC2626; padding: 20px; border-radius: 10px;">
              <h2 style="color: #DC2626; margin-top: 0;">🚨 ATENÇÃO ${nomeCliente}</h2>
              <p>Sua unidade <strong>${codigoUnidade}</strong> possui débito VENCIDO há <strong>${diasAtraso} dias</strong>.</p>
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0;"><strong>💰 Valor:</strong> ${this.formatarMoeda(valorAtualizado)}</p>
                <p style="margin: 5px 0 0 0;"><strong>📅 Vencimento:</strong> ${this.formatarData(dadosCobranca.data_vencimento)}</p>
              </div>
              <p style="font-size: 18px; color: #DC2626;"><strong>⚠️ Regularize HOJE para evitar bloqueios!</strong></p>
              <p>Entre em contato: <strong>(11) 99999-9999</strong></p>
            </div>
          </div>
        `,
        corpo_texto: `🚨 ATENÇÃO ${nomeCliente}\n\nSua unidade ${codigoUnidade} possui débito VENCIDO há ${diasAtraso} dias.\n\n💰 Valor: ${this.formatarMoeda(valorAtualizado)}\n📅 Vencimento: ${this.formatarData(dadosCobranca.data_vencimento)}\n\n⚠️ Regularize HOJE para evitar bloqueios!\n\nContato: (11) 99999-9999`
      }
    };

    return {
      tipo: `cobranca_${tipo}` as any,
      ...templates[tipo]
    };
  }

  /**
   * Converte texto simples para HTML
   */
  private converterTextoParaHTML(texto: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-line; line-height: 1.6;">
          ${texto.replace(/\n/g, '<br>')}
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          Equipe Financeira - Cresci e Perdi<br>
          Enviado em: ${new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    `;
  }

  /**
   * Registra log do envio
   */
  private async registrarLogEnvio(dados: DadosEmail, resultado: ResultadoEnvio): Promise<void> {
    try {
      await supabase
        .from('logs_envio_email')
        .insert({
          destinatario: dados.destinatario,
          assunto: dados.assunto,
          sucesso: resultado.sucesso,
          message_id: resultado.message_id,
          erro_detalhes: resultado.erro,
          data_envio: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao registrar log de envio:', error);
    }
  }

  /**
   * Métodos auxiliares de formatação
   */
  private formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  private formatarData(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }
}