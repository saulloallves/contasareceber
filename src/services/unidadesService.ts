import { supabase } from './databaseService';
import { UnidadeFranqueada, FiltrosUnidades } from '../types/unidades';

export class UnidadesService {
  /**
   * Busca todas as unidades com filtros
   */
  async buscarUnidades(filtros: FiltrosUnidades = {}) {
    try {
      console.log('Buscando unidades no banco...');
      let query = supabase
        .from('unidades_franqueadas')
        .select('*')
        .order('nome_franqueado');

      if (filtros.status) {
        console.log('Aplicando filtro de status:', filtros.status);
        query = query.eq('status_unidade', filtros.status);
      }

      if (filtros.estado) {
        console.log('Aplicando filtro de estado:', filtros.estado);
        query = query.eq('estado', filtros.estado);
      }

      if (filtros.franqueado_principal !== undefined) {
        console.log('Aplicando filtro de franqueado principal:', filtros.franqueado_principal);
        query = query.eq('franqueado_principal', filtros.franqueado_principal);
      }

      if (filtros.busca) {
        console.log('Aplicando filtro de busca:', filtros.busca);
        query = query.or(`nome_franqueado.ilike.%${filtros.busca}%,codigo_unidade.ilike.%${filtros.busca}%,cidade.ilike.%${filtros.busca}%`);
      }

      const { data, error } = await query;
      
      console.log('Resultado da query:', { data, error });

      if (error) {
        console.error('Erro na query de unidades:', error);
        throw new Error(`Erro ao buscar unidades: ${error.message}`);
      }

      console.log(`Encontradas ${data?.length || 0} unidades`);
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar unidades:', error);
      throw error;
    }
  }

  /**
   * Busca unidade por código
   */
  async buscarUnidadePorCodigo(codigo: string): Promise<UnidadeFranqueada | null> {
    try {
      const { data, error } = await supabase
        .from('unidades_franqueadas')
        .select('*')
        .eq('codigo_unidade', codigo)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar unidade por código:', error);
      throw error;
    }
  }

  /**
   * Cria nova unidade
   */
  async criarUnidade(unidade: Omit<UnidadeFranqueada, 'id' | 'created_at' | 'updated_at'>): Promise<UnidadeFranqueada> {
    try {
      // Valida dados obrigatórios
      if (!unidade.codigo_unidade || !unidade.nome_franqueado) {
        throw new Error('Código da unidade e nome do franqueado são obrigatórios');
      }

      // Verifica se código já existe
      const unidadeExistente = await this.buscarUnidadePorCodigo(unidade.codigo_unidade);
      if (unidadeExistente) {
        throw new Error('Já existe uma unidade com este código');
      }

      const { data, error } = await supabase
        .from('unidades_franqueadas')
        .insert(unidade)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar unidade:', error);
      throw error;
    }
  }

  /**
   * Atualiza unidade existente
   */
  async atualizarUnidade(id: string, dadosAtualizacao: Partial<UnidadeFranqueada>): Promise<UnidadeFranqueada> {
    try {
      const { data, error } = await supabase
        .from('unidades_franqueadas')
        .update(dadosAtualizacao)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error);
      throw error;
    }
  }

  /**
   * Remove unidade (soft delete - muda status para fechada)
   */
  async removerUnidade(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('unidades_franqueadas')
        .update({ status_unidade: 'fechada' })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao remover unidade: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao remover unidade:', error);
      throw error;
    }
  }

  /**
   * Busca estatísticas das unidades
   */
  async buscarEstatisticasUnidades() {
    try {
      console.log('Buscando estatísticas de unidades...');
      const { data, error } = await supabase
        .from('unidades_franqueadas')
        .select('status_unidade, estado, franqueado_principal');

      console.log('Dados para estatísticas:', { data, error });

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const stats = {
        total: data?.length || 0,
        por_status: {} as Record<string, number>,
        por_estado: {} as Record<string, number>,
        franqueados_principais: 0,
        franqueados_secundarios: 0
      };

      data?.forEach(unidade => {
        // Por status
        stats.por_status[unidade.status_unidade] = (stats.por_status[unidade.status_unidade] || 0) + 1;
        
        // Por estado
        if (unidade.estado) {
          stats.por_estado[unidade.estado] = (stats.por_estado[unidade.estado] || 0) + 1;
        }
        
        // Franqueados principais
        if (unidade.franqueado_principal) {
          stats.franqueados_principais++;
        } else {
          stats.franqueados_secundarios++;
        }
      });

      console.log('Estatísticas calculadas:', stats);
      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Busca unidades para seleção (dropdown)
   */
  async buscarUnidadesParaSelecao() {
    try {
      const { data, error } = await supabase
        .from('unidades_franqueadas')
        .select('id, codigo_unidade, nome_franqueado, cidade, estado')
        .eq('status_unidade', 'ativa')
        .order('nome_franqueado');

      if (error) {
        throw new Error(`Erro ao buscar unidades: ${error.message}`);
      }

      return data?.map(unidade => ({
        value: unidade.codigo_unidade,
        label: `${unidade.codigo_unidade} - ${unidade.nome_franqueado} (${unidade.cidade}/${unidade.estado})`
      })) || [];
    } catch (error) {
      console.error('Erro ao buscar unidades para seleção:', error);
      throw error;
    }
  }

  /**
   * Vincula unidade à cobrança
   */
  async vincularUnidadeCobranca(cobrancaId: string, codigoUnidade: string): Promise<void> {
    try {
      // Busca a unidade para validar
      const unidade = await this.buscarUnidadePorCodigo(codigoUnidade);
      if (!unidade) {
        throw new Error('Unidade não encontrada');
      }

      // Atualiza a cobrança com informações da unidade
      const { error } = await supabase
        .from('cobrancas_franqueados')
        .update({
          telefone: unidade.telefone_franqueado
        })
        .eq('id', cobrancaId);

      if (error) {
        throw new Error(`Erro ao vincular unidade: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao vincular unidade à cobrança:', error);
      throw error;
    }
  }

  /**
   * Exporta dados das unidades
   */
  async exportarUnidades(filtros: FiltrosUnidades = {}): Promise<string> {
    try {
      const unidades = await this.buscarUnidades(filtros);
      
      // Cabeçalho CSV
      const cabecalho = [
        'Código',
        'Código Interno',
        'Nome Franqueado',
        'Principal',
        'Email',
        'Telefone',
        'Cidade',
        'Estado',
        'Status',
        'Data Abertura',
        'Observações'
      ].join(',');

      // Dados
      const linhas = unidades.map(unidade => [
        unidade.codigo_unidade,
        unidade.codigo_interno || '',
        unidade.nome_franqueado,
        unidade.franqueado_principal ? 'Sim' : 'Não',
        unidade.email_franqueado || '',
        unidade.telefone_franqueado || '',
        unidade.cidade || '',
        unidade.estado || '',
        unidade.status_unidade,
        unidade.data_abertura || '',
        (unidade.observacoes_unidade || '').replace(/,/g, ';')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao exportar unidades:', error);
      throw error;
    }
  }
}