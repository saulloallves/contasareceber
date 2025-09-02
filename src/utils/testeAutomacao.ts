import { automacaoNotificacaoService } from '../services/automacaoNotificacaoService';

/**
 * Função de teste para verificar a cobrança específica mencionada
 */
export async function testarCobrancaEspecifica() {
  console.log('🧪 Testando cobrança específica: 264c35d4-8bce-4bd6-b750-8f5977ff178b');
  console.log('📋 CNPJ: 60164763000108 - VILA PRUDENTE - SÃO PAULO / SP');
  console.log('👥 Esperado: Fabiana Abreu Frateschi de Freitas Lopes (principal)');
  console.log('---');
  
  try {
    // Executa verificação completa
    const resultado = await automacaoNotificacaoService.verificarCobrancasParaNotificacao();
    
    // Procura pela cobrança específica
    const cobrancaEspecifica = resultado.find(c => c.id === '264c35d4-8bce-4bd6-b750-8f5977ff178b');
    
    if (cobrancaEspecifica) {
      console.log('✅ Cobrança encontrada!');
      console.log('📊 Dados da cobrança:');
      console.log('   - Cliente:', cobrancaEspecifica.cliente);
      console.log('   - CNPJ:', cobrancaEspecifica.cnpj);
      console.log('   - Dias desde criação:', cobrancaEspecifica.dias_desde_criacao);
      console.log('   - Próximo marco:', cobrancaEspecifica.proximo_marco);
      console.log('   - Deve notificar WhatsApp:', cobrancaEspecifica.deve_notificar_whatsapp);
      console.log('   - Deve notificar Email:', cobrancaEspecifica.deve_notificar_email);
      console.log('');
      
      // Mostra dados do franqueado se encontrados
      if (cobrancaEspecifica.franqueado_principal) {
        console.log('✅ Franqueado principal encontrado:');
        console.log('   - Nome:', cobrancaEspecifica.franqueado_principal.nome_completo);
        console.log('   - Email:', cobrancaEspecifica.franqueado_principal.email);
        console.log('   - Telefone:', cobrancaEspecifica.franqueado_principal.telefone);
        
        // Verifica se é a Fabiana
        if (cobrancaEspecifica.franqueado_principal.nome_completo.includes('FABIANA')) {
          console.log('🎯 SUCESSO: Franqueado correto (Fabiana) foi encontrado!');
        } else {
          console.log('⚠️ ATENÇÃO: Franqueado diferente do esperado!');
          console.log('   Esperado: Fabiana Abreu Frateschi de Freitas Lopes');
          console.log('   Encontrado:', cobrancaEspecifica.franqueado_principal.nome_completo);
        }
      } else {
        console.log('❌ Franqueado principal NÃO encontrado');
      }
      console.log('');
      
      // Mostra dados da unidade se encontrados
      if (cobrancaEspecifica.unidade) {
        console.log('✅ Dados da unidade encontrados:');
        console.log('   - Nome:', cobrancaEspecifica.unidade.nome_unidade);
        console.log('   - Código:', cobrancaEspecifica.unidade.codigo_unidade);
        console.log('   - ID:', cobrancaEspecifica.unidade.id);
        
        // Verifica se é Vila Prudente
        if (cobrancaEspecifica.unidade.nome_unidade.includes('VILA PRUDENTE')) {
          console.log('🎯 SUCESSO: Unidade Vila Prudente encontrada!');
        }
      } else {
        console.log('❌ Dados da unidade NÃO encontrados');
      }
      console.log('');
      
      // Gera exemplo de mensagem se precisar notificar
      if (cobrancaEspecifica.deve_notificar_whatsapp && cobrancaEspecifica.proximo_marco) {
        console.log('📱 Exemplo de mensagem WhatsApp:');
        console.log('==========================================');
        const mensagem = await automacaoNotificacaoService.gerarMensagemWhatsApp(
          cobrancaEspecifica, 
          cobrancaEspecifica.proximo_marco
        );
        console.log(mensagem);
        console.log('==========================================');
      }
      
    } else {
      console.log('❌ Cobrança específica não encontrada ou não precisa de notificação');
      console.log(`📊 Total de cobranças encontradas: ${resultado.length}`);
      
      // Busca por cobranças da Vila Prudente para debug
      const cobrancasVilaPrudente = resultado.filter(c => 
        c.cliente.includes('VILA PRUDENTE') || c.cnpj === '60164763000108'
      );
      
      if (cobrancasVilaPrudente.length > 0) {
        console.log('🔍 Outras cobranças da Vila Prudente encontradas:');
        cobrancasVilaPrudente.forEach((c, i) => {
          console.log(`${i + 1}. ${c.cliente} (${c.id})`);
          console.log(`   - CNPJ: ${c.cnpj}`);
          console.log(`   - Dias: ${c.dias_desde_criacao}`);
          console.log(`   - Marco: ${c.proximo_marco}`);
          console.log(`   - Franqueado: ${c.franqueado_principal?.nome_completo || 'Não encontrado'}`);
        });
      }
      
      // Lista as primeiras 3 cobranças para referência
      if (resultado.length > 0) {
        console.log('🔍 Primeiras cobranças encontradas:');
        resultado.slice(0, 3).forEach((c, i) => {
          console.log(`${i + 1}. ${c.cliente} (${c.id}) - ${c.dias_desde_criacao} dias`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Declare global interface
declare global {
  interface Window {
    testarCobrancaEspecifica: typeof testarCobrancaEspecifica;
  }
}

// Função para testar diretamente no browser console
(window as Window).testarCobrancaEspecifica = testarCobrancaEspecifica;
