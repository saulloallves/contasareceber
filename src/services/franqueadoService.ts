import { supabase } from './databaseService';
import { AuthFranqueado, LogAcessoFranqueado, DadosFranqueado, SolicitacaoAuth, RespostaAuth } from '../types/franqueado';

export class FranqueadoService {
  /**
   * Solicita token de acesso para o franqueado
   */
  async solicitarAcesso(dados: SolicitacaoAuth): Promise<RespostaAuth> {
    try {
      // Valida CNPJ
      const cnpjLimpo = dados.cnpj.replace(/[^\d]/g, '');
      if (cnpjLimpo.length !== 14) {
        return {
          sucesso: false,
          mensagem: 'CNPJ deve ter 14 dígitos'
        };
      }

      // Verifica se a unidade existe
      const { data: unidade, error: errorUnidade } = await supabase
        .from('unidades_franqueadas')
        .select('codigo_unidade, nome_franqueado, email_franqueado, telefone_franqueado')
        .eq('codigo_unidade', cnpjLimpo)
        .single();

      if (errorUnidade || !unidade) {
        return {
          sucesso: false,
          mensagem: 'CNPJ não encontrado no sistema'
        };
      }

      // Gera token de acesso
      const { data: token, error: errorToken } = await supabase
        .rpc('gerar_token_acesso_franqueado', { p_cnpj: cnpjLimpo });

      if (errorToken) {
        throw new Error(`Erro ao gerar token: ${errorToken.message}`);
      }

      // Registra log de solicitação
      await this.registrarLog(cnpjLimpo, 'solicitacao_acesso', true);

      // Em produção, enviar token por email/WhatsApp
      console.log(`Token gerado para ${unidade.nome_franqueado}: ${token}`);

      return {
        sucesso: true,
        mensagem: 'Token de acesso enviado com sucesso',
        token: token,
        expira_em: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error('Erro ao solicitar acesso:', error);
      return {
        sucesso: false,
        mensagem: 'Erro interno do sistema'
      };
    }
  }

  /**
   * Valida token e retorna dados do franqueado
   */
  async validarAcesso(cnpj: string, token: string): Promise<DadosFranqueado | null> {
    try {
      const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

      // Valida token
      const { data: tokenValido, error: errorValidacao } = await supabase
        .rpc('validar_token_franqueado', { 
          p_cnpj: cnpjLimpo, 
          p_token: token 
        });

      if (errorValidacao || !tokenValido) {
        await this.registrarLog(cnpjLimpo, 'acesso_negado', false);
        return null;
      }

      // Busca dados completos
      const dados = await this.buscarDadosCompletos(cnpjLimpo);
      
      // Registra acesso bem-sucedido
      await this.registrarLog(cnpjLimpo, 'acesso_autorizado', true);

      return dados;
    } catch (error) {
      console.error('Erro ao validar acesso:', error);
      return null;
    }
  }

  /**
   * Busca dados completos do franqueado
   */
  private async buscarDadosCompletos(cnpj: string): Promise<DadosFranqueado> {
    // 1. Dados da unidade
    const { data: unidade } = await supabase
      .from('unidades_franqueadas')
      .select('*')
      .eq('codigo_unidade', cnpj)
      .single();

    // 2. Cobranças em aberto
    const { data: cobrancas } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('cnpj', cnpj)
      .order('data_vencimento', { ascending: true });

    // 3. Reuniões
    const { data: reunioes } = await supabase
      .from('reunioes_negociacao')
      .select('*')
      .eq('cnpj_unidade', cnpj)
      .order('data_agendada', { ascending: false });

    // 4. Documentos gerados
    const { data: documentos } = await supabase
      .from('documentos_gerados')
      .select('*')
      .in('titulo_id', cobrancas?.map(c => c.id) || [])
      .order('data_criacao', { ascending: false });

    // 5. Última tratativa
    const { data: ultimaTratativa } = await supabase
      .from('tratativas_cobranca')
      .select('descricao, data_interacao')
      .in('titulo_id', cobrancas?.map(c => c.id) || [])
      .order('data_interacao', { ascending: false })
      .limit(1)
      .single();

    // Calcula resumo financeiro
    const cobrancasEmAberto = cobrancas?.filter(c => c.status === 'em_aberto') || [];
    const valorTotalEmAberto = cobrancasEmAberto.reduce((sum, c) => 
      sum + (c.valor_atualizado || c.valor_original), 0);
    
    const dataVencimentoMaisAntiga = cobrancasEmAberto.length > 0 
      ? cobrancasEmAberto[0].data_vencimento 
      : '';

    // Determina status geral
    let statusGeral = 'regular';
    if (cobrancasEmAberto.length > 0) {
      const temEscalonamento = cobrancasEmAberto.some(c => 
        c.status === 'em_tratativa_juridica' || c.status === 'em_tratativa_critica');
      statusGeral = temEscalonamento ? 'crítico' : 'inadimplente';
    }

    return {
      unidade: {
        codigo_unidade: unidade?.codigo_unidade || cnpj,
        nome_franqueado: unidade?.nome_franqueado || 'Franqueado',
        email_franqueado: unidade?.email_franqueado,
        telefone_franqueado: unidade?.telefone_franqueado,
        cidade: unidade?.cidade,
        estado: unidade?.estado,
        status_unidade: unidade?.status_unidade || 'ativa'
      },
      resumo_financeiro: {
        valor_total_em_aberto: valorTotalEmAberto,
        quantidade_titulos_vencidos: cobrancasEmAberto.length,
        data_vencimento_mais_antiga: dataVencimentoMaisAntiga,
        status_geral: statusGeral,
        ultima_tratativa: ultimaTratativa?.descricao || 'Nenhuma tratativa registrada'
      },
      cobrancas: cobrancas?.map(c => ({
        id: c.id,
        valor_original: c.valor_original,
        valor_atualizado: c.valor_atualizado || c.valor_original,
        data_vencimento: c.data_vencimento,
        dias_em_atraso: c.dias_em_atraso || 0,
        status: c.status
      })) || [],
      reunioes: reunioes?.map(r => ({
        id: r.id,
        data_agendada: r.data_agendada,
        data_realizada: r.data_realizada,
        status_reuniao: r.status_reuniao,
        decisao_final: r.decisao_final,
        resumo_resultado: r.resumo_resultado
      })) || [],
      documentos: documentos?.map(d => ({
        id: d.id,
        tipo_documento: d.tipo_documento,
        data_criacao: d.data_criacao,
        arquivo_pdf_url: d.arquivo_pdf_url
      })) || []
    };
  }

  /**
   * Registra log de acesso
   */
  private async registrarLog(
    cnpj: string, 
    acao: string, 
    sucesso: boolean, 
    detalhes: any = {}
  ): Promise<void> {
    try {
      await supabase.rpc('registrar_log_acesso', {
        p_cnpj: cnpj,
        p_ip: 'unknown', // Em produção, capturar IP real
        p_user_agent: navigator.userAgent,
        p_acao: acao,
        p_sucesso: sucesso,
        p_detalhes: detalhes
      });
    } catch (error) {
      console.error('Erro ao registrar log:', error);
    }
  }

  /**
   * Agenda nova reunião (se permitido)
   */
  async agendarReuniao(cnpj: string, token: string, dataDesejada: string): Promise<boolean> {
    try {
      // Valida token primeiro
      const { data: tokenValido } = await supabase
        .rpc('validar_token_franqueado', { 
          p_cnpj: cnpj, 
          p_token: token 
        });

      if (!tokenValido) {
        return false;
      }

      // Busca cobrança em aberto para vincular
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('id')
        .eq('cnpj', cnpj)
        .eq('status', 'em_aberto')
        .limit(1)
        .single();

      if (!cobranca) {
        return false;
      }

      // Cria reunião
      const { error } = await supabase
        .from('reunioes_negociacao')
        .insert({
          titulo_id: cobranca.id,
          cnpj_unidade: cnpj,
          data_agendada: dataDesejada,
          responsavel_reuniao: 'franqueado_autoagendamento',
          observacoes: 'Reunião agendada pelo franqueado via painel de autoatendimento'
        });

      if (error) {
        throw new Error(`Erro ao agendar reunião: ${error.message}`);
      }

      // Registra log
      await this.registrarLog(cnpj, 'agendamento_reuniao', true, { data_agendada: dataDesejada });

      return true;
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      await this.registrarLog(cnpj, 'agendamento_reuniao', false, { erro: String(error) });
      return false;
    }
  }

  /**
   * Busca logs de acesso do franqueado
   */
  async buscarLogsAcesso(cnpj: string): Promise<LogAcessoFranqueado[]> {
    try {
      const { data, error } = await supabase
        .from('logs_acesso_franqueados')
        .select('*')
        .eq('cnpj', cnpj)
        .order('data_acesso', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`Erro ao buscar logs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      return [];
    }
  }

  /**
   * Envia token por WhatsApp (simulado)
   */
  async enviarTokenWhatsApp(telefone: string, token: string): Promise<boolean> {
    try {
      // Em produção, integrar com WhatsApp API
      const mensagem = `Seu código de acesso ao painel financeiro: ${token}\n\nVálido por 15 minutos.\n\n_Não compartilhe este código._`;
      
      console.log(`Enviando token via WhatsApp para ${telefone}: ${mensagem}`);
      
      // Simula envio bem-sucedido
      return true;
    } catch (error) {
      console.error('Erro ao enviar token via WhatsApp:', error);
      return false;
    }
  }

  /**
   * Envia token por email (simulado)
   */
  async enviarTokenEmail(email: string, token: string, nomeFranqueado: string): Promise<boolean> {
    try {
      // Em produção, integrar com serviço de email
      const assunto = 'Código de Acesso - Painel Financeiro';
      const corpo = `
        Olá, ${nomeFranqueado}!
        
        Seu código de acesso ao painel financeiro: ${token}
        
        Este código é válido por 15 minutos.
        
        Não compartilhe este código com terceiros.
        
        Atenciosamente,
        Equipe Financeira
      `;
      
      console.log(`Enviando token via email para ${email}:`, { assunto, corpo });
      
      // Simula envio bem-sucedido
      return true;
    } catch (error) {
      console.error('Erro ao enviar token via email:', error);
      return false;
    }
  }
}