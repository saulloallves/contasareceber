import { automacaoNotificacaoService } from '../services/automacaoNotificacaoService';
import { cronJobService } from '../services/cronJobService';

/**
 * Função para testar a integração completa do sistema de notificações
 * Execute no console do navegador: testarIntegracao()
 */
export async function testarIntegracao() {
  console.log('🧪 ===== TESTE DE INTEGRAÇÃO COMPLETA =====');
  
  try {
    // 1. Teste apenas verificação (sem envio)
    console.log('\n📊 1. Verificando cobranças que precisam de notificação...');
    const cobrancasParaNotificar = await automacaoNotificacaoService.verificarCobrancasParaNotificacao();
    
    console.log(`Encontradas ${cobrancasParaNotificar.length} cobranças para análise`);
    
    if (cobrancasParaNotificar.length > 0) {
      console.log('\n📋 Detalhes das cobranças encontradas:');
      cobrancasParaNotificar.forEach((cobranca, index) => {
        const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 
                              cobranca.cliente.split(' ')[0] || 'Franqueado';
        const unidade = cobranca.unidade?.nome_unidade || cobranca.cliente;
        
        console.log(`${index + 1}. ${nomeFranqueado} (${unidade})`);
        console.log(`   • Marco: ${cobranca.proximo_marco} dias`);
        console.log(`   • WhatsApp: ${cobranca.deve_notificar_whatsapp ? '✅' : '❌'} (${cobranca.telefone || 'sem telefone'})`);
        console.log(`   • Email: ${cobranca.deve_notificar_email ? '✅' : '❌'} (${cobranca.email_cobranca || cobranca.franqueado_principal?.email || 'sem email'})`);
      });
    }
    
    // 2. Teste do fluxo completo (COM envio)
    console.log('\n🚀 2. Executando fluxo completo (com envio de mensagens)...');
    const resultado = await automacaoNotificacaoService.executarFluxoCompleto();
    
    console.log('\n📊 RESULTADO DA EXECUÇÃO:');
    console.log(`   • Total processadas: ${resultado.total_processadas}`);
    console.log(`   • WhatsApp enviados: ${resultado.whatsapp_enviados}`);
    console.log(`   • Emails enviados: ${resultado.emails_enviados}`);
    console.log(`   • Erros: ${resultado.erros.length}`);
    
    if (resultado.detalhes.length > 0) {
      console.log('\n✅ NOTIFICAÇÕES ENVIADAS:');
      resultado.detalhes.forEach((detalhe, index) => {
        console.log(`${index + 1}. ${detalhe.nome_franqueado} (${detalhe.unidade})`);
        console.log(`   • Marco: ${detalhe.marco} dias`);
        console.log(`   • WhatsApp: ${detalhe.whatsapp_enviado ? '✅ Enviado' : '❌ Não enviado'}`);
        console.log(`   • Email: ${detalhe.email_enviado ? '✅ Enviado' : '❌ Não enviado'}`);
      });
    }
    
    if (resultado.erros.length > 0) {
      console.log('\n❌ ERROS ENCONTRADOS:');
      resultado.erros.forEach((erro, index) => {
        console.log(`${index + 1}. Cobrança ${erro.cobranca_id} (${erro.canal}): ${erro.erro}`);
      });
    }
    
    // 3. Teste do cron job
    console.log('\n⏰ 3. Testando informações do cron job...');
    const cronInfo = cronJobService.obterProximoAgendamento();
    console.log(`   • Status: ${cronInfo.estaAtivo ? 'Ativo' : 'Inativo'}`);
    if (cronInfo.proximaExecucao) {
      console.log(`   • Próxima execução: ${cronInfo.proximaExecucao.toLocaleString('pt-BR')}`);
      console.log(`   • Tempo restante: ${cronInfo.tempoRestante}`);
    }
    
    console.log('\n✅ ===== TESTE COMPLETO FINALIZADO =====');
    
    return {
      success: true,
      cobrancas_analisadas: cobrancasParaNotificar.length,
      resultado_execucao: resultado,
      cron_info: cronInfo
    };
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Função para testar apenas a verificação (sem envios)
 */
export async function testarApenasBusca() {
  console.log('🔍 ===== TESTE APENAS BUSCA =====');
  
  try {
    const cobrancas = await automacaoNotificacaoService.verificarCobrancasParaNotificacao();
    
    console.log(`\n📊 Resultado: ${cobrancas.length} cobranças encontradas`);
    
    cobrancas.forEach((cobranca, index) => {
      const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 
                            cobranca.cliente;
      const unidade = cobranca.unidade?.nome_unidade || 'N/A';
      
      console.log(`\n${index + 1}. ID: ${cobranca.id}`);
      console.log(`   Cliente: ${cobranca.cliente}`);
      console.log(`   Franqueado Principal: ${nomeFranqueado}`);
      console.log(`   Unidade: ${unidade}`);
      console.log(`   CNPJ: ${cobranca.cnpj || 'N/A'}`);
      console.log(`   CPF: ${cobranca.cpf || 'N/A'}`);
      console.log(`   Valor: R$ ${cobranca.valor_original.toFixed(2)}`);
      console.log(`   Dias desde criação: ${cobranca.dias_desde_criacao}`);
      console.log(`   Próximo marco: ${cobranca.proximo_marco} dias`);
      console.log(`   Telefone: ${cobranca.telefone || 'N/A'}`);
      console.log(`   Email: ${cobranca.email_cobranca || cobranca.franqueado_principal?.email || 'N/A'}`);
      console.log(`   Deve notificar WhatsApp: ${cobranca.deve_notificar_whatsapp ? 'SIM' : 'NÃO'}`);
      console.log(`   Deve notificar Email: ${cobranca.deve_notificar_email ? 'SIM' : 'NÃO'}`);
    });
    
    return cobrancas;
    
  } catch (error) {
    console.error('❌ Erro na busca:', error);
    throw error;
  }
}

/**
 * Função para resetar notificações de uma cobrança específica (para testes)
 */
export async function resetarCobranca(cobrancaId: string) {
  console.log(`🔄 Resetando notificações da cobrança ${cobrancaId}...`);
  
  try {
    await automacaoNotificacaoService.resetarNotificacoes(cobrancaId);
    console.log('✅ Notificações resetadas com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao resetar:', error);
    return false;
  }
}

/**
 * Função para iniciar o cron job
 */
export function iniciarCron() {
  console.log('⏰ Iniciando cron job automático...');
  cronJobService.iniciar();
  
  const info = cronJobService.obterProximoAgendamento();
  console.log(`✅ Cron iniciado! Próxima execução: ${info.proximaExecucao?.toLocaleString('pt-BR')}`);
  
  return info;
}

/**
 * Função para parar o cron job
 */
export function pararCron() {
  console.log('⏸️ Parando cron job...');
  cronJobService.parar();
  console.log('✅ Cron parado!');
  
  return cronJobService.obterProximoAgendamento();
}

// Disponibiliza funções globalmente para teste no console
declare global {
  interface Window {
    testarIntegracao: typeof testarIntegracao;
    testarApenasBusca: typeof testarApenasBusca;
    resetarCobranca: typeof resetarCobranca;
    iniciarCron: typeof iniciarCron;
    pararCron: typeof pararCron;
  }
}

if (typeof window !== 'undefined') {
  window.testarIntegracao = testarIntegracao;
  window.testarApenasBusca = testarApenasBusca;
  window.resetarCobranca = resetarCobranca;
  window.iniciarCron = iniciarCron;
  window.pararCron = pararCron;
}

console.log('🧪 Funções de teste carregadas! Use no console:');
console.log('   • testarIntegracao() - Teste completo com envios');
console.log('   • testarApenasBusca() - Apenas verificação sem envios');
console.log('   • resetarCobranca("id") - Reseta notificações de uma cobrança');
console.log('   • iniciarCron() - Inicia execução automática diária');
console.log('   • pararCron() - Para execução automática');
