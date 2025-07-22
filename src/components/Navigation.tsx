import React, { useState } from 'react';
import { FileSpreadsheet, MessageCircle, Settings, History, Menu, X, BarChart3, Building2, Calendar, AlertTriangle, FileText, TrendingUp, Edit, DollarSign, Calculator, Clock, Target, Shield, Scale } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Geral', icon: BarChart3 },
    { id: 'operacional', label: 'Painel Operacional', icon: FileSpreadsheet },
    { id: 'importacao', label: 'Importação', icon: FileSpreadsheet },
    { id: 'unidades', label: 'Unidades', icon: Building2 },
    { id: 'reunioes', label: 'Reuniões', icon: Calendar },
    { id: 'escalonamentos', label: 'Alertas & Escalonamentos', icon: AlertTriangle },
    { id: 'acordos', label: 'Acordos de Parcelamento', icon: Calculator },
    { id: 'score-risco', label: 'Score de Risco', icon: Target },
    { id: 'bloqueios', label: 'Bloqueios de Acesso', icon: Shield },
    { id: 'juridico', label: 'Painel Jurídico', icon: Scale },
    { id: 'relatorios', label: 'Relatórios Mensais', icon: TrendingUp },
    { id: 'linha-tempo', label: 'Linha do Tempo', icon: Clock },
    { id: 'tratativas', label: 'Tratativas', icon: History },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'operacao-manual', label: 'Operação Manual', icon: Edit },
    { id: 'franqueado', label: 'Painel Franqueado', icon: Building2 },
    { id: 'admin', label: 'Configurações', icon: Settings },
    { id: 'configuracao', label: 'WhatsApp Config', icon: Settings },
    { id: 'historico', label: 'Histórico Envios', icon: History },
  ];

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <MessageCircle className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-xl font-bold text-gray-800">Sistema de Cobrança</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}