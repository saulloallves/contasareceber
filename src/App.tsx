import { useState, useEffect, Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./components/Auth/AuthProvider";
import { SimpleAuth } from "./components/Auth/SimpleAuth";
// Header e Sidebar são usados dentro de Layout
// Lazy screens for code-splitting
const DashboardGeral = lazy(() => import("./components/Dashboard/DashboardGeral").then(m => ({ default: m.DashboardGeral })));
const GestaoCobrancas = lazy(() => import("./components/Cobrancas/GestaoCobrancas").then(m => ({ default: m.GestaoCobrancas })));
const ImportacaoPlanilha = lazy(() => import("./components/ImportacaoPlanilha").then(m => ({ default: m.ImportacaoPlanilha })));
const CadastroUnidades = lazy(() => import("./components/CadastroUnidades").then(m => ({ default: m.CadastroUnidades })));
const GestaoReunioes = lazy(() => import("./components/GestaoReunioes").then(m => ({ default: m.GestaoReunioes })));
const GestaoAcordos = lazy(() => import("./components/GestaoAcordos").then(m => ({ default: m.GestaoAcordos })));
const ScoreRisco = lazy(() => import("./components/ScoreRisco").then(m => ({ default: m.ScoreRisco })));
const GestaoBloqueios = lazy(() => import("./components/GestaoBloqueios").then(m => ({ default: m.GestaoBloqueios })));
const PainelJuridico = lazy(() => import("./components/PainelJuridico").then(m => ({ default: m.PainelJuridico })));
const ConfiguracaoAdmin = lazy(() => import("./components/ConfiguracaoAdmin").then(m => ({ default: m.ConfiguracaoAdmin })));
const PainelOperacional = lazy(() => import("./components/PainelOperacional").then(m => ({ default: m.PainelOperacional })));
const GeradorDocumentos = lazy(() => import("./components/GeradorDocumentos").then(m => ({ default: m.GeradorDocumentos })));
const RelatoriosMensais = lazy(() => import("./components/RelatoriosMensais").then(m => ({ default: m.RelatoriosMensais })));
const PainelFranqueado = lazy(() => import("./components/PainelFranqueado").then(m => ({ default: m.PainelFranqueado })));
const ModuloIntegracoes = lazy(() => import("./components/ModuloIntegracoes").then(m => ({ default: m.ModuloIntegracoes })));
const GestaoUsuarios = lazy(() => import("./components/Usuarios/GestaoUsuarios").then(m => ({ default: m.GestaoUsuarios })));
const AuditoriaLogs = lazy(() => import("./components/AuditoriaLogs").then(m => ({ default: m.AuditoriaLogs })));
const TemplatesJuridicos = lazy(() => import("./components/TemplatesJuridicos").then(m => ({ default: m.TemplatesJuridicos })));
const KanbanCobranca = lazy(() => import("./components/KanbanCobranca").then(m => ({ default: m.KanbanCobranca })));
const SimulacaoParcelamento = lazy(() => import("./components/SimulacaoParcelamento").then(m => ({ default: m.SimulacaoParcelamento })));
const Franqueados = lazy(() => import("./components/Franqueados").then(m => ({ default: m.Franqueados })));
const LinhaTempoUnidade = lazy(() => import("./components/LinhaTempoUnidade").then(m => ({ default: m.LinhaTempoUnidade })));
const PainelIndicadoresEstrategicos = lazy(() => import("./components/PainelIndicadoresEstrategicos").then(m => ({ default: m.PainelIndicadoresEstrategicos })));
// The following are currently not wired in the UI; keep them non-imported to avoid bundle bloat
// const HistoricoEnvios = lazy(() => import("./components/HistoricoEnvios").then(m => ({ default: m.HistoricoEnvios })));
// const HistoricoTratativas = lazy(() => import("./components/HistoricoTratativas").then(m => ({ default: m.HistoricoTratativas })));
// const GestaoEscalonamentos = lazy(() => import("./components/GestaoEscalonamentos").then(m => ({ default: m.GestaoEscalonamentos })));
import { Layout } from "./components/Layout/Layout";
import { useUserProfile } from "./hooks/useUserProfile";

function AppContent() {
  const { user, loading } = useAuth();
  const { profile } = useUserProfile(user?.id);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [cnpjSelecionado, setCnpjSelecionado] = useState("");

  // Simula dados do usuário logado
  const userPermissions = ["admin"]; // Exemplo de permissões

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
      userEmail: user?.email,
      profileName: profile?.nome_completo,
    });
  }, [user, profile, loading]);

  // Se ainda está carregando, mostra loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando sistema...</p>
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
    return <DashboardGeral />;
      case "cobrancas":
        return <KanbanCobranca />;
      case "cobrancas-lista":
        return <GestaoCobrancas />;
      case "usuarios":
        return <GestaoUsuarios />;
      case "operacional":
        return <PainelOperacional />;
      case "simulacao-parcelamento":
        return <SimulacaoParcelamento />;
      case "importacao":
        return <ImportacaoPlanilha />;
      case "unidades":
        return <CadastroUnidades />;
      case "franqueados":
        return <Franqueados />;
      case "reunioes":
        return <GestaoReunioes />;
      case "acordos":
        return <GestaoAcordos />;
      case "score-risco":
        return <ScoreRisco />;
      case "bloqueios":
        return <GestaoBloqueios />;
      case "juridico":
        return <PainelJuridico />;
      case "relatorios":
        return <RelatoriosMensais />;
      case "indicadores":
        return <PainelIndicadoresEstrategicos />;
      case "franqueado":
        return <PainelFranqueado />;
      case "documentos":
        return <GeradorDocumentos />;
      case "integracoes":
        return <ModuloIntegracoes />;
      case "admin":
        return <ConfiguracaoAdmin />;
      case "auditoria":
        return <AuditoriaLogs />;
      case "templates-juridicos":
        return <TemplatesJuridicos />;
      case "linha-tempo":
        return cnpjSelecionado ? (
          <LinhaTempoUnidade cnpj={cnpjSelecionado} />
        ) : (
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Linha do Tempo da Unidade
              </h2>
              <p className="text-gray-600 mb-6">
                Digite o CNPJ da unidade para visualizar o histórico completo
              </p>
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  value={cnpjSelecionado}
                  onChange={(e) => setCnpjSelecionado(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
                />
                <button
                  onClick={() => {
                    if (cnpjSelecionado.trim()) {
                      // Força re-render
                      setActiveTab("linha-tempo");
                    }
                  }}
                  disabled={!cnpjSelecionado.trim()}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Visualizar Linha do Tempo
                </button>
              </div>
            </div>
          </div>
        );
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
