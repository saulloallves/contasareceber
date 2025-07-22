export interface IntegracaoConfig {
  id?: string;
  nome: string;
  tipo: 'supabase' | 'n8n' | 'whatsapp' | 'email' | 'notion' | 'webhook';
  ativo: boolean;
  configuracoes: any;
  status_conexao: 'conectado' | 'alerta' | 'falha';
  ultima_verificacao?: string;
  ultima_sincronizacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConfiguracaoSupabase {
  url: string;
  anon_key: string;
  service_role_key: string;
  schema: string;
  tabela_principal: string;
}

export interface ConfiguracaoN8N {
  url_base: string;
  token_autenticacao: string;
  webhook_url: string;
  workflows_ativos: {
    id: string;
    nome: string;
    ativo: boolean;
    descricao: string;
  }[];
}

export interface ConfiguracaoWhatsApp {
  provider: 'meta' | 'z-api' | 'evolution';
  numero_autenticado: string;
  token_api: string;
  id_remetente: string;
  webhook_url?: string;
  templates_mensagem: {
    id: string;
    nome: string;
    conteudo: string;
    variaveis: string[];
  }[];
}

export interface ConfiguracaoEmail {
  servidor_smtp: string;
  porta: number;
  usuario: string;
  senha: string;
  nome_remetente: string;
  email_padrao: string;
  email_retorno: string;
  ssl_ativo: boolean;
}

export interface ConfiguracaoNotion {
  token_integracao: string;
  database_url: string;
  database_id: string;
  campos_vinculados: {
    campo_notion: string;
    campo_sistema: string;
    tipo: 'text' | 'number' | 'date' | 'select';
  }[];
}

export interface HistoricoIntegracao {
  id?: string;
  integracao_id: string;
  tipo_acao: 'envio' | 'recebimento' | 'sincronizacao' | 'teste';
  status: 'sucesso' | 'erro' | 'pendente';
  payload_envio?: any;
  resposta_api?: any;
  erro_detalhes?: string;
  tempo_resposta?: number;
  data_execucao: string;
  usuario_responsavel?: string;
}

export interface MonitoramentoIntegracao {
  integracao: string;
  status: 'online' | 'offline' | 'instavel';
  ultima_atividade: string;
  total_chamadas_24h: number;
  taxa_sucesso_24h: number;
  tempo_resposta_medio: number;
  alertas_ativos: string[];
}

export interface GatilhoAutomacao {
  id?: string;
  nome: string;
  evento_trigger: 'novo_debito' | 'reuniao_marcada' | 'status_alterado' | 'upload_planilha' | 'escalonamento';
  condicoes: {
    campo: string;
    operador: 'igual' | 'diferente' | 'maior' | 'menor' | 'contem';
    valor: any;
  }[];
  acoes: {
    tipo: 'whatsapp' | 'email' | 'webhook' | 'notion' | 'n8n';
    configuracao: any;
  }[];
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosIntegracoes {
  tipo?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface EstatisticasIntegracoes {
  total_integracoes: number;
  integracoes_ativas: number;
  chamadas_24h: number;
  taxa_sucesso_geral: number;
  tempo_resposta_medio: number;
  por_tipo: Record<string, {
    total: number;
    ativas: number;
    chamadas: number;
    sucesso: number;
  }>;
}

export interface TesteConexao {
  integracao: string;
  sucesso: boolean;
  tempo_resposta: number;
  detalhes: string;
  data_teste: string;
}

export interface LogIntegracao {
  id?: string;
  integracao_nome: string;
  acao: string;
  usuario: string;
  dados_anteriores?: any;
  dados_novos?: any;
  ip_origem?: string;
  data_acao: string;
}