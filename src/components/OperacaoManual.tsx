import React, { useState, useEffect } from 'react';
import { 
  Edit, Plus, FileText, XCircle, CheckCircle, AlertTriangle, 
  Download, Filter, User, Calendar, DollarSign, Phone, Mail,
  Save, X, Upload, Eye, RefreshCw
} from 'lucide-react';
import { OperacaoManualService } from '../services/operacaoManualService';
import { CobrancaManual, TrativativaManual, NotificacaoManual, CancelamentoManual, FiltrosOperacaoManual, EstatisticasOperacaoManual } from '../types/operacaoManual';

export function OperacaoManual() {
  const [abaSelecionada, setAbaSelecionada] = useState<'cadastro' | 'edicao' | 'tratativa' | 'notificacao' | 'cancelamento' | 'logs'>('cadastro');
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasOperacaoManual | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosOperacaoManual>({});
  const [mensagem, setMensagem] = useState<{tipo: 'sucesso' | 'erro' | 'info', texto: string} | null>(null);

  // Estados dos formulários
  const [formCadastro, setFormCadastro] = useState<CobrancaManual>({
    cnpj: '',
    tipo_cobranca: 'royalties',
    descricao_cobranca: '',
    data_vencimento: '',
    valor_original: 0,
    status: 'em_aberto',
    motivo_cobranca: ''
  });

  const [formTratativa, setFormTratativa] = useState<TrativativaManual>({
    titulo_id: '',
    data_contato: '',
    tipo_contato: 'telefone',
    resultado_contato: 'prometeu_pagamento',
    observacoes_detalhadas: ''
  });

  const [formNotificacao, setFormNotificacao] = useState<NotificacaoManual>({
    titulo_id: '',
    tipo_notificacao: 'advertencia',
    modelo_template: 'padrao',
    canal_envio: 'email',
    urgencia: 'media',
    prazo_resposta_dias: 15
  });

  const [formCancelamento, setFormCancelamento] = useState<CancelamentoManual>({
    titulo_id: '',
    motivo_cancelamento: 'erro_sistema',
    justificativa_detalhada: '',
    aprovacao_necessaria: false,
    valor_cancelado: 0
  });

  const operacaoManualService = new OperacaoManualService();

  useEffect(() => {
    if (abaSelecionada === 'logs') {
      carregarDados();
    }
  }, [abaSelecionada, filtros]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [operacoesData, statsData] = await Promise.all([
        operacaoManualService.buscarOperacoesManuais(filtros),
        operacaoManualService.buscarEstatisticasOperacoes(filtros)
      ]);
      setOperacoes(operacoesData);
      setEstatisticas(statsData);
    } catch (error) {
      mostrarMensagem('erro', 'Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  };

  const cadastrarCobranca = async () => {
    if (!formCadastro.cnpj || !formCadastro.data_vencimento || !formCadastro.valor_original) {
      mostrarMensagem('erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    const justificativa = prompt('Justificativa para cadastro manual (obrigatório):');
    if (!justificativa) return;

    setProcessando(true);
    try {
      await operacaoManualService.cadastrarCobrancaManual(
        formCadastro,
        'usuario_atual', // Em produção, pegar do contexto
        justificativa
      );
      
      mostrarMensagem('sucesso', 'Cobrança cadastrada com sucesso!');
      setFormCadastro({
        cnpj: '',
        tipo_cobranca: 'royalties',
        descricao_cobranca: '',
        data_vencimento: '',
        valor_original: 0,
        status: 'em_aberto',
        motivo_cobranca: ''
      });
    } catch (error) {
      mostrarMensagem('erro', `Erro ao cadastrar cobrança: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const registrarTratativa = async () => {
    if (!formTratativa.titulo_id || !formTratativa.data_contato || !formTratativa.observacoes_detalhadas) {
      mostrarMensagem('erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    setProcessando(true);
    try {
      await operacaoManualService.registrarTrativativaManual(
        formTratativa,
        'usuario_atual'
      );
      
      mostrarMensagem('sucesso', 'Tratativa registrada com sucesso!');
      setFormTratativa({
        titulo_id: '',
        data_contato: '',
        tipo_contato: 'telefone',
        resultado_contato: 'prometeu_pagamento',
        observacoes_detalhadas: ''
      });
    } catch (error) {
      mostrarMensagem('erro', `Erro ao registrar tratativa: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const gerarNotificacao = async () => {
    if (!formNotificacao.titulo_id) {
      mostrarMensagem('erro', 'ID do título é obrigatório');
      return;
    }

    setProcessando(true);
    try {
      const documentoId = await operacaoManualService.gerarNotificacaoManual(
        formNotificacao,
        'usuario_atual'
      );
      
      mostrarMensagem('sucesso', `Notificação gerada com sucesso! ID: ${documentoId}`);
      setFormNotificacao({
        titulo_id: '',
        tipo_notificacao: 'advertencia',
        modelo_template: 'padrao',
        canal_envio: 'email',
        urgencia: 'media',
        prazo_resposta_dias: 15
      });
    } catch (error) {
      mostrarMensagem('erro', `Erro ao gerar notificação: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const cancelarCobranca = async () => {
    if (!formCancelamento.titulo_id || !formCancelamento.justificativa_detalhada) {
      mostrarMensagem('erro', 'ID do título e justificativa são obrigatórios');
      return;
    }

    if (!confirm('Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.')) {
      return;
    }

    setProcessando(true);
    try {
      await operacaoManualService.cancelarCobranca(
        formCancelamento,
        'usuario_atual'
      );
      
      mostrarMensagem('sucesso', 'Cobrança cancelada com sucesso!');
      setFormCancelamento({
        titulo_id: '',
        motivo_cancelamento: 'erro_sistema',
        justificativa_detalhada: '',
        aprovacao_necessaria: false,
        valor_cancelado: 0
      });
    } catch (error) {
      mostrarMensagem('erro', `Erro ao cancelar cobrança: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const exportarLogs = async () => {
    try {
      const csv = await operacaoManualService.exportarLogOperacoes(filtros);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operacoes-manuais-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      mostrarMensagem('erro', 'Erro ao exportar logs');
    }
  };

  const mostrarMensagem = (tipo: 'sucesso' | 'erro' | 'info', texto: string) => {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 5000);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const getTipoOperacaoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'cadastro_cobranca': 'Cadastro de Cobrança',
      'edicao_cobranca': 'Edição de Cobrança',
      'registro_tratativa': 'Registro de Tratativa',
      'geracao_notificacao': 'Geração de Notificação',
      'cancelamento': 'Cancelamento',
      'quitacao_manual': 'Quitação Manual'
    };
    return labels[tipo] || tipo;
  };

  const getTipoOperacaoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'cadastro_cobranca': 'bg-blue-100 text-blue-800',
      'edicao_cobranca': 'bg-yellow-100 text-yellow-800',
      'registro_tratativa': 'bg-green-100 text-green-800',
      'geracao_notificacao': 'bg-purple-100 text-purple-800',
      'cancelamento': 'bg-red-100 text-red-800',
      'quitacao_manual': 'bg-gray-100 text-gray-800'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Edit className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Operação Manual</h1>
              <p className="text-gray-600">Backup operacional e intervenções manuais</p>
            </div>
          </div>
          
          {abaSelecionada === 'logs' && (
            <button
              onClick={exportarLogs}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Logs
            </button>
          )}
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
            ) : mensagem.tipo === 'erro' ? (
              <AlertTriangle className="w-5 h-5 mr-2" />
            ) : (
              <AlertTriangle className="w-5 h-5 mr-2" />
            )}
            {mensagem.texto}
          </div>
        )}

        {/* Navegação por abas */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'cadastro', label: 'Cadastrar Cobrança', icon: Plus },
              { id: 'tratativa', label: 'Registrar Tratativa', icon: Phone },
              { id: 'notificacao', label: 'Gerar Notificação', icon: FileText },
              { id: 'cancelamento', label: 'Cancelar Cobrança', icon: XCircle },
              { id: 'logs', label: 'Logs de Operações', icon: Eye }
            ].map((aba) => {
              const Icon = aba.icon;
              return (
                <button
                  key={aba.id}
                  onClick={() => setAbaSelecionada(aba.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    abaSelecionada === aba.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {aba.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo das abas */}
        {abaSelecionada === 'cadastro' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Cadastrar Nova Cobrança</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ da Unidade *
                </label>
                <input
                  type="text"
                  value={formCadastro.cnpj}
                  onChange={(e) => setFormCadastro({...formCadastro, cnpj: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Cobrança *
                </label>
                <select
                  value={formCadastro.tipo_cobranca}
                  onChange={(e) => setFormCadastro({...formCadastro, tipo_cobranca: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="royalties">Royalties</option>
                  <option value="insumo">Insumo</option>
                  <option value="multa">Multa</option>
                  <option value="taxa">Taxa</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  value={formCadastro.data_vencimento}
                  onChange={(e) => setFormCadastro({...formCadastro, data_vencimento: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Original *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formCadastro.valor_original}
                  onChange={(e) => setFormCadastro({...formCadastro, valor_original: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="0,00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status Inicial
                </label>
                <select
                  value={formCadastro.status}
                  onChange={(e) => setFormCadastro({...formCadastro, status: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="em_aberto">Em Aberto</option>
                  <option value="negociando">Negociando</option>
                  <option value="quitado">Quitado</option>
                  <option value="escalonado">Escalonado</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código da Unidade
                </label>
                <input
                  type="text"
                  value={formCadastro.codigo_unidade || ''}
                  onChange={(e) => setFormCadastro({...formCadastro, codigo_unidade: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="CP001"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição da Cobrança *
              </label>
              <input
                type="text"
                value={formCadastro.descricao_cobranca}
                onChange={(e) => setFormCadastro({...formCadastro, descricao_cobranca: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: Royalties referente ao mês de Janeiro/2024"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da Cobrança *
              </label>
              <textarea
                value={formCadastro.motivo_cobranca}
                onChange={(e) => setFormCadastro({...formCadastro, motivo_cobranca: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Descreva o motivo desta cobrança..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formCadastro.observacoes || ''}
                onChange={(e) => setFormCadastro({...formCadastro, observacoes: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Observações adicionais..."
              />
            </div>
            
            <button
              onClick={cadastrarCobranca}
              disabled={processando}
              className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Cadastrar Cobrança
                </>
              )}
            </button>
          </div>
        )}

        {abaSelecionada === 'tratativa' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Registrar Tratativa Manual</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID do Título *
                </label>
                <input
                  type="text"
                  value={formTratativa.titulo_id}
                  onChange={(e) => setFormTratativa({...formTratativa, titulo_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="UUID da cobrança"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data do Contato *
                </label>
                <input
                  type="datetime-local"
                  value={formTratativa.data_contato}
                  onChange={(e) => setFormTratativa({...formTratativa, data_contato: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Contato *
                </label>
                <select
                  value={formTratativa.tipo_contato}
                  onChange={(e) => setFormTratativa({...formTratativa, tipo_contato: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="telefone">Telefone</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="presencial">Presencial</option>
                  <option value="videoconferencia">Videoconferência</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resultado do Contato *
                </label>
                <select
                  value={formTratativa.resultado_contato}
                  onChange={(e) => setFormTratativa({...formTratativa, resultado_contato: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="quitou">Quitou</option>
                  <option value="renegociou">Renegociou</option>
                  <option value="prometeu_pagamento">Prometeu Pagamento</option>
                  <option value="nao_respondeu">Não Respondeu</option>
                  <option value="reagendou">Reagendou</option>
                  <option value="contestou">Contestou</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor Negociado
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formTratativa.valor_negociado || ''}
                  onChange={(e) => setFormTratativa({...formTratativa, valor_negociado: parseFloat(e.target.value) || undefined})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Se houve negociação"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo Acordado
                </label>
                <input
                  type="text"
                  value={formTratativa.prazo_acordado || ''}
                  onChange={(e) => setFormTratativa({...formTratativa, prazo_acordado: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: 30 dias, parcelado em 3x"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações Detalhadas *
              </label>
              <textarea
                value={formTratativa.observacoes_detalhadas}
                onChange={(e) => setFormTratativa({...formTratativa, observacoes_detalhadas: e.target.value})}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Descreva detalhadamente o que foi conversado e acordado..."
              />
            </div>
            
            <button
              onClick={registrarTratativa}
              disabled={processando}
              className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Registrar Tratativa
                </>
              )}
            </button>
          </div>
        )}

        {abaSelecionada === 'notificacao' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Gerar Notificação Manual</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID do Título *
                </label>
                <input
                  type="text"
                  value={formNotificacao.titulo_id}
                  onChange={(e) => setFormNotificacao({...formNotificacao, titulo_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="UUID da cobrança"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Notificação *
                </label>
                <select
                  value={formNotificacao.tipo_notificacao}
                  onChange={(e) => setFormNotificacao({...formNotificacao, tipo_notificacao: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="advertencia">Advertência</option>
                  <option value="reforco">Reforço</option>
                  <option value="ultimo_aviso">Último Aviso</option>
                  <option value="formal_juridica">Formal Jurídica</option>
                  <option value="encerramento">Encerramento</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal de Envio
                </label>
                <select
                  value={formNotificacao.canal_envio}
                  onChange={(e) => setFormNotificacao({...formNotificacao, canal_envio: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="correios">Correios</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Urgência
                </label>
                <select
                  value={formNotificacao.urgencia}
                  onChange={(e) => setFormNotificacao({...formNotificacao, urgencia: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prazo para Resposta (dias)
                </label>
                <input
                  type="number"
                  value={formNotificacao.prazo_resposta_dias}
                  onChange={(e) => setFormNotificacao({...formNotificacao, prazo_resposta_dias: parseInt(e.target.value) || 15})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formNotificacao.observacoes || ''}
                onChange={(e) => setFormNotificacao({...formNotificacao, observacoes: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Observações específicas para esta notificação..."
              />
            </div>
            
            <button
              onClick={gerarNotificacao}
              disabled={processando}
              className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Gerar Notificação
                </>
              )}
            </button>
          </div>
        )}

        {abaSelecionada === 'cancelamento' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Cancelar Cobrança</h3>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-red-800 font-medium">Atenção: Esta ação é irreversível</p>
              </div>
              <p className="text-red-700 text-sm mt-1">
                O cancelamento de uma cobrança deve ser feito apenas em casos excepcionais e com justificativa detalhada.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID do Título *
                </label>
                <input
                  type="text"
                  value={formCancelamento.titulo_id}
                  onChange={(e) => setFormCancelamento({...formCancelamento, titulo_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="UUID da cobrança"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo do Cancelamento *
                </label>
                <select
                  value={formCancelamento.motivo_cancelamento}
                  onChange={(e) => setFormCancelamento({...formCancelamento, motivo_cancelamento: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="erro_sistema">Erro do Sistema</option>
                  <option value="decisao_diretoria">Decisão da Diretoria</option>
                  <option value="acordo_especial">Acordo Especial</option>
                  <option value="falha_contratual">Falha Contratual</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor a ser Cancelado
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formCancelamento.valor_cancelado}
                  onChange={(e) => setFormCancelamento({...formCancelamento, valor_cancelado: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="0,00"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="aprovacao_necessaria"
                  checked={formCancelamento.aprovacao_necessaria}
                  onChange={(e) => setFormCancelamento({...formCancelamento, aprovacao_necessaria: e.target.checked})}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="aprovacao_necessaria" className="ml-2 text-sm font-medium text-gray-700">
                  Requer aprovação da diretoria
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justificativa Detalhada *
              </label>
              <textarea
                value={formCancelamento.justificativa_detalhada}
                onChange={(e) => setFormCancelamento({...formCancelamento, justificativa_detalhada: e.target.value})}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Descreva detalhadamente o motivo do cancelamento..."
              />
            </div>
            
            <button
              onClick={cancelarCobranca}
              disabled={processando}
              className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 mr-2" />
                  Cancelar Cobrança
                </>
              )}
            </button>
          </div>
        )}

        {abaSelecionada === 'logs' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">Logs de Operações Manuais</h3>
            
            {/* Estatísticas */}
            {estatisticas && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{estatisticas.total_operacoes}</div>
                  <div className="text-sm text-blue-800">Total de Operações</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                      .format(estatisticas.valor_total_impactado)}
                  </div>
                  <div className="text-sm text-green-800">Valor Total Impactado</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-600">{estatisticas.operacoes_pendentes_aprovacao}</div>
                  <div className="text-sm text-yellow-800">Pendentes Aprovação</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {Object.keys(estatisticas.por_usuario).length}
                  </div>
                  <div className="text-sm text-purple-800">Usuários Ativos</div>
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Filter className="w-5 h-5 text-gray-600 mr-2" />
                <h4 className="text-lg font-semibold text-gray-800">Filtros</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select
                  value={filtros.tipo_operacao || ''}
                  onChange={(e) => setFiltros({...filtros, tipo_operacao: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="cadastro_cobranca">Cadastro de Cobrança</option>
                  <option value="edicao_cobranca">Edição de Cobrança</option>
                  <option value="registro_tratativa">Registro de Tratativa</option>
                  <option value="geracao_notificacao">Geração de Notificação</option>
                  <option value="cancelamento">Cancelamento</option>
                  <option value="quitacao_manual">Quitação Manual</option>
                </select>
                
                <input
                  type="text"
                  value={filtros.usuario || ''}
                  onChange={(e) => setFiltros({...filtros, usuario: e.target.value})}
                  placeholder="Usuário"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                
                <input
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => setFiltros({...filtros, dataInicio: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                
                <input
                  type="date"
                  value={filtros.dataFim || ''}
                  onChange={(e) => setFiltros({...filtros, dataFim: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Tabela de Logs */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CNPJ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Justificativa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin text-orange-600 mr-2" />
                          Carregando operações...
                        </div>
                      </td>
                    </tr>
                  ) : operacoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Nenhuma operação manual encontrada
                      </td>
                    </tr>
                  ) : (
                    operacoes.map((operacao) => (
                      <tr key={operacao.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatarData(operacao.data_operacao)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTipoOperacaoColor(operacao.tipo_operacao)}`}>
                            {getTipoOperacaoLabel(operacao.tipo_operacao)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1 text-gray-400" />
                            {operacao.usuario}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {operacao.cnpj_unidade}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={operacao.justificativa}>
                          {operacao.justificativa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {operacao.aprovado_por ? (
                            <span className="text-green-600">Aprovado</span>
                          ) : (
                            <span className="text-yellow-600">Pendente</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}