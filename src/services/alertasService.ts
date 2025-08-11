import { supabase } from "../lib/supabaseClient";
import { Alerta } from "../types/alertas"; // Criaremos este tipo a seguir

export const alertasService = {
  async getAlertasAtivos(): Promise<Alerta[]> {
    const { data, error } = await supabase
      .from("alertas_sistema")
      .select(
        `
        id,
        cnpj_unidade,
        tipo_alerta,
        titulo,
        descricao,
        nivel_urgencia,
        resolvido,
        data_criacao,
        data_resolucao
      `
      )
      .eq("resolvido", false)
      .order("data_criacao", { ascending: false });

    if (error) {
      console.error("Erro ao buscar alertas:", error);
      throw new Error("Não foi possível buscar os alertas do sistema.");
    }

    return data as Alerta[];
  },

  async marcarComoResolvido(alertaId: string): Promise<void> {
    const { error } = await supabase
      .from("alertas_sistema")
      .update({
        resolvido: true,
        data_resolucao: new Date().toISOString(),
      })
      .eq("id", alertaId);

    if (error) {
      console.error("Erro ao marcar alerta como resolvido:", error);
      throw new Error("Não foi possível atualizar o status do alerta.");
    }
  },
};
