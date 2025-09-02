import { supabase } from './databaseService';
import { CobrancaFranqueado, MarcosNotificacao } from '../types/cobranca';
import { templatesService, VariaveisTemplate } from './templatesService';
import { n8nService } from './n8nService';
import { emailService } from './emailService';

interface CobrancaParaProcessamento extends CobrancaFranqueado {
  dias_desde_criacao: number;
  proximo_marco: number | null;
  deve_notificar_whatsapp: boolean;
  deve_notificar_email: boolean;
  // Dados do franqueado principal para a mensagem
  franqueado_principal?: {
    id: string;
    nome_completo: string;
    email?: string;
    telefone?: string;
  };
  // Dados da unidade
  unidade?: {
    id: string;
    nome_unidade: string;
    codigo_unidade: string;
    cidade: string;
    estado: string;
  };
}

export class AutomacaoNotificacaoService {
  private readonly MARCOS_DIAS = [3, 7, 15, 30];

  /**
   * Função principal que verifica cobranças em aberto e identifica quais precisam de notificação
   */
  async verificarCobrancasParaNotificacao(): Promise<CobrancaParaProcessamento[]> {
    console.log('🔄 Iniciando verificação de cobranças para notificação automática...');
    
    try {
      // 1. Buscar cobranças em aberto
      const cobrancasEmAberto = await this.buscarCobrancasEmAberto();
      console.log(`📊 Encontradas ${cobrancasEmAberto.length} cobranças em aberto`);

      // 2. Processar cada cobrança calculando dias e marcos (com dados de franqueado)
      const cobrancasProcessadas = await Promise.all(
        cobrancasEmAberto.map(cobranca => this.processarCobranca(cobranca))
      );

      // 3. Filtrar apenas cobranças que precisam de notificação
      const cobrancasParaNotificar = cobrancasProcessadas.filter(cobranca => 
        cobranca.deve_notificar_whatsapp || cobranca.deve_notificar_email
      );

      console.log(`✅ ${cobrancasParaNotificar.length} cobranças identificadas para notificação`);
      
      return cobrancasParaNotificar;
    } catch (error) {
      console.error('❌ Erro na verificação de cobranças:', error);
      throw error;
    }
  }

