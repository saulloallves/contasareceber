import { useState } from "react";
import { 
  Home, Building2, 
  Settings, ChevronLeft, ChevronRight,
  Menu, X, Shield, Receipt, CircleDollarSign, Calculator, Users,
  Bell, MoreHorizontal, LogOut, User, CheckCircle
} from "lucide-react";
import { useAuth } from "../Auth/AuthProvider";
import { useUserProfile } from "../../hooks/useUserProfile";
import { UserSettingsModal } from "./UserSettingsModal";
import { supabase } from "../../lib/supabaseClient";
import { alertasService } from "../../services/alertasService";
import { Alerta } from "../../types/alertas";
import { formatarCNPJCPF } from "../../utils/formatters";
import { useEffect } from "react";
import icon from "../../assets/cabeca.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userPermissions?: string[];
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  user?: {
    name: string;
    email: string;
    role: string;
    id: string;
    avatar_url?: string;
  };
}

export function Sidebar({
  activeTab, onTabChange,
  userPermissions = ["admin"],
  collapsed, setCollapsed,
  user,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  
  const { signOut } = useAuth();
  const { profile } = useUserProfile(user?.id);

  // Carrega alertas
  const fetchAlertas = async () => {
    try {
      const data = await alertasService.getAlertasAtivos();
      setAlertas(data);
    } catch (error) {
      console.error("Falha ao carregar alertas:", error);
    }
  };

  useEffect(() => {
    fetchAlertas();

    // Escuta em tempo real para novos alertas
    const channel = supabase
      .channel("alertas_sistema_sidebar")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alertas_sistema" },
        () => {
          fetchAlertas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    setShowUserMenu(false);
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      alert('Erro ao fazer logout. Tente novamente.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleMarcarComoResolvido = async (alertaId: string) => {
    try {
      await alertasService.marcarComoResolvido(alertaId);
      fetchAlertas();
    } catch (error) {
      console.error("Erro ao resolver alerta:", error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'Admin': 'bg-red-100 text-red-800',
      'Gestor': 'bg-blue-100 text-blue-800',
      'Analista': 'bg-green-100 text-green-800',
      'Observador': 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const normalizeUsDateInText = (text: string) => {
    if (!text) return text;
    return text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_m, mm: string, dd: string, yyyy: string) => {
      const d = dd.padStart(2, "0");
      const m = mm.padStart(2, "0");
      return `${d}/${m}/${yyyy}`;
    });
  };

  const getUrgencyColor = (urgency: "baixa" | "media" | "alta" | "critica") => {
    switch (urgency) {
      case "alta":
        return "bg-red-500";
      case "critica":
        return "bg-red-700";
      case "media":
        return "bg-yellow-500";
      case "baixa":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  const menuItems = [
    { 
      id: "dashboard", 
      label: "Dashboard", 
      icon: Home, 
      permissions: ["admin", "financeiro", "cobranca", "juridico", "leitura"],
      badge: null
    },
    { 
      id: "cobrancas", 
      label: "Kanban Cobranças", 
      icon: CircleDollarSign, 
      permissions: ["admin", "financeiro", "cobranca"],
      badge: null
    },
    { 
      id: "cobrancas-lista", 
      label: "Gestão de Cobranças", 
      icon: Receipt, 
      permissions: ["admin", "financeiro", "cobranca"],
      badge: null
    },
    { 
      id: "simulacao-parcelamento", 
      label: "Simulação Parcelamento", 
      icon: Calculator, 
      permissions: ["admin", "financeiro", "cobranca"],
      badge: null
    },
    { 
      id: "unidades", 
      label: "Unidades", 
      icon: Building2, 
      permissions: ["admin", "financeiro"],
      badge: null
    },
    { 
      id: "franqueados", 
      label: "Franqueados", 
      icon: Users, 
      permissions: ["admin", "financeiro"],
      badge: null
    },
    { 
      id: "admin", 
      label: "Configurações", 
      icon: Settings, 
      permissions: ["admin"],
      badge: null
    },
  ];

  const hasPermission = (itemPermissions: string[]) => {
    return userPermissions.some((permission) =>
      itemPermissions.includes(permission)
    );
  };

  const filteredMenuItems = menuItems.filter((item) =>
    hasPermission(item.permissions)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3">
              <img src={icon} alt="Icone Girafa" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">Cresci e Perdi</h1>
              <p className="text-xs text-gray-500">Sistema Financeiro</p>
            </div>
          </div>
        )}
        
        {/* Toggle button - sempre visível */}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors hidden lg:flex items-center justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          )}
        </button>
        
        {/* Collapsed header */}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src={icon} alt="Icone Girafa" className="w-full h-full object-contain" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Seção Principal */}
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Principal</p>
          </div>
        )}
        
        {filteredMenuItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className={`flex items-center justify-center w-5 h-5 ${collapsed ? "mx-auto" : "mr-3"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="font-medium text-sm truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}

        {/* Seção Gestão */}
        {!collapsed && (
          <div className="px-3 py-2 mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gestão</p>
          </div>
        )}
        
        {filteredMenuItems.slice(4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div className={`flex items-center justify-center w-5 h-5 ${collapsed ? "mx-auto" : "mr-3"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="font-medium text-sm truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
                {isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}

        {/* Seção Notificações */}
        {!collapsed && (
          <div className="px-3 py-2 mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notificações</p>
          </div>
        )}
        
        {/* Botão de Notificações */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              fetchAlertas();
            }}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
              showNotifications
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            }`}
            title={collapsed ? "Notificações" : undefined}
          >
            <div className={`flex items-center justify-center w-5 h-5 ${collapsed ? "mx-auto" : "mr-3"} relative`}>
              <Bell className="w-5 h-5" />
              {alertas.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {alertas.length > 9 ? "9+" : alertas.length}
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="font-medium text-sm truncate">
                  Notificações
                </span>
                {alertas.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                    {alertas.length > 9 ? "9+" : alertas.length}
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Dropdown de Notificações */}
          {showNotifications && !collapsed && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-gray-100">
                <h4 className="font-semibold text-gray-800 text-sm">Notificações</h4>
              </div>
              {alertas.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  Nenhuma notificação nova
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {alertas.map((alerta) => (
                    <div key={alerta.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 ${getUrgencyColor(alerta.nivel_urgencia)}`}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">{alerta.titulo}</p>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{normalizeUsDateInText(alerta.descricao)}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            CNPJ: {alerta.cnpj_unidade ? formatarCNPJCPF(alerta.cnpj_unidade) : "N/A"}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarcarComoResolvido(alerta.id);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                          title="Marcar como resolvido"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Footer com perfil do usuário */}
      <div className="p-4 border-t border-gray-100">
        {!collapsed ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 mr-3"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-semibold">
                      {user ? getInitials(user.name) : "CP"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name || "Sistema"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email || "Cresci e Perdi"}
                  </p>
                </div>
              </div>
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>

            {/* Menu do Usuário */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {user ? getInitials(user.name) : "CP"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {user?.name || "Sistema"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user?.email || "sistema@crescieperdi.com"}
                      </div>
                      {user?.role && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowSettingsModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-3 text-gray-400" />
                    <div className="text-left">
                      <div className="font-medium">Configurações da Conta</div>
                      <div className="text-xs text-gray-500">Editar perfil e preferências</div>
                    </div>
                  </button>

                  <div className="border-t border-gray-100 my-2"></div>

                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    <div className="text-left">
                      <div className="font-medium">{loggingOut ? 'Saindo...' : 'Sair da Conta'}</div>
                      <div className="text-xs text-red-500">
                        {loggingOut ? 'Encerrando sessão...' : 'Encerrar sessão atual'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            {/* Avatar colapsado */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative"
              title={user?.name || "Menu do usuário"}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {user ? getInitials(user.name) : "CP"}
                  </span>
                </div>
              )}
            </button>
            
            {/* Notificações colapsado */}
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                fetchAlertas();
              }}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Notificações"
            >
              <Bell className="w-5 h-5" />
              {alertas.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {alertas.length > 9 ? "9+" : alertas.length}
                </span>
              )}
            </button>

            {/* Menu do usuário colapsado */}
            {showUserMenu && (
              <div className="absolute bottom-full right-full mr-2 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-64">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {user ? getInitials(user.name) : "CP"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {user?.name || "Sistema"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user?.email || "sistema@crescieperdi.com"}
                      </div>
                      {user?.role && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowSettingsModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 mr-3 text-gray-400" />
                    Configurações da Conta
                  </button>

                  <div className="border-t border-gray-100 my-2"></div>

                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {loggingOut ? 'Saindo...' : 'Sair da Conta'}
                  </button>
                </div>
              </div>
            )}

            {/* Notificações colapsado */}
            {showNotifications && (
              <div className="absolute bottom-full right-full mr-2 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-80">
                <div className="p-3 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-800">Notificações</h4>
                </div>
                {alertas.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm">Nenhuma notificação nova</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {alertas.map((alerta) => (
                      <div key={alerta.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                        <div className="flex items-start space-x-3">
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 ${getUrgencyColor(alerta.nivel_urgencia)}`}
                          ></div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-800 font-medium">{alerta.titulo}</p>
                            <p className="text-xs text-gray-600 mt-1">{normalizeUsDateInText(alerta.descricao)}</p>
                            <div className="text-xs text-gray-500 mt-1">
                              CNPJ: {alerta.cnpj_unidade ? formatarCNPJCPF(alerta.cnpj_unidade) : "N/A"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleMarcarComoResolvido(alerta.id)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full"
                            title="Marcar como resolvido"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300 ${
          collapsed ? "lg:w-16" : "lg:w-72"
        }`}
      >
        <SidebarContent />
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-3 bg-white text-gray-700 rounded-xl shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-80 max-w-sm bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3">
                  <img src={icon} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-gray-900">Cresci e Perdi</h1>
                  <p className="text-xs text-gray-500">Sistema Financeiro</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {/* Seção Principal Mobile */}
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Principal</p>
              </div>
              
              {filteredMenuItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center justify-center w-5 h-5 mr-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="font-medium text-sm truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-2"></div>
                    )}
                  </button>
                );
              })}

              {/* Seção Gestão Mobile */}
              <div className="px-3 py-2 mt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gestão</p>
              </div>
              
              {filteredMenuItems.slice(4).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center justify-center w-5 h-5 mr-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span className="font-medium text-sm truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-2"></div>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Footer Mobile */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3">
                    <span className="text-white text-sm font-semibold">CP</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Sistema</p>
                    <p className="text-xs text-gray-500 truncate">Cresci e Perdi</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  title={loggingOut ? 'Saindo...' : 'Sair da conta'}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurações do Usuário */}
      {showSettingsModal && user && (
        <UserSettingsModal
          user={user}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </>
  );
}