import { supabase } from "./databaseService";
import { UnidadeFranqueada, FiltrosUnidades } from "../types/unidades";

export class UnidadesService {
  /**
   * Busca todas as unidades com filtros
   */
  async buscarUnidades(filtros: FiltrosUnidades = {}) {
    try {
      let query = supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades (
            franqueado_id,
            franqueados (
              id, nome, email, telefone
            )
          )
        `
        )
        .order("nome_franqueado");

      if (filtros.status) {
        query = query.eq("status_unidade", filtros.status);
      }

      if (filtros.estado) {
        query = query.eq("estado", filtros.estado);
      }

      if (filtros.franqueado_principal !== undefined) {
        query = query.eq("franqueado_principal", filtros.franqueado_principal);
      }

      if (filtros.busca) {
        query = query.or(
          `nome_franqueado.ilike.%${filtros.busca}%,codigo_unidade.ilike.%${filtros.busca}%,cidade.ilike.%${filtros.busca}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Erro ao buscar unidades: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Erro ao buscar unidades:", error);
      throw error;
    }
  }

  /**
   * Busca unidade por código
   */
  async buscarUnidadePorCodigo(
    codigo: string
  ): Promise<UnidadeFranqueada | null> {
    try {
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades (
            franqueado_id,
            franqueados (
              id, nome, email, telefone
            )
          )
        `
        )
        .eq("codigo_unidade", codigo)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Erro ao buscar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Erro ao buscar unidade por código:", error);
      throw error;
    }
  }

  /**
   * Busca unidade por CNPJ
   */
  async buscarUnidadePorCnpj(cnpj: string): Promise<UnidadeFranqueada | null> {
    try {
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades (
            franqueado_id,
            franqueados (
              id, nome, email, telefone
            )
          )
        `
        )
        .eq("cnpj", cnpjLimpo)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar unidade por CNPJ: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Erro ao buscar unidade por CNPJ:", error);
      throw error;
    }
  }

  /**
   * Cria nova unidade
   */
  async criarUnidade(
    unidade: Omit<UnidadeFranqueada, "id" | "created_at" | "updated_at">
  ): Promise<UnidadeFranqueada> {
    try {
      if (!unidade.codigo_unidade || !unidade.nome_franqueado) {
        throw new Error(
          "Código da unidade e nome do franqueado são obrigatórios"
        );
      }
      const unidadeExistente = await this.buscarUnidadePorCodigo(
        unidade.codigo_unidade
      );
      if (unidadeExistente) {
        throw new Error("Já existe uma unidade com este código");
      }
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .insert(unidade)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao criar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Erro ao criar unidade:", error);
      throw error;
    }
  }

  /**
   * Atualiza unidade existente
   */
  async atualizarUnidade(
    id: string,
    dadosAtualizacao: Partial<UnidadeFranqueada>
  ): Promise<UnidadeFranqueada> {
    try {
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .update(dadosAtualizacao)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar unidade: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error("Erro ao atualizar unidade:", error);
      throw error;
    }
  }

  /**
   * Remove unidade (soft delete - muda status para fechada)
   */
  async removerUnidade(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("unidades_franqueadas")
        .update({ status_unidade: "fechada" })
        .eq("id", id);

      if (error) {
        throw new Error(`Erro ao remover unidade: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro ao remover unidade:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas das unidades
   */
  async buscarEstatisticasUnidades() {
    try {
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select("status_unidade, estado, franqueado_principal");

      if (error) {
        throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
      }

      const stats = {
        total: data?.length || 0,
        por_status: {} as Record<string, number>,
        por_estado: {} as Record<string, number>,
        franqueados_principais: 0,
        franqueados_secundarios: 0,
      };

      data?.forEach((unidade) => {
        stats.por_status[unidade.status_unidade] =
          (stats.por_status[unidade.status_unidade] || 0) + 1;
        if (unidade.estado) {
          stats.por_estado[unidade.estado] =
            (stats.por_estado[unidade.estado] || 0) + 1;
        }
        if (unidade.franqueado_principal) {
          stats.franqueados_principais++;
        } else {
          stats.franqueados_secundarios++;
        }
      });

      return stats;
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      throw error;
    }
  }
}
