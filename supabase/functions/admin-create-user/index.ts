/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

type Body = {
  email: string;
  password?: string;
  nome_completo: string;
  telefone?: string;
  cargo: string;
  nivel_permissao:
    | "admin_master"
    | "gestor_juridico"
    | "cobranca"
    | "analista_financeiro"
    | "franqueado"
    | "observador"
    | "gestor_regional"
    | "suporte";
  ativo?: boolean;
  area_atuacao?: "global" | "regional" | "unidade_especifica";
  codigo_unidade_vinculada?: string;
};

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
}

serve(async (req) => {
  const headers = corsHeaders("*");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase env vars ausentes" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    // Client para validar o usuário solicitante (com o token do caller)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    // Verifica se o solicitante é admin_master
    const { data: perfilSolicitante, error: perfilError } = await supabase
      .from("usuarios_sistema")
      .select("nivel_permissao")
      .eq("id", user.id)
      .maybeSingle();

    if (perfilError || !perfilSolicitante || perfilSolicitante.nivel_permissao !== "admin_master") {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;

    // Validações básicas
    if (!body.email || !body.nome_completo || !body.cargo || !body.nivel_permissao) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    // Admin client para ações privilegiadas
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Se já existe auth user?
    // Não há busca direta por email no admin API sem listar, então tentamos create e tratamos conflito.
    let authUserId: string | null = null;
    let createdViaInvite = false;

    if (body.password && body.password.length >= 8) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          name: body.nome_completo,
          full_name: body.nome_completo,
          cargo: body.cargo,
        },
      });
      if (createErr) {
        // Se já existir, podemos seguir para apenas vincular na tabela local
        if (String(createErr.message || "").toLowerCase().includes("already registered")) {
          // Busca o usuário via magic: criar um token reset (não tem lookup limpo). Como fallback, impede duplicidade.
          return new Response(
            JSON.stringify({ error: "Usuário já existe no auth" }),
            { status: 409, headers: { ...headers, "Content-Type": "application/json" } },
          );
        }
        throw createErr;
      }
      authUserId = created.user?.id || null;
    } else {
      // Sem senha: envia convite para o email
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(body.email, {
        data: {
          name: body.nome_completo,
          full_name: body.nome_completo,
          cargo: body.cargo,
        },
      });
      if (inviteErr) {
        if (String(inviteErr.message || "").toLowerCase().includes("already registered")) {
          return new Response(
            JSON.stringify({ error: "Usuário já existe no auth" }),
            { status: 409, headers: { ...headers, "Content-Type": "application/json" } },
          );
        }
        throw inviteErr;
      }
      authUserId = invited.user?.id || null;
      createdViaInvite = true;
    }

    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar usuário de autenticação" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    // Inserir/atualizar na tabela usuarios_sistema com o mesmo ID do auth
    const usuarioSistema = {
      id: authUserId,
      nome_completo: body.nome_completo,
      email: body.email,
      telefone: body.telefone ?? null,
      cargo: body.cargo,
      nivel_permissao: body.nivel_permissao,
      ativo: body.ativo ?? true,
      area_atuacao: body.area_atuacao ?? "global",
      codigo_unidade_vinculada: body.codigo_unidade_vinculada ?? null,
      tentativas_login: 0,
      verificacao_ip_ativa: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as const;

    const { error: upsertErr } = await supabaseAdmin
      .from("usuarios_sistema")
      .upsert(usuarioSistema, { onConflict: "id" });

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: `Erro ao salvar perfil: ${upsertErr.message}` }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: authUserId, invited: createdViaInvite }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders("*"), "Content-Type": "application/json" },
    });
  }
});
