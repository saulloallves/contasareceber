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