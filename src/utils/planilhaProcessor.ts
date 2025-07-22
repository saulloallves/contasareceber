import * as XLSX from 'xlsx';
import { DadosPlanilha } from '../types/cobranca';

/**
 * Processa arquivo Excel (.xlsx) e extrai dados de cobrança
 */
export function processarPlanilhaExcel(arquivo: File): Promise<DadosPlanilha[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pega a primeira planilha
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converte para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Processa os dados
        const dadosProcessados = processarDadosJson(jsonData);
        resolve(dadosProcessados);
      } catch (error) {
        reject(new Error(`Erro ao processar planilha Excel: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(arquivo);
  });
}

/**
 * Processa arquivo XML e extrai dados de cobrança
 */
export function processarPlanilhaXML(arquivo: File): Promise<DadosPlanilha[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Processa o XML (estrutura pode variar)
        const dadosProcessados = processarDadosXML(xmlDoc);
        resolve(dadosProcessados);
      } catch (error) {
        reject(new Error(`Erro ao processar planilha XML: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(arquivo);
  });
}

/**
 * Processa dados JSON extraídos da planilha
 */
function processarDadosJson(jsonData: any[][]): DadosPlanilha[] {
  if (jsonData.length < 2) {
    throw new Error('Planilha deve ter pelo menos uma linha de cabeçalho e uma de dados');
  }
  
  // Primeira linha são os cabeçalhos
  const cabecalhos = jsonData[0].map((h: string) => h?.toString().toUpperCase().trim());
  
  // Mapeia índices das colunas importantes
  const indices = {
    cliente: encontrarIndiceColuna(cabecalhos, ['CLIENTE', 'CLIENTE_DE_COBRANCA', 'NOME', 'RAZAO_SOCIAL']),
    cnpj: encontrarIndiceColuna(cabecalhos, ['CNPJ', 'CPF_CNPJ', 'DOCUMENTO']),
    tipo: encontrarIndiceColuna(cabecalhos, ['TIPO', 'TIPO_COBRANCA', 'CATEGORIA']),
    valor: encontrarIndiceColuna(cabecalhos, ['VALOR', 'VALOR_ORIGINAL', 'VLR_ORIGINAL']),
    vencimento: encontrarIndiceColuna(cabecalhos, ['VENCIMENTO', 'DATA_VENCIMENTO', 'DT_VENCIMENTO']),
    vencimentoOriginal: encontrarIndiceColuna(cabecalhos, ['VENCIMENTO_ORIGINAL', 'DATA_VENCIMENTO_ORIGINAL']),
    descricao: encontrarIndiceColuna(cabecalhos, ['DESCRICAO', 'OBSERVACAO', 'OBS']),
    email: encontrarIndiceColuna(cabecalhos, ['EMAIL', 'EMAIL_COBRANCA', 'E_MAIL'])
  };
  
  // Valida se encontrou todas as colunas necessárias
  const colunasObrigatorias = ['cliente', 'cnpj', 'valor', 'vencimento'];
  for (const coluna of colunasObrigatorias) {
    if (indices[coluna as keyof typeof indices] === -1) {
      throw new Error(`Coluna obrigatória não encontrada: ${coluna.toUpperCase()}`);
    }
  }
  
  // Processa as linhas de dados
  const dados: DadosPlanilha[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const linha = jsonData[i];
    
    // Pula linhas vazias
    if (!linha || linha.every(cell => !cell)) continue;
    
    try {
      const registro: DadosPlanilha = {
        cliente_de_cobranca: String(linha[indices.cliente] || '').trim(),
        cnpj: String(linha[indices.cnpj] || '').trim(),
        tipo_cobranca: indices.tipo !== -1 ? String(linha[indices.tipo] || 'royalty').trim() : 'royalty',
        valor_original: parseFloat(String(linha[indices.valor] || '0').replace(',', '.')),
        data_vencimento: String(linha[indices.vencimento] || '').trim(),
        data_vencimento_original: indices.vencimentoOriginal !== -1 
          ? String(linha[indices.vencimentoOriginal] || '').trim() 
          : String(linha[indices.vencimento] || '').trim(),
        descricao: indices.descricao !== -1 ? String(linha[indices.descricao] || '').trim() : '',
        email_cobranca: indices.email !== -1 ? String(linha[indices.email] || '').trim() : ''
      };
      
      // Valida dados obrigatórios
      if (!registro.cliente_de_cobranca || !registro.cnpj || !registro.data_vencimento || registro.valor_original <= 0) {
        console.warn(`Linha ${i + 1} ignorada por dados incompletos:`, registro);
        continue;
      }
      
      // Valida formato de CNPJ
      const cnpjLimpo = registro.cnpj.replace(/\D/g, '');
      if (cnpjLimpo.length !== 14) {
        console.warn(`Linha ${i + 1} ignorada por CNPJ inválido: ${registro.cnpj}`);
        continue;
      }
      
      dados.push(registro);
    } catch (error) {
      console.warn(`Erro ao processar linha ${i + 1}:`, error);
    }
  }
  
  return dados;
}

