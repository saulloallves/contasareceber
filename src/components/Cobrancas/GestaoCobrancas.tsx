/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Eye,
  Upload,
  MessageSquare,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  RefreshCw,
  FileText,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { CobrancaFranqueado } from "../../types/cobranca";
import { cobrancaService } from "../../services/cobrancaService";
import {
  processarPlanilhaExcel,
  processarPlanilhaXML,
} from "../../utils/planilhaProcessor";
import type { ResultadoImportacao } from "../../types/cobranca";
import {
  formatarCNPJCPF,
  formatarMoeda,
  formatarData,
} from "../../utils/formatters"; // Importando a função de formatação de CNPJ/CPF

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
  const [colunaOrdenacao, setColunaOrdenacao] = useState("data_vencimento"); // Coluna padrão
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState("desc"); // Ordenação 'asc' ou 'desc'
  const [mostrarApenasInadimplentes, setMostrarApenasInadimplentes] =
    useState(false); // Controlar a exibição de inadimplentes
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [modalErrosAberto, setModalErrosAberto] = useState(false);

  // Carrega as cobranças ao montar o componente e quando os filtros ou ordenação mudam
  useEffect(() => {
    carregarCobrancas();
  }, [filtros, colunaOrdenacao, direcaoOrdenacao, mostrarApenasInadimplentes]);

  /**
   * Função para carregar as cobranças do serviço
   * Ela aplica os filtros e ordenação definidos pelo usuário
   */
  const carregarCobrancas = async () => {
    setCarregando(true);
    try {
      const dadosReaisDoBanco = await cobrancaService.buscarCobrancas({
        ...filtros,
        colunaOrdenacao,
        direcaoOrdenacao,
        apenasInadimplentes: mostrarApenasInadimplentes, // Linha adicionada para filtrar apenas inadimplentes
      });
      setCobrancas(dadosReaisDoBanco);
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
      // Em caso de erro, a lista vai ser limpa e mostrar uma mensagem
      alert("Erro ao carregar cobranças. Tente novamente mais tarde.");
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Função para abrir o modal de criação
   */
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

  /**
   * Função para abrir o modal de edição
   */
  const abrirModalEditar = (cobranca: CobrancaFranqueado) => {
    setCobrancaSelecionada(cobranca);
    setFormData(cobranca);
    setModalAberto("editar");
  };

  /**
   * Função para fechar o modal e limpar os dados do formulário
   */
  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setFormData({});
  };

  /**
   * Função para limpar o arquivo selecionado
   * Isso é útil para permitir que o usuário selecione o mesmo arquivo novamente
   */
  const LimparArquivo = () => {
    setArquivoSelecionado(null); // Limpa o arquivo selecionado
    // Limpa o input de arquivo para permitir novo upload, isso é necessário para que o usuário possa selecionar o mesmo arquivo novamente
    const input = document.getElementById("file-upload") as HTMLInputElement;
    if (input) {
      input.value = ""; // Limpa o valor do input de arquivo
    }
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

  /**
   * Função para validar a planilha selecionada sem salvar no banco
   * Ela processa a planilha e verifica se há erros, mas não salva nada no banco
   */
  const handleValidarPlanilha = async () => {
    if (!arquivoSelecionado) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setProcessando(true);
    setErrosImportacao([]); // Limpa erros antigos

    try {
      const dadosDaPlanilha = await processarPlanilhaExcel(arquivoSelecionado);

      // Chama o mesmo serviço, mas com o parâmetro 'apenasValidar' como true
      const resultadoValidacao =
        await cobrancaService.processarImportacaoPlanilha(
          dadosDaPlanilha,
          arquivoSelecionado.name,
          usuario,
          true // <-- O novo parâmetro 'apenasValidar'
        );

      // Se houver erros, guardamos e avisamos o usuário
      if (resultadoValidacao.erros && resultadoValidacao.erros.length > 0) {
        setErrosImportacao(resultadoValidacao.erros);
        alert(
          `Validação concluída. Foram encontrados ${resultadoValidacao.erros.length} problemas. Clique em "Verificar Erros" para ver os detalhes.`
        );
      } else {
        alert(
          "Validação concluída. Nenhum erro encontrado! A planilha está pronta para ser importada."
        );
      }
    } catch (error: any) {
      console.error("ERRO CRÍTICO ao validar a planilha:", error);
      const erroMsg = error.message || "Ocorreu um erro inesperado.";
      setErrosImportacao([`Erro crítico: ${erroMsg}`]);
      alert(
        `Ocorreu um erro crítico durante a validação. Clique em "Verificar Erros" para ver os detalhes.`
      );
    } finally {
      setProcessando(false);
      // Não fechamos o modal para que o usuário possa processar de verdade
    }
  };

  /**
   * Função para processar a planilha selecionada
   * Ela verifica o tipo de arquivo e chama a função apropriada para processar os dados
   */
  const handleProcessarPlanilha = async () => {
    if (!arquivoSelecionado) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setProcessando(true);
    setResultado(null);
    setErrosImportacao([]); // Limpa os erros antigos antes de processar uma nova planilha

    try {
      console.log("Iniciando processamento da planilha...");
      let dadosDaPlanilha;

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
        // Verificação de segurança para o ID da importação
        if (resultadoImportacao.importacao_id) {
          await cobrancaService.verificarAcionamentoJuridico(
            resultadoImportacao.importacao_id
          );
        }
        // Uso de optional chaining para segurança!
        const sucessoMsg = `Planilha processada com sucesso! ${
          resultadoImportacao.estatisticas?.novos_registros ?? 0
        } novos registros foram criados.`;
        alert(sucessoMsg);
      } else {
        if (resultadoImportacao.erros && resultadoImportacao.erros.length > 0) {
          setErrosImportacao(resultadoImportacao.erros);
          alert(
            `A importação foi concluída, mas foram encontrados ${resultadoImportacao.erros.length} erros. Clique em "Verificar Erros" para ver os detalhes.`
          );
        } else {
          alert("A importação falhou por um motivo desconhecido!");
        }
      }
    } catch (error: any) {
      // Tratamento de erros críticos
      console.error("ERRO CRÍTICO ao processar a planilha:", error);
      const erroMsg = error.message || "Ocorreu um erro inesperado.";
      setErrosImportacao([`Erro crítico: ${erroMsg}`]);
      setResultado({ sucesso: false, erros: [erroMsg] });
      alert(
        `Ocorreu um erro crítico. Clique em "Verificar Erros" para ver os detalhes.`
      );
    } finally {
      carregarCobrancas();
      fecharModal();
      LimparArquivo(); // Limpa o arquivo selecionado após o processamento
      setProcessando(false);
    }
  };

  /**
   * Função para lidar com a ordenação das colunas
   * Ela altera a direção da ordenação se a mesma coluna for clicada novamente
   */
  const handleOrdenacao = (coluna: string) => {
    // Se clicou na mesma coluna, inverte a direção. Senão, ordena de forma descendente.
    const novaDirecao =
      coluna === colunaOrdenacao && direcaoOrdenacao === "desc"
        ? "asc"
        : "desc";
    setColunaOrdenacao(coluna);
    setDirecaoOrdenacao(novaDirecao);
  };

  /**
   * Função para salvar a cobrança (criação ou edição)
   */
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

  /**
   * Função para enviar a cobrança via WhatsApp
   * (Falta a integração com o serviço de envio de mensagens, apenas um exemplo de como poderia ser implementado)
   */
  const enviarCobranca = async (cobranca: CobrancaFranqueado) => {
    try {
      console.log("Enviando cobrança via WhatsApp:", cobranca);
      alert("Cobrança enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar cobrança:", error);
    }
  };

  /**
   * Função para marcar a cobrança como quitada
   * (Falta a integração com o serviço de atualização de cobranças, apenas um exemplo de como poderia ser implementado)
   */
  const marcarQuitado = async (id: string) => {
    try {
      console.log("Marcando como quitado:", id);
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao marcar como quitado:", error);
    }
  };

  /**
   * Função para obter o ícone de status, conforme o status da cobrança
   */
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

  /**
   * Função para obter a cor de status, conforme o status da cobrança
   */
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

  return (
    <div className="max-w-full mx-auto p-6">
      {/* Fundo Branco */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          {/* Ícone e Título */}
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Receipt className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Gestão de Cobranças
              </h1>
              <p className="text-gray-600">
                Controle completo de débitos e recebimentos
              </p>
            </div>
          </div>
          {/* Botões de Ação */}
          <div className="flex space-x-3">
            {errosImportacao.length > 0 && (
              <button
                onClick={() => setModalErrosAberto(true)}
                className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 animate-pulse"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Verificar Erros da Última Importação
              </button>
            )}
            <button
              onClick={() => {
                setModalAberto("upload");
                setErrosImportacao([]); // Limpa os erros antigos ao tentar um novo upload
              }}
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
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-demibold text-gray-800">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <select
              value={filtros.status}
              onChange={(e) =>
                setFiltros({ ...filtros, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="em_aberto">Em Aberto</option>
              <option value="negociando">Negociando</option>
              <option value="quitado">Quitado</option>
            </select>
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) =>
                setFiltros({ ...filtros, busca: e.target.value })
              }
              placeholder="Buscar cliente/CNPJ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) =>
                setFiltros({ ...filtros, dataInicio: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) =>
                setFiltros({ ...filtros, dataFim: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={filtros.valorMin}
              onChange={(e) =>
                setFiltros({ ...filtros, valorMin: e.target.value })
              }
              placeholder="Valor mínimo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={filtros.valorMax}
              onChange={(e) =>
                setFiltros({ ...filtros, valorMax: e.target.value })
              }
              placeholder="Valor máximo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-4 ml-1 flex items-center">
            <input
              type="checkbox"
              id="inadimplentes-checkbox"
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={mostrarApenasInadimplentes}
              onChange={(e) => setMostrarApenasInadimplentes(e.target.checked)}
            />
            <label
              htmlFor="inadimplentes-checkbox"
              className="ml-2 block text-sm text-gray-900"
            >
              Mostrar apenas cobranças inadimplentes
            </label>
          </div>
        </div>

        {/* Tabela de Cobranças */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("cliente")}
                >
                  <div className="flex items-center">
                    <span>Cliente</span>
                    {/* Mostra a seta correspondente se esta for a coluna ativa */}
                    {colunaOrdenacao === "cliente" &&
                      (direcaoOrdenacao === "desc" ? (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      ) : (
                        <ArrowUp className="w-4 h-4 ml-2" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("valor_original")}
                >
                  <div className="flex items-center">
                    <span>Valor Original</span>
                    {colunaOrdenacao === "valor_original" &&
                      (direcaoOrdenacao === "desc" ? (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      ) : (
                        <ArrowUp className="w-4 h-4 ml-2" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("valor_atualizado")}
                >
                  <div className="flex items-center">
                    <span>Valor Atualizado</span>
                    {colunaOrdenacao === "valor_atualizado" &&
                      (direcaoOrdenacao === "desc" ? (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      ) : (
                        <ArrowUp className="w-4 h-4 ml-2" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("data_vencimento")}
                >
                  <div className="flex items-center">
                    <span>Vencimento</span>
                    {colunaOrdenacao === "data_vencimento" &&
                      (direcaoOrdenacao === "desc" ? (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      ) : (
                        <ArrowUp className="w-4 h-4 ml-2" />
                      ))}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleOrdenacao("status")}
                >
                  <div className="flex items-center">
                    <span>Status</span>
                    {colunaOrdenacao === "status" &&
                      (direcaoOrdenacao === "desc" ? (
                        <ArrowDown className="w-4 h-4 ml-2" />
                      ) : (
                        <ArrowUp className="w-4 h-4 ml-2" />
                      ))}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <span>Ações</span>
                  </div>
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
                          {formatarCNPJCPF(cobranca.cnpj)}
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
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
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
              {/*Botão de Validação*/}
              <button
                onClick={() => handleValidarPlanilha()} // Chama a nova função
                disabled={!arquivoSelecionado || processando}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? (
                  <span className="flex items-center">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Validando...
                  </span>
                ) : (
                  "Apenas Validar"
                )}
              </button>
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
      {/* Modal de Erros */}
      {modalErrosAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Erros Encontrados na Última Importação
              </h3>
              <button
                onClick={() => setModalErrosAberto(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <ul className="space-y-2 text-sm text-gray-700">
                {errosImportacao.map((erro, index) => (
                  <li
                    key={index}
                    className="p-2 bg-red-100 text-red-800 rounded-md"
                  >
                    {erro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end items-center mt-6">
              {/* Botão para Limpar os Erros (à esquerda) */}
              <button
                onClick={() => {
                  setErrosImportacao([]); // Limpa a lista de erros
                  setModalErrosAberto(false); // Fecha o modal
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                title="Limpa os erros da memória e esconde o botão de alerta."
              >
                Limpar Erros e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
