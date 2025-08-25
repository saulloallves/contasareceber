import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "crescieperdi.supabase.session";

function saveSessionToStorage(session: Session | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionProcessed, setSessionProcessed] = useState(false);

  // Inicialização - carrega sessão uma única vez
  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (session?.user) {
          console.log('✅ Sessão encontrada para:', session.user.email);
          setUser(session.user);
          saveSessionToStorage(session);
        } else {
          console.log('❌ Nenhuma sessão encontrada');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar auth:', error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setSessionProcessed(true);
        }
      }
    };

    initializeAuth();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Listener de mudanças de sessão - apenas após inicialização
  useEffect(() => {
    if (!sessionProcessed) return;
    
    console.log('🎧 Configurando listener de auth state...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email);
        
        saveSessionToStorage(session);
        
        if (session?.user) {
          setUser(session.user);
          
          // Cria sessão no sistema APENAS para novos logins
          if (event === 'SIGNED_IN') {
            console.log('✅ Novo login detectado, criando sessão...');
            try {
              // Importação dinâmica para evitar dependência circular
              const { sessaoService } = await import('../../services/sessaoService');
              await sessaoService.criarSessao(session.user.id);
              console.log('✅ Sessão criada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao criar sessão do usuário:', error);
            }
          }
        } else {
          setUser(null);
          
          // Encerra sessão no sistema quando usuário faz logout
          if (event === 'SIGNED_OUT') {
            console.log('🚪 Usuário saiu, encerrando sessão...');
            try {
              const { sessaoService } = await import('../../services/sessaoService');
              await sessaoService.encerrarSessao();
              console.log('✅ Sessão encerrada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao encerrar sessão do usuário:', error);
            }
          }
        }
      }
    );
    
    return () => {
      console.log('🧹 Removendo listener de auth state');
      subscription.unsubscribe();
    };
  }, [sessionProcessed]);

  const signOut = async () => {
    console.log('🚪 Iniciando logout...');
    try {
      const { sessaoService } = await import('./sessaoService');
      await sessaoService.encerrarSessao();
    } catch (error) {
      console.warn('Erro ao encerrar sessão:', error);
    }
    
    await supabase.auth.signOut();
    saveSessionToStorage(null);
    setUser(null);
  };

  const refreshUser = () => {
    console.log('🔄 Forçando refresh do usuário...');
    window.location.reload();
  };

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
