/**
 * Gera um hash único para identificar um título baseado em CNPJ, valor e data de vencimento
 */
export async function gerarHashTitulo(cnpj: string, valor: number, dataVencimento: string): Promise<string> {
  // Remove caracteres especiais do CNPJ
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  
  // Normaliza o valor para 2 casas decimais
  const valorNormalizado = Number(valor).toFixed(2);
  
  // Normaliza a data para formato YYYY-MM-DD
  const dataNormalizada = normalizarData(dataVencimento);
  
  // Cria a string para hash
  const stringParaHash = `${cnpjLimpo}|${valorNormalizado}|${dataNormalizada}`;
  
  // Gera o hash SHA-256 usando Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(stringParaHash);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Normaliza diferentes formatos de data para YYYY-MM-DD
 */
function normalizarData(data: string): string {
  // Remove espaços e caracteres especiais
  const dataLimpa = data.trim();
  
  // Tenta diferentes formatos de data
  const formatosData = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];
  
  for (const formato of formatosData) {
    const match = dataLimpa.match(formato);
    if (match) {
      if (formato === formatosData[0]) {
        // Já está no formato correto
        return dataLimpa;
      } else {
        // Converte DD/MM/YYYY ou DD-MM-YYYY para YYYY-MM-DD
        const [, dia, mes, ano] = match;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
    }
  }
  
  // Se não conseguiu converter, tenta usar Date
  try {
    const dateObj = new Date(dataLimpa);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  } catch (error) {
    console.error('Erro ao normalizar data:', error);
  }
  
  throw new Error(`Formato de data inválido: ${data}`);
}

/**
 * Valida se um CNPJ tem formato válido (apenas números e 14 dígitos)
 */
export function validarCNPJ(cnpj: string): boolean {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  return cnpjLimpo.length === 14;
}

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 */
export function formatarCNPJ(cnpj: string): string {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
  if (cnpjLimpo.length !== 14) return cnpj;
  
  return cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}