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

  /**
   * Trata e valida um número de telefone para envio via WhatsApp.
   * Remove caracteres especiais, adiciona código do país e valida se é celular.
   */
  static tratarTelefone(telefone: string | null | undefined): string {
    // Verificar se telefone é nulo, undefined ou string vazia
    if (!telefone || telefone.trim() === "") {
      throw new Error("Número de telefone não informado");
    }

    // Verificar se é uma mensagem de "não possui"
    const telefoneStr = telefone.toString().toLowerCase().trim();
    if (
      telefoneStr === "não possui" ||
      telefoneStr === "nao possui" ||
      telefoneStr === "sem telefone"
    ) {
      throw new Error("Número de telefone não disponível");
    }

    // Remover todos os caracteres que não são números
    const numeroLimpo = telefone.toString().replace(/\D/g, "");

    // Verificar se sobrou algum número
    if (!numeroLimpo) {
      throw new Error(
        "Número de telefone inválido - apenas caracteres especiais"
      );
    }

    // Se já tem o código do país (55), validar
    if (numeroLimpo.startsWith("55")) {
      const semCodigoPais = numeroLimpo.substring(2);

      // Validar se tem 10 ou 11 dígitos após o código do país
      if (semCodigoPais.length === 10 || semCodigoPais.length === 11) {
        // Se tem 11 dígitos, deve começar com 9 (celular)
        if (semCodigoPais.length === 11 && !semCodigoPais.startsWith("9")) {
          throw new Error("Número de celular inválido - deve começar com 9");
        }
        // Se tem 10 dígitos, é telefone fixo - não pode enviar WhatsApp
        if (semCodigoPais.length === 10) {
          throw new Error("Não é possível enviar WhatsApp para telefone fixo");
        }
        return numeroLimpo;
      } else {
        throw new Error(
          "Número de telefone inválido - deve ter 10 ou 11 dígitos após código do país"
        );
      }
    }

    // Se não tem código do país, adicionar 55  
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
      // Se tem 11 dígitos, o terceiro dígito deve ser 9 (celular)
      if (numeroLimpo.length === 11 && numeroLimpo.charAt(2) !== "9") {
        throw new Error("Número de celular inválido - deve começar com 9");
      }
      // Se tem 10 dígitos, é telefone fixo - não pode enviar WhatsApp
      if (numeroLimpo.length === 10) {
        throw new Error("Não é possível enviar WhatsApp para telefone fixo");
      }
      return "55" + numeroLimpo;
    }

    throw new Error("Número de telefone inválido - formato não reconhecido");
  }

  private async postJson<T>(
    url: string,
    body: any,
    timeoutMs?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs ?? this.defaultTimeoutMs
    );
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
   * Automaticamente valida e trata o número de telefone antes do envio.
   * Espera que o workflow aceite: { number, text, instanceName?, metadata? }
   * Retorna objeto livre, mas garante pelo menos { success, messageId? }.
   */
  async enviarWhatsApp(payload: {
    number: string;
    text: string;
    instanceName?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; messageId?: string; raw?: any }> {
    const url = (import.meta as any).env.VITE_N8N_WHATSAPP_WEBHOOK_URL as
      | string
      | undefined;
    if (!url) throw new Error("VITE_N8N_WHATSAPP_WEBHOOK_URL não configurada");

    // Validar e tratar o número antes do envio
    const numeroTratado = N8nService.tratarTelefone(payload.number);

    const payloadTratado = {
      ...payload,
      number: numeroTratado,
    };

    const data = await this.postJson<any>(url, payloadTratado);
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
  }): Promise<{ success: boolean; messageId?: string; raw?: any }> {
    const url = (import.meta as any).env.VITE_N8N_EMAIL_WEBHOOK_URL as
      | string
      | undefined;
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
