/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
TrendingUp, TrendingDown, Users, AlertTriangle, CheckCircle,
RefreshCw, Clock, Mail, Calculator, Building2,
Calendar, Zap, CircleDollarSign, Receipt, Scale, XCircle,
X, Eye, Code
} from "lucide-react";
import { DashboardService } from "../../services/dashboardService";

// tipos específicos não utilizados diretamente aqui
import { formatMonetaryResponsive } from "../../utils/monetaryUtils";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "react-hot-toast";
import logo from "../../assets/logo cresci-header.png";
import { WhatsAppIcon } from "../ui/WhatsAppIcon";


type DashboardGeralProps = {
  onNavigate?: (tab: string) => void;
  user?: {
    name: string;
    email: string;
    role: string;
    id: string;
    avatar_url?: string;
  };
};

export function DashboardGeral({ onNavigate, user }: DashboardGeralProps) {
  const [indicadores, setIndicadores] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
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
        data?.total_negociando_mes,
        data?.total_pago_mes // fallback adicional se necessário
      ),
      totalJuridico: pickNum(
        data?.totalJuridico,
        data?.total_juridico,
        data?.total_juridico_mes
      ),
      totalPerda: pickNum(
        data?.totalPerda,
        data?.total_perda,
        data?.total_perda_mes
      ),

      // Variações (aceita camelCase, snake_case e mapeia do comparativo_mes_anterior)
      variacaoEmAberto: pickNum(
        data?.variacaoEmAberto,
        data?.variacao_em_aberto,
        data?.comparativo_mes_anterior?.variacao_em_aberto
      ),
      variacaoEmAbertoOriginal: pickNum(
        data?.variacaoEmAbertoOriginal,
        data?.variacao_em_aberto_original,
        data?.comparativo_mes_anterior?.variacao_em_aberto_original
      ),
      variacaoQuitado: pickNum(
        data?.variacaoQuitado,
        data?.variacao_quitado,
        data?.comparativo_mes_anterior?.variacao_pago
      ),
      variacaoNegociando: pickNum(
        data?.variacaoNegociando,
        data?.variacao_negociando,
        data?.comparativo_mes_anterior?.variacao_negociando
      ),
      variacaoJuridico: pickNum(
        data?.variacaoJuridico,
        data?.variacao_juridico,
        data?.comparativo_mes_anterior?.variacao_juridico
      ),
      variacaoPerda: pickNum(
        data?.variacaoPerda,
        data?.variacao_perda,
        data?.comparativo_mes_anterior?.variacao_perda
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

  // ===== Modal de detalhes da mensagem =====
  const [modalMensagemAberto, setModalMensagemAberto] = useState(false);
  const [mensagemSelecionada, setMensagemSelecionada] = useState<any>(null);
  const [emailCodigoVisivel, setEmailCodigoVisivel] = useState(false);

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

  const abrirModalMensagem = (mensagem: any) => {
    setMensagemSelecionada(mensagem);
    setModalMensagemAberto(true);
    setEmailCodigoVisivel(false); // Sempre começa mostrando HTML renderizado
  };

  const fecharModalMensagem = () => {
    setModalMensagemAberto(false);
    setMensagemSelecionada(null);
    setEmailCodigoVisivel(false);
  };

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

  const getVariacaoColor = (valor: number, positiveIsGood: boolean = true) => {
    if (valor > 0) return positiveIsGood ? "text-green-600" : "text-red-600";
    if (valor < 0) return positiveIsGood ? "text-red-600" : "text-green-600";
    return "text-gray-600";
  };

  const formatarDataHora = (valor: string) => {
    try {
      return new Date(valor).toLocaleString("pt-BR");
    } catch {
      return valor;
    }
  };

  const obterSaudacao = () => {
    const agora = new Date();
    // Obtém a hora local de São Paulo
    const hora = Number(
      agora.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      })
    );

    if (hora >= 0 && hora < 12) {
      return "Bom dia";
    } else if (hora >= 12 && hora < 18) {
      return "Boa tarde";
    } else {
      return "Boa noite";
    }
  };

  const obterNomeUsuario = () => {
    // Busca o nome do usuário do contexto de autenticação
    // Prioriza nome completo do perfil, depois metadados do auth, por fim o email
    return user?.name || "Usuário";
  };

  const renderMonetaryValue = (value: number, colorClass: string = "") => {
    const { formatted, className, shouldTruncate } = formatMonetaryResponsive(
      value,
      {
        compact: false, // Sempre mostra valor completo
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
          <h1 className="text-3xl font-bold text-gray-800">
            {obterSaudacao()}, {obterNomeUsuario()}!
          </h1>
          <p className="text-gray-600">
            Bem vindo ao Sistema de Cobrança da CP
          </p>
        </div>
        <img src={logo} alt="Logo Cresci e Perdi" className="h-10"></img>
      </div>

      {/* Acesso Rápido */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <div className="p-2 bg-gray-50 rounded-lg mr-3 border border-gray-100">
            <Zap className="w-6 h-6 text-cyan-600" />
          </div>
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <button
            onClick={() => onNavigate?.("cobrancas")}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Kanban Cobranças"
          >
            <CircleDollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-gray-700 font-medium">Kanban Cobranças</span>
          </button>
          <button
            onClick={() => onNavigate?.("cobrancas-lista")}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Gestão Cobranças"
          >
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span className="text-gray-700 font-medium">Gestão Cobranças</span>
          </button>
          <button
            onClick={() => onNavigate?.("simulacao-parcelamento")}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Simulação de Parcelamento"
          >
            <Calculator className="w-5 h-5 text-indigo-600" />
            <span className="text-gray-700 font-medium">Parcelamento</span>
          </button>
          <button
            onClick={() => onNavigate?.("unidades")}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Unidades"
          >
            <Building2 className="w-5 h-5 text-orange-600" />
            <span className="text-gray-700 font-medium">Unidades</span>
          </button>
          <button
            onClick={() => onNavigate?.("franqueados")}
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-pink-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Franqueados"
          >
            <Users className="w-5 h-5 text-pink-600" />
            <span className="text-gray-700 font-medium">Franqueados</span>
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
            className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-gray-50 transition-all duration-200"
            aria-label="Reuniões"
          >
            <Calendar className="w-5 h-5 text-purple-600" />
            <span className="text-gray-700 font-medium">Reuniões</span>
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="space-y-6">
        {/* Linha Superior - 2 Cards em Destaque */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#6B7280] hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-4 min-h-[80px]">
              <div className="p-2 bg-[#6B728020] rounded-lg flex-shrink-0 border border-[#6B728050]">
                <TrendingUp className="w-6 h-6 text-[#6B7280]" />
              </div>
              <div className="monetary-container">
                <p className="text-sm font-medium text-gray-700">
                  Valor com Juros e Multa
                </p>
                {renderMonetaryValue(
                  indicadores.totalEmAbertoAtualizado ??
                    indicadores.totalEmAberto,
                  "text-gray-900"
                )}
                <div className="mt-2 flex items-center text-sm">
                  <span
                    className={`font-semibold flex items-center ${getVariacaoColor(
                      indicadores.variacaoEmAberto,
                      false // aumento de em aberto é ruim (vermelho)
                    )}`}
                  >
                    {getVariacaoIcon(indicadores.variacaoEmAberto)}
                    <span className="ml-1">
                      {formatarPercentual(
                        Math.abs(indicadores.variacaoEmAberto)
                      )}
                    </span>
                  </span>
                  <span className="text-gray-400 ml-2">vs. mês anterior</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#6B7280] hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-4 min-h-[80px]">
              <div className="p-2 bg-[#6B728020] rounded-lg flex-shrink-0 border border-[#6B728050]">
                <TrendingUp className="w-6 h-6 text-[#6B7280]" />
              </div>
              <div className="monetary-container">
                <p className="text-sm font-medium text-gray-700">
                  Valor Original
                </p>
                {renderMonetaryValue(
                  indicadores.totalEmAbertoOriginal ??
                    indicadores.totalEmAberto,
                  "text-gray-900"
                )}
                <div className="mt-2 flex items-center text-sm">
                  <span
                    className={`font-semibold flex items-center ${getVariacaoColor(
                      indicadores.variacaoEmAbertoOriginal,
                      false // aumento de em aberto é ruim (vermelho)
                    )}`}
                  >
                    {getVariacaoIcon(indicadores.variacaoEmAbertoOriginal)}
                    <span className="ml-1">
                      {formatarPercentual(
                        Math.abs(indicadores.variacaoEmAbertoOriginal)
                      )}
                    </span>
                  </span>
                  <span className="text-gray-400 ml-2">vs. mês anterior</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Linha Inferior - 3 Cards Distribuídos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#2EBF11] flex-1 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-4 min-h-[80px]">
              <div className="p-2 bg-[#2EBF1120] rounded-lg flex-shrink-0 border border-[#2EBF1150]">
                <CheckCircle className="w-6 h-6 text-[#2EBF11]" />
              </div>
              <div className="monetary-container">
                <p className="text-sm font-medium text-gray-700">Quitado</p>
                {renderMonetaryValue(indicadores.totalQuitado, "text-gray-900")}
                <div className="mt-2 flex items-center text-sm">
                  <span
                    className={`font-semibold flex items-center ${getVariacaoColor(
                      indicadores.variacaoQuitado
                    )}`}
                  >
                    {getVariacaoIcon(indicadores.variacaoQuitado)}
                    <span className="ml-1">
                      {formatarPercentual(
                        Math.abs(indicadores.variacaoQuitado)
                      )}
                    </span>
                  </span>
                  <span className="text-gray-400 ml-2">vs. mês anterior</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#F59E0B] flex-1 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-4 min-h-[80px]">
              <div className="p-2 bg-[#F59E0B20] rounded-lg flex-shrink-0 border border-[#F59E0B50]">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <div className="monetary-container">
                <p className="text-sm font-medium text-gray-700">
                  Em Negociação
                </p>
                {renderMonetaryValue(
                  indicadores.totalNegociando,
                  "text-gray-900"
                )}
                <div className="mt-2 flex items-center text-sm">
                  <span
                    className={`font-semibold flex items-center ${getVariacaoColor(
                      indicadores.variacaoNegociando
                    )}`}
                  >
                    {getVariacaoIcon(indicadores.variacaoNegociando)}
                    <span className="ml-1">
                      {formatarPercentual(
                        Math.abs(indicadores.variacaoNegociando)
                      )}
                    </span>
                  </span>
                  <span className="text-gray-400 ml-2">vs. mês anterior</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nova Linha - Cards Jurídico e Perda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#31A3FB] flex-1 hover:shadow-xl transition-all duration-300">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-[#31A3FB20] rounded-lg flex-shrink-0 border border-[#31A3FB50]">
              <Scale className="w-6 h-6 text-[#31A3FB]" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-gray-700">Jurídico</p>
              {renderMonetaryValue(indicadores.totalJuridico, "text-gray-900")}
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold flex items-center ${getVariacaoColor(
                    indicadores.variacaoJuridico,
                    false // aumento de jurídico é neutro/ruim
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoJuridico)}
                  <span className="ml-1">
                    {formatarPercentual(Math.abs(indicadores.variacaoJuridico))}
                  </span>
                </span>
                <span className="text-gray-400 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#FF0A0E] flex-1 hover:shadow-xl transition-all duration-300">
          <div className="flex items-start space-x-4 min-h-[80px]">
            <div className="p-2 bg-[#FF0A0E20] rounded-lg flex-shrink-0 border border-[#FF0A0E50]">
              <XCircle className="w-6 h-6 text-[#FF0A0E]" />
            </div>
            <div className="monetary-container">
              <p className="text-sm font-medium text-gray-700">Perda</p>
              {renderMonetaryValue(indicadores.totalPerda, "text-gray-900")}
              <div className="mt-2 flex items-center text-sm">
                <span
                  className={`font-semibold flex items-center ${getVariacaoColor(
                    indicadores.variacaoPerda,
                    false // aumento de perda é ruim
                  )}`}
                >
                  {getVariacaoIcon(indicadores.variacaoPerda)}
                  <span className="ml-1">
                    {formatarPercentual(Math.abs(indicadores.variacaoPerda))}
                  </span>
                </span>
                <span className="text-gray-400 ml-2">vs. mês anterior</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Próximas Reuniões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-gray-50 rounded-lg mr-3 border border-gray-100">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            Próximas Reuniões
          </h3>
          <div className="text-center py-10 text-gray-500">
            O agendamento de reuniões ainda não foi implementado no sistema.
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <div className="p-2 bg-gray-50 rounded-lg mr-3 border border-gray-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            Últimos Envios
          </h3>
          <div className="space-y-4">
            {carregandoMensagens ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />{" "}
                Carregando...
              </div>
            ) : ultimasMensagens.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>Nenhuma mensagem enviada ainda.</p>
              </div>
            ) : (
              ultimasMensagens.map((m) => (
                <div
                  key={`${m.canal}-${m.id}`}
                  className={`group flex items-center justify-between p-4 border rounded-xl transition-all duration-200 cursor-pointer ${
                    m.canal === "whatsapp"
                      ? "border-gray-200 hover:border-emerald-300 hover:shadow-lg bg-gradient-to-r from-gray-50 to-white hover:from-emerald-50 hover:to-white"
                      : "border-gray-200 hover:border-blue-300 hover:shadow-lg bg-gradient-to-r from-gray-50 to-white hover:from-blue-50 hover:to-white"
                  }`}
                  onClick={() => abrirModalMensagem(m)}
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-3 rounded-full transition-colors ${
                        m.canal === "whatsapp"
                          ? "bg-emerald-100 border-2 border-emerald-200 group-hover:bg-emerald-200"
                          : "bg-blue-100 border-2 border-blue-200 group-hover:bg-blue-200"
                      }`}
                    >
                      {m.canal === "whatsapp" ? (
                        <WhatsAppIcon className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Mail className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-bold text-gray-900 text-lg">
                          {m.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                        </h4>
                      </div>
                      <p className="text-gray-600 font-medium mb-1">
                        Para: {m.destinatario}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatarDataHora(m.data)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center transition-colors ${
                    m.canal === "whatsapp"
                      ? "text-gray-400 group-hover:text-emerald-500"
                      : "text-gray-400 group-hover:text-blue-500"
                  }`}>
                    <span className="text-sm font-medium mr-2">Ver detalhes</span>
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes da Mensagem */}
      {modalMensagemAberto && mensagemSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-full ${
                    mensagemSelecionada.canal === "whatsapp"
                      ? "bg-emerald-50 border border-emerald-100"
                      : "bg-blue-50 border border-blue-100"
                  }`}
                >
                  {mensagemSelecionada.canal === "whatsapp" ? (
                    <WhatsAppIcon className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Mail className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Detalhes do Envio - {mensagemSelecionada.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Para: {mensagemSelecionada.destinatario}
                  </p>
                </div>
              </div>
              <button
                onClick={fecharModalMensagem}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {/* Informações do Envio */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Status do Envio</h4>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                      mensagemSelecionada.status === "sucesso"
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {mensagemSelecionada.status === "sucesso" ? "Enviado com Sucesso" : "Falha no Envio"}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">Data e Hora</h4>
                  <p className="text-sm text-gray-600">
                    {formatarDataHora(mensagemSelecionada.data)}
                  </p>
                </div>
              </div>

              {/* Conteúdo da Mensagem */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-700">Conteúdo da Mensagem</h4>
                  {mensagemSelecionada.canal === "email" && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEmailCodigoVisivel(false)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          !emailCodigoVisivel
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        <Eye className="w-4 h-4 inline mr-1" />
                        Visualizar
                      </button>
                      <button
                        onClick={() => setEmailCodigoVisivel(true)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          emailCodigoVisivel
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        <Code className="w-4 h-4 inline mr-1" />
                        Código
                      </button>
                    </div>
                  )}
                </div>

                {/* Exibição da Mensagem */}
                {mensagemSelecionada.canal === "whatsapp" ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p className="text-gray-800 whitespace-pre-wrap">
                      {mensagemSelecionada.mensagem}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                    {emailCodigoVisivel ? (
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {mensagemSelecionada.mensagem}
                      </pre>
                    ) : (
                      <div
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: mensagemSelecionada.mensagem
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={fecharModalMensagem}
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
