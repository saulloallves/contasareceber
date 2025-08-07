// supabase/functions/notificacao-n8n/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Este import agora vai funcionar, pois a CLI cria o arquivo cors.ts
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Lida com a requisição preflight de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Lógica de segurança: verifica o cabeçalho Authorization
    const authHeader = req.headers.get('Authorization');
    const secret = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Compara o token enviado com o segredo guardado no Supabase
    if (secret !== Deno.env.get('N8N_CALLBACK_SECRET')) {
      return new Response('Unauthorized: Invalid token', { status: 401, headers: corsHeaders });
    }

    const body = await req.json()

    // Cria um cliente supabase com permissões de administrador
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Insere o novo alerta no seu sistema de notificações
    const { error } = await supabaseAdmin.from('alertas_sistema').insert({
      tipo_alerta: 'importacao_concluida',
      descricao: body.mensagem || 'Processamento de planilha concluído.',
      nivel_urgencia: body.sucesso ? 'baixa' : 'alta',
      status: 'novo',
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ message: "Alerta criado com sucesso!" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})