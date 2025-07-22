import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, FileText, MessageSquare, CheckCircle, XCircle, 
  AlertTriangle, DollarSign, User, Phone, Mail, MapPin, Download,
  Filter, Search, TrendingUp, Target, Zap
} from 'lucide-react';
import { TrativativasService } from '../services/tratativasService';
import { UnidadesService } from '../services/unidadesService';

interface LinhaTempoUnidadeProps {
  cnpj: string;
}

export function LinhaTempoUnidade({ cnpj }: LinhaTempoUnidadeProps) {
  const [historico, setHistorico] = useState<any[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [unidade, setUnidade] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({
    tipoEvento: '',
    dataInicio: '',
    dataFim: '',
    busca: ''
  });

  const tratativasService = new TrativativasService();
  const unidadesService = new UnidadesService();

  useEffect(() => {
    carregarDados();
  }, [cnpj, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [historicoData, resumoData, unidadeData] = await Promise.all([
        tratativasService.buscarHistoricoPorCNPJ(cnpj),
        tratativasService.buscarResumoAtividades(cnpj),
        unidadesService.buscarUnidadePorCodigo(cnpj)
      ]);
      
      // Aplica filtros
      let historicoFiltrado = historicoData;
      
      if (filtros.tipoEvento) {
        historicoFiltrado = historicoFiltrado.filter(h => h.tipo_interacao === filtros.tipoEvento);
      }
      
      if (filtros.dataInicio) {
        historicoFiltrado = historicoFiltrado.filter(h => h.data_interacao >= filtros.dataInicio);
      }
      
      if (filtros.dataFim) {
        historicoFiltrado = historicoFiltrado.filter(h => h.data_interacao <= filtros.dataFim);
      }
      
      if (filtros.busca) {
        historicoFiltrado = historicoFiltrado.filter(h => 
          h.descricao.toLowerCase().includes(filtros.busca.toLowerCase()) ||
          h.usuario_sistema.toLowerCase().includes(filtros.busca.toLowerCase())
        );
      }
      
      setHistorico(historicoFiltrado);
      setResumo(resumoData);
      setUnidade(unidadeData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  const exportarHistorico = async () => {
    try {
      const blob = await tratativasService.exportarHistoricoCNPJ(cnpj);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico-completo-${cnpj}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  const getIconeEvento = (tipo: string) => {
    switch (tipo) {
      case 'mensagem_automatica':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'resposta_franqueado':
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case 'agendamento':
        return <Calendar className="w-5 h-5 text-purple-600" />;
      case 'reuniao_realizada':
        return <Calendar className="w-5 h-5 text-green-700" />;
      case 'observacao_manual':
        return <FileText className="w-5 h-5 text-gray-600" />;
      case 'proposta_enviada':
        return <FileText className="w-5 h-5 text-yellow-600" />;
      case 'proposta_aceita':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'acordo_fechado':
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      case 'pagamento_parcial':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'marcado_como_quitado':
        return <CheckCircle className="w-5 h-5 text-green-800" />;
      case 'quebra_acordo':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'escalonamento':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'documento_gerado':
        return <FileText className="w-5 h-5 text-orange-600" />;
      case 'novo_titulo':
        return <Plus className="w-5 h-5 text-blue-600" />;
      case 'atualizacao_automatica':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCorEvento = (tipo: string) => {
    switch (tipo) {
      case 'marcado_como_quitado':
      case 'pagamento_parcial':
      case 'acordo_fechado':
        return 'border-green-500 bg-green-50';
      case 'quebra_acordo':
      case 'escalonamento':
        return 'border-red-500 bg-red-50';
      case 'agendamento':
      case 'reuniao_realizada':
        return 'border-purple-500 bg-purple-50';
      case 'proposta_enviada':
      case 'proposta_aceita':
        return 'border-yellow-500 bg-yellow-50';
      case 'mensagem_automatica':
      case 'novo_titulo':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const formatarTipoEvento = (tipo: string) => {
    const tipos: Record<string, string> = {
      'mensagem_automatica': 'Mensagem Automática',
      'resposta_franqueado': 'Resposta do Franqueado',
      'agendamento': 'Agendamento de Reunião',
      'reuniao_realizada': 'Reunião Realizada',
      'observacao_manual': 'Observação Manual',
      'proposta_enviada': 'Proposta Enviada',
      'proposta_aceita': 'Proposta Aceita',
      'acordo_fechado': 'Acordo Fechado',
      'pagamento_parcial': 'Pagamento de Parcela',
      'marcado_como_quitado': 'Marcado como Quitado',
      'quebra_acordo': 'Quebra de Acordo',
      'escalonamento': 'Escalonamento',
      'documento_gerado': 'Documento Gerado',
      'novo_titulo': 'Novo Título Criado',
      'atualizacao_automatica': 'Atualização Automática'
    };
    return tipos[tipo] || tipo;
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'quitado':
        return 'bg-green-100 text-green-800';
      case 'negociando':
        return 'bg-yellow-100 text-yellow-800';
      case 'em_aberto':
        return 'bg-red-100 text-red-800';
      case 'em_tratativa_juridica':
        return 'bg-purple-100 text-purple-800';
      case 'em_tratativa_critica':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando linha do tempo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header com informações da unidade */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Target className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Linha do Tempo - {unidade?.nome_franqueado || cnpj}
              </h1>
              <p className="text-gray-600">
                CNPJ: {cnpj} • {unidade?.cidade}/{unidade?.estado}
              </p>
            </div>
          </div>
          
          <button
            onClick={exportarHistorico}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Histórico
          </button>
        </div>

        {/* Cards de Resumo */}
        {resumo && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{resumo.total_acoes}</div>
              <div className="text-sm text-blue-800">Total de Ações</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{resumo.tentativas_negociacao}</div>
              <div className="text-sm text-purple-800">Tentativas Negociação</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(resumo.status_atual)}`}>
                {resumo.status_atual.replace('_', ' ').toUpperCase()}
              </span>
              <div className="text-sm text-gray-600 mt-2">Status Atual</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-lg font-bold text-green-600">
                {resumo.ultima_acao ? formatarData(resumo.ultima_acao.data_interacao).split(' ')[0] : 'N/A'}
              </div>
              <div className="text-sm text-green-800">Última Ação</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-lg font-bold text-yellow-600">
                {resumo.ultimo_acordo ? resumo.ultimo_acordo.status_acordo.toUpperCase() : 'SEM ACORDO'}
              </div>
              <div className="text-sm text-yellow-800">Último Acordo</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={filtros.tipoEvento}
              onChange={(e) => setFiltros({...filtros, tipoEvento: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Eventos</option>
              <option value="mensagem_automatica">Mensagem Automática</option>
              <option value="agendamento">Agendamento</option>
              <option value="reuniao_realizada">Reunião Realizada</option>
              <option value="acordo_fechado">Acordo Fechado</option>
              <option value="pagamento_parcial">Pagamento</option>
              <option value="escalonamento">Escalonamento</option>
              <option value="documento_gerado">Documento Gerado</option>
            </select>
            
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
            
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
              placeholder="Buscar na descrição..."
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Linha do Tempo */}
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          
          <div className="space-y-6">
            {historico.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum evento encontrado</p>
              </div>
            ) : (
              historico.map((evento, index) => (
                <div key={evento.id || index} className="relative flex items-start">
                  {/* Ícone do evento */}
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-white border-4 border-gray-200 rounded-full">
                    {getIconeEvento(evento.tipo_interacao)}
                  </div>
                  
                  {/* Conteúdo do evento */}
                  <div className={`ml-6 flex-1 border-l-4 rounded-lg p-6 ${getCorEvento(evento.tipo_interacao)}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                          {formatarTipoEvento(evento.tipo_interacao)}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {formatarData(evento.data_interacao)}
                        </span>
                      </div>
                      
                      {evento.status_cobranca_resultante && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(evento.status_cobranca_resultante)}`}>
                          {evento.status_cobranca_resultante.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-700 mb-3">{evento.descricao}</p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="text-gray-600">
                          <User className="w-4 h-4 inline mr-1" />
                          {evento.usuario_sistema}
                        </span>
                        <span className="text-gray-600">
                          Canal: {evento.canal}
                        </span>
                      </div>
                      
                      {evento.cobrancas_franqueados && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-800">
                            {formatarMoeda(evento.cobrancas_franqueados.valor_atualizado || evento.cobrancas_franqueados.valor_original)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Venc: {new Date(evento.cobrancas_franqueados.data_vencimento).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Estatísticas da Timeline */}
        {historico.length > 0 && (
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Estatísticas da Timeline</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {historico.filter(h => h.tipo_interacao === 'mensagem_automatica').length}
                </div>
                <div className="text-sm text-gray-600">Mensagens Enviadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {historico.filter(h => h.tipo_interacao === 'reuniao_realizada').length}
                </div>
                <div className="text-sm text-gray-600">Reuniões Realizadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {historico.filter(h => h.tipo_interacao === 'pagamento_parcial').length}
                </div>
                <div className="text-sm text-gray-600">Pagamentos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {historico.filter(h => h.tipo_interacao === 'escalonamento').length}
                </div>
                <div className="text-sm text-gray-600">Escalonamentos</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}