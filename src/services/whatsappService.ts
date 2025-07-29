import { supabase } from './databaseService';
import { CobrancaFranqueado, EnvioMensagem, ConfiguracaoWhatsApp, ResultadoEnvioCobranca } from '../types/cobranca';
import { TrativativasService } from './tratativasService';

export class WhatsAppService {
  private config: ConfiguracaoWhatsApp;
  private tratativasService: TrativativasService;

  constructor(config: ConfiguracaoWhatsApp) {
    this.config = config;
    this.tratativasService = new TrativativasService();
  }

  /**
   * Processa envio de cobranças automáticas após importação de planilha
   */
  async processarEnvioCobrancas(referenciaImportacao: string): Promise<ResultadoEnvioCobranca> {
    try {
      // 1. Busca títulos elegíveis para cobrança
      const titulosParaCobranca = await this.buscarTitulosParaCobranca(referenciaImportacao);
      
      if (titulosParaCobranca.length === 0) {
        return {
          sucesso: true,
          total_envios: 0,
          envios_sucesso: 0,
          envios_falha: 0,
          detalhes: []
        };
      }

      // 2. Processa envio para cada título
      const resultados = [];
      let enviosSucesso = 0;
      let enviosFalha = 0;

      for (const titulo of titulosParaCobranca) {
        try {
          const mensagem = this.gerarMensagemCobranca(titulo);
          const resultadoEnvio = await this.enviarMensagemWhatsApp(titulo.telefone!, mensagem);
          
          if (resultadoEnvio.sucesso) {
            // Registra envio bem-sucedido
            await this.registrarEnvio(titulo, mensagem, 'sucesso', referenciaImportacao);
            
            // Registra tratativa automática
            await this.tratativasService.registrarEnvioMensagem(
              titulo.id!,
              mensagem,
              'sucesso'
            );
            
            // Atualiza status do título para 'cobrado'
            await this.atualizarStatusTitulo(titulo.id!, 'cobrado');
            
            enviosSucesso++;
            resultados.push({
              titulo_id: titulo.id!,
              cliente: titulo.cliente,
              status: 'sucesso' as const
            });
          } else {
            // Registra falha no envio
            await this.registrarEnvio(titulo, mensagem, 'falha', referenciaImportacao, resultadoEnvio.erro);
            
            // Registra tratativa de falha
            await this.tratativasService.registrarEnvioMensagem(
              titulo.id!,
              mensagem,
              'falha',
              resultadoEnvio.erro
            );
            
            enviosFalha++;
            resultados.push({
              titulo_id: titulo.id!,
              cliente: titulo.cliente,
              status: 'falha' as const,
              erro: resultadoEnvio.erro
            });
          }
        } catch (error) {
          enviosFalha++;
          resultados.push({
            titulo_id: titulo.id!,
            cliente: titulo.cliente,
            status: 'falha' as const,
            erro: String(error)
          });
        }
      }

      return {
        sucesso: true,
        total_envios: titulosParaCobranca.length,
        envios_sucesso: enviosSucesso,
        envios_falha: enviosFalha,
        detalhes: resultados
      };

    } catch (error) {
      return {
        sucesso: false,
        total_envios: 0,
        envios_sucesso: 0,
        envios_falha: 0,
        detalhes: [],
      };
    }
  }

  /**
   * Busca títulos elegíveis para cobrança
   */
  private async buscarTitulosParaCobranca(referenciaImportacao: string): Promise<CobrancaFranqueado[]> {
    // Busca títulos que:
    // - Status = em_aberto
    // - Valor recebido = 0
    // - Dias em atraso >= 1
    // - Possuem telefone
    // - Não foram cobrados nesta importação
    const { data: titulos, error } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('status', 'em_aberto')
      .eq('valor_recebido', 0)
      .gte('dias_em_atraso', 1)
      .not('telefone', 'is', null)
      .neq('telefone', '');

    if (error) {
      throw new Error(`Erro ao buscar títulos para cobrança: ${error.message}`);
    }

    if (!titulos) return [];

    // Filtra títulos que já foram cobrados nesta importação
    const titulosNaoCobrados = [];
    for (const titulo of titulos) {
      const { data: envioExistente } = await supabase
        .from('envios_mensagem')
        .select('id')
        .eq('titulo_id', titulo.id)
        .eq('referencia_importacao', referenciaImportacao)
        .single();

      if (!envioExistente) {
        titulosNaoCobrados.push(titulo);
      }
    }

    return titulosNaoCobrados;
  }

