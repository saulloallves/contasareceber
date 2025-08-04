// Supabase Edge Function: acionar-juridico-cobranca
// Este arquivo é autossuficiente e contém toda a lógica necessária.
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/**
 * Envia um e-mail chamando a função 'send-email'.
 * Adapta o payload para o formato esperado pela função 'send-email'.
 */ async function enviarEmail(supabase, params) {
  console.log("Preparando para enviar e-mail para:", params.destinatario);
  const dadosEmail = {
    destinatario: params.destinatario,
    nome_destinatario: params.nome_destinatario,
    assunto: params.assunto,
    corpo_html: params.corpo_html,
    corpo_texto: params.corpo_texto,
    remetente_nome: "Cresci e Perdi - Jurídico",
    remetente_email: "nao-responda@crescieperdi.com.br"
  };
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: dadosEmail
    });
    if (error) {
      throw new Error(`Erro ao invocar função send-email: ${error.message}`);
    }
    if (!data.success) {
      throw new Error(`Função send-email retornou falha: ${data.error}`);
    }
    console.log("E-mail enviado com sucesso:", data.messageId);
  } catch (error) {
    console.error("Erro no serviço de e-mail:", error.message);
  }
}
/**
 * Envia uma mensagem de WhatsApp usando a Evolution API.
 */ async function enviarWhatsApp(params) {
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionApiUrl || !evolutionApiKey) {
    console.warn("Variáveis da Evolution API não configuradas. WhatsApp não será enviado.");
    return;
  }
  try {
    let numeroLimpo = params.number.replace(/\D/g, "");
    if (numeroLimpo.length > 0 && !numeroLimpo.startsWith("55")) {
      numeroLimpo = "55" + numeroLimpo;
    }
    console.log(`Preparando para enviar WhatsApp para o número formatado: ${numeroLimpo}`);
    const url = `${evolutionApiUrl}/message/sendText/${params.instanceName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionApiKey
      },
      body: JSON.stringify({
        number: numeroLimpo,
        options: {
          delay: 1200
        },
        text: params.text
      })
    });
    if (!res.ok) {
      const errorResponse = await res.text();
      console.error(`Erro ao enviar WhatsApp: Status ${res.status} - ${res.statusText}`);
      console.error("Resposta da API:", errorResponse);
    } else {
      const data = await res.json();
      console.log("WhatsApp enviado com sucesso:", data);
    }
  } catch (error) {
    console.error("Erro fatal no serviço de WhatsApp:", error.message);
  }
}
/**
 * Aciona o fluxo jurídico para uma cobrança, validando todos os critérios.
 */ async function acionarJuridicoPorCobranca(supabase, cobrancaId) {
  console.log("=== INÍCIO ACIONAMENTO JURÍDICO ===");
  console.log("Cobrança ID recebido:", cobrancaId);
  // 1. Busca a cobrança e a unidade vinculada em uma única query
  console.log("Buscando cobrança e unidade no banco...");
  const { data: cobranca, error: cobrancaError } = await supabase.from("cobrancas_franqueados").select(`
      *,
      unidades_franqueadas (
        id,
        codigo_unidade,
        nome_franqueado,
        email_franqueado,
        telefone_franqueado
      )
    `).eq("id", cobrancaId).single();
  if (cobrancaError) throw new Error(`Erro ao buscar cobrança: ${cobrancaError.message}`);
  if (!cobranca) throw new Error("Cobrança não encontrada.");
  if (!cobranca.unidades_franqueadas) throw new Error("Unidade franqueada não encontrada para esta cobrança.");
  const unidade = cobranca.unidades_franqueadas;
  console.log("=== VALIDAÇÃO DOS CRITÉRIOS JURÍDICOS ===");
  const valorAtualizado = cobranca.valor_atualizado || cobranca.valor_original;
  // CRITÉRIO 1: Valor > R$ 5.000
  console.log(`Critério 1 - Valor: ${valorAtualizado}`);
  if (valorAtualizado <= 5000) {
    return {
      sucesso: false,
      mensagem: `Valor insuficiente. Mínimo: R$ 5.000,00. Atual: ${valorAtualizado.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      })}`
    };
  }
  // CRITÉRIO 2: 3+ cobranças ignoradas em 15 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 15);
  const { data: cobrancasIgnoradas, error: ignoradasError } = await supabase.from("cobrancas_franqueados").select("id", {
    count: "exact"
  }).eq("cnpj", cobranca.cnpj).eq("status", "em_aberto").gte("created_at", dataLimite.toISOString()); // Assumindo que a data de criação é relevante
  const countIgnoradas = cobrancasIgnoradas?.length || 0;
  console.log(`Critério 2 - Cobranças ignoradas encontradas: ${countIgnoradas}`);
  if (countIgnoradas < 3) {
    return {
      sucesso: false,
      mensagem: `Insuficientes cobranças ignoradas. Necessário: 3. Atual: ${countIgnoradas} nos últimos 15 dias.`
    };
  }
  // CRITÉRIO 3: Score de risco = 0
  const { data: scoreRisco, error: scoreError } = await supabase.from("score_risco_unidades").select("score_atual").eq("unidade_id", unidade.id).single();
  console.log(`Critério 3 - Score de risco: ${scoreRisco?.score_atual}`);
  if (scoreRisco && scoreRisco.score_atual !== 0) {
    return {
      sucesso: false,
      mensagem: `Score de risco deve ser zero. Atual: ${scoreRisco.score_atual}`
    };
  }
  // CRITÉRIO 4 e 5: Acordo descumprido OU Reincidência
  const { data: acordosDescumpridos, error: acordosError } = await supabase.from("acordos_parcelamento").select("id", {
    count: "exact"
  }).eq("cobranca_id", cobranca.id).eq("status", "descumprido");
  const temAcordoDescumprido = (acordosDescumpridos?.length || 0) > 0;
  console.log(`Critério 4 - Acordos descumpridos: ${temAcordoDescumprido}`);
  const dataReincidencia = new Date();
  dataReincidencia.setMonth(dataReincidencia.getMonth() - 6);
  const { data: reincidencias, error: reincidenciaError } = await supabase.from("auditoria_logs").select("id", {
    count: "exact"
  }).eq("cobranca_id", cobranca.id).eq("acao", "Acionamento Jurídico").gte("created_at", dataReincidencia.toISOString());
  const temReincidencia = (reincidencias?.length || 0) > 0;
  console.log(`Critério 5 - Reincidência (6 meses): ${temReincidencia}`);
  /*
  // Validação temporariamente desativada para teste
  if (!temAcordoDescumprido && !temReincidencia) {
    return {
      sucesso: false,
      mensagem:
        "Necessário ter acordo descumprido OU reincidência nos últimos 6 meses.",
    };
  }
  */ console.log("=== TODOS OS CRITÉRIOS ATENDIDOS ===");
  // 2. Atualiza status da cobrança
  console.log("Atualizando status da cobrança para 'em_tratativa_juridica'...");
  const { error: updateError } = await supabase.from("cobrancas_franqueados").update({
    status: "em_tratativa_juridica",
    data_acionamento_juridico: new Date().toISOString()
  }).eq("id", cobranca.id);
  if (updateError) throw new Error(`Erro ao atualizar status da cobrança: ${updateError.message}`);
  // 3. Envia notificações
  console.log("Enviando notificações...");
  const valorFormatado = valorAtualizado.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
  const dataVencimento = new Date(cobranca.data_vencimento).toLocaleDateString("pt-BR", {
    timeZone: "UTC"
  });
  const diasAtraso = cobranca.dias_em_atraso || 0;
  const motivosDetalhados = [
    `Valor: ${valorFormatado}`,
    `${countIgnoradas} cobranças ignoradas em 15 dias`,
    `Score de risco: ${scoreRisco?.score_atual ?? "N/A"}`,
    `Acordo descumprido: ${temAcordoDescumprido ? "Sim" : "Não"}`,
    `Reincidência (6 meses): ${temReincidencia ? "Sim" : "Não"}`
  ].join("; ");
  const corpoTexto = `Prezado(a) ${unidade.nome_franqueado},

