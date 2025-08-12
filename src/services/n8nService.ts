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
        // Se tem 10 dígitos, assumir como telefone fixo mas permitir WhatsApp
        if (semCodigoPais.length === 10) {
          console.warn("Enviando WhatsApp para número que parece ser fixo:", numeroLimpo);
        }
        // Se tem 11 dígitos, validar se é um número de celular válido
        if (semCodigoPais.length === 11) {
          // Permitir números que começam com 6, 7, 8, 9 (celulares válidos no Brasil)
          const primeiroDigito = semCodigoPais.charAt(0);
          if (!["6", "7", "8", "9"].includes(primeiroDigito)) {
            console.warn("Número de celular com formato incomum:", numeroLimpo);
          }
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
      // Se tem 10 dígitos, assumir como telefone fixo mas permitir WhatsApp
      if (numeroLimpo.length === 10) {
        console.warn("Enviando WhatsApp para número que parece ser fixo:", "55" + numeroLimpo);
      }
      // Se tem 11 dígitos, validar se é um número de celular válido
      if (numeroLimpo.length === 11) {
        // Permitir números que começam com 6, 7, 8, 9 no terceiro dígito (celulares válidos no Brasil)
        const terceiroDigito = numeroLimpo.charAt(2);
        if (!["6", "7", "8", "9"].includes(terceiroDigito)) {
          console.warn("Número de celular com formato incomum:", "55" + numeroLimpo);
        }
      }
      return "55" + numeroLimpo;
    }

    throw new Error("Número de telefone inválido - formato não reconhecido");
  }

  /**
   * Valida um endereço de email.
   * Verifica formato básico e casos especiais.
   */
  static validarEmail(email: string | null | undefined): string {
    // Verificar se email é nulo, undefined ou string vazia
    if (!email || email.trim() === "") {
      throw new Error("Endereço de email não informado");
    }

    const emailStr = email.toString().toLowerCase().trim();
    
    // Verificar se é uma mensagem de "não possui"
    if (
      emailStr === "não possui" ||
      emailStr === "nao possui" ||
      emailStr === "sem email" ||
      emailStr === "null"
    ) {
      throw new Error("Endereço de email não disponível");
    }

    // Regex básica para validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(emailStr)) {
      throw new Error("Formato de email inválido");
    }

    // Verificar domínios obviamente inválidos
    const dominiosInvalidos = ['teste.com', 'example.com', 'test.com', 'fake.com'];
    const dominio = emailStr.split('@')[1];
    
    if (dominiosInvalidos.includes(dominio)) {
      throw new Error("Domínio de email inválido para envio real");
    }

    return emailStr;
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
   * Automaticamente valida email e registra logs.
   * Espera: { destinatario, assunto, corpo_html, corpo_texto, nome_destinatario?, anexos?, remetente_*?, metadata? }
   * Retorna objeto com success, messageId e dados brutos.
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
    
    // Validar e tratar o email antes do envio
    const emailTratado = N8nService.validarEmail(payload.destinatario);
    
    // Validações adicionais
    if (!payload.assunto || payload.assunto.trim() === '') {
      throw new Error("Assunto do email é obrigatório");
    }
    
    if (!payload.corpo_html && !payload.corpo_texto) {
      throw new Error("Conteúdo do email (HTML ou texto) é obrigatório");
    }
    
    console.log("Enviando email via n8n:", {
      destinatario: emailTratado,
      assunto: payload.assunto,
      anexos: payload.anexos?.length || 0,
    });
    
    const payloadTratado = {
      ...payload,
      destinatario: emailTratado,
      // Adicionar valores padrão se não fornecidos
      remetente_nome: payload.remetente_nome || "Sistema de Cobrança",
      remetente_email: payload.remetente_email || "contato@girabot.com.br",
    };
    
    const data = await this.postJson<any>(url, payloadTratado);
    return {
      success: Boolean(data?.success ?? true),
      messageId: data?.messageId || data?.id,
      raw: data,
    };
  }
}

export const n8nService = new N8nService();
