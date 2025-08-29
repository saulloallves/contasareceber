/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Scale,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Users,
  Settings,
  Plus,
  Upload,
} from "lucide-react";
import { WhatsAppIcon } from "./ui/WhatsAppIcon";
import { JuridicoService } from "../services/juridicoService";
import { FiltrosJuridico, EstatisticasJuridico } from "../types/juridico";
import { reunioesJuridicoService } from "../services/reunioesJuridicoService";
import { toast } from 'react-hot-toast';
import { supabase } from "../services/databaseService";

export function PainelJuridico() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    | "escalonamentos"
    | "reunioes"
    | "notificacoes"
    | "documentos"
    | "log"
    | "configuracao"
  >("escalonamentos");
  const [escalonamentos, setEscalonamentos] = useState<any[]>([]);
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosJuridico>({});
  const [modalAberto, setModalAberto] = useState<
    "notificacao" | "termo" | "status" | "resposta" | "upload" | null
  >(null);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasJuridico>({
    total_notificados: 0,
    total_em_analise: 0,
    total_resolvidos: 0,
    valor_total_acionado: 0,
    taxa_resposta_notificacoes: 0,
    tempo_medio_resolucao: 0,
    por_motivo: {},
    evolucao_mensal: [],
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [reunioesJuridico, setReunioesJuridico] = useState<any[]>([]);
  const [carregandoReunioes, setCarregandoReunioes] = useState(false);
  const [editandoReuniaoId, setEditandoReuniaoId] = useState<string | null>(
    null
  );
  const [presencaTemp, setPresencaTemp] = useState<boolean | null>(null);
  const [tratativaTemp, setTratativaTemp] = useState<string>("");

  const juridicoService = useMemo(() => new JuridicoService(), []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const statsData = await juridicoService.buscarEstatisticas();
      setEstatisticas(statsData);

      switch (abaSelecionada) {
        case "escalonamentos": {
          const escalonamentosData =
            await juridicoService.buscarEscalonamentosAtivos(filtros);
          setEscalonamentos(escalonamentosData);
          break;
        }
        case "notificacoes": {
          const notificacoesData = await juridicoService.buscarNotificacoes(
            filtros
          );
          setNotificacoes(notificacoesData);
          break;
        }
        case "log": {
          const logsData = await juridicoService.buscarLogJuridico(filtros);
          setLogs(logsData);
          break;
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  }, [abaSelecionada, filtros, juridicoService]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Carregar reuniões jurídicas ao montar
  useEffect(() => {
    async function fetchReunioes() {
      setCarregandoReunioes(true);
      try {
        const dados = await reunioesJuridicoService.listarReunioesJuridico();
        setReunioesJuridico(dados);
      } catch (e) {
        setReunioesJuridico([]);
      } finally {
        setCarregandoReunioes(false);
      }
    }
    fetchReunioes();
  }, []);

  const abrirModalNotificacao = (unidade?: any) => {
    setItemSelecionado(unidade);
    setFormData({
      cnpj_unidade: unidade?.codigo_unidade || "",
      tipo_notificacao: "extrajudicial",
      observacoes: "",
    });
    setModalAberto("notificacao");
  };

  const abrirModalTermo = (unidade?: any) => {
    setItemSelecionado(unidade);
    setFormData({
      cnpj_unidade: unidade?.codigo_unidade || "",
      valor_original: unidade?.valor_total_envolvido || 0,
      valor_acordado: 0,
      forma_pagamento: "vista",
      multa_descumprimento: 10,
    });
    setModalAberto("termo");
  };

  const abrirModalStatus = (unidade: any) => {
    setItemSelecionado(unidade);
    setFormData({
      status: unidade.juridico_status,
      observacoes: "",
    });
    setModalAberto("status");
  };

  const abrirModalResposta = (notificacao: any) => {
    setItemSelecionado(notificacao);
    setFormData({
      observacoes_resposta: "",
    });
    setModalAberto("resposta");
  };

  const abrirModalUpload = () => {
    setFormData({
      cnpj_unidade: "",
      tipo_documento: "outros",
      titulo: "",
      observacoes: "",
    });
    setArquivo(null);
    setModalAberto("upload");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setItemSelecionado(null);
    setFormData({});
    setArquivo(null);
  };

  const gerarNotificacao = async () => {
    if (!formData.cnpj_unidade || !formData.tipo_notificacao) {
      toast.error("CNPJ e tipo de notificação são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await juridicoService.gerarNotificacaoExtrajudicial(
        formData.cnpj_unidade,
        formData.tipo_notificacao,
        formData.observacoes,
        "usuario_atual"
      );
  fecharModal();
  carregarDados();
  toast.success("Notificação extrajudicial gerada com sucesso!");
    } catch (error) {
  toast.error(`Erro ao gerar notificação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const gerarTermo = async () => {
    if (!formData.cnpj_unidade || !formData.valor_acordado) {
      toast.error("CNPJ e valor acordado são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await juridicoService.gerarTermoAcordo(
        formData.cnpj_unidade,
        formData,
        "usuario_atual"
      );
  fecharModal();
  carregarDados();
  toast.success("Termo de acordo gerado com sucesso!");
    } catch (error) {
  toast.error(`Erro ao gerar termo: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const atualizarStatus = async () => {
    if (!formData.status) {
      toast.error("Status é obrigatório");
      return;
    }

    setProcessando(true);
    try {
      await juridicoService.atualizarStatusJuridico(
        itemSelecionado.codigo_unidade,
        formData.status,
        formData.observacoes,
        "usuario_atual"
      );
      fecharModal();
      carregarDados();
    } catch (error) {
  toast.error(`Erro ao atualizar status: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const marcarRespondida = async () => {
    if (!formData.observacoes_resposta) {
      toast.error("Observações da resposta são obrigatórias");
      return;
    }

    setProcessando(true);
    try {
      await juridicoService.marcarNotificacaoRespondida(
        itemSelecionado.id,
        formData.observacoes_resposta,
        "usuario_atual"
      );
      fecharModal();
      carregarDados();
    } catch (error) {
  toast.error(`Erro ao marcar resposta: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const encaminharParaJudicial = async (cnpjUnidade: string) => {
    const observacoes = prompt(
      "Observações sobre o encaminhamento para ação judicial:"
    );
    if (!observacoes) return;

    try {
      await juridicoService.encaminharParaAcaoJudicial(
        cnpjUnidade,
        observacoes,
        "usuario_atual"
      );
  toast.success("Unidade encaminhada para ação judicial!");
      carregarDados();
    } catch (error) {
  toast.error(`Erro ao encaminhar: ${error}`);
    }
  };

  const baixarPDF = async (notificacao: any) => {
    try {
      const blob = await juridicoService.gerarDocumentoPDF(notificacao.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notificacao-extrajudicial-${notificacao.cnpj_unidade}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error("Erro ao baixar PDF");
    }
  };

  const enviarNotificacao = async (notificacao: any) => {
    try {
      const sucesso = await juridicoService.enviarNotificacaoEmail(
        notificacao.id
      );
      if (sucesso) {
        toast.success("Notificação enviada com sucesso!");
        carregarDados();
      } else {
        toast.error("Erro ao enviar notificação");
      }
    } catch (error) {
      toast.error("Erro ao enviar notificação");
    }
  };

  const exportarDados = async () => {
    try {
      const csv = await juridicoService.exportarDadosJuridicos(filtros);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dados-juridicos-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error("Erro ao exportar dados");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "regular":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "pendente_grave":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "notificado":
        return <FileText className="w-5 h-5 text-orange-600" />;
      case "em_analise":
        return <Eye className="w-5 h-5 text-blue-600" />;
      case "pre_processo":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "acionado":
        return <Scale className="w-5 h-5 text-red-700" />;
      case "resolvido":
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "regular":
        return "bg-green-100 text-green-800";
      case "pendente_grave":
        return "bg-yellow-100 text-yellow-800";
      case "notificado":
        return "bg-orange-100 text-orange-800";
      case "em_analise":
        return "bg-blue-100 text-blue-800";
      case "pre_processo":
        return "bg-red-100 text-red-800";
      case "acionado":
        return "bg-red-100 text-red-800";
      case "resolvido":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  // Função para salvar presença/tratativa
  async function salvarPresencaTratativa(id: string) {
    if (presencaTemp === null) {
      toast.error("Selecione presença ou ausência.");
      return;
    }
    setProcessando(true);
    try {
      await reunioesJuridicoService.atualizarPresencaTratativa(
        id,
        presencaTemp,
        tratativaTemp
      );
      setEditandoReuniaoId(null);
      setPresencaTemp(null);
      setTratativaTemp("");
      // Atualiza lista
      const dados = await reunioesJuridicoService.listarReunioesJuridico();
      setReunioesJuridico(dados);
    } catch (e) {
      toast.error("Erro ao salvar presença/tratativa");
    } finally {
      setProcessando(false);
    }
  }

  // Função para enviar WhatsApp jurídico e registrar
  async function enviarWhatsAppJuridico(notificacao: any) {
    setProcessando(true);
    try {
      const numeroOriginal =
        notificacao.unidades_franqueadas?.telefone_franqueado;
      if (!numeroOriginal) throw new Error("Telefone não cadastrado");
      let numero = numeroOriginal.replace(/\D/g, ""); // remove tudo que não for número
      if (!numero.startsWith("55")) {
        numero = "55" + numero;
      }
      const mensagem = notificacao.conteudo_notificacao;
      // Envia WhatsApp
      // await evolutionApiService.sendTextMessage({
      //   instanceName: "automacoes_backup",
      //   number: numero,
      //   text: mensagem,
      // });
      // Registra envio
      await supabase.from("envios_mensagem").insert({
        canal: "whatsapp",
        destinatario: numero,
        mensagem_enviada: mensagem,
        status_envio: "sucesso",
        data_envio: new Date().toISOString(),
        tipo_envio: "juridico",
        referencia: notificacao.id,
        cnpj: notificacao.cnpj_unidade,
      });
  toast.success("WhatsApp enviado com sucesso!");
      carregarDados();
    } catch (error) {
  toast.error("Erro ao enviar WhatsApp: " + error);
    } finally {
      setProcessando(false);
    }
  }

  // Função para buscar notificações multicanal jurídicas
  async function buscarNotificacoesJuridicas(filtros: any) {
    // Busca e-mail e WhatsApp
    const { data, error } = await supabase
      .from("envios_mensagem")
      .select("*", { count: "exact" })
      .eq("tipo_envio", "juridico")
      .order("data_envio", { ascending: false });
    if (error) return [];
    return data || [];
  }

  // Substitua a busca de notificações na useEffect:
  useEffect(() => {
    async function fetchNotificacoes() {
      setCarregando(true);
      try {
        const notificacoesData = await buscarNotificacoesJuridicas(filtros);
        setNotificacoes(notificacoesData);
      } catch {
        setNotificacoes([]);
      } finally {
        setCarregando(false);
      }
    }
    if (abaSelecionada === "notificacoes") fetchNotificacoes();
  }, [abaSelecionada, filtros]);

  const abas = [
    { id: "escalonamentos", label: "Escalonamentos Ativos", icon: Users },
    { id: "reunioes", label: "Reuniões Jurídicas", icon: Clock },
    { id: "notificacoes", label: "Notificações", icon: FileText },
    { id: "documentos", label: "Documentos", icon: Upload },
    { id: "log", label: "Log de Ações", icon: Clock },
    { id: "configuracao", label: "Configuração", icon: Settings },
  ];

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Scale className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Painel Jurídico
              </h1>
              <p className="text-gray-600">
                Escalonamentos, ações e documentos jurídicos
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={abrirModalNotificacao}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              Nova Notificação
            </button>
            <button
              onClick={abrirModalTermo}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Termo de Acordo
            </button>
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {estatisticas.total_notificados}
            </div>
            <div className="text-sm text-orange-800">Notificados</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {estatisticas.total_em_analise}
            </div>
            <div className="text-sm text-blue-800">Em Análise</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {estatisticas.total_resolvidos}
            </div>
            <div className="text-sm text-green-800">Resolvidos</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">
              {formatarMoeda(estatisticas.valor_total_acionado)}
            </div>
            <div className="text-sm text-red-800">Valor Acionado</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {estatisticas.taxa_resposta_notificacoes.toFixed(1)}%
            </div>
            <div className="text-sm text-purple-800">Taxa Resposta</div>
          </div>
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {abas.map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? "border-red-500 text-red-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {aba.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {abaSelecionada === "escalonamentos" && (
              <select
                value={filtros.juridico_status || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, juridico_status: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Todos os Status</option>
                <option value="pendente_grave">Pendente Grave</option>
                <option value="notificado">Notificado</option>
                <option value="em_analise">Em Análise</option>
                <option value="pre_processo">Pré-Processo</option>
                <option value="acionado">Acionado</option>
                <option value="resolvido">Resolvido</option>
              </select>
            )}

            <input
              type="text"
              value={filtros.cnpj || ""}
              onChange={(e) => setFiltros({ ...filtros, cnpj: e.target.value })}
              placeholder="CNPJ"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />

            <input
              type="date"
              value={filtros.dataInicio || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, dataInicio: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />

            <input
              type="date"
              value={filtros.dataFim || ""}
              onChange={(e) =>
                setFiltros({ ...filtros, dataFim: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />

            <button
              onClick={() => setFiltros({})}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Conteúdo das abas */}
        {abaSelecionada === "escalonamentos" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status Jurídico
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Envolvido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipos de Cobrança
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Último Acionamento
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
                      <RefreshCw className="w-6 h-6 animate-spin text-red-600 mx-auto" />
                    </td>
                  </tr>
                ) : escalonamentos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhum escalonamento ativo
                    </td>
                  </tr>
                ) : (
                  escalonamentos.map((unidade) => (
                    <tr
                      key={unidade.codigo_unidade}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {unidade.nome_franqueado}
                          </div>
                          <div className="text-sm text-gray-500">
                            {unidade.codigo_unidade}
                          </div>
                          <div className="text-sm text-gray-500">
                            {unidade.cidade}/{unidade.estado}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(unidade.juridico_status)}
                          <span
                            className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              unidade.juridico_status
                            )}`}
                          >
                            {unidade.juridico_status
                              .replace("_", " ")
                              .toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-red-600">
                          {formatarMoeda(unidade.valor_total_envolvido)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {unidade.tentativas_negociacao} tentativas
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {unidade.tipos_cobranca.join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {unidade.data_ultimo_acionamento
                          ? formatarData(unidade.data_ultimo_acionamento)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => abrirModalStatus(unidade)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Atualizar status"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => abrirModalNotificacao(unidade)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Gerar notificação"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {unidade.juridico_status === "em_analise" && (
                            <button
                              onClick={() =>
                                encaminharParaJudicial(unidade.codigo_unidade)
                              }
                              className="text-red-600 hover:text-red-900"
                              title="Encaminhar para ação judicial"
                            >
                              <Scale className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {abaSelecionada === "reunioes" && (
          <div className="overflow-x-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-red-600" /> Gestão de Reuniões
              Jurídicas
            </h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Unidade
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Data/Hora
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Link
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Presença
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Tratativas
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carregandoReunioes ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4">
                      <RefreshCw className="w-6 h-6 animate-spin text-red-600 mx-auto" />
                    </td>
                  </tr>
                ) : reunioesJuridico.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-500">
                      Nenhuma reunião jurídica encontrada
                    </td>
                  </tr>
                ) : (
                  reunioesJuridico.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {r.unidades_franqueadas?.nome_franqueado || "-"}
                        <br />
                        <span className="text-xs text-gray-500">
                          {r.unidades_franqueadas?.codigo_unidade || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {r.data_hora_reuniao
                          ? formatarData(r.data_hora_reuniao)
                          : "-"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {r.link_calendly ? (
                          <a
                            href={r.link_calendly}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            Agendar
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {editandoReuniaoId === r.id ? (
                          <select
                            value={
                              presencaTemp === null
                                ? ""
                                : presencaTemp
                                ? "sim"
                                : "nao"
                            }
                            onChange={(e) =>
                              setPresencaTemp(e.target.value === "sim")
                            }
                            className="border rounded px-2 py-1"
                          >
                            <option value="">Selecione</option>
                            <option value="sim">Compareceu</option>
                            <option value="nao">Não Compareceu</option>
                          </select>
                        ) : r.presenca_franqueado === true ? (
                          <span className="text-green-700 font-semibold">
                            Compareceu
                          </span>
                        ) : r.presenca_franqueado === false ? (
                          <span className="text-red-700 font-semibold">
                            Ausente
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {editandoReuniaoId === r.id ? (
                          <textarea
                            value={tratativaTemp}
                            onChange={(e) => setTratativaTemp(e.target.value)}
                            rows={2}
                            className="border rounded px-2 py-1 w-full"
                            placeholder="Descreva as tratativas..."
                          />
                        ) : (
                          <span className="text-gray-700 text-sm">
                            {r.tratativas_acordadas || (
                              <span className="text-gray-400">-</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {editandoReuniaoId === r.id ? (
                          <>
                            <button
                              onClick={() => salvarPresencaTratativa(r.id)}
                              disabled={processando}
                              className="px-3 py-1 bg-green-600 text-white rounded mr-2"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoReuniaoId(null);
                                setPresencaTemp(null);
                                setTratativaTemp("");
                              }}
                              className="px-3 py-1 bg-gray-400 text-white rounded"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditandoReuniaoId(r.id);
                              setPresencaTemp(r.presenca_franqueado);
                              setTratativaTemp(r.tratativas_acordadas || "");
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {abaSelecionada === "notificacoes" && (
          <div className="space-y-4">
            {carregando ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-red-600 mx-auto" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma notificação jurídica encontrada
              </div>
            ) : (
              notificacoes.map((envio) => (
                <div
                  key={envio.id}
                  className="border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {envio.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Destinatário: {envio.destinatario}
                      </p>
                      <p className="text-sm text-gray-600">
                        CNPJ: {envio.cnpj}
                      </p>
                      <p className="text-sm text-gray-600">
                        Enviado em: {formatarData(envio.data_envio)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          envio.status_envio === "sucesso"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {envio.status_envio === "sucesso"
                          ? "Enviado"
                          : "Pendente"}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          envio.canal === "whatsapp"
                            ? "bg-green-50 text-green-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {envio.canal.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {envio.mensagem_enviada?.substring(0, 300)}...
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    {envio.canal === "whatsapp" ? null : (
                      <button
                        onClick={() => enviarWhatsAppJuridico(envio)}
                        className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        disabled={processando}
                      >
                        <WhatsAppIcon size={16} className="text-white mr-1" /> Enviar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {abaSelecionada === "documentos" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Documentos Jurídicos
              </h3>
              <button
                onClick={abrirModalUpload}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Documento
              </button>
            </div>

            <div className="text-center py-8 text-gray-500">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p>Funcionalidade de documentos em desenvolvimento</p>
            </div>
          </div>
        )}

        {abaSelecionada === "log" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responsável
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-red-600 mx-auto" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhum log encontrado
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarData(log.data_acao)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.unidades_franqueadas?.nome_franqueado}
                          </div>
                          <div className="text-sm text-gray-500">
                            {log.cnpj_unidade}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.tipo_acao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          {log.motivo_acionamento
                            .replace("_", " ")
                            .toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatarMoeda(log.valor_em_aberto)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.responsavel}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {abaSelecionada === "configuracao" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">
              Configurações Jurídicas
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <h4 className="font-semibold text-yellow-800">
                    Critérios de Acionamento Automático
                  </h4>
                  <ul className="text-yellow-700 text-sm mt-2 space-y-1">
                    <li>• Valor em aberto superior a R$ 5.000</li>
                    <li>• 3 ou mais cobranças ignoradas em 15 dias</li>
                    <li>• Score de risco igual a zero</li>
                    <li>• Acordo firmado e descumprido</li>
                    <li>• Reincidência em período de 6 meses</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Templates de Notificação
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Notificação Extrajudicial</li>
                  <li>• Notificação Formal</li>
                  <li>• Última Chance</li>
                  <li>• Pré-Judicial</li>
                  <li>• Judicial</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Prazos Padrão
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Resposta a notificação: 5 dias úteis</li>
                  <li>• Análise de resposta: 3 dias úteis</li>
                  <li>• Encaminhamento judicial: Imediato</li>
                  <li>• Arquivo de caso: 30 dias</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Notificação */}
      {modalAberto === "notificacao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Gerar Notificação Extrajudicial
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
                  CNPJ da Unidade
                </label>
                <input
                  type="text"
                  value={formData.cnpj_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Notificação
                </label>
                <select
                  value={formData.tipo_notificacao || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tipo_notificacao: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="extrajudicial">Extrajudicial</option>
                  <option value="formal">Formal</option>
                  <option value="ultima_chance">Última Chance</option>
                  <option value="pre_judicial">Pré-Judicial</option>
                  <option value="judicial">Judicial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Observações específicas..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={gerarNotificacao}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processando ? "Gerando..." : "Gerar Notificação"}
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

      {/* Modal de Termo de Acordo */}
      {modalAberto === "termo" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Gerar Termo de Acordo</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ da Unidade
                </label>
                <input
                  type="text"
                  value={formData.cnpj_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Original
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
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Acordado
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.valor_acordado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      valor_acordado: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={formData.forma_pagamento || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      forma_pagamento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="vista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </div>

              {formData.forma_pagamento === "parcelado" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade de Parcelas
                    </label>
                    <input
                      type="number"
                      value={formData.quantidade_parcelas || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantidade_parcelas: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primeiro Vencimento
                    </label>
                    <input
                      type="date"
                      value={formData.data_primeiro_vencimento || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          data_primeiro_vencimento: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Multa por Descumprimento (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.multa_descumprimento || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      multa_descumprimento: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condições Especiais
              </label>
              <textarea
                value={formData.condicoes_especiais || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    condicoes_especiais: e.target.value,
                  })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Condições específicas do acordo..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={gerarTermo}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Gerando..." : "Gerar Termo"}
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

      {/* Modal de Status */}
      {modalAberto === "status" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Atualizar Status Jurídico
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
                  Status
                </label>
                <select
                  value={formData.status || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="pendente_grave">Pendente Grave</option>
                  <option value="notificado">Notificado</option>
                  <option value="em_analise">Em Análise</option>
                  <option value="pre_processo">Pré-Processo</option>
                  <option value="acionado">Acionado</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.observacoes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={atualizarStatus}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Salvar"}
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

      {/* Modal de Resposta */}
      {modalAberto === "resposta" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Marcar como Respondida</h3>
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
                  Observações da Resposta
                </label>
                <textarea
                  value={formData.observacoes_resposta || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      observacoes_resposta: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Descreva a resposta recebida..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={marcarRespondida}
                disabled={processando || !formData.observacoes_resposta}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Marcar Respondida"}
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
    </div>
  );
}