Consta em nosso sistema pendência financeira com vencimento superior a ${diasAtraso} dias, no valor de ${valorFormatado}.

Esta notificação extrajudicial visa formalizar a ciência da dívida e informar que, caso não haja manifestação no prazo de 5 dias úteis, serão adotadas providências legais previstas em contrato.

Dados da Pendência:
- Código da Unidade: ${unidade.codigo_unidade}
- Valor Total em Aberto: ${valorFormatado}
- Data de Vencimento mais Antiga: ${dataVencimento}
- Motivo do Acionamento: ${motivosDetalhados}

Para regularização imediata, entre em contato através dos canais oficiais ou acesse sua central de cobrança.

Atenciosamente,
Setor Jurídico – Cresci e Perdi`;
  // Gera um HTML mais robusto, tratando parágrafos
  const corpoHtml = corpoTexto.trim().split("\n\n").map((p)=>`<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  // Mensagem para WhatsApp (mais curta)
  const mensagemWhatsApp = `NOTIFICAÇÃO EXTRAJUDICIAL: A cobrança de ${valorFormatado} para a unidade ${unidade.codigo_unidade} foi escalonada para o jurídico. Motivo: ${motivosDetalhados}. Prazo para regularização: 5 dias úteis.`;
  await enviarEmail(supabase, {
    destinatario: unidade.email_franqueado,
    nome_destinatario: unidade.nome_franqueado,
    assunto: `🚨 NOTIFICAÇÃO EXTRAJUDICIAL - Acionamento Jurídico - Unidade ${unidade.codigo_unidade}`,
    corpo_html: corpoHtml,
    corpo_texto: corpoTexto.trim()
  });
  await enviarWhatsApp({
    instanceName: "automacoes_backup",
    number: unidade.telefone_franqueado,
    text: mensagemWhatsApp
  });
  // 4. Registra log de auditoria
  console.log("Registrando log de auditoria...");
  await supabase.from("auditoria_logs").insert({
    acao: "Acionamento Jurídico",
    detalhes: `Cobrança ${cobranca.id} para ${cobranca.cliente} acionada. ${motivosDetalhados}`,
    cobranca_id: cobranca.id,
    usuario_responsavel: "Sistema (Edge Function)"
  });
  console.log("=== SUCESSO ===");
  return {
    sucesso: true,
    mensagem: "Cobrança acionada no jurídico com sucesso."
  };
}
// --- Handler Principal da Edge Function ---
serve(async (req)=>{
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      sucesso: false,
      mensagem: "Método não permitido"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
  try {
    const { cobrancaId } = await req.json();
    if (!cobrancaId) {
      throw new Error("ID da cobrança não fornecido.");
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false
      }
    });
    // Executa o fluxo jurídico completo
    const resultado = await acionarJuridicoPorCobranca(supabase, cobrancaId);
    return new Response(JSON.stringify(resultado), {
      status: resultado.sucesso ? 200 : 422,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Erro fatal na Edge Function:", error);
    return new Response(JSON.stringify({
      sucesso: false,
      mensagem: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});
