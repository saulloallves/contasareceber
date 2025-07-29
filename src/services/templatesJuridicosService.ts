import { supabase } from './databaseService';
import { TemplateJuridico, GatilhoAutomatico, FiltrosTemplates, EstatisticasTemplates, HistoricoDisparo, VariaveisTemplate } from '../types/templatesJuridicos';

export class TemplatesJuridicosService {
  /**
   * Busca templates com filtros
   */
  async buscarTemplates(filtros: FiltrosTemplates = {}): Promise<TemplateJuridico[]> {
    try {
      let query = supabase
        .from('templates_juridicos')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtros.tipo_debito) {
        query = query.eq('tipo_debito', filtros.tipo_debito);
      }

      if (filtros.categoria) {
        query = query.eq('categoria', filtros.categoria);
      }

      if (filtros.ativo !== undefined) {
        query = query.eq('ativo', filtros.ativo);
      }

      if (filtros.busca) {
        query = query.ilike('nome', `%${filtros.busca}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar templates: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      throw error;
    }
  }

  /**
   * Cria novo template jurídico
   */
  async criarTemplate(template: Omit<TemplateJuridico, 'id' | 'created_at' | 'updated_at'>): Promise<TemplateJuridico> {
    try {
      const { data, error } = await supabase
        .from('templates_juridicos')
        .insert(template)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar template: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar template:', error);
      throw error;
    }
  }

  /**
   * Atualiza template existente
   */
  async atualizarTemplate(id: string, dadosAtualizacao: Partial<TemplateJuridico>): Promise<TemplateJuridico> {
    try {
      const { data, error } = await supabase
        .from('templates_juridicos')
        .update(dadosAtualizacao)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar template: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      throw error;
    }
  }

  /**
   * Ativa ou desativa template
   */
  async ativarDesativarTemplate(id: string, ativo: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('templates_juridicos')
        .update({ ativo })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao ${ativo ? 'ativar' : 'desativar'} template: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao alterar status do template:', error);
      throw error;
    }
  }

  /**
   * Gera preview do template com variáveis substituídas
   */
  async gerarPreviewTemplate(templateId: string, variaveis: VariaveisTemplate): Promise<string> {
    try {
      const { data: template, error } = await supabase
        .from('templates_juridicos')
        .select('corpo_mensagem')
        .eq('id', templateId)
        .single();

      if (error || !template) {
        throw new Error('Template não encontrado');
      }

      let mensagem = template.corpo_mensagem;

      // Substituir variáveis
      Object.entries(variaveis).forEach(([chave, valor]) => {
        const regex = new RegExp(`{{${chave}}}`, 'g');
        mensagem = mensagem.replace(regex, String(valor));
      });

      return mensagem;
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      throw error;
    }
  }

  /**
   * Busca gatilhos automáticos
   */
  async buscarGatilhos(): Promise<GatilhoAutomatico[]> {
    try {
      const { data, error } = await supabase
        .from('gatilhos_automaticos')
        .select(`
          *,
          templates_juridicos (
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar gatilhos: ${error.message}`);
      }

      return data?.map(gatilho => ({
        ...gatilho,
        template_nome: (gatilho as any).templates_juridicos?.nome || 'Template não encontrado'
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar gatilhos:', error);
      throw error;
    }
  }

  /**
   * Cria novo gatilho automático
   */
  async criarGatilho(gatilho: Omit<GatilhoAutomatico, 'id' | 'created_at' | 'updated_at'>): Promise<GatilhoAutomatico> {
    try {
      const { data, error } = await supabase
        .from('gatilhos_automaticos')
        .insert(gatilho)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar gatilho: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar gatilho:', error);
      throw error;
    }
  }

  /**
   * Executa gatilho automático
   */
  async executarGatilho(gatilhoId: string, cnpjUnidade: string, dadosContexto: any): Promise<void> {
    try {
      // Busca dados do gatilho
      const { data: gatilho, error: errorGatilho } = await supabase
        .from('gatilhos_automaticos')
        .select(`
          *,
          templates_juridicos (*)
        `)
        .eq('id', gatilhoId)
        .eq('ativo', true)
        .single();

      if (errorGatilho || !gatilho) {
        throw new Error('Gatilho não encontrado ou inativo');
      }

      // Busca dados da unidade
      const { data: unidade, error: errorUnidade } = await supabase
        .from('unidades_franqueadas')
        .select('*')
        .eq('codigo_unidade', cnpjUnidade)
        .single();

      if (errorUnidade || !unidade) {
        throw new Error('Unidade não encontrada');
      }

      // Prepara variáveis para o template
      const variaveis: VariaveisTemplate = {
        nome_unidade: unidade.nome_franqueado,
        codigo_unidade: unidade.codigo_unidade,
        cnpj: cnpjUnidade,
        valor_total_em_aberto: dadosContexto.valor_total || 0,
        dias_em_atraso: dadosContexto.dias_atraso || 0,
        tipo_debito: dadosContexto.tipo_debito || 'royalty',
        data_vencimento: dadosContexto.data_vencimento || new Date().toLocaleDateString('pt-BR'),
        link_acordo: 'https://painel.crescieperdi.com/acordo',
        nome_franqueado_principal: unidade.nome_franqueado
      };

      // Gera mensagem do template
      const template = (gatilho as any).templates_juridicos;
      const mensagem = await this.gerarPreviewTemplate(template.id, variaveis);

      // Registra o disparo
      await this.registrarDisparo({
        template_id: template.id,
        gatilho_id: gatilhoId,
        cnpj_unidade: cnpjUnidade,
        canal_utilizado: template.canal_envio,
        mensagem_enviada: mensagem,
        data_envio: new Date().toISOString(),
        visualizado: false
      });

      // Aqui seria feita a integração real com WhatsApp/Email
      console.log(`Gatilho executado: ${gatilho.nome} para ${cnpjUnidade}`);
    } catch (error) {
      console.error('Erro ao executar gatilho:', error);
      throw error;
    }
  }

  /**
   * Registra disparo de template
   */
  async registrarDisparo(disparo: Omit<HistoricoDisparo, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('historico_disparos_templates')
        .insert(disparo);

      if (error) {
        throw new Error(`Erro ao registrar disparo: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao registrar disparo:', error);
      throw error;
    }
  }

  /**
   * Busca histórico de disparos
   */
  async buscarHistoricoDisparos(filtros: FiltrosTemplates = {}): Promise<HistoricoDisparo[]> {
    try {
      let query = supabase
        .from('historico_disparos_templates')
        .select(`
          *,
          templates_juridicos (
            nome
          ),
          unidades_franqueadas (
            nome_franqueado
          )
        `)
        .order('data_envio', { ascending: false });

      if (filtros.tipo_debito) {
        query = query.eq('templates_juridicos.tipo_debito', filtros.tipo_debito);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar histórico: ${error.message}`);
      }

      return data?.map(item => ({
        ...item,
        template_nome: (item as any).templates_juridicos?.nome || 'Template removido',
        unidade_nome: (item as any).unidades_franqueadas?.nome_franqueado || 'Unidade não encontrada'
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar histórico de disparos:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas dos templates
   */
  async buscarEstatisticas(): Promise<EstatisticasTemplates> {
    try {
      const [templatesData, gatilhosData, disparosData] = await Promise.all([
        supabase.from('templates_juridicos').select('ativo'),
        supabase.from('gatilhos_automaticos').select('ativo'),
        supabase.from('historico_disparos_templates').select('visualizado, resultado, data_envio')
      ]);

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      const stats: EstatisticasTemplates = {
        total_templates: templatesData.data?.filter(t => t.ativo).length || 0,
        gatilhos_ativos: gatilhosData.data?.filter(g => g.ativo).length || 0,
        disparos_mes: disparosData.data?.filter(d => new Date(d.data_envio) >= inicioMes).length || 0,
        taxa_resposta: 0
      };

      // Calcula taxa de resposta
      const disparosComResposta = disparosData.data?.filter(d => d.resultado && d.resultado !== 'ignorado').length || 0;
      const totalDisparos = disparosData.data?.length || 0;
      
      if (totalDisparos > 0) {
        stats.taxa_resposta = (disparosComResposta / totalDisparos) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Verifica condições para disparo automático
   */
  async verificarCondicoesGatilhos(cnpjUnidade: string): Promise<void> {
    try {
      // Busca gatilhos ativos
      const { data: gatilhos } = await supabase
        .from('gatilhos_automaticos')
        .select('*')
        .eq('ativo', true);

      if (!gatilhos) return;

      // Busca dados da unidade para verificação
      const { data: cobrancas } = await supabase
        .from('cobrancas_franqueados')
        .select('*')
        .eq('cnpj', cnpjUnidade);

      const { data: reunioes } = await supabase
        .from('reunioes_negociacao')
        .select('*')
        .eq('cnpj_unidade', cnpjUnidade);

      // Verifica cada gatilho
      for (const gatilho of gatilhos) {
        const deveDisparar = this.avaliarCondicoes(gatilho, cobrancas || [], reunioes || []);
        
        if (deveDisparar) {
          await this.executarGatilho(gatilho.id, cnpjUnidade, {
            valor_total: cobrancas?.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0) || 0,
            dias_atraso: Math.max(...(cobrancas?.map(c => c.dias_em_atraso || 0) || [0])),
            tipo_debito: cobrancas?.[0]?.tipo_cobranca || 'royalty'
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar condições de gatilhos:', error);
    }
  }

  /**
   * Avalia se as condições do gatilho foram atendidas
   */
  private avaliarCondicoes(gatilho: GatilhoAutomatico, cobrancas: any[], reunioes: any[]): boolean {
    // Implementar lógica de avaliação baseada nas condições do gatilho
    // Por exemplo:
    
    // 2+ boletos vencidos do mesmo tipo
    if (gatilho.condicoes.includes('2_boletos_vencidos')) {
      const vencidas = cobrancas.filter(c => c.status === 'em_aberto' && c.dias_em_atraso > 0);
      return vencidas.length >= 2;
    }

    // Reunião sem comparecimento
    if (gatilho.condicoes.includes('reuniao_sem_comparecimento')) {
      return reunioes.some(r => r.status_reuniao === 'nao_compareceu');
    }

    // Valor alto
    if (gatilho.condicoes.includes('valor_alto')) {
      const valorTotal = cobrancas.reduce((sum, c) => sum + (c.valor_atualizado || c.valor_original), 0);
      return valorTotal > 5000;
    }

    return false;
  }

  /**
   * Exporta templates para CSV
   */
  async exportarTemplates(filtros: FiltrosTemplates = {}): Promise<string> {
    try {
      const templates = await this.buscarTemplates(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Nome',
        'Tipo Débito',
        'Categoria',
        'Canal Envio',
        'Prazo Resposta',
        'Ativo',
        'Total Disparos',
        'Data Criação'
      ].join(',');

      // Dados
      const linhas = templates.map(template => [
        template.nome,
        template.tipo_debito,
        template.categoria,
        template.canal_envio,
        template.prazo_resposta_dias,
        template.ativo ? 'Sim' : 'Não',
        template.total_disparos || 0,
        new Date(template.created_at!).toLocaleDateString('pt-BR')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar templates:', error);
      throw error;
    }
  }

  /**
   * Duplica template existente
   */
  async duplicarTemplate(templateId: string, novoNome: string): Promise<TemplateJuridico> {
    try {
      const { data: templateOriginal, error } = await supabase
        .from('templates_juridicos')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error || !templateOriginal) {
        throw new Error('Template não encontrado');
      }

      const novoTemplate = {
        ...templateOriginal,
        nome: novoNome,
        ativo: false // Novo template inicia inativo
      };

      delete novoTemplate.id;
      delete novoTemplate.created_at;
      delete novoTemplate.updated_at;

      return await this.criarTemplate(novoTemplate);
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      throw error;
    }
  }
}