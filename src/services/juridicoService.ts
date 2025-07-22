import { createClient } from '@supabase/supabase-js';
import { JuridicoLog, NotificacaoExtrajudicial, CriteriosJuridico, CriteriosVerificacao, FiltrosJuridico, EstatisticasJuridico, AcionamentoJuridico, JuridicoStatus, DocumentoJuridico, TermoAcordo } from '../types/juridico';
import { TrativativasService } from './tratativasService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class JuridicoService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Verifica critérios de acionamento jurídico para uma unidade
   */
  async verificarCriterios(cnpjUnidade: string): Promise<CriteriosVerificacao> {
    try {
      const { data, error } = await supabase
        .rpc('verificar_criterios_juridico', { p_cnpj_unidade: cnpjUnidade })
        .single();

      if (error) {
        throw new Error(`Erro ao verificar critérios: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao verificar critérios jurídicos:', error);
      throw error;
    }
  }

  /**
   * Gera notificação extrajudicial
   */
  async gerarNotificacaoExtrajudicial(
    cnpjUnidade: string,
    tipoNotificacao: NotificacaoExtrajudicial['tipo_notificacao'],
    observacoes?: string,
    responsavel: string = 'sistema_automatico'
  ): Promise<string> {
    try {
      // Busca dados da unidade
      const { data: unidade, error: errorUnidade } = await supabase
        .from('unidades_franqueadas')
        .select('*')
        .eq('codigo_unidade', cnpjUnidade)
        .single();

      if (errorUnidade || !unidade) {
        throw new Error('Unidade não encontrada');
      }

      // Busca cobranças em aberto
      const { data: cobrancas } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('cnpj', cnpjUnidade)
        .eq('status', 'em_aberto');

      const valorTotal = cobrancas?.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0) || 0;
      const diasAtrasoMax = Math.max(...(cobrancas?.map(c => c.dias_em_atraso || 0) || [0]));

      // Gera conteúdo da notificação
      const conteudo = this.gerarConteudoNotificacao(tipoNotificacao, unidade, valorTotal, diasAtrasoMax, observacoes);

      // Cria notificação
      const { data: notificacao, error } = await supabase
        .from('notificacoes_extrajudiciais')
        .insert({
          cnpj_unidade: cnpjUnidade,
          tipo_notificacao: tipoNotificacao,
          destinatario_email: unidade.email_franqueado,
          destinatario_whatsapp: unidade.telefone_franqueado,
          conteudo_notificacao: conteudo,
          status_envio: 'pendente',
          data_prazo_resposta: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 dias
          respondido: false
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar notificação: ${error.message}`);
      }

      // Atualiza status da unidade
      await supabase
        .from('unidades_franqueadas')
        .update({ juridico_status: 'notificado' })
        .eq('codigo_unidade', cnpjUnidade);

      // Registra no log
      await this.registrarLogJuridico({
        cnpj_unidade: cnpjUnidade,
        tipo_acao: 'notificacao_gerada',
        motivo_acionamento: 'valor_alto',
        valor_em_aberto: valorTotal,
        responsavel,
        observacoes: `Notificação ${tipoNotificacao} gerada. ${observacoes || ''}`
      });

      return notificacao.id;
    } catch (error) {
      console.error('Erro ao gerar notificação extrajudicial:', error);
      throw error;
    }
  }

  /**
   * Gera termo de acordo
   */
  async gerarTermoAcordo(
    cnpjUnidade: string,
    dadosAcordo: Omit<TermoAcordo, 'id' | 'cnpj_unidade' | 'created_at' | 'updated_at'>,
    responsavel: string
  ): Promise<string> {
    try {
      const { data: acordo, error } = await supabase
        .from('termos_acordo_juridico')
        .insert({
          cnpj_unidade: cnpjUnidade,
          ...dadosAcordo,
          status_acordo: 'proposto'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar termo de acordo: ${error.message}`);
      }

      // Gera documento
      await this.gerarDocumentoJuridico({
        tipo_documento: 'termo_acordo',
        cnpj_unidade: cnpjUnidade,
        titulo: `Termo de Acordo - ${cnpjUnidade}`,
        conteudo_html: this.gerarHTMLTermoAcordo(acordo),
        gerado_por: responsavel,
        status_documento: 'finalizado'
      });

      // Registra log
      await this.registrarLogJuridico({
        cnpj_unidade: cnpjUnidade,
        tipo_acao: 'termo_acordo_gerado',
        motivo_acionamento: 'acordo_descumprido',
        valor_em_aberto: dadosAcordo.valor_acordado,
        responsavel,
        observacoes: `Termo de acordo gerado. Valor: R$ ${dadosAcordo.valor_acordado.toFixed(2)}`
      });

      return acordo.id;
    } catch (error) {
      console.error('Erro ao gerar termo de acordo:', error);
      throw error;
    }
  }

  /**
   * Busca escalonamentos ativos
   */
  async buscarEscalonamentosAtivos(filtros: FiltrosJuridico = {}) {
    try {
      let query = supabase
        .from('unidades_franqueadas')
        .select(`
          codigo_unidade,
          nome_franqueado,
          cidade,
          estado,
          email_franqueado,
          telefone_franqueado,
          juridico_status,
          data_ultimo_acionamento,
          observacoes_juridicas,
          cobrancas_franqueados (
            valor_original,
            valor_atualizado,
            status,
            dias_em_atraso,
            tipo_cobranca
          )
        `)
        .neq('juridico_status', 'regular')
        .order('data_ultimo_acionamento', { ascending: false });

      if (filtros.juridico_status) {
        query = query.eq('juridico_status', filtros.juridico_status);
      }

      if (filtros.cnpj) {
        query = query.ilike('codigo_unidade', `%${filtros.cnpj}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar escalonamentos: ${error.message}`);
      }

      return data?.map(unidade => ({
        ...unidade,
        valor_total_envolvido: (unidade as any).cobrancas_franqueados
          ?.filter((c: any) => c.status === 'em_aberto')
          .reduce((sum: number, c: any) => sum + (c.valor_atualizado || c.valor_original), 0) || 0,
        tentativas_negociacao: (unidade as any).cobrancas_franqueados?.length || 0,
        tipos_cobranca: [...new Set((unidade as any).cobrancas_franqueados?.map((c: any) => c.tipo_cobranca) || [])]
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar escalonamentos ativos:', error);
      throw error;
    }
  }

  /**
   * Busca notificações extrajudiciais
   */
  async buscarNotificacoes(filtros: FiltrosJuridico = {}) {
    try {
      let query = supabase
        .from('notificacoes_extrajudiciais')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado
          )
        `)
        .order('data_envio', { ascending: false });

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      if (filtros.tipo_notificacao) {
        query = query.eq('tipo_notificacao', filtros.tipo_notificacao);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_envio', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_envio', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar notificações: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      throw error;
    }
  }

  /**
   * Busca log jurídico
   */
  async buscarLogJuridico(filtros: FiltrosJuridico = {}) {
    try {
      let query = supabase
        .from('juridico_log')
        .select(`
          *,
          unidades_franqueadas (
            nome_franqueado,
            cidade,
            estado
          )
        `)
        .order('data_acao', { ascending: false });

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      if (filtros.motivo_acionamento) {
        query = query.eq('motivo_acionamento', filtros.motivo_acionamento);
      }

      if (filtros.responsavel) {
        query = query.ilike('responsavel', `%${filtros.responsavel}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_acao', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_acao', filtros.dataFim);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar log jurídico: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar log jurídico:', error);
      throw error;
    }
  }

  /**
   * Atualiza status jurídico
   */
  async atualizarStatusJuridico(
    cnpjUnidade: string,
    novoStatus: JuridicoStatus,
    observacoes?: string,
    responsavel: string = 'usuario_atual'
  ): Promise<void> {
    try {
      // Busca status anterior
      const { data: unidadeAtual } = await supabase
        .from('unidades_franqueadas')
        .select('juridico_status')
        .eq('codigo_unidade', cnpjUnidade)
        .single();

      // Atualiza status
      const { error } = await supabase
        .from('unidades_franqueadas')
        .update({
          juridico_status: novoStatus,
          observacoes_juridicas: observacoes,
          data_ultimo_acionamento: new Date().toISOString()
        })
        .eq('codigo_unidade', cnpjUnidade);

      if (error) {
        throw new Error(`Erro ao atualizar status: ${error.message}`);
      }

      // Registra log
      await this.registrarLogJuridico({
        cnpj_unidade: cnpjUnidade,
        tipo_acao: 'atualizacao_status',
        motivo_acionamento: 'valor_alto',
        valor_em_aberto: 0,
        responsavel,
        status_anterior: unidadeAtual?.juridico_status,
        status_novo: novoStatus,
        observacoes
      });
    } catch (error) {
      console.error('Erro ao atualizar status jurídico:', error);
      throw error;
    }
  }

  /**
   * Encaminha para ação judicial
   */
  async encaminharParaAcaoJudicial(
    cnpjUnidade: string,
    observacoes: string,
    responsavel: string
  ): Promise<void> {
    try {
      await this.atualizarStatusJuridico(cnpjUnidade, 'acionado', `Encaminhado para ação judicial: ${observacoes}`, responsavel);

      // Registra ação específica
      await this.registrarLogJuridico({
        cnpj_unidade: cnpjUnidade,
        tipo_acao: 'acao_judicial',
        motivo_acionamento: 'valor_alto',
        valor_em_aberto: 0,
        responsavel,
        observacoes: `Ação judicial iniciada: ${observacoes}`
      });
    } catch (error) {
      console.error('Erro ao encaminhar para ação judicial:', error);
      throw error;
    }
  }

  /**
   * Marca notificação como respondida
   */
  async marcarNotificacaoRespondida(
    notificacaoId: string,
    observacoesResposta: string,
    responsavel: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('notificacoes_extrajudiciais')
        .update({
          respondido: true,
          data_resposta: new Date().toISOString(),
          observacoes_resposta: observacoesResposta
        })
        .eq('id', notificacaoId);

      if (error) {
        throw new Error(`Erro ao marcar resposta: ${error.message}`);
      }

      // Busca dados da notificação
      const { data: notificacao } = await supabase
        .from('notificacoes_extrajudiciais')
        .select('cnpj_unidade')
        .eq('id', notificacaoId)
        .single();

      if (notificacao) {
        await this.atualizarStatusJuridico(
          notificacao.cnpj_unidade,
          'em_analise',
          `Resposta recebida: ${observacoesResposta}`,
          responsavel
        );
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como respondida:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas jurídicas
   */
  async buscarEstatisticas(): Promise<EstatisticasJuridico> {
    try {
      const { data: unidades } = await supabase
        .from('unidades_franqueadas')
        .select('juridico_status, data_ultimo_acionamento');

      const { data: logs } = await supabase
        .from('juridico_log')
        .select('motivo_acionamento, valor_em_aberto, data_acao');

      const { data: notificacoes } = await supabase
        .from('notificacoes_extrajudiciais')
        .select('respondido, data_envio');

      const stats: EstatisticasJuridico = {
        total_notificados: unidades?.filter(u => u.juridico_status === 'notificado').length || 0,
        total_em_analise: unidades?.filter(u => u.juridico_status === 'em_analise').length || 0,
        total_resolvidos: unidades?.filter(u => u.juridico_status === 'resolvido').length || 0,
        valor_total_acionado: logs?.reduce((sum, l) => sum + l.valor_em_aberto, 0) || 0,
        tempo_medio_resolucao: 0,
        taxa_resposta_notificacoes: 0,
        por_motivo: {},
        evolucao_mensal: []
      };

      // Calcula estatísticas por motivo
      logs?.forEach(log => {
        stats.por_motivo[log.motivo_acionamento] = (stats.por_motivo[log.motivo_acionamento] || 0) + 1;
      });

      // Calcula taxa de resposta
      if (notificacoes && notificacoes.length > 0) {
        const respondidas = notificacoes.filter(n => n.respondido).length;
        stats.taxa_resposta_notificacoes = (respondidas / notificacoes.length) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas jurídicas:', error);
      throw error;
    }
  }

  /**
   * Gera documento jurídico
   */
  async gerarDocumentoJuridico(documento: Omit<DocumentoJuridico, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('documentos_juridicos')
        .insert({
          ...documento,
          data_geracao: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao gerar documento: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Erro ao gerar documento jurídico:', error);
      throw error;
    }
  }

  /**
   * Envia notificação por email
   */
  async enviarNotificacaoEmail(notificacaoId: string): Promise<boolean> {
    try {
      const { data: notificacao } = await supabase
        .from('notificacoes_extrajudiciais')
        .select('*')
        .eq('id', notificacaoId)
        .single();

      if (!notificacao || !notificacao.destinatario_email) {
        return false;
      }

      // Em produção, integrar com serviço de email real
      console.log('Enviando notificação extrajudicial:', {
        para: notificacao.destinatario_email,
        assunto: 'Notificação Extrajudicial – Pendência Grave',
        conteudo: notificacao.conteudo_notificacao
      });

      // Atualiza status
      await supabase
        .from('notificacoes_extrajudiciais')
        .update({ status_envio: 'enviado' })
        .eq('id', notificacaoId);

      return true;
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      return false;
    }
  }

  /**
   * Gera PDF da notificação
   */
  async gerarDocumentoPDF(notificacaoId: string): Promise<Blob> {
    try {
      const { data: notificacao, error } = await supabase
        .from('notificacoes_extrajudiciais')
        .select('*')
        .eq('id', notificacaoId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar notificação: ${error.message}`);
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Notificação Extrajudicial</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .content { white-space: pre-line; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>NOTIFICAÇÃO EXTRAJUDICIAL</h1>
    <p>Data: ${new Date(notificacao.data_envio).toLocaleDateString('pt-BR')}</p>
  </div>
  
  <div class="content">
    ${notificacao.conteudo_notificacao}
  </div>
  
  <div class="footer">
    <p>Documento gerado automaticamente pelo Sistema de Cobrança</p>
    <p>Cresci e Perdi - Setor Jurídico</p>
  </div>
</body>
</html>
      `;

      return new Blob([html], { type: 'text/html' });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      throw error;
    }
  }

  /**
   * Exporta dados jurídicos
   */
  async exportarDadosJuridicos(filtros: FiltrosJuridico = {}): Promise<string> {
    try {
      const logs = await this.buscarLogJuridico(filtros);
      
      const cabecalho = [
        'Data Ação',
        'CNPJ',
        'Nome Franqueado',
        'Tipo Ação',
        'Motivo',
        'Valor em Aberto',
        'Status Anterior',
        'Status Novo',
        'Responsável',
        'Observações'
      ].join(',');

      const linhas = logs.map(log => [
        new Date(log.data_acao).toLocaleString('pt-BR'),
        log.cnpj_unidade,
        (log as any).unidades_franqueadas?.nome_franqueado || '',
        log.tipo_acao,
        log.motivo_acionamento,
        log.valor_em_aberto.toFixed(2),
        log.status_anterior || '',
        log.status_novo || '',
        log.responsavel,
        (log.observacoes || '').replace(/,/g, ';')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar dados jurídicos:', error);
      throw error;
    }
  }

  /**
   * Métodos auxiliares privados
   */
  private async registrarLogJuridico(log: Omit<JuridicoLog, 'id' | 'created_at'>): Promise<void> {
    try {
      await supabase
        .from('juridico_log')
        .insert({
          ...log,
          data_acao: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao registrar log jurídico:', error);
    }
  }

  private gerarConteudoNotificacao(
    tipo: NotificacaoExtrajudicial['tipo_notificacao'],
    unidade: any,
    valorTotal: number,
    diasAtraso: number,
    observacoes?: string
  ): string {
    const templates = {
      extrajudicial: `NOTIFICAÇÃO EXTRAJUDICIAL

Ao(À): ${unidade.nome_franqueado}
CNPJ: ${unidade.codigo_unidade}
Endereço: ${unidade.endereco_completo || `${unidade.cidade}, ${unidade.estado}`}

Vimos por meio desta, NOTIFICÁ-LO(A) sobre a existência de débito(s) em aberto referente ao contrato de franquia, conforme detalhado abaixo:

DADOS DO DÉBITO:
- Valor Total em Aberto: R$ ${valorTotal.toFixed(2)}
- Dias em Atraso: ${diasAtraso} dias
- Status: Inadimplente

Conforme previsto no contrato de franquia firmado entre as partes, o franqueado obriga-se ao pagamento pontual das taxas e royalties estabelecidos.

EXIGIMOS a regularização do débito no prazo de 5 (cinco) dias úteis, contados do recebimento desta notificação.

O não atendimento desta notificação implicará na adoção das medidas cabíveis para cobrança, incluindo a execução das garantias contratuais e medidas judiciais cabíveis.

${observacoes ? `\nObservações: ${observacoes}` : ''}

${new Date().toLocaleDateString('pt-BR')}

Departamento Jurídico
Rede Cresci e Perdi`,

      formal: `NOTIFICAÇÃO FORMAL

Prezado(a) ${unidade.nome_franqueado},

Comunicamos que constam em nossos registros débitos vencidos e não quitados, no valor total de R$ ${valorTotal.toFixed(2)}, há ${diasAtraso} dias em atraso.

Solicitamos a quitação imediata no prazo de 5 dias úteis.

O descumprimento acarretará medidas judiciais cabíveis.

${new Date().toLocaleDateString('pt-BR')}

Departamento Jurídico`,

      ultima_chance: `ÚLTIMA OPORTUNIDADE

${unidade.nome_franqueado},

Esta é nossa ÚLTIMA TENTATIVA de resolução amigável.

Débito: R$ ${valorTotal.toFixed(2)}
Atraso: ${diasAtraso} dias

Prazo final: 3 dias úteis para regularização.

Caso contrário, o caso será encaminhado para ação judicial imediata.

${new Date().toLocaleDateString('pt-BR')}

Setor Jurídico - Cresci e Perdi`
    };

    return templates[tipo] || templates.extrajudicial;
  }

  private gerarHTMLTermoAcordo(acordo: any): string {
    return `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
  <h1 style="text-align: center; color: #333;">TERMO DE ACORDO</h1>
  
  <p><strong>Valor Original:</strong> R$ ${acordo.valor_original.toFixed(2)}</p>
  <p><strong>Valor Acordado:</strong> R$ ${acordo.valor_acordado.toFixed(2)}</p>
  <p><strong>Forma de Pagamento:</strong> ${acordo.forma_pagamento}</p>
  
  ${acordo.quantidade_parcelas ? `
  <p><strong>Parcelas:</strong> ${acordo.quantidade_parcelas}x de R$ ${acordo.valor_parcela.toFixed(2)}</p>
  <p><strong>Primeiro Vencimento:</strong> ${new Date(acordo.data_primeiro_vencimento).toLocaleDateString('pt-BR')}</p>
  ` : ''}
  
  <p><strong>Multa por Descumprimento:</strong> ${acordo.multa_descumprimento}%</p>
  
  ${acordo.condicoes_especiais ? `<p><strong>Condições Especiais:</strong> ${acordo.condicoes_especiais}</p>` : ''}
  
  <div style="margin-top: 50px; text-align: center;">
    <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
    <br><br>
    <p>_________________________________</p>
    <p>Franqueado</p>
    <br><br>
    <p>_________________________________</p>
    <p>Cresci e Perdi</p>
  </div>
</div>
    `;
  }
}