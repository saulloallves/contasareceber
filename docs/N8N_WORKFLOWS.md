# Workflows n8n - Sistema de Cobrança

## 🔄 Workflow Principal: Processamento de Planilha Semanal

### Gatilho: Upload de Planilha
```json
{
  "nodes": [
    {
      "name": "Webhook - Upload Planilha",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "upload-planilha",
        "httpMethod": "POST",
        "responseMode": "responseNode"
      }
    }
  ]
}
```

### 1. Processamento da Planilha
```json
{
  "name": "Processar Excel",
  "type": "n8n-nodes-base.spreadsheetFile",
  "parameters": {
    "operation": "read",
    "binaryPropertyName": "data",
    "options": {
      "headerRow": 1,
      "range": "A:Z"
    }
  }
}
```

### 2. Validação e Limpeza
```javascript
// Node Function - Validar Dados
const validatedItems = [];

for (const item of $input.all()) {
  // Validar CNPJ
  const cnpj = item.json.CNPJ?.toString().replace(/\D/g, '');
  if (!cnpj || cnpj.length !== 14) {
    continue; // Pula linha inválida
  }

  // Validar valor
  const valor = parseFloat(item.json.VALOR?.toString().replace(',', '.'));
  if (!valor || valor <= 0) {
    continue;
  }

  // Validar data
  const dataVencimento = new Date(item.json.DATA_VENCIMENTO);
  if (isNaN(dataVencimento.getTime())) {
    continue;
  }

  // Calcular dias em atraso
  const hoje = new Date();
  const diasAtraso = Math.max(0, Math.floor((hoje - dataVencimento) / (1000 * 60 * 60 * 24)));

  // Calcular valor atualizado
  const percentualMulta = 2.0; // 2%
  const percentualJurosDia = 0.033; // 0.033% ao dia
  
  let valorAtualizado = valor;
  if (diasAtraso > 0) {
    const multa = valor * (percentualMulta / 100);
    const juros = valor * (percentualJurosDia / 100) * diasAtraso;
    valorAtualizado = valor + multa + juros;
  }

  validatedItems.push({
    cnpj: cnpj,
    cliente: item.json.CLIENTE?.toString().trim(),
    valor_original: valor,
    valor_recebido: parseFloat(item.json.VALOR_RECEBIDO?.toString().replace(',', '.')) || 0,
    data_vencimento: dataVencimento.toISOString().split('T')[0],
    dias_em_atraso: diasAtraso,
    valor_atualizado: valorAtualizado,
    status: 'novo',
    referencia_importacao: `IMP_${Date.now()}`
  });
}

return validatedItems;
```

### 3. Inserção/Atualização no Supabase
```json
{
  "name": "Upsert Cobrancas",
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "upsert",
    "table": "cobrancas_franqueados",
    "onConflict": "hash_titulo",
    "fieldsUi": {
      "fieldValues": [
        {
          "fieldId": "cnpj",
          "fieldValue": "={{ $json.cnpj }}"
        },
        {
          "fieldId": "cliente", 
          "fieldValue": "={{ $json.cliente }}"
        },
        {
          "fieldId": "valor_original",
          "fieldValue": "={{ $json.valor_original }}"
        },
        {
          "fieldId": "valor_atualizado",
          "fieldValue": "={{ $json.valor_atualizado }}"
        },
        {
          "fieldId": "data_vencimento",
          "fieldValue": "={{ $json.data_vencimento }}"
        },
        {
          "fieldId": "dias_em_atraso",
          "fieldValue": "={{ $json.dias_em_atraso }}"
        },
        {
          "fieldId": "status",
          "fieldValue": "={{ $json.status }}"
        }
      ]
    }
  }
}
```

## 📱 Workflow: Envio Automático WhatsApp

