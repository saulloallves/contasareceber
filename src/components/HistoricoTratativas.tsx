import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Calendar, User, FileText, CheckCircle, XCircle, 
  Clock, Phone, Mail, MapPin, Plus, Download, Filter, Search
} from 'lucide-react';
import { TrativativasService } from '../services/tratativasService';
import { TrativativaCobranca, HistoricoTratativas as HistoricoTratativasType } from '../types/cobranca';

interface HistoricoTrativativasProps {
  tituloId?: string;
  showAddButton?: boolean;
}

export function HistoricoTratativas({ tituloId, showAddButton = true }: HistoricoTrativativasProps) {
  const [historico, setHistorico] = useState<HistoricoTratativasType | null>(null);
  const [tratativas, setTratativas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    tipoInteracao: '',
    canal: '',
    usuario: '',
    dataInicio: '',
    dataFim: ''
  });
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [novaTratativa, setNovaTratativa] = useState({
    tipo_interacao: 'observacao_manual' as const,
    canal: 'interno' as const,
    descricao: '',
    status_cobranca_resultante: ''
  });

  const tratativasService = new TrativativasService();

  useEffect(() => {
    if (tituloId) {
      carregarHistoricoEspecifico();
    } else {
      carregarTodasTratativas();
    }
  }, [tituloId, filtros]);

  const carregarHistoricoEspecifico = async () => {
    if (!tituloId) return;
    
    setCarregando(true);
    try {
      const dados = await tratativasService.buscarHistoricoCobranca(tituloId);
      setHistorico(dados);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarTodasTratativas = async () => {
    setCarregando(true);
    try {
      const dados = await tratativasService.buscarTratativas(filtros);
      setTratativas(dados || []);
    } catch (error) {
      console.error('Erro ao carregar tratativas:', error);
    } finally {
      setCarregando(false);
    }
  };

  const adicionarTratativa = async () => {
    if (!tituloId || !novaTratativa.descricao.trim()) return;

    try {
      await tratativasService.registrarObservacao(
        tituloId,
        'usuario_atual', // Em produção, pegar do contexto de autenticação
        novaTratativa.descricao,
        novaTratativa.status_cobranca_resultante || undefined
      );

      setMostrarFormulario(false);
      setNovaTratativa({
        tipo_interacao: 'observacao_manual',
        canal: 'interno',
        descricao: '',
        status_cobranca_resultante: ''
      });

      // Recarrega os dados
      if (tituloId) {
        carregarHistoricoEspecifico();
      } else {
        carregarTodasTratativas();
      }
    } catch (error) {
      console.error('Erro ao adicionar tratativa:', error);
    }
  };

  const exportarHistorico = async () => {
    if (!tituloId) return;

    try {
      const blob = await tratativasService.exportarHistorico(tituloId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico-tratativas-${tituloId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const getIconeTipo = (tipo: string) => {
    switch (tipo) {
      case 'mensagem_automatica':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'resposta_franqueado':
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case 'agendamento':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'observacao_manual':
        return <FileText className="w-5 h-5 text-gray-600" />;
      case 'proposta_enviada':
        return <FileText className="w-5 h-5 text-yellow-600" />;
      case 'proposta_aceita':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'marcado_como_quitado':
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getIconeCanal = (canal: string) => {
    switch (canal) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'telefone':
        return <Phone className="w-4 h-4 text-purple-600" />;
      case 'presencial':
        return <MapPin className="w-4 h-4 text-red-600" />;
      case 'calendly':
        return <Calendar className="w-4 h-4 text-orange-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatarTipo = (tipo: string) => {
    const tipos: Record<string, string> = {
      'mensagem_automatica': 'Mensagem Automática',
      'resposta_franqueado': 'Resposta do Franqueado',
      'agendamento': 'Agendamento',
      'observacao_manual': 'Observação Manual',
      'proposta_enviada': 'Proposta Enviada',
      'proposta_aceita': 'Proposta Aceita',
      'marcado_como_quitado': 'Marcado como Quitado',
      'negociacao_iniciada': 'Negociação Iniciada',
      'pagamento_parcial': 'Pagamento Parcial',
      'acordo_fechado': 'Acordo Fechado'
    };
    return tipos[tipo] || tipo;
  };

  const formatarCanal = (canal: string) => {
    const canais: Record<string, string> = {
      'whatsapp': 'WhatsApp',
      'email': 'E-mail',
      'telefone': 'Telefone',
      'presencial': 'Presencial',
      'calendly': 'Calendly',
      'interno': 'Sistema Interno',
      'outro': 'Outro'
    };
    return canais[canal] || canal;
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  const dadosParaExibir = tituloId ? historico?.tratativas || [] : tratativas;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {tituloId ? 'Histórico de Tratativas' : 'Todas as Tratativas'}
              </h1>
              {historico?.cobranca && (
                <p className="text-gray-600">
                  {historico.cobranca.cliente} - CNPJ: {historico.cobranca.cnpj}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex space-x-3">
            {tituloId && (
              <button
                onClick={exportarHistorico}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </button>
            )}
            {showAddButton && tituloId && (
              <button
                onClick={() => setMostrarFormulario(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Observação
              </button>
            )}
          </div>
        </div>

        {/* Informações da Cobrança */}
        {historico?.cobranca && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Detalhes da Cobrança</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Valor Original:</span>
                <p className="text-lg font-bold text-gray-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(historico.cobranca.valor_original)}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Valor Atualizado:</span>
                <p className="text-lg font-bold text-red-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(historico.cobranca.valor_atualizado || historico.cobranca.valor_original)}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <p className={`text-lg font-bold ${
                  historico.cobranca.status === 'quitado' ? 'text-green-600' :
                  historico.cobranca.status === 'negociando' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {historico.cobranca.status.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Dias em Atraso:</span>
                <p className="text-lg font-bold text-gray-800">
                  {historico.cobranca.dias_em_atraso || 0} dias
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros (apenas para visualização geral) */}
        {!tituloId && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Filter className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={filtros.tipoInteracao}
                onChange={(e) => setFiltros({...filtros, tipoInteracao: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Tipos</option>
                <option value="mensagem_automatica">Mensagem Automática</option>
                <option value="resposta_franqueado">Resposta Franqueado</option>
                <option value="agendamento">Agendamento</option>
                <option value="observacao_manual">Observação Manual</option>
                <option value="proposta_enviada">Proposta Enviada</option>
                <option value="proposta_aceita">Proposta Aceita</option>
                <option value="marcado_como_quitado">Marcado como Quitado</option>
              </select>
              
              <select
                value={filtros.canal}
                onChange={(e) => setFiltros({...filtros, canal: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Canais</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="calendly">Calendly</option>
                <option value="interno">Interno</option>
              </select>
              
              <input
                type="text"
                placeholder="Usuário"
                value={filtros.usuario}
                onChange={(e) => setFiltros({...filtros, usuario: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Formulário para Nova Tratativa */}
        {mostrarFormulario && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">Adicionar Nova Observação</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={novaTratativa.canal}
                  onChange={(e) => setNovaTratativa({...novaTratativa, canal: e.target.value as any})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="interno">Sistema Interno</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="presencial">Presencial</option>
                </select>
                
                <select
                  value={novaTratativa.status_cobranca_resultante}
                  onChange={(e) => setNovaTratativa({...novaTratativa, status_cobranca_resultante: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Manter status atual</option>
                  <option value="em_aberto">Em Aberto</option>
                  <option value="negociando">Negociando</option>
                  <option value="quitado">Quitado</option>
                </select>
              </div>
              
              <textarea
                value={novaTratativa.descricao}
                onChange={(e) => setNovaTratativa({...novaTratativa, descricao: e.target.value})}
                placeholder="Descreva a interação ou observação..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={adicionarTratativa}
                  disabled={!novaTratativa.descricao.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Salvar Observação
                </button>
                <button
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline de Tratativas */}
        <div className="space-y-6">
          {dadosParaExibir.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma tratativa encontrada</p>
            </div>
          ) : (
            dadosParaExibir.map((tratativa, index) => (
              <div key={tratativa.id || index} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                    {getIconeTipo(tratativa.tipo_interacao)}
                  </div>
                </div>
                
                <div className="flex-1 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-gray-800">
                        {formatarTipo(tratativa.tipo_interacao)}
                      </span>
                      <div className="flex items-center space-x-1">
                        {getIconeCanal(tratativa.canal)}
                        <span className="text-sm text-gray-600">
                          {formatarCanal(tratativa.canal)}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatarData(tratativa.data_interacao || tratativa.created_at)}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-2">{tratativa.descricao}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">
                        <User className="w-4 h-4 inline mr-1" />
                        {tratativa.usuario_sistema}
                      </span>
                      {tratativa.status_cobranca_resultante && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tratativa.status_cobranca_resultante === 'quitado' ? 'bg-green-100 text-green-800' :
                          tratativa.status_cobranca_resultante === 'negociando' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          Status: {tratativa.status_cobranca_resultante}
                        </span>
                      )}
                    </div>
                    
                    {!tituloId && tratativa.cobrancas_franqueados && (
                      <span className="text-gray-600">
                        {tratativa.cobrancas_franqueados.cliente}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}