import { useState, useEffect, Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./components/Auth/AuthProvider";
import { SimpleAuth } from "./components/Auth/SimpleAuth";
const DashboardGeral = lazy(() => import("./components/Dashboard/DashboardGeral").then(m => ({ default: m.DashboardGeral })));
const GestaoCobrancas = lazy(() => import("./components/Cobrancas/GestaoCobrancas").then(m => ({ default: m.GestaoCobrancas })));
const CadastroUnidades = lazy(() => import("./components/CadastroUnidades").then(m => ({ default: m.CadastroUnidades })));
const GestaoReunioes = lazy(() => import("./components/GestaoReunioes").then(m => ({ default: m.GestaoReunioes })));
const GestaoAcordos = lazy(() => import("./components/GestaoAcordos").then(m => ({ default: m.GestaoAcordos })));
const GestaoBloqueios = lazy(() => import("./components/GestaoBloqueios").then(m => ({ default: m.GestaoBloqueios })));
const PainelJuridico = lazy(() => import("./components/PainelJuridico").then(m => ({ default: m.PainelJuridico })));
const ConfiguracaoAdmin = lazy(() => import("./components/ConfiguracaoAdmin").then(m => ({ default: m.ConfiguracaoAdmin })));
const GeradorDocumentos = lazy(() => import("./components/GeradorDocumentos").then(m => ({ default: m.GeradorDocumentos })));
const RelatoriosMensais = lazy(() => import("./components/RelatoriosMensais").then(m => ({ default: m.RelatoriosMensais })));
const GestaoUsuarios = lazy(() => import("./components/Usuarios/GestaoUsuarios").then(m => ({ default: m.GestaoUsuarios })));
const AuditoriaLogs = lazy(() => import("./components/AuditoriaLogs").then(m => ({ default: m.AuditoriaLogs })));
const TemplatesJuridicos = lazy(() => import("./components/TemplatesJuridicos").then(m => ({ default: m.TemplatesJuridicos })));
const KanbanCobranca = lazy(() => import("./components/KanbanCobranca").then(m => ({ default: m.KanbanCobranca })));
const SimulacaoParcelamento = lazy(() => import("./components/SimulacaoParcelamento").then(m => ({ default: m.SimulacaoParcelamento })));
const Franqueados = lazy(() => import("./components/Franqueados").then(m => ({ default: m.Franqueados })));
const PainelIndicadoresEstrategicos = lazy(() => import("./components/PainelIndicadoresEstrategicos").then(m => ({ default: m.PainelIndicadoresEstrategicos })));
import { Layout } from "./components/Layout/Layout";
import { useUserProfile } from "./hooks/useUserProfile";
import { connectionService } from "./services/connectionService";

function AppContent() {
  const { user, loading } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);

  // Monitora status de conexão
  useEffect(() => {
    const removeListener = connectionService.addStatusListener((status) => {
      if (!status.isConnected) {
        console.warn('⚠️ Conexão perdida detectada no App');
      }
    });
    
    return removeListener;
  }, []);

  // Simula dados do usuário logado
  // Mapeia o nível de permissão do usuário para as permissões do sistema
  const getUserPermissions = (nivelPermissao: string): string[] => {
    const permissionsMap: Record<string, string[]> = {
      'admin_master': ['admin', 'financeiro', 'cobranca', 'juridico', 'leitura'],
      'gestor_juridico': ['juridico', 'leitura'],
      'cobranca': ['financeiro', 'cobranca', 'leitura'],
      'analista_financeiro': ['financeiro', 'leitura'],
      'franqueado': ['leitura'],
      'observador': ['leitura']
    };
    
    return permissionsMap[nivelPermissao] || ['leitura'];
  };

  const userPermissions = profile?.nivel_permissao 
    ? getUserPermissions(profile.nivel_permissao)
    : ['leitura']; // Fallback para apenas leitura se não conseguir determinar o nível

  // Mapeia o usuário do Supabase para o formato esperado pelo Header/Layout
  const mappedUser = user
    ? {
        name:
          profile?.nome_completo ||
          user.user_metadata?.nome_exibicao ||
          user.user_metadata?.name ||
          user.email ||
          "Usuário",
        email: profile?.email || user.email || "",
        role:
          profile?.nivel_permissao ||
          user.user_metadata?.nivel_permissao ||
          "Admin",
        id: user.id,
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
      }
    : undefined;

  // Debug logs
  useEffect(() => {
    console.log("🔍 App State:", {
      hasUser: !!user,
      hasProfile: !!profile,
      loading,
      isInitialized,
      userEmail: user?.email,
      profileName: profile?.nome_completo,
    });
  }, [user, profile, loading, isInitialized]);

  // Controla inicialização para evitar loops
  useEffect(() => {
    if (!loading && user) {
      // Verifica se perfil está carregado ou se já passou tempo suficiente
      if (profile || Date.now() - (user.created_at ? new Date(user.created_at).getTime() : 0) > 5000) {
        setIsInitialized(true);
      } else {
        // Aguarda um pouco para garantir que o perfil seja carregado
        const timer = setTimeout(() => {
          setIsInitialized(true);
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    } else if (!loading && !user) {
      setIsInitialized(true);
    }
  }, [loading, user, profile]);

  // Força inicialização após 10 segundos para evitar loops infinitos
  useEffect(() => {
    const forceInitTimer = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⚠️ Forçando inicialização após timeout');
        setIsInitialized(true);
      }
    }, 10000);
      
    return () => clearTimeout(forceInitTimer);
  }, [isInitialized]);

  // Se ainda está carregando ou não foi inicializado, mostra loading
  if (loading || !isInitialized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {loading ? 'Carregando sistema...' : 'Inicializando aplicação...'}
          </p>
          {user && (
            <p className="text-xs text-gray-400 mt-2">
              Carregando perfil de {user.email}...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Se não está logado, mostra tela de login
  if (!user) {
    return <SimpleAuth onAuthSuccess={() => window.location.reload()} />;
  }

  const renderContent = () => {
  switch (activeTab) {
      case "dashboard":
        return <DashboardGeral onNavigate={setActiveTab} />;
      case "cobrancas":
        return <KanbanCobranca />;
      case "cobrancas-lista":
        return <GestaoCobrancas />;
      case "usuarios":
        return <GestaoUsuarios />;
      case "simulacao-parcelamento":
        return <SimulacaoParcelamento />;
      case "unidades":
        return <CadastroUnidades />;
      case "franqueados":
        return <Franqueados />;
      case "reunioes":
        return <GestaoReunioes />;
      case "acordos":
        return <GestaoAcordos />;
      case "bloqueios":
        return <GestaoBloqueios />;
      case "juridico":
        return <PainelJuridico />;
      case "relatorios":
        return <RelatoriosMensais />;
      case "indicadores":
        return <PainelIndicadoresEstrategicos />;
      case "documentos":
        return <GeradorDocumentos />;
      case "admin":
        return <ConfiguracaoAdmin />;
      case "auditoria":
        return <AuditoriaLogs />;
      case "templates-juridicos":
        return <TemplatesJuridicos />;
      default:
        return <DashboardGeral />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userPermissions={userPermissions}
      user={mappedUser}
    >
      <Suspense
        fallback={
          <div className="w-full h-[50vh] flex items-center justify-center text-gray-600">
            Carregando conteúdo...
          </div>
        }
      >
        {renderContent()}
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