### Gatilho: Após Inserção de Cobranças
```json
{
  "name": "Buscar Titulos Para Cobranca",
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "getAll",
    "table": "cobrancas_franqueados",
    "filterType": "manual",
    "matchType": "allFilters",
    "filters": [
      {
        "field": "status",
        "operator": "eq",
        "value": "em_aberto"
      },
      {
        "field": "dias_em_atraso",
        "operator": "gte", 
        "value": 1
      },
      {
        "field": "telefone",
        "operator": "neq",
        "value": null
      }
    ]
  }
}
```

### Geração de Mensagem Personalizada
```javascript
// Node Function - Gerar Mensagem
const mensagens = [];

for (const item of $input.all()) {
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(item.json.valor_atualizado);

  const dataVencimento = new Date(item.json.data_vencimento).toLocaleDateString('pt-BR');
  
  const mensagem = `Olá, ${item.json.cliente}!

Consta um débito da sua unidade, vencido em ${dataVencimento}.
Valor atualizado até hoje: *${valorFormatado}*

Deseja regularizar? https://calendly.com/sua-empresa/negociacao

Acesse seu painel: https://painel.crescieperdi.com/franqueado

_Esta é uma mensagem automática do sistema de cobrança._`;

  mensagens.push({
    titulo_id: item.json.id,
    telefone: item.json.telefone,
    mensagem: mensagem,
    cliente: item.json.cliente,
    cnpj: item.json.cnpj
  });
}

return mensagens;
```

### Envio via WhatsApp API
```json
{
  "name": "Enviar WhatsApp",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://graph.facebook.com/v18.0/{{ $env.WHATSAPP_PHONE_ID }}/messages",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "httpHeaderAuth": {
      "name": "Authorization",
      "value": "Bearer {{ $env.WHATSAPP_TOKEN }}"
    },
    "sendBody": true,
    "bodyContentType": "json",
    "jsonBody": "{\n  \"messaging_product\": \"whatsapp\",\n  \"to\": \"{{ $json.telefone }}\",\n  \"type\": \"text\",\n  \"text\": {\n    \"body\": \"{{ $json.mensagem }}\"\n  }\n}"
  }
}
```

### Registro de Envio
```json
{
  "name": "Registrar Envio",
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "insert",
    "table": "envios_mensagem",
    "fieldsUi": {
      "fieldValues": [
        {
          "fieldId": "titulo_id",
          "fieldValue": "={{ $('Gerar Mensagem').item.json.titulo_id }}"
        },
        {
          "fieldId": "cliente",
          "fieldValue": "={{ $('Gerar Mensagem').item.json.cliente }}"
        },
        {
          "fieldId": "telefone",
          "fieldValue": "={{ $('Gerar Mensagem').item.json.telefone }}"
        },
        {
          "fieldId": "mensagem_enviada",
          "fieldValue": "={{ $('Gerar Mensagem').item.json.mensagem }}"
        },
        {
          "fieldId": "status_envio",
          "fieldValue": "={{ $json.success ? 'sucesso' : 'falha' }}"
        }
      ]
    }
  }
}
```

## 🔍 Workflow: Verificação de Escalonamentos

### Gatilho: Cron Job Diário
```json
{
  "name": "Cron Verificacao Diaria",
  "type": "n8n-nodes-base.cron",
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 9 * * *"
        }
      ]
    }
  }
}
```

