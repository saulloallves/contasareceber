/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect } from "react";
import { Bell, LogOut, Settings, Maximize, Moon, Sun } from "lucide-react";
import { useAuth } from "../Auth/AuthProvider";
import { Alerta } from "../../types/alertas";
import { alertasService } from "../../services/alertasService";
import { NotificationsDropdown } from "./NotificationsDropdown";
import logo from "../../assets/logo-header.png";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    role: string;
    id: string; // Adicionado para uso no alerta
  };
}

export function Header({ user }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { signOut } = useAuth();

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

  const handleLogout = async () => {
    await signOut();
    window.location.reload();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-2 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-5">
          <h2 className="text-xl font-bold text-[#222222] uppercase">
            Contas a Receber
          </h2>
          <img
            src={logo}
            alt="Logo Cresci e Perdi"
            className="w-12 mx-auto mb-3"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Alternar tema"
          >
            {darkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

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

          {/* User Menu */}
          <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || "Usuário"}
              </p>
              <p className="text-xs text-gray-500">{user?.role || "Admin"}</p>
            </div>
            <div className="flex items-center space-x-1">
              <button
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Configurações"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
