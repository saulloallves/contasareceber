/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit, Eye, Upload, Receipt, CheckCircle,
  XCircle, Clock, Filter, RefreshCw, FileText,
  ArrowUp, ArrowDown, AlertTriangle, Calculator, MessageSquare,
  //Scale, MessageCircle, Mail,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { CobrancaFranqueado } from "../../types/cobranca";
import { cobrancaService } from "../../services/cobrancaService";
import { n8nService, N8nService } from "../../services/n8nService";
import { processarPlanilhaExcel } from "../../utils/planilhaProcessor";
import type { ResultadoComparacao } from "../../services/comparacaoPlanilhaService";
import { comparacaoPlanilhaService } from "../../services/comparacaoPlanilhaService";
import { formatarCNPJCPF, formatarMoeda, formatarData, } from "../../utils/formatters";
import { SimulacaoParcelamentoService } from "../../services/simulacaoParcelamentoService";
import { UnidadesService } from "../../services/unidadesService";
import type { UnidadeFranqueada } from "../../types/unidades";
import { emailService } from "../../services/emailService";
import { supabase } from "../../services/databaseService";

export function GestaoCobrancas() {
  const [cobrancas, setCobrancas] = useState<CobrancaFranqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState< "criar" | "editar" | "upload" | "status" | "quitacao" | "acoes" | null>(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<CobrancaFranqueado | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null); //Linha adicionada para 'guardar' o arquivo selecionado
  const [processando, setProcessando] = useState(false); // Linha adicionada para controlar o estado de processamento do upload
  const [resultadoComparacao, setResultadoComparacao] = useState<ResultadoComparacao | null>(null);
  const [modalComparacaoAberto, setModalComparacaoAberto] = useState(false);
  const [usuario] = useState("admin"); // Em produção, pegar do contexto de autenticação
  const [formData, setFormData] = useState<Partial<CobrancaFranqueado>>({});
  const [formQuitacao, setFormQuitacao] = useState({valorPago: 0, formaPagamento: "", observacoes: "", dataRecebimento: new Date().toISOString().split("T")[0],});
  const [filtros, setFiltros] = useState({status: "", busca: "", dataInicio: "", dataFim: "", valorMin: "", valorMax: "", tipoCobranca: "",});
  const [filtrosAvancados, setFiltrosAvancados] = useState({ nomeUnidade: "", cnpj: "", codigo: "", statusCobranca: "", valorMin: "", valorMax: "", tipoCobranca: "", });
  const [showFiltrosAvancados, setShowFiltrosAvancados] = useState(false);
  const [colunaOrdenacao, setColunaOrdenacao] = useState("data_vencimento"); // Coluna padrão
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState("desc"); // Ordenação 'asc' ou 'desc'
  //const [mostrarApenasInadimplentes, setMostrarApenasInadimplentes] = useState(false); // Controlar a exibição de inadimplentes
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [modalErrosAberto, setModalErrosAberto] = useState(false);
  // Mensagens agora são exibidas via react-hot-toast
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState<string | null>(null); // ID da cobrança sendo enviada
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoEnvios, setHistoricoEnvios] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "lista">("cards");

  // Serviços auxiliares (instâncias)
  const simulacaoService = new SimulacaoParcelamentoService();
  const unidadesService = React.useMemo(() => new UnidadesService(), []);
  const [unidadesPorCnpj, setUnidadesPorCnpj] = useState<Record<string, UnidadeFranqueada>>({});
  const cnpjKey = useCallback((cnpj: string) => (cnpj || "").replace(/\D/g, ""), []);

  /**
   * Função auxiliar para buscar o nome do franqueado baseado no CNPJ da cobrança
   */
  const buscarNomeFranqueado = useCallback(
    async (cnpj: string): Promise<string> => {
      try {
        // Busca dados completos da unidade via Supabase com relacionamentos
        const { data: unidade, error } = await supabase
          .from("unidades_franqueadas")
          .select(
            `
          nome_unidade,
          franqueado_unidades!left (
            franqueados!left (
              nome_completo
            )
          )
        `
          )
          .eq("codigo_interno", cnpjKey(cnpj))
          .single();

        if (error) {
          console.warn("Erro ao buscar unidade por CNPJ:", error);
          return "Cliente";
        }

        // Prioriza APENAS nome do franqueado - nunca usar nome da unidade
        const nomeFranqueado = (unidade as any)?.franqueado_unidades?.[0]
          ?.franqueados?.nome_completo;

        // Se tem franqueado vinculado e o nome não é "Sem nome cadastrado"
        if (nomeFranqueado && nomeFranqueado !== "Sem nome cadastrado") {
          return nomeFranqueado;
        }

        // Para TODOS os outros casos (sem franqueado, franqueado com "Sem nome cadastrado", etc.)
        // SEMPRE retorna "Franqueado(a)" - nunca o nome da unidade
        return "Franqueado(a)";
      } catch (error) {
        console.warn("Erro ao buscar nome do franqueado:", error);
        return "Franqueado(a)";
      }
  },
  [cnpjKey]
  );

  // Estados do modal unificado
  const [abaAcoes, setAbaAcoes] = useState<"acoes_rapidas" | "simulacao" | "mensagem" | "detalhes">("acoes_rapidas");
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any | null>(null);
  const [simulacaoAtual, setSimulacaoAtual] = useState<any>(null);
  const [formSimulacao, setFormSimulacao] = useState({quantidade_parcelas: 3,data_primeira_parcela: "",valor_entrada: 0,});
  const [formProposta, setFormProposta] = useState({canais_envio: ["whatsapp"] as ("whatsapp" | "email")[],observacoes: "",});
  const [formMensagem, setFormMensagem] = useState({template: "padrao",mensagem_personalizada: "",canal: "whatsapp" as "whatsapp" | "email",});

  const templatesPadrao = {
    padrao: `Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? Entre em contato conosco.

_Esta é uma mensagem do sistema de cobrança._`,

    formal: `Prezado(a) {{cliente}},

Identificamos pendência financeira em aberto referente à sua unidade {{codigo_unidade}}.

Dados da pendência:
- Valor original: {{valor_original}}
- Valor atualizado: {{valor_atualizado}}
- Data de vencimento: {{data_vencimento}}
- Dias em atraso: {{dias_atraso}}

Solicitamos regularização no prazo de 5 dias úteis.

Atenciosamente,
Equipe Financeira`,

    urgente: `🚨 ATENÇÃO {{cliente}}

Sua unidade {{codigo_unidade}} possui débito VENCIDO há {{dias_atraso}} dias.

💰 Valor: {{valor_atualizado}}
📅 Vencimento: {{data_vencimento}}

⚠️ Regularize HOJE para evitar bloqueios!

Entre em contato: (11) 99999-9999`,
  } as const;

  const mostrarMensagem = (
    tipo: "sucesso" | "erro" | "info",
    texto: string
  ) => {
    const base = { duration: 5000 } as const;
    if (tipo === "sucesso") {
      toast.success(texto, {
        ...base,
        style: { background: "#047857", color: "#fff" }, // verde
      });
    } else if (tipo === "erro") {
      toast.error(texto, {
        ...base,
        style: { background: "#b91c1c", color: "#fff" }, // vermelho
      });
    } else {
      toast(texto, base);
    }
  };

  /**
   * Função para carregar as cobranças do serviço
   * Ela aplica os filtros e ordenação definidos pelo usuário
   */
  const carregarCobrancas = useCallback(async () => {
    setCarregando(true);
    try {
      // Converte filtros avançados para o formato esperado pelo serviço
      const filtrosServico = { ...filtros };

      if (filtrosAvancados.tipoCobranca) {
        filtrosServico.tipoCobranca = filtrosAvancados.tipoCobranca;
      }

      if (filtrosAvancados.valorMin) {
        filtrosServico.valorMin = filtrosAvancados.valorMin;
      }

      if (filtrosAvancados.valorMax) {
        filtrosServico.valorMax = filtrosAvancados.valorMax;
      }

      const dadosReaisDoBanco = await cobrancaService.buscarCobrancas({
        ...filtrosServico,
        colunaOrdenacao,
        direcaoOrdenacao,
        //apenasInadimplentes: mostrarApenasInadimplentes, // Linha adicionada para filtrar apenas inadimplentes
      });

      // Aplica filtros locais que não são suportados pelo serviço
      let cobrancasFiltradas = dadosReaisDoBanco;

      if (filtrosAvancados.nomeUnidade) {
        cobrancasFiltradas = cobrancasFiltradas.filter((cobranca) =>
          (
            cobranca.unidades_franqueadas?.nome_unidade ||
            cobranca.cliente ||
            ""
          )
            .toLowerCase()
            .includes(filtrosAvancados.nomeUnidade.toLowerCase())
        );
      }

      if (filtrosAvancados.cnpj) {
        cobrancasFiltradas = cobrancasFiltradas.filter((cobranca) =>
          cobranca.cnpj.includes(filtrosAvancados.cnpj)
        );
      }

      if (filtrosAvancados.codigo) {
        cobrancasFiltradas = cobrancasFiltradas.filter((cobranca) =>
          (cobranca.unidades_franqueadas?.codigo_unidade || "")
            .toLowerCase()
            .includes(filtrosAvancados.codigo.toLowerCase())
        );
      }

      if (filtrosAvancados.statusCobranca) {
        cobrancasFiltradas = cobrancasFiltradas.filter(
          (cobranca) => cobranca.status === filtrosAvancados.statusCobranca
        );
      }

      setCobrancas(cobrancasFiltradas);

      // Precarrega nomes/códigos das unidades em lote
      try {
        const cnpjs = cobrancasFiltradas
          .map((c) => cnpjKey(c.cnpj))
          .filter(Boolean);
        const mapa = await unidadesService.buscarUnidadesPorCnpjs(cnpjs);
        setUnidadesPorCnpj(mapa);
      } catch (e) {
        console.warn("Falha ao mapear unidades por CNPJ", e);
        setUnidadesPorCnpj({});
      }
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
      // Em caso de erro, a lista vai ser limpa e mostrar um toast
      toast.error("Erro ao carregar cobranças. Tente novamente mais tarde.", {
        style: { background: "#b91c1c", color: "#fff" },
      });
      setCobrancas([]);
    } finally {
      setCarregando(false);
    }
  }, [
    filtros,
    filtrosAvancados,
    colunaOrdenacao,
    direcaoOrdenacao,
    //mostrarApenasInadimplentes,
    unidadesService,
    cnpjKey,
  ]);

  // Função para aplicar filtros
  const aplicarFiltros = () => {
    carregarCobrancas();
  };

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltrosAvancados({
      nomeUnidade: "",
      cnpj: "",
      codigo: "",
      statusCobranca: "",
      valorMin: "",
      valorMax: "",
      tipoCobranca: "",
    });
    setFiltros({
      status: "",
      busca: "",
      dataInicio: "",
      dataFim: "",
      valorMin: "",
      valorMax: "",
      tipoCobranca: "",
    });
    carregarCobrancas();
  };

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
   * Abre o modal unificado de ações
   */
  const abrirModalAcoes = async (cobranca: CobrancaFranqueado) => {
    setCobrancaSelecionada(cobranca);
    setAbaAcoes(cobranca.status === "quitado" ? "detalhes" : "acoes_rapidas");
    setSimulacaoAtual(null);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: "",
      valor_entrada: 0,
    });
    setFormProposta({ canais_envio: ["whatsapp"], observacoes: "" });
    setFormMensagem({
      template: "padrao",
      mensagem_personalizada: "",
      canal: "whatsapp",
    });

    // Carrega a unidade priorizando a FK da cobrança
    try {
      if (cobranca.unidade_id_fk) {
        const unidade = await unidadesService.buscarUnidadePorId(cobranca.unidade_id_fk);
        if (unidade) {
          setUnidadeSelecionada(unidade);
        } else {
          // Fallback para cache/consulta por CNPJ
          const cached = unidadesPorCnpj[cnpjKey(cobranca.cnpj)];
          if (cached) {
            setUnidadeSelecionada(cached);
          } else {
            const un = await unidadesService.buscarUnidadePorCnpj(cobranca.cnpj);
            setUnidadeSelecionada(un);
          }
        }
      } else {
        // Fallback quando a cobrança não vier com unidade_id_fk tipado
        const cached = unidadesPorCnpj[cnpjKey(cobranca.cnpj)];
        if (cached) {
          setUnidadeSelecionada(cached);
        } else {
          const un = await unidadesService.buscarUnidadePorCnpj(cobranca.cnpj);
          setUnidadeSelecionada(un);
        }
      }
    } catch (e) {
      console.warn("Não foi possível carregar dados da unidade", e);
      setUnidadeSelecionada(null);
    }

    setModalAberto("acoes");
  };

  // Garante que, se a cobrança estiver quitada, a aba ativa seja sempre "detalhes"
  useEffect(() => {
    if (
      modalAberto === "acoes" &&
      cobrancaSelecionada?.status === "quitado" &&
      abaAcoes !== "detalhes"
    ) {
      setAbaAcoes("detalhes");
    }
  }, [modalAberto, cobrancaSelecionada?.status, abaAcoes]);

  /**
   * Função para fechar o modal e limpar os dados do formulário
   */
  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setFormData({});
    setUnidadeSelecionada(null);
    setSimulacaoAtual(null);
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
    const file = event.target.files?.[0];
    if (!file) return;

    const nome = file.name.toLowerCase();
    const isXlsx = /\.xlsx$/i.test(nome);

    if (!isXlsx) {
      // Reseta seleção e avisa via toast chamativo
      setArquivoSelecionado(null);
      event.target.value = "";
      toast.error(
        "Arquivo inválido. Envie uma planilha .xlsx.\nO sistema ainda não está pronto para outros formatos!",
        { duration: 6000 }
      );
      return;
    }

    setArquivoSelecionado(file); // Guarda o arquivo válido no estado
  };

  /**
   * Função para comparar com a última planilha salva
   */
  const handleCompararPlanilha = async () => {
    if (!arquivoSelecionado) {
      toast.error("Por favor, selecione um arquivo primeiro.", {
        style: { background: "#b91c1c", color: "#fff" },
      });
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
      } else {
        toast.error(
          "Arquivo inválido. Envie uma planilha .xlsx.\nO sistema ainda não está pronto para outros formatos!",
          { duration: 6000 }
        );
        setProcessando(false);
        return;
      }

      if (!dadosDaPlanilha) {
        throw new Error("Não foi possível extrair dados da planilha.");
      }

      console.log(
        `${dadosDaPlanilha.length} registros extraídos. Comparando...`
      );

      // Chama o serviço de comparação
      const resultadoComp =
        await comparacaoPlanilhaService.compararComUltimaPlanilha(
          dadosDaPlanilha
        );
      setResultadoComparacao(resultadoComp);
      setModalComparacaoAberto(true);
    } catch (error: any) {
      console.error("ERRO ao comparar planilhas:", error);
      toast.error(`Erro ao comparar planilhas: ${error.message || error}`);
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

    // Trava extra: só .xlsx
    if (!/\.xlsx$/i.test(arquivoSelecionado.name)) {
      toast.error(
        "Arquivo inválido. Envie uma planilha .xlsx.\nO sistema ainda não está pronto para outros formatos (ex.: .csv).",
        { duration: 6000 }
      );
      LimparArquivo();
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
    const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOKPLANILHA_URL;

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
        "Planilha recebida! O processamento foi iniciado em segundo plano. Você será notificado pelo WhatsApp quando terminar."
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

  // ====== Funcionalidades do Painel Operacional integradas ======
  const calcularJuros = (cobranca: any) => {
    const valorOriginal = cobranca.valor_original;
    const valorAtualizado = cobranca.valor_atualizado || valorOriginal;
    return valorAtualizado - valorOriginal;
  };

  const podeSimularParcelamento = (c: CobrancaFranqueado) => {
    const valorAtualizado = c.valor_atualizado || c.valor_original;
    return c.status !== "quitado" && valorAtualizado >= 500;
  };

  // const podeAcionarJuridico = (c: CobrancaFranqueado) => {
  //   const valorAtualizado = c.valor_atualizado || c.valor_original;
  //   const diasAtraso = c.dias_em_atraso || 0;
  //   return (
  //     c.status === "em_aberto" && valorAtualizado > 5000 && diasAtraso >= 91
  //   );
  // };

  // const acionarJuridico = async (cobranca: CobrancaFranqueado) => {
  //   const valorAtualizado =
  //     cobranca.valor_atualizado || cobranca.valor_original;

  //   if (
  //     !confirm(
  //       `🚨 ACIONAMENTO JURÍDICO - ${
  //         cobranca.cliente
  //       }\n\nCRITÉRIOS VALIDADOS:\n✓ Valor: ${formatarMoeda(
  //         valorAtualizado
  //       )} (superior a R$ 5.000,00)\n✓ Status: Em aberto há ${
  //         cobranca.dias_em_atraso || 0
  //       } dias (≥91 dias)  \n✓ Aviso de débito enviado: Sim\n✓ Sem resposta do cliente\n\nCRITÉRIOS QUE SERÃO VALIDADOS NO SISTEMA:\n• Score de risco deve ser igual a zero\n• 3+ cobranças ignoradas nos últimos 15 dias  \n• Acordo descumprido OU reincidência nos últimos 6 meses\n\n⚠️ Esta ação enviará notificação extrajudicial via e-mail e WhatsApp.\n\nConfirma o acionamento jurídico?`
  //     )
  //   ) {
  //     return;
  //   }

  //   setProcessando(true);
  //   try {
  //     const response = await fetch(
  //       "https://uveugjjntywsfbcjrpgu.supabase.co/functions/v1/acionar-juridico-cobranca",
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  //         },
  //         body: JSON.stringify({ cobrancaId: cobranca.id }),
  //       }
  //     );

  //     const resultado = await response.json();

  //     if (resultado.sucesso) {
  //       mostrarMensagem(
  //         "sucesso",
  //         "Cobrança acionada no jurídico com sucesso! Notificações enviadas."
  //       );
  //       await carregarCobrancas();
  //     } else {
  //       mostrarMensagem(
  //         "erro",
  //         `Erro ao acionar jurídico: ${resultado.mensagem}`
  //       );
  //     }
  //   } catch (error) {
  //     console.error("Erro ao acionar jurídico:", error);
  //     mostrarMensagem(
  //       "erro",
  //       "Erro ao comunicar com o servidor. Tente novamente."
  //     );
  //   } finally {
  //     setProcessando(false);
  //   }
  // };

  const aplicarVariaveis = async (template: string) => {
    if (!cobrancaSelecionada) return template;

    // Busca nome do franqueado para personalização
    const nomeFranqueado = await buscarNomeFranqueado(cobrancaSelecionada.cnpj);

    const variaveis: Record<string, string> = {
      "{{cliente}}": nomeFranqueado,
      "{{codigo_unidade}}":
        (unidadeSelecionada as any)?.codigo_unidade || cobrancaSelecionada.cnpj,
      "{{valor_original}}": formatarMoeda(cobrancaSelecionada.valor_original),
      "{{valor_atualizado}}": formatarMoeda(
        cobrancaSelecionada.valor_atualizado ||
          cobrancaSelecionada.valor_original
      ),
      "{{data_vencimento}}": formatarData(cobrancaSelecionada.data_vencimento),
      "{{dias_atraso}}": (cobrancaSelecionada.dias_em_atraso || 0).toString(),
    };

    let mensagem = template;
    Object.entries(variaveis).forEach(([chave, valor]) => {
      mensagem = mensagem.replace(
        new RegExp(chave.replace(/[{}]/g, "\\$&"), "g"),
        valor
      );
    });
    return mensagem;
  };

  const getPreviewMensagem = () => {
    if (formMensagem.template === "personalizada") {
      return formMensagem.mensagem_personalizada;
    }
    // Para preview, usa o nome do cliente como fallback (não pode ser async em preview)
    const template =
      templatesPadrao[formMensagem.template as keyof typeof templatesPadrao];
    const variaveis: Record<string, string> = {
      "{{cliente}}": cobrancaSelecionada?.cliente || "Cliente",
      "{{codigo_unidade}}":
        (unidadeSelecionada as any)?.codigo_unidade ||
        cobrancaSelecionada?.cnpj ||
        "Código",
      "{{valor_original}}": formatarMoeda(
        cobrancaSelecionada?.valor_original || 0
      ),
      "{{valor_atualizado}}": formatarMoeda(
        cobrancaSelecionada?.valor_atualizado ||
          cobrancaSelecionada?.valor_original ||
          0
      ),
      "{{data_vencimento}}": formatarData(
        cobrancaSelecionada?.data_vencimento || new Date().toISOString()
      ),
      "{{dias_atraso}}": (cobrancaSelecionada?.dias_em_atraso || 0).toString(),
    };

    let mensagemProcessada: string = template;
    Object.entries(variaveis).forEach(([chave, valor]) => {
      mensagemProcessada = mensagemProcessada.replace(
        new RegExp(chave.replace(/[{}]/g, "\\$&"), "g"),
        valor
      );
    });
    return mensagemProcessada;
  };

  const enviarMensagemPersonalizada = async () => {
    if (!cobrancaSelecionada) return;

    const mensagemFinal =
      formMensagem.template === "personalizada"
        ? formMensagem.mensagem_personalizada
        : await aplicarVariaveis(
            templatesPadrao[
              formMensagem.template as keyof typeof templatesPadrao
            ]
          );

    setProcessando(true);
    try {
      if (formMensagem.canal === "whatsapp") {
        const telefone =
          (unidadeSelecionada as any)?.telefone_franqueado ||
          cobrancaSelecionada.telefone ||
          "";
        if (!telefone) {
          mostrarMensagem("erro", "Telefone não cadastrado para esta unidade.");
        } else {
          // Valida o telefone antes de enviar
          try {
            N8nService.tratarTelefone(telefone);
          } catch (telefoneError) {
            mostrarMensagem(
              "erro",
              `Telefone inválido: ${
                telefoneError instanceof Error
                  ? telefoneError.message
                  : "Erro na validação"
              }`
            );
            return;
          }

          const resultado = await n8nService.enviarWhatsApp({
            number: telefone,
            text: mensagemFinal,
            instanceName: "automacoes_3",
            metadata: {
              tipo: "mensagem_personalizada",
              cobrancaId: cobrancaSelecionada?.id,
              cliente: cobrancaSelecionada?.cliente,
              template: formMensagem.template,
            },
          });

          if (!resultado.success) {
            throw new Error("Falha no envio da mensagem via n8n");
          }

          mostrarMensagem("sucesso", "Mensagem enviada via WhatsApp!");
        }
      } else {
        // Envio via email usando emailService
        const resultado = await emailService.enviarMensagemCobranca(
          formMensagem.template as
            | "padrao"
            | "formal"
            | "urgente"
            | "personalizada",
          formMensagem.mensagem_personalizada,
          unidadeSelecionada,
          cobrancaSelecionada
        );

        if (resultado.sucesso) {
          mostrarMensagem("sucesso", "Email enviado com sucesso!");
        } else {
          mostrarMensagem("erro", resultado.erro || "Falha ao enviar email");
        }
      }
      setModalAberto(null);
    } catch (error) {
      mostrarMensagem("erro", `Erro ao enviar mensagem: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const simularParcelamento = async () => {
    if (!cobrancaSelecionada || !formSimulacao.data_primeira_parcela) {
      toast.error("Data da primeira parcela é obrigatória", {
        style: { background: "#b91c1c", color: "#fff" },
      });
      return;
    }
    setProcessando(true);
    try {
      const simulacao = await simulacaoService.simularParcelamento(
        cobrancaSelecionada.id!,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );
      setSimulacaoAtual(simulacao);
      mostrarMensagem("sucesso", "Simulação realizada com sucesso.");
    } catch (error) {
      toast.error(`Erro na simulação: ${error}`, {
        style: { background: "#b91c1c", color: "#fff" },
      });
    } finally {
      setProcessando(false);
    }
  };

  const gerarProposta = async () => {
    if (!simulacaoAtual) return;
    setProcessando(true);
    try {
      const simulacaoId = await simulacaoService.salvarSimulacao(
        simulacaoAtual
      );
      const proposta = await simulacaoService.gerarProposta(
        simulacaoId,
        formProposta.canais_envio,
        "usuario_atual"
      );

      const resultados: string[] = [];
      if (formProposta.canais_envio.includes("whatsapp")) {
        const ok = await simulacaoService.enviarPropostaWhatsApp(proposta.id!);
        resultados.push(`WhatsApp: ${ok ? "Enviado" : "Falha"}`);
      }
      if (formProposta.canais_envio.includes("email")) {
        const ok = await simulacaoService.enviarPropostaEmail(proposta.id!);
        resultados.push(`Email: ${ok ? "Enviado" : "Falha"}`);
      }

      toast.success(`Proposta gerada e enviada!\n${resultados.join("\n")}`,
        { style: { background: "#047857", color: "#fff" } }
      );
      fecharModal();
      carregarCobrancas();
    } catch (error) {
      toast.error(`Erro ao gerar proposta: ${error}`, {
        style: { background: "#b91c1c", color: "#fff" },
      });
    } finally {
      setProcessando(false);
    }
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

      // Valida o telefone antes de prosseguir
      try {
        N8nService.tratarTelefone(cobranca.telefone);
      } catch (telefoneError) {
        mostrarMensagem(
          "erro",
          `Telefone inválido para ${cobranca.cliente}: ${
            telefoneError instanceof Error
              ? telefoneError.message
              : "Erro na validação"
          }`
        );
        return;
      }
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

      // Busca nome do franqueado para personalização
      const nomeFranqueado = await buscarNomeFranqueado(cobranca.cnpj);

      // Monta a mensagem personalizada
      let mensagem = `Olá, ${nomeFranqueado}! 👋\n\n`;
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

      // Envia a mensagem via n8n webhook
      const resultado = await n8nService.enviarWhatsApp({
        number: cobranca.telefone,
        text: mensagem,
        instanceName: "automacoes_3",
        metadata: {
          tipo: "cobranca_amigavel",
          cobrancaId: cobranca.id,
          cliente: nomeFranqueado,
          valor: valorFormatado,
        },
      });

      if (!resultado.success) {
        throw new Error("Falha no envio da mensagem via n8n");
      }

      mostrarMensagem(
        "sucesso",
        `Cobrança amigável enviada com sucesso para ${nomeFranqueado}!`
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
      const resultado = await cobrancaService.quitarCobranca({
        cobrancaId: cobrancaSelecionada.id,
        valorPago: formQuitacao.valorPago,
        formaPagamento: formQuitacao.formaPagamento,
        dataRecebimento: formQuitacao.dataRecebimento,
        observacoes: formQuitacao.observacoes,
        usuario,
      });

      if (resultado.sucesso) {
        mostrarMensagem("sucesso", resultado.mensagem);

        // Envia mensagem de confirmação via WhatsApp se houver telefone
        if (cobrancaSelecionada.telefone && resultado.isQuitacaoTotal) {
          try {
            // Busca nome do franqueado para personalização
            const nomeFranqueado = await buscarNomeFranqueado(
              cobrancaSelecionada.cnpj
            );

            const valorFormatado = new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(formQuitacao.valorPago);

            const mensagemConfirmacao =
              `✅ *CONFIRMAÇÃO DE QUITAÇÃO*\n\n` +
              `Olá, ${nomeFranqueado}! 👋\n\n` +
              `Recebemos o pagamento da sua cobrança:\n\n` +
              `💰 *Valor Pago:* ${valorFormatado}\n` +
              `💳 *Forma de Pagamento:* ${formQuitacao.formaPagamento}\n` +
              `📅 *Data:* ${new Date(
                formQuitacao.dataRecebimento
              ).toLocaleDateString("pt-BR")}\n\n` +
              `🎉 *Status:* QUITADO\n\n` +
              `Obrigado pela regularização!\n\n` +
              `Atenciosamente,\n` +
              `Equipe Financeira`;

            await n8nService.enviarWhatsApp({
              number: cobrancaSelecionada.telefone,
              text: mensagemConfirmacao,
              instanceName: "automacoes_3",
              metadata: {
                tipo: "confirmacao_quitacao_detalhada",
                cobrancaId: cobrancaSelecionada.id,
                cliente: nomeFranqueado,
                valorPago: formQuitacao.valorPago,
                formaPagamento: formQuitacao.formaPagamento,
              },
            });

            console.log(
              "Mensagem de confirmação de quitação enviada via WhatsApp"
            );
          } catch (whatsappError) {
            console.warn(
              "Erro ao enviar confirmação via WhatsApp:",
              whatsappError
            );
            // Não interrompe o fluxo principal se o WhatsApp falhar
          }
        }

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
      const resultado = await cobrancaService.quitarCobranca({
        cobrancaId: cobranca.id!,
        valorPago: cobranca.valor_atualizado || cobranca.valor_original,
        formaPagamento: "Não informado",
        dataRecebimento: new Date().toISOString().split("T")[0],
        observacoes: "Quitação rápida via interface",
        usuario,
      });

      if (resultado.sucesso) {
        mostrarMensagem("sucesso", resultado.mensagem);

        // Envia mensagem de confirmação via WhatsApp se houver telefone
        if (cobranca.telefone && resultado.isQuitacaoTotal) {
          try {
            // Busca nome do franqueado para personalização
            const nomeFranqueado = await buscarNomeFranqueado(cobranca.cnpj);

            const valorFormatado = new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(cobranca.valor_atualizado || cobranca.valor_original);

            const mensagemConfirmacao =
              `✅ *CONFIRMAÇÃO DE QUITAÇÃO*\n\n` +
              `Olá, ${nomeFranqueado}! 👋\n\n` +
              `Recebemos o pagamento da sua cobrança:\n\n` +
              `💰 *Valor Pago:* ${valorFormatado}\n` +
              `📅 *Data:* ${new Date().toLocaleDateString("pt-BR")}\n\n` +
              `🎉 *Status:* QUITADO\n\n` +
              `Obrigado pela regularização!\n\n` +
              `Atenciosamente,\n` +
              `Equipe Financeira`;

            await n8nService.enviarWhatsApp({
              number: cobranca.telefone,
              text: mensagemConfirmacao,
              instanceName: "automacoes_3",
              metadata: {
                tipo: "confirmacao_quitacao_rapida",
                cobrancaId: cobranca.id,
                cliente: nomeFranqueado,
                valorPago: cobranca.valor_atualizado || cobranca.valor_original,
                formaPagamento: "Não informado",
              },
            });

            console.log(
              "Mensagem de confirmação de quitação rápida enviada via WhatsApp"
            );
          } catch (whatsappError) {
            console.warn(
              "Erro ao enviar confirmação via WhatsApp:",
              whatsappError
            );
            // Não interrompe o fluxo principal se o WhatsApp falhar
          }
        }

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Filter className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-demibold text-gray-800">Filtros</h3>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFiltrosAvancados(!showFiltrosAvancados)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showFiltrosAvancados
                  ? "Ocultar Filtros Avançados"
                  : "Mostrar Filtros Avançados"}
              </button>
              <button
                onClick={aplicarFiltros}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Aplicar
              </button>
              <button
                onClick={limparFiltros}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-sm"
              >
                Limpar
              </button>
            </div>
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
              <option value="notificado">Notificado</option>
              <option value="em_negociacao">Em Negociação</option>
              <option value="proposta_enviada">Proposta Enviada</option>
              <option value="aguardando_pagamento">Aguardando Pagamento</option>
              <option value="pagamento_parcial">Pagamento Parcial</option>
              <option value="quitado">Quitado</option>
              <option value="ignorado">Ignorado</option>
              <option value="notificacao_formal">Notificação Formal</option>
              <option value="escalado_juridico">Escalado Jurídico</option>
              <option value="inadimplencia_critica">
                Inadimplência Crítica
              </option>
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

          {/* Filtros Avançados */}
          {showFiltrosAvancados && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-700 mb-3">
                Filtros Avançados
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <input
                  type="text"
                  value={filtrosAvancados.nomeUnidade}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      nomeUnidade: e.target.value,
                    })
                  }
                  placeholder="Nome da Unidade"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={filtrosAvancados.cnpj}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      cnpj: e.target.value,
                    })
                  }
                  placeholder="CNPJ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={filtrosAvancados.codigo}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      codigo: e.target.value,
                    })
                  }
                  placeholder="Código da Unidade"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filtrosAvancados.statusCobranca}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      statusCobranca: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Status da Cobrança</option>
                  <option value="em_aberto">Em Aberto</option>
                  <option value="notificado">Notificado</option>
                  <option value="em_negociacao">Em Negociação</option>
                  <option value="proposta_enviada">Proposta Enviada</option>
                  <option value="aguardando_pagamento">
                    Aguardando Pagamento
                  </option>
                  <option value="pagamento_parcial">Pagamento Parcial</option>
                  <option value="quitado">Quitado</option>
                  <option value="ignorado">Ignorado</option>
                  <option value="notificacao_formal">Notificação Formal</option>
                  <option value="escalado_juridico">Escalado Jurídico</option>
                  <option value="inadimplencia_critica">
                    Inadimplência Crítica
                  </option>
                </select>
                <input
                  type="number"
                  value={filtrosAvancados.valorMin}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      valorMin: e.target.value,
                    })
                  }
                  placeholder="Valor mínimo (avançado)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={filtrosAvancados.valorMax}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      valorMax: e.target.value,
                    })
                  }
                  placeholder="Valor máximo (avançado)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filtrosAvancados.tipoCobranca}
                  onChange={(e) =>
                    setFiltrosAvancados({
                      ...filtrosAvancados,
                      tipoCobranca: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tipo de Cobrança</option>
                  <option value="royalties">Royalties</option>
                  <option value="insumos">Insumos</option>
                  <option value="aluguel">Aluguel</option>
                  <option value="multa">Multa</option>
                  <option value="taxa">Taxa</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
            </div>
          )}

          {/* <div className="mt-4 ml-1 flex items-center">
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
          </div> */}
        </div> {/*FIM da DIV de filtros*/}

  {/* Feedback visual via toast - bloco antigo removido */}

        {/* Alternância de visualização */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            Mostrando {cobrancas.length} cobranças
          </div>
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === "cards"
                  ? "bg-white shadow border text-gray-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setViewMode("cards")}
            >
              Cards
            </button>
            <button
              className={`ml-1 px-3 py-1 text-sm rounded-md ${
                viewMode === "lista"
                  ? "bg-white shadow border text-gray-800"
                  : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setViewMode("lista")}
            >
              Lista
            </button>
          </div>
        </div>

        {/* Grid de Cards */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {carregando ? (
              <div className="col-span-full flex items-center justify-center py-12 text-gray-600">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Carregando
                cobranças...
              </div>
            ) : cobrancas.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-12">
                Nenhuma cobrança encontrada
              </div>
            ) : (
              cobrancas.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => abrirModalAcoes(c)}
                  title="Clique para abrir ações"
                >
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                      <Receipt className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-bold text-gray-800 text-sm truncate"
                        title={c.unidades_franqueadas?.nome_unidade || c.cliente}
                      >
                        {c.unidades_franqueadas?.nome_unidade || c.cliente}
                      </div>
                      <div className="text-xs text-gray-500">
                        {unidadesPorCnpj[cnpjKey(c.cnpj)]?.codigo_unidade ||
                          formatarCNPJCPF(c.cnpj)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Valor</div>
                      <div className="text-sm font-semibold text-red-600">
                        {formatarMoeda(c.valor_atualizado || c.valor_original)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Venc.</div>
                      <div className="text-sm text-gray-800">
                        {formatarData(c.data_vencimento)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span
                      className={`px-2 py-1 text-[10px] font-medium rounded-full ${getStatusColor(
                        c.status
                      )}`}
                    >
                      {c.status.replace("_", " ").toUpperCase()}
                    </span>
                    {c.dias_em_atraso && c.dias_em_atraso > 0 && (
                      <span className="text-[10px] text-red-600 font-medium">
                        {c.dias_em_atraso}d atraso
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tabela de Cobranças */}
        {viewMode === "lista" && (
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                        Carregando cobranças...
                      </div>
                    </td>
                  </tr>
                ) : cobrancas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhuma cobrança encontrada
                    </td>
                  </tr>
                ) : (
                  cobrancas.map((cobranca) => (
                    <tr
                      key={cobranca.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => abrirModalAcoes(cobranca)}
                      title="Clique para abrir ações"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {cobranca.unidades_franqueadas?.nome_unidade || cobranca.cliente}
                          </div>
                          <div className="text-sm text-gray-500">
                            {unidadesPorCnpj[cnpjKey(cobranca.cnpj)]
                              ?.codigo_unidade ||
                              formatarCNPJCPF(cobranca.cnpj)}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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
                      Formato aceito: .xlsx
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx"
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

  {/* Modal Unificado de Ações */}
      {modalAberto === "acoes" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-0 max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-6 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Receipt className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-800 leading-tight">
                    {unidadesPorCnpj[cnpjKey(cobrancaSelecionada.cnpj)]
                      ?.nome_franqueado || cobrancaSelecionada.cliente}
                  </div>
                  <div className="text-sm text-gray-500">
                    {unidadesPorCnpj[cnpjKey(cobrancaSelecionada.cnpj)]
                      ?.codigo_unidade ||
                      formatarCNPJCPF(cobrancaSelecionada.cnpj)}{" "}
                    • Venc.: {formatarData(cobrancaSelecionada.data_vencimento)}{" "}
                    • Valor:{" "}
                    {formatarMoeda(
                      cobrancaSelecionada.valor_atualizado ||
                        cobrancaSelecionada.valor_original
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={fecharModal}
                className="text-gray-400 hover:text-gray-700 text-2xl px-2"
                title="Fechar"
              >
                ×
              </button>
            </div>

            {/* Aviso de cobrança quitada */}
            {cobrancaSelecionada.status === "quitado" && (
              <div className="px-8 pt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-semibold text-green-800">Cobrança quitada</div>
                    <p className="text-sm text-green-700">
                      Esta cobrança está quitada. Ações estão desabilitadas. Para realizar novas ações, altere o status para "Em Aberto".
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Abas */}
            <div className="flex border-b px-6">
              {(cobrancaSelecionada.status === "quitado"
                ? ([{ k: "detalhes", label: "Detalhes" }] as const)
                : ([
                    { k: "acoes_rapidas", label: "Ações rápidas" },
                    { k: "simulacao", label: "Simular parcelamento" },
                    { k: "mensagem", label: "Enviar mensagem" },
                    { k: "detalhes", label: "Detalhes" },
                  ] as const)
              ).map((aba) => (
                <button
                  key={aba.k}
                  onClick={() => setAbaAcoes(aba.k)}
                  className={`px-4 py-3 font-medium -mb-px ${
                    abaAcoes === aba.k
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500"
                  }`}
                >
                  {aba.label}
                </button>
              ))}
            </div>

            <div className="px-8 py-6">
              {/* Ações rápidas */}
              {abaAcoes === "acoes_rapidas" && cobrancaSelecionada.status !== "quitado" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => abrirModalEditar(cobrancaSelecionada)}
                      className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Edit className="w-4 h-4 text-blue-600" /> Editar cobrança
                    </button>
                    <button
                      onClick={() => enviarCobranca(cobrancaSelecionada)}
                      className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      disabled={enviandoWhatsapp === cobrancaSelecionada.id}
                    >
                      {enviandoWhatsapp === cobrancaSelecionada.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-green-600" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-green-600" />
                      )}
                      Cobrança amigável (WhatsApp)
                    </button>
                    {cobrancaSelecionada.status === "em_aberto" && (
                      <button
                        onClick={() => marcarQuitadoRapido(cobrancaSelecionada)}
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      >
                        <CheckCircle className="w-4 h-4 text-green-600" />{" "}
                        Marcar quitado (rápido)
                      </button>
                    )}
                    {cobrancaSelecionada.status === "em_aberto" && (
                      <button
                        onClick={() => abrirModalQuitacao(cobrancaSelecionada)}
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      >
                        <Receipt className="w-4 h-4 text-blue-600" /> Quitação
                        detalhada
                      </button>
                    )}
                    <button
                      onClick={() => abrirModalStatus(cobrancaSelecionada)}
                      className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Clock className="w-4 h-4 text-purple-600" /> Alterar
                      status
                    </button>
                    <button
                      onClick={() =>
                        abrirHistoricoEnvios(cobrancaSelecionada.id!)
                      }
                      className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Eye className="w-4 h-4 text-gray-700" /> Ver histórico de
                      envios
                    </button>
                    {podeSimularParcelamento(cobrancaSelecionada) && (
                      <button
                        onClick={() => setAbaAcoes("simulacao")}
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      >
                        <Calculator className="w-4 h-4 text-emerald-600" />{" "}
                        Simular parcelamento
                      </button>
                    )}
                    {/* {podeAcionarJuridico(cobrancaSelecionada) && (
                      <button
                        onClick={() => acionarJuridico(cobrancaSelecionada)}
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      >
                        <Scale className="w-4 h-4 text-red-600" /> Acionar
                        jurídico
                      </button>
                    )} */}
                  </div>
                </div>
              )}

              {/* Simulação de parcelamento */}
              {abaAcoes === "simulacao" && cobrancaSelecionada.status !== "quitado" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-800">
                      Configurar Parcelamento
                    </h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantidade de Parcelas
                      </label>
                      <select
                        value={formSimulacao.quantidade_parcelas}
                        onChange={(e) =>
                          setFormSimulacao({
                            ...formSimulacao,
                            quantidade_parcelas: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n}x
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data da Primeira Parcela *
                      </label>
                      <input
                        type="date"
                        value={formSimulacao.data_primeira_parcela}
                        onChange={(e) =>
                          setFormSimulacao({
                            ...formSimulacao,
                            data_primeira_parcela: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor de Entrada (opcional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formSimulacao.valor_entrada}
                        onChange={(e) =>
                          setFormSimulacao({
                            ...formSimulacao,
                            valor_entrada: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="0,00"
                      />
                    </div>
                    <button
                      onClick={simularParcelamento}
                      disabled={
                        processando || !formSimulacao.data_primeira_parcela
                      }
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {processando ? "Simulando..." : "Simular Parcelamento"}
                    </button>
                  </div>

                  {simulacaoAtual && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 mb-4">
                        Resultado da Simulação
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Valor Original:</span>
                          <span className="font-medium">
                            {formatarMoeda(simulacaoAtual.valor_original)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Valor Atualizado:</span>
                          <span className="font-medium text-red-600">
                            {formatarMoeda(simulacaoAtual.valor_atualizado)}
                          </span>
                        </div>
                        {simulacaoAtual.valor_entrada ? (
                          <div className="flex justify-between">
                            <span>Entrada:</span>
                            <span className="font-medium text-green-600">
                              {formatarMoeda(simulacaoAtual.valor_entrada)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-between">
                          <span>Parcelas:</span>
                          <span className="font-medium">
                            {simulacaoAtual.quantidade_parcelas}x{" "}
                            {formatarMoeda(simulacaoAtual.parcelas[0].valor)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Multa:</span>
                          <span className="font-medium">
                            10% (
                            {formatarMoeda(simulacaoAtual.parcelas[0].multa)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Juros Mora:</span>
                          <span className="font-medium">
                            1.5% (
                            {formatarMoeda(
                              simulacaoAtual.parcelas[0].juros_mora
                            )}
                            )
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-blue-600">
                            {formatarMoeda(
                              simulacaoAtual.valor_total_parcelamento
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 mb-4 mt-3">
                        <h5 className="font-medium mb-2">Cronograma:</h5>
                        <div className="space-y-1 text-sm">
                          {simulacaoAtual.parcelas.map(
                            (parcela: any, index: number) => (
                              <div key={index} className="flex justify-between">
                                <span>
                                  Parcela {parcela.numero} (
                                  {formatarData(parcela.data_vencimento)}):
                                </span>
                                <span className="font-medium">
                                  {formatarMoeda(parcela.valor)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Canais de envio */}
                      <div className="space-y-2 mb-3">
                        <div className="text-sm font-medium text-gray-800">
                          Canais de envio
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={formProposta.canais_envio.includes(
                                "whatsapp"
                              )}
                              onChange={(e) => {
                                setFormProposta((prev) => ({
                                  ...prev,
                                  canais_envio: e.target.checked
                                    ? Array.from(
                                        new Set([
                                          ...prev.canais_envio,
                                          "whatsapp",
                                        ])
                                      )
                                    : prev.canais_envio.filter(
                                        (c) => c !== "whatsapp"
                                      ),
                                }));
                              }}
                            />
                            WhatsApp
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={formProposta.canais_envio.includes(
                                "email"
                              )}
                              onChange={(e) => {
                                setFormProposta((prev) => ({
                                  ...prev,
                                  canais_envio: e.target.checked
                                    ? Array.from(
                                        new Set([...prev.canais_envio, "email"])
                                      )
                                    : prev.canais_envio.filter(
                                        (c) => c !== "email"
                                      ),
                                }));
                              }}
                            />
                            Email
                          </label>
                        </div>
                      </div>
                      <button
                        onClick={gerarProposta}
                        disabled={
                          processando || formProposta.canais_envio.length === 0
                        }
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processando ? "Gerando..." : "Gerar e Enviar Proposta"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Enviar mensagem */}
              {abaAcoes === "mensagem" && cobrancaSelecionada.status !== "quitado" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Canal de envio
                      </label>
                      <select
                        value={formMensagem.canal}
                        onChange={(e) =>
                          setFormMensagem({
                            ...formMensagem,
                            canal: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template
                      </label>
                      <select
                        value={formMensagem.template}
                        onChange={(e) =>
                          setFormMensagem({
                            ...formMensagem,
                            template: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="padrao">Padrão</option>
                        <option value="formal">Formal</option>
                        <option value="urgente">Urgente</option>
                        <option value="personalizada">Personalizada</option>
                      </select>
                    </div>
                    {formMensagem.template === "personalizada" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mensagem Personalizada
                        </label>
                        <textarea
                          value={formMensagem.mensagem_personalizada}
                          onChange={(e) =>
                            setFormMensagem({
                              ...formMensagem,
                              mensagem_personalizada: e.target.value,
                            })
                          }
                          rows={8}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Digite sua mensagem personalizada..."
                        />
                      </div>
                    )}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h5 className="font-medium text-blue-800 mb-2">
                        Variáveis disponíveis:
                      </h5>
                      <div className="text-sm text-blue-700 space-y-1">
                        <div>
                          {"{{"}cliente{"}}"} - Nome do cliente
                        </div>
                        <div>
                          {"{{"}codigo_unidade{"}}"} - Código da unidade
                        </div>
                        <div>
                          {"{{"}valor_original{"}}"} - Valor original
                        </div>
                        <div>
                          {"{{"}valor_atualizado{"}}"} - Valor atualizado
                        </div>
                        <div>
                          {"{{"}data_vencimento{"}}"} - Data de vencimento
                        </div>
                        <div>
                          {"{{"}dias_atraso{"}}"} - Dias em atraso
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={enviarMensagemPersonalizada}
                      disabled={processando}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {processando
                        ? "Enviando..."
                        : `Enviar via ${
                            formMensagem.canal === "whatsapp"
                              ? "WhatsApp"
                              : "Email"
                          }`}
                    </button>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-4">
                      Preview da Mensagem
                    </h4>
                    <div className="bg-white border rounded-lg p-4 min-h-[300px]">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {getPreviewMensagem()}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Detalhes */}
              {abaAcoes === "detalhes" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Cliente
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {cobrancaSelecionada.cliente}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          CNPJ
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Status
                        </label>
                        <span
                          className={`mt-1 inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            cobrancaSelecionada.status
                          )}`}
                        >
                          {cobrancaSelecionada.status
                            .replace("_", " ")
                            .toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Valor Original
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {formatarMoeda(cobrancaSelecionada.valor_original)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Valor Atualizado
                        </label>
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {formatarMoeda(
                            cobrancaSelecionada.valor_atualizado ||
                              cobrancaSelecionada.valor_original
                          )}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Juros/Multa
                        </label>
                        <p className="mt-1 text-sm text-orange-600">
                          {formatarMoeda(calcularJuros(cobrancaSelecionada))}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Data de Vencimento
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {formatarData(cobrancaSelecionada.data_vencimento)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Dias em Atraso
                      </label>
                      <p className="mt-1 text-sm text-red-600">
                        {cobrancaSelecionada.dias_em_atraso || 0} dias
                      </p>
                    </div>
                  </div>

                  {unidadeSelecionada && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Nome do Franqueado
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).nome_franqueado ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Código da Unidade
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).codigo_unidade ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Telefone
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).telefone_franqueado ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Email
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).email_franqueado ||
                              "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Cidade
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).cidade || "N/A"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Estado
                          </label>
                          <p className="mt-1 text-sm text-gray-900">
                            {(unidadeSelecionada as any).estado || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
