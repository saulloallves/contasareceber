import { useState, useEffect } from "react";
import { ScoreRiscoService } from "../services/scoreRiscoService";
import { Scale, AlertTriangle, CheckCircle, XCircle, RefreshCw, FileText } from "lucide-react";
import { formatarMoeda, formatarCNPJCPF } from "../utils/formatters";

interface UnidadeElegivel {
  cnpj: string;
  nome_franqueado: string;
  valor_total_aberto: number;
  score_atual: number;
  cobrancas_ignoradas: number;
  tem_acordo_descumprido: boolean;
  tem_reincidencia: boolean;
  atende_criterios: boolean;
}

export function CriteriosJuridico() {
  const [unidadesElegiveis, setUnidadesElegiveis] = useState<UnidadeElegivel[]>([]);
  const [unidadesScoreZero, setUnidadesScoreZero] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoElegiveis, setCarregandoElegiveis] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"criterios" | "elegiveis" | "score-zero">("criterios");

  const scoreRiscoService = new ScoreRiscoService();

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [elegiveis, scoreZero] = await Promise.all([
        scoreRiscoService.listarUnidadesElegiveis(),
        scoreRiscoService.listarUnidadesScoreZero()
      ]);
      
      setUnidadesElegiveis(elegiveis);
      setUnidadesScoreZero(scoreZero);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarElegiveis = async () => {
    setCarregandoElegiveis(true);
    try {
      const elegiveis = await scoreRiscoService.listarUnidadesElegiveis();
      setUnidadesElegiveis(elegiveis);
    } catch (error) {
      console.error("Erro ao carregar unidades elegíveis:", error);
    } finally {
      setCarregandoElegiveis(false);
    }
  };

  const renderCriterios = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
          <Scale className="w-5 h-5 mr-2" />
          Critérios para Acionamento Jurídico Automático
        </h3>
        
        <div className="space-y-4 text-sm">
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <h4 className="font-medium text-blue-700 mb-2">📊 Critérios Obrigatórios (TODOS devem ser atendidos):</h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <strong>Valor em aberto superior a R$ 5.000,00</strong>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <strong>3 ou mais cobranças ignoradas em 15 dias</strong>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <strong>Score de risco igual a zero</strong>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-4 border border-yellow-100">
            <h4 className="font-medium text-yellow-700 mb-2">⚠️ Critérios Adicionais (pelo menos UM deve ser atendido):</h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                <strong>Acordo firmado e descumprido</strong>
              </li>
              <li className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                <strong>Reincidência em período de 6 meses</strong>
              </li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-700 mb-2">🚨 Processo de Acionamento:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Sistema valida automaticamente todos os critérios</li>
              <li>Envia notificação extrajudicial via e-mail e WhatsApp</li>
              <li>Atualiza status da cobrança para "judicial"</li>
              <li>Registra escalonamento na base jurídica</li>
              <li>Cobrança aparece no painel jurídico para acompanhamento</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {unidadesElegiveis.filter(u => u.atende_criterios).length}
          </div>
          <div className="text-sm text-green-700">Unidades Elegíveis</div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {unidadesScoreZero.length}
          </div>
          <div className="text-sm text-yellow-700">Unidades Score Zero</div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatarMoeda(
              unidadesElegiveis
                .filter(u => u.atende_criterios)
                .reduce((total, u) => total + u.valor_total_aberto, 0)
            )}
          </div>
          <div className="text-sm text-blue-700">Valor Total Elegível</div>
        </div>
      </div>
    </div>
  );

  const renderUnidadesElegiveis = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Unidades Elegíveis para Acionamento Jurídico
        </h3>
        <button
          onClick={carregarElegiveis}
          disabled={carregandoElegiveis}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${carregandoElegiveis ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor em Aberto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cobranças Ignoradas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Critérios Adicionais
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {carregandoElegiveis ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                    Verificando critérios...
                  </div>
                </td>
              </tr>
            ) : unidadesElegiveis.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Nenhuma unidade encontrada
                </td>
              </tr>
            ) : (
              unidadesElegiveis.map((unidade) => (
                <tr key={unidade.cnpj} className={unidade.atende_criterios ? "bg-green-50" : "bg-gray-50"}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {unidade.atende_criterios ? (
                      <CheckCircle className="w-5 h-5 text-green-600" title="Atende todos os critérios" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" title="Não atende todos os critérios" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {unidade.nome_franqueado}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatarCNPJCPF(unidade.cnpj)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-red-600">
                      {formatarMoeda(unidade.valor_total_aberto)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      unidade.score_atual === 0 
                        ? "bg-red-100 text-red-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {unidade.score_atual}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      unidade.cobrancas_ignoradas >= 3 
                        ? "bg-red-100 text-red-800" 
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {unidade.cobrancas_ignoradas}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {unidade.tem_acordo_descumprido && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Acordo Quebrado
                        </span>
                      )}
                      {unidade.tem_reincidencia && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          Reincidente
                        </span>
                      )}
                      {!unidade.tem_acordo_descumprido && !unidade.tem_reincidencia && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Nenhum
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUnidadesScoreZero = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">
        Unidades com Score de Risco Zero
      </h3>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Estas unidades possuem score zero e podem ser candidatas ao acionamento jurídico 
          se atenderem aos demais critérios.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nível de Risco
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Atualização
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unidadesScoreZero.map((unidade) => (
              <tr key={unidade.cnpj_unidade}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {unidade.nome_franqueado}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatarCNPJCPF(unidade.cnpj_unidade)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    {unidade.score_atual}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    unidade.nivel_risco === "alto" ? "bg-red-100 text-red-800" :
                    unidade.nivel_risco === "medio" ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {unidade.nivel_risco.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(unidade.ultima_atualizacao).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Critérios de Acionamento Jurídico
              </h1>
              <p className="text-gray-600">
                Gerenciamento dos critérios automáticos para escalonamento jurídico
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={carregarDados}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setAbaAtiva("criterios")}
            className={`px-4 py-2 font-medium ${
              abaAtiva === "criterios"
                ? "border-b-2 border-red-500 text-red-600"
                : "text-gray-500"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Critérios
          </button>
          <button
            onClick={() => setAbaAtiva("elegiveis")}
            className={`px-4 py-2 font-medium ${
              abaAtiva === "elegiveis"
                ? "border-b-2 border-red-500 text-red-600"
                : "text-gray-500"
            }`}
          >
            <CheckCircle className="w-4 h-4 inline mr-2" />
            Unidades Elegíveis ({unidadesElegiveis.filter(u => u.atende_criterios).length})
          </button>
          <button
            onClick={() => setAbaAtiva("score-zero")}
            className={`px-4 py-2 font-medium ${
              abaAtiva === "score-zero"
                ? "border-b-2 border-red-500 text-red-600"
                : "text-gray-500"
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Score Zero ({unidadesScoreZero.length})
          </button>
        </div>

        {/* Conteúdo das abas */}
        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-600">Carregando dados...</span>
          </div>
        ) : (
          <div>
            {abaAtiva === "criterios" && renderCriterios()}
            {abaAtiva === "elegiveis" && renderUnidadesElegiveis()}
            {abaAtiva === "score-zero" && renderUnidadesScoreZero()}
          </div>
        )}
      </div>
    </div>
  );
}
