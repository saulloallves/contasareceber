import React, { useState } from "react";
import { LogIn, Shield } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import logo from "../../assets/logo-header.png";

interface SimpleAuthProps {
  onAuthSuccess: () => void;
}

export function SimpleAuth({ onAuthSuccess }: SimpleAuthProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        onAuthSuccess();
      }
    } catch {
      setError("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // Faz login com usuário demo fixo
      const { error } = await supabase.auth.signInWithPassword({
        email: "admin@crescieperdi.com",
        password: "admin123456",
      });

      if (error) {
        setError("Erro ao fazer login demo: " + error.message);
        return;
      }

      onAuthSuccess();
    } catch {
      setError("Erro ao acessar modo demo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="Logo Cresci e Perdi"
            className="w-32 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2 uppercase">
            Sistema de Cobrança
          </h1>
          <p className="text-lg text-gray-600">
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
              placeholder="seu-email@crescieperdi.com.br"
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

          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-[#ffc31b] text-white rounded-lg hover:bg-[#663912] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button
              type="button"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-[#2eaee6] text-white rounded-lg hover:bg-[#1e7499] disabled:opacity-50 transition-all duration-300"
            >
              Cadastrar-se
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all duration-300"
            >
              <Shield className="w-5 h-5 mr-2" />
              {loading ? "Carregando..." : "Acessar Modo Demo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
