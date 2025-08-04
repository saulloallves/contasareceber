/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import {
  DollarSign,
  Calculator,
  MessageSquare,
  Mail,
  Filter,
  RefreshCw,
  Eye,
  X,
  Scale,
} from "lucide-react";
import { CobrancaService } from "../services/cobrancaService";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { UnidadesService } from "../services/unidadesService";
import { EmailService } from "../services/emailService";
import {
  formatarMoeda,
  formatarData,
  formatarCNPJCPF,
} from "../utils/formatters";

export function PainelOperacional() {
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [notificacao, setNotificacao] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);
  const [filtros, setFiltros] = useState({
    status: "",
    busca: "",
    dataInicio: "",
    dataFim: "",
    valorMin: "",
    valorMax: "",
    apenasInadimplentes: false,
  });

  // Estados dos modais
  const [modalAberto, setModalAberto] = useState<
    "simular" | "proposta" | "detalhes" | "mensagem" | null
  >(null);
  const [cobrancaSelecionada, setCobrancaSelecionada] = useState<any>(null);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<any>(null);
  const [abaDetalhes, setAbaDetalhes] = useState<"cobranca" | "unidade">(
    "cobranca"
  );
  const [simulacaoAtual, setSimulacaoAtual] = useState<any>(null);

  // Form de simulação
  const [formSimulacao, setFormSimulacao] = useState({
    quantidade_parcelas: 3,
    data_primeira_parcela: "",
    valor_entrada: 0,
  });

  // Form de proposta
  const [formProposta, setFormProposta] = useState({
    canais_envio: ["whatsapp"] as ("whatsapp" | "email")[],
    observacoes: "",
  });

  // Form de mensagem
  const [formMensagem, setFormMensagem] = useState({
    template: "padrao",
    mensagem_personalizada: "",
    canal: "whatsapp" as "whatsapp" | "email",
  });

  const cobrancaService = new CobrancaService();
  const simulacaoService = new SimulacaoParcelamentoService();
  const unidadesService = new UnidadesService();
  const emailService = new EmailService();

  // Templates de mensagem padrão
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
  };

  useEffect(() => {
    carregarCobrancas();
  }, [filtros]);

  const carregarCobrancas = async () => {
    setCarregando(true);
    try {
      const dados = await cobrancaService.buscarCobrancas(filtros);
      setCobrancas(dados);
    } catch (error) {
      console.error("Erro ao carregar cobranças:", error);
    } finally {
      setCarregando(false);
    }
  };

  const abrirModalSimulacao = (cobranca: any) => {
    setCobrancaSelecionada(cobranca);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: "",
      valor_entrada: 0,
    });
    setSimulacaoAtual(null);

    // Busca dados da unidade para ter disponível no envio de email
    unidadesService
      .buscarUnidadePorCnpj(cobranca.cnpj)
      .then((unidade) => {
        setUnidadeSelecionada(unidade);
      })
      .catch((error) => {
        console.error("Erro ao buscar dados da unidade:", error);
        setUnidadeSelecionada(null);
      });

    setModalAberto("simular");
  };

  const abrirModalDetalhes = async (cobranca: any) => {
    setCobrancaSelecionada(cobranca);
    setAbaDetalhes("cobranca");

    // Busca dados da unidade
    try {
      const unidade = await unidadesService.buscarUnidadePorCnpj(cobranca.cnpj);
      setUnidadeSelecionada(unidade);
    } catch (error) {
      console.error("Erro ao buscar dados da unidade:", error);
      setUnidadeSelecionada(null);
    }

    setModalAberto("detalhes");
  };

  const abrirModalMensagem = async (cobranca: any) => {
    setCobrancaSelecionada(cobranca);
    setFormMensagem({
      template: "padrao",
      mensagem_personalizada: "",
      canal: "whatsapp",
    });

    // Busca dados da unidade para templates
    try {
      const unidade = await unidadesService.buscarUnidadePorCnpj(cobranca.cnpj);
      setUnidadeSelecionada(unidade);
    } catch (error) {
      console.error("Erro ao buscar dados da unidade:", error);
      setUnidadeSelecionada(null);
    }

    setModalAberto("mensagem");
  };

  const simularParcelamento = async () => {
    if (!cobrancaSelecionada || !formSimulacao.data_primeira_parcela) {
      alert("Data da primeira parcela é obrigatória");
      return;
    }

    setProcessando(true);
    try {
      const simulacao = await simulacaoService.simularParcelamento(
        cobrancaSelecionada.id,
        formSimulacao.quantidade_parcelas,
        formSimulacao.data_primeira_parcela,
        formSimulacao.valor_entrada || undefined
      );

      setSimulacaoAtual(simulacao);
    } catch (error) {
      alert(`Erro na simulação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const gerarProposta = async () => {
    if (!simulacaoAtual) return;

    setProcessando(true);
    try {
      // Salva simulação primeiro
      const simulacaoId = await simulacaoService.salvarSimulacao(
        simulacaoAtual
      );

      // Gera proposta
      const proposta = await simulacaoService.gerarProposta(
        simulacaoId,
        formProposta.canais_envio,
        "usuario_atual"
      );

      // Envia pelos canais selecionados
      const resultados = [];

      if (formProposta.canais_envio.includes("whatsapp")) {
        const sucessoWhatsApp = await simulacaoService.enviarPropostaWhatsApp(
          proposta.id!
        );
        resultados.push(`WhatsApp: ${sucessoWhatsApp ? "Enviado" : "Falha"}`);
      }

      if (formProposta.canais_envio.includes("email")) {
        const resultadoEmail = await emailService.enviarPropostaParcelamento(
          simulacaoAtual,
          unidadeSelecionada,
          cobrancaSelecionada
        );
        resultados.push(
          `Email: ${
            resultadoEmail.sucesso
              ? "Enviado"
              : `Falha - ${resultadoEmail.erro}`
          }`
        );
      }

      alert(`Proposta gerada e enviada!\n${resultados.join("\n")}`);

      fecharModal();
      carregarCobrancas(); // Recarrega para atualizar status
    } catch (error) {
      alert(`Erro ao gerar proposta: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!cobrancaSelecionada || !unidadeSelecionada) {
      alert("Dados da cobrança ou unidade não encontrados");
      return;
    }

    if (
      formMensagem.template === "personalizada" &&
      !formMensagem.mensagem_personalizada.trim()
    ) {
      alert("Digite uma mensagem personalizada");
      return;
    }

    setProcessando(true);
    try {
      if (formMensagem.canal === "whatsapp") {
        const mensagemFinal =
          formMensagem.template === "personalizada"
            ? formMensagem.mensagem_personalizada
            : aplicarVariaveis(
                templatesPadrao[
                  formMensagem.template as keyof typeof templatesPadrao
                ]
              );

        console.log("Enviando WhatsApp:", {
          telefone: unidadeSelecionada.telefone_franqueado,
          mensagem: mensagemFinal,
        });
        alert("Mensagem enviada via WhatsApp!");
      } else {
        // Envia email real
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
          alert("✅ Email enviado com sucesso!");
        } else {
          alert(`❌ Erro ao enviar email: ${resultado.erro}`);
        }
      }

      fecharModal();
    } catch (error) {
      alert(`Erro ao enviar mensagem: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const aplicarVariaveis = (template: string) => {
    if (!cobrancaSelecionada || !unidadeSelecionada) return template;

    const variaveis = {
      "{{cliente}}": cobrancaSelecionada.cliente,
      "{{codigo_unidade}}":
        unidadeSelecionada.codigo_unidade || cobrancaSelecionada.cnpj,
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

  const fecharModal = () => {
    setModalAberto(null);
    setCobrancaSelecionada(null);
    setSimulacaoAtual(null);
    setFormSimulacao({
      quantidade_parcelas: 3,
      data_primeira_parcela: "",
      valor_entrada: 0,
    });
    setFormMensagem({
      template: "padrao",
      mensagem_personalizada: "",
      canal: "whatsapp",
    });
    setUnidadeSelecionada(null);
    setAbaDetalhes("cobranca");
    setFormProposta({
      canais_envio: ["whatsapp"],
      observacoes: "",
    });
  };

  const calcularJuros = (cobranca: any) => {
    const valorOriginal = cobranca.valor_original;
    const valorAtualizado = cobranca.valor_atualizado || valorOriginal;
    return valorAtualizado - valorOriginal;
  };

  const calcularDiasAtraso = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diffTime = hoje.getTime() - vencimento.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getPreviewMensagem = () => {
    if (formMensagem.template === "personalizada") {
      return formMensagem.mensagem_personalizada;
    }
    return aplicarVariaveis(
      templatesPadrao[formMensagem.template as keyof typeof templatesPadrao]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "quitado":
        return "bg-green-100 text-green-800";
      case "negociando":
        return "bg-yellow-100 text-yellow-800";
      case "em_aberto":
        return "bg-red-100 text-red-800";
      case "judicial":
        return "bg-red-100 text-red-800 border border-red-300";
      case "em_tratativa_juridica":
        return "bg-purple-100 text-purple-800";
      case "em_tratativa_critica":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const podeSimularParcelamento = (cobranca: any) => {
    const valorAtualizado =
      cobranca.valor_atualizado || cobranca.valor_original;
    return cobranca.status !== "quitado" && valorAtualizado >= 500;
  };

  const podeAcionarJuridico = (cobranca: any) => {
    const valorAtualizado =
      cobranca.valor_atualizado || cobranca.valor_original;
    const diasAtraso = cobranca.dias_em_atraso || 0;

    // Critérios para habilitar o acionamento jurídico
    return (
      cobranca.status === "em_aberto" &&
      valorAtualizado > 5000 &&
      diasAtraso >= 91
    );
  };

  const acionarJuridico = async (cobranca: any) => {
    const valorAtualizado =
      cobranca.valor_atualizado || cobranca.valor_original;

    if (
      !confirm(
        `🚨 ACIONAMENTO JURÍDICO - ${cobranca.cliente}

CRITÉRIOS VALIDADOS:
✓ Valor: ${formatarMoeda(valorAtualizado)} (superior a R$ 5.000,00)
✓ Status: Em aberto há ${cobranca.dias_em_atraso || 0} dias (≥91 dias)  
✓ Aviso de débito enviado: Sim
✓ Sem resposta do cliente

CRITÉRIOS QUE SERÃO VALIDADOS NO SISTEMA:
• Score de risco deve ser igual a zero
• 3+ cobranças ignoradas nos últimos 15 dias  
• Acordo descumprido OU reincidência nos últimos 6 meses

⚠️ Esta ação enviará notificação extrajudicial via e-mail e WhatsApp.

Confirma o acionamento jurídico?`
      )
    ) {
      return;
    }

    setProcessando(true);
    try {
      const response = await fetch(
        "https://uveugjjntywsfbcjrpgu.supabase.co/functions/v1/acionar-juridico-cobranca",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            cobrancaId: cobranca.id,
          }),
        }
      );

      const resultado = await response.json();

      if (resultado.sucesso) {
        setNotificacao({
          tipo: "sucesso",
          mensagem:
            "Cobrança acionada no jurídico com sucesso! A unidade foi notificada por e-mail e WhatsApp.",
        });
        await carregarCobrancas(); // Recarrega a lista para atualizar os status

        // Remove a notificação após 5 segundos
        setTimeout(() => setNotificacao(null), 5000);
      } else {
        setNotificacao({
          tipo: "erro",
          mensagem: `Erro ao acionar jurídico: ${resultado.mensagem}`,
        });
        setTimeout(() => setNotificacao(null), 5000);
      }
    } catch (error) {
      console.error("Erro ao acionar jurídico:", error);
      setNotificacao({
        tipo: "erro",
        mensagem: "Erro ao comunicar com o servidor. Tente novamente.",
      });
      setTimeout(() => setNotificacao(null), 5000);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Painel Operacional de Cobrança
              </h1>
              <p className="text-gray-600">
                Gestão diária com simulação de parcelamento integrada
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => carregarCobrancas()}
              disabled={carregando}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${carregando ? "animate-spin" : ""}`}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select
              value={filtros.status}
              onChange={(e) =>
                setFiltros({ ...filtros, status: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="em_aberto">Em Aberto</option>
              <option value="negociando">Negociando</option>
              <option value="quitado">Quitado</option>
              <option value="em_tratativa_juridica">Tratativa Jurídica</option>
            </select>

            <input
              type="text"
              value={filtros.busca}
              onChange={(e) =>
                setFiltros({ ...filtros, busca: e.target.value })
              }
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

            <div className="flex items-center">
              <input
                type="checkbox"
                id="apenasInadimplentes"
                checked={filtros.apenasInadimplentes}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    apenasInadimplentes: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="apenasInadimplentes"
                className="ml-2 text-sm text-gray-700"
              >
                Apenas inadimplentes
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Cobranças */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
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
                          {formatarCNPJCPF(cobranca.cnpj)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-red-600">
                          {formatarMoeda(
                            cobranca.valor_atualizado || cobranca.valor_original
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Original: {formatarMoeda(cobranca.valor_original)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {formatarData(cobranca.data_vencimento)}
                        </div>
                        {cobranca.dias_em_atraso > 0 && (
                          <div className="text-sm text-red-600">
                            {cobranca.dias_em_atraso} dias em atraso
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          cobranca.status
                        )}`}
                      >
                        {cobranca.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {cobranca.unidades_franqueadas?.nome_franqueado ||
                            "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cobranca.unidades_franqueadas?.codigo_unidade ||
                            cobranca.cnpj}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {podeSimularParcelamento(cobranca) && (
                          <button
                            onClick={() => abrirModalSimulacao(cobranca)}
                            className="text-green-600 hover:text-green-900"
                            title="Simular Parcelamento"
                          >
                            <Calculator className="w-5 h-5" />
                          </button>
                        )}
                        {podeAcionarJuridico(cobranca) && (
                          <button
                            onClick={() => acionarJuridico(cobranca)}
                            className="text-red-600 hover:text-red-900"
                            title="Acionar Jurídico"
                            disabled={processando}
                          >
                            <Scale className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          onClick={() => abrirModalDetalhes(cobranca)}
                          title="Ver detalhes da cobrança"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => abrirModalMensagem(cobranca)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Enviar mensagem"
                        >
                          <MessageSquare className="w-5 h-5" />
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

      {/* Modal de Simulação */}
      {modalAberto === "simular" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Simulação de Parcelamento
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Dados da Cobrança */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-800 mb-2">
                Dados da Cobrança:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Cliente:</span>{" "}
                  {cobrancaSelecionada.cliente}
                </div>
                <div>
                  <span className="font-medium">CNPJ:</span>{" "}
                  {formatarCNPJCPF(cobrancaSelecionada.cnpj)}
                </div>
                <div>
                  <span className="font-medium">Valor Atualizado:</span>{" "}
                  {formatarMoeda(
                    cobrancaSelecionada.valor_atualizado ||
                      cobrancaSelecionada.valor_original
                  )}
                </div>
                <div>
                  <span className="font-medium">Vencimento:</span>{" "}
                  {formatarData(cobrancaSelecionada.data_vencimento)}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  {cobrancaSelecionada.status}
                </div>
                <div>
                  <span className="font-medium">Dias em Atraso:</span>{" "}
                  {cobrancaSelecionada.dias_em_atraso || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuração da Simulação */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800">
                  Configurar Parcelamento:
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
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                    <option value={5}>5x</option>
                    <option value={6}>6x</option>
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
                  disabled={processando || !formSimulacao.data_primeira_parcela}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processando ? "Simulando..." : "Simular Parcelamento"}
                </button>
              </div>

              {/* Resultado da Simulação */}
              {simulacaoAtual && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-4">
                    Resultado da Simulação:
                  </h4>

                  <div className="space-y-3 mb-4">
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
                    {simulacaoAtual.valor_entrada && (
                      <div className="flex justify-between">
                        <span>Entrada:</span>
                        <span className="font-medium text-green-600">
                          {formatarMoeda(simulacaoAtual.valor_entrada)}
                        </span>
                      </div>
                    )}
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
                        10% ({formatarMoeda(simulacaoAtual.parcelas[0].multa)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Juros Mora:</span>
                      <span className="font-medium">
                        1.5% (
                        {formatarMoeda(simulacaoAtual.parcelas[0].juros_mora)})
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-blue-600">
                        {formatarMoeda(simulacaoAtual.valor_total_parcelamento)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3 mb-4">
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

                  <button
                    onClick={() => setModalAberto("proposta")}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Gerar Proposta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Proposta */}
      {modalAberto === "proposta" && simulacaoAtual && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Gerar Proposta de Parcelamento
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Resumo da Simulação */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">
                  Resumo da Simulação:
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    Valor Atualizado:{" "}
                    {formatarMoeda(simulacaoAtual.valor_atualizado)}
                  </div>
                  <div>
                    Parcelas: {simulacaoAtual.quantidade_parcelas}x{" "}
                    {formatarMoeda(simulacaoAtual.parcelas[0].valor)}
                  </div>
                  <div>
                    Multa: 10% (
                    {formatarMoeda(simulacaoAtual.parcelas[0].multa)})
                  </div>
                  <div>
                    Juros Mora: 1.5% (
                    {formatarMoeda(simulacaoAtual.parcelas[0].juros_mora)})
                  </div>
                  <div>
                    Total:{" "}
                    {formatarMoeda(simulacaoAtual.valor_total_parcelamento)}
                  </div>
                </div>
              </div>

              {/* Canais de Envio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canais de Envio
                </label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="whatsapp"
                      checked={formProposta.canais_envio.includes("whatsapp")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: [
                              ...formProposta.canais_envio,
                              "whatsapp",
                            ],
                          });
                        } else {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: formProposta.canais_envio.filter(
                              (c) => c !== "whatsapp"
                            ),
                          });
                        }
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label
                      htmlFor="whatsapp"
                      className="ml-2 text-sm text-gray-700 flex items-center"
                    >
                      <MessageSquare className="w-4 h-4 mr-1 text-green-600" />
                      WhatsApp
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email"
                      checked={formProposta.canais_envio.includes("email")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: [
                              ...formProposta.canais_envio,
                              "email",
                            ],
                          });
                        } else {
                          setFormProposta({
                            ...formProposta,
                            canais_envio: formProposta.canais_envio.filter(
                              (c) => c !== "email"
                            ),
                          });
                        }
                      }}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label
                      htmlFor="email"
                      className="ml-2 text-sm text-gray-700 flex items-center"
                    >
                      <Mail className="w-4 h-4 mr-1 text-blue-600" />
                      Email
                    </label>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={formProposta.observacoes}
                  onChange={(e) =>
                    setFormProposta({
                      ...formProposta,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Observações adicionais para a proposta..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={gerarProposta}
                disabled={processando || formProposta.canais_envio.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {processando ? "Gerando..." : "Gerar e Enviar Proposta"}
              </button>
              <button
                onClick={() => setModalAberto("simular")}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mensagem */}
      {modalAberto === "mensagem" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Enviar Mensagem de Cobrança
              </h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuração da Mensagem */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Canal de Envio
                  </label>
                  <select
                    value={formMensagem.canal}
                    onChange={(e) =>
                      setFormMensagem({
                        ...formMensagem,
                        canal: e.target.value as "whatsapp" | "email",
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
                  onClick={enviarMensagem}
                  disabled={processando}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {processando
                    ? "Enviando..."
                    : `Enviar via ${
                        formMensagem.canal === "whatsapp" ? "WhatsApp" : "Email"
                      }`}
                </button>
              </div>

              {/* Preview da Mensagem */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-4">
                  Preview da Mensagem:
                </h4>
                <div className="bg-white border rounded-lg p-4 min-h-[300px]">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                    {getPreviewMensagem()}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {modalAberto === "detalhes" && cobrancaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes da Cobrança</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b mb-6">
              <button
                onClick={() => setAbaDetalhes("cobranca")}
                className={`px-4 py-2 font-medium ${
                  abaDetalhes === "cobranca"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Dados da Cobrança
              </button>
              <button
                onClick={() => setAbaDetalhes("unidade")}
                className={`px-4 py-2 font-medium ${
                  abaDetalhes === "unidade"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Dados da Unidade
              </button>
            </div>

            {/* Conteúdo das Abas */}
            {abaDetalhes === "cobranca" && (
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
              </div>
            )}

            {abaDetalhes === "unidade" && unidadeSelecionada && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nome do Franqueado
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.nome_franqueado || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Código da Unidade
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.codigo_unidade || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Telefone
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.telefone_franqueado || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.email_franqueado || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Cidade
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.cidade || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Estado
                      </label>
                      <p className="mt-1 text-sm text-gray-900">
                        {unidadeSelecionada.estado || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notificação */}
      {notificacao && (
        <div
          className={`fixed top-4 right-4 max-w-sm w-full rounded-lg shadow-lg p-4 z-50 ${
            notificacao.tipo === "sucesso"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {notificacao.tipo === "sucesso" ? "✅ Sucesso!" : "❌ Erro!"}
              </p>
              <p className="mt-1 text-sm">{notificacao.mensagem}</p>
            </div>
            <button
              onClick={() => setNotificacao(null)}
              className="ml-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
