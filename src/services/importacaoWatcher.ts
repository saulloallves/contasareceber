/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "../lib/supabaseClient";

export type ImportacaoWatcherId = string;

export interface ImportacaoWatcherOptions {
  // Timestamp ISO para considerar eventos após esse momento
  startTime?: string;
  // Tipo de origem do sinal de conclusão. Por padrão, usa a tabela de alertas.
  origem?: "alertas" | "importacoes";
  // Identificador opcional da correlação (ex.: importacao_id retornado pelo n8n)
  correlacaoId?: string;
  // Intervalo entre verificações em milissegundos (default: 10000)
  intervaloMs?: number;
  // Callback quando a importação for detectada como concluída
  onComplete?: (payload: any) => void;
  // Callback para erros (opcional)
  onError?: (err: unknown) => void;
}

// Singleton simples que gerencia intervals por ID
class ImportacaoWatcherManager {
  private intervals = new Map<ImportacaoWatcherId, number>();

  start(options: ImportacaoWatcherOptions): ImportacaoWatcherId {
    const id: ImportacaoWatcherId = crypto.randomUUID();
    const startTime = options.startTime || new Date().toISOString();
    const origem = options.origem || "alertas";
    const intervaloMs = options.intervaloMs ?? 10000;

    const tick = async () => {
      try {
        if (origem === "alertas") {
          // Estratégia padrão: verificar alertas de tipo 'importacao_concluida'
          const query = supabase
            .from("alertas_sistema")
            .select("id, tipo_alerta, descricao, data_criacao, resolvido")
            .eq("tipo_alerta", "importacao_concluida")
            .gte("data_criacao", startTime)
            .order("data_criacao", { ascending: false })
            .limit(1);

          // Futuro: se existir correlação por ID no alerta, aplicar aqui
          const { data, error } = await query;
          if (error) throw error;

          if (data && data.length > 0) {
            // Encontrou um alerta indicando conclusão
            const payload = data[0];
            this.stop(id);
            options.onComplete?.(payload);
            return;
          }
        } else {
          // Alternativa: observar tabela 'importacoes' por status concluída
          // Observação: ajuste a coluna de status conforme seu backend/n8n
          let query = supabase
            .from("importacoes")
            .select("id, nome_arquivo, data_importacao, status, data_finalizacao")
            .gte("data_importacao", startTime)
            .order("data_importacao", { ascending: false })
            .limit(1);

          if (options.correlacaoId) {
            // Se o n8n retornar um importacao_id, você pode filtrar aqui
            query = query.eq("id", options.correlacaoId);
          }

          const { data, error } = await query;
          if (error) throw error;

          const row = data?.[0];
          if (row && (row as any).status === "concluida") {
            this.stop(id);
            options.onComplete?.(row);
            return;
          }
        }
      } catch (err) {
        console.warn("ImportacaoWatcher erro no tick:", err);
        options.onError?.(err);
      }
    };

    // Executa imediatamente e depois em intervalos
    tick();
    const intervalHandle = window.setInterval(tick, intervaloMs);
    this.intervals.set(id, intervalHandle);
    return id;
  }

  stop(id: ImportacaoWatcherId) {
    const handle = this.intervals.get(id);
    if (handle) {
      window.clearInterval(handle);
      this.intervals.delete(id);
    }
  }

  stopAll() {
    for (const handle of this.intervals.values()) {
      window.clearInterval(handle);
    }
    this.intervals.clear();
  }
}

export const ImportacaoWatcher = new ImportacaoWatcherManager();
