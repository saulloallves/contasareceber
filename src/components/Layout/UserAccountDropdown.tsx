import React, { useState, useRef, useEffect } from 'react';
import { 
  User, Settings, LogOut, ChevronDown, Edit, 
  Mail, Phone, Camera, Check, X, Loader2 
} from 'lucide-react';
import { UserSettingsModal } from './UserSettingsModal';
import { useAuth } from '../Auth/AuthProvider';

interface UserAccountDropdownProps {
  user: {
    name: string;
    email: string;
    role: string;
    id: string;
    avatar_url?: string;
  };
}

export function UserAccountDropdown({ user }: UserAccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fecha dropdown ao pressionar ESC
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    setIsOpen(false);
    try {
      await signOut();
      // Força redirecionamento após logout bem-sucedido
      window.location.href = '/';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      alert('Erro ao fazer logout. Tente novamente.');
    } finally {
      setLoggingOut(false);
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

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={loggingOut}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {/* Avatar */}
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                {getInitials(user.name)}
              </div>
            )}
            {/* Status indicator */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-white rounded-full ${
              loggingOut ? 'bg-red-400' : 'bg-green-400'
            }`}></div>
          </div>

          {/* User Info - Hidden on mobile */}
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-gray-900 truncate max-w-32">
              {user.name}
            </div>
            <div className="text-xs text-gray-500 truncate max-w-32">
              {user.email}
            </div>
          </div>

          {/* Chevron */}
          <ChevronDown 
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in slide-in-from-top-2 duration-200">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {user.name}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {user.email}
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  setIsOpen(false);
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
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
                className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors duration-150"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-3" />
                )}
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <UserSettingsModal
          user={user}
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </>
  );
}