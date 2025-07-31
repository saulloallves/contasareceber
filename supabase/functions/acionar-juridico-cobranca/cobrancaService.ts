// Versão simplificada do cobrancaService para Edge Function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos básicos inline para evitar dependências externas
interface CobrancaFranqueado {
  id?: string;
  cliente: string;
  cnpj: string;
  valor_original: number;
  valor_atualizado?: number;
  data_vencimento: string;
  status?: string;
  dias_em_atraso?: number;
  aviso_de_debito_enviado?: boolean;
  resposta_cliente?: string | null;
  risco_juridico?: string;
  unidades_franqueadas?: {
    id: string;
    codigo_unidade: string;
    nome_franqueado: string;
    email_franqueado: string;
    telefone_franqueado: string;
  };
}

export class CobrancaService {
  constructor() {
    // Inicializa o cliente Supabase usando variáveis de ambiente
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Usar Service Role Key para bypasear RLS
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log("Inicializando Supabase client...");
    console.log("URL:", supabaseUrl);
    console.log("Service Key disponível:", !!supabaseServiceKey);
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  private supabase: any;

  /**
   * Aciona o fluxo jurídico para uma cobrança específica
   * Implementa os novos critérios definidos:
   * 1. Valor em aberto superior a R$ 5.000
   * 2. 3 ou mais cobranças ignoradas em 15 dias
   * 3. Score de risco igual a zero
   * 4. Acordo firmado e descumprido
   * 5. Reincidência em período de 6 meses
   */
  async acionarJuridicoPorCobranca(
    cobrancaId: string
  ): Promise<{ sucesso: boolean; mensagem: string }> {
    console.log("=== INÍCIO ACIONAMENTO JURÍDICO ===");
    console.log("Cobrança ID recebido:", cobrancaId);
    
    try {
      // Busca a cobrança e unidade vinculada
      console.log("Buscando cobrança no banco...");
      
      const { data: cobrancaBasica, error: errorBasico } = await this.supabase
        .from("cobrancas_franqueados")
        .select("*")
        .eq("id", cobrancaId)
        .single();

      console.log("Busca básica - Error:", errorBasico);
      console.log("Busca básica - Data:", cobrancaBasica);

      if (errorBasico || !cobrancaBasica) {
        console.log("ERRO: Não foi possível encontrar a cobrança básica");
        return { sucesso: false, mensagem: "Cobrança não encontrada no sistema." };
      }

      // Busca a unidade separadamente
      let unidadeDados = null;
      if (cobrancaBasica.unidade_id_fk) {
        console.log("Buscando unidade com ID:", cobrancaBasica.unidade_id_fk);
        const { data: unidade, error: unidadeError } = await this.supabase
          .from("unidades_franqueadas")
          .select("id, codigo_unidade, nome_franqueado, email_franqueado, telefone_franqueado")
          .eq("id", cobrancaBasica.unidade_id_fk)
          .single();

        console.log("Busca unidade - Error:", unidadeError);
        console.log("Busca unidade - Data:", unidade);
        
        if (!unidadeError && unidade) {
          unidadeDados = unidade;
        }
      }

      // Combina os dados
      const cobranca = {
        ...cobrancaBasica,
        unidades_franqueadas: unidadeDados
      };

      console.log("=== VALIDAÇÃO DOS NOVOS CRITÉRIOS ===");
      
      // Define valor atualizado primeiro
      const valorAtualizado = cobranca.valor_atualizado || cobranca.valor_original;
      
      // MODO PRODUÇÃO: Validações rigorosas
      console.log("📋 MODO PRODUÇÃO - Validando todos os critérios rigorosamente");
      
      // CRITÉRIO 1: Valor em aberto superior a R$ 5.000
      console.log("Critério 1 - Valor:", valorAtualizado);
      if (valorAtualizado <= 5000) {
        return {
          sucesso: false,
          mensagem: `Valor insuficiente para acionamento jurídico. Mínimo: R$ 5.000,00. Atual: ${valorAtualizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        };
      }

      // CRITÉRIO 2: 3 ou mais cobranças ignoradas em 15 dias
      console.log("Critério 2 - Verificando cobranças ignoradas...");
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 15);
      
      const { data: cobrancasIgnoradas, error: ignoradasError } = await this.supabase
        .from("cobrancas_franqueados")
        .select("id")
        .eq("cnpj", cobranca.cnpj)
        .eq("status", "em_aberto")
        .eq("aviso_de_debito_enviado", true)
        .is("resposta_cliente", null)
        .gte("data_ultimo_envio", dataLimite.toISOString());

      console.log("Cobranças ignoradas encontradas:", cobrancasIgnoradas?.length || 0);
      if (!ignoradasError && (cobrancasIgnoradas?.length || 0) < 3) {
        return {
          sucesso: false,
          mensagem: `Insuficientes cobranças ignoradas. Necessário: 3. Atual: ${cobrancasIgnoradas?.length || 0} nos últimos 15 dias.`
        };
      }

      // CRITÉRIO 3: Score de risco igual a zero
      console.log("Critério 3 - Verificando score de risco...");
      const { data: scoreRisco, error: scoreError } = await this.supabase
        .from("score_risco_unidades")
        .select("score_atual, nivel_risco")
        .eq("cnpj_unidade", cobranca.cnpj)
        .single();

      console.log("Score de risco:", scoreRisco);
      if (!scoreError && scoreRisco && scoreRisco.score_atual !== 0) {
        return {
          sucesso: false,
          mensagem: `Score de risco deve ser zero para acionamento automático. Atual: ${scoreRisco.score_atual}`
        };
      }

      // CRITÉRIO 4: Acordo firmado e descumprido
      console.log("Critério 4 - Verificando acordos descumpridos...");
      const { data: acordosDescumpridos, error: acordosError } = await this.supabase
        .from("acordos_parcelamento")
        .select("id, status")
        .eq("cnpj_cliente", cobranca.cnpj)
        .eq("status", "descumprido");

      console.log("Acordos descumpridos:", acordosDescumpridos?.length || 0);
      const temAcordoDescumprido = !acordosError && (acordosDescumpridos?.length || 0) > 0;

      // CRITÉRIO 5: Reincidência em período de 6 meses
      console.log("Critério 5 - Verificando reincidência...");
      const dataReincidencia = new Date();
      dataReincidencia.setMonth(dataReincidencia.getMonth() - 6);
      
      const { data: escalonamentosAnteriores, error: reincidenciaError } = await this.supabase
        .from("escalonamentos_cobranca")
        .select("id")
        .eq("cnpj_unidade", cobranca.cnpj)
        .eq("nivel", "juridico")
        .gte("created_at", dataReincidencia.toISOString());

      console.log("Escalonamentos anteriores:", escalonamentosAnteriores?.length || 0);
      const temReincidencia = !reincidenciaError && (escalonamentosAnteriores?.length || 0) > 0;

      // Verifica se pelo menos um dos critérios adicionais foi atendido
      if (!temAcordoDescumprido && !temReincidencia) {
        return {
          sucesso: false,
          mensagem: "Necessário ter acordo descumprido OU reincidência nos últimos 6 meses para acionamento jurídico."
        };
      }

      console.log("=== TODOS OS CRITÉRIOS ATENDIDOS ===");
      console.log("✓ Valor superior a R$ 5.000");
      console.log("✓ 3+ cobranças ignoradas em 15 dias");
      console.log("✓ Score de risco = 0");
      console.log("✓ Acordo descumprido:", temAcordoDescumprido);
      console.log("✓ Reincidência 6 meses:", temReincidencia);

      // Verifica se já existe escalonamento jurídico
      console.log("Verificando escalonamento existente...");
      const { data: escalonamentoExistente, error: escalonamentoError } = await this.supabase
        .from("escalonamentos_cobranca")
        .select("id")
        .eq("titulo_id", cobranca.id)
        .eq("nivel", "juridico")
        .maybeSingle();

      if (escalonamentoExistente) {
        console.log("ERRO: Cobrança já escalonada");
        return {
          sucesso: false,
          mensagem: "Cobrança já está escalonada para o jurídico.",
        };
      }

      // Calcula risco baseado nos dias em atraso
      const diasAtraso = cobranca.dias_em_atraso || 0;
      let risco = "baixo";
      if (diasAtraso >= 91 && diasAtraso <= 180) {
        risco = "medio";
      } else if (diasAtraso > 180) {
        risco = "alto";
      }

      // Monta motivo detalhado
      const motivosDetalhados: string[] = [];
      motivosDetalhados.push(`Valor: ${valorAtualizado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
      motivosDetalhados.push(`${cobrancasIgnoradas?.length || 0} cobranças ignoradas em 15 dias`);
      motivosDetalhados.push("Score de risco: 0");
      if (temAcordoDescumprido) motivosDetalhados.push("Acordo descumprido");
      if (temReincidencia) motivosDetalhados.push("Reincidência nos últimos 6 meses");

      console.log("Criando registro de escalonamento...");
      const { error: insertError } = await this.supabase.from("escalonamentos_cobranca").insert({
        titulo_id: cobranca.id,
        cnpj_unidade: cobranca.cnpj,
        motivo_escalonamento: `Acionamento automático: ${motivosDetalhados.join("; ")}`,
        nivel: "juridico",
        status: "pendente",
        valor_total_envolvido: valorAtualizado,
        quantidade_titulos: 1,
        observacoes: `Escalonamento automático baseado nos novos critérios. Risco: ${risco}. Data: ${new Date().toISOString()}`,
      });

      if (insertError) {
        console.log("ERRO ao inserir escalonamento:", insertError);
        return { sucesso: false, mensagem: `Erro ao criar escalonamento: ${insertError.message}` };
      }

      console.log("Escalonamento criado com sucesso!");

      // Atualiza status da cobrança
      console.log("Atualizando status da cobrança...");
      const { error: updateError } = await this.supabase
        .from("cobrancas_franqueados")
        .update({ status: "judicial", risco_juridico: risco })
        .eq("id", cobranca.id);

      if (updateError) {
        console.log("ERRO ao atualizar cobrança:", updateError);
      } else {
        console.log("Status da cobrança atualizado!");
      }

      // Atualiza status jurídico da unidade
      if (cobranca.unidades_franqueadas?.id) {
        console.log("Atualizando status da unidade...");
        const { error: unidadeUpdateError } = await this.supabase
          .from("unidades_franqueadas")
          .update({
            juridico_status: "acionado",
            data_ultimo_acionamento: new Date().toISOString(),
          })
          .eq("id", cobranca.unidades_franqueadas.id);

        if (unidadeUpdateError) {
          console.log("ERRO ao atualizar unidade:", unidadeUpdateError);
        } else {
          console.log("Status da unidade atualizado!");
        }
      }

      // Busca template e parâmetros
      console.log("Buscando critérios jurídicos...");
      const { data: criterios, error: criteriosError } = await this.supabase
        .from("criterios_juridico")
        .select(
          "template_notificacao_extrajudicial, prazo_resposta_notificacao_dias, email_responsavel_juridico"
        )
        .eq("id", "default")
        .single();

      console.log("Preparando notificações...");
      // Monta mensagem de notificação extrajudicial
      const unidade = cobranca.unidades_franqueadas || {};
      const template = criterios?.template_notificacao_extrajudicial || "Template padrão para {{nome_franqueado}}";
      const prazoResposta = criterios?.prazo_resposta_notificacao_dias || 5;

      const mensagem = template
        .replace(/{{nome_franqueado}}/g, unidade.nome_franqueado || "")
        .replace(/{{dias_em_aberto}}/g, diasAtraso.toString())
        .replace(
          /{{valor_total}}/g,
          valorAtualizado?.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }) || ""
        )
        .replace(/{{prazo_resposta}}/g, prazoResposta.toString())
        .replace(/{{codigo_unidade}}/g, unidade.codigo_unidade || "")
        .replace(
          /{{data_vencimento_antiga}}/g,
          cobranca.data_vencimento
            ? new Date(cobranca.data_vencimento).toLocaleDateString("pt-BR")
            : ""
        )
        .replace(
          /{{motivo_acionamento}}/g,
          motivosDetalhados.join("; ")
        );

      console.log("Mensagem preparada:", mensagem.substring(0, 100) + "...");

      // ENVIO DE EMAIL (usando Resend API)
      if (unidade.email_franqueado) {
        console.log("Enviando e-mail para:", unidade.email_franqueado);
        await this.enviarEmail({
          destinatario: unidade.email_franqueado,
          nome_destinatario: unidade.nome_franqueado || cobranca.cliente,
          assunto: "🚨 NOTIFICAÇÃO EXTRAJUDICIAL - Acionamento Jurídico",
          corpo_html: `<div>${mensagem.replace(/\n/g, "<br>")}</div>`,
          corpo_texto: mensagem,
        });
      } else {
        console.log("Nenhum e-mail configurado para envio");
      }

      // ENVIO DE WHATSAPP (usando Evolution API)
      if (unidade.telefone_franqueado) {
        console.log("Enviando WhatsApp para:", unidade.telefone_franqueado);
        await this.enviarWhatsApp({
          instanceName: "automacoes_backup",
          number: unidade.telefone_franqueado,
          text: `🚨 NOTIFICAÇÃO EXTRAJUDICIAL\n\n${mensagem}`,
        });
      } else {
        console.log("Nenhum telefone configurado para envio");
      }

      console.log("=== SUCESSO ===");
      return {
        sucesso: true,
        mensagem: "Cobrança acionada no jurídico com sucesso. Todos os critérios foram validados.",
      };
    } catch (error) {
      console.error("=== ERRO FATAL ===");
      console.error("Erro ao acionar jurídico individual:", error);
      console.error("Stack trace:", error.stack);
      return { sucesso: false, mensagem: `Erro ao acionar jurídico: ${error.message}` };
    }
  }

  private async enviarEmail(params: any) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas. E-mail não será enviado.");
      return;
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          to: params.destinatario,
          subject: params.assunto,
          html: params.corpo_html,
          text: params.corpo_texto,
          from: "nao-responda@crescieperdi.com.br",
          fromName: "Cresci e Perdi - Jurídico",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Erro ao enviar e-mail:", errorData);
      } else {
        const data = await res.json();
        console.log("E-mail enviado com sucesso:", data.messageId);
      }
    } catch (error) {
      console.error("Erro no serviço de e-mail:", error);
    }
  }

  private async enviarWhatsApp(params: any) {
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.warn("Variáveis da Evolution API não configuradas. WhatsApp não será enviado.");
      return;
    }

    try {
      // Limpa o número e garante o prefixo 55
      let numeroLimpo = params.number.replace(/\D/g, "");
      if (!numeroLimpo.startsWith("55")) {
        numeroLimpo = "55" + numeroLimpo;
      }
      
      console.log(`Preparando para enviar WhatsApp para o número formatado: ${numeroLimpo}`);

      const url = `${evolutionApiUrl}/message/sendText/${params.instanceName}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionApiKey,
        },
        // Corpo da requisição conforme especificações fornecidas
        body: JSON.stringify({
          number: numeroLimpo,
          text: params.text,
        }),
      });

      if (!res.ok) {
        const errorResponse = await res.text();
        console.error(`Erro ao enviar WhatsApp: Status ${res.status} - ${res.statusText}`);
        console.error("Resposta da API:", errorResponse);
      } else {
        const data = await res.json();
        console.log("WhatsApp enviado com sucesso:", data);
      }
    } catch (error) {
      console.error("Erro fatal no serviço de WhatsApp:", error);
    }
  }
}

export const cobrancaService = new CobrancaService();