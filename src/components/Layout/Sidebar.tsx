import { useState } from "react";
import { 
  Home, Building2, 
  Settings, ChevronLeft, ChevronRight,
  Menu, X, Shield, Receipt, CircleDollarSign, Calculator, Users,
  Bell, Search, MoreHorizontal
} from "lucide-react";
import icon from "../../assets/cabeca.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userPermissions?: string[];
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({
  activeTab, onTabChange,
  userPermissions = ["admin"],
  collapsed, setCollapsed,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
      </nav>

      {/* Footer com perfil do usuário */}
      <div className="p-4 border-t border-gray-100">
        {!collapsed ? (
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
            <button className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">CP</span>
            </div>
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
                <button className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}