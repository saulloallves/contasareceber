export interface LogAuditoria {
  id?: string;
  data_acao: string;
  usuario: string;
  usuario_id: string;
  acao: string;
  entidade_afetada: string;
  entidade_id?: string;
  detalhes: string;
  valores_envolvidos?: number;
  ip_origem?: string;
  canal_origem: string;
  dados_anteriores?: any;
  dados_novos?: any;
  nivel_risco: 'baixo' | 'medio' | 'alto';
  created_at?: string;
}

export interface FiltrosAuditoria {
  usuario?: string;
  acao?: string;
  entidade?: string;
  data_inicio?: string;
  data_fim?: string;
  nivel_risco?: string;
  canal_origem?: string;
}

export interface EstatisticasAuditoria {
  total_acoes: number;
  usuarios_ativos: number;
  acoes_hoje: number;
  alertas_ativos: number;
  acoes_sensíveis: number;
  por_acao: Record<string, number>;
  por_usuario: Record<string, number>;
  por_entidade: Record<string, number>;
}

export interface ConfiguracaoAuditoria {
  id: string;
  acoes_registradas: {
    login: boolean;
    logout: boolean;
    criar: boolean;
    editar: boolean;
    excluir: boolean;
    enviar: boolean;
    exportar: boolean;
    visualizar: boolean;
  };
  valor_limite_alerta: number;
  tentativas_login_alerta: number;
  tempo_retencao_meses: number;
  backup_automatico: boolean;
  notificacao_alertas: boolean;
  horario_padrao_inicio: string;
  horario_padrao_fim: string;
  created_at?: string;
  updated_at?: string;
}

export interface AlertaAuditoria {
  id?: string;
  tipo: 'exclusao_manual' | 'valor_alto' | 'login_fora_horario' | 'tentativas_login' | 'acao_sensivel';
  titulo: string;
  descricao: string;
  nivel_risco: 'baixo' | 'medio' | 'alto';
  data_deteccao: string;
  usuario_envolvido: string;
  entidade_afetada: string;
  acao_recomendada?: string;
  resolvido: boolean;
  data_resolucao?: string;
  observacoes_resolucao?: string;
  created_at?: string;
}

export interface BackupAuditoria {
  id?: string;
  data_backup: string;
  total_logs: number;
  periodo_inicio: string;
  periodo_fim: string;
  url_arquivo?: string;
  status: 'gerado' | 'enviado' | 'erro';
  created_at?: string;
}

export interface PermissaoAuditoria {
  usuario_id: string;
  pode_visualizar_todos: boolean;
  pode_exportar: boolean;
  pode_configurar: boolean;
  pode_resolver_alertas: boolean;
  entidades_permitidas: string[];
}