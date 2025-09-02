import React, { useState } from 'react';
import { automacaoNotificacaoService } from '../services/automacaoNotificacaoService';
import { cronJobService } from '../services/cronJobService';

interface ResultadoExecucao {
  total_processadas: number;
  whatsapp_enviados: number;
  emails_enviados: number;
  erros: Array<{ cobranca_id: string; erro: string; canal: string }>;
  detalhes: Array<{
    cobranca_id: string;
    nome_franqueado: string;
    unidade: string;
    marco: number;
    whatsapp_enviado: boolean;
    email_enviado: boolean;
  }>;
}

interface CronInfo {
  proximaExecucao: Date | null;
  tempoRestante: string;
  estaAtivo: boolean;
}

export default function TesteNotificacoesAutomaticas() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoExecucao | null>(null);
  const [cronInfo, setCronInfo] = useState<CronInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Atualiza informações do cron
  React.useEffect(() => {
    const atualizarCronInfo = () => {
      setCronInfo(cronJobService.obterProximoAgendamento());
    };

    atualizarCronInfo();
    const interval = setInterval(atualizarCronInfo, 30000); // Atualiza a cada 30s

    return () => clearInterval(interval);
  }, []);

  const executarTeste = async () => {
    setExecutando(true);
    setResultado(null);
    setErro(null);

    try {
      console.log('🚀 Iniciando teste de notificações automáticas...');
      const resultado = await automacaoNotificacaoService.executarFluxoCompleto();
      setResultado(resultado);
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      setErro(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setExecutando(false);
    }
  };

  const executarCronManual = async () => {
    try {
      await cronJobService.executarManualmente();
      // Recarrega o resultado após execução manual
      setTimeout(() => executarTeste(), 1000);
    } catch (error) {
      console.error('❌ Erro na execução manual do cron:', error);
      setErro(error instanceof Error ? error.message : 'Erro na execução manual');
    }
  };

  const iniciarCron = () => {
    cronJobService.iniciar();
    setCronInfo(cronJobService.obterProximoAgendamento());
  };

  const pararCron = () => {
    cronJobService.parar();
    setCronInfo(cronJobService.obterProximoAgendamento());
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>
          🧪 Teste de Notificações Automáticas
        </h1>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Teste o sistema integrado de WhatsApp e Email com n8nService e emailService
        </p>
      </div>

      {/* Controles do Cron Job */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '24px',
        backgroundColor: '#f9f9f9'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>
          ⏰ Agendador Automático (Cron Job)
        </h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Controle a execução automática diária das notificações (padrão: 9h da manhã)
        </p>

        <div style={{ marginBottom: '16px' }}>
          <span style={{
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '0.875rem',
            backgroundColor: cronInfo?.estaAtivo ? '#22c55e' : '#6b7280',
            color: 'white',
            marginRight: '16px'
          }}>
            {cronInfo?.estaAtivo ? "✅ Ativo" : "⏸️ Inativo"}
          </span>
          
          {cronInfo?.estaAtivo && cronInfo?.proximaExecucao && (
            <span style={{ fontSize: '0.875rem', color: '#666' }}>
              Próxima execução em: <strong>{cronInfo.tempoRestante}</strong>
              <br />
              Data/Hora: <strong>{new Date(cronInfo.proximaExecucao).toLocaleString('pt-BR')}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={iniciarCron}
            disabled={cronInfo?.estaAtivo}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: cronInfo?.estaAtivo ? '#ccc' : '#22c55e',
              color: 'white',
              cursor: cronInfo?.estaAtivo ? 'not-allowed' : 'pointer'
            }}
          >
            🚀 Iniciar Agendador
          </button>
          
          <button 
            onClick={pararCron}
            disabled={!cronInfo?.estaAtivo}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: !cronInfo?.estaAtivo ? '#f5f5f5' : 'white',
              color: !cronInfo?.estaAtivo ? '#999' : '#333',
              cursor: !cronInfo?.estaAtivo ? 'not-allowed' : 'pointer'
            }}
          >
            ⏸️ Parar Agendador
          </button>
          
          <button 
            onClick={executarCronManual}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: '#f8f9fa',
              color: '#333',
              cursor: 'pointer'
            }}
          >
            ⚡ Executar Agora (Manual)
          </button>
        </div>
      </div>

      {/* Teste Direto */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '24px' 
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>
          🧪 Teste Direto do Sistema
        </h2>
        <p style={{ color: '#666', marginBottom: '16px' }}>
          Executa o fluxo completo de notificações (análise + envio WhatsApp/Email)
        </p>
        
        <button 
          onClick={executarTeste}
          disabled={executando}
          style={{
            width: '100%',
            padding: '12px 24px',
            fontSize: '1rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: executando ? '#ccc' : '#3b82f6',
            color: 'white',
            cursor: executando ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {executando ? '⏳ Executando...' : '🚀 Executar Teste Completo'}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div style={{ 
          border: '1px solid #dc2626', 
          borderRadius: '8px', 
          padding: '16px', 
          marginBottom: '24px',
          backgroundColor: '#fef2f2'
        }}>
          <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>❌ Erro</h3>
          <p style={{ color: '#dc2626' }}>{erro}</p>
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px', 
          marginBottom: '24px' 
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>
            📊 Resultado da Execução
          </h2>

          {/* Resumo Geral */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                {resultado.total_processadas}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#1d4ed8' }}>Total Analisadas</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>
                {resultado.whatsapp_enviados}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#15803d' }}>📱 WhatsApp Enviados</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#faf5ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#9333ea' }}>
                {resultado.emails_enviados}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#7c3aed' }}>📧 Emails Enviados</div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
                {resultado.erros.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#b91c1c' }}>Erros</div>
            </div>
          </div>

          {/* Detalhes das Notificações */}
          {resultado.detalhes && resultado.detalhes.length > 0 && (
            <>
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ddd' }} />
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '12px' }}>
                  📋 Detalhes das Notificações Enviadas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resultado.detalhes.map((detalhe, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px', 
                      backgroundColor: '#f8f9fa', 
                      borderRadius: '6px' 
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          {detalhe.nome_franqueado}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          {detalhe.unidade} • Marco: {detalhe.marco} dias
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          backgroundColor: detalhe.whatsapp_enviado ? '#22c55e' : '#6b7280',
                          color: 'white'
                        }}>
                          📱 WhatsApp {detalhe.whatsapp_enviado ? "✅" : "❌"}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          backgroundColor: detalhe.email_enviado ? '#9333ea' : '#6b7280',
                          color: 'white'
                        }}>
                          📧 Email {detalhe.email_enviado ? "✅" : "❌"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Erros */}
          {resultado.erros && resultado.erros.length > 0 && (
            <>
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #ddd' }} />
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '12px', color: '#dc2626' }}>
                  ❌ Erros Encontrados
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {resultado.erros.map((erro, index) => (
                    <div key={index} style={{ 
                      padding: '12px', 
                      backgroundColor: '#fef2f2', 
                      borderRadius: '6px',
                      border: '1px solid #fecaca'
                    }}>
                      <strong>Cobrança {erro.cobranca_id}</strong> ({erro.canal}): {erro.erro}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Mensagem quando não há cobranças */}
          {resultado.total_processadas === 0 && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f0fdf4', 
              borderRadius: '6px',
              border: '1px solid #bbf7d0'
            }}>
              ✅ Nenhuma cobrança precisa de notificação no momento. Sistema funcionando corretamente!
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px',
        backgroundColor: '#f8f9fa'
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px' }}>
          📖 Como usar
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
          <div>
            <strong>🤖 Agendador Automático:</strong> Liga/desliga a execução diária automática (padrão: 9h da manhã)
          </div>
          <div>
            <strong>⚡ Executar Agora:</strong> Roda o cron job manualmente para testes imediatos
          </div>
          <div>
            <strong>🧪 Teste Direto:</strong> Executa o fluxo completo e mostra resultados detalhados
          </div>
          <div>
            <strong>📅 Marcos de Notificação:</strong> Sistema notifica aos 3, 7, 15 e 30 dias após criação da cobrança
          </div>
          <div>
            <strong>🔗 Integração Completa:</strong> WhatsApp via n8nService + Email via emailService + Templates dinâmicos
          </div>
          <div>
            <strong>👥 Franqueados:</strong> Para CNPJs busca automaticamente o nome do franqueado principal da unidade
          </div>
        </div>
      </div>
    </div>
  );
}
