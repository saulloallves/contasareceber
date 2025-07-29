import React, { useState } from "react";
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
import { ConfiguracaoWhatsApp } from "./components/ConfiguracaoWhatsApp";
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

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [cnpjSelecionado, setCnpjSelecionado] = useState("");

  // Simula dados do usuário logado
  const userPermissions = ["admin"]; // Exemplo de permissões

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
      case "simulacao-parcelamento":
        return <SimulacaoParcelamento />;
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
    >
      {/* O Layout agora renderiza o Header e o Sidebar, 
          e aqui passamos apenas o conteúdo da página como "children" */}
      {renderContent()}
    </Layout>
  );
}

export default App;
