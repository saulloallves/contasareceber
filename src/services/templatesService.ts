import supabaseClient from '../lib/supabaseClient';

export interface TemplateNotificacao {
  id: string;
  tipo: 'whatsapp' | 'email' | 'whatsapp_cpf' | 'whatsapp_cnpj' | 'email_cpf' | 'email_cnpj';
  marco: number; // 3, 7, 15, 30 dias
  assunto?: string; // Para email
  conteudo: string;
  ativo: boolean;
  data_criacao: string;
  data_atualizacao: string;
}

export interface VariaveisTemplate {
  nomeFranqueado: string;
  nomeUnidade: string;
  tipoCobranca: string;
  valorFormatado: string;
  diasEmAberto: number;
}

class TemplatesService {
  
  /**
   * Busca todos os templates de notificação
   */
  async buscarTemplates(): Promise<TemplateNotificacao[]> {
    const { data, error } = await supabaseClient
      .from('templates_notificacao')
      .select('*')
      .eq('ativo', true)
      .order('tipo, marco');

    if (error) {
      console.error('Erro ao buscar templates:', error);
      return this.getTemplatesDefault();
    }

    return data || this.getTemplatesDefault();
  }

  /**
   * Busca template específico por tipo e marco
   */
  async buscarTemplate(tipo: 'whatsapp' | 'email', marco: number): Promise<TemplateNotificacao | null> {
    const { data, error } = await supabaseClient
      .from('templates_notificacao')
      .select('*')
      .eq('tipo', tipo)
      .eq('marco', marco)
      .eq('ativo', true)
      .single();

    if (error || !data) {
      // Retorna template padrão se não encontrar na base
      return this.getTemplateDefault(tipo, marco);
    }

    return data;
  }

  /**
   * Busca template específico considerando CPF vs CNPJ
   */
  async buscarTemplateEspecifico(canal: 'whatsapp' | 'email', marco: number, isCPF: boolean): Promise<TemplateNotificacao | null> {
    const tipoTemplate = isCPF ? `${canal}_cpf` : `${canal}_cnpj`;
    
    console.log(`🔍 Buscando template: ${tipoTemplate} - marco ${marco}`);
    
    const { data, error } = await supabaseClient
      .from('templates_notificacao')
      .select('*')
      .eq('tipo', tipoTemplate)
      .eq('marco', marco)
      .eq('ativo', true)
      .single();

    if (error || !data) {
      console.warn(`⚠️ Template não encontrado: ${tipoTemplate} - marco ${marco}`);
      // Fallback para template genérico se específico não for encontrado
      return this.buscarTemplate(canal, marco);
    }

    console.log(`✅ Template encontrado: ${tipoTemplate} - marco ${marco}`);
    return data;
  }

