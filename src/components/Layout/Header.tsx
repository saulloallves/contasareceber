import { Bell, Maximize } from "lucide-react";
import { useState, useEffect } from "react";
import { Alerta } from "../../types/alertas";
import { alertasService } from "../../services/alertasService";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserAccountDropdown } from "./UserAccountDropdown";

const LOGO_URL =
  "https://raw.githubusercontent.com/saulloallves/contasareceber/refs/heads/main/src/assets/logo-header.png";

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
  const [fullscreen, setFullscreen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchAlertas = async () => {
    try {
      const data = await alertasService.getAlertasAtivos();
      setAlertas(data);
    } catch (error) {
      console.error("Falha ao carregar alertas no header:", error);
    }
  };

  useEffect(() => {
    fetchAlertas();
    const interval = setInterval(fetchAlertas, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-[#222222] mt-4">
            Contas a Receber -
          </h2>
          <img
            src={LOGO_URL}
            alt="Logo Cresci e Perdi"
            className="w-20 h-auto ml-1"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Tela cheia"
          >
            <Maximize className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications((v) => !v)}
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
          <div className="border-l border-gray-200 pl-4 flex flex-col items-end">
            {user ? (
              <UserAccountDropdown user={user} />
            ) : (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
                <span className="text-sm">Carregando...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
