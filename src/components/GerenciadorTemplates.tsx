import React, { useState, useEffect } from 'react';
import { templatesService, TemplateNotificacao, VariaveisTemplate } from '../services/templatesService';
import WhatsAppIcon from './ui/WhatsAppIcon';
import toast from 'react-hot-toast';

const GerenciadorTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateNotificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<{[key: string]: boolean}>({});
  const [abaAtiva, setAbaAtiva] = useState<'whatsapp' | 'email'>('whatsapp');
  const [subAbaAtiva, setSubAbaAtiva] = useState<'cpf' | 'cnpj'>('cpf');

  // Templates editáveis no estado
  const [templatesEditaveis, setTemplatesEditaveis] = useState<{[key: string]: TemplateNotificacao}>({});

  // Variáveis de exemplo para preview
  const variaveisExemplo: VariaveisTemplate = {
    nomeFranqueado: 'Franqueado Exemplo',
    nomeUnidade: 'UNIDADE EXEMPLO - SÃO PAULO / SP',
    tipoCobranca: 'Taxa de Franquia',
    valorFormatado: 'R$ 1.850,00',
    diasEmAberto: 15
  };

  useEffect(() => {
    carregarTemplates();
  }, []);

  const carregarTemplates = async () => {
    try {
      setLoading(true);
      const templatesCarregados = await templatesService.buscarTemplates();
      setTemplates(templatesCarregados);
      
      // Inicializa templates editáveis
      const editaveis: {[key: string]: TemplateNotificacao} = {};
      templatesCarregados.forEach(template => {
        editaveis[template.id] = { ...template };
      });
      setTemplatesEditaveis(editaveis);
      
      toast.success('Templates carregados com sucesso!', {
        duration: 2000,
        position: 'top-right',
      });
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates. Verifique sua conexão.', {
        duration: 5000,
        position: 'top-right',
      });
    } finally {
      setLoading(false);
    }
  };

  const salvarTemplate = async (templateId: string) => {
    try {
      setSaving(templateId);
      const template = templatesEditaveis[templateId];
      
      await templatesService.salvarTemplate({
        tipo: template.tipo,
        marco: template.marco,
        assunto: template.assunto,
        conteudo: template.conteudo,
        ativo: template.ativo
      });

      // Atualiza o template original
      setTemplates(prev => 
        prev.map(t => t.id === templateId ? { ...template } : t)
      );

      toast.success('Template salvo com sucesso!', {
        duration: 3000,
        position: 'top-right',
      });
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Erro ao salvar template. Verifique o console para mais detalhes.', {
        duration: 5000,
        position: 'top-right',
      });
    } finally {
      setSaving(null);
    }
  };

  const resetarTemplate = (templateId: string) => {
    const templateOriginal = templates.find(t => t.id === templateId);
    if (templateOriginal) {
      setTemplatesEditaveis(prev => ({
        ...prev,
        [templateId]: { ...templateOriginal }
      }));
      
      toast.success('Template resetado para versão original!', {
        duration: 2000,
        position: 'top-right',
      });
    }
  };

  const atualizarTemplate = (templateId: string, campo: keyof TemplateNotificacao, valor: string) => {
    setTemplatesEditaveis(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [campo]: valor
      }
    }));
  };

  const togglePreview = (templateId: string) => {
    const isCurrentlyShowing = previewMode[templateId];
    
    // Se está fechando o preview atual
    if (isCurrentlyShowing) {
      setPreviewMode(prev => ({
        ...prev,
        [templateId]: false
      }));
      return;
    }
    
    // Se está abrindo um novo preview, fecha todos os outros primeiro
    setPreviewMode(prev => {
      const newState: {[key: string]: boolean} = {};
      // Fecha todos os previews
      Object.keys(prev).forEach(key => {
        newState[key] = false;
      });
      // Abre apenas o preview solicitado
      newState[templateId] = true;
      return newState;
    });

    toast.success('Preview ativado!', {
      duration: 1500,
      position: 'top-right',
    });
  };

  const renderPreview = (template: TemplateNotificacao) => {
    const conteudoProcessado = templatesService.processarTemplate(
      template.conteudo, 
      variaveisExemplo
    );

    if (template.tipo.includes('email')) {
      const assuntoProcessado = template.assunto ? 
        templatesService.processarTemplate(template.assunto, variaveisExemplo) :
        'Sem assunto';
      
      return (
        <div className="border p-4 rounded-lg bg-gray-50 mt-4">
          <div className="mb-2 font-bold">
            Assunto: {assuntoProcessado}
          </div>
          <div 
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: conteudoProcessado }}
            style={{
              maxWidth: 'none',
              color: 'inherit'
            }}
          />
        </div>
      );
    }

    return (
      <div className="border p-4 rounded-lg bg-gray-50 whitespace-pre-wrap font-mono text-sm mt-4">
        {conteudoProcessado}
      </div>
    );
  };

  const templatesPorTipo = {
    whatsapp_cpf: templates.filter(t => t.tipo === 'whatsapp_cpf').sort((a, b) => a.marco - b.marco),
    whatsapp_cnpj: templates.filter(t => t.tipo === 'whatsapp_cnpj').sort((a, b) => a.marco - b.marco),
    email_cpf: templates.filter(t => t.tipo === 'email_cpf').sort((a, b) => a.marco - b.marco),
    email_cnpj: templates.filter(t => t.tipo === 'email_cnpj').sort((a, b) => a.marco - b.marco),
    // Fallback para templates antigos
    whatsapp: templates.filter(t => t.tipo === 'whatsapp').sort((a, b) => a.marco - b.marco),
    email: templates.filter(t => t.tipo === 'email').sort((a, b) => a.marco - b.marco)
  };

  const renderTemplateCard = (template: TemplateNotificacao) => {
    const templateEditavel = templatesEditaveis[template.id];
    const isPreview = previewMode[template.id];
    const hasChanges = JSON.stringify(template) !== JSON.stringify(templateEditavel);
    const isEmail = template.tipo.includes('email');

    return (
      <div key={template.id} className="border rounded-lg p-6 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {isEmail ? '📧' : <WhatsAppIcon size={16} />} {template.tipo.toUpperCase()} - {template.marco} Dias
            </h3>
            {hasChanges && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                Modificado
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => togglePreview(template.id)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              {isPreview ? '👁️ Ocultar' : '👁️ Preview'}
            </button>
            {hasChanges && (
              <button
                onClick={() => resetarTemplate(template.id)}
                className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300"
              >
                🔄 Resetar
              </button>
            )}
            <button
              onClick={() => salvarTemplate(template.id)}
              disabled={saving === template.id}
              className={`px-4 py-2 rounded text-white ${
                saving === template.id 
                  ? 'bg-gray-400' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {saving === template.id ? '⏳ Salvando...' : '💾 Salvar'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assunto do Email:
              </label>
              <input
                type="text"
                value={templateEditavel?.assunto || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  atualizarTemplate(template.id, 'assunto', e.target.value)
                }
                className="w-full p-3 border border-gray-300 rounded-md"
                placeholder="Assunto do email..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isEmail ? 'Conteúdo HTML do Email:' : 'Conteúdo da Mensagem WhatsApp:'}
            </label>
            <textarea
              value={templateEditavel?.conteudo || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                atualizarTemplate(template.id, 'conteudo', e.target.value)
              }
              rows={isEmail ? 15 : 12}
              className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
              placeholder={isEmail ? "Digite o template HTML do email..." : "Digite o template da mensagem..."}
            />
          </div>

          {isPreview && templateEditavel && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                {isEmail ? '📧' : <WhatsAppIcon size={16} />} Preview com dados de exemplo:
              </label>
              {renderPreview(templateEditavel)}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Carregando templates...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciador de Templates de Notificação</h1>
        <button 
          onClick={carregarTemplates} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔄 Recarregar
        </button>
      </div>

      {/* Informações sobre variáveis */}
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4">📝 Variáveis Disponíveis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { var: '{nomeFranqueado}', desc: 'Nome completo do franqueado' },
            { var: '{nomeUnidade}', desc: 'Nome da unidade' },
            { var: '{tipoCobranca}', desc: 'Tipo da cobrança' },
            { var: '{valorFormatado}', desc: 'Valor em reais (R$)' },
            { var: '{diasEmAberto}', desc: 'Dias desde criação' }
          ].map(({ var: varName, desc }) => (
            <div key={varName} className="bg-gray-50 p-3 rounded">
              <code className="bg-blue-100 px-2 py-1 rounded text-blue-800 font-mono text-sm">
                {varName}
              </code>
              <p className="text-sm text-gray-600 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs principais - WhatsApp e Email */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="border-b">
          <nav className="flex space-x-8">
            <button 
              onClick={() => setAbaAtiva('whatsapp')}
              className={`py-4 px-6 border-b-2 font-medium flex items-center gap-2 ${
                abaAtiva === 'whatsapp' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <WhatsAppIcon size={20} /> Templates WhatsApp
            </button>
            <button 
              onClick={() => setAbaAtiva('email')}
              className={`py-4 px-6 border-b-2 font-medium ${
                abaAtiva === 'email' 
                  ? 'border-green-500 text-green-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📧 Templates Email
            </button>
          </nav>
        </div>

        {/* Sub-abas CPF/CNPJ */}
        <div className="border-b bg-gray-50">
          <nav className="flex space-x-4 px-6">
            <button 
              onClick={() => setSubAbaAtiva('cpf')}
              className={`py-3 px-4 border-b-2 text-sm font-medium ${
                subAbaAtiva === 'cpf' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👤 Templates CPF
            </button>
            <button 
              onClick={() => setSubAbaAtiva('cnpj')}
              className={`py-3 px-4 border-b-2 text-sm font-medium ${
                subAbaAtiva === 'cnpj' 
                  ? 'border-purple-500 text-purple-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏢 Templates CNPJ
            </button>
          </nav>
        </div>

        {/* Conteúdo das abas */}
        <div className="p-6 space-y-6">
          {abaAtiva === 'whatsapp' && subAbaAtiva === 'cpf' && (
            <div>
              <div className="mb-4 p-4 bg-orange-50 border-l-4 border-orange-500">
                <h3 className="text-lg font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <WhatsAppIcon size={18} />👤 Templates WhatsApp para CPF
                </h3>
                <p className="text-orange-700 text-sm">
                  Mensagens para pessoas físicas (CPF). Não incluem referência à "unidade" pois são direcionadas a indivíduos.
                </p>
              </div>
              {templatesPorTipo.whatsapp_cpf.length > 0 ? (
                templatesPorTipo.whatsapp_cpf.map(template => renderTemplateCard(template))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum template WhatsApp CPF encontrado
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'whatsapp' && subAbaAtiva === 'cnpj' && (
            <div>
              <div className="mb-4 p-4 bg-purple-50 border-l-4 border-purple-500">
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center gap-2">
                  <WhatsAppIcon size={18} />🏢 Templates WhatsApp para CNPJ
                </h3>
                <p className="text-purple-700 text-sm">
                  Mensagens para pessoas jurídicas (CNPJ). Incluem referência à "unidade" da empresa.
                </p>
              </div>
              {templatesPorTipo.whatsapp_cnpj.length > 0 ? (
                templatesPorTipo.whatsapp_cnpj.map(template => renderTemplateCard(template))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum template WhatsApp CNPJ encontrado
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'email' && subAbaAtiva === 'cpf' && (
            <div>
              <div className="mb-4 p-4 bg-orange-50 border-l-4 border-orange-500">
                <h3 className="text-lg font-semibold text-orange-800 mb-2">
                  📧👤 Templates Email para CPF
                </h3>
                <p className="text-orange-700 text-sm">
                  Emails para pessoas físicas (CPF). Mais diretos e pessoais, sem referência à "unidade".
                </p>
              </div>
              {templatesPorTipo.email_cpf.length > 0 ? (
                templatesPorTipo.email_cpf.map(template => renderTemplateCard(template))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum template Email CPF encontrado
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'email' && subAbaAtiva === 'cnpj' && (
            <div>
              <div className="mb-4 p-4 bg-purple-50 border-l-4 border-purple-500">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">
                  📧🏢 Templates Email para CNPJ
                </h3>
                <p className="text-purple-700 text-sm">
                  Emails para pessoas jurídicas (CNPJ). Incluem contexto empresarial e referência à "unidade".
                </p>
              </div>
              {templatesPorTipo.email_cnpj.length > 0 ? (
                templatesPorTipo.email_cnpj.map(template => renderTemplateCard(template))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum template Email CNPJ encontrado
                </div>
              )}
            </div>
          )}

          {/* Fallback para templates antigos se existirem */}
          {templatesPorTipo.whatsapp.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  ⚠️ Templates Antigos (Genéricos)
                </h3>
                <p className="text-yellow-700 text-sm">
                  Templates do formato antigo encontrados. Recomenda-se migrar para os novos formatos CPF/CNPJ.
                </p>
              </div>
              {templatesPorTipo.whatsapp.map(template => renderTemplateCard(template))}
            </div>
          )}

          {templatesPorTipo.email.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  ⚠️ Templates de Email Antigos (Genéricos)
                </h3>
                <p className="text-yellow-700 text-sm">
                  Templates do formato antigo encontrados. Recomenda-se migrar para os novos formatos CPF/CNPJ.
                </p>
              </div>
              {templatesPorTipo.email.map(template => renderTemplateCard(template))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GerenciadorTemplates;
