import React, { useState, useEffect } from 'react';
import { Mail, Settings, Save, TestTube, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { EmailService, ConfiguracaoEmail } from '../services/emailService';

export function ConfiguracaoEmail() {
  const [config, setConfig] = useState<ConfiguracaoEmail>({
    id: 'default',
    servidor_smtp: 'smtp.gmail.com',
    porta: 587,
    usuario: '',
    senha: '',
    nome_remetente: 'Cresci e Perdi - Financeiro',
    email_padrao: '',
    email_retorno: '',
    ssl_ativo: true,
    ativo: false
  });
  
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [emailTeste, setEmailTeste] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mensagem, setMensagem] = useState<{tipo: 'sucesso' | 'erro' | 'info', texto: string} | null>(null);

  const emailService = new EmailService();

  useEffect(() => {
    carregarConfiguracao();
  }, []);

  const carregarConfiguracao = async () => {
    try {
      const configData = await emailService.buscarConfiguracao();
      setConfig(configData);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const salvarConfiguracao = async () => {
    setSalvando(true);
    try {
      await emailService.salvarConfiguracao(config);
      setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: `Erro ao salvar: ${error}` });
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagem(null), 5000);
    }
  };

  const testarConfiguracao = async () => {
    if (!emailTeste) {
      setMensagem({ tipo: 'erro', texto: 'Digite um email para teste' });
      return;
    }

    setTestando(true);
    try {
      const resultado = await emailService.testarConfiguracao(emailTeste);
      
      if (resultado.sucesso) {
        setMensagem({ tipo: 'sucesso', texto: 'Email de teste enviado com sucesso! Verifique sua caixa de entrada.' });
      } else {
        setMensagem({ tipo: 'erro', texto: `Erro no teste: ${resultado.erro}` });
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: `Erro ao testar: ${error}` });
    } finally {
      setTestando(false);
      setTimeout(() => setMensagem(null), 8000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center mb-6">
          <Mail className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">
            Configuração de Email
          </h1>
        </div>

        {/* Mensagem de feedback */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            mensagem.tipo === 'sucesso' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : mensagem.tipo === 'erro'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
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
          {/* Status do Serviço */}
          <div className={`p-4 rounded-lg border ${config.ativo ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-semibold ${config.ativo ? 'text-green-800' : 'text-red-800'}`}>
                  Status do Serviço de Email
                </h3>
                <p className={`text-sm ${config.ativo ? 'text-green-600' : 'text-red-600'}`}>
                  {config.ativo ? 'Ativo e funcionando' : 'Inativo - Configure para ativar'}
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={config.ativo}
                  onChange={(e) => setConfig({...config, ativo: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="ml-2 text-sm font-medium text-gray-700">
                  Serviço ativo
                </label>
              </div>
            </div>
          </div>

          {/* Configurações SMTP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Servidor SMTP
              </label>
              <input
                type="text"
                value={config.servidor_smtp}
                onChange={(e) => setConfig({...config, servidor_smtp: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="smtp.gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Porta
              </label>
              <input
                type="number"
                value={config.porta}
                onChange={(e) => setConfig({...config, porta: parseInt(e.target.value) || 587})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="587"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuário (Email)
              </label>
              <input
                type="email"
                value={config.usuario}
                onChange={(e) => setConfig({...config, usuario: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="seu-email@gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha (App Password)
              </label>
              <div className="relative">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={config.senha}
                  onChange={(e) => setConfig({...config, senha: e.target.value})}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Senha de app do Gmail"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Remetente
              </label>
              <input
                type="text"
                value={config.nome_remetente}
                onChange={(e) => setConfig({...config, nome_remetente: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Cresci e Perdi - Financeiro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Padrão (From)
              </label>
              <input
                type="email"
                value={config.email_padrao}
                onChange={(e) => setConfig({...config, email_padrao: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="financeiro@crescieperdi.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email de Retorno (Reply-To)
              </label>
              <input
                type="email"
                value={config.email_retorno}
                onChange={(e) => setConfig({...config, email_retorno: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="financeiro@crescieperdi.com"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="ssl_ativo"
                checked={config.ssl_ativo}
                onChange={(e) => setConfig({...config, ssl_ativo: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="ssl_ativo" className="ml-2 text-sm font-medium text-gray-700">
                Usar SSL/TLS
              </label>
            </div>
          </div>

          {/* Teste de Configuração */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Testar Configuração</h3>
            <div className="flex space-x-4">
              <input
                type="email"
                value={emailTeste}
                onChange={(e) => setEmailTeste(e.target.value)}
                placeholder="Digite um email para teste"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={testarConfiguracao}
                disabled={testando || !emailTeste}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <TestTube className="w-4 h-4 mr-2" />
                {testando ? 'Testando...' : 'Enviar Teste'}
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex space-x-4">
            <button
              onClick={salvarConfiguracao}
              disabled={salvando}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Como Configurar Gmail
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <strong>1. Ativar 2FA no Gmail:</strong>
              <p>Acesse sua conta Google e ative a verificação em duas etapas</p>
            </div>
            <div>
              <strong>2. Gerar Senha de App:</strong>
              <p>Vá em Configurações → Segurança → Senhas de app → Gerar nova senha</p>
            </div>
            <div>
              <strong>3. Configurar no Sistema:</strong>
              <p>Use a senha de app gerada (não sua senha normal do Gmail)</p>
            </div>
            <div>
              <strong>4. Configurações Recomendadas:</strong>
              <ul className="list-disc list-inside ml-4 mt-2">
                <li>Servidor: smtp.gmail.com</li>
                <li>Porta: 587</li>
                <li>SSL/TLS: Ativado</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}