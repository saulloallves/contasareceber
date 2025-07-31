import { supabase } from './databaseService';
import { EmailService } from './emailService';
// Futuramente, importaremos os tipos de 'juridico.ts'

const CALENDLY_LINK = 'https://calendly.com/crescieperdi'; // Link principal do Calendly

export class JuridicoReuniaoService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Cria um convite para reunião jurídica e notifica o franqueado.
   * @param escalonamentoId O ID do escalonamento que originou a necessidade da reunião.
   */
  async convidarParaReuniao(escalonamentoId: string) {
    console.log(`Iniciando convite para reunião para o escalonamento: ${escalonamentoId}`);

    // 1. Buscar dados do escalonamento e da unidade
    const { data: escalonamento, error: escError } = await supabase
      .from('escalonamentos_cobranca')
      .select(`
        id,
        unidade:unidades_franqueadas (
          id,
          nome_franqueado,
          email_franqueado,
          telefone_franqueado
        )
      `)
      .eq('id', escalonamentoId)
      .single();

    if (escError || !escalonamento) {
      console.error('Erro ao buscar escalonamento:', escError);
      throw new Error('Escalonamento não encontrado.');
    }

    const { unidade } = escalonamento;
    if (!unidade) {
      throw new Error('Unidade franqueada não encontrada para este escalonamento.');
    }

    // 2. Verificar se já existe um convite
    const { data: reuniaoExistente, error: reuError } = await supabase
      .from('reunioes_juridico')
      .select('id')
      .eq('escalonamento_id_fk', escalonamentoId)
      .maybeSingle();

    if (reuError) {
      console.error('Erro ao verificar reunião existente:', reuError);
      throw new Error('Erro ao verificar duplicidade de reunião.');
    }

    if (reuniaoExistente) {
      console.warn(`Convite para reunião já enviado para o escalonamento ${escalonamentoId}`);
      return { sucesso: false, mensagem: 'Convite para reunião já foi enviado anteriormente.' };
    }

    // 3. Criar o registro da reunião no banco
    const { data: novaReuniao, error: insertError } = await supabase
      .from('reunioes_juridico')
      .insert({
        unidade_id_fk: unidade.id,
        escalonamento_id_fk: escalonamento.id,
        status: 'convite_enviado',
        link_calendly: CALENDLY_LINK,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao criar registro da reunião:', insertError);
      throw new Error('Não foi possível criar o registro da reunião.');
    }

    console.log(`Registro de reunião ${novaReuniao.id} criado com sucesso.`);

    // 4. Enviar notificações (Email e WhatsApp)
    const nomeFranqueado = unidade.nome_franqueado || 'Franqueado(a)';
    const assunto = 'Convocação para Reunião Jurídica - Cresci e Perdi';
    const mensagem = `
      Prezado(a) ${nomeFranqueado},

      Devido à falta de resolução da pendência financeira de sua unidade, mesmo após o acionamento jurídico, estamos convocando-o(a) para uma reunião com nosso departamento responsável.

      O objetivo é discutir os próximos passos e buscar uma solução definitiva para evitar medidas mais severas.

      Por favor, agende o melhor horário para você através do link abaixo:
      ${CALENDLY_LINK}

      Sua presença é fundamental. O não agendamento ou ausência na reunião será interpretado como falta de interesse na resolução amigável do débito.

      Atenciosamente,
      Departamento Jurídico
      Cresci e Perdi
    `;

    // Envio de Email
    if (unidade.email_franqueado) {
      await this.emailService.enviarEmailSimples(
        unidade.email_franqueado,
        assunto,
        mensagem
      );
      console.log(`E-mail de convocação enviado para ${unidade.email_franqueado}`);
    }

    // Envio de WhatsApp (a ser implementado na Edge Function)
    if (unidade.telefone_franqueado) {
      // A lógica de envio do WhatsApp será adicionada na Edge Function,
      // pois depende das variáveis de ambiente da Evolution API.
      console.log(`Um WhatsApp de convocação deve ser enviado para ${unidade.telefone_franqueado}`);
    }

    return { sucesso: true, mensagem: 'Convite para reunião enviado com sucesso.' };
  }
}