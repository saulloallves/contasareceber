/* Utilitário mínimo para referência de linhas em planilhas.
   Caso já exista uma implementação em outro lugar, ajuste os imports.
*/
import type { CobrancaFranqueado } from "../types/cobranca";

export function gerarReferenciaLinha(dados: Partial<CobrancaFranqueado>): string {
  // Gera uma referência estável combinando CNPJ + vencimento + valor original
  // Ajuste conforme a regra de negócio original.
  const cnpj = (dados.cnpj || "").replace(/\D/g, "");
  const venc = dados.data_vencimento || "";
  const valor = Number(dados.valor_original || 0).toFixed(2);
  return `${cnpj}|${venc}|${valor}`;
}
