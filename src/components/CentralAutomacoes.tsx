import React, { useState } from 'react';
import { Cog, Clock, MessageSquare } from 'lucide-react';
import TesteNotificacoesAutomaticas from './TesteNotificacoesAutomaticas';
import GerenciadorTemplates from './GerenciadorTemplates';

const CentralAutomacoes: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<'cobranca-periodica' | 'templates-mensagens'>('cobranca-periodica');

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-[#ff9923] to-[#ffc31a] rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Cog className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Central de Automações
              </h1>
              <p className="text-gray-600">
                Gerencie todas as automações e configurações do sistema
              </p>
            </div>
          </div>
        </div>

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setAbaAtiva('cobranca-periodica')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                abaAtiva === 'cobranca-periodica'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Clock className="w-4 h-4 mr-2" />
              Cobrança Automática Periódica
            </button>
            <button
              onClick={() => setAbaAtiva('templates-mensagens')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                abaAtiva === 'templates-mensagens'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Templates de Mensagens
            </button>
          </nav>
        </div>

        {/* Conteúdo das abas */}
        {abaAtiva === 'cobranca-periodica' && (
          <div>
            <TesteNotificacoesAutomaticas />
          </div>
        )}

        {abaAtiva === 'templates-mensagens' && (
          <div>
            <GerenciadorTemplates />
          </div>
        )}
      </div>
    </div>
  );
};

export default CentralAutomacoes;
