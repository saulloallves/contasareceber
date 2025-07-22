import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { processarPlanilhaExcel, processarPlanilhaXML } from '../utils/planilhaProcessor';
import { CobrancaService } from '../services/cobrancaService';
import { ResultadoImportacao } from '../types/cobranca';

export function ImportacaoPlanilha() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [usuario] = useState('admin'); // Em produção, pegar do contexto de autenticação

  const cobrancaService = new CobrancaService();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setArquivo(file);
      setResultado(null);
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