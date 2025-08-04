/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./components/Auth/AuthProvider";
import { SimpleAuth } from "./components/Auth/SimpleAuth";
import { Header } from "./components/Layout/Header";
import { Sidebar } from "./components/Layout/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { DashboardGeral } from "./components/Dashboard/DashboardGeral";
import { GestaoCobrancas } from "./components/Cobrancas/GestaoCobrancas";
import { ImportacaoPlanilha } from "./components/ImportacaoPlanilha";
import { CadastroUnidades } from "./components/CadastroUnidades";
import { GestaoReunioes } from "./components/GestaoReunioes";
import { GestaoEscalonamentos } from "./components/GestaoEscalonamentos";
import { GestaoAcordos } from "./components/GestaoAcordos";
import { ScoreRisco } from "./components/ScoreRisco";
import { GestaoBloqueios } from "./components/GestaoBloqueios";
import { PainelJuridico } from "./components/PainelJuridico";
import { HistoricoEnvios } from "./components/HistoricoEnvios";
import { ConfiguracaoAdmin } from "./components/ConfiguracaoAdmin";
import { HistoricoTratativas } from "./components/HistoricoTratativas";
import { PainelOperacional } from "./components/PainelOperacional";
import { GeradorDocumentos } from "./components/GeradorDocumentos";
import { RelatoriosMensais } from "./components/RelatoriosMensais";
import { PainelFranqueado } from "./components/PainelFranqueado";
import { OperacaoManual } from "./components/OperacaoManual";
import { LinhaTempoUnidade } from "./components/LinhaTempoUnidade";
import { PainelPriorizacao } from "./components/PainelPriorizacao";
import { PainelCentralUnidade } from "./components/PainelCentralUnidade";
import { PainelIndicadoresEstrategicos } from "./components/PainelIndicadoresEstrategicos";
import { ModuloIntegracoes } from "./components/ModuloIntegracoes";
import { GestaoUsuarios } from "./components/Usuarios/GestaoUsuarios";
import { AuditoriaLogs } from "./components/AuditoriaLogs";
import { TemplatesJuridicos } from "./components/TemplatesJuridicos";
import { KanbanCobranca } from "./components/KanbanCobranca";
import { Layout } from "./components/Layout/Layout";
import { SimulacaoParcelamento } from "./components/SimulacaoParcelamento";

function AppContent() {
  const { user, loading, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [cnpjSelecionado, setCnpjSelecionado] = useState("");

  // Simula dados do usuário logado
  const userPermissions = ["admin"]; // Exemplo de permissões

  // Mapeia o usuário do Supabase para o formato esperado pelo Header/Layout
  const mappedUser = user && profile
    ? {
        name: profile.nome_completo || user.user_metadata?.name || user.email || "Usuário",
        email: profile.email || user.email || '',
        role: profile.nivel_permissao || "Admin",
        id: user.id,
        avatar_url: profile.avatar_url || user.user_metadata?.avatar_url
      }
    : undefined;

  // Debug logs
  useEffect(() => {
    console.log('🔍 App State:', { 
      hasUser: !!user, 
      hasProfile: !!profile, 
      loading, 
      userEmail: user?.email,
      profileName: profile?.nome_completo 
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
      {renderContent()}
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