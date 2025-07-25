import React, { useState } from "react";
import { 
  Home, Building2, DollarSign, Calendar, Scale, Bell, BarChart3, 
  Settings, Users, ChevronLeft, ChevronRight, Menu, X, FileText, Target,
  MessageSquare, Zap, Shield, Upload, Download, Eye, Edit, Plus,
  Filter, Search, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userPermissions?: string[];
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  userPermissions = ["admin"],
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Home,
      permissions: ["admin", "financeiro", "cobranca", "juridico", "leitura"],
      description: "Resumo geral e indicadores",
    },
    {
      id: "cobrancas",
      label: "Cobranças",
      icon: DollarSign,
      permissions: ["admin", "financeiro", "cobranca"],
      description: "Kanban visual de cobrança",
    },
    {
      id: "cobrancas-lista",
      label: "Lista de Cobranças",
      icon: DollarSign,
      permissions: ["admin", "financeiro", "cobranca"],
      description: "Gestão em lista de cobranças",
    },
    {
      id: "operacional",
      label: "Painel Operacional",
      icon: DollarSign,
      permissions: ["admin", "financeiro", "cobranca"],
      description: "Operações diárias de cobrança",
    },
    {
      id: "unidades",
      label: "Unidades",
      icon: Building2,
      permissions: ["admin", "financeiro"],
      description: "Cadastro e gestão de unidades",
    },
    {
      id: "reunioes",
      label: "Reuniões",
      icon: Calendar,
      permissions: ["admin", "financeiro", "cobranca"],
      description: "Agenda e negociações",
    },
    {
      id: "documentos",
      label: "Notificações",
      icon: FileText,
      permissions: ["admin", "financeiro", "juridico"],
      description: "Documentos e comunicações",
    },
    {
      id: "juridico",
      label: "Jurídico",
      icon: Scale,
      permissions: ["admin", "juridico"],
      description: "Escalonamentos e ações legais",
    },
    {
      id: "templates-juridicos",
      label: "Templates Jurídicos",
      icon: FileText,
      permissions: ["admin", "juridico"],
      description: "Templates e gatilhos automáticos",
    },
    {
      id: "relatorios",
      label: "Relatórios",
      icon: BarChart3,
      permissions: ["admin", "financeiro", "juridico", "leitura"],
      description: "Análises e indicadores",
    },
    {
      id: "indicadores",
      label: "Indicadores Estratégicos",
      icon: BarChart3,
      permissions: ["admin", "financeiro", "juridico", "leitura"],
      description: "Métricas e KPIs estratégicos",
    },
    {
      id: "usuarios",
      label: "Usuários",
      icon: Users,
      permissions: ["admin"],
      description: "Controle de acesso",
    },
    {
      id: "integracoes",
      label: "Integrações",
      icon: Zap,
      permissions: ["admin"],
      description: "APIs e automações",
    },
    {
      id: "auditoria",
      label: "Auditoria e Logs",
      icon: Shield,
      permissions: ["admin", "juridico"],
      description: "Rastreamento de ações",
    },
    {
      id: "admin",
      label: "Configurações",
      icon: Settings,
      permissions: ["admin"],
      description: "Parâmetros do sistema",
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
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-white">Cresci e Perdi</h1>
              <p className="text-xs text-gray-400">Sistema de Cobrança</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors hidden lg:block"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-300" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => {
                  onTabChange(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center px-3 py-3 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 transform scale-[1.02]"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white hover:transform hover:scale-[1.01]"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <div
                  className={`p-2 rounded-lg ${
                    isActive ? "bg-white/10" : "bg-gray-700/50"
                  } ${collapsed ? "mx-auto" : "mr-3"}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-400 block truncate">
                      {item.description}
                    </span>
                  </div>
                )}
                {!collapsed && isActive && (
                  <div className="w-2 h-2 bg-white rounded-full opacity-75"></div>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-gray-300">
                    {item.description}
                  </div>
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-800"></div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        {!collapsed ? (
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-2">
              <div className="flex items-center justify-center space-x-2 mb-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Sistema Online</span>
              </div>
              <p>© 2025 Cresci e Perdi</p>
              <p>Versão 1.0.0</p>
            </div>
            <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              <span>Seguro</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
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
          collapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        <SidebarContent />
      </div>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-3 bg-gray-900 text-white rounded-xl shadow-lg border border-gray-700 hover:bg-gray-800 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-80 max-w-sm">
            <div className="bg-gray-900 text-white h-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-3">
                    <h1 className="text-lg font-bold text-white">
                      Cresci e Perdi
                    </h1>
                    <p className="text-xs text-gray-400">Sistema de Cobrança</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {filteredMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-3 rounded-xl text-left transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg mr-3 ${
                          isActive ? "bg-white/10" : "bg-gray-700/50"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm block truncate">
                          {item.label}
                        </span>
                        <span className="text-xs text-gray-400 block truncate">
                          {item.description}
                        </span>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 bg-white rounded-full opacity-75"></div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
