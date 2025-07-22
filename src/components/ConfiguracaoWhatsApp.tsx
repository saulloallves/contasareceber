import React, { useState, useEffect } from 'react';
import { MessageCircle, Settings, Save, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { WhatsAppService } from '../services/whatsappService';

export function ConfiguracaoWhatsApp() {
  const [config, setConfig] = useState({
    token: '',
    phone_number_id: '',
    link_negociacao: ''
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [mensagem, setMensagem] = useState<{tipo: 'sucesso' | 'erro', texto: string} | null>(null);

  useEffect(() => {
    // Carrega configurações salvas
    const configSalva = localStorage.getItem('whatsapp_config');
    if (configSalva) {
      setConfig(JSON.parse(configSalva));
    }
  }, []);

  const salvarConfiguracao = () => {
    setSalvando(true);
    try {
      localStorage.setItem('whatsapp_config', JSON.stringify(config));
      setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar configurações.' });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagem(null), 3000);
    }
  };

  const testarConexao = async () => {
    if (!config.token || !config.phone_number_id) {
      setMensagem({ tipo: 'erro', texto: 'Preencha token e phone number ID primeiro.' });
      return;
    }

    setTestando(true);
    try {
      // Teste básico da API do WhatsApp
      const response = await fetch(`https://graph.facebook.com/v18.0/${config.phone_number_id}`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
        }
      });

      if (response.ok) {
        setMensagem({ tipo: 'sucesso', texto: 'Conexão com WhatsApp API estabelecida com sucesso!' });
      } else {
        setMensagem({ tipo: 'erro', texto: 'Erro na conexão. Verifique suas credenciais.' });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao testar conexão com WhatsApp API.' });
    } finally {
      setTestando(false);
      setTimeout(() => setMensagem(null), 5000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center mb-6">
          <MessageCircle className="w-8 h-8 text-green-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">
            Configuração WhatsApp Business API
          </h1>
        </div>

        {/* Mensagem de feedback */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            mensagem.tipo === 'sucesso' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {mensagem.texto}
          </div>
        )}

        <div className="space-y-6">
          {/* Token de Acesso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token de Acesso do WhatsApp Business API
            </label>
            <input
              type="password"
              value={config.token}
              onChange={(e) => setConfig({...config, token: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Insira seu token de acesso"
            />
            <p className="text-sm text-gray-500 mt-1">
              Obtido no Facebook Developers Console
            </p>
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number ID
            </label>
            <input
              type="text"
              value={config.phone_number_id}
              onChange={(e) => setConfig({...config, phone_number_id: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="ID do número de telefone"
            />
            <p className="text-sm text-gray-500 mt-1">
              ID do número de telefone configurado no WhatsApp Business
            </p>
          </div>

          {/* Link de Negociação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link de Negociação
            </label>
            <input
              type="url"
              value={config.link_negociacao}
              onChange={(e) => setConfig({...config, link_negociacao: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="https://calendly.com/sua-empresa/negociacao"
            />
            <p className="text-sm text-gray-500 mt-1">
              Link que será enviado nas mensagens de cobrança para negociação
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex space-x-4">
            <button
              onClick={salvarConfiguracao}
              disabled={salvando}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </button>

            <button
              onClick={testarConexao}
              disabled={testando || !config.token || !config.phone_number_id}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TestTube className="w-4 h-4 mr-2" />
              {testando ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Como Configurar
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. Criar App no Facebook Developers:</strong>
              <p>Acesse developers.facebook.com e crie um novo app Business</p>
            </div>
            <div>
              <strong>2. Adicionar WhatsApp Business API:</strong>
              <p>No painel do app, adicione o produto "WhatsApp Business API"</p>
            </div>
            <div>
              <strong>3. Configurar Número:</strong>
              <p>Configure um número de telefone e obtenha o Phone Number ID</p>
            </div>
            <div>
              <strong>4. Gerar Token:</strong>
              <p>Gere um token de acesso permanente para usar na API</p>
            </div>
            <div>
              <strong>5. Webhook (Opcional):</strong>
              <p>Configure webhook para receber confirmações de entrega</p>
            </div>
          </div>
        </div>

        {/* Preview da Mensagem */}
        <div className="mt-8 bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Preview da Mensagem de Cobrança
          </h3>
          <div className="bg-white rounded-lg p-4 border border-green-200">
            <div className="text-sm text-gray-600 mb-2">Exemplo de mensagem enviada:</div>
            <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm">
              Olá, João da Silva!<br/><br/>
              Consta um débito da sua unidade, vencido em 15/01/2024.<br/>
              Valor atualizado até hoje: <strong>R$ 1.250,00</strong><br/><br/>
              Deseja regularizar? {config.link_negociacao || 'https://calendly.com/sua-empresa/negociacao'}<br/><br/>
              <em>Esta é uma mensagem automática do sistema de cobrança.</em>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}