import React, { useState } from 'react';
import { Clock, Play, Pause, Zap, TestTube, CheckCircle, AlertCircle, MessageSquare, Mail, PlayCircle, Settings } from 'lucide-react';
import { automacaoNotificacaoService } from '../services/automacaoNotificacaoService';
import { cronJobService, ConfiguracaoCron } from '../services/cronJobService';
import WhatsAppIcon from './ui/WhatsAppIcon';
import ModalConfiguracaoAgendador from './ui/ModalConfiguracaoAgendador';
import { toast } from 'react-hot-toast';

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
  configuracao: ConfiguracaoCron;
}

export default function TesteNotificacoesAutomaticas() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoExecucao | null>(null);
  const [cronInfo, setCronInfo] = useState<CronInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

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
    toast.success('Agendador iniciado com sucesso!');
  };

  const pararCron = () => {
    cronJobService.parar();
    setCronInfo(cronJobService.obterProximoAgendamento());
    toast.success('Agendador parado com sucesso!');
  };

  const handleSalvarConfiguracao = (novaConfig: ConfiguracaoCron) => {
    try {
      cronJobService.configurarAgendamento(novaConfig);
      setCronInfo(cronJobService.obterProximoAgendamento());
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configurações');
    }
  };

  const obterFrequenciaTexto = (config: ConfiguracaoCron) => {
    switch (config.frequencia) {
      case 'diario':
        return 'Diário';
      case 'semanal':
        return 'Semanal';
      case 'mensal':
        return 'Mensal';
      default:
        return 'Não configurado';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles do Cron Job */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Clock className="w-6 h-6 text-orange-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Agendador Automático</h3>
            <p className="text-sm text-gray-600">Controle a execução automática diária das notificações (padrão: 9h da manhã)</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              cronInfo?.estaAtivo 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {cronInfo?.estaAtivo ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Ativo
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Inativo
                </>
              )}
            </span>
            
            {cronInfo?.configuracao && (
              <span className="text-sm text-gray-600">
                {obterFrequenciaTexto(cronInfo.configuracao)} • {
                  cronInfo.configuracao.hora.toString().padStart(2, '0')
                }:{
                  cronInfo.configuracao.minuto.toString().padStart(2, '0')
                }
              </span>
            )}
          </div>

          <button
            onClick={() => setModalConfigAberto(true)}
            className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 mr-1" />
            Configurar
          </button>
        </div>

        {cronInfo?.estaAtivo && cronInfo?.proximaExecucao && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <div>Próxima execução em: <span className="font-semibold">{cronInfo.tempoRestante}</span></div>
              <div>Data/Hora: <span className="font-semibold">{new Date(cronInfo.proximaExecucao).toLocaleString('pt-BR')}</span></div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={iniciarCron}
            disabled={cronInfo?.estaAtivo}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4 mr-2" />
            Iniciar Agendador
          </button>
          
          <button 
            onClick={pararCron}
            disabled={!cronInfo?.estaAtivo}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="w-4 h-4 mr-2" />
            Parar Agendador
          </button>
          
          <button 
            onClick={executarCronManual}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Zap className="w-4 h-4 mr-2" />
            Executar Agora
          </button>
        </div>
      </div>

      {/* Teste Direto */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <TestTube className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Teste Direto do Sistema</h3>
            <p className="text-sm text-gray-600">Executa o fluxo completo de notificações (análise + envio WhatsApp/Email)</p>
          </div>
        </div>
        
        <button 
          onClick={executarTeste}
          disabled={executando}
          className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {executando ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Executando...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 mr-2" />
              Executar Teste Completo
            </>
          )}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-red-800 font-medium">Erro</h3>
          </div>
          <p className="text-red-700 mt-2">{erro}</p>
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Resultado da Execução</h3>

          {/* Resumo Geral */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {resultado.total_processadas}
              </div>
              <div className="text-sm text-blue-700">Total Analisadas</div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {resultado.whatsapp_enviados}
              </div>
              <div className="text-sm text-green-700 flex items-center justify-center">
                <WhatsAppIcon className="w-4 h-4 mr-1" />
                WhatsApp Enviados
              </div>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {resultado.emails_enviados}
              </div>
              <div className="text-sm text-purple-700 flex items-center justify-center">
                <Mail className="w-4 h-4 mr-1" />
                Emails Enviados
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600 mb-1">
                {resultado.erros.length}
              </div>
              <div className="text-sm text-red-700">Erros</div>
            </div>
          </div>

          {/* Detalhes das Notificações */}
          {resultado.detalhes && resultado.detalhes.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-800 mb-3">Detalhes das Notificações Enviadas</h4>
              <div className="space-y-3">
                {resultado.detalhes.map((detalhe, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-800">{detalhe.nome_franqueado}</div>
                      <div className="text-sm text-gray-600">
                        {detalhe.unidade} • Marco: {detalhe.marco} dias
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        detalhe.whatsapp_enviado 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <MessageSquare className="w-3 h-3 mr-1" />
                        WhatsApp {detalhe.whatsapp_enviado ? "✅" : "❌"}
                      </span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        detalhe.email_enviado 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Mail className="w-3 h-3 mr-1" />
                        Email {detalhe.email_enviado ? "✅" : "❌"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erros */}
          {resultado.erros && resultado.erros.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-semibold text-red-800 mb-3">Erros Encontrados</h4>
              <div className="space-y-2">
                {resultado.erros.map((erro, index) => (
                  <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <span className="font-semibold">Cobrança {erro.cobranca_id}</span> ({erro.canal}): {erro.erro}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem quando não há cobranças */}
          {resultado.total_processadas === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800">
                  Nenhuma cobrança precisa de notificação no momento. Sistema funcionando corretamente!
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Como usar</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start">
            <Clock className="w-4 h-4 mr-2 mt-0.5 text-orange-600" />
            <div>
              <span className="font-semibold">Agendador Automático:</span> Liga/desliga a execução diária automática (padrão: 9h da manhã)
            </div>
          </div>
          <div className="flex items-start">
            <Zap className="w-4 h-4 mr-2 mt-0.5 text-blue-600" />
            <div>
              <span className="font-semibold">Executar Agora:</span> Roda o cron job manualmente para testes imediatos
            </div>
          </div>
          <div className="flex items-start">
            <TestTube className="w-4 h-4 mr-2 mt-0.5 text-purple-600" />
            <div>
              <span className="font-semibold">Teste Direto:</span> Executa o fluxo completo e mostra resultados detalhados
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-4 h-4 mr-2 mt-0.5 text-white text-xs font-bold">📅</div>
            <div>
              <span className="font-semibold">Marcos de Notificação:</span> Sistema notifica aos 3, 7, 15 e 30 dias após criação da cobrança
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-4 h-4 mr-2 mt-0.5 text-white text-xs font-bold">🔗</div>
            <div>
              <span className="font-semibold">Integração Completa:</span> WhatsApp via n8nService + Email via emailService + Templates dinâmicos
            </div>
          </div>
          <div className="flex items-start">
            <div className="w-4 h-4 mr-2 mt-0.5 text-white text-xs font-bold">👥</div>
            <div>
              <span className="font-semibold">Franqueados:</span> Para CNPJs busca automaticamente o nome do franqueado principal da unidade
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Configuração */}
      {modalConfigAberto && cronInfo?.configuracao && (
        <ModalConfiguracaoAgendador
          isOpen={modalConfigAberto}
          onClose={() => setModalConfigAberto(false)}
          onSave={handleSalvarConfiguracao}
          configuracaoAtual={cronInfo.configuracao}
        />
      )}
    </div>
  );
}
