import { supabase } from "../lib/supabaseClient";
import { Alerta } from "../types/alertas"; // Criaremos este tipo a seguir

export const alertasService = {
  async getAlertasAtivos(): Promise<Alerta[]> {
    const { data, error } = await supabase
      .from("alertas_sistema")
      .select(
        `
        id,
        tipo_alerta,
        titulo_id,
        descricao,
        nivel_urgencia,
        status,
        data_criacao,
        cobrancas_franqueados (
          cliente,
          valor_atualizado
        )
      `
      )
      .in("status", ["novo", "em_andamento"])
      .order("data_criacao", { ascending: false });

    if (error) {
      console.error("Erro ao buscar alertas:", error);
      throw new Error("Não foi possível buscar os alertas do sistema.");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
      ...item,
      cobranca: item.cobrancas_franqueados,
    })) as Alerta[];
  },

  async marcarComoResolvido(alertaId: number, userId: string): Promise<void> {
    const { error } = await supabase
      .from("alertas_sistema")
      .update({
        status: "resolvido",
        resolvido_por_id: userId,
        data_resolucao: new Date().toISOString(),
      })
      .eq("id", alertaId);

    if (error) {
      console.error("Erro ao marcar alerta como resolvido:", error);
      throw new Error("Não foi possível atualizar o status do alerta.");
    }
  },
};
