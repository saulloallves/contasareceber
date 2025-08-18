import { supabase } from "./databaseService";
import { UnidadeFranqueada, FiltrosUnidades } from "../types/unidades";

type Franqueado = {
  id: string;
  nome_completo?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
};

type Vinculo = {
  ativo?: boolean;
  tipo_vinculo?: string | null;
  franqueado_id?: string;
  franqueados?: Franqueado | null;
};

type UnidadeApi = UnidadeFranqueada & {
  franqueado_unidades?: Vinculo[] | null;
};

export class UnidadesService {
  private mapearFranqueadoTopLevel(u: UnidadeApi) {
    try {
      const vinculos = (u?.franqueado_unidades || []) as Vinculo[];
      // prioriza vínculo ativo; se não houver, pega o primeiro
      const principal =
        vinculos.find((v) => v?.ativo !== false) || vinculos[0] || null;
      const fr = principal?.franqueados || null;
      if (fr) {
        u.nome_franqueado = fr.nome_completo ?? u.nome_franqueado;
        u.email_franqueado = fr.email ?? u.email_franqueado;
        u.telefone_franqueado = fr.telefone ?? u.telefone_franqueado;
        // Preenche cidade/estado da unidade se ausentes com dados do franqueado
        if (!u.cidade && fr.cidade) u.cidade = fr.cidade;
        if (!u.estado && (fr.uf || fr.estado)) u.estado = fr.uf || fr.estado;
      }
    } catch {
      // ignora mapeamento se estrutura não estiver presente
    }
    return u;
  }
  
  /**
   * Busca unidade por ID com relacionamentos e mapeia dados do franqueado
   */
  async buscarUnidadePorId(id: string): Promise<UnidadeFranqueada | null> {
    try {
      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades!left (
            ativo,
            tipo_vinculo,
            franqueado_id,
            franqueados!left (
              id, nome_completo, email, telefone, cidade, estado, uf
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Erro ao buscar unidade por ID: ${error.message}`);
      }

      return data ? (this.mapearFranqueadoTopLevel(data as UnidadeApi) as UnidadeFranqueada) : null;
    } catch (error) {
      console.error("Erro ao buscar unidade por ID:", error);
      throw error;
    }
  }
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
          franqueado_unidades!left (
            ativo,
            tipo_vinculo,
            franqueado_id,
            franqueados!left (
              id, nome_completo, email, telefone, cidade, estado, uf
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
      const lista = (data as UnidadeApi[] | null)?.map((u) =>
        this.mapearFranqueadoTopLevel(u)
      ) || [];
  return lista;
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
          franqueado_unidades!left (
            ativo,
            tipo_vinculo,
            franqueado_id,
            franqueados!left (
              id, nome_completo, email, telefone, cidade, estado, uf
            )
          )
        `
        )
        .eq("codigo_unidade", codigo)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new Error(`Erro ao buscar unidade: ${error.message}`);
      }
  return data ? (this.mapearFranqueadoTopLevel(data as UnidadeApi) as UnidadeFranqueada) : data;
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
      // Proteção: se o CNPJ vier vazio/"0"/inválido (caso de cobranças por CPF), não consulta
      if (!cnpj) return null;
      const cnpjLimpo = cnpj.replace(/\D/g, "");
      if (!cnpjLimpo || cnpjLimpo === "0") {
        return null;
      }
  const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades!left (
            ativo,
            tipo_vinculo,
            franqueado_id,
            franqueados!left (
              id, nome_completo, email, telefone, cidade, estado, uf
            )
          )
        `
        )
        .eq("codigo_interno", cnpjLimpo)
        .maybeSingle();

      if (error) {
        throw new Error(`Erro ao buscar unidade por CNPJ: ${error.message}`);
      }
      // Fallback: caso não encontre por CNPJ limpo, tenta com o CNPJ no formato original (com máscara)
  let resultado = data as UnidadeApi | null;
  if (!resultado) {
        const alt = await supabase
          .from("unidades_franqueadas")
          .select(
            `
            *,
            franqueado_unidades (
              ativo,
              tipo_vinculo,
              franqueado_id,
              franqueados (
                id, nome_completo, email, telefone, cidade, estado, uf
              )
            )
          `
          )
          .eq("codigo_interno", cnpj)
          .maybeSingle();
        if (!alt.error && alt.data) {
          resultado = alt.data as UnidadeApi;
        }
      }
      return resultado ? (this.mapearFranqueadoTopLevel(resultado as UnidadeApi) as UnidadeFranqueada) : null;
    } catch (error) {
      console.error("Erro ao buscar unidade por CNPJ:", error);
      throw error;
    }
  }

  /**
   * Busca múltiplas unidades por uma lista de CNPJs e retorna um mapa cnpj->unidade
   */
  async buscarUnidadesPorCnpjs(
    cnpjs: string[]
  ): Promise<Record<string, UnidadeFranqueada>> {
    try {
      type UnidadeComCnpj = UnidadeFranqueada & { codigo_interno?: string };
  const limpos = Array.from(
        new Set(
          (cnpjs || [])
            .filter(Boolean)
            .map((c) => c.replace(/\D/g, ""))
            .filter((c) => c.length > 0)
        )
      );
  const originais = Array.from(new Set((cnpjs || []).filter(Boolean)));
  const candidatos = Array.from(new Set([...limpos, ...originais]));

  if (candidatos.length === 0) return {};

      const { data, error } = await supabase
        .from("unidades_franqueadas")
        .select(
          `
          *,
          franqueado_unidades (
            ativo,
            tipo_vinculo,
            franqueado_id,
            franqueados (
              id, nome_completo, email, telefone, cidade, estado, uf
            )
          )
        `
        )
  .in("codigo_interno", candidatos);

      if (error) {
        throw new Error(`Erro ao buscar unidades por CNPJs: ${error.message}`);
      }

      const mapa: Record<string, UnidadeFranqueada> = {};
      (data as (UnidadeComCnpj & UnidadeApi)[] | null)?.forEach((ud) => {
        const u = this.mapearFranqueadoTopLevel(ud as UnidadeApi);
        const chaveRaw = u && (u as UnidadeComCnpj).codigo_interno;
        const chave = chaveRaw ? chaveRaw.replace(/\D/g, "") : undefined;
        if (chave) {
          mapa[chave] = u as UnidadeFranqueada;
        }
      });
      return mapa;
    } catch (error) {
      console.error("Erro ao buscar unidades por CNPJs:", error);
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