/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Calculator, Search, Plus, Minus, Calendar, DollarSign, FileText, CheckCircle, AlertTriangle, RefreshCw, Building2, CreditCard, ArrowRight, ArrowLeft, Mail } from "lucide-react";
import { SimulacaoParcelamentoService } from "../services/simulacaoParcelamentoService";
import { formatarCNPJCPF, formatarMoeda, formatarData } from "../utils/formatters";
import { toast } from "react-hot-toast";
import { WhatsAppIcon } from './ui/WhatsAppIcon';

export function GerarSimulacaoParcelamento({
  onVoltar,
}: {
  onVoltar: () => void;
}) {
  // Estados principais
  const [etapaAtual, setEtapaAtual] = useState<
    "busca" | "selecao" | "simulacao" | "proposta"
  >("busca");
  const [documentoBusca, setDocumentoBusca] = useState("");
  const [cobrancasDisponiveis, setCobrancasDisponiveis] = useState<any[]>([]);
  const [cobrancasSelecionadas, setCobrancasSelecionadas] = useState<string[]>(
    []
  );
  const [simulacao, setSimulacao] = useState<any>(null);
  const [proposta, setProposta] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(6);
  const [valorEntrada, setValorEntrada] = useState<number | undefined>(
    undefined
  );
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(() => {
    const data = new Date();
    data.setDate(data.getDate() + 30);
    return data.toISOString().split("T")[0];
  });
  const simulacaoService = new SimulacaoParcelamentoService();

  // Novo estado: lista agrupada de clientes elegíveis
  const [clientesDisponiveis, setClientesDisponiveis] = useState<any[]>([]);
  
  // Estados para controlar canais de envio da proposta
  const [enviarViaWhatsApp, setEnviarViaWhatsApp] = useState(true);
  const [enviarViaEmail, setEnviarViaEmail] = useState(true);

  // Ao montar, buscar todas as cobranças disponíveis e agrupar por cliente
  useEffect(() => {
    async function carregarClientes() {
      setCarregando(true);
      setErro("");
      try {
        const cobrancas = await simulacaoService.buscarTodasCobrancasDisponiveis();
        // Agrupa por documento (CNPJ ou CPF)
        const grupos: Record<string, any> = {};
        cobrancas.forEach(c => {
          const doc = c.cnpj || c.cpf;
          if (!doc) return;
          if (!grupos[doc]) {
            grupos[doc] = {
              documento: doc,
              tipo_documento: c.cnpj ? 'CNPJ' : 'CPF',
              cliente: c.cliente,
              cobrancas: [],
              valorTotal: 0,
              quantidade: 0,
            };
          }
          grupos[doc].cobrancas.push(c);
          grupos[doc].valorTotal += c.valor_atualizado || c.valor_original || 0;
          grupos[doc].quantidade += 1;
        });
        setClientesDisponiveis(Object.values(grupos));
      } catch (error) {
        setErro("Erro ao buscar cobranças disponíveis.");
      } finally {
        setCarregando(false);
      }
    }
    carregarClientes();
  }, []);

  // Quando selecionar um cliente, exibe as cobranças desse cliente para seleção
  const selecionarCliente = (cliente: any) => {
    setCobrancasDisponiveis(cliente.cobrancas);
    setEtapaAtual('selecao');
    setCobrancasSelecionadas([]);
    setErro("");
  };

  const buscarCobrancas = async () => {
    if (!documentoBusca.trim()) {
      setErro("Digite um CNPJ ou CPF para buscar");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const documento = documentoBusca.replace(/\D/g, "");
      const cobrancas = await simulacaoService.buscarCobrancasParaParcelamento(
        documento
      );
      if (cobrancas.length === 0) {
        setErro("Nenhuma cobrança em aberto encontrada para este documento");
        setCobrancasDisponiveis([]);
        return;
      }
      setCobrancasDisponiveis(cobrancas);
      setEtapaAtual("selecao");
      setCobrancasSelecionadas([]);
      toast.success(`${cobrancas.length} cobrança(s) encontrada(s)!`);
    } catch (error) {
      setErro("Erro ao buscar cobranças. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  const toggleSelecaoCobranca = (cobrancaId: string) => {
    setCobrancasSelecionadas((prev) => {
      if (prev.includes(cobrancaId)) {
        return prev.filter((id) => id !== cobrancaId);
      } else {
        return [...prev, cobrancaId];
      }
    });
  };

  const selecionarTodas = () => {
    setCobrancasSelecionadas(cobrancasDisponiveis.map((c) => c.id));
  };

  const limparSelecao = () => {
    setCobrancasSelecionadas([]);
  };

  const simularParcelamento = async () => {
    if (cobrancasSelecionadas.length === 0) {
      setErro("Selecione pelo menos uma cobrança para simular");
      return;
    }
    if (quantidadeParcelas < 3 || quantidadeParcelas > 42) {
      setErro("Quantidade de parcelas deve estar entre 3 e 42");
      return;
    }
    setProcessando(true);
    setErro("");
    try {
      const simulacaoResult = await simulacaoService.simularParcelamento(
        cobrancasSelecionadas,
        quantidadeParcelas,
        dataPrimeiraParcela,
        valorEntrada
      );
      setSimulacao(simulacaoResult);
      setEtapaAtual("simulacao");
      toast.success("Simulação realizada com sucesso!");
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao simular parcelamento"
      );
    } finally {
      setProcessando(false);
    }
  };

  const gerarProposta = async () => {
    if (!simulacao) return;
    setProcessando(true);
    try {
      const simulacaoId = await simulacaoService.salvarSimulacao(simulacao);
      const propostaGerada = await simulacaoService.gerarProposta(
        simulacaoId,
        ["whatsapp", "email"],
        "usuario_atual"
      );
      setProposta(propostaGerada);
      setEtapaAtual("proposta");
      toast.success("Proposta gerada com sucesso!");
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao gerar proposta"
      );
    } finally {
      setProcessando(false);
    }
  };

  const enviarProposta = async () => {
    if (!proposta?.id) return;
    if (!enviarViaWhatsApp && !enviarViaEmail) {
      toast.error("Selecione pelo menos um canal de envio");
      return;
    }

    setProcessando(true);
    const canaisEnviados = [];
    const canaisFalha = [];

    try {
      // Enviar via WhatsApp se selecionado
      if (enviarViaWhatsApp) {
        try {
          const sucessoWhatsApp = await simulacaoService.enviarPropostaWhatsApp(proposta.id);
          if (sucessoWhatsApp) {
            canaisEnviados.push("WhatsApp");
          } else {
            canaisFalha.push("WhatsApp");
          }
        } catch (error) {
          canaisFalha.push("WhatsApp");
        }
      }

      // Enviar via Email se selecionado
      if (enviarViaEmail) {
        try {
          const sucessoEmail = await simulacaoService.enviarPropostaEmail(proposta.id);
          if (sucessoEmail) {
            canaisEnviados.push("Email");
          } else {
            canaisFalha.push("Email");
          }
        } catch (error) {
          canaisFalha.push("Email");
        }
      }

      // Mostrar resultado do envio
      if (canaisEnviados.length > 0 && canaisFalha.length === 0) {
        toast.success(`Proposta enviada com sucesso via ${canaisEnviados.join(" e ")}!`);
      } else if (canaisEnviados.length > 0 && canaisFalha.length > 0) {
        toast.success(`Enviado via ${canaisEnviados.join(" e ")}`);
        toast.error(`Erro ao enviar via ${canaisFalha.join(" e ")}`);
      } else {
        toast.error(`Erro ao enviar via ${canaisFalha.join(" e ")}`);
      }
    } finally {
      setProcessando(false);
    }
  };

  const novaSimulacao = () => {
    setEtapaAtual("busca");
    setDocumentoBusca("");
    setCobrancasDisponiveis([]);
    setCobrancasSelecionadas([]);
    setSimulacao(null);
    setProposta(null);
    setErro("");
    setQuantidadeParcelas(6);
    setValorEntrada(undefined);
    setEnviarViaWhatsApp(true);
    setEnviarViaEmail(true);
  };

  const voltarEtapa = () => {
    switch (etapaAtual) {
      case "selecao":
        setEtapaAtual("busca");
        break;
      case "simulacao":
        setEtapaAtual("selecao");
        break;
      case "proposta":
        setEtapaAtual("simulacao");
        break;
    }
  };

  const totaisSelecionadas = cobrancasSelecionadas.reduce(
    (acc, id) => {
      const cobranca = cobrancasDisponiveis.find((c) => c.id === id);
      if (cobranca) {
        acc.valorOriginal += cobranca.valor_original || 0;
        acc.valorAtualizado +=
          cobranca.valor_atualizado || cobranca.valor_original || 0;
        acc.quantidade += 1;
      }
      return acc;
    },
    { valorOriginal: 0, valorAtualizado: 0, quantidade: 0 }
  );

  const dadosUnidade =
    cobrancasDisponiveis.length > 0
      ? {
          documento:
            cobrancasDisponiveis[0].cnpj || cobrancasDisponiveis[0].cpf,
          cliente: cobrancasDisponiveis[0].cliente,
          tipo_documento: cobrancasDisponiveis[0].cnpj ? "CNPJ" : "CPF",
        }
      : null;

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onVoltar}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Simulação de Parcelamento
              </h1>
              <p className="text-gray-500 text-sm">
                {etapaAtual === "busca" &&
                  "Selecione o cliente para iniciar o parcelamento"}
                {etapaAtual === "selecao" &&
                  "Selecione as cobranças para parcelar"}
                {etapaAtual === "simulacao" &&
                  "Configure e simule o parcelamento"}
                {etapaAtual === "proposta" && "Envie a proposta para o cliente"}
              </p>
            </div>
          </div>
          {/* Navegação de Etapas */}
          <div className="flex items-center space-x-4">
            {["Busca", "Seleção", "Simulação", "Proposta"].map((etapa, idx) => (
              <div key={etapa} className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    idx ===
                    ["busca", "selecao", "simulacao", "proposta"].indexOf(
                      etapaAtual
                    )
                      ? "bg-gray-900 text-white border-gray-900"
                      : idx <
                        ["busca", "selecao", "simulacao", "proposta"].indexOf(
                          etapaAtual
                        )
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-gray-200 text-gray-500 border-gray-200"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {etapa}
                </span>
                {idx < 3 && <ArrowRight className="w-4 h-4 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>
        {/* Mensagem de Erro */}
        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
            <div className="text-red-800 text-sm">{erro}</div>
          </div>
        )}

        {/* ETAPA 1: LISTA DE CLIENTES AGRUPADOS */}
        {etapaAtual === "busca" && (
          <div className="space-y-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex items-center mb-4">
                <Search className="w-6 h-6 text-gray-700 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Selecione um Cliente para Parcelamento
                </h3>
              </div>
              {carregando ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-700" />
                  <span className="ml-3 text-gray-700">Carregando clientes...</span>
                </div>
              ) : clientesDisponiveis.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Nenhum cliente elegível encontrado.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clientesDisponiveis.map((cliente) => (
                    <div
                      key={cliente.documento}
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:border-orange-400 hover:shadow cursor-pointer transition-all"
                      onClick={() => selecionarCliente(cliente)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{cliente.cliente}</h4>
                          <p className="text-xs text-gray-500">{cliente.tipo_documento}: {formatarCNPJCPF(cliente.documento)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Cobranças</p>
                          <p className="text-xl font-bold text-gray-900">{cliente.quantidade}</p>
                          <p className="text-xs text-gray-500 mt-1">Total: <span className="font-semibold text-orange-500">{formatarMoeda(cliente.valorTotal)}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 2: SELEÇÃO */}
        {etapaAtual === "selecao" && (
          <div className="space-y-6">
            {/* Resumo do Cliente */}
            {dadosUnidade && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building2 className="w-6 h-6 text-gray-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {dadosUnidade.cliente}
                      </h3>
                      <p className="text-gray-600">
                        {dadosUnidade.tipo_documento}:{" "}
                        {formatarCNPJCPF(dadosUnidade.documento)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Cobranças Disponíveis
                    </p>
                    <p className="text-2xl font-bold text-[#ff9923]">
                      {cobrancasDisponiveis.length}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Controles de Seleção */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Selecione as Cobranças ({cobrancasSelecionadas.length} de{" "}
                  {cobrancasDisponiveis.length})
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={selecionarTodas}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
                  >
                    Selecionar Todas
                  </button>
                  <button
                    onClick={limparSelecao}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Limpar Seleção
                  </button>
                </div>
              </div>

              {/* Resumo da Seleção */}
              {cobrancasSelecionadas.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-800">
                    <p className="font-medium">
                      Selecionadas: {totaisSelecionadas.quantidade} cobrança(s)
                    </p>
                    <p>
                      Valor Original:{" "}
                      {formatarMoeda(totaisSelecionadas.valorOriginal)}
                    </p>
                    <p>
                      Valor Atualizado:{" "}
                      {formatarMoeda(totaisSelecionadas.valorAtualizado)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Cobranças */}
            <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
              {cobrancasDisponiveis.map((cobranca) => {
                const selecionada = cobrancasSelecionadas.includes(cobranca.id);
                return (
                  <div
                    key={cobranca.id}
                    onClick={() => toggleSelecaoCobranca(cobranca.id)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selecionada
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selecionada
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selecionada && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-gray-800">
                            {cobranca.descricao || cobranca.tipo_cobranca}
                          </p>
                          <p className="text-sm text-gray-600">
                            Vencimento: {formatarData(cobranca.data_vencimento)}
                            {cobranca.dias_em_atraso > 0 && (
                              <span className="text-red-600 ml-2">
                                ({cobranca.dias_em_atraso} dias em atraso)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-gray-800">
                          {formatarMoeda(
                            cobranca.valor_atualizado || cobranca.valor_original
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          Original: {formatarMoeda(cobranca.valor_original)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botões de Navegação */}
            <div className="flex justify-between">
              <button
                onClick={voltarEtapa}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </button>

              <button
                onClick={() => setEtapaAtual("simulacao")}
                disabled={cobrancasSelecionadas.length === 0}
                className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Continuar para Simulação
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: SIMULAÇÃO */}
        {etapaAtual === "simulacao" && (
          <div className="space-y-6">
            {/* Resumo das Cobranças Selecionadas */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-800 mb-4">
                Resumo das Cobranças Selecionadas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Quantidade</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {totaisSelecionadas.quantidade}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Valor Original</p>
                  <p className="text-xl font-bold text-gray-800">
                    {formatarMoeda(totaisSelecionadas.valorOriginal)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Valor Atualizado</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatarMoeda(totaisSelecionadas.valorAtualizado)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="text-lg font-bold text-gray-800">
                    {dadosUnidade?.cliente}
                  </p>
                </div>
              </div>
            </div>

            {/* Parâmetros da Simulação */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  Quantidade de Parcelas
                </label>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() =>
                      setQuantidadeParcelas(Math.max(3, quantidadeParcelas - 1))
                    }
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="3"
                    max="42"
                    value={quantidadeParcelas}
                    onChange={(e) =>
                      setQuantidadeParcelas(parseInt(e.target.value) || 3)
                    }
                    className="w-20 text-center px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() =>
                      setQuantidadeParcelas(
                        Math.min(42, quantidadeParcelas + 1)
                      )
                    }
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Entre 3 e 42 parcelas
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Valor da Entrada (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valorEntrada || ""}
                  onChange={(e) =>
                    setValorEntrada(parseFloat(e.target.value) || undefined)
                  }
                  placeholder="Deixe vazio para entrada mínima"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Mínimo:{" "}
                  {formatarMoeda(totaisSelecionadas.valorAtualizado * 0.2)}
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Data da Primeira Parcela
                </label>
                <input
                  type="date"
                  value={dataPrimeiraParcela}
                  onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Sugestão: 30 dias a partir de hoje
                </p>
              </div>
            </div>

            {/* Botão de Simular */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    Pronto para Simular?
                  </h4>
                  <p className="text-gray-600">
                    {totaisSelecionadas.quantidade} cobrança(s) •{" "}
                    {quantidadeParcelas} parcelas • Valor:{" "}
                    {formatarMoeda(totaisSelecionadas.valorAtualizado)}
                  </p>
                </div>
                <button
                  onClick={simularParcelamento}
                  disabled={processando || cobrancasSelecionadas.length === 0}
                  className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center"
                >
                  {processando ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Calculator className="w-5 h-5 mr-2" />
                  )}
                  {processando ? "Simulando..." : "Simular Parcelamento"}
                </button>
              </div>
            </div>

            {/* Botão de Voltar só aparece se a simulação ainda não foi feita */}
            {!simulacao && (
              <div className="flex justify-between">
                <button
                  onClick={voltarEtapa}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ETAPA 4: RESULTADO DA SIMULAÇÃO */}
        {etapaAtual === "simulacao" && simulacao && (
          <div className="space-y-6 mt-6">
            {/* Resultado da Simulação */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2" />
                Resultado da Simulação
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Valor Original</p>
                  <p className="text-xl font-bold text-gray-800">
                    {formatarMoeda(simulacao.valor_original)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Valor Atualizado</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatarMoeda(simulacao.valor_atualizado)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Entrada</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatarMoeda(simulacao.valor_entrada || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total do Parcelamento</p>
                  <p className="text-xl font-bold text-[#ff9923]">
                    {formatarMoeda(simulacao.valor_total_parcelamento)}
                  </p>
                </div>
              </div>

              {/* Cronograma de Parcelas */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-3">
                  Cronograma de Pagamentos:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {simulacao.valor_entrada > 0 && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-green-800">
                        Entrada
                      </span>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          {formatarMoeda(simulacao.valor_entrada)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatarData(simulacao.data_primeira_parcela)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {simulacao.parcelas.map((parcela: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-blue-50 rounded-lg"
                      >
                        <span className="font-medium text-blue-800">
                          Parcela {parcela.numero}
                        </span>
                        <div className="text-right">
                          <p className="font-bold text-[#ff9923]">
                            {formatarMoeda(parcela.valor)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatarData(parcela.data_vencimento)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detalhes dos Juros */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <h4 className="font-medium text-yellow-800 mb-2">
                  Detalhes dos Encargos:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Multa:</span>
                    <span className="font-medium text-yellow-700 ml-2">
                      {simulacao.percentual_multa}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Juros de Mora:</span>
                    <span className="font-medium text-yellow-700 ml-2">
                      {simulacao.percentual_juros_mora}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Economia na Entrada:</span>
                    <span className="font-medium text-green-700 ml-2">
                      {formatarMoeda(simulacao.economia_total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex justify-between">
              <button
                onClick={voltarEtapa}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setSimulacao(null);
                    // Mantém na etapa de simulação para ajustar parâmetros
                  }}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2 inline" />
                  Nova Simulação
                </button>

                <button
                  onClick={gerarProposta}
                  disabled={processando}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {processando ? (
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <FileText className="w-5 h-5 mr-2" />
                  )}
                  {processando ? "Gerando..." : "Gerar Proposta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 5: PROPOSTA GERADA */}
        {etapaAtual === "proposta" && proposta && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <CheckCircle className="w-6 h-6 mr-2" />
                Proposta Gerada com Sucesso!
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">
                    Informações da Proposta:
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Cliente:</span>{" "}
                      {dadosUnidade?.cliente}
                    </p>
                    <p>
                      <span className="font-medium">Documento:</span>{" "}
                      {formatarCNPJCPF(dadosUnidade?.documento || "")}
                    </p>
                    <p>
                      <span className="font-medium">Cobranças:</span>{" "}
                      {totaisSelecionadas.quantidade}
                    </p>
                    <p>
                      <span className="font-medium">Parcelas:</span>{" "}
                      {simulacao.quantidade_parcelamento}x
                    </p>
                    <p>
                      <span className="font-medium">Valor Total:</span>{" "}
                      {formatarMoeda(simulacao.valor_total_parcelamento)}
                    </p>
                    <p>
                      <span className="font-medium">Válida até:</span>{" "}
                      {formatarData(proposta.data_expiracao)}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">
                    Preview da Mensagem:
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                      {proposta.mensagem_proposta.substring(0, 300)}...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações de Envio */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-medium text-gray-800 mb-6">
                Selecione os canais para envio da proposta:
              </h4>
              
              {/* Opções de Canal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* WhatsApp */}
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    enviarViaWhatsApp 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setEnviarViaWhatsApp(!enviarViaWhatsApp)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      enviarViaWhatsApp 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-gray-300'
                    }`}>
                      {enviarViaWhatsApp && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <WhatsAppIcon size={24} className="text-green-600" />
                    <div>
                      <h5 className="font-medium text-gray-800">WhatsApp</h5>
                      <p className="text-sm text-gray-500">Envio direto via WhatsApp</p>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div 
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    enviarViaEmail 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setEnviarViaEmail(!enviarViaEmail)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      enviarViaEmail 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {enviarViaEmail && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <Mail size={24} className="text-blue-600" />
                    <div>
                      <h5 className="font-medium text-gray-800">Email</h5>
                      <p className="text-sm text-gray-500">Envio para o email cadastrado</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão de Envio */}
              <button
                onClick={enviarProposta}
                disabled={processando || (!enviarViaWhatsApp && !enviarViaEmail)}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {processando ? (
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <div className="flex items-center">
                    {enviarViaWhatsApp && <WhatsAppIcon size={20} className="mr-2" />}
                    {enviarViaEmail && <Mail size={20} className="mr-2" />}
                  </div>
                )}
                {processando 
                  ? "Enviando..." 
                  : `Enviar Proposta${
                      enviarViaWhatsApp && enviarViaEmail 
                        ? " (WhatsApp + Email)"
                        : enviarViaWhatsApp 
                        ? " (WhatsApp)"
                        : enviarViaEmail 
                        ? " (Email)"
                        : ""
                    }`
                }
              </button>

              {(!enviarViaWhatsApp && !enviarViaEmail) && (
                <p className="text-center text-sm text-red-500 mt-2">
                  Selecione pelo menos um canal de envio
                </p>
              )}
            </div>

            {/* Botões finais */}
            <div className="flex justify-between mt-8">
              <button
                onClick={novaSimulacao}
                className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nova Simulação
              </button>
              <button
                onClick={voltarEtapa}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
