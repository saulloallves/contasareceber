import React, { useState } from 'react';
import { Sidebar } from './Sidebar'; // Ajuste o caminho se necessário
import { Header } from './Header';   // Importe o Header aqui

// Simula os dados do usuário para o Header
const usuario = {
  name: 'João Silva',
  email: 'joao@crescieperdi.com',
  role: 'Administrador'
};

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userPermissions: string[];
}

export function Layout({ children, activeTab, onTabChange, userPermissions }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeTab={activeTab}
        onTabChange={onTabChange}
        userPermissions={userPermissions}
      />
      
      {/* O conteúdo principal agora tem a margem dinâmica controlada aqui */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        <Header user={usuario} notifications={3} />
        
        <main className="flex-1 p-4 lg:p-6">
            {children}
        </main>
      </div>
    </div>
  );
}