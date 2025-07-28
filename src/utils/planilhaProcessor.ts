/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { CobrancaFranqueado } from "../types/cobranca";

/**
 * Processa arquivo Excel (.xlsx) e extrai dados de cobrança
 */
export function processarPlanilhaExcel(
  arquivo: File
): Promise<CobrancaFranqueado[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });

        // Pega a primeira planilha
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Converte para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        // Processa os dados
        const dadosProcessados = processarDadosJson(jsonData as any[][]);
        resolve(dadosProcessados);
      } catch (error) {
        reject(new Error(`Erro ao processar planilha Excel: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(arquivo);
  });
}

/**
 * Processa arquivo XML e extrai dados de cobrança
 */
export function processarPlanilhaXML(
  arquivo: File
): Promise<CobrancaFranqueado[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // Processa o XML (estrutura pode variar)
        const dadosProcessados = processarDadosXML(xmlDoc);
        resolve(dadosProcessados);
      } catch (error) {
        reject(new Error(`Erro ao processar planilha XML: ${error}`));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(arquivo);
  });
}

/**
 * Processa dados JSON extraídos da planilha
 */
function processarDadosJson(jsonData: any[][]): CobrancaFranqueado[] {
  if (jsonData.length < 3) {
    throw new Error(
      "Planilha deve ter pelo menos duas linhas de cabeçalho e uma de dados"
    );
  }

  // Segunda linha são os cabeçalhos
  const cabecalhos = jsonData[1].map((h: string) =>
    h?.toString().toUpperCase().trim()
  );

  // Mapeia índices das colunas importantes
  const indices = {
    clienteNome: encontrarIndiceColuna(cabecalhos, [
      "UNIDADE_NOME",
      "UNIDADE NOME",
    ]),
    clienteCodigo: encontrarIndiceColuna(cabecalhos, [
      "ID_DO_CLIENTE",
      "ID DO CLIENTE",
    ]),
    cnpj: encontrarIndiceColuna(cabecalhos, [
      "CNPJ",
      "CNPJ_CLIENTE",
      "CNPJ CLIENTE",
    ]),
    cpf: encontrarIndiceColuna(cabecalhos, [
      "CPF",
      "CPF_CLIENTE",
      "CPF CLIENTE",
    ]),
    tipo: encontrarIndiceColuna(cabecalhos, [
      "TIPO",
      "TIPO_COBRANCA",
      "CATEGORIA",
    ]),
    valor: encontrarIndiceColuna(cabecalhos, ["VALOR", "VALOR_ORIGINAL"]),
    valorRecebido: encontrarIndiceColuna(cabecalhos, [
      "VALOR_RECEBIDO",
      "VALOR RECEBIDO",
    ]),
    vencimento: encontrarIndiceColuna(cabecalhos, [
      "DATA_VENCIMENTO",
      "VENCIMENTO",
      "DATA VENCIMENTO",
    ]),
    vencimentoOriginal: encontrarIndiceColuna(cabecalhos, [
      "DATA_VENCIMENTO_ORIGINAL",
      "VENCIMENTO ORIGINAL",
      "DATA VENCIMENTO ORIGINAL",
    ]),
    descricao: encontrarIndiceColuna(cabecalhos, [
      "DESCRICAO",
      "OBSERVACAO",
      "OBS",
    ]),
    email: encontrarIndiceColuna(cabecalhos, [
      "EMAIL",
      "EMAIL_COBRANCA",
      "E_MAIL",
    ]),
    status: encontrarIndiceColuna(cabecalhos, [
      "STATUS",
      "SITUACAO",
      "SIT",
      "Situação",
    ]),
  };

  // Valida se encontrou todas as colunas necessárias
  const colunasObrigatorias = ["clienteNome", "cnpj", "valor", "vencimento"];
  for (const coluna of colunasObrigatorias) {
    if (indices[coluna as keyof typeof indices] === -1) {
      throw new Error(
        `Coluna obrigatória não encontrada: ${coluna.toUpperCase()}`
      );
    }
  }

  // Processa as linhas de dados
  const dados: CobrancaFranqueado[] = [];

  //Começa o loop a partir da primeira linha de dados reais (índice 2)
  for (let i = 2; i < jsonData.length; i++) {
    const linha = jsonData[i];

    // Pula linhas vazias
    if (!linha || linha.every((cell) => !cell)) continue;

    try {
      // Processa CNPJ e CPF com tratamento de formatação do Excel
      const valorCNPJ = indices.cnpj !== -1 ? String(linha[indices.cnpj] || "").trim() : "";
      const valorCPF = indices.cpf !== -1 ? String(linha[indices.cpf] || "").trim() : "";

      // Limpa formatação do Excel para CNPJ
      const cnpjLimpo = limparFormatacaoDocumento(valorCNPJ);
      const cpfLimpo = limparFormatacaoDocumento(valorCPF);

      // Decide qual documento usar
      let documentoFinal = "";
      
      // Se CNPJ existe e não é zero, usa CNPJ
      if (cnpjLimpo && cnpjLimpo !== "0" && cnpjLimpo.length === 14) {
        documentoFinal = cnpjLimpo;
      }
      // Senão, se CPF existe e é válido, usa CPF
      else if (cpfLimpo && cpfLimpo !== "0" && cpfLimpo.length === 11) {
        documentoFinal = cpfLimpo;
      }
      // Se nenhum documento válido, tenta usar o que tiver
      else if (cnpjLimpo && cnpjLimpo !== "0") {
        documentoFinal = cnpjLimpo;
      }
      else if (cpfLimpo && cpfLimpo !== "0") {
        documentoFinal = cpfLimpo;
      }

      // Valida se tem documento válido
      if (!documentoFinal || documentoFinal === "0") {
        console.warn(
          `Linha ${i + 1} ignorada: Nenhum documento válido encontrado (CNPJ: "${valorCNPJ}", CPF: "${valorCPF}").`
        );
        continue;
      }

      // Pega os valores brutos da Planilha
      const valorOriginalStr = String(linha[indices.valor] || "0");
      const valorRecebidoStr = String(linha[indices.valorRecebido] || "0");

      // Limpa formatação do Excel para valores monetários
      const valorOriginal = limparFormatacaoValor(valorOriginalStr);
      const valorRecebido = limparFormatacaoValor(valorRecebidoStr);

      // Se a validação passou cria o registro
      const registro: CobrancaFranqueado = {
        cliente: String(linha[indices.clienteNome] || "").trim(),
        cliente_codigo: String(linha[indices.clienteCodigo] || "").trim(),
        cnpj: documentoFinal,
        tipo_cobranca:
          indices.tipo !== -1
            ? String(linha[indices.tipo] || "royalty").trim()
            : "royalty",
        valor_original: valorOriginal > 0 ? valorOriginal : 0,
        valor_recebido: valorRecebido > 0 ? valorRecebido : 0,
        data_vencimento: linha[indices.vencimento],
        data_vencimento_original:
          linha[indices.vencimentoOriginal] || linha[indices.vencimento],
        descricao:
          indices.descricao !== -1
            ? String(linha[indices.descricao] || "").trim()
            : "",
        email_cobranca:
          indices.email !== -1 ? String(linha[indices.email] || "").trim() : "",
        status:
          indices.status !== -1
            ? String(linha[indices.status] || "pendente").trim()
            : "pendente",
      };

      // Valida outros dados obrigatórios
      if (
        !registro.cliente ||
        !registro.data_vencimento ||
        registro.valor_original <= 0
      ) {
        console.warn(
          `Linha ${
            i + 1
          } ignorada por dados obrigatórios faltando (Cliente, Vencimento ou Valor Original).`
        );
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
function processarDadosXML(xmlDoc: Document): CobrancaFranqueado[] {
  const dados: CobrancaFranqueado[] = [];

  // Procura por elementos que possam conter os dados
  const registros = xmlDoc.querySelectorAll("registro, row, item, cobranca");

  registros.forEach((registro, index) => {
    try {
      const cliente = obterTextoXML(registro, [
        "cliente",
        "cliente_de_cobranca",
        "nome",
        "razao_social",
      ]);
      const cnpj = obterTextoXML(registro, ["cnpj", "documento"]);
      const tipo =
        obterTextoXML(registro, ["tipo", "tipo_cobranca"]) || "royalty";
      const valor = parseFloat(
        obterTextoXML(registro, ["valor", "valor_original"]) || "0"
      );
      const vencimento = obterTextoXML(registro, [
        "vencimento",
        "data_vencimento",
      ]);
      const vencimentoOriginal =
        obterTextoXML(registro, [
          "vencimento_original",
          "data_vencimento_original",
        ]) || vencimento;
      const descricao = obterTextoXML(registro, ["descricao", "observacao"]);
      const email = obterTextoXML(registro, ["email", "email_cobranca"]);

      if (cliente && cnpj && vencimento && valor > 0) {
        dados.push({
          cliente: cliente,
          cnpj: cnpj,
          tipo_cobranca: tipo,
          valor_original: valor,
          data_vencimento: vencimento,
          data_vencimento_original: vencimentoOriginal,
          descricao: descricao,
          email_cobranca: email,
          status: "pendente", // Status teste
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
function encontrarIndiceColuna(
  cabecalhos: string[],
  nomesPossiveis: string[]
): number {
  for (const nome of nomesPossiveis) {
    const indice = cabecalhos.findIndex((h) => h.includes(nome));
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
    if (child) return child.textContent?.trim() || "";
  }
  return "";
}

/**
 * Valida formato de data
 */
export function validarFormatoData(data: string): boolean {
  const formatosValidos = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
  ];

  return formatosValidos.some((formato) => formato.test(data));
}

/**
 * Normaliza data para formato ISO
 */
export function normalizarData(data: string): string {
  if (!data) return "";

  let dataObj: Date;

  if (typeof data === "string") {
    // Se ainda for uma string, tenta converter (fallback)
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return data;
    }
    // Converte DD/MM/YYYY ou DD-MM-YYYY para YYYY-MM-DD
    const match = data.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (match) {
      const [, dia, mes, ano] = match;
      return `${ano}-${mes}-${dia}`;
    }
    dataObj = new Date(data);
  } else {
    dataObj = data;
  }
  // Ajusta para o fuso horário local para evitar problemas de UTC
  const offset = dataObj.getTimezoneOffset();
  dataObj = new Date(dataObj.getTime() - offset * 60 * 1000);

  // Retorna a data no formato ISO
  return dataObj.toISOString().split("T")[0];
}

/**
 * Gera referência única para a linha
 */
export function gerarReferenciaLinha(dados: CobrancaFranqueado): string {
  const cnpjLimpo = dados.cnpj.replace(/\D/g, "");
  const dataFormatada = normalizarData(dados.data_vencimento);
  const valorFormatado = dados.valor_original.toFixed(2);

  return `${cnpjLimpo}_${dados.tipo_cobranca}_${dataFormatada}_${valorFormatado}`;
}

/**
 * Limpa formatação de documento (CNPJ/CPF) vinda do Excel
 */
function limparFormatacaoDocumento(valor: string): string {
  if (!valor) return "";
  
  // Remove todos os caracteres não numéricos
  let limpo = valor.toString().replace(/\D/g, "");
  
  // Remove zeros à esquerda desnecessários, mas mantém pelo menos um dígito
  limpo = limpo.replace(/^0+/, "") || "0";
  
  return limpo;
}

/**
 * Limpa formatação de valor monetário vinda do Excel
 */
function limparFormatacaoValor(valor: string): number {
  if (!valor) return 0;
  
  // Converte para string se não for
  const valorStr = valor.toString();
  
  // Remove espaços
  let limpo = valorStr.trim();
  
  // Remove símbolos de moeda (R$, $, etc.)
  limpo = limpo.replace(/[R$\s]/g, "");
  
  // Se tem ponto e vírgula, assume formato brasileiro (1.234,56)
  if (limpo.includes(".") && limpo.includes(",")) {
    // Remove pontos (separadores de milhares) e troca vírgula por ponto
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }
  // Se tem apenas vírgula, assume que é decimal brasileiro (1234,56)
  else if (limpo.includes(",") && !limpo.includes(".")) {
    limpo = limpo.replace(",", ".");
  }
  // Se tem apenas ponto, pode ser decimal americano (1234.56) ou separador de milhares (1.234)
  else if (limpo.includes(".") && !limpo.includes(",")) {
    // Se tem mais de um ponto, remove todos exceto o último (separadores de milhares)
    const pontos = limpo.split(".");
    if (pontos.length > 2) {
      limpo = pontos.slice(0, -1).join("") + "." + pontos[pontos.length - 1];
    }
    // Se o último segmento tem mais de 2 dígitos, provavelmente é separador de milhares
    else if (pontos.length === 2 && pontos[1].length > 2) {
      limpo = limpo.replace(".", "");
    }
  }
  
  // Converte para número
  const numero = parseFloat(limpo);
  
  // Retorna 0 se não conseguiu converter
  return isNaN(numero) ? 0 : numero;
}