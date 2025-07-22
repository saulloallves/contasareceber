import React, { useState, useEffect } from 'react';
import { Calendar, Download, FileText, TrendingUp, AlertCircle, Users, DollarSign, Target } from 'lucide-react';
import { RelatoriosService } from '../services/relatoriosService';
import type { RelatorioMensal, FiltroRelatorio } from '../types/relatorios';

export const RelatoriosMensais: React.FC = () => {
  const [relatorios, setRelatorios] = useState<RelatorioMensal[]>([]);
  const [filtros, setFiltros] = useState<FiltroRelatorio>({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });
  const [loading, setLoading] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);

  useEffect(() => {
    carregarRelatorios();
  }, [filtros]);

  const carregarRelatorios = async () => {
    setLoading(true);
    try {
      const dados = await RelatoriosService.listarRelatorios(filtros);
      setRelatorios(dados);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const gerarRelatorio = async () => {
    setGerandoRelatorio(true);
    try {
      await RelatoriosService.gerarRelatorioMensal(filtros.mes, filtros.ano);
      await carregarRelatorios();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const exportarRelatorio = async (relatorioId: string, formato: 'pdf' | 'xlsx') => {
    try {
      await RelatoriosService.exportarRelatorio(relatorioId, formato);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios Mensais</h1>
          <p className="text-gray-600">Relatórios estratégicos para reuniões e conselho</p>
        </div>
        <button
          onClick={gerarRelatorio}
          disabled={gerandoRelatorio}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {gerandoRelatorio ? 'Gerando...' : 'Gerar Relatório'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mês
            </label>
            <select
              value={filtros.mes}
              onChange={(e) => setFiltros({ ...filtros, mes: Number(e.target.value) })}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ano
            </label>
            <select
              value={filtros.ano}
              onChange={(e) => setFiltros({ ...filtros, ano: Number(e.target.value) })}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={2024 - i} value={2024 - i}>
                  {2024 - i}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Relatórios */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Carregando relatórios...</p>
          </div>
        ) : relatorios.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum relatório encontrado para o período selecionado</p>
          </div>
        ) : (
          relatorios.map((relatorio) => (
            <div key={relatorio.id} className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Relatório {relatorio.referencia_mes}
                  </h3>
                  <p className="text-gray-600">
                    Gerado em {new Date(relatorio.gerado_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportarRelatorio(relatorio.id, 'pdf')}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>
                  <button
                    onClick={() => exportarRelatorio(relatorio.id, 'xlsx')}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Excel
                  </button>
                </div>
              </div>

              {/* Resumo dos Dados */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Total Inadimplente</span>
                  </div>
                  <p className="text-lg font-bold text-blue-900">
                    R$ {relatorio.dados_consolidados.total_inadimplente?.toLocaleString('pt-BR') || '0'}
                  </p>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Taxa Recuperação</span>
                  </div>
                  <p className="text-lg font-bold text-green-900">
                    {relatorio.dados_consolidados.taxa_recuperacao?.toFixed(1) || '0'}%
                  </p>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-900">Unidades Críticas</span>
                  </div>
                  <p className="text-lg font-bold text-yellow-900">
                    {relatorio.dados_consolidados.unidades_criticas || 0}
                  </p>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">Acordos Ativos</span>
                  </div>
                  <p className="text-lg font-bold text-purple-900">
                    {relatorio.dados_consolidados.acordos_ativos || 0}
                  </p>
                </div>
              </div>

              {relatorio.observacoes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Observações:</strong> {relatorio.observacoes}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};