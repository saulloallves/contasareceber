/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Edit,
  Filter,
  Download,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  Mail,
  User,
  Target,
} from "lucide-react";
import { ReunioesService } from "../services/reunioesService";
import { toast } from 'react-hot-toast';
import { UnidadesService } from "../services/unidadesService";
import {
  FiltrosReunioes,
  FiltrosInteracoes,
  EstatisticasReunioes,
  EstatisticasInteracoes,
} from "../types/unidades";

export function GestaoReunioes() {
  const [abaSelecionada, setAbaSelecionada] = useState<
    "reunioes" | "interacoes" | "timeline"
  >("reunioes");
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [interacoes, setInteracoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtrosReunioes, setFiltrosReunioes] = useState<FiltrosReunioes>({});
  const [filtrosInteracoes, setFiltrosInteracoes] = useState<FiltrosInteracoes>(
    {}
  );
  const [modalAberto, setModalAberto] = useState<
    "agendar" | "resultado" | "interacao" | "timeline" | null
  >(null);
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [processando, setProcessando] = useState(false);
  const [estatisticasReunioes, setEstatisticasReunioes] =
    useState<EstatisticasReunioes | null>(null);
  const [estatisticasInteracoes, setEstatisticasInteracoes] =
    useState<EstatisticasInteracoes | null>(null);
  const [codigoUnidadeTimeline, setCodigoUnidadeTimeline] = useState("");

  const reunioesService = new ReunioesService();
  const unidadesService = new UnidadesService();

  useEffect(() => {
    carregarDados();
  }, [abaSelecionada, filtrosReunioes, filtrosInteracoes]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      if (abaSelecionada === "reunioes") {
        const [reunioesData, statsReunioes] = await Promise.all([
          reunioesService.buscarReunioes(filtrosReunioes),
          reunioesService.buscarEstatisticasReunioes(filtrosReunioes),
        ]);
        setReunioes(reunioesData);
        setEstatisticasReunioes(statsReunioes);
      } else if (abaSelecionada === "interacoes") {
        const [interacoesData, statsInteracoes] = await Promise.all([
          reunioesService.buscarInteracoes(filtrosInteracoes),
          reunioesService.buscarEstatisticasInteracoes(filtrosInteracoes),
        ]);
        setInteracoes(interacoesData);
        setEstatisticasInteracoes(statsInteracoes);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalAgendar = () => {
    setFormData({
      titulo_id: "",
      data_agendada: "",
      responsavel_reuniao: "usuario_atual",
      link_reuniao: "",
      observacoes: "",
    });
    setModalAberto("agendar");
  };

  const abrirModalInteracao = () => {
    setFormData({
      codigo_unidade: "",
      cnpj_unidade: "",
      nome_franqueado: "",
      data_interacao: new Date().toISOString().slice(0, 16),
      canal_contato: "ligacao",
      motivo_contato: "lembrete_vencimento",
      resultado_contato: "compareceu",
      resumo_conversa: "",
      colaborador_responsavel: "usuario_atual",
    });
    setModalAberto("interacao");
  };

  const abrirModalResultado = (reuniao: any) => {
    setItemSelecionado(reuniao);
    setFormData({
      decisao_final: "",
      resumo_resultado: "",
      observacoes: "",
    });
    setModalAberto("resultado");
  };

  const abrirModalTimeline = () => {
    setCodigoUnidadeTimeline("");
    setModalAberto("timeline");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setItemSelecionado(null);
    setFormData({});
  };

  const agendarReuniao = async () => {
    if (!formData.titulo_id || !formData.data_agendada) {
      toast.error("Cobrança e data são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await reunioesService.agendarReuniao(formData);
      fecharModal();
      carregarDados();
    } catch (error) {
      toast.error(`Erro ao agendar reunião: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const registrarInteracao = async () => {
    if (!formData.codigo_unidade || !formData.resumo_conversa) {
      toast.error("Código da unidade e resumo são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await reunioesService.registrarInteracao(formData);
      fecharModal();
      carregarDados();
    } catch (error) {
      toast.error(`Erro ao registrar interação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const registrarResultado = async () => {
    if (!formData.decisao_final || !formData.resumo_resultado) {
      toast.error("Decisão e resumo são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      await reunioesService.registrarResultadoReuniao(
        itemSelecionado.id,
        formData.decisao_final,
        formData.resumo_resultado,
        formData.observacoes
      );
      fecharModal();
      carregarDados();
    } catch (error) {
      toast.error(`Erro ao registrar resultado: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const marcarNaoCompareceu = async (reuniao: any) => {
  if (!confirm("Confirma que o franqueado não compareceu à reunião?")) {
      return;
    }

    try {
      await reunioesService.atualizarStatusReuniao(
        reuniao.id,
        "nao_compareceu"
      );
      carregarDados();
    } catch (error) {
      toast.error(`Erro ao atualizar status: ${error}`);
    }
  };

  const remarcarReuniao = async (reuniao: any) => {
    const novaData = prompt("Nova data e hora (YYYY-MM-DD HH:MM):");
    if (!novaData) return;

    const motivo = prompt("Motivo da remarcação (opcional):");

    try {
      await reunioesService.remarcarReuniao(
        reuniao.id,
        novaData,
        motivo === null ? undefined : motivo
      );
      carregarDados();
    } catch (error) {
      toast.error(`Erro ao remarcar reunião: ${error}`);
    }
  };

  const exportarDados = async () => {
    try {
      let csv = "";
      if (abaSelecionada === "reunioes") {
        csv = await reunioesService.exportarReunioes(filtrosReunioes);
      } else {
        csv = await reunioesService.exportarInteracoes(filtrosInteracoes);
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${abaSelecionada}-${
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
      case "agendada":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "realizada":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "nao_compareceu":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "remarcada":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "cancelada":
        return <XCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "agendada":
        return "bg-blue-100 text-blue-800";
      case "realizada":
        return "bg-green-100 text-green-800";
      case "nao_compareceu":
        return "bg-red-100 text-red-800";
      case "remarcada":
        return "bg-yellow-100 text-yellow-800";
      case "cancelada":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "ligacao":
        return <Phone className="w-4 h-4 text-blue-600" />;
      case "whatsapp":
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case "email":
        return <Mail className="w-4 h-4 text-purple-600" />;
      case "presencial":
        return <MapPin className="w-4 h-4 text-red-600" />;
      case "videoconferencia":
        return <Video className="w-4 h-4 text-orange-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getResultadoColor = (resultado: string) => {
    switch (resultado) {
      case "compareceu":
      case "negociacao_aceita":
      case "acordo_formalizado":
        return "bg-green-100 text-green-800";
      case "nao_compareceu":
      case "negociacao_recusada":
        return "bg-red-100 text-red-800";
      case "remarcado":
      case "sem_resposta":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Registro de Reuniões e Comunicação
              </h1>
              <p className="text-gray-600">
                Controle completo de interações com unidades
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={exportarDados}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </button>
            {abaSelecionada === "reunioes" && (
              <button
                onClick={abrirModalAgendar}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agendar Reunião
              </button>
            )}
            {abaSelecionada === "interacoes" && (
              <button
                onClick={abrirModalInteracao}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Interação
              </button>
            )}
            {abaSelecionada === "timeline" && (
              <button
                onClick={abrirModalTimeline}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Target className="w-4 h-4 mr-2" />
                Ver Timeline
              </button>
            )}
          </div>
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: "reunioes", label: "Reuniões", icon: Calendar },
              { id: "interacoes", label: "Interações", icon: MessageSquare },
              { id: "timeline", label: "Timeline por Unidade", icon: Target },
            ].map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? "border-blue-500 text-blue-600"
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

        {/* Estatísticas */}
        {abaSelecionada === "reunioes" && estatisticasReunioes && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticasReunioes.total_agendadas}
              </div>
              <div className="text-sm text-blue-800">Agendadas</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticasReunioes.total_realizadas}
              </div>
              <div className="text-sm text-green-800">Realizadas</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">
                {estatisticasReunioes.total_nao_compareceu}
              </div>
              <div className="text-sm text-red-800">Não Compareceu</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticasReunioes.reunioes_pendentes}
              </div>
              <div className="text-sm text-yellow-800">Pendentes</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticasReunioes.taxa_comparecimento.toFixed(1)}%
              </div>
              <div className="text-sm text-purple-800">Taxa Comparecimento</div>
            </div>
          </div>
        )}

        {abaSelecionada === "interacoes" && estatisticasInteracoes && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticasInteracoes.total_interacoes}
              </div>
              <div className="text-sm text-blue-800">Total Interações</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticasInteracoes.taxa_sucesso.toFixed(1)}%
              </div>
              <div className="text-sm text-green-800">Taxa de Sucesso</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticasInteracoes.interacoes_mes_atual}
              </div>
              <div className="text-sm text-purple-800">Este Mês</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.keys(estatisticasInteracoes.por_canal).length}
              </div>
              <div className="text-sm text-yellow-800">Canais Utilizados</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {Math.max(...Object.values(estatisticasInteracoes.por_canal))}
              </div>
              <div className="text-sm text-orange-800">Canal Mais Usado</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          {abaSelecionada === "reunioes" && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={filtrosReunioes.status_reuniao || ""}
                onChange={(e) =>
                  setFiltrosReunioes({
                    ...filtrosReunioes,
                    status_reuniao: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Status</option>
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="nao_compareceu">Não Compareceu</option>
                <option value="remarcada">Remarcada</option>
                <option value="cancelada">Cancelada</option>
              </select>

              <input
                type="text"
                value={filtrosReunioes.responsavel || ""}
                onChange={(e) =>
                  setFiltrosReunioes({
                    ...filtrosReunioes,
                    responsavel: e.target.value,
                  })
                }
                placeholder="Responsável"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="date"
                value={filtrosReunioes.dataInicio || ""}
                onChange={(e) =>
                  setFiltrosReunioes({
                    ...filtrosReunioes,
                    dataInicio: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="date"
                value={filtrosReunioes.dataFim || ""}
                onChange={(e) =>
                  setFiltrosReunioes({
                    ...filtrosReunioes,
                    dataFim: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <select
                value={filtrosReunioes.decisao_final || ""}
                onChange={(e) =>
                  setFiltrosReunioes({
                    ...filtrosReunioes,
                    decisao_final: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as Decisões</option>
                <option value="quitado">Quitado</option>
                <option value="parcela_futura">Parcela Futura</option>
                <option value="sem_acordo">Sem Acordo</option>
                <option value="rever">Rever</option>
              </select>
            </div>
          )}

          {abaSelecionada === "interacoes" && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <select
                value={filtrosInteracoes.canal_contato || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    canal_contato: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos os Canais</option>
                <option value="ligacao">Ligação</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="presencial">Presencial</option>
                <option value="videoconferencia">Videoconferência</option>
              </select>

              <select
                value={filtrosInteracoes.motivo_contato || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    motivo_contato: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos os Motivos</option>
                <option value="lembrete_vencimento">Lembrete</option>
                <option value="proposta_acordo">Proposta</option>
                <option value="negociacao">Negociação</option>
                <option value="notificacao_inadimplencia">Notificação</option>
                <option value="acordo_descumprido">Acordo Descumprido</option>
                <option value="escalonamento_juridico">Escalonamento</option>
              </select>

              <input
                type="text"
                value={filtrosInteracoes.colaborador || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    colaborador: e.target.value,
                  })
                }
                placeholder="Colaborador"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />

              <input
                type="text"
                value={filtrosInteracoes.codigo_unidade || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    codigo_unidade: e.target.value,
                  })
                }
                placeholder="Código Unidade"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />

              <input
                type="date"
                value={filtrosInteracoes.dataInicio || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    dataInicio: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />

              <input
                type="date"
                value={filtrosInteracoes.dataFim || ""}
                onChange={(e) =>
                  setFiltrosInteracoes({
                    ...filtrosInteracoes,
                    dataFim: e.target.value,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {abaSelecionada === "timeline" && (
            <div className="max-w-md">
              <input
                type="text"
                value={codigoUnidadeTimeline}
                onChange={(e) => setCodigoUnidadeTimeline(e.target.value)}
                placeholder="Digite o código da unidade"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}
        </div>

        {/* Conteúdo das abas */}
        {abaSelecionada === "reunioes" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responsável
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Decisão
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
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                        Carregando reuniões...
                      </div>
                    </td>
                  </tr>
                ) : reunioes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhuma reunião encontrada
                    </td>
                  </tr>
                ) : (
                  reunioes.map((reuniao) => (
                    <tr key={reuniao.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatarData(reuniao.data_agendada)}
                          </div>
                          {reuniao.data_realizada && (
                            <div className="text-sm text-gray-500">
                              Realizada: {formatarData(reuniao.data_realizada)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reuniao.cobrancas_franqueados?.cliente}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reuniao.cobrancas_franqueados?.cnpj}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Users className="w-4 h-4 mr-1 text-gray-400" />
                          {reuniao.responsavel_reuniao}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(reuniao.status_reuniao)}
                          <span
                            className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              reuniao.status_reuniao
                            )}`}
                          >
                            {reuniao.status_reuniao
                              .replace("_", " ")
                              .toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {reuniao.decisao_final ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            {reuniao.decisao_final
                              .replace("_", " ")
                              .toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {reuniao.status_reuniao === "agendada" && (
                            <>
                              <button
                                onClick={() => abrirModalResultado(reuniao)}
                                className="text-green-600 hover:text-green-900"
                                title="Registrar resultado"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => marcarNaoCompareceu(reuniao)}
                                className="text-red-600 hover:text-red-900"
                                title="Não compareceu"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => remarcarReuniao(reuniao)}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Remarcar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {reuniao.link_reuniao && (
                            <a
                              href={reuniao.link_reuniao}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-900"
                              title="Abrir link da reunião"
                            >
                              <Video className="w-4 h-4" />
                            </a>
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

        {abaSelecionada === "interacoes" && (
          <div className="space-y-4">
            {carregando ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Carregando interações...</p>
              </div>
            ) : interacoes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma interação encontrada
              </div>
            ) : (
              interacoes.map((interacao) => (
                <div
                  key={interacao.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      {getCanalIcon(interacao.canal_contato)}
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {interacao.nome_franqueado} (
                          {interacao.codigo_unidade})
                        </h3>
                        <p className="text-sm text-gray-600">
                          CNPJ: {interacao.cnpj_unidade}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {formatarData(interacao.data_interacao)}
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getResultadoColor(
                          interacao.resultado_contato
                        )}`}
                      >
                        {interacao.resultado_contato
                          .replace("_", " ")
                          .toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Motivo:</span>{" "}
                      {interacao.motivo_contato.replace("_", " ")}
                    </div>
                    <div>
                      <span className="font-medium">Canal:</span>{" "}
                      {interacao.canal_contato}
                    </div>
                    <div>
                      <span className="font-medium">Responsável:</span>{" "}
                      {interacao.colaborador_responsavel}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">
                      Resumo da Conversa:
                    </h4>
                    <p className="text-gray-700">{interacao.resumo_conversa}</p>
                  </div>

                  {interacao.comentarios_internos && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4">
                      <h4 className="font-medium text-blue-800 mb-1">
                        Comentários Internos:
                      </h4>
                      <p className="text-blue-700 text-sm">
                        {interacao.comentarios_internos}
                      </p>
                    </div>
                  )}

                  {interacao.proximo_contato && (
                    <div className="flex items-center text-sm text-orange-600">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Próximo contato: {interacao.proximo_contato}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {abaSelecionada === "timeline" && (
          <div className="text-center py-8">
            <Target className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Timeline da Unidade
            </h3>
            <p className="text-gray-600 mb-6">
              Digite o código da unidade para visualizar o histórico completo de
              interações
            </p>
            <div className="max-w-md mx-auto">
              <input
                type="text"
                value={codigoUnidadeTimeline}
                onChange={(e) => setCodigoUnidadeTimeline(e.target.value)}
                placeholder="Ex: 0137"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 mb-4"
              />
              <button
                disabled={!codigoUnidadeTimeline.trim()}
                className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                Visualizar Timeline
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Agendamento */}
      {modalAberto === "agendar" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Agendar Reunião</h3>
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
                  ID do Título *
                </label>
                <input
                  type="text"
                  value={formData.titulo_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, titulo_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="UUID da cobrança"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  value={formData.data_agendada || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, data_agendada: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link da Reunião
                </label>
                <input
                  type="url"
                  value={formData.link_reuniao || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, link_reuniao: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://meet.google.com/..."
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={agendarReuniao}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Agendando..." : "Agendar"}
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

      {/* Modal de Interação */}
      {modalAberto === "interacao" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Registrar Interação</h3>
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
                  Código da Unidade *
                </label>
                <input
                  type="text"
                  value={formData.codigo_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: 0137"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ da Unidade *
                </label>
                <input
                  type="text"
                  value={formData.cnpj_unidade || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cnpj_unidade: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Franqueado *
                </label>
                <input
                  type="text"
                  value={formData.nome_franqueado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nome_franqueado: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  value={formData.data_interacao || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, data_interacao: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Canal de Contato *
                </label>
                <select
                  value={formData.canal_contato || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, canal_contato: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ligacao">Ligação</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="presencial">Presencial</option>
                  <option value="videoconferencia">Videoconferência</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo do Contato *
                </label>
                <select
                  value={formData.motivo_contato || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, motivo_contato: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="lembrete_vencimento">
                    Lembrete de Vencimento
                  </option>
                  <option value="proposta_acordo">Proposta de Acordo</option>
                  <option value="negociacao">Negociação</option>
                  <option value="notificacao_inadimplencia">
                    Notificação de Inadimplência
                  </option>
                  <option value="acordo_descumprido">Acordo Descumprido</option>
                  <option value="escalonamento_juridico">
                    Escalonamento Jurídico
                  </option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resultado *
                </label>
                <select
                  value={formData.resultado_contato || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      resultado_contato: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="compareceu">Compareceu</option>
                  <option value="nao_compareceu">Não Compareceu</option>
                  <option value="remarcado">Remarcado</option>
                  <option value="sem_resposta">Sem Resposta</option>
                  <option value="negociacao_aceita">Negociação Aceita</option>
                  <option value="negociacao_recusada">
                    Negociação Recusada
                  </option>
                  <option value="acordo_formalizado">Acordo Formalizado</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Próximo Contato
                </label>
                <input
                  type="text"
                  value={formData.proximo_contato || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      proximo_contato: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Retornar em 7 dias"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resumo da Conversa *
                </label>
                <textarea
                  value={formData.resumo_conversa || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      resumo_conversa: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Descreva detalhadamente o que foi conversado..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentários Internos
                </label>
                <textarea
                  value={formData.comentarios_internos || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      comentarios_internos: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Observações internas (não visíveis ao franqueado)"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={registrarInteracao}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {processando ? "Registrando..." : "Registrar Interação"}
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

      {/* Modal de Resultado */}
      {modalAberto === "resultado" && itemSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Registrar Resultado</h3>
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
                  Decisão Final *
                </label>
                <select
                  value={formData.decisao_final || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, decisao_final: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  <option value="quitado">Quitado</option>
                  <option value="parcela_futura">Parcela Futura</option>
                  <option value="sem_acordo">Sem Acordo</option>
                  <option value="rever">Rever</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resumo do Resultado *
                </label>
                <textarea
                  value={formData.resumo_resultado || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      resumo_resultado: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Descreva o resultado da reunião..."
                />
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
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={registrarResultado}
                disabled={processando}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Salvar Resultado"}
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
