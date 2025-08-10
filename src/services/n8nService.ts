/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Serviço central para chamadas ao n8n via webhooks.
 * Mantém um contrato simples e com timeout controlado.
 */
export class N8nService {
  private defaultTimeoutMs = 15000; // 15s padrão

  constructor(opts?: { timeoutMs?: number }) {
    if (opts?.timeoutMs) this.defaultTimeoutMs = opts.timeoutMs;
  }

  private async postJson<T>(url: string, body: any, timeoutMs?: number): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.defaultTimeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`n8n HTTP ${resp.status}: ${text}`);
      }
      return (await resp.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Envia mensagem de WhatsApp via n8n.
   * Espera que o workflow aceite: { number, text, instanceName?, metadata? }
   * Retorna objeto livre, mas garante pelo menos { success, messageId? }.
   */
  async enviarWhatsApp(payload: {
    number: string;
    text: string;
    instanceName?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; messageId?: string; raw?: any }>{
    const url = (import.meta as any).env.VITE_N8N_WHATSAPP_WEBHOOK_URL as string | undefined;
    if (!url) throw new Error("VITE_N8N_WHATSAPP_WEBHOOK_URL não configurada");
    const data = await this.postJson<any>(url, payload);
    return {
      success: Boolean(data?.success ?? true),
      messageId: data?.messageId || data?.id || data?.key?.id,
      raw: data,
    };
  }

  /**
   * Envia e-mail via n8n.
   * Espera: { destinatario, assunto, corpo_html, corpo_texto, nome_destinatario?, anexos?, remetente_*?, metadata? }
   */
  async enviarEmail(payload: {
    destinatario: string;
    assunto: string;
    corpo_html: string;
    corpo_texto: string;
    nome_destinatario?: string;
    remetente_nome?: string;
    remetente_email?: string;
    anexos?: { nome: string; conteudo: string; tipo: string }[];
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; messageId?: string; raw?: any }>{
    const url = (import.meta as any).env.VITE_N8N_EMAIL_WEBHOOK_URL as string | undefined;
    if (!url) throw new Error("VITE_N8N_EMAIL_WEBHOOK_URL não configurada");
    const data = await this.postJson<any>(url, payload);
    return {
      success: Boolean(data?.success ?? true),
      messageId: data?.messageId || data?.id,
      raw: data,
    };
  }
}

export const n8nService = new N8nService();
