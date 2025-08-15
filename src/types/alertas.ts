export interface Alerta {
  id: string; // uuid
  cnpj_unidade?: string | null;
  tipo_alerta: string;
  titulo: string;
  descricao: string;
  nivel_urgencia: "baixa" | "media" | "alta" | "critica";
  resolvido: boolean;
  data_criacao?: string | null; // timestamp com tz (ISO string)
  data_resolucao?: string | null;
  created_at?: string | null;
}
