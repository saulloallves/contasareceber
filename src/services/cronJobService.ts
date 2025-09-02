import { automacaoNotificacaoService } from './automacaoNotificacaoService';

export class CronJobService {
  private intervalId: NodeJS.Timeout | null = null;
  private executando = false;
  private horarioExecucao = { hora: 9, minuto: 0 }; // 9:00 AM

  /**
   * Inicia o agendador para rodar uma vez por dia no horário configurado
   */
  iniciar(): void {
    console.log('🚀 Iniciando agendador de verificação de cobranças...');
    
    // Calcula próxima execução
    const proximaExecucao = this.calcularProximaExecucao();
    const tempoAteProximaExecucao = proximaExecucao.getTime() - new Date().getTime();
    
    // Agenda primeira execução
    setTimeout(() => {
      this.executarTarefa();
      
      // Depois agenda para repetir a cada 24 horas
      this.intervalId = setInterval(() => {
        this.executarTarefa();
      }, 24 * 60 * 60 * 1000);
      
    }, tempoAteProximaExecucao);
    
    console.log(`⏰ Próxima execução agendada para: ${proximaExecucao.toLocaleString('pt-BR')}`);
  }

  /**
   * Para o agendador
   */
  parar(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏸️ Agendador de verificação parado');
    }
  }

  /**
   * Configura horário de execução
   */
  configurarHorario(hora: number, minuto: number): void {
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      throw new Error('Horário inválido. Hora: 0-23, Minuto: 0-59');
    }
    
    this.horarioExecucao = { hora, minuto };
    console.log(`⏰ Horário de execução configurado para ${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`);
    
    // Reinicia o agendador com novo horário
    if (this.intervalId) {
      this.parar();
      this.iniciar();
    }
  }

  /**
   * Verifica se o agendador está ativo
   */
  estaAtivo(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Executa a verificação se não estiver já executando
   */
  private async executarTarefa(): Promise<void> {
    if (this.executando) {
      console.log('⏭️ Verificação já está executando, pulando...');
      return;
    }

    this.executando = true;
    
    try {
      console.log('🔄 Iniciando execução automática do fluxo de notificações...');
      
      // Usa o novo método integrado que já envia WhatsApp e Email
      await automacaoNotificacaoService.executarCronJob();
      
      console.log(`✅ Execução automática concluída`);
    } catch (error) {
      console.error('❌ Erro na execução automática:', error);
    } finally {
      this.executando = false;
    }
  }

  /**
   * Calcula próxima execução no horário configurado
   */
  private calcularProximaExecucao(): Date {
    const agora = new Date();
    const proximaExecucao = new Date();
    proximaExecucao.setHours(this.horarioExecucao.hora, this.horarioExecucao.minuto, 0, 0);
    
    // Se já passou do horário hoje, agenda para amanhã
    if (proximaExecucao <= agora) {
      proximaExecucao.setDate(proximaExecucao.getDate() + 1);
    }
    
    return proximaExecucao;
  }

  /**
   * Execução manual para testes
   */
  async executarManualmente(): Promise<void> {
    console.log('🔄 Executando fluxo manual completo...');
    try {
      const resultado = await automacaoNotificacaoService.executarFluxoCompleto();
      
      console.log('\n📊 Resultado da Execução Manual:');
      console.log(`   • Total processadas: ${resultado.total_processadas}`);
      console.log(`   • WhatsApp enviados: ${resultado.whatsapp_enviados}`);
      console.log(`   • Emails enviados: ${resultado.emails_enviados}`);
      console.log(`   • Erros: ${resultado.erros.length}`);
      
      if (resultado.erros.length > 0) {
        console.log('\n❌ Detalhes dos erros:');
        resultado.erros.forEach((erro, index) => {
          console.log(`   ${index + 1}. Cobrança ${erro.cobranca_id} (${erro.canal}): ${erro.erro}`);
        });
      }
      
      if (resultado.detalhes.length > 0) {
        console.log('\n📋 Resumo das notificações enviadas:');
        resultado.detalhes.forEach((detalhe, index) => {
          const status = [];
          if (detalhe.whatsapp_enviado) status.push('WhatsApp ✅');
          if (detalhe.email_enviado) status.push('Email ✅');
          if (status.length === 0) status.push('Nenhum envio');
          
          console.log(`   ${index + 1}. ${detalhe.nome_franqueado} (${detalhe.unidade}) - Marco ${detalhe.marco} dias - ${status.join(', ')}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Erro na execução manual:', error);
    }
  }

  /**
   * Retorna informações sobre o próximo agendamento
   */
  obterProximoAgendamento(): { 
    proximaExecucao: Date | null; 
    tempoRestante: string;
    estaAtivo: boolean;
  } {
    if (!this.estaAtivo()) {
      return {
        proximaExecucao: null,
        tempoRestante: 'Agendador inativo',
        estaAtivo: false
      };
    }

    const proximaExecucao = this.calcularProximaExecucao();
    const agora = new Date();
    const diferencaMilis = proximaExecucao.getTime() - agora.getTime();
    
    const horas = Math.floor(diferencaMilis / (1000 * 60 * 60));
    const minutos = Math.floor((diferencaMilis % (1000 * 60 * 60)) / (1000 * 60));
    
    const tempoRestante = horas > 0 
      ? `${horas}h ${minutos}m`
      : `${minutos}m`;

    return {
      proximaExecucao,
      tempoRestante,
      estaAtivo: true
    };
  }
}

export const cronJobService = new CronJobService();
