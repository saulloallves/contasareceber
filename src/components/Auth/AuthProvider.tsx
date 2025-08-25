import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { sessaoService } from "../../services/sessaoService";

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

// getSessionFromStorage não é utilizado; mantemos apenas a persistência via saveSessionToStorage

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega usuário autenticado
  const loadUser = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        setUser(session.user);
        saveSessionToStorage(session);
        
        // NÃO cria sessão aqui - apenas no evento SIGNED_IN
        console.log('👤 Usuário já autenticado, não criando nova sessão');
      } else {
        setUser(null);
      }
  } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Inicialização
  useEffect(() => {
    loadUser();
    // Listener de mudanças de sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.id);
        
        saveSessionToStorage(session);
        if (session?.user) {
          setUser(session.user);
          
          // Cria sessão no sistema para novos logins
          if (event === 'SIGNED_IN') {
            console.log('✅ Usuário logado, criando sessão...');
            try {
              await sessaoService.criarSessao(session.user.id);
              console.log('✅ Sessão criada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao criar sessão do usuário:', error);
            }
          }
          
          // Para outros eventos (TOKEN_REFRESHED, etc), não cria nova sessão
          if (event !== 'SIGNED_IN') {
            console.log('ℹ️ Evento', event, '- não criando nova sessão');
          }
        } else {
          setUser(null);
          
          // Encerra sessão no sistema quando usuário faz logout
          if (event === 'SIGNED_OUT') {
            console.log('🚪 Usuário saiu, encerrando sessão...');
            try {
              await sessaoService.encerrarSessao();
              console.log('✅ Sessão encerrada com sucesso');
            } catch (error) {
              console.warn('⚠️ Erro ao encerrar sessão do usuário:', error);
            }
          }
        }
        setLoading(false);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Encerra sessão no sistema antes do logout
    try {
      await sessaoService.encerrarSessao();
    } catch (error) {
      console.warn('Erro ao encerrar sessão:', error);
    }
    
    await supabase.auth.signOut();
    saveSessionToStorage(null);
    setUser(null);
  };

  const refreshUser = () => {
    // Força recarregamento completo para garantir sincronização
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
