import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { connectionService } from "../../services/connectionService";
import { sessaoService } from "../../services/sessaoService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🎧 Configurando listener de auth state...');
    
    // Inicia monitoramento de conexão
    connectionService.startMonitoring();
    
    // Flag para evitar múltiplas execuções simultâneas
    let isInitializing = false;
    
    // Busca sessão inicial e define loading como false
    const initializeAuth = async () => {
      if (isInitializing) {
        return;
      }
      
      isInitializing = true;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao buscar sessão:', error);
        }
        
        setUser(session?.user ?? null);
        
        // Se há sessão ativa mas não há sessão no sistema, cria uma
        if (session?.user) {
          try {
            await sessaoService.criarSessao(session.user.id);
          } catch (error) {
            console.warn('⚠️ Erro ao criar sessão inicial:', error);
          }
        }
      } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        setUser(null);
      } finally {
        // SEMPRE define loading como false, independente do resultado
        setLoading(false);
        isInitializing = false;
      }
    };
    
    initializeAuth();

    // Listener para mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email || 'Nenhum usuário');
        
        // Evita processamento duplicado de eventos
        if (isInitializing) {
          return;
        }
        
        setUser(session?.user ?? null);
        
        // Cria sessão apenas no login bem-sucedido
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ Login detectado, criando sessão...');
          try {
            await sessaoService.criarSessao(session.user.id);
            console.log('✅ Sessão criada com sucesso');
          } catch (error) {
            console.error('❌ Erro ao criar sessão no login:', error);
          }
        
        // Encerra sessão no logout
        if (event === 'SIGNED_OUT') {
          try {
            await sessaoService.encerrarSessao();
          } catch (error) {
          }
    );
    
    return () => {
            console.error('❌ Erro ao criar sessão no login:', error);
      subscription.unsubscribe();
      connectionService.stopMonitoring();
    };
  }, []);

  const signOut = async () => {
    console.log('🚪 Iniciando logout...');
    try {
      // Para monitoramento de conexão
      connectionService.stopMonitoring();
      
      await sessaoService.encerrarSessao();
    } catch (error) {
      console.warn('Erro ao encerrar sessão:', error);
    }
    
    await supabase.auth.signOut();
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