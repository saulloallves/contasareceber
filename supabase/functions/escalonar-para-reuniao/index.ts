// Edge Function: Escalonamento automático para reunião jurídica
// Roda periodicamente (ex: via cron) e convida para reunião casos jurídicos sem resposta

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuração do Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CALENDLY_LINK = 'https://calendly.com/crescieperdi';

async function convidarParaReuniao(escalonamentoId: string, unidade: any) {
  // Verifica duplicidade
  const { data: reuniaoExistente } = await supabase
    .from('reunioes_juridico')
    .select('id')
    .eq('escalonamento_id_fk', escalonamentoId)
    .maybeSingle();
  if (reuniaoExistente) return;

  // Cria registro
  await supabase.from('reunioes_juridico').insert({
    unidade_id_fk: unidade.id,
    escalonamento_id_fk: escalonamentoId,
    status: 'convite_enviado',
    link_calendly: CALENDLY_LINK,
  });

  // Envia e-mail (simples)
  if (unidade.email_franqueado) {
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: unidade.email_franqueado,
        subject: 'Convocação para Reunião Jurídica - Cresci e Perdi',
        text: `Prezado(a) ${unidade.nome_franqueado || 'Franqueado(a)'},\n\nDevido à falta de resolução da pendência financeira de sua unidade, mesmo após o acionamento jurídico, estamos convocando-o(a) para uma reunião com nosso departamento responsável.\n\nO objetivo é discutir os próximos passos e buscar uma solução definitiva para evitar medidas mais severas.\n\nPor favor, agende o melhor horário para você através do link abaixo:\n${CALENDLY_LINK}\n\nSua presença é fundamental. O não agendamento ou ausência na reunião será interpretado como falta de interesse na resolução amigável do débito.\n\nAtenciosamente,\nDepartamento Jurídico\nCresci e Perdi`,
        html: `<div>Prezado(a) <b>${unidade.nome_franqueado || 'Franqueado(a)'}</b>,<br><br>Devido à falta de resolução da pendência financeira de sua unidade, mesmo após o acionamento jurídico, estamos convocando-o(a) para uma reunião com nosso departamento responsável.<br><br>O objetivo é discutir os próximos passos e buscar uma solução definitiva para evitar medidas mais severas.<br><br><b>Por favor, agende o melhor horário para você através do link abaixo:</b><br><a href='${CALENDLY_LINK}'>${CALENDLY_LINK}</a><br><br>Sua presença é fundamental. O não agendamento ou ausência na reunião será interpretado como falta de interesse na resolução amigável do débito.<br><br>Atenciosamente,<br>Departamento Jurídico<br>Cresci e Perdi</div>`,
        from: 'nao-responda@crescieperdi.com.br',
        fromName: 'Cresci e Perdi - Jurídico',
      }),
    });
  }
  // WhatsApp pode ser integrado aqui futuramente
}

Deno.serve(async (_req) => {
  // Busca escalonamentos jurídicos com mais de 7 dias e sem reunião jurídica
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: escalonamentos, error } = await supabase
    .from('escalonamentos_cobranca')
    .select(`id, created_at, unidade:unidades_franqueadas(id, nome_franqueado, email_franqueado, telefone_franqueado)`)
    .eq('nivel', 'juridico')
    .lte('created_at', seteDiasAtras);

  if (error) {
    return new Response(JSON.stringify({ sucesso: false, mensagem: 'Erro ao buscar escalonamentos', error }), { status: 500 });
  }

  let total = 0;
  for (const esc of escalonamentos || []) {
    if (!esc.unidade) continue;
    // Só convida se não houver reunião jurídica
    const { data: reuniao } = await supabase
      .from('reunioes_juridico')
      .select('id')
      .eq('escalonamento_id_fk', esc.id)
      .maybeSingle();
    if (!reuniao) {
      await convidarParaReuniao(esc.id, esc.unidade);
      total++;
    }
  }

  return new Response(JSON.stringify({ sucesso: true, total_convidados: total }), { status: 200 });
});
