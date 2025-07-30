import axios from "axios";

const API_URL = import.meta.env.VITE_EVOLUTION_API_URL;
const API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY;

if (!API_URL || !API_KEY) {
  console.error(
    "As variáveis de ambiente da API Evolution não estão configuradas."
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

export class EvolutionApiService {
  /**
   * Envia uma mensagem de texto simples.
   * @param payload - Os dados da mensagem a ser enviada.
   * @returns A resposta da API.
   */
  async sendTextMessage(payload: SendTextMessagePayload) {
    try {
      const endpoint = `/message/sendText/${payload.instanceName}`;
      
      // CORREÇÃO: Usando a estrutura de corpo exata que funcionou para você.
      const requestBody = {
        number: payload.number,
        text: payload.text, // Enviando 'text' diretamente, sem o 'textMessage'
      };

      const response = await apiClient.post(endpoint, requestBody);

      return response.data;
    } catch (error) {
      console.error("Erro ao enviar mensagem pela API Evolution:", error);
      // Adiciona um log mais detalhado do erro da API, se disponível
      if (axios.isAxiosError(error) && error.response) {
        console.error("Detalhes do erro da API:", error.response.data);
      }
      throw error;
    }
  }
}

export const evolutionApiService = new EvolutionApiService();