  /**
   * Salva ou atualiza um template
   */
  async salvarTemplate(template: Omit<TemplateNotificacao, 'id' | 'data_criacao' | 'data_atualizacao'>): Promise<TemplateNotificacao> {
    const { data, error } = await supabaseClient
      .from('templates_notificacao')
      .upsert({
        ...template,
        data_atualizacao: new Date().toISOString()
      }, {
        onConflict: 'tipo,marco'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar template:', error);
      throw new Error('Erro ao salvar template');
    }

    return data;
  }

  /**
   * Processa um template substituindo as variáveis
   */
  processarTemplate(template: string, variaveis: VariaveisTemplate): string {
    return template
      .replace(/\{nomeFranqueado\}/g, variaveis.nomeFranqueado)
      .replace(/\{nomeUnidade\}/g, variaveis.nomeUnidade)
      .replace(/\{tipoCobranca\}/g, variaveis.tipoCobranca)
      .replace(/\{valorFormatado\}/g, variaveis.valorFormatado)
      .replace(/\{diasEmAberto\}/g, variaveis.diasEmAberto.toString());
  }

  /**
   * Templates padrão caso a tabela não exista ou esteja vazia
   */
  private getTemplatesDefault(): TemplateNotificacao[] {
    return [
      // WhatsApp Templates
      {
        id: 'whatsapp-3',
        tipo: 'whatsapp',
        marco: 3,
        conteudo: `Olá {nomeFranqueado}!

Identificamos que há uma cobrança em aberto há 3 dias referente à sua unidade *{nomeUnidade}*.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Se o pagamento já foi feito, por favor, desconsidere esta mensagem.  
Obrigado pela atenção!

_Mensagem Automática_`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'whatsapp-7',
        tipo: 'whatsapp',
        marco: 7,
        conteudo: `Olá {nomeFranqueado}! ⚠️

Sua cobrança referente à unidade *{nomeUnidade}* está em aberto há 7 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos que regularize o pagamento para evitar transtornos.  
Se já pagou, por favor, ignore esta mensagem.

_Mensagem Automática_`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'whatsapp-15',
        tipo: 'whatsapp',
        marco: 15,
        conteudo: `Olá {nomeFranqueado}! 📢

A cobrança da sua unidade *{nomeUnidade}* está em aberto há 15 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos sua atenção para a regularização do valor o quanto antes, evitando medidas adicionais.

_Mensagem Automática_`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'whatsapp-30',
        tipo: 'whatsapp',
        marco: 30,
        conteudo: `*⚠️ URGENTE – {nomeFranqueado}! ⚠️*

O débito da sua unidade *{nomeUnidade}* está em aberto há 30 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Efetue o pagamento imediatamente para evitar acionamento jurídico e restrições.

_Mensagem Automática_`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      // Email Templates
      {
        id: 'email-3',
        tipo: 'email',
        marco: 3,
        assunto: 'Lembrete de Cobrança - {nomeUnidade} - 3 dias',
        conteudo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
    .header { background: #fcc300; color: white; padding: 15px; font-size: 20px; }
    .content { padding: 20px; color: #333; }
    .footer { background: #f1f1f1; padding: 10px; font-size: 12px; text-align: center; color: #777; }
    .logo { text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><strong>Lembrete de Cobrança</strong></div>
    <div class="content">
      <p>Prezado(a) <strong>{nomeFranqueado}</strong>,</p>
      <p>Notamos que há uma cobrança em aberto há <strong>3 dias</strong> referente à sua unidade <strong>{nomeUnidade}</strong>.</p>
      <p><strong>Tipo:</strong> {tipoCobranca}</p>
      <p><strong>Valor:</strong> {valorFormatado}</p>
      <p>Se o pagamento já foi efetuado, por favor, desconsidere este aviso.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'email-7',
        tipo: 'email',
        marco: 7,
        assunto: 'Aviso Importante - {nomeUnidade} - 7 dias',
        conteudo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
    .header { background: #f9a825; color: white; padding: 15px; font-size: 20px; }
    .content { padding: 20px; color: #333; }
    .footer { background: #f1f1f1; padding: 10px; font-size: 12px; text-align: center; color: #777; }
    .logo { text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><strong>Aviso Importante</strong></div>
    <div class="content">
      <p>Prezado(a) <strong>{nomeFranqueado}</strong>,</p>
      <p>O pagamento referente à sua unidade <strong>{nomeUnidade}</strong> encontra-se em aberto há <strong>7 dias</strong>.</p>
      <p><strong>Tipo:</strong> {tipoCobranca}</p>
      <p><strong>Valor:</strong> {valorFormatado}</p>
      <p>Solicitamos a gentileza de realizar o pagamento para evitar maiores encargos.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'email-15',
        tipo: 'email',
        marco: 15,
        assunto: 'Alerta de Cobrança - {nomeUnidade} - 15 dias',
        conteudo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
    .header { background: #ef6c00; color: white; padding: 15px; font-size: 20px; }
    .content { padding: 20px; color: #333; }
    .footer { background: #f1f1f1; padding: 10px; font-size: 12px; text-align: center; color: #777; }
    .logo { text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><strong>Alerta de Cobrança</strong></div>
    <div class="content">
      <p>Prezado(a) <strong>{nomeFranqueado}</strong>,</p>
      <p>Há um débito pendente há <strong>15 dias</strong> referente à sua unidade <strong>{nomeUnidade}</strong>.</p>
      <p><strong>Tipo:</strong> {tipoCobranca}</p>
      <p><strong>Valor:</strong> {valorFormatado}</p>
      <p>Evite multas adicionais regularizando o pagamento imediatamente.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      },
      {
        id: 'email-30',
        tipo: 'email',
        marco: 30,
        assunto: 'Notificação Urgente - {nomeUnidade} - 30 dias',
        conteudo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px; }
    .container { max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
    .header { background: #c62828; color: white; padding: 15px; font-size: 20px; }
    .content { padding: 20px; color: #333; }
    .footer { background: #f1f1f1; padding: 10px; font-size: 12px; text-align: center; color: #777; }
    .logo { text-align: center; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><strong>Notificação Urgente</strong></div>
    <div class="content">
      <p>Prezado(a) <strong>{nomeFranqueado}</strong>,</p>
      <p>O débito referente à sua unidade <strong>{nomeUnidade}</strong> encontra-se em aberto há <strong>30 dias</strong>.</p>
      <p><strong>Tipo:</strong> {tipoCobranca}</p>
      <p><strong>Valor:</strong> {valorFormatado}</p>
      <p>Para evitar medidas administrativas e restrições, solicitamos o pagamento imediato deste valor.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,
        ativo: true,
        data_criacao: new Date().toISOString(),
        data_atualizacao: new Date().toISOString()
      }
    ];
  }

  private getTemplateDefault(tipo: 'whatsapp' | 'email', marco: number): TemplateNotificacao {
    const templates = this.getTemplatesDefault();
    return templates.find(t => t.tipo === tipo && t.marco === marco) || templates[0];
  }
}

export const templatesService = new TemplatesService();
