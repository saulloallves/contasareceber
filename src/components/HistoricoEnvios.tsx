import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Calendar, Phone, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { WhatsAppService } from '../services/whatsappService';
import { EnvioMensagem } from '../types/cobranca';

export function HistoricoEnvios() {
  const [envios, setEnvios] = useState<EnvioMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    status: '',
    cliente: ''
  });

  // Instância do serviço (em produção, usar configuração real)
  const whatsappService = useMemo(() => new WhatsAppService({
    token: localStorage.getItem('whatsapp_token') || '',
    phone_number_id: localStorage.getItem('whatsapp_phone_id') || ''
  }), []);

  const carregarHistorico = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await whatsappService.buscarHistoricoEnvios(filtros);
      setEnvios(dados || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setCarregando(false);
    }
  }, [filtros, whatsappService]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  

  const aplicarFiltros = () => {
    carregarHistorico();
  };

  const limparFiltros = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      status: '',
      cliente: ''
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sucesso':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'falha':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'reagendado':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <MessageSquare className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sucesso':
        return 'Enviado';
      case 'falha':
        return 'Falha';
      case 'reagendado':
        return 'Reagendado';
      default:
        return status;
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarTelefone = (telefone: string) => {
    const apenasNumeros = telefone.replace(/\D/g, '');
    if (apenasNumeros.length === 13) {
      return apenasNumeros.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3');
    }
    return telefone;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center mb-6">
          <MessageSquare className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">
            Histórico de Envios WhatsApp
          </h1>
        </div>

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({...filtros, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="sucesso">Enviado</option>
                <option value="falha">Falha</option>
                <option value="reagendado">Reagendado</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <input
                type="text"
                value={filtros.cliente}
                onChange={(e) => setFiltros({...filtros, cliente: e.target.value})}
                placeholder="Nome do cliente"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={aplicarFiltros}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={limparFiltros}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Lista de Envios */}
        {carregando ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando histórico...</p>
          </div>
        ) : envios.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum envio encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {envios.map((envio) => (
              <div key={envio.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    {getStatusIcon(envio.status_envio)}
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-gray-800">{envio.cliente}</h3>
                      <p className="text-sm text-gray-600">CNPJ: {envio.cnpj}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      envio.status_envio === 'sucesso' 
                        ? 'bg-green-100 text-green-800'
                        : envio.status_envio === 'falha'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {getStatusText(envio.status_envio)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    {formatarTelefone(envio.telefone)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatarData(envio.data_envio!)}
                  </div>
                </div>

                {envio.erro_detalhes && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-800">
                      <strong>Erro:</strong> {envio.erro_detalhes}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 font-medium mb-2">Mensagem Enviada:</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{envio.mensagem_enviada}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        {envios.length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Estatísticas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {envios.filter(e => e.status_envio === 'sucesso').length}
                </div>
                <div className="text-sm text-gray-600">Enviados com Sucesso</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {envios.filter(e => e.status_envio === 'falha').length}
                </div>
                <div className="text-sm text-gray-600">Falhas no Envio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {envios.filter(e => e.status_envio === 'reagendado').length}
                </div>
                <div className="text-sm text-gray-600">Reagendados</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}