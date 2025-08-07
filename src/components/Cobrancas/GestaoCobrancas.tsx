/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Eye,
  Upload,
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
  Info,
  MessageCircle,
} from "lucide-react";
import { CobrancaFranqueado } from "../../types/cobranca";
import { cobrancaService } from "../../services/cobrancaService";
import { evolutionApiService } from "../../services/evolutionApiService";
import {
  processarPlanilhaExcel,
  processarPlanilhaXML,
} from "../../utils/planilhaProcessor";
import type { ResultadoImportacao } from "../../types/cobranca";
import type { ResultadoComparacao } from "../../services/comparacaoPlanilhaService";
import { comparacaoPlanilhaService } from "../../services/comparacaoPlanilhaService";
import {
  formatarCNPJCPF,
  formatarMoeda,
  formatarData,
} from "../../utils/formatters"; // Importando a função de formatação de CNPJ/CPF

export function GestaoCobrancas() {
  const [cobrancas, setCobrancas] = useState<CobrancaFranqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState<
    "criar" | "editar" | "upload" | "status" | "quitacao" | null
  >(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] =
    useState<CobrancaFranqueado | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(
    null
  ); //Linha adicionada para 'guardar' o arquivo selecionado
  const [processando, setProcessando] = useState(false); // Linha adicionada para controlar o estado de processamento do upload
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null); // Linha adicionada para armazenar o resultado do processamento da planilha
  const [resultadoComparacao, setResultadoComparacao] =
    useState<ResultadoComparacao | null>(null);
  const [modalComparacaoAberto, setModalComparacaoAberto] = useState(false);
  const [usuario] = useState("admin"); // Em produção, pegar do contexto de autenticação
  const [formData, setFormData] = useState<Partial<CobrancaFranqueado>>({});
  const [formQuitacao, setFormQuitacao] = useState({
    valorPago: 0,
    formaPagamento: "",
    observacoes: "",
    dataRecebimento: new Date().toISOString().split("T")[0],
  });
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
  const [mensagemFeedback, setMensagemFeedback] = useState<{
    tipo: "sucesso" | "erro" | "info";
    texto: string;
  } | null>(null);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState<string | null>(null); // ID da cobrança sendo enviada
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoEnvios, setHistoricoEnvios] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const mostrarMensagem = (
    tipo: "sucesso" | "erro" | "info",
    texto: string
  ) => {
    setMensagemFeedback({ tipo, texto });
    setTimeout(() => setMensagemFeedback(null), 5000);
  };

  /**
   * Função para carregar as cobranças do serviço
   * Ela aplica os filtros e ordenação definidos pelo usuário
   */
  const carregarCobrancas = useCallback(async () => {
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
  }, [filtros, colunaOrdenacao, direcaoOrdenacao, mostrarApenasInadimplentes]);

  // Função para abrir histórico de envios
  const abrirHistoricoEnvios = useCallback(async (cobrancaId: string) => {
    setCarregandoHistorico(true);
    setModalHistoricoAberto(true);

    try {
      const historico = await cobrancaService.buscarHistoricoEnvios(cobrancaId);
      setHistoricoEnvios(historico);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      setHistoricoEnvios([]);
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  // Carrega as cobranças ao montar o componente e quando os filtros ou ordenação mudam
  useEffect(() => {
    carregarCobrancas();
  }, [carregarCobrancas]);

  useEffect(() => {
    // Função que será chamada quando o evento for disparado
    const handleAtualizacao = () => {
      console.log(
        "Evento 'cobrancasAtualizadas' recebido! Recarregando cobranças..."
      );
      carregarCobrancas();
    };

    // Adiciona o "ouvinte" de eventos
    window.addEventListener("cobrancasAtualizadas", handleAtualizacao);

    // Função de limpeza: remove o "ouvinte" quando o componente for desmontado
    // Isso é MUITO importante para evitar vazamentos de memória.
    return () => {
      window.removeEventListener("cobrancasAtualizadas", handleAtualizacao);
    };
  }, [carregarCobrancas]); // Adiciona carregarCobrancas como dependência

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
   * Função para comparar com a última planilha salva
   */
  const handleCompararPlanilha = async () => {
    if (!arquivoSelecionado) {
      alert("Por favor, selecione um arquivo primeiro.");
      return;
    }

    setProcessando(true);
    setResultadoComparacao(null);

    try {
      console.log("Iniciando comparação com última planilha...");
      let dadosDaPlanilha;

      // Processa o arquivo selecionado
      if (arquivoSelecionado.name.toLowerCase().endsWith(".xlsx")) {
        dadosDaPlanilha = await processarPlanilhaExcel(arquivoSelecionado);
      } else if (arquivoSelecionado.name.toLowerCase().endsWith(".csv")) {
        dadosDaPlanilha = await processarPlanilhaXML(arquivoSelecionado);
      } else {
        throw new Error("Formato de arquivo não suportado. Use .xlsx ou .csv");
      }

      if (!dadosDaPlanilha) {
        throw new Error("Não foi possível extrair dados da planilha.");
      }

      console.log(
        `${dadosDaPlanilha.length} registros extraídos. Comparando...`
      );

      // Chama o serviço de comparação
      const resultadoComp = await cobrancaService.compararComUltimaPlanilha(
        dadosDaPlanilha
      );
      setResultadoComparacao(resultadoComp);
      setModalComparacaoAberto(true);
    } catch (error: any) {
      console.error("ERRO ao comparar planilhas:", error);
      alert(`Erro ao comparar planilhas: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  /**
   * Função para processar a planilha selecionada pelo n8n
   */
  const handleProcessarPlanilha = async () => {
    if (!arquivoSelecionado) {
      mostrarMensagem("erro", "Por favor, selecione um arquivo primeiro.");
      return;
    }

    setProcessando(true);

    // Um timeout de 10 segundos para o caso de o n8n estar offline ou demorando para responder
    const timeoutId = setTimeout(() => {
      setProcessando(false);
      // Limpa o input de arquivo para permitir nova tentativa
      LimparArquivo();
      mostrarMensagem(
        "erro",
        "O servidor de importação demorou para responder. Verifique se o serviço está no ar e tente novamente."
      );
    }, 10000);

    // A URL do webhook n8n (idealmente vinda de uma variável de ambiente)
    const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

    try {
      // 1. Criar um objeto FormData para enviar o arquivo
      const formData = new FormData();
      // A chave 'file' deve corresponder ao que o n8n espera.
      // O n8n por padrão espera o primeiro arquivo binário.
      formData.append("file", arquivoSelecionado);

      // 2. Enviar o arquivo para o n8n usando fetch
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        body: formData,
        // Não defina o 'Content-Type' header manualmente,
        // o navegador fará isso corretamente para multipart/form-data.
      });

      // Se chegamos aqui, o n8n respondeu. Cancelamos o timeout.
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Este erro é para o caso de o n8n retornar um erro imediato (ex: 401, 500)
        throw new Error("O servidor de importação retornou um erro inicial.");
      }

      // Sucesso! A tarefa foi aceita e está rodando em segundo plano.
      setProcessando(false);
      fecharModal(); // Fecha o modal de upload
      mostrarMensagem(
        "sucesso",
        "Planilha recebida! O processamento foi iniciado em segundo plano. Você será notificado aqui mesmo no sistema quando terminar."
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      setProcessando(false);
      LimparArquivo();
      mostrarMensagem("erro", `Erro ao iniciar importação: ${error.message}`);
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
    // Validação para garantir que os campos obrigatórios estão preenchidos
    if (!formData.cnpj || !formData.cliente || !formData.valor_original) {
      mostrarMensagem(
        "erro",
        "CNPJ, cliente e valor original são obrigatórios."
      );
      return;
    }

    // Validação específica para o status 'quitado'
    if (
      formData.status === "quitado" &&
      (!formData.valor_recebido || formData.valor_recebido <= 0)
    ) {
      mostrarMensagem(
        "erro",
        "Para o status 'quitado', o valor recebido é obrigatório e deve ser maior que zero."
      );
      return;
    }

    try {
      if (modalAberto === "criar") {
        // Lógica de criação (se aplicável)
        console.log("Criando cobrança:", formData);
        // await cobrancaService.criarCobranca(formData); // Descomentar quando a função existir
        mostrarMensagem("sucesso", "Cobrança criada com sucesso!");
      } else if (cobrancaSelecionada?.id) {
        // Lógica de atualização
        await cobrancaService.atualizarCobranca(
          cobrancaSelecionada.id,
          formData
        );
        mostrarMensagem("sucesso", "Cobrança atualizada com sucesso!");
      }

      fecharModal();
      await carregarCobrancas(); // Recarrega os dados para refletir a alteração
    } catch (error) {
      console.error("Erro ao salvar cobrança:", error);
      mostrarMensagem(
        "erro",
        `Erro ao salvar cobrança: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * Função para enviar a cobrança via WhatsApp
   * Envia um lembrete amigável sobre a cobrança pendente
   */
  const enviarCobranca = async (cobranca: CobrancaFranqueado) => {
    try {
      // Verifica se há telefone cadastrado
      if (!cobranca.telefone) {
        mostrarMensagem("erro", "Telefone não cadastrado para este cliente.");
        return;
      }

      // Evita envio duplo
      if (enviandoWhatsapp === cobranca.id) {
        return;
      }

      // Define o estado de carregamento
      setEnviandoWhatsapp(cobranca.id!);
      mostrarMensagem(
        "info",
        `Enviando cobrança amigável para ${cobranca.cliente}...`
      );
      // Calcula dias de atraso
      const dataVencimento = new Date(cobranca.data_vencimento);
      const hoje = new Date();
      const diffTime = hoje.getTime() - dataVencimento.getTime();
      const diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Formata o valor para exibição
      const valorFormatado = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cobranca.valor_atualizado || cobranca.valor_original);

      // Formata a data de vencimento
      const dataVencimentoFormatada = new Intl.DateTimeFormat("pt-BR").format(
        dataVencimento
      );

      // Monta a mensagem personalizada
      let mensagem = `Olá, ${cobranca.cliente}! 👋\n\n`;
      mensagem += `Este é um lembrete amigável sobre uma cobrança pendente:\n\n`;
      mensagem += `📋 *Detalhes da Cobrança:*\n`;
      mensagem += `• Valor: ${valorFormatado}\n`;
      mensagem += `• Vencimento: ${dataVencimentoFormatada}\n`;

      if (diasAtraso > 0) {
        mensagem += `• Status: Vencida há ${diasAtraso} dia(s)\n\n`;
        mensagem += `⚠️ Para evitar complicações, recomendamos a regularização o quanto antes.\n\n`;
      } else {
        mensagem += `• Status: Pendente\n\n`;
        mensagem += `📅 Lembramos que o vencimento se aproxima.\n\n`;
      }

      if (cobranca.descricao) {
        mensagem += `📝 *Descrição:* ${cobranca.descricao}\n\n`;
      }

      mensagem += `Para dúvidas ou negociação, entre em contato conosco.\n\n`;
      mensagem += `Atenciosamente,\n`;
      mensagem += `Equipe de Cobrança`;

      console.log("Enviando cobrança via WhatsApp:", {
        cliente: cobranca.cliente,
        telefone: cobranca.telefone,
        valor: valorFormatado,
      });

      // Envia a mensagem via Evolution API
      await evolutionApiService.sendTextMessage({
        instanceName: "automacoes_backup",
        number: cobranca.telefone,
        text: mensagem,
      });

      // Registra o log do envio no banco de dados
      try {
        await cobrancaService.registrarLogEnvioWhatsapp({
          cobrancaId: cobranca.id!,
          tipo: "amigavel",
          numero: cobranca.telefone,
          mensagem: mensagem,
          usuario: usuario,
        });
      } catch (logError) {
        console.error("Erro ao registrar log de envio:", logError);
        // Não interrompe o fluxo principal mesmo se o log falhar
      }

      mostrarMensagem(
        "sucesso",
        `Cobrança amigável enviada com sucesso para ${cobranca.cliente}!`
      );
    } catch (error) {
      console.error("Erro ao enviar cobrança:", error);
      mostrarMensagem(
        "erro",
        `Erro ao enviar cobrança amigável: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    } finally {
      // Limpa o estado de carregamento
      setEnviandoWhatsapp(null);
    }
  };

  /**
   * Função para marcar a cobrança como quitada
   */
  const abrirModalStatus = (cobranca: CobrancaFranqueado) => {
    setCobrancaSelecionada(cobranca);
    setFormData({
      status: cobranca.status,
      valor_recebido: cobranca.valor_recebido || 0,
    });
    setModalAberto("status");
  };

  /**
   * Função para salvar alteração de status
   */
  const salvarAlteracaoStatus = async () => {
    if (!cobrancaSelecionada?.id) return;

    try {
      const dadosAtualizacao: any = {
        cliente: formData.cliente,
        valor_original: formData.valor_original,
        valor_atualizado: formData.valor_atualizado,
        data_vencimento: formData.data_vencimento,
        telefone: formData.telefone || cobrancaSelecionada.telefone,
        email_cobranca: formData.email_cobranca,
        descricao: formData.descricao,
        tipo_cobranca: formData.tipo_cobranca,
        status: formData.status,
      };

      if (formData.status === "quitado" && formData.valor_recebido) {
        dadosAtualizacao.valor_recebido = formData.valor_recebido;
      }

      await cobrancaService.atualizarCobranca(
        cobrancaSelecionada.id,
        dadosAtualizacao
      );
      mostrarMensagem("sucesso", "Status atualizado com sucesso!");
      fecharModal();
      await carregarCobrancas(); // Recarrega a lista para mostrar as alterações
      carregarCobrancas();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      mostrarMensagem("erro", `Erro ao atualizar status: ${error}`);
    }
  };

  /**
   * Função para abrir modal de quitação detalhado
   */
  const abrirModalQuitacao = (cobranca: CobrancaFranqueado) => {
    setCobrancaSelecionada(cobranca);
    setFormQuitacao({
      valorPago: cobranca.valor_atualizado || cobranca.valor_original,
      formaPagamento: "",
      observacoes: "",
      dataRecebimento: new Date().toISOString().split("T")[0],
    });
    setModalAberto("quitacao");
  };

  /**
   * Função para processar quitação detalhada
   */
  const processarQuitacao = async () => {
    if (!cobrancaSelecionada?.id) return;

    if (!formQuitacao.formaPagamento) {
      mostrarMensagem("erro", "Forma de pagamento é obrigatória");
      return;
    }

    if (formQuitacao.valorPago <= 0) {
      mostrarMensagem("erro", "Valor pago deve ser maior que zero");
      return;
    }

    try {
      const resultado = await cobrancaService.quitarCobranca(
        cobrancaSelecionada.id,
        formQuitacao.valorPago,
        formQuitacao.formaPagamento,
        usuario,
        formQuitacao.observacoes,
        formQuitacao.dataRecebimento
      );

      if (resultado.sucesso) {
        mostrarMensagem("sucesso", resultado.mensagem);
        setModalAberto(null);
        carregarCobrancas();
      } else {
        mostrarMensagem("erro", resultado.mensagem);
      }
    } catch (error) {
      console.error("Erro ao processar quitação:", error);
      mostrarMensagem("erro", `Erro ao processar quitação: ${error}`);
    }
  };

  /**
   * Função para marcar rapidamente como quitado
   */
  const marcarQuitadoRapido = async (cobranca: CobrancaFranqueado) => {
    try {
      const resultado = await cobrancaService.quitarCobranca(
        cobranca.id!,
        cobranca.valor_atualizado || cobranca.valor_original,
        "Não informado",
        usuario,
        "Quitação rápida via interface"
      );

      if (resultado.sucesso) {
        mostrarMensagem("sucesso", resultado.mensagem);
        carregarCobrancas();
      } else {
        mostrarMensagem("erro", resultado.mensagem);
      }
    } catch (error) {
      console.error("Erro ao marcar como quitado:", error);
      mostrarMensagem("erro", `Erro ao marcar como quitado: ${error}`);
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

        {/* Mensagem de feedback */}
        {mensagemFeedback && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center ${
              mensagemFeedback.tipo === "sucesso"
                ? "bg-green-50 border border-green-200 text-green-800"
                : mensagemFeedback.tipo === "erro"
                ? "bg-red-50 border border-red-200 text-red-800"
                : "bg-blue-50 border border-blue-200 text-blue-800"
            }`}
          >
            {mensagemFeedback.tipo === "sucesso" ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : mensagemFeedback.tipo === "erro" ? (
              <AlertTriangle className="w-5 h-5 mr-2" />
            ) : (
              <Info className="w-5 h-5 mr-2" />
            )}
            {mensagemFeedback.texto}
          </div>
        )}

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
                          cobranca.status === "em_aberto" &&
                          (() => {
                            // Calcula dias de atraso para verificar se pode enviar cobrança amigável
                            const dataVencimento = new Date(
                              cobranca.data_vencimento
                            );
                            const hoje = new Date();
                            const diffTime =
                              hoje.getTime() - dataVencimento.getTime();
                            const diasAtraso = Math.ceil(
                              diffTime / (1000 * 60 * 60 * 24)
                            );

                            // Mostra botão apenas se há menos de 15 dias de atraso
                            return diasAtraso < 15;
                          })() && (
                            <button
                              onClick={() => enviarCobranca(cobranca)}
                              disabled={enviandoWhatsapp === cobranca.id}
                              className={`${
                                enviandoWhatsapp === cobranca.id
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-green-600 hover:text-green-900"
                              }`}
                              title={
                                enviandoWhatsapp === cobranca.id
                                  ? "Enviando..."
                                  : "Cobrança Amigável"
                              }
                            >
                              {enviandoWhatsapp === cobranca.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <MessageCircle className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        {cobranca.status === "em_aberto" && (
                          <>
                            <button
                              onClick={() => marcarQuitadoRapido(cobranca)}
                              className="text-green-600 hover:text-green-900"
                              title="Marcar como quitado (rápido)"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalQuitacao(cobranca)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Quitação detalhada"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalStatus(cobranca)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Alterar status"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => abrirHistoricoEnvios(cobranca.id!)}
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

              {modalAberto === "editar" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="em_aberto">Em Aberto</option>
                      <option value="negociando">Negociando</option>
                      <option value="quitado">Quitado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>

                  {formData.status === "quitado" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor Recebido *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.valor_recebido || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valor_recebido: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0,00"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarCobranca}
                disabled={
                  !formData.cnpj ||
                  !formData.cliente ||
                  !formData.valor_original ||
                  (formData.status === "quitado" && !formData.valor_recebido)
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

      {/* Modal de Alteração de Status */}
      {modalAberto === "status" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Alterar Status da Cobrança
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">
                  Informações da Cobrança:
                </h4>
                <p className="text-sm text-gray-600">
                  Cliente: {cobrancaSelecionada.cliente}
                </p>
                <p className="text-sm text-gray-600">
                  CNPJ: {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                </p>
                <p className="text-sm text-gray-600">
                  Valor:{" "}
                  {formatarMoeda(
                    cobrancaSelecionada.valor_atualizado ||
                      cobrancaSelecionada.valor_original
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Novo Status *
                </label>
                <select
                  value={formData.status || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="em_aberto">Em Aberto</option>
                  <option value="negociando">Negociando</option>
                  <option value="quitado">Quitado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {formData.status === "quitado" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Recebido *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_recebido || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        valor_recebido: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor sugerido:{" "}
                    {formatarMoeda(
                      cobrancaSelecionada.valor_atualizado ||
                        cobrancaSelecionada.valor_original
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={salvarAlteracaoStatus}
                disabled={
                  !formData.status ||
                  (formData.status === "quitado" &&
                    (!formData.valor_recebido || formData.valor_recebido <= 0))
                }
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar Status
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
          <div className="bg-white rounded-lg p-6 max-w-xl w-full">
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
                onClick={handleCompararPlanilha}
                disabled={!arquivoSelecionado || processando}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? (
                  <span className="flex items-center">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Comparando...
                  </span>
                ) : (
                  "Comparar com Última"
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

      {/* Modal de Comparação */}
      {modalComparacaoAberto && resultadoComparacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">
                Comparação com Última Planilha
              </h3>
              <button
                onClick={() => setModalComparacaoAberto(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Resumo da Comparação */}
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
                        {resultadoComparacao.total_diferencas} diferenças
                        encontradas em relação à última importação
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
                        Nenhuma Diferença
                      </h4>
                      <p className="text-green-700">
                        A nova planilha é idêntica à última importação
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Informações da Última Importação */}
            {resultadoComparacao.ultima_importacao && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  Última Importação:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Data:</span>{" "}
                    {new Date(
                      resultadoComparacao.ultima_importacao.data
                    ).toLocaleString("pt-BR")}
                  </div>
                  <div>
                    <span className="font-medium">Arquivo:</span>{" "}
                    {resultadoComparacao.ultima_importacao.arquivo}
                  </div>
                  <div>
                    <span className="font-medium">Usuário:</span>{" "}
                    {resultadoComparacao.ultima_importacao.usuario}
                  </div>
                </div>
              </div>
            )}

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {resultadoComparacao.resumo.novos}
                </div>
                <div className="text-sm text-green-800">Novos Registros</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {resultadoComparacao.resumo.alterados}
                </div>
                <div className="text-sm text-yellow-800">
                  Registros Alterados
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">
                  {resultadoComparacao.resumo.removidos}
                </div>
                <div className="text-sm text-red-800">Registros Removidos</div>
              </div>
            </div>

            {/* Lista de Diferenças */}
            {resultadoComparacao.tem_diferencas && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Detalhes das Diferenças:
                </h4>
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {resultadoComparacao.diferencas.map((diff, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-l-4 ${
                          diff.tipo === "novo"
                            ? "border-green-500 bg-green-50"
                            : diff.tipo === "alterado"
                            ? "border-yellow-500 bg-yellow-50"
                            : "border-red-500 bg-red-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  diff.tipo === "novo"
                                    ? "bg-green-100 text-green-800"
                                    : diff.tipo === "alterado"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {diff.tipo.toUpperCase()}
                              </span>
                              <span className="ml-3 font-medium text-gray-800">
                                {diff.cliente} ({formatarCNPJCPF(diff.cnpj)})
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              {diff.detalhes}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex justify-end space-x-3">
              {resultadoComparacao.tem_diferencas && (
                <button
                  onClick={() => {
                    // Gera e baixa relatório de comparação
                    const relatorio =
                      comparacaoPlanilhaService.gerarRelatorioComparacao(
                        resultadoComparacao
                      );
                    const blob = new Blob([relatorio], {
                      type: "text/plain;charset=utf-8",
                    });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `comparacao-planilha-${
                      new Date().toISOString().split("T")[0]
                    }.txt`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Baixar Relatório
                </button>
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
                title="Limpa os erros da memória e esconde o botão de alerta"
              >
                Limpar Erros e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Quitação Detalhada */}
      {modalAberto === "quitacao" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Quitação de Cobrança
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Informações da Cobrança */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-800 mb-2">
                  Detalhes da Cobrança:
                </h3>
                <p className="text-sm text-gray-600">
                  <strong>Cliente:</strong> {cobrancaSelecionada.cliente}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Valor Total:</strong>{" "}
                  {formatarMoeda(
                    cobrancaSelecionada.valor_atualizado ||
                      cobrancaSelecionada.valor_original
                  )}
                </p>
                {cobrancaSelecionada.valor_recebido &&
                  cobrancaSelecionada.valor_recebido > 0 && (
                    <p className="text-sm text-gray-600">
                      <strong>Já Pago:</strong>{" "}
                      {formatarMoeda(cobrancaSelecionada.valor_recebido)}
                    </p>
                  )}
                <p className="text-sm text-gray-600">
                  <strong>Saldo Devedor:</strong>{" "}
                  {formatarMoeda(
                    (cobrancaSelecionada.valor_atualizado ||
                      cobrancaSelecionada.valor_original) -
                      (cobrancaSelecionada.valor_recebido || 0)
                  )}
                </p>
              </div>

              {/* Formulário de Quitação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Pago <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formQuitacao.valorPago}
                  onChange={(e) =>
                    setFormQuitacao({
                      ...formQuitacao,
                      valorPago: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pagamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={formQuitacao.formaPagamento}
                  onChange={(e) =>
                    setFormQuitacao({
                      ...formQuitacao,
                      formaPagamento: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione...</option>
                  <option value="PIX">PIX</option>
                  <option value="Transferência Bancária">
                    Transferência Bancária
                  </option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data do Recebimento
                </label>
                <input
                  type="date"
                  value={formQuitacao.dataRecebimento}
                  onChange={(e) =>
                    setFormQuitacao({
                      ...formQuitacao,
                      dataRecebimento: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formQuitacao.observacoes}
                  onChange={(e) =>
                    setFormQuitacao({
                      ...formQuitacao,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Informações adicionais sobre o pagamento..."
                />
              </div>

              {/* Previsão do Resultado */}
              {formQuitacao.valorPago > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">
                    Resultado da Operação:
                  </h4>
                  {formQuitacao.valorPago >=
                  (cobrancaSelecionada.valor_atualizado ||
                    cobrancaSelecionada.valor_original) -
                    (cobrancaSelecionada.valor_recebido || 0) ? (
                    <p className="text-sm text-green-700">
                      ✅ <strong>Quitação Total</strong> - Processo será
                      encerrado e confirmação enviada por WhatsApp
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-700">
                      ⚠️ <strong>Pagamento Parcial</strong> - Restará:{" "}
                      {formatarMoeda(
                        (cobrancaSelecionada.valor_atualizado ||
                          cobrancaSelecionada.valor_original) -
                          (cobrancaSelecionada.valor_recebido || 0) -
                          formQuitacao.valorPago
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setModalAberto(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={processarQuitacao}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
              >
                <Receipt className="w-4 h-4" />
                <span>Registrar Quitação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Envios */}
      {modalHistoricoAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-auto overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Histórico de Envios</h3>
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {carregandoHistorico ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">
                    Carregando histórico...
                  </span>
                </div>
              ) : historicoEnvios.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nenhum envio encontrado para esta cobrança.
                </div>
              ) : (
                <div className="space-y-4">
                  {historicoEnvios.map((envio, index) => {
                    // Função para determinar o tipo de envio e sua cor
                    const getTipoEnvio = (tipo: string, canal: string) => {
                      if (
                        tipo?.includes("whatsapp_amigavel") ||
                        tipo === "amigavel"
                      ) {
                        return {
                          texto: "💬 Cobrança Amigável (WhatsApp)",
                          cor: "bg-green-100 text-green-800",
                        };
                      } else if (
                        tipo?.includes("whatsapp_juridico") ||
                        tipo === "juridico"
                      ) {
                        return {
                          texto: "⚖️ Acionamento Jurídico (WhatsApp)",
                          cor: "bg-red-100 text-red-800",
                        };
                      } else if (
                        tipo?.includes("whatsapp_parcelamento") ||
                        tipo === "parcelamento"
                      ) {
                        return {
                          texto: "💰 Proposta de Parcelamento (WhatsApp)",
                          cor: "bg-blue-100 text-blue-800",
                        };
                      } else if (
                        tipo?.includes("email_proposta_parcelamento")
                      ) {
                        return {
                          texto: "📧💰 Proposta de Parcelamento (Email)",
                          cor: "bg-blue-100 text-blue-800",
                        };
                      } else if (tipo?.includes("email_cobranca_padrao")) {
                        return {
                          texto: "📧 Cobrança Padrão (Email)",
                          cor: "bg-yellow-100 text-yellow-800",
                        };
                      } else if (tipo?.includes("email_cobranca_formal")) {
                        return {
                          texto: "📧 Cobrança Formal (Email)",
                          cor: "bg-orange-100 text-orange-800",
                        };
                      } else if (tipo?.includes("email_cobranca_urgente")) {
                        return {
                          texto: "📧🚨 Cobrança Urgente (Email)",
                          cor: "bg-red-100 text-red-800",
                        };
                      } else if (
                        tipo?.includes("email_escalonamento_juridico") ||
                        tipo?.includes("email_notificacao_extrajudicial")
                      ) {
                        return {
                          texto: "📧⚖️ Notificação Extrajudicial (Email)",
                          cor: "bg-red-100 text-red-800",
                        };
                      } else if (
                        tipo?.includes("sistema_escalonamento_juridico")
                      ) {
                        return {
                          texto: "🎯 Escalonamento para Jurídico",
                          cor: "bg-purple-100 text-purple-800",
                        };
                      } else if (canal === "Email" || canal === "email") {
                        return {
                          texto: "📧 Email",
                          cor: "bg-blue-100 text-blue-800",
                        };
                      } else if (canal === "WhatsApp" || canal === "whatsapp") {
                        return {
                          texto: "💬 WhatsApp",
                          cor: "bg-green-100 text-green-800",
                        };
                      } else {
                        return {
                          texto: "📋 Sistema",
                          cor: "bg-gray-100 text-gray-800",
                        };
                      }
                    };

                    const tipoInfo = getTipoEnvio(
                      envio.tipo_envio || envio.tipo,
                      envio.canal
                    );

                    return (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${tipoInfo.cor}`}
                            >
                              {tipoInfo.texto}
                            </span>
                            {envio.status_envio && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  envio.status_envio === "sucesso" ||
                                  envio.status === "sucesso"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {envio.status_envio === "sucesso" ||
                                envio.status === "sucesso"
                                  ? "✅ Enviado"
                                  : "❌ Falha"}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500 font-medium">
                            {new Date(
                              envio.data_envio || envio.data
                            ).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Informações do destinatário */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">
                              Destinatário:
                            </span>
                            <div className="text-gray-900 mt-1">
                              {envio.destinatario ||
                                envio.numero_telefone ||
                                "Não informado"}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium text-gray-600">
                              Enviado por:
                            </span>
                            <div className="text-gray-900 mt-1">
                              {envio.usuario || "Sistema"}
                            </div>
                          </div>
                        </div>

                        {/* Assunto do email, se houver */}
                        {envio.assunto && (
                          <div className="text-sm mb-3">
                            <span className="font-medium text-gray-600">
                              Assunto:
                            </span>
                            <div className="text-gray-900 mt-1 font-medium">
                              {envio.assunto}
                            </div>
                          </div>
                        )}

                        {/* Metadados importantes */}
                        {envio.metadados &&
                          Object.keys(envio.metadados).length > 0 && (
                            <div className="text-sm mb-3">
                              <span className="font-medium text-gray-600">
                                Informações:
                              </span>
                              <div className="mt-1 text-gray-700 space-y-1">
                                {envio.metadados.valor_cobrado && (
                                  <div>
                                    💰 Valor:{" "}
                                    {new Intl.NumberFormat("pt-BR", {
                                      style: "currency",
                                      currency: "BRL",
                                    }).format(envio.metadados.valor_cobrado)}
                                  </div>
                                )}
                                {envio.metadados.dias_atraso && (
                                  <div>
                                    📅 Dias em atraso:{" "}
                                    {envio.metadados.dias_atraso}
                                  </div>
                                )}
                                {envio.metadados.codigo_unidade && (
                                  <div>
                                    🏢 Unidade: {envio.metadados.codigo_unidade}
                                  </div>
                                )}
                                {envio.metadados.escalonamento_juridico && (
                                  <div className="text-red-600 font-medium">
                                    ⚖️ Escalonamento Jurídico
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        {/* Mensagem */}
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">
                            Mensagem:
                          </span>
                          <div className="mt-2 p-3 bg-white border border-gray-200 rounded-md">
                            <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {envio.mensagem ||
                                envio.mensagem_enviada ||
                                "Conteúdo não disponível"}
                            </div>
                          </div>
                        </div>

                        {/* Erro, se houver */}
                        {envio.erro_detalhes && (
                          <div className="text-sm mt-3">
                            <span className="font-medium text-red-600">
                              Detalhes do erro:
                            </span>
                            <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                              {envio.erro_detalhes}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
