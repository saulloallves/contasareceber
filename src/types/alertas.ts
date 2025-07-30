export interface Alerta {
  id: number;
  tipo_alerta: string;
  titulo_id: number;
  descricao: string;
  nivel_urgencia: "baixa" | "media" | "alta";
  status: "novo" | "em_andamento" | "resolvido";
  data_criacao: string;
  cobranca?: {
    cliente: string;
    valor_atualizado: number;
  };
}
