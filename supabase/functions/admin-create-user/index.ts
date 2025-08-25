import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar se é uma requisição POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Obter dados do corpo da requisição
    const body = await req.json()
    console.log('Dados recebidos:', body)

    const {
      email,
      password,
      nome_completo,
      telefone,
      cargo,
      nivel_permissao,
      ativo = true,
      codigo_unidade_vinculada
    } = body

    // Validações básicas
    if (!email || !nome_completo || !cargo || !nivel_permissao) {
      return new Response(
        JSON.stringify({ 
          error: 'Campos obrigatórios: email, nome_completo, cargo, nivel_permissao' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar se usuário já existe na tabela usuarios_sistema
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('usuarios_sistema')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (checkError) {
      console.error('Erro ao verificar usuário existente:', checkError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar usuário existente' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Um usuário com este e-mail já está registrado no sistema.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let userId: string
    let userCreated = false

    // Tentar criar usuário no Auth
    if (password) {
      console.log('Criando usuário no Auth com senha...')
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome_completo,
          cargo
        }
      })

      if (authError) {
        console.error('Erro ao criar usuário no Auth:', authError)
        
        // Se o erro for de usuário já existente no Auth, tenta buscar o ID
        if (authError.message?.includes('already been registered')) {
          console.log('Usuário já existe no Auth, buscando ID...')
          
          const { data: existingAuthUser, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()
          
          if (getUserError) {
            return new Response(
              JSON.stringify({ error: 'Usuário já existe no Auth mas não foi possível obter ID' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }

          const foundUser = existingAuthUser.users.find(u => u.email === email)
          if (!foundUser) {
            return new Response(
              JSON.stringify({ error: 'Usuário existe no Auth mas não foi encontrado' }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }

          userId = foundUser.id
          console.log('ID do usuário existente no Auth:', userId)
        } else {
          return new Response(
            JSON.stringify({ error: authError.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      } else {
        userId = authData.user.id
        userCreated = true
        console.log('Usuário criado no Auth com ID:', userId)
      }
    } else {
      // Se não tem senha, gera um UUID para usar como ID
      userId = crypto.randomUUID()
      console.log('Usando UUID gerado:', userId)
    }

    // Criar registro na tabela usuarios_sistema
    console.log('Inserindo na tabela usuarios_sistema...')
    const { data: userData, error: insertError } = await supabaseAdmin
      .from('usuarios_sistema')
      .insert({
        id: userId,
        nome_completo,
        email,
        telefone: telefone || null,
        cargo,
        nivel_permissao,
        ativo,
        codigo_unidade_vinculada: codigo_unidade_vinculada || null,
        ultimo_acesso: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao inserir na tabela usuarios_sistema:', insertError)
      
      // Se criou no Auth mas falhou na tabela, tenta deletar do Auth
      if (userCreated) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId)
          console.log('Usuário removido do Auth devido ao erro na tabela')
        } catch (deleteError) {
          console.error('Erro ao limpar usuário do Auth:', deleteError)
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Erro ao criar perfil do usuário: ${insertError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Usuário criado com sucesso:', userData)

    return new Response(
      JSON.stringify({ 
        success: true,
        id: userId,
        invited: userCreated,
        user: userData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro geral na Edge Function:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})