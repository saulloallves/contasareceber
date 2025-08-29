export function formatarCNPJCPF(numero: string): string {
  if (!numero) return '';

  // Remove qualquer caractere que não seja um dígito
  const numeroLimpo = numero.replace(/\D/g, '');

  if (numeroLimpo.length === 11) {
    // Formata como CPF: 000.000.000-00
    return numeroLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } 
  
  if (numeroLimpo.length === 14) {
    // Formata como CNPJ: 00.000.000/0000-00
    return numeroLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  // Se não for nem CPF nem CNPJ, retorna o número original
  return numero;
}

  export function formatarMoeda(valor: number): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  }

  export function formatarData(data: string): string {
    if (!data) {
      return "N/A";
    }
    // A string de data (ex: "2024-04-15") é interpretada como UTC.
    // Adicionamos 'T00:00:00' para garantir que a hora seja meia-noite,
    // O new Date() vai ajustar para o fuso local.
    // Para corrigir isso, criamos a data e depois adicionamos o offset do fuso de volta.
    const dataObj = new Date(`${data}T00:00:00`);
    const offset = dataObj.getTimezoneOffset(); // Pega a diferença em minutos (ex: 180 para UTC-3)
    const dataCorrigida = new Date(dataObj.getTime() + offset * 60 * 1000);

    // Agora formata a data já corrigida
    return dataCorrigida.toLocaleDateString("pt-BR");
  };

  export function formatarCEP(cep: string): string {
    if (!cep) return '';
    
    // Remove qualquer caractere que não seja um dígito
    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length === 8) {
      // Formata como CEP: 00000-000
      return cepLimpo.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    
    // Se não tiver 8 dígitos, retorna o valor original
    return cep;
  }

  // Interface para resposta da API do Brasil API
  interface BrasilAPICEPResponse {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    service: string;
  }

  export async function buscarCEP(cep: string): Promise<BrasilAPICEPResponse | null> {
    try {
      // Remove qualquer formatação do CEP
      const cepLimpo = cep.replace(/\D/g, '');
      
      if (cepLimpo.length !== 8) {
        throw new Error('CEP deve conter exatamente 8 dígitos');
      }

      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
      
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data: BrasilAPICEPResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return null;
    }
  }