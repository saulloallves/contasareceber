/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { LogIn, UserPlus, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { sessaoService } from "../../services/sessaoService";
import logo from "../../assets/logo-principal.png";

interface SimpleAuthProps {
  onAuthSuccess: () => void;
}

interface SignUpData {
  email: string;
  password: string;
  nome_completo: string;
  telefone?: string;
  cargo?: string;
}

export function SimpleAuth({ onAuthSuccess }: SimpleAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);
  const [signUpData, setSignUpData] = useState<SignUpData>({
    email: "",
    password: "",
    nome_completo: "",
    telefone: "",
    cargo: ""
  });

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
        
        // Aguarda um pouco antes de chamar onAuthSuccess para dar tempo do AuthProvider processar
        await new Promise(resolve => setTimeout(resolve, 500));
        
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log('📝 Criando nova conta para:', signUpData.email);
      
      // Primeiro, cria a conta no Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          data: {
            name: signUpData.nome_completo,
            full_name: signUpData.nome_completo
          }
        }
      });

      if (signUpError) {
        console.error('❌ Erro ao criar conta no Auth:', signUpError);
        setError("Erro ao criar conta: " + signUpError.message);
        return;
      }

      if (!authData.user) {
        setError("Erro: usuário não foi criado");
        return;
      }

      console.log('✅ Conta criada no Auth:', authData.user.id);

      // Agora cria o perfil na tabela usuarios_sistema
      const { error: profileError } = await supabase
        .from('usuarios_sistema')
        .insert({
          id: authData.user.id,
          email: signUpData.email,
          nome_completo: signUpData.nome_completo,
          telefone: signUpData.telefone || null,
          cargo: signUpData.cargo || null,
          nivel_permissao: 'observador',
          ativo: true,
          ultimo_acesso: new Date().toISOString()
        });

      if (profileError) {
        console.error('❌ Erro ao criar perfil na tabela usuarios_sistema:', profileError);
        setError("Erro ao criar perfil: " + profileError.message);
        return;
      }

      console.log('✅ Perfil criado na tabela usuarios_sistema');

      // Faz login automático
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: signUpData.email,
        password: signUpData.password,
      });

      if (loginError) {
        console.error('❌ Erro no login automático:', loginError);
        setError("Conta criada, mas erro no login: " + loginError.message);
        return;
      }

      console.log('✅ Login automático bem-sucedido');
      
      // Cria sessão no sistema
      try {
        await sessaoService.criarSessao(authData.user.id);
        console.log('✅ Sessão criada no sistema');
      } catch (sessionError) {
        console.warn('⚠️ Erro ao criar sessão:', sessionError);
      }
      
      setShowSignUpModal(false);
      onAuthSuccess();
    } catch (err) {
      console.error('❌ Erro inesperado no cadastro:', err);
      setError("Erro ao criar conta");
    } finally {
      setLoading(false);
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

  // const openSignUpModal = () => {
  //   setSignUpData({
  //     email: email,
  //     password: "",
  //     nome_completo: "",
  //     telefone: "",
  //     cargo: ""
  //   });
  //   setShowSignUpModal(true);
  //   setError("");
  // };

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

            {/* <div className="text-center">
              <span className="text-sm text-gray-500">Não tem uma conta? </span>
              <button
                type="button"
                onClick={openSignUpModal}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Cadastre-se
              </button>
            </div> */}
          </div>
        </form>
      </div>

      {/* Modal de Cadastro */}
      {showSignUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Criar Conta</h2>
              <button
                onClick={() => setShowSignUpModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({...signUpData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="seu-email@crescieperdi.com.br"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={signUpData.nome_completo}
                  onChange={(e) => setSignUpData({...signUpData, nome_completo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={signUpData.telefone}
                  onChange={(e) => setSignUpData({...signUpData, telefone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  value={signUpData.cargo}
                  onChange={(e) => setSignUpData({...signUpData, cargo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Seu cargo na empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha *
                </label>
                <input
                  type="password"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({...signUpData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowSignUpModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <UserPlus className="w-5 h-5 mr-2" />
                  )}
                  {loading ? "Criando..." : "Criar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}