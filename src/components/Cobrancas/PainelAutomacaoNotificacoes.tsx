import { useState, useEffect } from 'react';
import { automacaoNotificacaoService } from '../../services/automacaoNotificacaoService';
import { cronJobService } from '../../services/cronJobService';

interface ResultadoVerificacao {
  total_analisadas: number;
  total_para_notificar: number;
  cobrancas: Array<{
    id?: string;
    cliente: string;
    cnpj: string;
    cpf?: string;
    valor_original: number;
    valor_atualizado?: number;
    dias_desde_criacao: number;
    proximo_marco: number | null;
    deve_notificar_whatsapp: boolean;
    deve_notificar_email: boolean;
    // Novos campos para dados do franqueado
    franqueado_principal?: {
      id: string;
      nome_completo: string;
      email?: string;
      telefone?: string;
    };
    unidade?: {
      id: string;
      nome_unidade: string;
      codigo_unidade: string;
      cidade: string;
      estado: string;
    };
  }>;
}

interface ResultadoEnvio {
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

interface InfoAgendamento {
  proximaExecucao: Date | null;
  tempoRestante: string;
  estaAtivo: boolean;
}

export function PainelAutomacaoNotificacoes() {
  const [executando, setExecutando] = useState(false);
  const [executandoEnvios, setExecutandoEnvios] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);
  const [resultadoEnvio, setResultadoEnvio] = useState<ResultadoEnvio | null>(null);
  const [infoAgendamento, setInfoAgendamento] = useState<InfoAgendamento>({
    proximaExecucao: null,
    tempoRestante: 'Carregando...',
    estaAtivo: false
  });
  const [novoHorario, setNovoHorario] = useState({ hora: 9, minuto: 0 });

