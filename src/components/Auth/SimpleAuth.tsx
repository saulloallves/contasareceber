/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { sessaoService } from "../../services/sessaoService";
import logo from "../../assets/logo-principal.png";

interface SimpleAuthProps {
  onAuthSuccess: () => void;
}

export function SimpleAuth({ onAuthSuccess }: SimpleAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Evita múltiplos cliques no botão de login
    if (isProcessingLogin) {
      console.log('⚠️ Login já em processamento, ignorando...');
      return;
    }
    
    setIsProcessingLogin(true);
    setLoading(true);
    setError("");

    try {
      console.log('🔐 Tentando fazer login com:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        setError(error.message);
      } else {
        console.log('✅ Login bem-sucedido:', data.user?.id);
        // Garantir que existe um perfil na tabela usuarios_sistema
        await ensureUserProfile(data.user);
        
        // Cria sessão completa no banco e sessionStorage
        if (data.user?.id) {
          try {
            await sessaoService.criarSessao(data.user.id);
            console.log('✅ Sessão criada no banco e sessionStorage');
          } catch (sessionError) {
            console.warn('⚠️ Erro ao criar sessão, mas login foi bem-sucedido:', sessionError);
            // Não bloqueia o login se a sessão falhar
          }
        }
        
        onAuthSuccess();
      }
    } catch (err) {
      console.error('❌ Erro inesperado no login:', err);
      setError("Erro ao fazer login");
    } finally {
      setLoading(false);
      setIsProcessingLogin(false);
    }
  };

  const ensureUserProfile = async (user: any) => {
    try {
      console.log('🔍 Verificando perfil para usuário:', user?.id, user?.email);
      
      if (!user) {
        console.error('❌ Usuário não fornecido para ensureUserProfile');
        return;
      }

      // Verifica se já existe um perfil
      const { data: existingProfile, error: selectError } = await supabase
        .from('usuarios_sistema')
        .select('id, email, nome_completo')
        .eq('id', user.id)
        .maybeSingle();

      if (selectError) {
        console.error('❌ Erro ao verificar perfil existente:', selectError);
        throw new Error(`Erro ao verificar perfil: ${selectError.message}`);
      }

      if (existingProfile) {
        console.log('✅ Perfil já existe:', existingProfile);
        
        // Atualiza último acesso
        const { error: updateError } = await supabase
          .from('usuarios_sistema')
          .update({ ultimo_acesso: new Date().toISOString() })
          .eq('id', user.id);

        if (updateError) {
          console.warn('⚠️ Erro ao atualizar último acesso:', updateError);
        }
        
        return;
      }

      console.log('📝 Criando novo perfil para:', user.email);

      // Cria um novo perfil se não existir
      const { data: newProfile, error: insertError } = await supabase
        .from('usuarios_sistema')
        .insert({
          id: user.id,
          email: user.email || '',
          nome_completo: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
          telefone: user.user_metadata?.telefone || null,
          cargo: user.user_metadata?.cargo || null,
          nivel_permissao: 'observador',
          ativo: true,
          ultimo_acesso: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar perfil:', insertError);
        throw new Error(`Erro ao criar perfil: ${insertError.message}`);
      }

      console.log('✅ Perfil criado com sucesso:', newProfile);
    } catch (error) {
      console.error('❌ Erro em ensureUserProfile:', error);
      // Não bloqueia o login, apenas registra o erro
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Logo Cresci e Perdi"
            className="w-32 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2 uppercase">
            Sistema de Cobrança
          </h1>
          <p className="text-lg text-gray-600">
            Cresci e Perdi - Acesso Seguro
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div data-auth-form></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu-email@crescieperdi.com.br"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Sua senha"
              required
            />
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-[#ff9923] text-white rounded-lg hover:bg-[#663912] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}