/**
 * Processa dados XML (implementação básica)
 */
function processarDadosXML(xmlDoc: Document): DadosPlanilha[] {
  const dados: DadosPlanilha[] = [];
  
  // Procura por elementos que possam conter os dados
  const registros = xmlDoc.querySelectorAll('registro, row, item, cobranca');
  
  registros.forEach((registro, index) => {
    try {
      const cliente = obterTextoXML(registro, ['cliente', 'cliente_de_cobranca', 'nome', 'razao_social']);
      const cnpj = obterTextoXML(registro, ['cnpj', 'documento']);
      const tipo = obterTextoXML(registro, ['tipo', 'tipo_cobranca']) || 'royalty';
      const valor = parseFloat(obterTextoXML(registro, ['valor', 'valor_original']) || '0');
      const vencimento = obterTextoXML(registro, ['vencimento', 'data_vencimento']);
      const vencimentoOriginal = obterTextoXML(registro, ['vencimento_original', 'data_vencimento_original']) || vencimento;
      const descricao = obterTextoXML(registro, ['descricao', 'observacao']);
      const email = obterTextoXML(registro, ['email', 'email_cobranca']);
      
      if (cliente && cnpj && vencimento && valor > 0) {
        dados.push({
          cliente_de_cobranca: cliente,
          cnpj: cnpj,
          tipo_cobranca: tipo,
          valor_original: valor,
          data_vencimento: vencimento,
          data_vencimento_original: vencimentoOriginal,
          descricao: descricao,
          email_cobranca: email
        });
      }
    } catch (error) {
      console.warn(`Erro ao processar registro XML ${index + 1}:`, error);
    }
  });
  
  return dados;
}

/**
 * Encontra o índice de uma coluna baseado em possíveis nomes
 */
function encontrarIndiceColuna(cabecalhos: string[], nomesPossiveis: string[]): number {
  for (const nome of nomesPossiveis) {
    const indice = cabecalhos.findIndex(h => h.includes(nome));
    if (indice !== -1) return indice;
  }
  return -1;
}

/**
 * Obtém texto de um elemento XML baseado em possíveis nomes de tags
 */
function obterTextoXML(elemento: Element, nomesPossiveis: string[]): string {
  for (const nome of nomesPossiveis) {
    const child = elemento.querySelector(nome);
    if (child) return child.textContent?.trim() || '';
  }
  return '';
}

/**
 * Valida formato de data
 */
export function validarFormatoData(data: string): boolean {
  const formatosValidos = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/ // DD-MM-YYYY
  ];
  
  return formatosValidos.some(formato => formato.test(data));
}

/**
 * Normaliza data para formato ISO
 */
export function normalizarData(data: string): string {
  if (!data) return '';
  
  // Se já está no formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return data;
  }
  
  // Converte DD/MM/YYYY ou DD-MM-YYYY para YYYY-MM-DD
  const match = data.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes}-${dia}`;
  }
  
  throw new Error(`Formato de data inválido: ${data}`);
}

/**
 * Gera referência única para a linha
 */
export function gerarReferenciaLinha(dados: DadosPlanilha): string {
  const cnpjLimpo = dados.cnpj.replace(/\D/g, '');
  const dataFormatada = normalizarData(dados.data_vencimento);
  const valorFormatado = dados.valor_original.toFixed(2);
  
  return `${cnpjLimpo}_${dados.tipo_cobranca}_${dataFormatada}_${valorFormatado}`;
}