import React, { useState } from 'react';
import { LogIn, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface SimpleAuthProps {
  onAuthSuccess: () => void;
}

export function SimpleAuth({ onAuthSuccess }: SimpleAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setError(error.message);
      } else {
        onAuthSuccess();
      }
    } catch (err) {
      setError('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Tenta fazer login com usuário demo
      const { error } = await supabase.auth.signInWithPassword({
        email: 'demo@crescieperdi.com',
        password: 'demo123456'
      });

      if (error) {
        // Se não conseguir, cria o usuário demo
        const { error: signUpError } = await supabase.auth.signUp({
          email: 'demo@crescieperdi.com',
          password: 'demo123456'
        });

        if (signUpError) {
          setError('Erro ao criar usuário demo');
          return;
        }

        // Tenta fazer login novamente
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: 'demo@crescieperdi.com',
          password: 'demo123456'
        });

        if (loginError) {
          setError('Erro ao fazer login com usuário demo');
          return;
        }
      }

      onAuthSuccess();
    } catch (err) {
      setError('Erro ao acessar modo demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Sistema de Cobrança
          </h1>
          <p className="text-gray-600">
            Cresci e Perdi - Acesso Seguro
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Sua senha"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <LogIn className="w-5 h-5 mr-2" />
            )}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Shield className="w-5 h-5 mr-2" />
            Acesso Demo (Para Demonstração)
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Use o acesso demo para visualizar o sistema
          </p>
        </div>
      </div>
    </div>
  );
}