  /**
   * Busca cobranças em aberto com os dados completos do franqueado principal
   * Replica a lógica do CadastroUnidades.tsx para buscar franqueado principal
   */
  private async buscarCobrancasEmAberto(): Promise<CobrancaFranqueado[]> {
    const { data, error } = await supabase
      .from('cobrancas_franqueados')
      .select(`
        id,
        cliente,
        cnpj,
        cpf,
        valor_original,
        valor_atualizado,
        data_vencimento,
        created_at,
        telefone,
        email_cobranca,
        notificacao_automatica_whatsapp,
        notificacao_automatica_email,
        ultimo_disparo_dia,
        franqueado_id_fk,
        unidade_id_fk,
        status
      `)
      .eq('status', 'em_aberto')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar cobranças: ${error.message}`);
    }

    return (data as CobrancaFranqueado[]) || [];
  }

  /**
   * Busca dados da unidade e franqueado principal baseado no CNPJ da cobrança
   * Replica a lógica do n8n: CNPJ -> Unidade -> Franqueado Principal
   */
  private async buscarDadosUnidadeFranqueado(cnpj: string): Promise<{
    unidade?: {
      id: string;
      nome_unidade: string;
      codigo_unidade: string;
      cidade: string;
      estado: string;
    };
    franqueado_principal?: {
      id: string;
      nome_completo: string;
      email: string;
      telefone: string;
      tipo_franqueado: string;
    };
  }> {
    try {
      console.log(`🔍 Buscando dados para CNPJ: ${cnpj}`);

      // 1. Busca unidade pelo CNPJ (codigo_interno)
      const { data: unidade, error: unidadeError } = await supabase
        .from('unidades_franqueadas')
        .select(`
          id,
          nome_unidade,
          codigo_unidade,
          cidade,
          estado,
          codigo_interno
        `)
        .eq('codigo_interno', cnpj)
        .single();

      if (unidadeError || !unidade) {
        console.log(`❌ Unidade não encontrada para CNPJ: ${cnpj}`, unidadeError);
        return {};
      }

      console.log(`✅ Unidade encontrada: ${unidade.nome_unidade} (ID: ${unidade.id})`);

      // 2. Busca vínculos ativos para a unidade (com debug detalhado)
      const { data: vinculos, error: vinculoError } = await supabase
        .from('franqueado_unidades')
        .select('franqueado_id, ativo, tipo_vinculo')
        .eq('unidade_id', unidade.id)
        .eq('ativo', true);

      if (vinculoError) {
        console.error(`❌ Erro ao buscar vínculos para unidade ${unidade.id}:`, vinculoError);
        return { unidade };
      }

      console.log(`🔗 Vínculos ativos encontrados:`, vinculos);

      if (!vinculos || vinculos.length === 0) {
        console.log(`⚠️ Nenhum vínculo ativo encontrado para unidade: ${unidade.nome_unidade}`);
        return { unidade };
      }

      // 3. Busca dados dos franqueados vinculados
      const franqueadoIds = vinculos.map(v => v.franqueado_id);
      console.log(`👥 IDs dos franqueados vinculados:`, franqueadoIds);

      const { data: franqueados, error: franqueadoError } = await supabase
        .from('franqueados')
        .select('id, nome_completo, email, telefone, tipo_franqueado')
        .in('id', franqueadoIds);

      if (franqueadoError) {
        console.error(`❌ Erro ao buscar franqueados:`, franqueadoError);
        return { unidade };
      }

      console.log(`👥 Franqueados encontrados:`, franqueados);

      // 4. Procura franqueado principal (verifica ambos os campos)
      let franqueadoPrincipal = franqueados?.find(f => f.tipo_franqueado === 'principal');
      
      // Se não encontrar por tipo_franqueado, tenta por tipo_vinculo na tabela de vínculos
      if (!franqueadoPrincipal) {
        const vinculoPrincipal = vinculos.find(v => v.tipo_vinculo === 'principal');
        if (vinculoPrincipal) {
          franqueadoPrincipal = franqueados?.find(f => f.id === vinculoPrincipal.franqueado_id);
          console.log(`🔍 Encontrado franqueado principal via tipo_vinculo:`, franqueadoPrincipal);
        }
      } else {
        console.log(`🔍 Encontrado franqueado principal via tipo_franqueado:`, franqueadoPrincipal);
      }

      if (!franqueadoPrincipal) {
        console.log(`⚠️ Franqueado principal não encontrado para unidade: ${unidade.nome_unidade}`);
        console.log(`📊 Debug - Tipos de franqueado encontrados:`, franqueados?.map(f => ({ nome: f.nome_completo, tipo: f.tipo_franqueado })));
        console.log(`📊 Debug - Tipos de vínculo encontrados:`, vinculos.map(v => ({ id: v.franqueado_id, tipo_vinculo: v.tipo_vinculo })));
        
        // Como fallback, pega o primeiro franqueado ativo
        if (franqueados && franqueados.length > 0) {
          franqueadoPrincipal = franqueados[0];
          console.log(`🔄 Usando primeiro franqueado como fallback:`, franqueadoPrincipal.nome_completo);
        } else {
          return { unidade };
        }
      }

      console.log(`✅ Dados encontrados - Unidade: ${unidade.nome_unidade}, Franqueado: ${franqueadoPrincipal.nome_completo}`);

      return {
        unidade,
        franqueado_principal: franqueadoPrincipal
      };

    } catch (error) {
      console.error(`❌ Erro ao buscar dados da unidade/franqueado para CNPJ ${cnpj}:`, error);
      return {};
    }
  }

  /**
   * Processa uma cobrança individual calculando dias decorridos e marcos
   * Enriquece com dados do franqueado principal para cobranças CNPJ
   */
  private async processarCobranca(cobranca: CobrancaFranqueado): Promise<CobrancaParaProcessamento> {
    // Calcula dias desde a criação (replicando a função do n8n)
    const diasDecorridos = this.calcularDiasDecorridos(cobranca.created_at || '');
    
    // Identifica próximo marco (replicando a lógica do n8n)
    const ultimoDisparo = Number(cobranca.ultimo_disparo_dia ?? -1);
    const candidatos = this.MARCOS_DIAS.filter(d => d <= diasDecorridos && d > ultimoDisparo);
    const proximoMarco = candidatos.length ? Math.max(...candidatos) : null;

    // Verifica se deve notificar
    const deveNotificarWhatsApp = this.deveEnviarNotificacao(cobranca, proximoMarco, 'whatsapp');
    const deveNotificarEmail = this.deveEnviarNotificacao(cobranca, proximoMarco, 'email');

    // Base do resultado
    const resultado: CobrancaParaProcessamento = {
      ...cobranca,
      dias_desde_criacao: diasDecorridos,
      proximo_marco: proximoMarco,
      deve_notificar_whatsapp: deveNotificarWhatsApp,
      deve_notificar_email: deveNotificarEmail
    };

    // Para cobranças CNPJ, busca dados do franqueado principal
    if (cobranca.cnpj) {
      try {
        const { unidade, franqueado_principal } = await this.buscarDadosUnidadeFranqueado(cobranca.cnpj);
        resultado.unidade = unidade;
        resultado.franqueado_principal = franqueado_principal;
      } catch (error) {
        console.error(`❌ Erro ao buscar dados da unidade para CNPJ ${cobranca.cnpj}:`, error);
      }
    }

    return resultado;
  }

  /**
   * Calcula dias decorridos desde a criação usando timezone de São Paulo
   * Replica exatamente a função do n8n
   */
  private calcularDiasDecorridos(createdAt: string): number {
    const toSPYMD = (d: Date) => {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit'
      });
      const [y, m, dd] = fmt.format(d).split('-').map(Number);
      return { y, m: m - 1, d: dd };
    };

    const parseCreatedAt = (v: string) => {
      if (typeof v === 'string' && /^\d{2}-\d{2}-\d{4}/.test(v)) {
        const [dd, mm, yyyy] = v.split(/[ T]/)[0].split('-').map(Number);
        return new Date(Date.UTC(yyyy, mm - 1, dd));
      }
      return new Date(v);
    };

    const created = parseCreatedAt(createdAt);
    const now = new Date();
    const c = toSPYMD(created);
    const t = toSPYMD(now);
    const dias = Math.floor((Date.UTC(t.y, t.m, t.d) - Date.UTC(c.y, c.m, c.d)) / 86400000);
    
    return Math.max(0, dias);
  }

  /**
   * Verifica se deve enviar notificação para um marco e canal específicos
   */
  private deveEnviarNotificacao(
    cobranca: CobrancaFranqueado, 
    proximoMarco: number | null,
    canal: 'whatsapp' | 'email'
  ): boolean {
    if (!proximoMarco) return false;

    const marcoStr = proximoMarco.toString() as keyof MarcosNotificacao;
    const colunaNotificacao = canal === 'whatsapp' 
      ? 'notificacao_automatica_whatsapp' 
      : 'notificacao_automatica_email';

    const marcosEnviados = cobranca[colunaNotificacao] || { "3": false, "7": false, "15": false, "30": false };
    
    // Retorna true se ainda não foi enviado para este marco
    return !marcosEnviados[marcoStr];
  }

  /**
   * Atualiza o marco de notificação no banco (para ser chamado após envio via webhook)
   */
  async marcarNotificacaoEnviada(
    cobrancaId: string, 
    marco: number, 
    canal: 'whatsapp' | 'email'
  ): Promise<void> {
    const coluna = canal === 'whatsapp' 
      ? 'notificacao_automatica_whatsapp' 
      : 'notificacao_automatica_email';

    try {
      // Busca o estado atual
      const { data, error: selectError } = await supabase
        .from('cobrancas_franqueados')
        .select(coluna)
        .eq('id', cobrancaId)
        .single();

      if (selectError) {
        throw new Error(`Erro ao buscar estado atual: ${selectError.message}`);
      }

      // Atualiza o marco específico
      const dadosCobranca = data as Record<string, unknown>;
      const estadoAtual: MarcosNotificacao = (dadosCobranca[coluna] as MarcosNotificacao) || { "3": false, "7": false, "15": false, "30": false };
      estadoAtual[marco.toString() as keyof MarcosNotificacao] = true;

      // Salva no banco
      const { error: updateError } = await supabase
        .from('cobrancas_franqueados')
        .update({ 
          [coluna]: estadoAtual,
          ultimo_disparo_dia: marco 
        })
        .eq('id', cobrancaId);

      if (updateError) {
        throw new Error(`Erro ao atualizar marco: ${updateError.message}`);
      }

      console.log(`✅ Marco ${marco} marcado como enviado via ${canal} - Cobrança ${cobrancaId}`);
    } catch (error) {
      console.error(`❌ Erro ao marcar notificação como enviada:`, error);
      throw error;
    }
  }

  /**
   * Execução manual para testes
   */
  async executarManualmente(): Promise<{
    total_analisadas: number;
    total_para_notificar: number;
    cobrancas: CobrancaParaProcessamento[];
  }> {
    const cobrancasParaNotificar = await this.verificarCobrancasParaNotificacao();
    
    return {
      total_analisadas: cobrancasParaNotificar.length,
      total_para_notificar: cobrancasParaNotificar.filter(c => 
        c.deve_notificar_whatsapp || c.deve_notificar_email
      ).length,
      cobrancas: cobrancasParaNotificar
    };
  }

  /**
   * Gera mensagem personalizada para WhatsApp baseada no marco
   * Usa o nome do franqueado principal quando disponível
   */
  async gerarMensagemWhatsApp(cobranca: CobrancaParaProcessamento, marco: number): Promise<string> {
    try {
      // Verifica se é CPF ou CNPJ baseado na presença dos campos
      const isCPF = !!cobranca.cpf && !cobranca.cnpj;
      
      console.log(`🔍 DEBUG gerarMensagemWhatsApp:`, {
        cobranca_id: cobranca.id,
        cpf: cobranca.cpf,
        cnpj: cobranca.cnpj,
        isCPF: isCPF
      });

      // Busca template específico para CPF ou CNPJ
      const template = await templatesService.buscarTemplateEspecifico('whatsapp', marco, isCPF);
      
      if (template) {
        // Prepara variáveis para o template
        const variaveis: VariaveisTemplate = {
          nomeFranqueado: cobranca.franqueado_principal?.nome_completo || 
                          cobranca.cliente.split(' ')[0] || 'Franqueado',
          nomeUnidade: cobranca.unidade?.nome_unidade || cobranca.cliente,
          tipoCobranca: cobranca.tipo_cobranca || 'Cobrança',
          valorFormatado: cobranca.valor_original.toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }),
          diasEmAberto: cobranca.dias_desde_criacao
        };

        console.log(`📤 Usando template específico: ${template.tipo} para marco ${marco}`);
        
        return templatesService.processarTemplate(template.conteudo, variaveis);
      }
    } catch (error) {
      console.error('Erro ao buscar template WhatsApp:', error);
    }

    // Fallback para templates hardcoded se houver erro
    console.warn('⚠️ Usando template hardcoded como fallback');
    return this.gerarMensagemWhatsAppFallback(cobranca, marco);
  }

  /**
   * Método fallback simplificado (caso não encontre no banco)
   */
  private gerarMensagemWhatsAppFallback(cobranca: CobrancaParaProcessamento, marco: number): string {
    const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 
                          cobranca.cliente.split(' ')[0] || 'Franqueado';
    
    const valorFormatado = cobranca.valor_original.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });
    
    const tipoCobranca = cobranca.tipo_cobranca || 'Cobrança';
    const isCPF = !!cobranca.cpf && !cobranca.cnpj;
    
    // Template genérico simples
    if (isCPF) {
      return `Olá ${nomeFranqueado}!

Identificamos uma cobrança em aberto há ${marco} dias.

📄 Tipo: ${tipoCobranca}  
💰 Valor: ${valorFormatado}

_Mensagem Automática_`;
    } else {
      const nomeUnidade = cobranca.unidade?.nome_unidade || cobranca.cliente;
      return `Olá ${nomeFranqueado}!

Identificamos uma cobrança em aberto há ${marco} dias referente à unidade *${nomeUnidade}*.

📄 Tipo: ${tipoCobranca}  
💰 Valor: ${valorFormatado}

_Mensagem Automática_`;
    }
  }

  /**
   * Gera conteúdo de email baseado no marco de notificação
   */
  async gerarEmailHTML(cobranca: CobrancaParaProcessamento, marco: number): Promise<{assunto: string, conteudo: string}> {
    try {
      // Verifica se é CPF ou CNPJ baseado na presença dos campos
      const isCPF = !!cobranca.cpf && !cobranca.cnpj;
      
      console.log(`🔍 DEBUG gerarEmailHTML:`, {
        cobranca_id: cobranca.id,
        cpf: cobranca.cpf,
        cnpj: cobranca.cnpj,
        isCPF: isCPF
      });

      // Busca template específico para CPF ou CNPJ
      const template = await templatesService.buscarTemplateEspecifico('email', marco, isCPF);
      
      if (template) {
        // Prepara variáveis para o template
        const variaveis: VariaveisTemplate = {
          nomeFranqueado: cobranca.franqueado_principal?.nome_completo || 
                          cobranca.cliente.split(' ')[0] || 'Franqueado',
          nomeUnidade: cobranca.unidade?.nome_unidade || cobranca.cliente,
          tipoCobranca: cobranca.tipo_cobranca || 'Cobrança',
          valorFormatado: cobranca.valor_original.toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }),
          diasEmAberto: cobranca.dias_desde_criacao
        };

        const assuntoProcessado = template.assunto ? 
          templatesService.processarTemplate(template.assunto, variaveis) : 
          `Cobrança Pendente - ${variaveis.nomeFranqueado}`;

        const conteudoProcessado = templatesService.processarTemplate(template.conteudo, variaveis);

        console.log(`📧 Usando template específico: ${template.tipo} para marco ${marco}`);

        return {
          assunto: assuntoProcessado,
          conteudo: conteudoProcessado
        };
      }
    } catch (error) {
      console.error('Erro ao buscar template de email:', error);
    }

    // Fallback para email simples se houver erro
    console.warn('⚠️ Usando template de email hardcoded como fallback');
    return this.gerarEmailFallback(cobranca, marco);
  }

  /**
   * Método fallback para email com template hardcoded
   */
  private gerarEmailFallback(cobranca: CobrancaParaProcessamento, marco: number): {assunto: string, conteudo: string} {
    const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 
                          cobranca.cliente.split(' ')[0] || 'Franqueado';
    const nomeUnidade = cobranca.unidade?.nome_unidade || cobranca.cliente;
    const valorFormatado = cobranca.valor_original.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });
    const tipoCobranca = cobranca.tipo_cobranca || 'Cobrança';

    const assuntos = {
      3: `Lembrete de Cobrança - ${nomeUnidade} - 3 dias`,
      7: `Aviso Importante - ${nomeUnidade} - 7 dias`, 
      15: `Alerta de Cobrança - ${nomeUnidade} - 15 dias`,
      30: `Notificação Urgente - ${nomeUnidade} - 30 dias`
    };

    const conteudos = {
      3: `<!DOCTYPE html>
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
      <p>Prezado(a) <strong>${nomeFranqueado}</strong>,</p>
      <p>Notamos que há uma cobrança em aberto há <strong>3 dias</strong> referente à sua unidade <strong>${nomeUnidade}</strong>.</p>
      <p><strong>Tipo:</strong> ${tipoCobranca}</p>
      <p><strong>Valor:</strong> ${valorFormatado}</p>
      <p>Se o pagamento já foi efetuado, por favor, desconsidere este aviso.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,

      7: `<!DOCTYPE html>
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
      <p>Prezado(a) <strong>${nomeFranqueado}</strong>,</p>
      <p>O pagamento referente à sua unidade <strong>${nomeUnidade}</strong> encontra-se em aberto há <strong>7 dias</strong>.</p>
      <p><strong>Tipo:</strong> ${tipoCobranca}</p>
      <p><strong>Valor:</strong> ${valorFormatado}</p>
      <p>Solicitamos a gentileza de realizar o pagamento para evitar maiores encargos.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,

      15: `<!DOCTYPE html>
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
      <p>Prezado(a) <strong>${nomeFranqueado}</strong>,</p>
      <p>Há um débito pendente há <strong>15 dias</strong> referente à sua unidade <strong>${nomeUnidade}</strong>.</p>
      <p><strong>Tipo:</strong> ${tipoCobranca}</p>
      <p><strong>Valor:</strong> ${valorFormatado}</p>
      <p>Evite multas adicionais regularizando o pagamento imediatamente.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`,

      30: `<!DOCTYPE html>
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
      <p>Prezado(a) <strong>${nomeFranqueado}</strong>,</p>
      <p>O débito referente à sua unidade <strong>${nomeUnidade}</strong> encontra-se em aberto há <strong>30 dias</strong>.</p>
      <p><strong>Tipo:</strong> ${tipoCobranca}</p>
      <p><strong>Valor:</strong> ${valorFormatado}</p>
      <p>Para evitar medidas administrativas e restrições, solicitamos o pagamento imediato deste valor.</p>
    </div>
    <div class="footer">Mensagem automática do sistema de cobranças.</div>
  </div>
  <div class="logo">
    <img src="https://crescieperdi.com/wp-content/uploads/2023/10/logo_header.png" width="100" height="auto">
  </div>
</body>
</html>`
    };

    return {
      assunto: assuntos[marco as keyof typeof assuntos] || assuntos[3],
      conteudo: conteudos[marco as keyof typeof conteudos] || conteudos[3]
    };
  }

  /**
   * Gera assunto do email baseado no marco e dados do franqueado
   */
  gerarAssuntoEmail(cobranca: CobrancaParaProcessamento, marco: number): string {
    const nomeUnidade = cobranca.unidade?.nome_unidade || cobranca.cliente;
    const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 'Franqueado';
    
    const urgencia = {
      3: '📋 Débito Pendente',
      7: '⚠️ Débito em Atraso', 
      15: '🚨 URGENTE - Regularização Necessária',
      30: '🛑 CRÍTICO - Último Aviso'
    };

    return `${urgencia[marco as keyof typeof urgencia]} - ${marco} dias - ${nomeFranqueado} (${nomeUnidade})`;
  }

  /**
   * Gera corpo do email baseado no marco e dados do franqueado
   */
  gerarCorpoEmail(cobranca: CobrancaParaProcessamento, marco: number): string {
    const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || cobranca.cliente;
    const nomeUnidade = cobranca.unidade?.nome_unidade || '';
    
    const valorFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cobranca.valor_atualizado || cobranca.valor_original);

    const dataVencimento = cobranca.data_vencimento 
      ? new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')
      : 'N/A';

    return `
Caro(a) ${nomeFranqueado},

${nomeUnidade ? `Identificamos um débito pendente da unidade ${nomeUnidade}` : 'Identificamos um débito pendente'} há ${marco} dias.

DETALHES DO DÉBITO:
• Valor: ${valorFormatado}
• Data de vencimento: ${dataVencimento}
• Dias em aberto: ${marco}

${marco >= 15 ? 'SITUAÇÃO CRÍTICA: ' : ''}Este débito precisa ser regularizado com urgência.

Para esclarecimentos ou parcelamento, entre em contato:
• Telefone: (19) 99595-7880
• Email: financeiro@crescieperdi.com.br

Atenciosamente,
Equipe Financeira - Cresci e Perdi

---
Esta é uma mensagem automática do sistema de cobrança.
    `.trim();
  }

  /**
   * Reseta todas as notificações de uma cobrança (útil para testes)
   */
  async resetarNotificacoes(cobrancaId: string): Promise<void> {
    const estadoInicial = { "3": false, "7": false, "15": false, "30": false };
    
    const { error } = await supabase
      .from('cobrancas_franqueados')
      .update({
        notificacao_automatica_whatsapp: estadoInicial,
        notificacao_automatica_email: estadoInicial,
        ultimo_disparo_dia: null
      })
      .eq('id', cobrancaId);

    if (error) {
      throw new Error(`Erro ao resetar notificações: ${error.message}`);
    }

    console.log(`✅ Notificações resetadas para cobrança ${cobrancaId}`);
  }

  /**
   * MÉTODO PRINCIPAL: Executa todo o fluxo de notificações automáticas
   * Integra com n8nService (WhatsApp) e emailService (Email)
   */
  async executarFluxoCompleto(): Promise<{
    total_processadas: number;
    whatsapp_enviados: number;
    emails_enviados: number;
    erros: Array<{ cobranca_id: string; erro: string; canal: string }>;
    detalhes: Array<{
      cobranca_id: string;
      nome_franqueado: string;
      unidade: string;
      marco: number;
      whatsapp_enviado: boolean;
      email_enviado: boolean;
    }>;
  }> {
    console.log('🚀 Iniciando execução completa do fluxo de notificações...');
    
    const resultado = {
      total_processadas: 0,
      whatsapp_enviados: 0,
      emails_enviados: 0,
      erros: [] as Array<{ cobranca_id: string; erro: string; canal: string }>,
      detalhes: [] as Array<{
        cobranca_id: string;
        nome_franqueado: string;
        unidade: string;
        marco: number;
        whatsapp_enviado: boolean;
        email_enviado: boolean;
      }>
    };

    try {
      // 1. Busca cobranças que precisam de notificação
      const cobrancasParaNotificar = await this.verificarCobrancasParaNotificacao();
      resultado.total_processadas = cobrancasParaNotificar.length;

      console.log(`📊 Total de cobranças para processar: ${cobrancasParaNotificar.length}`);

      // 2. Processa cada cobrança
      for (const cobranca of cobrancasParaNotificar) {
        if (!cobranca.proximo_marco || !cobranca.id) continue;

        const marco = cobranca.proximo_marco;
        const cobrancaId = cobranca.id;
        let whatsappEnviado = false;
        let emailEnviado = false;

        const nomeFranqueado = cobranca.franqueado_principal?.nome_completo || 
                              cobranca.cliente.split(' ')[0] || 'Franqueado';
        const nomeUnidade = cobranca.unidade?.nome_unidade || cobranca.cliente;

        console.log(`📱 Processando cobrança ${cobrancaId} - ${nomeFranqueado} (${nomeUnidade}) - Marco ${marco} dias`);

        // 3. Enviar WhatsApp (se habilitado e com telefone)
        if (cobranca.deve_notificar_whatsapp && cobranca.telefone) {
          try {
            const mensagemWhatsApp = await this.gerarMensagemWhatsApp(cobranca, marco);
            
            const resultadoWhatsApp = await n8nService.enviarWhatsApp({
              number: cobranca.telefone,
              text: mensagemWhatsApp,
              instanceName: 'automacoes_3',
              metadata: {
                cobranca_id: cobrancaId,
                franqueado: nomeFranqueado,
                unidade: nomeUnidade,
                marco: marco,
                valor: cobranca.valor_original,
                tipo: 'notificacao_automatica'
              }
            });

            if (resultadoWhatsApp.success) {
              await this.marcarNotificacaoEnviada(cobrancaId, marco, 'whatsapp');
              resultado.whatsapp_enviados++;
              whatsappEnviado = true;
              console.log(`✅ WhatsApp enviado para ${nomeFranqueado} - Marco ${marco} dias`);
            } else {
              throw new Error('Falha no envio do WhatsApp');
            }

          } catch (error) {
            console.error(`❌ Erro ao enviar WhatsApp para ${nomeFranqueado}:`, error);
            resultado.erros.push({
              cobranca_id: cobrancaId,
              erro: error instanceof Error ? error.message : 'Erro desconhecido',
              canal: 'whatsapp'
            });
          }
        }

        // 4. Enviar Email (se habilitado e com email)
        if (cobranca.deve_notificar_email) {
          try {
            const { assunto, conteudo } = await this.gerarEmailHTML(cobranca, marco);
            
            // Determina destinatário de email (prioriza email_cobranca, depois franqueado)
            const destinatario = cobranca.email_cobranca || 
                               cobranca.franqueado_principal?.email ||
                               'financeiro@crescieperdi.com'; // fallback

            if (destinatario && destinatario !== 'financeiro@crescieperdi.com') {
              const resultadoEmail = await emailService.enviarEmail({
                destinatario: destinatario,
                nome_destinatario: nomeFranqueado,
                assunto: assunto,
                corpo_html: conteudo,
                corpo_texto: conteudo.replace(/<[^>]*>/g, ''), // Remove HTML
                metadata: {
                  cobranca_id: cobrancaId,
                  franqueado: nomeFranqueado,
                  unidade: nomeUnidade,
                  marco: marco,
                  valor: cobranca.valor_original,
                  tipo: 'notificacao_automatica'
                }
              });

              if (resultadoEmail.sucesso) {
                await this.marcarNotificacaoEnviada(cobrancaId, marco, 'email');
                resultado.emails_enviados++;
                emailEnviado = true;
                console.log(`✅ Email enviado para ${nomeFranqueado} (${destinatario}) - Marco ${marco} dias`);
              } else {
                throw new Error(resultadoEmail.erro || 'Falha no envio do email');
              }
            } else {
              console.warn(`⚠️ Email não enviado para ${nomeFranqueado} - sem email válido`);
            }

          } catch (error) {
            console.error(`❌ Erro ao enviar email para ${nomeFranqueado}:`, error);
            resultado.erros.push({
              cobranca_id: cobrancaId,
              erro: error instanceof Error ? error.message : 'Erro desconhecido',
              canal: 'email'
            });
          }
        }

        // 5. Adiciona detalhes do processamento
        resultado.detalhes.push({
          cobranca_id: cobrancaId,
          nome_franqueado: nomeFranqueado,
          unidade: nomeUnidade,
          marco: marco,
          whatsapp_enviado: whatsappEnviado,
          email_enviado: emailEnviado
        });
      }

      console.log(`🎯 Execução completa finalizada:`);
      console.log(`   • Total processadas: ${resultado.total_processadas}`);
      console.log(`   • WhatsApp enviados: ${resultado.whatsapp_enviados}`);
      console.log(`   • Emails enviados: ${resultado.emails_enviados}`);
      console.log(`   • Erros: ${resultado.erros.length}`);

      return resultado;

    } catch (error) {
      console.error('❌ Erro na execução do fluxo completo:', error);
      throw error;
    }
  }

  /**
   * Método para execução via CronJob (simplificado)
   */
  async executarCronJob(): Promise<void> {
    try {
      console.log('⏰ Executando cron job de notificações automáticas...');
      const resultado = await this.executarFluxoCompleto();
      
      // Log resumido para cron
      if (resultado.whatsapp_enviados > 0 || resultado.emails_enviados > 0) {
        console.log(`📊 Cron executado com sucesso: ${resultado.whatsapp_enviados} WhatsApp + ${resultado.emails_enviados} emails enviados`);
      } else {
        console.log('📊 Cron executado: nenhuma notificação enviada');
      }

      // Log de erros se houver
      if (resultado.erros.length > 0) {
        console.error('❌ Erros durante execução do cron:', resultado.erros);
      }

    } catch (error) {
      console.error('❌ Erro fatal no cron job:', error);
      throw error;
    }
  }
}

export const automacaoNotificacaoService = new AutomacaoNotificacaoService();
