import { automacaoNotificacaoService } from './automacaoNotificacaoService';

export type FrequenciaExecucao = 'diario' | 'semanal' | 'mensal';

export interface ConfiguracaoCron {
  hora: number;
  minuto: number;
  frequencia: FrequenciaExecucao;
  diasSemana?: number[]; // 0 = domingo, 1 = segunda, etc (para semanal)
  diaMes?: number; // 1-31 (para mensal)
}

export class CronJobService {
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private executando = false;
  private configuracao: ConfiguracaoCron = { 
    hora: 9, 
    minuto: 0, 
    frequencia: 'diario' 
  };

  /**
   * Inicia o agendador para rodar na frequência configurada
   */
  iniciar(): void {
    console.log('🚀 Iniciando agendador de verificação de cobranças...');
    
    // Para qualquer agendamento anterior
    this.parar();
    
    // Calcula próxima execução
    const proximaExecucao = this.calcularProximaExecucao();
    const tempoAteProximaExecucao = proximaExecucao.getTime() - new Date().getTime();
    
    // Agenda primeira execução
    this.timeoutId = setTimeout(() => {
      this.executarTarefa();
      
      // Depois agenda o próximo baseado na frequência
      this.agendarProximo();
      
    }, tempoAteProximaExecucao);
    
    console.log(`⏰ Próxima execução agendada para: ${proximaExecucao.toLocaleString('pt-BR')}`);
    console.log(`🔄 Frequência: ${this.configuracao.frequencia}`);
  }

  /**
   * Para o agendador
   */
  parar(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    console.log('⏸️ Agendador de verificação parado');
  }

  /**
   * Configura horário e frequência de execução
   */
  configurarAgendamento(config: ConfiguracaoCron): void {
    if (config.hora < 0 || config.hora > 23 || config.minuto < 0 || config.minuto > 59) {
      throw new Error('Horário inválido. Hora: 0-23, Minuto: 0-59');
    }
    
    if (config.frequencia === 'semanal' && (!config.diasSemana || config.diasSemana.length === 0)) {
      throw new Error('Para frequência semanal, é necessário especificar pelo menos um dia da semana');
    }
    
    if (config.frequencia === 'mensal' && (!config.diaMes || config.diaMes < 1 || config.diaMes > 31)) {
      throw new Error('Para frequência mensal, é necessário especificar um dia válido (1-31)');
    }
    
    this.configuracao = { ...config };
    console.log(`⏰ Agendamento configurado:`, {
      horario: `${config.hora.toString().padStart(2, '0')}:${config.minuto.toString().padStart(2, '0')}`,
      frequencia: config.frequencia,
      ...(config.diasSemana && { diasSemana: config.diasSemana }),
      ...(config.diaMes && { diaMes: config.diaMes })
    });
    
    // Reinicia o agendador com nova configuração
    if (this.estaAtivo()) {
      this.parar();
      this.iniciar();
    }
  }

  /**
   * Retorna a configuração atual
   */
  obterConfiguracao(): ConfiguracaoCron {
    return { ...this.configuracao };
  }
  /**
   * Verifica se o agendador está ativo
   */
  estaAtivo(): boolean {
    return this.intervalId !== null || this.timeoutId !== null;
  }

  /**
   * Agenda próxima execução baseada na frequência
   */
  private agendarProximo(): void {
    const proximaExecucao = this.calcularProximaExecucao();
    const tempoAteProximaExecucao = proximaExecucao.getTime() - new Date().getTime();
    
    this.timeoutId = setTimeout(() => {
      this.executarTarefa();
      this.agendarProximo(); // Reagenda recursivamente
    }, tempoAteProximaExecucao);
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
   * Calcula próxima execução baseada na configuração
   */
  private calcularProximaExecucao(): Date {
    const agora = new Date();
    const proximaExecucao = new Date();
    proximaExecucao.setHours(this.configuracao.hora, this.configuracao.minuto, 0, 0);
    
    if (this.configuracao.frequencia === 'diario') {
      // Se já passou do horário hoje, agenda para amanhã
      if (proximaExecucao <= agora) {
        proximaExecucao.setDate(proximaExecucao.getDate() + 1);
      }
    } else if (this.configuracao.frequencia === 'semanal') {
      const diasSemana = this.configuracao.diasSemana || [1]; // Segunda-feira por padrão
      const diaAtual = agora.getDay();
      
      // Encontra o próximo dia da semana configurado
      let diasAteProximo = 0;
      let encontrado = false;
      
      for (let i = 0; i < 7; i++) {
        const diaParaVerificar = (diaAtual + i) % 7;
        if (diasSemana.includes(diaParaVerificar)) {
          if (i === 0 && proximaExecucao <= agora) {
            continue; // Já passou hoje, procura próximo
          }
          diasAteProximo = i;
          encontrado = true;
          break;
        }
      }
      
      if (!encontrado) {
        diasAteProximo = 7; // Próxima semana
      }
      
      proximaExecucao.setDate(proximaExecucao.getDate() + diasAteProximo);
    } else if (this.configuracao.frequencia === 'mensal') {
      const diaMes = this.configuracao.diaMes || 1;
      proximaExecucao.setDate(diaMes);
      
      // Se já passou este mês, vai para o próximo
      if (proximaExecucao <= agora) {
        proximaExecucao.setMonth(proximaExecucao.getMonth() + 1);
        proximaExecucao.setDate(diaMes);
      }
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
    configuracao: ConfiguracaoCron;
  } {
    if (!this.estaAtivo()) {
      return {
        proximaExecucao: null,
        tempoRestante: 'Agendador inativo',
        estaAtivo: false,
        configuracao: this.configuracao
      };
    }

    const proximaExecucao = this.calcularProximaExecucao();
    const agora = new Date();
    const diferencaMilis = proximaExecucao.getTime() - agora.getTime();
    
    const dias = Math.floor(diferencaMilis / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferencaMilis % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferencaMilis % (1000 * 60 * 60)) / (1000 * 60));
    
    let tempoRestante = '';
    if (dias > 0) tempoRestante += `${dias}d `;
    if (horas > 0) tempoRestante += `${horas}h `;
    tempoRestante += `${minutos}m`;

    return {
      proximaExecucao,
      tempoRestante: tempoRestante.trim(),
      estaAtivo: true,
      configuracao: this.configuracao
    };
  }
}

export const cronJobService = new CronJobService();
