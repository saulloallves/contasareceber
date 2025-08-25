import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Alerta } from "../../types/alertas";
import { alertasService } from "../../services/alertasService";
import { supabase } from "../../lib/supabaseClient";
import logoheader from "../../assets/logo cresci-header.png";
import { connectionService } from "../../services/connectionService";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    role: string;
    id: string;
    user_metadata?: {
      nome_exibicao?: string;
      nivel_permissao?: string;
    };
  };
}

export function Header({ user }: HeaderProps) {
  // Estado para controlar o modal de conclusão da importação
  const [resultadoImportacao, setResultadoImportacao] = useState<Alerta | null>(
    null
  );
  const [showNotifications, setShowNotifications] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const fetchAlertas = async () => {
    try {
      // Usa connectionService para buscar alertas com retry automático
      const { data: alertasData, error } = await connectionService.query(() => 
        supabase
          .from("alertas_sistema")
          .select("*")
          .eq("resolvido", false)
          .order("data_criacao", { ascending: false })
      );
      
      if (error) {
        console.error("Erro ao buscar alertas:", error);
        return;
      }
      
      setAlertas(alertasData);
    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
    }
  };

  useEffect(() => {
    // Cria a "escuta" em tempo real na tabela de alertas
    let channel: any = null;
    
    // Monitora status de conexão
    const removeConnectionListener = connectionService.addStatusListener((status) => {
      if (status.isConnected && !channel) {
        // Reconecta realtime quando conexão é restaurada
        channel = supabase
          .channel("alertas_sistema_realtime")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "alertas_sistema" },
            (payload) => {
              console.log("Novo alerta recebido do Supabase!", payload.new);

              // Quando um novo alerta chega, buscamos a lista inteira novamente
              // para manter o sino de notificações atualizado.
              fetchAlertas();

              // Verifica se é a notificação que estamos esperando
              const novoAlerta = payload.new as Alerta;
              if (novoAlerta.tipo_alerta === "importacao_concluida") {
                // Guarda os dados do alerta para mostrar o modal de sucesso!
                setResultadoImportacao(novoAlerta);

                // Dispara um evento global para que outras partes da aplicação saibam que precisam se atualizar.
                // Dispara evento global para atualização
                window.dispatchEvent(new CustomEvent("cobrancasAtualizadas"));
              }
            }
          )
          .subscribe();
      } else if (!status.isConnected && channel) {
        // Remove canal quando perde conexão
        supabase.removeChannel(channel);
        channel = null;
      }
    });
    
    // Busca alertas iniciais
    fetchAlertas();

    // Função de limpeza para remover a "escuta" quando o usuário sai da página
    return () => {
      removeConnectionListener();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []); // O array vazio garante que isso rode apenas uma vez

  // Função para fechar o modal de resultado da importação
  // e marcar o alerta como resolvido
  const handleFecharModalResultado = async () => {
    if (!resultadoImportacao || !user) return;
    try {
      // Marcar o alerta como resolvido para não aparecer de novo
      await alertasService.marcarComoResolvido(resultadoImportacao.id);
      // Limpa o estado para fechar o modal
      setResultadoImportacao(null);
    } catch (error) {
      console.error("Erro ao resolver alerta do modal:", error);
      // Mesmo com erro, fecha o modal para o usuário não ficar preso
      setResultadoImportacao(null);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <img
            src={logoheader}
            alt="Logo Cresci e Perdi Header"
            className="w-[180px] h-auto"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Notifications */}
          <button
            onClick={async () => {
              // Abre/fecha o dropdown e força atualização para refletir novos inserts
              setShowNotifications((v) => !v);
              await fetchAlertas();
            }}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {alertas.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                {alertas.length > 9 ? "9+" : alertas.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <NotificationsDropdown
              alertas={alertas}
              onClose={() => setShowNotifications(false)}
              onUpdate={fetchAlertas}
            />
          )}

          {/* User Account Dropdown */}
          <div className="pl-4 flex flex-col items-end border-l border-gray-200">
            <div className="text-sm text-gray-600">
              Sistema de Cobrança
            </div>
          </div>
          {/* Modal que será exibido quando a importação terminar */}
          {resultadoImportacao && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-semibold text-green-600">
                  Importação Concluída!
                </h3>
                <p className="mt-2 text-gray-700">
                  {resultadoImportacao.descricao}
                </p>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleFecharModalResultado}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
