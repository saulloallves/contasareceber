// Stub simples para desenvolvimento/local. Substitua por implementação real quando disponível.
import type { EnvioMensagem } from '../types/cobranca';

export type WhatsAppConfig = {
  token: string;
  phone_number_id: string;
};

export class WhatsAppService {
  constructor(config: WhatsAppConfig) {
    // evita warning de arg não usado no stub
    void config;
  }

  // Retorna lista vazia por padrão. Ajuste para chamar sua API quando necessário.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async buscarHistoricoEnvios<TFiltros extends Record<string, unknown>>(_filtros: TFiltros): Promise<EnvioMensagem[]> {
    return [];
  }
}
