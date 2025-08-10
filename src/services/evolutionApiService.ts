import { n8nService } from "./n8nService";

// Interface atualizada para corresponder à documentação da API
export interface SendTextMessagePayload {
  instanceName: string;
  number: string;
  text: string;
}

/**
 * Formata o número de telefone com prefixo 55 (Brasil)
 * Remove formatação e adiciona 55 se necessário
 */
function formatPhoneNumber(number: string): string {
  // Remove todos os caracteres não numéricos
  const cleanNumber = number.replace(/\D/g, "");

  // Se já tem o prefixo 55, retorna como está
  if (cleanNumber.startsWith("55") && cleanNumber.length >= 12) {
    return cleanNumber;
  }

  // Se tem 11 dígitos (DDD + 9 dígitos), adiciona 55
  if (cleanNumber.length === 11) {
    return `55${cleanNumber}`;
  }

  // Se tem 10 dígitos (DDD + 8 dígitos), adiciona 55
  if (cleanNumber.length === 10) {
    return `55${cleanNumber}`;
  }

  // Se tem 13 ou 14 dígitos e não começa com 55, assume que precisa do 55
  if (cleanNumber.length >= 10) {
    return `55${cleanNumber}`;
  }

  console.warn(`Formato de número não reconhecido: ${number}`);
  return cleanNumber;
}

export class EvolutionApiService {
  /**
   * Envia uma mensagem de texto simples delegando ao n8n.
   * Mantém a assinatura original para compatibilidade.
   */
  async sendTextMessage(payload: SendTextMessagePayload) {
    const formattedNumber = formatPhoneNumber(payload.number);
    const res = await n8nService.enviarWhatsApp({
      number: formattedNumber,
      text: payload.text,
      instanceName: payload.instanceName,
      metadata: { origem: "frontend", via: "n8n" },
    });
    return res;
  }
}

export const evolutionApiService = new EvolutionApiService();