### Verificação de Critérios
```javascript
// Node Function - Verificar Criterios Escalonamento
const criterios = [];

// Buscar títulos que atendem critérios de escalonamento
const titulosParaEscalar = $input.all().filter(item => {
  const dados = item.json;
  
  // Critério 1: Atraso > 90 dias sem tratativas
  if (dados.dias_em_atraso > 90 && !dados.tem_tratativas_resolutivas) {
    return true;
  }
  
  // Critério 2: Valor > R$ 20.000 por unidade
  if (dados.valor_total_unidade > 20000) {
    return true;
  }
  
  // Critério 3: 3+ reuniões falhadas
  if (dados.reunioes_falhadas >= 3) {
    return true;
  }
  
  // Critério 4: Status crítico manual
  if (dados.status === 'em_tratativa_critica') {
    return true;
  }
  
  return false;
});

return titulosParaEscalar.map(item => ({
  titulo_id: item.json.id,
  cnpj_unidade: item.json.cnpj,
  motivo_escalonamento: determinarMotivo(item.json),
  nivel: determinarNivel(item.json),
  valor_total_envolvido: item.json.valor_total_unidade || item.json.valor_atualizado
}));

function determinarMotivo(dados) {
  if (dados.dias_em_atraso > 90) return 'Atraso superior a 90 dias sem resolução';
  if (dados.valor_total_unidade > 20000) return 'Valor elevado em aberto (>R$ 20.000)';
  if (dados.reunioes_falhadas >= 3) return 'Múltiplas falhas em reuniões agendadas';
  return 'Tratativa crítica identificada';
}

function determinarNivel(dados) {
  if (dados.valor_total_unidade > 50000) return 'diretoria';
  if (dados.dias_em_atraso > 120) return 'juridico';
  return 'juridico';
}
```

## 📊 Workflow: Geração de Relatório Mensal

### Gatilho: 1º de cada mês
```json
{
  "name": "Cron Relatorio Mensal",
  "type": "n8n-nodes-base.cron", 
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 8 1 * *"
        }
      ]
    }
  }
}
```

### Coleta de Dados Consolidados
```javascript
// Node Function - Consolidar Dados Mes
const mesAnterior = new Date();
mesAnterior.setMonth(mesAnterior.getMonth() - 1);
const referenciaMs = mesAnterior.toISOString().slice(0, 7); // YYYY-MM

// Buscar dados do mês anterior
const dadosConsolidados = {
  periodo: {
    inicio: new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1).toISOString(),
    fim: new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0).toISOString(),
    referencia: referenciaMs
  },
  visao_geral: {
    valor_total_vencido: 0,
    valor_recebido_mes: 0,
    total_titulos_vencidos: 0,
    media_dias_atraso: 0,
    percentual_inadimplencia: 0
  },
  por_status: [],
  ranking_regional: [],
  curva_recuperacao: [],
  eficiencia_atendimento: {
    mensagens_enviadas: 0,
    reunioes_realizadas: 0,
    propostas_aceitas: 0,
    negociacoes_efetivas: 0,
    taxa_conversao: 0
  },
  escalonamentos_criticos: {
    total_escalonamentos: 0,
    por_nivel: [],
    valor_total_envolvido: 0,
    casos_reincidentes: 0
  }
};

return [{
  json: {
    referencia_mes: referenciaMs,
    dados_consolidados: dadosConsolidados,
    gerado_por: 'sistema_automatico'
  }
}];
```

### Geração de PDF
```javascript
// Node Function - Gerar HTML Relatorio
const dados = $input.first().json.dados_consolidados;

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório Mensal - ${dados.periodo.referencia}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; border-bottom: 3px solid #007bff; padding-bottom: 20px; }
    .metric { display: inline-block; margin: 20px; text-align: center; }
    .metric .value { font-size: 24px; font-weight: bold; color: #007bff; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO MENSAL DE INADIMPLÊNCIA</h1>
    <h2>Rede Cresci e Perdi</h2>
    <p>Período: ${dados.periodo.referencia}</p>
  </div>
  
  <div class="metrics">
    <div class="metric">
      <div class="value">R$ ${dados.visao_geral.valor_total_vencido.toLocaleString('pt-BR')}</div>
      <div>Total Vencido</div>
    </div>
    <div class="metric">
      <div class="value">R$ ${dados.visao_geral.valor_recebido_mes.toLocaleString('pt-BR')}</div>
      <div>Recebido no Mês</div>
    </div>
    <div class="metric">
      <div class="value">${dados.visao_geral.percentual_inadimplencia.toFixed(1)}%</div>
      <div>Inadimplência</div>
    </div>
  </div>
  
  <!-- Mais seções do relatório -->
</body>
</html>
`;

