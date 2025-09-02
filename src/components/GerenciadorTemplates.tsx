import React, { useState, useEffect } from 'react';
import { templatesService, TemplateNotificacao, VariaveisTemplate } from '../services/templatesService';

const GerenciadorTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateNotificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<{[key: string]: boolean}>({});

  // Templates editáveis no estado
  const [templatesEditaveis, setTemplatesEditaveis] = useState<{[key: string]: TemplateNotificacao}>({});

  // Variáveis de exemplo para preview
  const variaveisExemplo: VariaveisTemplate = {
    nomeFranqueado: 'João Silva Santos',
    nomeUnidade: 'VILA PRUDENTE - SÃO PAULO / SP',
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
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
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

      alert('Template salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar template. Verifique o console para mais detalhes.');
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
    setPreviewMode(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  const renderPreview = (template: TemplateNotificacao) => {
    const conteudoProcessado = templatesService.processarTemplate(
      template.conteudo, 
      variaveisExemplo
    );

    if (template.tipo === 'email') {
      const assuntoProcessado = template.assunto ? 
        templatesService.processarTemplate(template.assunto, variaveisExemplo) :
        'Sem assunto';
      
      return (
        <div className="border p-4 rounded-lg bg-gray-50 mt-4">
          <div className="mb-2 font-bold">
            Assunto: {assuntoProcessado}
          </div>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: conteudoProcessado }}
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
    whatsapp: templates.filter(t => t.tipo === 'whatsapp').sort((a, b) => a.marco - b.marco),
    email: templates.filter(t => t.tipo === 'email').sort((a, b) => a.marco - b.marco)
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

      {/* Tabs de WhatsApp e Email */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="border-b">
          <nav className="flex space-x-8">
            <button className="py-4 px-6 border-b-2 border-blue-500 text-blue-600 font-medium">
              📱 Templates WhatsApp
            </button>
          </nav>
        </div>

        <div className="p-6 space-y-6">
          {templatesPorTipo.whatsapp.map(template => {
            const templateEditavel = templatesEditaveis[template.id];
            const isPreview = previewMode[template.id];
            const hasChanges = JSON.stringify(template) !== JSON.stringify(templateEditavel);

            return (
              <div key={template.id} className="border rounded-lg p-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      📱 WhatsApp - {template.marco} dias
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conteúdo da Mensagem WhatsApp:
                    </label>
                    <textarea
                      value={templateEditavel?.conteudo || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                        atualizarTemplate(template.id, 'conteudo', e.target.value)
                      }
                      rows={12}
                      className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
                      placeholder="Digite o template da mensagem..."
                    />
                  </div>

                  {isPreview && templateEditavel && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📱 Preview com dados de exemplo:
                      </label>
                      {renderPreview(templateEditavel)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white rounded-lg shadow-md border">
        <div className="border-b">
          <nav className="flex space-x-8">
            <button className="py-4 px-6 border-b-2 border-green-500 text-green-600 font-medium">
              📧 Templates Email
            </button>
          </nav>
        </div>

        <div className="p-6 space-y-6">
          {templatesPorTipo.email.map(template => {
            const templateEditavel = templatesEditaveis[template.id];
            const isPreview = previewMode[template.id];
            const hasChanges = JSON.stringify(template) !== JSON.stringify(templateEditavel);

            return (
              <div key={template.id} className="border rounded-lg p-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      📧 Email - {template.marco} dias
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conteúdo HTML do Email:
                    </label>
                    <textarea
                      value={templateEditavel?.conteudo || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                        atualizarTemplate(template.id, 'conteudo', e.target.value)
                      }
                      rows={15}
                      className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
                      placeholder="Digite o template HTML do email..."
                    />
                  </div>

                  {isPreview && templateEditavel && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        📧 Preview com dados de exemplo:
                      </label>
                      {renderPreview(templateEditavel)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GerenciadorTemplates;
