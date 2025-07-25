/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  MessageSquare,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  RefreshCw,
  FileText,
} from "lucide-react";
import { CobrancaFranqueado } from "../../types/cobranca";
import { cobrancaService } from "../../services/cobrancaService";
import {
  processarPlanilhaExcel,
  processarPlanilhaXML,
} from "../../utils/planilhaProcessor";
import type { ResultadoImportacao } from "../../types/cobranca";

export function GestaoCobrancas() {
  const [cobrancas, setCobrancas] = useState<CobrancaFranqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<
    "criar" | "editar" | "upload" | null
  >(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] =
    useState<CobrancaFranqueado | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(
    null
  ); //Linha adicionada para 'guardar' o arquivo selecionado
  const [processando, setProcessando] = useState(false); // Linha adicionada para controlar o estado de processamento do upload
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null); // Linha adicionada para armazenar o resultado do processamento da planilha
  const [usuario] = useState("admin"); // Em produção, pegar do contexto de autenticação
  const [formData, setFormData] = useState<Partial<CobrancaFranqueado>>({});
  const [filtros, setFiltros] = useState({
    status: "",
    busca: "",
    dataInicio: "",
    dataFim: "",
    valorMin: "",
    valorMax: "",
  });

  useEffect(() => {
    carregarCobrancas();
  }, [filtros]);

  const carregarCobrancas = async () => {
    setCarregando(true);
    try {
      const dadosReaisDoBanco = await cobrancaService.buscarCobrancas();
      setCobrancas(dadosReaisDoBanco);
      console.log("Cobrancas carregadas:", dadosReaisDoBanco); //Debugging
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
      // Em caso de erro, a lista vai ser limpa e mostrar uma mensagem
      alert("Erro ao carregar cobranças. Tente novamente mais tarde.");
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalCriar = () => {
    setFormData({
      cnpj: "",
      cliente: "",
      valor_original: 0,
      valor_recebido: 0,
      data_vencimento: "",
      status: "em_aberto",
    });
    setModalAberto("criar");
  };

  const abrirModalEditar = (cobranca: CobrancaFranqueado) => {
    setCobrancaSelecionada(cobranca);
    setFormData(cobranca);
    setModalAberto("editar");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setFormData({});
  };

  /**
   * Função para lidar com a seleção de arquivo
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Verifica se o usuário selecionou algum arquivo
    if (event.target.files && event.target.files[0]) {
      const arquivo = event.target.files[0];
      setArquivoSelecionado(arquivo); // Guarda o arquivo no estado
    }
  };

  const LimparArquivo = () => {
    setArquivoSelecionado(null); // Limpa o arquivo selecionado
    // Limpa o input de arquivo para permitir novo upload, isso é necessário para que o usuário possa selecionar o mesmo arquivo novamente
    const input = document.getElementById("file-upload") as HTMLInputElement;
    if (input) {
      input.value = ""; // Limpa o valor do input de arquivo
    }
  };

  const handleProcessarPlanilha = async () => {
    if (!arquivoSelecionado) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
      console.log("Iniciando processamento da planilha...");
      let dadosDaPlanilha; // Renomeado para clareza

      // Lógica para identificar e processar o tipo de arquivo
      if (arquivoSelecionado.name.toLowerCase().endsWith(".xlsx")) {
        dadosDaPlanilha = await processarPlanilhaExcel(arquivoSelecionado);
      } else if (arquivoSelecionado.name.toLowerCase().endsWith(".csv")) {
        dadosDaPlanilha = await processarPlanilhaXML(arquivoSelecionado);
      } else {
        // Lançar um erro se o formato não for suportado é a melhor prática.
        throw new Error("Formato de arquivo não suportado. Use .xlsx ou .csv");
      }

      // Verificação de segurança: garante que a planilha foi lida com sucesso
      if (!dadosDaPlanilha) {
        throw new Error("Não foi possível extrair dados da planilha.");
      }

      console.log(
        `${dadosDaPlanilha.length} registros extraídos. Enviando para o serviço...`
      );

      // Chama o serviço de importação
      const resultadoImportacao =
        await cobrancaService.processarImportacaoPlanilha(
          dadosDaPlanilha,
          arquivoSelecionado.name,
          usuario
        );

      setResultado(resultadoImportacao);

      // Lógica para lidar com a resposta
      if (resultadoImportacao.sucesso) {
        // Uso de optional chaining para segurança!
        const sucessoMsg = `Planilha processada com sucesso! ${
          resultadoImportacao.estatisticas?.novos_registros ?? 0
        } novos registros foram criados.`;
        alert(sucessoMsg);

        // Verificação de segurança para o ID da importação
        if (resultadoImportacao.importacao_id) {
          await cobrancaService.verificarAcionamentoJuridico(
            resultadoImportacao.importacao_id
          );
        }

        // Limpeza final
        fecharModal();
        LimparArquivo();
        carregarCobrancas();
      } else {
        // Garante que a mensagem de erro funcione mesmo se 'erros' for undefined
        const errosStr =
          resultadoImportacao.erros?.join("\n") ||
          "Ocorreu um erro desconhecido durante a importação.";
        alert(`A importação terminou com erros:\n${errosStr}`);
      }
    } catch (error: any) {
      // Tratamento de erros críticos, como o seu, está perfeito.
      console.error("ERRO CRÍTICO ao processar a planilha:", error);
      const erroMsg = error.message || "Ocorreu um erro inesperado.";
      setResultado({ sucesso: false, erros: [erroMsg] });
      alert(`Ocorreu um erro crítico:\n${erroMsg}`);
    } finally {
      carregarCobrancas();
      fecharModal();
      LimparArquivo(); // Limpa o arquivo selecionado após o processamento
      setProcessando(false);
    }
  };

  const salvarCobranca = async () => {
    try {
      if (modalAberto === "criar") {
        console.log("Criando cobrança:", formData);
      } else {
        console.log("Editando cobrança:", formData);
      }
      fecharModal();
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao salvar cobrança:", error);
    }
  };

  const enviarCobranca = async (cobranca: CobrancaFranqueado) => {
    try {
      console.log("Enviando cobrança via WhatsApp:", cobranca);
      alert("Cobrança enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar cobrança:", error);
    }
  };

  const marcarQuitado = async (id: string) => {
    try {
      console.log("Marcando como quitado:", id);
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao marcar como quitado:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "quitado":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "negociando":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "em_aberto":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "quitado":
        return "bg-green-100 text-green-800";
      case "negociando":
        return "bg-yellow-100 text-yellow-800";
      case "em_aberto":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Gestão de Cobranças
          </h1>
          <p className="text-gray-600">
            Controle completo de débitos e recebimentos
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setModalAberto("upload")}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Planilha
          </button>
          <button
            onClick={abrirModalCriar}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Cobrança
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="bg-white rounded-xl shadow-lg p-5 border border-gray-100" style={{ margin: 15 }}>
        <div className="flex items-center mb-6">
          <div className="p-2 bg-green-100 rounded-lg mr-3">
            <Filter className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="em_aberto">Em Aberto</option>
            <option value="negociando">Negociando</option>
            <option value="quitado">Quitado</option>
          </select>
          <input
            type="text"
            value={filtros.busca}
            onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
            placeholder="Buscar cliente/CNPJ"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filtros.dataInicio}
            onChange={(e) =>
              setFiltros({ ...filtros, dataInicio: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filtros.dataFim}
            onChange={(e) =>
              setFiltros({ ...filtros, dataFim: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={filtros.valorMin}
            onChange={(e) =>
              setFiltros({ ...filtros, valorMin: e.target.value })
            }
            placeholder="Valor mínimo"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            value={filtros.valorMax}
            onChange={(e) =>
              setFiltros({ ...filtros, valorMax: e.target.value })
            }
            placeholder="Valor máximo"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabela de Cobranças */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Original
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Atualizado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                      Carregando cobranças...
                    </div>
                  </td>
                </tr>
              ) : cobrancas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              ) : (
                cobrancas.map((cobranca) => (
                  <tr key={cobranca.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {cobranca.cliente}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cobranca.cnpj}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarMoeda(cobranca.valor_original)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-red-600">
                        {formatarMoeda(
                          cobranca.valor_atualizado || cobranca.valor_original
                        )}
                      </div>
                      {cobranca.dias_em_atraso &&
                        cobranca.dias_em_atraso > 0 && (
                          <div className="text-xs text-red-500 font-medium">
                            {cobranca.dias_em_atraso} dias de atraso
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatarData(cobranca.data_vencimento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(cobranca.status)}
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            cobranca.status
                          )}`}
                        >
                          {cobranca.status.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => abrirModalEditar(cobranca)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {cobranca.telefone &&
                          cobranca.status === "em_aberto" && (
                            <button
                              onClick={() => enviarCobranca(cobranca)}
                              className="text-green-600 hover:text-green-900"
                              title="Enviar cobrança"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                        {cobranca.status === "em_aberto" && (
                          <button
                            onClick={() => marcarQuitado(cobranca.id!)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Marcar como quitado"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          title="Ver histórico"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação/Edição */}
      {(modalAberto === "criar" || modalAberto === "editar") && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                {modalAberto === "criar" ? "Nova Cobrança" : "Editar Cobrança"}
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ *
                </label>
                <input
                  type="text"
                  value={formData.cnpj || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <input
                  type="text"
                  value={formData.cliente || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cliente: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Original *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_original || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      valor_original: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  value={formData.data_vencimento || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      data_vencimento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.telefone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, telefone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarCobranca}
                disabled={
                  !formData.cnpj ||
                  !formData.cliente ||
                  !formData.valor_original
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {modalAberto === "criar"
                  ? "Criar Cobrança"
                  : "Salvar Alterações"}
              </button>
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload */}
      {modalAberto === "upload" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upload de Planilha</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {/* Exibe o arquivo selecionado, se houver */}
                {arquivoSelecionado ? (
                  <div className="flex items-center justify-center space-x-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <span className="text-gray-800">
                      {arquivoSelecionado.name}
                    </span>
                    <span className="text-gray-500">
                      ({(arquivoSelecionado.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Arraste o arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Formatos aceitos: .xlsx, .csv
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  id="file-upload"
                  onChange={handleFileChange} // Linha adicionada para lidar com o upload de arquivo
                />
                <label
                  htmlFor="file-upload"
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  {arquivoSelecionado ? "Trocar Arquivo" : "Selecionar Arquivo"}
                </label>
              </div>
            </div>

            <div className="flex justify-center space-x-6 mt-6 w-full">
              <button
                onClick={handleProcessarPlanilha} // Linha adicionada para processar o upload
                disabled={!arquivoSelecionado || processando} // Desabilita o botão se não houver arquivo ou se estiver processando
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Exibe o ícone de carregamento se estiver processando */}
                {processando ? (
                  <span className="flex items-center">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Processando...
                  </span>
                ) : (
                  "Processar Planilha"
                )}
              </button>
              <button
                onClick={() => {
                  if (processando) return; // Não permite fechar o modal enquanto processa
                  LimparArquivo(); // Limpa o arquivo selecionado
                  fecharModal(); // Fecha o modal
                }}
                disabled={processando} // Desabilita o botão se estiver processando
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
