import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import { processarPlanilhaExcel, processarPlanilhaXML } from '../utils/planilhaProcessor';
import { CobrancaService } from '../services/cobrancaService';
import { ResultadoImportacao } from '../types/cobranca';
import { comparacaoPlanilhaService, ResultadoComparacao } from '../services/comparacaoPlanilhaService';

export function ImportacaoPlanilha() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [resultadoComparacao, setResultadoComparacao] = useState<ResultadoComparacao | null>(null);
  const [modalComparacaoAberto, setModalComparacaoAberto] = useState(false);
  const [usuario] = useState('admin'); // Em produção, pegar do contexto de autenticação

  const cobrancaService = new CobrancaService();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setArquivo(file);
      setResultado(null);
      setResultadoComparacao(null);
    }
  };

  const compararComUltimaPlanilha = async () => {
    if (!arquivo) return;

    setProcessando(true);
    setResultadoComparacao(null);

    try {
      let dadosPlanilha;

      // Processa baseado na extensão do arquivo
      if (arquivo.name.toLowerCase().endsWith('.xlsx')) {
        dadosPlanilha = await processarPlanilhaExcel(arquivo);
      } else if (arquivo.name.toLowerCase().endsWith('.xml')) {
        dadosPlanilha = await processarPlanilhaXML(arquivo);
      } else {
        throw new Error('Formato de arquivo não suportado. Use .xlsx ou .xml');
      }

      // Compara com a última planilha
      const resultadoComp = await cobrancaService.compararComUltimaPlanilha(dadosPlanilha);
      setResultadoComparacao(resultadoComp);
      setModalComparacaoAberto(true);

    } catch (error) {
      setResultado({
        sucesso: false,
        importacao_id: '',
        estatisticas: {
          total_registros: 0,
          novos_registros: 0,
          registros_atualizados: 0,
          registros_quitados: 0
        },
        erros: [String(error)]
      });
    } finally {
      setProcessando(false);
    }
  };

  const processarArquivo = async () => {
    if (!arquivo) return;

    setProcessando(true);
    setResultado(null);

    try {
      let dadosPlanilha;

      // Processa baseado na extensão do arquivo
      if (arquivo.name.toLowerCase().endsWith('.xlsx')) {
        dadosPlanilha = await processarPlanilhaExcel(arquivo);
      } else if (arquivo.name.toLowerCase().endsWith('.xml')) {
        dadosPlanilha = await processarPlanilhaXML(arquivo);
      } else {
        throw new Error('Formato de arquivo não suportado. Use .xlsx ou .xml');
      }

      // Processa a importação
      const resultado = await cobrancaService.processarImportacaoPlanilha(
        dadosPlanilha,
        arquivo.name,
        usuario
      );

      setResultado(resultado);

      // Executa verificação de acionamento jurídico se a importação foi bem-sucedida
      if (resultado.sucesso) {
        await cobrancaService.verificarAcionamentoJuridico(resultado.importacao_id);
      }
    } catch (error) {
      setResultado({
        sucesso: false,
        importacao_id: '',
        estatisticas: {
          total_registros: 0,
          novos_registros: 0,
          registros_atualizados: 0,
          registros_quitados: 0
        },
        erros: [String(error)]
      });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center mb-6">
          <FileSpreadsheet className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">
            Importação Automatizada de Planilha
          </h1>
        </div>

        {/* Upload de Arquivo */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione a planilha (.xlsx ou .xml)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <input
              type="file"
              accept=".xlsx,.xml"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
            >
              Clique para selecionar arquivo
            </label>
            <p className="text-gray-500 text-sm mt-2">
              Formatos suportados: Excel (.xlsx) e XML (.xml)
            </p>
          </div>

          {arquivo && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    {arquivo.name}
                  </span>
                  <span className="text-sm text-blue-600 ml-2">
                    ({(arquivo.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={compararComUltimaPlanilha}
                    disabled={processando}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {processando ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Comparando...
                      </>
                    ) : (
                      'Comparar com Última'
                    )}
                  </button>
                  <button
                    onClick={processarArquivo}
                    disabled={processando}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {processando ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Processar Planilha'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resultado da Importação */}
        {resultado && (
          <div className="mb-8">
            <div className={`p-6 rounded-lg ${
              resultado.sucesso ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center mb-4">
                {resultado.sucesso ? (
                  <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                )}
                <h3 className={`text-lg font-semibold ${
                  resultado.sucesso ? 'text-green-800' : 'text-red-800'
                }`}>
                  {resultado.sucesso ? 'Importação Concluída com Sucesso' : 'Erro na Importação'}
                </h3>
              </div>

              {resultado.sucesso && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {resultado.estatisticas.total_registros}
                    </div>
                    <div className="text-sm text-gray-600">Total de Registros</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {resultado.estatisticas.novos_registros}
                    </div>
                    <div className="text-sm text-gray-600">Novos Registros</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {resultado.estatisticas.registros_atualizados}
                    </div>
                    <div className="text-sm text-gray-600">Atualizados</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">
                      {resultado.estatisticas.registros_quitados}
                    </div>
                    <div className="text-sm text-gray-600">Quitados</div>
                  </div>
                </div>
              )}

              {resultado.erros && resultado.erros.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-800 mb-2">Erros encontrados:</h4>
                  <div className="bg-white rounded-lg p-4 max-h-40 overflow-y-auto">
                    {resultado.erros.map((erro, index) => (
                      <div key={index} className="text-sm text-red-700 mb-1">
                        • {erro}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Comparação */}
        {modalComparacaoAberto && resultadoComparacao && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Resultado da Comparação
                </h3>
                <button
                  onClick={() => setModalComparacaoAberto(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Status da Comparação */}
              <div className="mb-6">
                {resultadoComparacao.tem_diferencas ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                      <div>
                        <h4 className="font-semibold text-yellow-800">
                          Diferenças Encontradas
                        </h4>
                        <p className="text-yellow-700">
                          {resultadoComparacao.total_diferencas} diferenças encontradas em relação à última importação
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                      <div>
                        <h4 className="font-semibold text-green-800">
                          Planilhas Idênticas
                        </h4>
                        <p className="text-green-700">
                          Nenhuma diferença encontrada entre a nova planilha e a última importação
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Resumo das Diferenças */}
              {resultadoComparacao.tem_diferencas && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">{resultadoComparacao.resumo.novos}</div>
                    <div className="text-sm text-green-800">Novos Registros</div>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-yellow-600">{resultadoComparacao.resumo.alterados}</div>
                    <div className="text-sm text-yellow-800">Registros Alterados</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-600">{resultadoComparacao.resumo.removidos}</div>
                    <div className="text-sm text-red-800">Registros Removidos</div>
                  </div>
                </div>
              )}

              {/* Informações da Última Importação */}
              {resultadoComparacao.ultima_importacao && (
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Comparado com:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Data:</span> {new Date(resultadoComparacao.ultima_importacao.data).toLocaleString('pt-BR')}
                    </div>
                    <div>
                      <span className="font-medium">Arquivo:</span> {resultadoComparacao.ultima_importacao.arquivo}
                    </div>
                    <div>
                      <span className="font-medium">Usuário:</span> {resultadoComparacao.ultima_importacao.usuario}
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-3">
                {resultadoComparacao.tem_diferencas && (
                  <>
                    <button
                      onClick={() => {
                        // Gera e baixa relatório de comparação
                        const relatorio = comparacaoPlanilhaService.gerarRelatorioComparacao(resultadoComparacao);
                        const blob = new Blob([relatorio], { type: 'text/plain;charset=utf-8' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `comparacao-planilha-${new Date().toISOString().split('T')[0]}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Baixar Relatório
                    </button>
                    <button
                      onClick={() => {
                        setModalComparacaoAberto(false);
                        processarArquivo(); // Processa a planilha após ver as diferenças
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Prosseguir com Importação
                    </button>
                  </>
                )}
                <button
                  onClick={() => setModalComparacaoAberto(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Instruções para Importação
          </h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Campos obrigatórios:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>cliente_de_cobranca</code> - Nome da unidade/franqueado</li>
              <li><code>cnpj</code> - CNPJ da unidade (14 dígitos)</li>
              <li><code>valor_original</code> - Valor da cobrança</li>
              <li><code>data_vencimento</code> - Data de vencimento (DD/MM/YYYY ou YYYY-MM-DD)</li>
            </ul>
            <p><strong>Campos opcionais:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>tipo_cobranca</code> - royalty, insumo, aluguel, multa (padrão: royalty)</li>
              <li><code>data_vencimento_original</code> - Data original de vencimento</li>
              <li><code>descricao</code> - Descrição da cobrança</li>
              <li><code>email_cobranca</code> - Email para envio de notificações</li>
            </ul>
            <p><strong>Processamento automático:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Cálculo automático de juros e multa baseado nas configurações</li>
              <li>Comparação inteligente para evitar duplicatas</li>
              <li>Marcação automática como "quitado" para cobranças que saíram da planilha</li>
              <li>Verificação automática de critérios para acionamento jurídico</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}