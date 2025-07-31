import { supabase } from './databaseService';

export class ReunioesJuridicoService {
  async listarReunioesJuridico(filtros: { unidadeId?: string } = {}) {
    let query = supabase
      .from('reunioes_juridico')
      .select(`*, unidades_franqueadas(id, nome_franqueado, codigo_unidade)`)
      .order('created_at', { ascending: false });
    if (filtros.unidadeId) {
      query = query.eq('unidade_id_fk', filtros.unidadeId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async atualizarPresencaTratativa(id: string, presenca: boolean, tratativas: string) {
    const { error } = await supabase
      .from('reunioes_juridico')
      .update({ presenca_franqueado: presenca, status: presenca ? 'realizada' : 'ausente', tratativas_acordadas: tratativas })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export const reunioesJuridicoService = new ReunioesJuridicoService();