  /**
   * Gera mensagem de cobrança personalizada
   */
  private gerarMensagemCobranca(titulo: CobrancaFranqueado): string {
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(titulo.valor_atualizado || titulo.valor_original);

    const dataVencimento = new Date(titulo.data_vencimento).toLocaleDateString('pt-BR');
    const diasAtraso = titulo.dias_em_atraso || 0;
    
    // Link de negociação (pode ser configurado via variável de ambiente)
    const linkNegociacao = import.meta.env.VITE_LINK_NEGOCIACAO || 'https://calendly.com/sua-empresa/negociacao';

    // Seleciona template baseado no estágio da dívida
    if (diasAtraso <= 0) {
      // Pré-vencimento
      return `Olá, ${titulo.cliente}! 👋

Lembrando que vence hoje (${dataVencimento}) o valor referente a cobrança da unidade.
Valor: ${valorFormatado}

Evite encargos. Qualquer dúvida, estamos à disposição.

_Equipe de Cobrança_`;
    } else if (diasAtraso <= 15) {
      // Vencido até 15 dias
      return `Olá, ${titulo.cliente}!

O vencimento da cobrança ocorreu em ${dataVencimento}.
Valor atualizado com encargos: *${valorFormatado}*

Evite bloqueios ou restrições.
👉 Deseja regularizar? ${linkNegociacao}

_Caso precise de ajuda, estamos por aqui._`;
    } else {
      // Atraso grave (acima de 15 dias)
      return `🚨 Atenção, ${titulo.cliente}

A cobrança está em aberto há ${diasAtraso} dias.
Valor atualizado: ${valorFormatado}

Evite *escalonamento para jurídico*.
Entre em contato para regularizar: ${linkNegociacao}

_Equipe de Cobrança_`;
    }
  }

  /**
   * Envia mensagem individual via WhatsApp
   */
  async enviarMensagemWhatsApp(telefone: string, mensagem: string): Promise<{sucesso: boolean, erro?: string}> {
    try {
      // Remove caracteres especiais do telefone e adiciona código do país se necessário
      const telefoneFormatado = this.formatarTelefone(telefone);

      const response = await fetch(`https://graph.facebook.com/v18.0/${this.config.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefoneFormatado,
          type: 'text',
          text: {
            body: mensagem
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          sucesso: false,
          erro: `Erro da API WhatsApp: ${errorData.error?.message || response.statusText}`
        };
      }

      return { sucesso: true };
    } catch (error) {
      return {
        sucesso: false,
        erro: `Erro ao enviar mensagem: ${error}`
      };
    }
  }

  /**
   * Formata telefone para padrão internacional
   */
  private formatarTelefone(telefone: string): string {
    // Remove todos os caracteres não numéricos
    const apenasNumeros = telefone.replace(/\D/g, '');
    
    // Se não tem código do país, adiciona 55 (Brasil)
    if (apenasNumeros.length === 11) {
      return `55${apenasNumeros}`;
    }
    
    // Se já tem 13 dígitos (55 + 11), retorna como está
    if (apenasNumeros.length === 13) {
      return apenasNumeros;
    }
    
    // Para outros casos, assume que precisa do código do país
    return `55${apenasNumeros}`;
  }

  /**
   * Registra envio de mensagem no banco
   */
  private async registrarEnvio(
    titulo: CobrancaFranqueado,
    mensagem: string,
    status: 'sucesso' | 'falha' | 'reagendado',
    referenciaImportacao: string,
    erroDetalhes?: string
  ): Promise<void> {
    const envio: Partial<EnvioMensagem> = {
      titulo_id: titulo.id!,
      cliente: titulo.cliente,
      cnpj: titulo.cnpj,
      telefone: titulo.telefone!,
      mensagem_enviada: mensagem,
      status_envio: status,
      erro_detalhes: erroDetalhes,
      referencia_importacao: referenciaImportacao
    };

    const { error } = await supabase
      .from('envios_mensagem')
      .insert(envio);

    if (error) {
      console.error('Erro ao registrar envio:', error);
    }
  }

  /**
   * Atualiza status do título
   */
  private async atualizarStatusTitulo(tituloId: string, novoStatus: string): Promise<void> {
    const { error } = await supabase
      .from('cobrancas_franqueados')
      .update({ status: novoStatus })
      .eq('id', tituloId);

    if (error) {
      console.error('Erro ao atualizar status do título:', error);
    }
  }

  /**
   * Busca histórico de envios
   */
  async buscarHistoricoEnvios(filtros: {
    dataInicio?: string;
    dataFim?: string;
    status?: string;
    cliente?: string;
  } = {}) {
    let query = supabase
      .from('envios_mensagem')
      .select('*')
      .order('data_envio', { ascending: false });

    if (filtros.dataInicio) {
      query = query.gte('data_envio', filtros.dataInicio);
    }

    if (filtros.dataFim) {
      query = query.lte('data_envio', filtros.dataFim);
    }

    if (filtros.status) {
      query = query.eq('status_envio', filtros.status);
    }

    if (filtros.cliente) {
      query = query.ilike('cliente', `%${filtros.cliente}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar histórico de envios: ${error.message}`);
    }

    return data;
  }

  /**
   * Reagenda envio de mensagem
   */
  async reagendarEnvio(envioId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('envios_mensagem')
        .update({ status_envio: 'reagendado' })
        .eq('id', envioId);

      return !error;
    } catch (error) {
      console.error('Erro ao reagendar envio:', error);
      return false;
    }
  }
}