/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit, Eye, Upload, Receipt, CheckCircle,
  XCircle, Clock, Filter, RefreshCw, FileText,
  ArrowUp, ArrowDown, AlertTriangle, MessageSquare,
  Handshake, CreditCard, Split, Scale, 
  TrendingDown, CircleDollarSign, ShieldCheck
} from "lucide-react";
import { toast } from "react-hot-toast";
import { CobrancaFranqueado } from "../../types/cobranca";
import { cobrancaService } from "../../services/cobrancaService";
import { n8nService, N8nService } from "../../services/n8nService";
import { formatarCNPJCPF, formatarMoeda, formatarData, } from "../../utils/formatters";
import { UnidadesService } from "../../services/unidadesService";
import type { UnidadeFranqueada } from "../../types/unidades";
import { emailService } from "../../services/emailService";
import { supabase } from "../../services/databaseService";
import { ImportacaoWatcher } from "../../services/importacaoWatcher";

/**
 * Função para aplicar ordenação customizada considerando parcelas
 * Parcelas são ordenadas numericamente (1/18, 2/18, etc.)
 * Outras cobranças são ordenadas alfabeticamente
 */
const aplicarOrdenacaoCustomizada = (
  cobrancas: CobrancaFranqueado[], 
  direcaoOrdenacao: "asc" | "desc"
) => {
  
  // Separa parcelas de outras cobranças
  const parcelas = cobrancas.filter(c => c.status.toLowerCase() === "parcelas");
  const outrasCobranças = cobrancas.filter(c => c.status.toLowerCase() !== "parcelas");
  
  // Ordena parcelas numericamente
  const parcelasOrdenadas = parcelas.sort((a, b) => {
    const extrairNumeroParcela = (cliente: string) => {
      const match = cliente.match(/Parcela (\d+)\/\d+/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const numeroA = extrairNumeroParcela(a.cliente);
    const numeroB = extrairNumeroParcela(b.cliente);
    
    // Para parcelas, sempre ordem crescente independente da direção
    return numeroA - numeroB;
  });
  
  // Ordena outras cobranças alfabeticamente
  const outrasCobrançasOrdenadas = outrasCobranças.sort((a, b) => {
    const nomeA = (a.unidades_franqueadas?.nome_unidade || a.cliente || "").toLowerCase();
    const nomeB = (b.unidades_franqueadas?.nome_unidade || b.cliente || "").toLowerCase();
    
    if (direcaoOrdenacao === "asc") {
      return nomeA.localeCompare(nomeB);
    } else {
      return nomeB.localeCompare(nomeA);
    }
  });  
  // Retorna outras cobranças primeiro, depois parcelas
  return [...outrasCobrançasOrdenadas, ...parcelasOrdenadas];
};

export function GestaoCobrancas() {
  const [cobrancas, setCobrancas] = useState<CobrancaFranqueado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState< "criar" | "editar" | "upload" | "status" | "quitacao" | "acoes" | null>(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<CobrancaFranqueado | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null); //Linha adicionada para 'guardar' o arquivo selecionado
  const [processando, setProcessando] = useState(false); // Linha adicionada para controlar o estado de processamento do upload
  const [usuario] = useState("admin"); // Em produção, pegar do contexto de autenticação
  const [formData, setFormData] = useState<Partial<CobrancaFranqueado>>({});
  const [formQuitacao, setFormQuitacao] = useState({
    valorPago: 0,
    formaPagamento: "",
    observacoes: "",
    dataRecebimento: new Date().toISOString().split("T")[0],
  });
  // Filtros unificados (antes chamados de "avançados")
  const [filtrosAvancados, setFiltrosAvancados] = useState({
    nomeUnidade: "",
    cnpj: "",
    cpf: "",
    codigo: "",
    statusCobranca: "",
    valorMin: "",
    valorMax: "",
    tipoDocumento: "" as "" | "cpf" | "cnpj",
    dataInicio: "",
    dataFim: "",
  });
  const [colunaOrdenacao, setColunaOrdenacao] = useState("cliente"); // Coluna padrão alterada para ativar ordenação customizada
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<"asc" | "desc">("asc"); // Ordenação crescente para funcionar com a ordenação customizada
  //const [mostrarApenasInadimplentes, setMostrarApenasInadimplentes] = useState(false); // Controlar a exibição de inadimplentes
  const [errosImportacao, setErrosImportacao] = useState<string[]>([]);
  const [modalErrosAberto, setModalErrosAberto] = useState(false);
  // Mensagens agora são exibidas via react-hot-toast
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState<string | null>(null); // ID da cobrança sendo enviada
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [historicoEnvios, setHistoricoEnvios] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "lista">("cards");

  // Serviços auxiliares (instâncias)
  const unidadesService = React.useMemo(() => new UnidadesService(), []);
  const [unidadesPorCnpj, setUnidadesPorCnpj] = useState<Record<string, UnidadeFranqueada>>({});
  const cnpjKey = useCallback((cnpj: string) => (cnpj || "").replace(/\D/g, ""), []);
  
  // Flag: desativa a comparação local de planilhas (migração para n8n)
  const COMPARACAO_LOCAL_ATIVA = false;

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
  const [abaAcoes, setAbaAcoes] = useState<
    "acoes_rapidas" | "simulacao" | "mensagem" | "detalhes"
  >("acoes_rapidas");
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any | null>(
    null
  );
  const [formMensagem, setFormMensagem] = useState({
    template: "padrao",
    mensagem_personalizada: "",
    canal: "whatsapp" as "whatsapp" | "email",
  });

  const templatesPadrao = {
    padrao: `Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? Entre em contato conosco.

Telefone: (19) 99595-7880

_Mensagem Automática Sistema de Cobrança_`,

    formal: `Prezado(a) {{cliente}},

Identificamos pendência financeira em aberto referente à sua unidade.

Dados da pendência:
- Valor original: {{valor_original}}
- Valor atualizado: {{valor_atualizado}}
- Data de vencimento: {{data_vencimento}}
- Dias em atraso: {{dias_atraso}}

Solicitamos regularização no prazo de 5 dias úteis.

Entre em contato conosco, telefone: (19) 99595-7880

_Mensagem Automática Sistema de Cobrança_`,

    urgente: `🚨 ATENÇÃO {{cliente}}

Consta um débito VENCIDO há {{dias_atraso}} dias, referente a sua unidade.

💰 Valor: {{valor_atualizado}}
📅 Vencimento: {{data_vencimento}}

*⚠️ Regularize HOJE para evitar bloqueios!*

Entre em contato conosco, telefone: (19) 99595-7880`,
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
      // Monta filtros para o serviço a partir do conjunto unificado
      const filtrosServico: Record<string, unknown> = {};
      if (filtrosAvancados.statusCobranca)
        filtrosServico.status = filtrosAvancados.statusCobranca;
      if (filtrosAvancados.valorMin)
        filtrosServico.valorMin = filtrosAvancados.valorMin;
      if (filtrosAvancados.valorMax)
        filtrosServico.valorMax = filtrosAvancados.valorMax;
      if (filtrosAvancados.dataInicio)
        filtrosServico.dataInicio = filtrosAvancados.dataInicio;
      if (filtrosAvancados.dataFim)
        filtrosServico.dataFim = filtrosAvancados.dataFim;

      const dadosReaisDoBanco = await cobrancaService.buscarCobrancas({
        ...filtrosServico,
        cpf: filtrosAvancados.cpf?.replace(/\D/g, "") || undefined,
        tipoDocumento: filtrosAvancados.tipoDocumento || undefined,
        colunaOrdenacao,
        direcaoOrdenacao,
        //apenasInadimplentes: mostrarApenasInadimplentes,
      });

      // Aplica filtros locais que não são suportados pelo serviço
      let cobrancasFiltradas = dadosReaisDoBanco;

      // Filtro local complementar por tipo de documento (fallback de segurança)
      if (filtrosAvancados.tipoDocumento === "cpf") {
        cobrancasFiltradas = cobrancasFiltradas.filter(
          (c) => !!c.cpf && c.cpf.trim() !== ""
        );
      } else if (filtrosAvancados.tipoDocumento === "cnpj") {
        cobrancasFiltradas = cobrancasFiltradas.filter(
          (c) => !c.cpf || c.cpf.trim() === ""
        );
      }

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
        const cnpjBusca = filtrosAvancados.cnpj.replace(/\D/g, "");
        cobrancasFiltradas = cobrancasFiltradas.filter((cobranca) =>
          (cobranca.cnpj || "").replace(/\D/g, "").includes(cnpjBusca)
        );
      }

      if (filtrosAvancados.cpf) {
        const cpfBusca = filtrosAvancados.cpf.replace(/\D/g, "");
        cobrancasFiltradas = cobrancasFiltradas.filter((cobranca) =>
          (cobranca.cpf || "").replace(/\D/g, "").includes(cpfBusca)
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

      // Aplica ordenação customizada apenas para coluna "cliente" que contém parcelas
      let cobrancasOrdenadas = cobrancasFiltradas;
      
      if (colunaOrdenacao === "cliente") {
        cobrancasOrdenadas = aplicarOrdenacaoCustomizada(cobrancasFiltradas, direcaoOrdenacao);
      } else {
        console.log("❌ Não aplicando ordenação customizada - coluna diferente de cliente");
      }
      
      setCobrancas(cobrancasOrdenadas);

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
    filtrosAvancados,
    colunaOrdenacao,
    direcaoOrdenacao,
    unidadesService,
    cnpjKey,
  ]);

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltrosAvancados({
      nomeUnidade: "",
      cnpj: "",
      cpf: "",
      codigo: "",
      statusCobranca: "",
      valorMin: "",
      valorMax: "",
      tipoDocumento: "",
      dataInicio: "",
      dataFim: "",
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
    setFormMensagem({
      template: "padrao",
      mensagem_personalizada: "",
      canal: "whatsapp",
    });

    // Carrega a unidade priorizando a FK da cobrança
    try {
      // Se a cobrança é de CPF (sem CNPJ válido), não tente buscar unidade por CNPJ
      const isCobrancaCPF =
        !!cobranca.cpf &&
        (!cobranca.cnpj || cobranca.cnpj.replace(/\D/g, "") === "0");

      if (isCobrancaCPF) {
        setUnidadeSelecionada(null);
      } else if (cobranca.unidade_id_fk) {
        const unidade = await unidadesService.buscarUnidadePorId(
          cobranca.unidade_id_fk
        );
        if (unidade) {
          setUnidadeSelecionada(unidade);
        } else {
          // Fallback para cache/consulta por CNPJ
          const cached = unidadesPorCnpj[cnpjKey(cobranca.cnpj)];
          if (cached) {
            setUnidadeSelecionada(cached);
          } else {
            const un = await unidadesService.buscarUnidadePorCnpj(
              cobranca.cnpj
            );
            setUnidadeSelecionada(un);
          }
        }
      } else {
        // Fallback quando a cobrança não vier com unidade_id_fk tipado
        const cached = cobranca.cnpj
          ? unidadesPorCnpj[cnpjKey(cobranca.cnpj)]
          : undefined;
        if (cached) {
          setUnidadeSelecionada(cached);
        } else if (cobranca.cnpj) {
          const un = await unidadesService.buscarUnidadePorCnpj(cobranca.cnpj);
          setUnidadeSelecionada(un);
        } else {
          setUnidadeSelecionada(null);
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
    const isExcel = /\.(xlsx|xls)$/i.test(nome);

    if (!isExcel) {
      // Reseta seleção e avisa via toast chamativo
      setArquivoSelecionado(null);
      event.target.value = "";
      toast.error(
        "Arquivo inválido. Envie uma planilha .xlsx \nO sistema ainda não está pronto para outros formatos!",
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
    // Trava: comparação local desativada (migração para n8n)
    if (!COMPARACAO_LOCAL_ATIVA) {
      toast("Comparação de planilhas ainda não foi implementada!", {
        duration: 5000,
        style: { background: "#7c3aed", color: "#fff" },
      });
      return;
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

    // Trava extra: apenas Excel (.xlsx)
    if (!/\.(xlsx|xls)$/i.test(arquivoSelecionado.name)) {
      toast.error(
        "Arquivo inválido. Envie uma planilha .xlsx \nO sistema ainda não está pronto para outros formatos (ex.: .csv).",
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
        "Planilha recebida! O processamento foi iniciado em segundo plano. Você será notificado aqui no sistema quando terminar."
      );

      // Inicia o agente automático que verifica a conclusão da importação a cada 10s
      const watcherStart = new Date().toISOString();
      ImportacaoWatcher.start({
        startTime: watcherStart,
        origem: "alertas", // por padrão ouvimos alertas_sistema.tipo_alerta = 'importacao_concluida'
        intervaloMs: 10000,
        onComplete: () => {
          // Notifica usuário (toast chamativo)
          toast.success(
            "Importação concluída! As cobranças foram atualizadas.",
            {
              style: { background: "#065f46", color: "#fff" },
            }
          );
          // Dispara evento global para todas as telas ouvirem e recarregarem
          window.dispatchEvent(new CustomEvent("cobrancasAtualizadas"));
        },
        onError: (err) => {
          console.warn("Watcher de importação falhou:", err);
        },
      });
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

  const aplicarVariaveis = async (template: string) => {
    if (!cobrancaSelecionada) return template;

    // Busca nome do franqueado para personalização
    const nomeFranqueado = cobrancaSelecionada.cpf
      ? cobrancaSelecionada.cliente || "Franqueado(a)"
      : await buscarNomeFranqueado(cobrancaSelecionada.cnpj);

    const documentoFormatado = cobrancaSelecionada.cpf
      ? formatarCNPJCPF(cobrancaSelecionada.cpf)
      : formatarCNPJCPF(cobrancaSelecionada.cnpj);

    const variaveis: Record<string, string> = {
      "{{cliente}}": nomeFranqueado,
      // Mantemos a variável por compatibilidade, mas usamos o documento exibível
      // Em cobranças de CPF, não exibimos código; usamos o CPF/CNPJ formatado
      "{{codigo_unidade}}": documentoFormatado,
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
    const documentoFormatado = cobrancaSelecionada?.cpf
      ? formatarCNPJCPF(cobrancaSelecionada?.cpf)
      : formatarCNPJCPF(cobrancaSelecionada?.cnpj || "");
    const variaveis: Record<string, string> = {
      "{{cliente}}": cobrancaSelecionada?.cliente || "Cliente",
      // Para preview, usa o documento formatado; em CPF não mostramos código
      "{{codigo_unidade}}": documentoFormatado || "Documento",
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

  /**
   * Função para salvar a cobrança (criação ou edição)
   */
  const salvarCobranca = async () => {
    // Validação para garantir que os campos obrigatórios estão preenchidos
    const temDocumento =
      !!(formData.cnpj && formData.cnpj.trim() !== "") ||
      !!(formData.cpf && formData.cpf.trim() !== "");
    if (!temDocumento || !formData.cliente || !formData.valor_original) {
      mostrarMensagem(
        "erro",
        "Documento (CPF ou CNPJ), cliente e valor original são obrigatórios."
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
        const dadosAtualizacao: Partial<CobrancaFranqueado> = {
          ...(formData as Partial<CobrancaFranqueado>),
        };
        // Documento não é editável neste modal
        delete (dadosAtualizacao as Partial<CobrancaFranqueado>).cnpj;
        delete (dadosAtualizacao as Partial<CobrancaFranqueado>).cpf;
        delete (dadosAtualizacao as Partial<CobrancaFranqueado>).cliente;
        await cobrancaService.atualizarCobranca(
          cobrancaSelecionada.id,
          dadosAtualizacao
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
      // Para cobranças por CPF (sem CNPJ válido), usa o nome do cliente
      const isCobrancaCPF =
        !!cobranca.cpf && (!cobranca.cnpj || cobranca.cnpj.replace(/\D/g, "") === "0");
      const nomeFranqueado = isCobrancaCPF
        ? cobranca.cliente || "Franqueado(a)"
        : await buscarNomeFranqueado(cobranca.cnpj);

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

      mensagem += `_Mensagem Automática Sistema de Cbrança_`;

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
            const isCobrancaCPF =
              !!cobrancaSelecionada.cpf &&
              (!cobrancaSelecionada.cnpj ||
                cobrancaSelecionada.cnpj.replace(/\D/g, "") === "0");
            const nomeFranqueado = isCobrancaCPF
              ? cobrancaSelecionada.cliente || "Franqueado(a)"
              : await buscarNomeFranqueado(cobrancaSelecionada.cnpj);

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
      const resultado = await cobrancaService.quitarRapido(cobranca.id!, usuario);

      if (resultado.sucesso) {
        mostrarMensagem("sucesso", resultado.mensagem);

        // Envia mensagem de confirmação via WhatsApp se houver telefone
        if (cobranca.telefone && resultado.isQuitacaoTotal) {
          try {
            // Busca nome do franqueado para personalização
            const isCobrancaCPF =
              !!cobranca.cpf && (!cobranca.cnpj || cobranca.cnpj.replace(/\D/g, "") === "0");
            const nomeFranqueado = isCobrancaCPF
              ? cobranca.cliente || "Franqueado(a)"
              : await buscarNomeFranqueado(cobranca.cnpj);

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
   * Função para isentar juros e multa de uma cobrança
   * Remove juros e multa zerando os dias em atraso
   */
  const isentarJurosMulta = async (cobranca: CobrancaFranqueado) => {
    // Verificar se há juros/multa para isentar
    if (!cobranca.valor_atualizado || cobranca.valor_atualizado <= cobranca.valor_original) {
      mostrarMensagem("info", "Esta cobrança não possui juros ou multa para isentar.");
      return;
    }

    const valorJurosMulta = cobranca.valor_atualizado - cobranca.valor_original;
    const valorJurosMultaFormatado = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valorJurosMulta);

    // Confirmar a ação
    const confirmar = window.confirm(
      `Deseja realmente isentar os juros e multa desta cobrança?\n\n` +
      `Valor dos juros/multa: ${valorJurosMultaFormatado}\n\n` +
      `Após a isenção, o valor da cobrança voltará ao valor original.`
    );

    if (!confirmar) {
      return;
    }

    setCarregandoAcao(true);
    
    try {
      // Atualizar a cobrança zerando os dias em atraso E o valor atualizado
      // Fazemos ambos para garantir que funcione independentemente da trigger
      const { error } = await supabase
        .from('cobrancas_franqueados')
        .update({ 
          dias_em_atraso: 0,
          valor_atualizado: cobranca.valor_original, // Volta para o valor original
          data_ultima_atualizacao: new Date().toISOString()
        })
        .eq('id', cobranca.id);

      if (error) {
        throw error;
      }

      // Log simples da ação
      console.log('Isenção de juros/multa aplicada:', {
        cobrancaId: cobranca.id,
        cliente: cobranca.cliente,
        valorOriginal: cobranca.valor_original,
        valorAnterior: cobranca.valor_atualizado,
        valorJurosMultaIsentado: valorJurosMulta,
        usuario: usuario,
        timestamp: new Date().toISOString()
      });

      mostrarMensagem("sucesso", `Juros e multa isentados com sucesso! Valor liberado: ${valorJurosMultaFormatado}`);
      
      // Atualiza o estado local imediatamente para reflexo visual instantâneo
      setCobrancas(cobrancasAtuais => 
        cobrancasAtuais.map(c => 
          c.id === cobranca.id 
            ? { 
                ...c, 
                dias_em_atraso: 0, 
                valor_atualizado: cobranca.valor_original,
                data_ultima_atualizacao: new Date().toISOString()
              }
            : c
        )
      );

      // Atualiza também a cobrança selecionada se estiver no modal
      if (cobrancaSelecionada?.id === cobranca.id) {
        setCobrancaSelecionada({
          ...cobrancaSelecionada,
          dias_em_atraso: 0,
          valor_atualizado: cobranca.valor_original,
          data_ultima_atualizacao: new Date().toISOString()
        } as CobrancaFranqueado);
      }

      // Recarrega os dados do servidor para garantir sincronização
      setTimeout(() => {
        carregarCobrancas();
      }, 500);
      
    } catch (error) {
      console.error("Erro ao isentar juros e multa:", error);
      mostrarMensagem("erro", `Erro ao isentar juros e multa: ${error}`);
    } finally {
      setCarregandoAcao(false);
    }
  };

  /**
   * Função para verificar se uma cobrança teve juros e multa isentados
   * Uma cobrança é considerada isentada quando:
   * - dias_em_atraso = 0 
   * - valor_atualizado = valor_original
   * - status é "em_aberto" ou "em_negociacao" (não foi quitada)
   */
  const isCobrancaIsentada = (cobranca: CobrancaFranqueado): boolean => {
    return (
      cobranca.dias_em_atraso === 0 &&
      cobranca.valor_atualizado === cobranca.valor_original &&
      (cobranca.status === "em_aberto" || cobranca.status === "em_negociacao") &&
      // Verificação adicional: data de vencimento já passou (estava em atraso)
      new Date(cobranca.data_vencimento) < new Date()
    );
  };

  /**
   * Função para obter o ícone de status, conforme o status da cobrança
   * Ícones alinhados com o contexto de cada status
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "quitado":
        return <CheckCircle className="w-5 h-5 text-[#2EBF11]" />;
      case "em_negociacao":
      case "negociando":
        return <Handshake className="w-5 h-5 text-[#F59E0B]" />;
      case "parcelado":
        return <CreditCard className="w-5 h-5 text-[#7031AF]" />;
      case "parcelas":
        return <Split className="w-5 h-5 text-[#8B5CF6]" />;
      case "juridico":
        return <Scale className="w-5 h-5 text-[#31A3FB]" />;
      case "inadimplencia":
        return <AlertTriangle className="w-5 h-5 text-[#8d4925]" />;
      case "em_aberto":
        return <XCircle className="w-5 h-5 text-[#6B7280]" />;
      case "perda":
        return <TrendingDown className="w-5 h-5 text-[#FF0A0E]" />;
      default:
        return <CircleDollarSign className="w-5 h-5 text-gray-600" />;
    }
  };

  /**
   * Função para obter a cor de status, conforme o status da cobrança
   * Cores alinhadas com as colunas do Kanban para consistência visual
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case "quitado":
        return "bg-[#2EBF1120] text-[#2EBF11]";
      case "em_negociacao":
      case "negociando":
        return "bg-[#f59f0b20] text-[#F59E0B]";
      case "parcelado":
        return "bg-[#7031af20] text-[#7031AF]";
      case "parcelas":
        return "bg-[#8B5CF620] text-[#8B5CF6]";
      case "juridico":
        return "bg-[#31A3FB20] text-[#31A3FB]";
      case "inadimplencia":
        return "bg-[#8d492520] text-[#8d4925]";
      case "em_aberto":
        return "bg-[#6B728020] text-[#6B7280]";
      case "perda":
        return "bg-[#FF0A0E20] text-[#FF0A0E]";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  /**
   * Função para mapear o status do banco para o texto de exibição no front-end
   * Permite personalizar a exibição sem alterar os valores no banco de dados
   */
  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case "quitado":
        return "QUITADO";
      case "em_negociacao":
      case "negociando":
        return "EM NEGOCIAÇÃO";
      case "parcelado":
        return "PARCELADO";
      case "parcelas":
        return "PARCELAS";
      case "juridico":
        return "JURÍDICO";
      case "inadimplencia":
        return "INADIMPLÊNCIA";
      case "em_aberto":
        return "ATRASADAS";
      case "perda":
        return "PERDA";
      default:
        return status.toUpperCase();
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
            <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
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
              className="flex items-center px-4 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#6b3a10] transition-colors duration-300"
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
                onClick={limparFiltros}
                className="px-4 py-2 bg-[#6b3a10] text-white rounded-lg hover:bg-[#a35919] text-sm transition-colors duration-300"
              >
                Limpar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <option value="">Todos os Status</option>
              <option value="em_aberto">Atrasadas</option>
              <option value="em_negociacao">Em Negociação</option>
              <option value="parcelado">Parcelado</option>
              <option value="parcelas">Parcelas</option>
              <option value="juridico">Jurídico</option>
              <option value="inadimplencia">Inadimplência</option>
              <option value="perda">Perda</option>
              <option value="quitado">Quitado</option>
            </select>
            <select
              value={filtrosAvancados.tipoDocumento}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  tipoDocumento: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Documento: todos</option>
              <option value="cnpj">CNPJ</option>
              <option value="cpf">CPF</option>
            </select>
            <input
              type="date"
              value={filtrosAvancados.dataInicio}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  dataInicio: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filtrosAvancados.dataFim}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  dataFim: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              value={filtrosAvancados.valorMin}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  valorMin: e.target.value,
                })
              }
              placeholder="Valor mínimo"
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
              placeholder="Valor máximo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {/* Campos adicionais trazidos dos filtros avançados */}
            <input
              type="text"
              value={filtrosAvancados.nomeUnidade}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  nomeUnidade: e.target.value,
                })
              }
              placeholder="Franqueado/Unidade"
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
              value={filtrosAvancados.cpf}
              onChange={(e) =>
                setFiltrosAvancados({
                  ...filtrosAvancados,
                  cpf: e.target.value,
                })
              }
              placeholder="CPF"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Fim filtros unificados */}
        </div>{" "}
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
                        title={
                          c.unidades_franqueadas?.nome_unidade || c.cliente
                        }
                      >
                        {c.unidades_franqueadas?.nome_unidade || c.cliente}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.cpf
                          ? `${formatarCNPJCPF(c.cpf)} • CPF`
                          : `${formatarCNPJCPF(c.cnpj)} • CNPJ`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500">Valor</div>
                      <div className={`text-sm font-semibold ${
                        isCobrancaIsentada(c) 
                          ? 'text-blue-600' 
                          : 'text-red-600'
                      }`}>
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
                      {getStatusDisplayText(c.status)}
                    </span>
                    {isCobrancaIsentada(c) ? (
                      <span className="text-[10px] text-blue-600 font-medium">
                        Isentado Juros/Multa
                      </span>
                    ) : c.dias_em_atraso === 0 ? (
                      <span className="text-[10px] text-green-600 font-medium">
                        Em Dia
                      </span>
                    ) : c.dias_em_atraso && c.dias_em_atraso > 0 ? (
                      <span className="text-[10px] text-red-600 font-medium">
                        {c.dias_em_atraso}d atraso
                      </span>
                    ) : null}
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
                            {cobranca.unidades_franqueadas?.nome_unidade ||
                              cobranca.cliente}
                          </div>
                          <div className="text-sm text-gray-500">
                            {cobranca.cpf
                              ? `${formatarCNPJCPF(cobranca.cpf)} • CPF`
                              : `${formatarCNPJCPF(cobranca.cnpj)} • CNPJ`}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarMoeda(cobranca.valor_original)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-bold ${
                          isCobrancaIsentada(cobranca) 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                        }`}>
                          {formatarMoeda(
                            cobranca.valor_atualizado || cobranca.valor_original
                          )}
                        </div>
                        {isCobrancaIsentada(cobranca) ? (
                          <div className="text-xs text-blue-600 font-medium">
                            Isentado Juros/Multa
                          </div>
                        ) : cobranca.dias_em_atraso === 0 ? (
                          <div className="text-xs text-green-600 font-medium">
                            Em Dia
                          </div>
                        ) : cobranca.dias_em_atraso && cobranca.dias_em_atraso > 0 ? (
                          <div className="text-xs text-red-500 font-medium">
                            {cobranca.dias_em_atraso} dias de atraso
                          </div>
                        ) : null}
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
                            {getStatusDisplayText(cobranca.status)}
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
              {modalAberto === "editar" && (
                <div className="flex items-start p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800">
                  <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">
                    Por segurança, os campos{" "}
                    <strong>Documento (CPF/CNPJ)</strong> e{" "}
                    <strong>Cliente</strong> não podem ser editados neste modal.
                    Caso precise corrigir a vinculação, ajuste os dados da
                    unidade/franqueado.
                  </p>
                </div>
              )}
              {(() => {
                const isEditCpf =
                  modalAberto === "editar" &&
                  !!cobrancaSelecionada?.cpf &&
                  (!cobrancaSelecionada?.cnpj ||
                    cobrancaSelecionada?.cnpj.replace(/\D/g, "") === "0");
                const label = isEditCpf ? "CPF *" : "CNPJ *";
                const placeholder = isEditCpf
                  ? "000.000.000-00"
                  : "00.000.000/0000-00";

                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={
                        isEditCpf ? formData.cpf || "" : formData.cnpj || ""
                      }
                      onChange={(e) =>
                        setFormData(
                          isEditCpf
                            ? { ...formData, cpf: e.target.value }
                            : { ...formData, cnpj: e.target.value }
                        )
                      }
                      disabled={modalAberto === "editar"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={placeholder}
                    />
                  </div>
                );
              })()}

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
                  disabled={modalAberto === "editar"}
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
                      <option value="em_aberto">Atrasadas</option>
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
                disabled={(() => {
                  const temDocumento =
                    !!(formData.cnpj && formData.cnpj.trim() !== "") ||
                    !!(formData.cpf && formData.cpf.trim() !== "");
                  return (
                    !temDocumento ||
                    !formData.cliente ||
                    !formData.valor_original ||
                    (formData.status === "quitado" && !formData.valor_recebido)
                  );
                })()}
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
                  Documento:{" "}
                  {cobrancaSelecionada.cpf
                    ? formatarCNPJCPF(cobrancaSelecionada.cpf)
                    : formatarCNPJCPF(cobrancaSelecionada.cnpj)}
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
                  <option value="em_aberto">Atrasadas</option>
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
                disabled={processando}
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
                    {unidadeSelecionada?.nome_franqueado ||
                      cobrancaSelecionada.cliente}
                  </div>
                  <div className="text-sm text-gray-500">
                    {cobrancaSelecionada.cpf
                      ? `${formatarCNPJCPF(cobrancaSelecionada.cpf)} • CPF`
                      : `${formatarCNPJCPF(
                          cobrancaSelecionada.cnpj
                        )} • CNPJ`}{" "}
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
                    <div className="font-semibold text-green-800">
                      Cobrança quitada
                    </div>
                    <p className="text-sm text-green-700">
                      Esta cobrança está quitada. Ações estão desabilitadas.
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
              {abaAcoes === "acoes_rapidas" &&
                cobrancaSelecionada.status !== "quitado" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => abrirModalEditar(cobrancaSelecionada)}
                        className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                      >
                        <Edit className="w-4 h-4 text-blue-600" /> Editar
                        cobrança
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
                          onClick={() =>
                            marcarQuitadoRapido(cobrancaSelecionada)
                          }
                          className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />{" "}
                          Marcar quitado (rápido)
                        </button>
                      )}
                      {cobrancaSelecionada.status === "em_aberto" && (
                        <button
                          onClick={() =>
                            abrirModalQuitacao(cobrancaSelecionada)
                          }
                          className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50"
                        >
                          <Receipt className="w-4 h-4 text-blue-600" /> Quitação
                          detalhada
                        </button>
                      )}
                      {(cobrancaSelecionada.status === "em_aberto" || cobrancaSelecionada.status === "em_negociacao") && 
                       cobrancaSelecionada.valor_atualizado && 
                       cobrancaSelecionada.valor_atualizado > cobrancaSelecionada.valor_original && (
                        <button
                          onClick={() => isentarJurosMulta(cobrancaSelecionada)}
                          disabled={carregandoAcao}
                          className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {carregandoAcao ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-orange-600" />
                          )}
                          Isentar juros/multa
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
                        <Eye className="w-4 h-4 text-gray-700" /> Ver histórico
                        de envios
                      </button>
                    </div>
                  </div>
                )}

              {/* Enviar mensagem */}
              {abaAcoes === "mensagem" &&
                cobrancaSelecionada.status !== "quitado" && (
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
                          Documento
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {cobrancaSelecionada.cpf
                            ? `${formatarCNPJCPF(cobrancaSelecionada.cpf)} • CPF`
                            : `${formatarCNPJCPF(cobrancaSelecionada.cnpj)} • CNPJ`}
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
                        <p className={`mt-1 text-sm font-medium ${
                          isCobrancaIsentada(cobrancaSelecionada) 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                        }`}>
                          {formatarMoeda(
                            cobrancaSelecionada.valor_atualizado ||
                              cobrancaSelecionada.valor_original
                          )}
                        </p>
                        {isCobrancaIsentada(cobrancaSelecionada) && (
                          <p className="mt-1 text-xs text-blue-600 font-medium">
                            ✓ Juros e multa isentados
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Juros/Multa
                        </label>
                        <p className={`mt-1 text-sm ${
                          isCobrancaIsentada(cobrancaSelecionada) 
                            ? 'text-blue-600' 
                            : 'text-orange-600'
                        }`}>
                          {isCobrancaIsentada(cobrancaSelecionada) 
                            ? 'R$ 0,00 (isentado)' 
                            : formatarMoeda(calcularJuros(cobrancaSelecionada))
                          }
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
                      <p className={`mt-1 text-sm ${
                        isCobrancaIsentada(cobrancaSelecionada) 
                          ? 'text-blue-600' 
                          : (cobrancaSelecionada.dias_em_atraso || 0) > 0 
                            ? 'text-red-600' 
                            : 'text-green-600'
                      }`}>
                        {isCobrancaIsentada(cobrancaSelecionada) 
                          ? 'Isentado (Juros/Multa)'
                          : (cobrancaSelecionada.dias_em_atraso || 0) > 0 
                            ? `${cobrancaSelecionada.dias_em_atraso} dias` 
                            : 'Em Dia'
                        }
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