  useEffect(() => {
    // Atualiza informações do agendamento a cada minuto
    const atualizarInfo = () => {
      setInfoAgendamento(cronJobService.obterProximoAgendamento());
    };

    atualizarInfo();
    const interval = setInterval(atualizarInfo, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, []);

  const executarVerificacao = async () => {
    setExecutando(true);
    setResultadoEnvio(null); // Limpa resultado anterior de envios
    try {
      const res = await automacaoNotificacaoService.executarManualmente();
      setResultado(res);
      console.log('Resultado da verificação:', res);
    } catch (error) {
      console.error('Erro na verificação:', error);
      alert('Erro na verificação: ' + error);
    } finally {
      setExecutando(false);
    }
  };

  const executarFluxoCompleto = async () => {
    setExecutandoEnvios(true);
    try {
      console.log('🚀 Iniciando fluxo completo de notificações...');
      const resultado = await automacaoNotificacaoService.executarFluxoCompleto();
      setResultadoEnvio(resultado);
      console.log('✅ Resultado do fluxo completo:', resultado);
      
      // Reexecuta a verificação para atualizar os dados
      setTimeout(() => {
        executarVerificacao();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro no fluxo completo:', error);
      alert('Erro no fluxo de envio: ' + error);
    } finally {
      setExecutandoEnvios(false);
    }
  };

  const alternarAgendador = () => {
    if (cronJobService.estaAtivo()) {
      cronJobService.parar();
    } else {
      cronJobService.iniciar();
    }
    setInfoAgendamento(cronJobService.obterProximoAgendamento());
  };

  const configurarHorario = () => {
    try {
      cronJobService.configurarHorario(novoHorario.hora, novoHorario.minuto);
      setInfoAgendamento(cronJobService.obterProximoAgendamento());
      alert('Horário configurado com sucesso!');
    } catch (error) {
      alert('Erro ao configurar horário: ' + error);
    }
  };

  const resetarNotificacaoCobranca = async (cobrancaId: string) => {
    if (confirm('Tem certeza que deseja resetar as notificações desta cobrança?')) {
      try {
        await automacaoNotificacaoService.resetarNotificacoes(cobrancaId);
        alert('Notificações resetadas com sucesso!');
        // Reexecuta a verificação para atualizar os dados
        executarVerificacao();
      } catch (error) {
        alert('Erro ao resetar notificações: ' + error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-2">🤖 Automação de Notificações</h2>
        <p className="text-gray-600">
          Sistema automático de notificações para cobranças em aberto baseado em marcos temporais (3, 7, 15 e 30 dias)
        </p>
      </div>

      {/* Status do Agendador */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📅 Status do Agendador</h3>
          <button
            onClick={alternarAgendador}
            className={`px-4 py-2 rounded font-medium ${
              infoAgendamento.estaAtivo
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {infoAgendamento.estaAtivo ? '⏸️ Parar' : '▶️ Iniciar'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Status</div>
            <div className={`font-semibold ${infoAgendamento.estaAtivo ? 'text-green-600' : 'text-red-600'}`}>
              {infoAgendamento.estaAtivo ? '🟢 Ativo' : '🔴 Inativo'}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Próxima Execução</div>
            <div className="font-semibold">
              {infoAgendamento.proximaExecucao
                ? infoAgendamento.proximaExecucao.toLocaleString('pt-BR')
                : 'Não agendada'
              }
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Tempo Restante</div>
            <div className="font-semibold">{infoAgendamento.tempoRestante}</div>
          </div>
        </div>

        {/* Configuração de Horário */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium mb-2">Configurar Horário de Execução</h4>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm text-gray-600">Hora</label>
              <input
                type="number"
                min="0"
                max="23"
                value={novoHorario.hora}
                onChange={(e) => setNovoHorario(prev => ({ ...prev, hora: Number(e.target.value) }))}
                className="w-20 px-2 py-1 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Minuto</label>
              <input
                type="number"
                min="0"
                max="59"
                value={novoHorario.minuto}
                onChange={(e) => setNovoHorario(prev => ({ ...prev, minuto: Number(e.target.value) }))}
                className="w-20 px-2 py-1 border rounded"
              />
            </div>
            <button
              onClick={configurarHorario}
              className="px-4 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Controles Manuais */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">🔧 Controles Manuais</h3>
        
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={executarVerificacao}
              disabled={executando || executandoEnvios}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {executando ? '🔄 Executando...' : '▶️ Executar Verificação Manual'}
            </button>

            {resultado && resultado.total_para_notificar > 0 && (
              <button
                onClick={executarFluxoCompleto}
                disabled={executando || executandoEnvios}
                className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {executandoEnvios ? '📤 Enviando...' : `🚀 Disparar ${resultado.total_para_notificar} Notificações`}
              </button>
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>ℹ️ Como funciona:</strong></p>
            <p>• <strong>Verificação Manual:</strong> Analisa cobranças e identifica quais precisam de notificação (sem envio)</p>
            <p>• <strong>Disparar Notificações:</strong> Executa envios reais via WhatsApp (n8n) e Email</p>
            <p>• Sistema verifica cobranças com status "em_aberto" há 3, 7, 15 ou 30 dias</p>
            <p>• Para CNPJs busca automaticamente o franqueado principal da unidade</p>
            <p>• Controla travas para evitar envios duplicados</p>
          </div>
        </div>
      </div>

      {/* Resultado dos Envios */}
      {resultadoEnvio && (
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-lg font-semibold mb-4 text-green-700">📤 Resultado dos Disparos</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{resultadoEnvio.total_processadas}</div>
              <div className="text-sm text-blue-700">Processadas</div>
            </div>
            <div className="bg-green-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-600">{resultadoEnvio.whatsapp_enviados}</div>
              <div className="text-sm text-green-700">📱 WhatsApp</div>
            </div>
            <div className="bg-purple-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-purple-600">{resultadoEnvio.emails_enviados}</div>
              <div className="text-sm text-purple-700">📧 Emails</div>
            </div>
            <div className="bg-red-50 p-4 rounded text-center">
              <div className="text-2xl font-bold text-red-600">{resultadoEnvio.erros.length}</div>
              <div className="text-sm text-red-700">❌ Erros</div>
            </div>
          </div>

          {/* Detalhes dos envios */}
          {resultadoEnvio.detalhes.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-3">✅ Notificações Enviadas:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultadoEnvio.detalhes.map((detalhe) => (
                  <div key={detalhe.cobranca_id} className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <div>
                      <div className="font-medium text-green-800">{detalhe.nome_franqueado}</div>
                      <div className="text-sm text-green-600">{detalhe.unidade} • Marco: {detalhe.marco} dias</div>
                    </div>
                    <div className="flex gap-2">
                      {detalhe.whatsapp_enviado && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">📱 WhatsApp ✅</span>
                      )}
                      {detalhe.email_enviado && (
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">📧 Email ✅</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erros */}
          {resultadoEnvio.erros.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-red-600">❌ Erros Encontrados:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {resultadoEnvio.erros.map((erro, index) => (
                  <div key={index} className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="text-sm text-red-700">
                      <strong>Cobrança {erro.cobranca_id}</strong> ({erro.canal}): {erro.erro}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem de sucesso quando não há erros */}
          {resultadoEnvio.erros.length === 0 && resultadoEnvio.detalhes.length > 0 && (
            <div className="text-center py-4">
              <div className="text-green-600 font-medium">
                🎉 Todos os disparos foram executados com sucesso!
              </div>
            </div>
          )}

          {/* Quando não há nada para processar */}
          {resultadoEnvio.total_processadas === 0 && (
            <div className="text-center py-4 text-gray-500">
              ℹ️ Nenhuma cobrança precisava de notificação no momento
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">📊 Resultado da Última Verificação</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">{resultado.total_analisadas}</div>
              <div className="text-sm text-blue-700">Cobranças Analisadas</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">{resultado.total_para_notificar}</div>
              <div className="text-sm text-green-700">Precisam de Notificação</div>
            </div>
          </div>

          {resultado.cobrancas.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Cobranças Identificadas para Notificação:</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {resultado.cobrancas.map((cobranca) => (
                  <div key={cobranca.id} className="border rounded p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{cobranca.cliente}</div>
                        <div className="text-sm text-gray-600">ID: {cobranca.id}</div>
                        <div className="text-sm text-gray-600">
                          {cobranca.cnpj ? `CNPJ: ${cobranca.cnpj}` : `CPF: ${cobranca.cpf}`}
                        </div>
                        
                        {/* Informações do franqueado principal */}
                        {cobranca.franqueado_principal ? (
                          <div className="mt-2 p-2 bg-blue-50 rounded">
                            <div className="text-sm font-medium text-blue-700">
                              📋 Franqueado Principal: {cobranca.franqueado_principal.nome_completo}
                            </div>
                            {cobranca.franqueado_principal.email && (
                              <div className="text-xs text-blue-600">
                                📧 {cobranca.franqueado_principal.email}
                              </div>
                            )}
                            {cobranca.franqueado_principal.telefone && (
                              <div className="text-xs text-blue-600">
                                📱 {cobranca.franqueado_principal.telefone}
                              </div>
                            )}
                            {cobranca.unidade && (
                              <div className="text-xs text-blue-600">
                                🏢 Unidade: {cobranca.unidade.nome_unidade}
                              </div>
                            )}
                          </div>
                        ) : cobranca.cnpj ? (
                          <div className="mt-2 p-2 bg-orange-50 rounded">
                            <div className="text-sm text-orange-700">
                              ⚠️ Franqueado principal não encontrado para este CNPJ
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <button
                        onClick={() => cobranca.id && resetarNotificacaoCobranca(cobranca.id)}
                        disabled={!cobranca.id}
                        className="px-2 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded disabled:opacity-50"
                        title="Resetar notificações desta cobrança"
                      >
                        🔄 Reset
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Valor:</span>
                        <div className="font-medium">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(cobranca.valor_atualizado || cobranca.valor_original)}
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-600">Dias em aberto:</span>
                        <div className="font-medium">{cobranca.dias_desde_criacao} dias</div>
                      </div>

                      <div>
                        <span className="text-gray-600">Próximo marco:</span>
                        <div className="font-medium">{cobranca.proximo_marco} dias</div>
                      </div>

                      <div>
                        <span className="text-gray-600">Canais:</span>
                        <div className="flex gap-1">
                          {cobranca.deve_notificar_whatsapp && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">📱 WhatsApp</span>
                          )}
                          {cobranca.deve_notificar_email && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">📧 Email</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado.cobrancas.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              ✅ Nenhuma cobrança precisa de notificação no momento
            </div>
          )}
        </div>
      )}
    </div>
  );
}
