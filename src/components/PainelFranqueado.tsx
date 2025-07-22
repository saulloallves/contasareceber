import React, { useState, useEffect } from 'react';
import { 
  Building2, DollarSign, Calendar, FileText, AlertTriangle, 
  CheckCircle, Clock, Eye, Download, Phone, Mail, LogIn, 
  RefreshCw, User, MapPin, CreditCard
} from 'lucide-react';
import { FranqueadoService } from '../services/franqueadoService';
import { DadosFranqueado, SolicitacaoAuth } from '../types/franqueado';

export function PainelFranqueado() {
  const [etapa, setEtapa] = useState<'login' | 'autenticado'>('login');
  const [dadosFranqueado, setDadosFranqueado] = useState<DadosFranqueado | null>(null);
  const [formLogin, setFormLogin] = useState<SolicitacaoAuth>({ cnpj: '' });
  const [token, setToken] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{tipo: 'sucesso' | 'erro' | 'info', texto: string} | null>(null);
  const [tokenEnviado, setTokenEnviado] = useState(false);

  const franqueadoService = new FranqueadoService();

  const solicitarToken = async () => {
    if (!formLogin.cnpj) {
      mostrarMensagem('erro', 'CNPJ é obrigatório');
      return;
    }

    setCarregando(true);
    try {
      const resposta = await franqueadoService.solicitarAcesso(formLogin);
      
      if (resposta.sucesso) {
        setTokenEnviado(true);
        mostrarMensagem('sucesso', resposta.mensagem);
        // Em desenvolvimento, mostra o token na tela
        if (resposta.token) {
          setToken(resposta.token);
        }
      } else {
        mostrarMensagem('erro', resposta.mensagem);
      }
    } catch (error) {
      mostrarMensagem('erro', 'Erro ao solicitar acesso');
    } finally {
      setCarregando(false);
    }
  };

  const validarAcesso = async () => {
    if (!token) {
      mostrarMensagem('erro', 'Token é obrigatório');
      return;
    }

    setCarregando(true);
    try {
      const dados = await franqueadoService.validarAcesso(formLogin.cnpj, token);
      
      if (dados) {
        setDadosFranqueado(dados);
        setEtapa('autenticado');
        mostrarMensagem('sucesso', 'Acesso autorizado com sucesso!');
      } else {
        mostrarMensagem('erro', 'Token inválido ou expirado');
      }
    } catch (error) {
      mostrarMensagem('erro', 'Erro ao validar token');
    } finally {
      setCarregando(false);
    }
  };

  const logout = () => {
    setEtapa('login');
    setDadosFranqueado(null);
    setFormLogin({ cnpj: '' });
    setToken('');
    setTokenEnviado(false);
    setMensagem(null);
  };

  const mostrarMensagem = (tipo: 'sucesso' | 'erro' | 'info', texto: string) => {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 5000);
  };

  const formatarCNPJ = (cnpj: string) => {
    const apenasNumeros = cnpj.replace(/\D/g, '');
    return apenasNumeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'quitado': return 'text-green-600 bg-green-100';
      case 'negociando': return 'text-yellow-600 bg-yellow-100';
      case 'em_aberto': return 'text-red-600 bg-red-100';
      case 'em_tratativa_juridica': return 'text-purple-600 bg-purple-100';
      case 'em_tratativa_critica': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusGeralColor = (status: string) => {
    switch (status) {
      case 'regular': return 'text-green-600 bg-green-100';
      case 'inadimplente': return 'text-yellow-600 bg-yellow-100';
      case 'crítico': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTipoDocumentoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'notificacao_inadimplencia': 'Notificação de Inadimplência',
      'notificacao_ausencia_tratativas': 'Notificação por Ausência',
      'notificacao_vencimento': 'Notificação de Vencimento',
      'notificacao_quebra_acordo': 'Notificação de Quebra de Acordo',
      'notificacao_preventiva': 'Notificação Preventiva',
      'carta_encerramento': 'Carta de Encerramento'
    };
    return labels[tipo] || tipo;
  };

  if (etapa === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Building2 className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Painel do Franqueado
            </h1>
            <p className="text-gray-600">
              Acesse sua situação financeira de forma segura
            </p>
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
                <Clock className="w-5 h-5 mr-2" />
              )}
              {mensagem.texto}
            </div>
          )}

          {!tokenEnviado ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ da Unidade
                </label>
                <input
                  type="text"
                  value={formLogin.cnpj}
                  onChange={(e) => setFormLogin({...formLogin, cnpj: e.target.value})}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={solicitarToken}
                disabled={carregando}
                className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {carregando ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Solicitar Acesso
                  </>
                )}
              </button>

              <div className="text-center text-sm text-gray-500">
                <p>Um código de acesso será enviado para seu email/WhatsApp cadastrado</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Acesso
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Digite o código recebido"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Código válido por 15 minutos
                </p>
              </div>

              <button
                onClick={validarAcesso}
                disabled={carregando}
                className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {carregando ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Acessar Painel
                  </>
                )}
              </button>

              <button
                onClick={() => setTokenEnviado(false)}
                className="w-full px-4 py-2 text-blue-600 hover:text-blue-800"
              >
                Solicitar novo código
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!dadosFranqueado) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-lg font-semibold text-gray-800">
                  {dadosFranqueado.unidade.nome_franqueado}
                </h1>
                <p className="text-sm text-gray-600">
                  {formatarCNPJ(dadosFranqueado.unidade.codigo_unidade)}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumo da Situação */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center mb-6">
            <DollarSign className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-800">Resumo da Situação Financeira</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">
                {formatarMoeda(dadosFranqueado.resumo_financeiro.valor_total_em_aberto)}
              </div>
              <div className="text-sm text-red-800">Total em Aberto</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {dadosFranqueado.resumo_financeiro.quantidade_titulos_vencidos}
              </div>
              <div className="text-sm text-orange-800">Títulos Vencidos</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {dadosFranqueado.resumo_financeiro.data_vencimento_mais_antiga 
                  ? formatarData(dadosFranqueado.resumo_financeiro.data_vencimento_mais_antiga)
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-blue-800">Vencimento Mais Antigo</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className={`text-2xl font-bold px-3 py-1 rounded-full text-center ${getStatusGeralColor(dadosFranqueado.resumo_financeiro.status_geral)}`}>
                {dadosFranqueado.resumo_financeiro.status_geral.toUpperCase()}
              </div>
              <div className="text-sm text-gray-800 text-center mt-2">Status Geral</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Última Tratativa:</h3>
            <p className="text-gray-700">{dadosFranqueado.resumo_financeiro.ultima_tratativa}</p>
          </div>
        </div>

        {/* Detalhamento de Cobranças */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Detalhamento de Cobranças</h3>
          
          {dadosFranqueado.cobrancas.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Parabéns! Não há cobranças pendentes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Original
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Atualizado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dias em Atraso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dadosFranqueado.cobrancas.map((cobranca) => (
                    <tr key={cobranca.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarData(cobranca.data_vencimento)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatarMoeda(cobranca.valor_original)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatarMoeda(cobranca.valor_atualizado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cobranca.dias_em_atraso} dias
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(cobranca.status)}`}>
                          {cobranca.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Reuniões e Acordos */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Reuniões e Acordos</h3>
          
          {dadosFranqueado.reunioes.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma reunião agendada ou realizada.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dadosFranqueado.reunioes.map((reuniao) => (
                <div key={reuniao.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium text-gray-800">
                        {formatarData(reuniao.data_agendada)}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      reuniao.status_reuniao === 'realizada' ? 'bg-green-100 text-green-800' :
                      reuniao.status_reuniao === 'agendada' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {reuniao.status_reuniao.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  {reuniao.data_realizada && (
                    <p className="text-sm text-gray-600 mb-2">
                      Realizada em: {formatarData(reuniao.data_realizada)}
                    </p>
                  )}
                  
                  {reuniao.decisao_final && (
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Decisão:</strong> {reuniao.decisao_final.replace('_', ' ').toUpperCase()}
                    </p>
                  )}
                  
                  {reuniao.resumo_resultado && (
                    <p className="text-sm text-gray-700">
                      <strong>Resumo:</strong> {reuniao.resumo_resultado}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documentos Associados */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Documentos e Notificações</h3>
          
          {dadosFranqueado.documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum documento formal foi gerado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dadosFranqueado.documentos.map((documento) => (
                <div key={documento.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="w-6 h-6 text-red-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-800">
                        {getTipoDocumentoLabel(documento.tipo_documento)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Gerado em: {formatarData(documento.data_criacao)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      <Eye className="w-4 h-4 mr-1" />
                      Visualizar
                    </button>
                    {documento.arquivo_pdf_url && (
                      <button className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contato com a Franqueadora */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Contato com a Franqueadora</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Phone className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-800 mb-2">WhatsApp</h4>
              <p className="text-sm text-gray-600 mb-3">
                Fale conosco pelo WhatsApp para esclarecimentos rápidos
              </p>
              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                Abrir WhatsApp
              </button>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Mail className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-800 mb-2">E-mail</h4>
              <p className="text-sm text-gray-600 mb-3">
                Envie sua dúvida ou solicitação por e-mail
              </p>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Enviar E-mail
              </button>
            </div>
            
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <Calendar className="w-8 h-8 text-purple-600 mx-auto mb-3" />
              <h4 className="font-medium text-gray-800 mb-2">Agendar Reunião</h4>
              <p className="text-sm text-gray-600 mb-3">
                Agende uma reunião para negociar seus débitos
              </p>
              <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Agendar Reunião
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}