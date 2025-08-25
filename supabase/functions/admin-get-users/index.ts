import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  filtros?: {
    nivel?: string;
    ativo?: boolean;
    busca?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido');
    }

    // Criar cliente Supabase com service_role para bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar se usuário é admin_master
    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('usuarios_sistema')
      .select('nivel_permissao')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.nivel_permissao !== 'admin_master') {
      throw new Error('Acesso negado: apenas admin_master pode buscar todos os usuários');
    }

    // Buscar dados do request
    const { filtros = {} }: RequestBody = await req.json();

    // Buscar usuários com service_role (bypass RLS)
    let query = supabaseAdmin
      .from('usuarios_sistema')
      .select('*')
      .order('nome_completo');

    if (filtros.nivel) {
      query = query.eq('nivel_permissao', filtros.nivel);
    }

    if (filtros.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo);
    }

    if (filtros.busca) {
      query = query.or(`nome_completo.ilike.%${filtros.busca}%,email.ilike.%${filtros.busca}%,cargo.ilike.%${filtros.busca}%`);
    }

    const { data: usuarios, error: usuariosError } = await query;

    if (usuariosError) {
      throw new Error(`Erro ao buscar usuários: ${usuariosError.message}`);
    }

    console.log(`✅ Edge Function: ${usuarios?.length || 0} usuários encontrados`);

    return new Response(
      JSON.stringify({
        success: true,
        users: usuarios || [],
        count: usuarios?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Erro na Edge Function admin-get-users:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        users: []
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});