return [{ json: { html_content: htmlTemplate } }];
```

## 🔔 Workflow: Notificações e Alertas

### Slack/Teams para Escalonamentos
```json
{
  "name": "Notificar Slack",
  "type": "n8n-nodes-base.slack",
  "parameters": {
    "operation": "postMessage",
    "channel": "#juridico",
    "text": "🚨 Novo escalonamento crítico:\n\nCliente: {{ $json.cliente }}\nCNPJ: {{ $json.cnpj }}\nValor: R$ {{ $json.valor_total_envolvido }}\nMotivo: {{ $json.motivo_escalonamento }}"
  }
}
```

### Email para Diretoria
```json
{
  "name": "Email Diretoria",
  "type": "n8n-nodes-base.emailSend",
  "parameters": {
    "fromEmail": "sistema@crescieperdi.com",
    "toEmail": "diretoria@crescieperdi.com",
    "subject": "Relatório Mensal - {{ $json.referencia_mes }}",
    "emailType": "html",
    "message": "Segue em anexo o relatório mensal consolidado de inadimplência da rede."
  }
}
```

## 🔄 Workflow: Sincronização de Status

### Webhook para Atualizações Externas
```json
{
  "name": "Webhook Status Update",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "path": "update-status",
    "httpMethod": "POST",
    "responseMode": "responseNode"
  }
}
```

### Atualização de Múltiplas Tabelas
```javascript
// Node Function - Sincronizar Status
const updates = [];

for (const item of $input.all()) {
  const { titulo_id, novo_status, usuario, observacao } = item.json;
  
  // Atualizar cobrança
  updates.push({
    table: 'cobrancas_franqueados',
    id: titulo_id,
    data: { status: novo_status }
  });
  
  // Registrar tratativa
  updates.push({
    table: 'tratativas_cobranca',
    data: {
      titulo_id: titulo_id,
      tipo_interacao: 'atualizacao_status',
      usuario_sistema: usuario,
      descricao: observacao || `Status alterado para: ${novo_status}`,
      status_cobranca_resultante: novo_status
    }
  });
}

return updates;
```

## 📋 Configurações de Ambiente

### Variáveis de Ambiente n8n
```env
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_KEY=sua-chave-servico

# WhatsApp Business API
WHATSAPP_TOKEN=seu-token-whatsapp
WHATSAPP_PHONE_ID=seu-phone-number-id

# Calendly
CALENDLY_TOKEN=seu-token-calendly
CALENDLY_USER=seu-usuario-calendly

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=sistema@crescieperdi.com
SMTP_PASS=sua-senha-app

# Slack
SLACK_TOKEN=seu-token-slack
SLACK_CHANNEL=#juridico

# URLs
PAINEL_FRANQUEADO_URL=https://painel.crescieperdi.com/franqueado
AGENDAMENTO_URL=https://calendly.com/crescieperdi/negociacao
```

## 🔄 Cronograma de Execução

| Workflow | Frequência | Horário | Descrição |
|----------|------------|---------|-----------|
| Processamento Planilha | Manual/Webhook | - | Após upload |
| Envio WhatsApp | Após processamento | - | Imediato |
| Verificação Escalonamentos | Diário | 09:00 | Segunda a sexta |
| Relatório Mensal | Mensal | 08:00 | Dia 1º |
| Verificação Reuniões | Diário | 18:00 | Todos os dias |
| Backup Dados | Diário | 02:00 | Madrugada |

## 🧪 Testes e Validação

### Cenários de Teste
1. **Upload planilha duplicada** → Verificar merge correto
2. **Franqueado sem telefone** → Pular envio WhatsApp
3. **Reunião não realizada** → Escalonamento automático
4. **Valor > R$ 20.000** → Escalonamento imediato
5. **Token expirado** → Renovação automática

### Monitoramento
- **Logs detalhados** em cada node
- **Alertas** para falhas críticas
- **Dashboard** de execuções no n8n
- **Métricas** de performance e sucesso