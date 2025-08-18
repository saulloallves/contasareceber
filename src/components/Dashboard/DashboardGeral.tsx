/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Users, AlertTriangle, CheckCircle,
  RefreshCw, Clock, Mail, MessageSquare, Activity,
  FileText, Calculator, Building2, Calendar, Zap,
} from "lucide-react";
import { DashboardService } from "../../services/dashboardService";

// tipos específicos não utilizados diretamente aqui
import { formatMonetaryResponsive } from "../../utils/monetaryUtils";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "react-hot-toast";

type DashboardGeralProps = {
  onNavigate?: (tab: string) => void;
};

export function DashboardGeral({ onNavigate }: DashboardGeralProps) {
  const [indicadores, setIndicadores] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  // Filtros removidos por não terem efeito funcional no Dashboard

  const dashboardService = useMemo(() => new DashboardService(), []);

  // Normaliza o objeto de indicadores para garantir campos e defaults
  const normalizarIndicadores = useCallback((data: any) => {
    // Retorna o primeiro valor numérico válido dentre os informados; caso contrário 0
    const pickNum = (...vals: any[]) => {
      for (const v of vals) {
        if (v !== undefined && v !== null) {
          const n = Number(v);
          if (!Number.isNaN(n)) return n;
        }
      }
      return 0;
    };
    // Retorna o primeiro array válido dentre os informados; caso contrário []
    const pickArr = (...vals: any[]) => {
      for (const v of vals) {
        if (Array.isArray(v)) return v;
      }
      return [];
    };
    return {
      // Totais (aceita camelCase, snake_case e campos com sufixo _mes)
      totalEmAberto: pickNum(
        data?.totalEmAberto,
        data?.total_em_aberto,
        data?.total_em_aberto_mes
      ),
      totalEmAbertoOriginal: pickNum(
        data?.totalEmAbertoOriginal,
        data?.total_em_aberto_original,
        data?.total_em_aberto_original_mes
      ),
      totalEmAbertoAtualizado: pickNum(
        data?.totalEmAbertoAtualizado,
        data?.total_em_aberto_atualizado,
        data?.total_em_aberto_atualizado_mes,
        data?.totalEmAberto // fallback final para compat
      ),
      totalQuitado: pickNum(
        data?.totalQuitado,
        data?.total_quitado,
        data?.total_pago_mes
      ),
      totalNegociando: pickNum(
        data?.totalNegociando,
        data?.total_negociando,
        data?.total_negociando_mes
      ),

      // Variações (aceita camelCase, snake_case e mapeia do comparativo_mes_anterior)
      variacaoEmAberto: pickNum(
        data?.variacaoEmAberto,
        data?.variacao_em_aberto,
        data?.comparativo_mes_anterior?.variacao_em_aberto
      ),
      variacaoQuitado: pickNum(
        data?.variacaoQuitado,
        data?.variacao_quitado,
        data?.comparativo_mes_anterior?.variacao_pago
      ),
      variacaoNegociando: pickNum(
        data?.variacaoNegociando,
        data?.variacao_negociando,
        data?.comparativo_mes_anterior?.variacao_inadimplencia
      ),
      variacaoUnidades: pickNum(
        data?.variacaoUnidades,
        data?.variacao_unidades
      ),

      // Métricas auxiliares
      unidadesInadimplentes: pickNum(
        data?.unidadesInadimplentes,
        data?.unidades_inadimplentes
      ),
      ticketMedio: pickNum(
        data?.ticketMedio,
        data?.ticket_medio,
        data?.ticket_medio_dividas
      ),
      alertasAtivos: pickArr(data?.alertasAtivos, data?.alertas_ativos),
      proximasReunioesCount: pickNum(
        data?.proximasReunioesCount,
        data?.proximas_reunioes_count
      ),
      acoesRecentesCount: pickNum(
        data?.acoesRecentesCount,
        data?.acoes_recentes_count
      ),
    };
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const indicadoresData = await dashboardService.buscarIndicadoresMensais();
      // Garante que os campos usados no UI existam
      setIndicadores(normalizarIndicadores(indicadoresData));
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setCarregando(false);
    }
  }, [dashboardService, normalizarIndicadores]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ===== Últimas mensagens enviadas (WhatsApp/E-mail) =====
  const [carregandoMensagens, setCarregandoMensagens] = useState(true);
  const [ultimasMensagens, setUltimasMensagens] = useState<any[]>([]);

  const carregarUltimasMensagens = useCallback(async () => {
    setCarregandoMensagens(true);
    try {
      // WhatsApp
      const { data: whats, error: errW } = await supabase
        .from("logs_envio_whatsapp")
        .select(
          "id, destinatario, mensagem_enviada, sucesso, erro_detalhes, data_envio, created_at"
        )
        .order("data_envio", { ascending: false })
        .limit(5);

      if (errW) console.warn("Falha ao buscar WhatsApp:", errW);

      // E-mail
      const { data: emails, error: errE } = await supabase
        .from("logs_envio_email")
        .select(
          "id, destinatario, mensagem, sucesso, erro_detalhes, data_envio, created_at"
        )
        .order("data_envio", { ascending: false })
        .limit(5);

      if (errE) console.warn("Falha ao buscar E-mail:", errE);

      const mapWhats = (whats || []).map((row: any) => ({
        id: row.id,
        canal: "whatsapp" as const,
        destinatario: row.destinatario,
        mensagem: row.mensagem_enviada,
        status: row.sucesso ? "sucesso" : "falha",
        data: row.data_envio || row.created_at,
      }));

      const mapEmails = (emails || []).map((row: any) => ({
        id: row.id,
        canal: "email" as const,
        destinatario: row.destinatario,
        mensagem: row.mensagem,
        status: row.sucesso ? "sucesso" : "falha",
        data: row.data_envio || row.created_at,
      }));

      const merged = [...mapWhats, ...mapEmails].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setUltimasMensagens(merged.slice(0, 5));
    } catch (e) {
      console.error("Erro ao carregar últimas mensagens:", e);
      setUltimasMensagens([]);
    } finally {
      setCarregandoMensagens(false);
    }
  }, []);

  useEffect(() => {
    carregarUltimasMensagens();
  }, [carregarUltimasMensagens]);

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const formatarPercentual = (valor: number) => {
    return `${valor.toFixed(1)}%`;
  };

  const getVariacaoIcon = (valor: number) => {
    if (valor > 0) return <TrendingUp className="w-4 h-4" />;
    if (valor < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  const getVariacaoColor = (valor: number) => {
    if (valor > 0) return "text-green-600";
    if (valor < 0) return "text-red-600";
    return "text-gray-600";
  };

  const formatarDataHora = (valor: string) => {
    try {
      return new Date(valor).toLocaleString("pt-BR");
    } catch {
      return valor;
    }
  };

  const renderMonetaryValue = (value: number, colorClass: string = "") => {
    const { formatted, className, shouldTruncate } = formatMonetaryResponsive(
      value,
      {
        compact: value >= 1000000, // Use compact notation for values >= 1M
      }
    );

    return (
      <p
        className={`${className} ${colorClass} ${
          shouldTruncate ? "monetary-truncate" : ""
        }`}
        title={shouldTruncate ? formatarMoeda(value) : undefined}
      >
        {formatted}
      </p>
    );
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!indicadores) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Erro ao carregar dados do dashboard</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Geral</h1>
          <p className="text-gray-600">Visão geral da inadimplência da rede</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              carregarDados();
              carregarUltimasMensagens();
            }}
            className="flex items-center px-4 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#522c0a] transition-colors duration-300"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border border-red-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-red-500 rounded-full flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-red-700">Valor com Juros e Multa</p>
              {renderMonetaryValue(
                indicadores.totalEmAbertoAtualizado ?? indicadores.totalEmAberto,
                "text-red-600"
              )}
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold ${getVariacaoColor(
                    indicadores.variacaoEmAberto
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoEmAberto)}
                  {formatarPercentual(Math.abs(indicadores.variacaoEmAberto))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-lg p-6 border border-emerald-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-emerald-500 rounded-full flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-emerald-700">Valor Original (Sem Juros/Multa)</p>
              {renderMonetaryValue(
                indicadores.totalEmAbertoOriginal ?? indicadores.totalEmAberto,
                "text-emerald-600"
              )}
              <div className="mt-2 text-xs text-emerald-700">
                Soma dos valores originais das cobranças em aberto e negociando
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 border border-green-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-green-500 rounded-full flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-green-700">
                Valor Recuperado
              </p>
              {renderMonetaryValue(indicadores.totalQuitado, "text-green-600")}
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold ${getVariacaoColor(
                    indicadores.variacaoQuitado
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoQuitado)}
                  {formatarPercentual(Math.abs(indicadores.variacaoQuitado))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg p-6 border border-yellow-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-yellow-500 rounded-full flex-shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-yellow-700">
                Em Negociação
              </p>
              {renderMonetaryValue(
                indicadores.totalNegociando,
                "text-yellow-600"
              )}
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold ${getVariacaoColor(
                    indicadores.variacaoNegociando
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoNegociando)}
                  {formatarPercentual(Math.abs(indicadores.variacaoNegociando))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border border-blue-200">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-blue-500 rounded-full flex-shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-blue-700">
                Unidades Inadimplentes
              </p>
              <p className="monetary-value text-blue-600">
                {indicadores.unidadesInadimplentes ?? 0}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Ticket médio:
                <span className="font-semibold ml-1">
                  {
                    formatMonetaryResponsive(indicadores.ticketMedio ?? 0, {
                      compact: true,
                    }).formatted
                  }
                </span>
              </p>
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold ${getVariacaoColor(
                    indicadores.variacaoUnidades
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoUnidades)}
                  {formatarPercentual(Math.abs(indicadores.variacaoUnidades))}
                </span>
                <span className="text-gray-500 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acesso Rápido */}
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <div className="p-2 bg-cyan-100 rounded-lg mr-3">
            <Zap className="w-6 h-6 text-cyan-600" />
          </div>
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <button
            onClick={() => onNavigate?.("cobrancas")}
            className="flex items-center gap-3 p-4 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
            aria-label="Kanban Cobranças"
          >
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="text-blue-700 font-medium">Kanban Cobranças</span>
          </button>
          <button
            onClick={() => onNavigate?.("cobrancas-lista")}
            className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 hover:bg-emerald-50 transition-colors"
            aria-label="Gestão Cobranças"
          >
            <FileText className="w-5 h-5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">
              Gestão Cobranças
            </span>
          </button>
          <button
            onClick={() => onNavigate?.("simulacao-parcelamento")}
            className="flex items-center gap-3 p-4 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors"
            aria-label="Simulação de Parcelamento"
          >
            <Calculator className="w-5 h-5 text-indigo-600" />
            <span className="text-indigo-700 font-medium">Parcelamento</span>
          </button>
          <button
            onClick={() => onNavigate?.("unidades")}
            className="flex items-center gap-3 p-4 rounded-xl border border-orange-200 hover:bg-orange-50 transition-colors"
            aria-label="Unidades"
          >
            <Building2 className="w-5 h-5 text-orange-600" />
            <span className="text-orange-700 font-medium">Unidades</span>
          </button>
          <button
            onClick={() => onNavigate?.("franqueados")}
            className="flex items-center gap-3 p-4 rounded-xl border border-pink-200 hover:bg-pink-50 transition-colors"
            aria-label="Franqueados"
          >
            <Users className="w-5 h-5 text-pink-600" />
            <span className="text-pink-700 font-medium">Franqueados</span>
          </button>
          <button
            onClick={() => {
              toast(
                () => (
                  <div className="text-sm">
                    <p className="font-medium text-white">
                      Reuniões — não implementado
                    </p>
                    <p className="text-white/90">
                      Esta funcionalidade ainda não foi implementada no sistema.
                    </p>
                  </div>
                ),
                {
                  icon: "🛠️",
                  duration: 6000,
                  style: { background: "#7c3aed", color: "#fff" },
                }
              );
              // onNavigate?.('reunioes'); // pronto para quando implementarmos
            }}
            className="flex items-center gap-3 p-4 rounded-xl border border-purple-200 hover:bg-purple-50 transition-colors"
            aria-label="Reuniões"
          >
            <Calendar className="w-5 h-5 text-purple-600" />
            <span className="text-purple-700 font-medium">Reuniões</span>
          </button>
        </div>
      </div>

      {/* Próximas Reuniões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            Próximas Reuniões
          </h3>
          <div className="text-center py-10 text-gray-600">
            O agendamento de reuniões ainda não foi implementado no sistema.
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            Últimos Envios
          </h3>
          <div className="space-y-4">
            {carregandoMensagens ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />{" "}
                Carregando...
              </div>
            ) : ultimasMensagens.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhuma mensagem enviada ainda.</p>
              </div>
            ) : (
              ultimasMensagens.map((m) => (
                <div
                  key={`${m.canal}-${m.id}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start">
                    <div
                      className={`p-2 rounded-full mr-4 ${
                        m.canal === "whatsapp"
                          ? "bg-emerald-100"
                          : "bg-blue-100"
                      }`}
                    >
                      {m.canal === "whatsapp" ? (
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Mail className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {m.canal === "whatsapp" ? "WhatsApp" : "E-mail"} •{" "}
                        {m.destinatario}
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {m.mensagem}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatarDataHora(m.data)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      m.status === "sucesso"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {m.status === "sucesso" ? "Enviado" : "Falha"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
