// Supabase Edge Function: acionar-juridico-cobranca
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// Ajuste o caminho para o arquivo local
import { cobrancaService } from "./cobrancaService.ts";

serve(async (req) => {
  // Configuração CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: "Método não permitido" }),
      {
        status: 405,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        },
      }
    );
  }

  try {
    const { cobrancaId } = await req.json();
    if (!cobrancaId) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          mensagem: "ID da cobrança não informado.",
        }),
        {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          },
        }
      );
    }

    // Executa o fluxo jurídico para a cobrança
    const resultado = await cobrancaService.acionarJuridicoPorCobranca(
      cobrancaId
    );
    return new Response(JSON.stringify(resultado), {
      status: resultado.sucesso ? 200 : 400,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      },
    });
  } catch (error) {
    console.error("Erro interno:", error);
    return new Response(
      JSON.stringify({ sucesso: false, mensagem: "Erro interno." }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        },
      }
    );
  }
});
