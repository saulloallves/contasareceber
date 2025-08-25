export interface ConfiguracaoCobranca {
  id: string;
  percentual_multa: number;
  percentual_juros_dia: number;
  dia_disparo_mensal: number;
  tempo_tolerancia_dias: number;
  texto_padrao_mensagem: string;
  link_base_agendamento: string;
  canal_envio: 'whatsapp' | 'email' | 'ambos';
  modo_debug: boolean;
  ultima_data_importacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HistoricoAlteracao {
  id: string;
  campo_alterado: string;
  valor_anterior: string;
  valor_novo: string;
  usuario: string;
  data_alteracao: string;
}

export interface ValidacaoConfiguracao {
  campo: string;
  valido: boolean;
  mensagem?: string;
}

export interface Usuario {
  id?: string;
  nome_completo: string;
  email: string;
  telefone?: string;
  cargo: string;
  codigo_unidade_vinculada?: string;
  vinculo_multifranqueado?: string;
  nivel_permissao: 'admin_master' | 'gestor_juridico' | 'cobranca' | 'analista_financeiro' | 'franqueado' | 'observador';
  ativo: boolean;
  ultimo_acesso?: string;
  tentativas_login?: number;
  bloqueado_ate?: string;
  regioes_permitidas?: string[];
  unidades_permitidas?: string[];
  permissoes_customizadas?: PermissoesCustomizadas;
  ip_permitidos?: string[];
  verificacao_ip_ativa?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissoesCustomizadas {
  dashboard: boolean;
  cobrancas: boolean;
  reunioes: boolean;
  juridico: boolean;
  configuracoes: boolean;
  usuarios: boolean;
  relatorios: boolean;
  importacao: boolean;
  exportacao: boolean;
  notificacoes: boolean;
  escalonamentos: boolean;
  acordos: boolean;
  documentos: boolean;
}

export interface LogSistema {
  id?: string;
  usuario_id: string;
  acao: string;
  tabela_afetada?: string;
  registro_id?: string;
  dados_anteriores?: any;
  dados_novos?: any;
  ip_origem?: string;
  user_agent?: string;
  data_acao?: string;
  created_at?: string;
}

export interface LogSeguranca {
  id?: string;
  usuario_id?: string;
  email_tentativa: string;
  ip_origem: string;
  user_agent?: string;
  tipo_evento: 'login_sucesso' | 'login_falha' | 'acesso_negado' | 'ip_suspeito' | 'bloqueio_automatico';
  detalhes?: string;
  data_evento: string;
}

export interface SessaoUsuario {
  id?: string;
  usuario_id: string;
  token_sessao: string;
  ip_origem: string;
  user_agent?: string;
  data_inicio: string;
  data_ultimo_acesso: string;
  ativa: boolean;
  created_at?: string;
}

export interface ConfiguracaoSistema {
  id: string;
  chave: string;
  valor: string;
  tipo_valor: 'string' | 'number' | 'boolean' | 'json';
  descricao: string;
  categoria: 'cobranca' | 'sistema' | 'integracao' | 'seguranca';
  editavel: boolean;
  nivel_permissao_minimo: string;
  created_at?: string;
  updated_at?: string;
}

export interface PermissaoUsuario {
  nivel: string;
  descricao: string;
  permissoes: {
    dashboard: boolean;
    cobrancas: boolean;
    reunioes: boolean;
    juridico: boolean;
    configuracoes: boolean;
    usuarios: boolean;
    relatorios: boolean;
    importacao: boolean;
    exportacao: boolean;
  };
}

export interface FiltrosUsuarios {
  nivel_permissao?: string;
  ativo?: boolean;
  cargo?: string;
  busca?: string;
  data_inicio?: string;
  data_fim?: string;
}

export interface EstatisticasUsuarios {
  total_usuarios: number;
  usuarios_ativos: number;
  usuarios_inativos: number;
  por_nivel: Record<string, number>;
  logins_mes_atual: number;
  tentativas_bloqueadas: number;
}

export interface ConfiguracaoIntegracao {
  id: string;
  nome: string;
  tipo: 'supabase' | 'typebot' | 'notion' | 'make' | 'webhook';
  url?: string;
  token?: string;
  configuracoes: any;
  ativo: boolean;
  ultima_sincronizacao?: string;
  created_at?: string;
  updated_at?: string;
}