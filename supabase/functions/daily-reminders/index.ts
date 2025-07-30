/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Início do Código Combinado ---

// Helper: formatters.ts
function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(data: string | null) {
  if (!data) return "N/A";
  // Corrige o problema de fuso horário ao criar a data
  const dataObj = new Date(`${data}T00:00:00`);
  const offset = dataObj.getTimezoneOffset();
  const dataCorrigida = new Date(dataObj.getTime() + offset * 60 * 1000);
  return dataCorrigida.toLocaleDateString("pt-BR");
}

// Service: EvolutionApiService.ts
class EvolutionApiService {
  private API_URL = Deno.env.get("VITE_EVOLUTION_API_URL");
  private API_KEY = Deno.env.get("VITE_EVOLUTION_API_KEY");

  async sendTextMessage(payload: {
    instanceName: string;
    number: string;
    text: string;
  }) {
    if (!this.API_URL || !this.API_KEY) {
      console.error(
        "Evolution API URL or Key not configured in Supabase secrets."
      );
      throw new Error(
        "Evolution API URL or Key not configured in Supabase secrets."
      );
    }

    const endpoint = `${this.API_URL}/message/sendText/${payload.instanceName}`;
    // Payload igual ao serviço funcional
    const requestBody = {
      number: payload.number,
      text: payload.text,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: this.API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      console.error(`Evolution API Error: ${JSON.stringify(errorData)}`);
      throw new Error(`Evolution API Error: ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }
}
const evolutionApiService = new EvolutionApiService();

// Lógica Principal: lembreteService.ts
class LembreteService {
  private supabase;

  constructor(req: Request) {
    // Criar um cliente Supabase com o token de autorização do request original
    this.supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
  }

  async enviarLembretesDiarios() {
    const resultados = {
      preVencimento: 0,
      posVencimento1d: 0,
      posVencimento3d: 0,
      posVencimento7d: 0,
      alertasGerados: 0,
    };

    resultados.preVencimento = await this.enviarLembretesPreVencimento();
    resultados.posVencimento1d = await this.enviarLembretesPosVencimento(1);
    resultados.posVencimento3d = await this.enviarLembretesPosVencimento(3);
    resultados.posVencimento7d = await this.enviarLembretesPosVencimento(7);
    resultados.alertasGerados = await this.gerarAlertasInternos();

    return resultados;
  }

  private async enviarLembretesPreVencimento() {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().split("T")[0];

    const { data: cobrancas, error } = await this.supabase
      .from("cobrancas_franqueados")
      .select("*, unidades_franqueadas(telefone_franqueado)")
      .eq("data_vencimento", dataAmanha)
      .eq("status", "a_vencer");

    if (error) {
      console.error("Erro ao buscar cobranças pré-vencimento:", error);
      return 0;
    }

    const cobrancasComTelefone = cobrancas.filter(
      (c) =>
        c.unidades_franqueadas && c.unidades_franqueadas.telefone_franqueado
    );
    let enviados = 0;
    for (const cobranca of cobrancasComTelefone) {
      const tipoEnvio = "pre_vencimento_1d";
      if (await this.verificarEnvioPrevio(cobranca.id, tipoEnvio)) continue;

      const mensagem = this.gerarTemplatePreVencimento(cobranca);
      await this.enviarElogar(cobranca, mensagem, tipoEnvio);
      enviados++;
    }
    return enviados;
  }

  private async enviarLembretesPosVencimento(diasAtraso: number) {
    const { data: cobrancas, error } = await this.supabase
      .from("cobrancas_franqueados")
      .select("*, unidades_franqueadas(telefone_franqueado)")
      .eq("dias_em_atraso", diasAtraso)
      .eq("status", "em_aberto");

    if (error) {
      console.error(
        `Erro ao buscar cobranças com ${diasAtraso} dias de atraso:`,
        error
      );
      return 0;
    }

    const cobrancasComTelefone = cobrancas.filter(
      (c) =>
        c.unidades_franqueadas && c.unidades_franqueadas.telefone_franqueado
    );
    let enviados = 0;
    for (const cobranca of cobrancasComTelefone) {
      const tipoEnvio = `pos_vencimento_${diasAtraso}d`;
      if (await this.verificarEnvioPrevio(cobranca.id, tipoEnvio)) continue;

      const mensagem = this.gerarTemplatePosVencimento(cobranca, diasAtraso);
      await this.enviarElogar(cobranca, mensagem, tipoEnvio);
      enviados++;
    }
    return enviados;
  }

  private async gerarAlertasInternos() {
    const { data: cobrancas, error } = await this.supabase
      .from("cobrancas_franqueados")
      .select("id, cnpj, cliente, valor_atualizado")
      .gt("dias_em_atraso", 10)
      .eq("status", "em_aberto");

    if (error) {
      console.error("Erro ao buscar cobranças para alerta interno:", error);
      return 0;
    }

    let alertasGerados = 0;
    for (const cobranca of cobrancas) {
      const tipoAlerta = "sem_retorno_10d";

      // Verifica se já existe um alerta para este título e tipo
      const { data: alertaExistente, error: errAlerta } = await this.supabase
        .from("alertas_sistema")
        .select("id")
        .eq("titulo_id", cobranca.id)
        .eq("tipo_alerta", tipoAlerta)
        .limit(1);

      if (errAlerta) {
        console.error("Erro ao verificar alerta existente:", errAlerta);
        continue;
      }

      if (alertaExistente && alertaExistente.length > 0) {
        continue; // Pula se o alerta já existe
      }

      const { error: insertError } = await this.supabase
        .from("alertas_sistema")
        .insert({
          tipo_alerta: tipoAlerta,
          titulo_id: cobranca.id,
          cnpj_unidade: cobranca.cnpj,
          descricao: `Cobrança para ${cobranca.cliente} (${formatarMoeda(
            cobranca.valor_atualizado || 0
          )}) está há mais de 10 dias sem retorno. Ação manual necessária.`,
          nivel_urgencia: "alta",
          status: "novo",
        });

      if (insertError) {
        console.error("Erro ao inserir alerta:", insertError);
      } else {
        alertasGerados++;
      }
    }
    return alertasGerados;
  }

  private async enviarElogar(
    cobranca: any,
    mensagem: string,
    tipoEnvio: string
  ) {
    const telefone = cobranca.unidades_franqueadas?.telefone_franqueado;
    if (!telefone) return;

    const telefoneFormatado = telefone.replace(/\D/g, "");
    const payload = {
      instanceName: "automacoes_backup",
      number: `55${telefoneFormatado}`,
      text: mensagem,
    };

    try {
      await evolutionApiService.sendTextMessage(payload);
      await this.registrarEnvio(
        cobranca.id,
        mensagem,
        "sucesso",
        tipoEnvio,
        null
      );
      // Pausa de 5 segundos para evitar rate limit
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (e: any) {
      await this.registrarEnvio(
        cobranca.id,
        mensagem,
        "falha",
        tipoEnvio,
        e.message
      );
    }
  }

  private async registrarEnvio(
    titulo_id: number,
    mensagem: string,
    status: "sucesso" | "falha",
    tipo_envio: string,
    erro_detalhes: string | null
  ) {
    await this.supabase.from("envios_mensagem").insert({
      titulo_id,
      mensagem_enviada: mensagem,
      status_envio: status,
      tipo_envio,
      erro_detalhes,
    });
  }

  private async verificarEnvioPrevio(
    tituloId: number,
    tipoEnvio: string
  ): Promise<boolean> {
    const { count, error } = await this.supabase
      .from("envios_mensagem")
      .select("id", { count: "exact", head: true })
      .eq("titulo_id", tituloId)
      .eq("tipo_envio", tipoEnvio);

    if (error) {
      console.error("Erro ao verificar envio prévio:", error);
      return true; // Assume que já foi enviado para evitar duplicidade em caso de erro
    }
    return (count || 0) > 0;
  }

  private gerarTemplatePreVencimento(cobranca: any): string {
    return `Olá, ${cobranca.cliente}! 👋

Lembrete amigável: sua cobrança no valor de ${formatarMoeda(
      cobranca.valor_original
    )} vence amanhã, dia ${formatarData(cobranca.data_vencimento)}.

Evite encargos realizando o pagamento em dia. Se precisar de ajuda, estamos à disposição!

_Sistema de Cobrança Cresci e Perdi_`;
  }

  private gerarTemplatePosVencimento(
    cobranca: any,
    diasAtraso: number
  ): string {
    const valorAtualizado = formatarMoeda(
      cobranca.valor_atualizado || cobranca.valor_original
    );
    const dataVencimento = formatarData(cobranca.data_vencimento);

    let mensagemBase = `Olá, ${cobranca.cliente}.

Notamos que sua cobrança com vencimento em ${dataVencimento} está em aberto há ${diasAtraso} dia(s). O valor atualizado é de *${valorAtualizado}*.`;

    if (diasAtraso >= 7) {
      mensagemBase += `\n\n⚠️ *ATENÇÃO:* Para evitar o bloqueio de sistemas e escalonamento para o setor jurídico, por favor, regularize sua situação.`;
    }

    mensagemBase += `\n\nSe o pagamento já foi efetuado, por favor desconsidere esta mensagem.

_Sistema de Cobrança Cresci e Perdi_`;

    return mensagemBase;
  }
}

// --- Fim do Código Combinado ---

serve(async (req: Request) => {
  // O endpoint 'daily-reminders' agora é protegido e requer um service_role key
  try {
    const lembreteService = new LembreteService(req);
    const resultados = await lembreteService.enviarLembretesDiarios();

    return new Response(
      JSON.stringify({
        message: "Rotina de lembretes executada com sucesso.",
        resultados,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Erro na execução da Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
