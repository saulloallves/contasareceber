import axios from "axios";

// Configurações da Evolution API via variáveis de ambiente
const API_URL = import.meta.env.VITE_EVOLUTION_API_URL;
const API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;

if (!API_URL || !API_KEY) {
  console.error(
    "As variáveis de ambiente da Evolution API não estão configuradas."
  );
}

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    apikey: API_KEY,
    "Content-Type": "application/json",
  },
});

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
   * Envia uma mensagem de texto simples usando a Evolution API.
   * @param payload - Os dados da mensagem a ser enviada.
   * @returns A resposta da API.
   */
  async sendTextMessage(payload: SendTextMessagePayload) {
    try {
      // Formata o número com prefixo 55
      const formattedNumber = formatPhoneNumber(payload.number);

      console.log(
        `Enviando WhatsApp para: ${formattedNumber} (original: ${payload.number})`
      );

      const endpoint = `/message/sendText/${payload.instanceName}`;

      const requestBody = {
        number: formattedNumber,
        text: payload.text,
      };

      const response = await apiClient.post(endpoint, requestBody);

      console.log("Resposta da Evolution API:", response.data);

      return response.data;
    } catch (error) {
      console.error("Erro ao enviar mensagem pela Evolution API:", error);
      // Adiciona um log mais detalhado do erro da API, se disponível
      if (axios.isAxiosError(error) && error.response) {
        console.error("Detalhes do erro da API:", error.response.data);
      }
      throw error;
    }
  }
}

export const evolutionApiService = new EvolutionApiService();
