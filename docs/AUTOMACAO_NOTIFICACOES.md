# 🤖 Sistema de Automação de Notificações

## 📋 Visão Geral

O sistema de automação de notificações monitora automaticamente todas as cobranças com status `em_aberto` e identifica quando devem receber notificações baseadas em marcos temporais.

## 🎯 Marcos de Notificação

- **3 dias**: Primeira notificação de lembrete
- **7 dias**: Notificação de atenção
- **15 dias**: Notificação urgente
- **30 dias**: Última notificação antes de ação jurídica

## 👤 Personalização de Mensagens

### Para Cobranças CNPJ:
- Sistema busca automaticamente o **franqueado principal** vinculado à unidade
- Mensagens personalizadas: *"Olá, João!"* ao invés de *"Olá, VILA PRUDENTE"*
- Inclui nome da unidade: *"débito da unidade Vila Prudente"*
- Dados completos para contato (email e telefone do franqueado)

### Para Cobranças CPF:
- Usa o nome do cliente diretamente
- Mensagens padrão sem vínculo de unidade

## 🏗️ Arquitetura

### Serviços

- **AutomacaoNotificacaoService**: Responsável pela lógica de identificação e processamento de cobranças
- **CronJobService**: Gerencia o agendamento e execução automática diária

### Componentes

- **PainelAutomacaoNotificacoes**: Interface de controle e monitoramento

## 🔧 Como Funciona

### 1. Verificação Diária
- Executa automaticamente às 9:00 AM (configurável)
- Busca todas as cobranças com status `em_aberto`
- Calcula dias decorridos desde a criação usando timezone de São Paulo

### 2. Identificação de Marcos
```typescript
// Calcula próximo marco baseado em dias decorridos e último disparo
const marcos = [3, 7, 15, 30];
const ultimoDisparo = cobranca.ultimo_disparo_dia ?? -1;
const candidatos = marcos.filter(d => d <= diasDecorridos && d > ultimoDisparo);
const proximoMarco = candidatos.length ? Math.max(...candidatos) : null;
```

### 3. Controle de Travas
```typescript
// Estrutura das colunas JSON no banco
notificacao_automatica_whatsapp: {
  "3": false,   // true = já enviado
  "7": false,   
  "15": false,  
  "30": false   
}
```

### 4. Integração com Webhooks
O sistema apenas **identifica** quais cobranças precisam de notificação. O envio real deve ser implementado via webhooks existentes no sistema.

## 🗄️ Estrutura do Banco

### Colunas Necessárias na Tabela `cobrancas_franqueados`:

```sql
-- Controle de marcos WhatsApp
notificacao_automatica_whatsapp JSONB DEFAULT '{"3": false, "7": false, "15": false, "30": false}'

-- Controle de marcos Email  
notificacao_automatica_email JSONB DEFAULT '{"3": false, "7": false, "15": false, "30": false}'

-- Último dia de disparo realizado
ultimo_disparo_dia INTEGER
```

### Índice para Performance:
```sql
CREATE INDEX idx_cobrancas_status_created_at 
ON cobrancas_franqueados (status, created_at) 
WHERE status = 'em_aberto';
```

## 🎛️ Interface de Controle

Acesse **Automação de Notificações** no menu lateral para:

- ✅ **Iniciar/Parar** agendador automático
- ⏰ **Configurar horário** de execução
- ▶️ **Executar verificações manuais**
- 📊 **Visualizar resultados** das verificações
- 🔄 **Resetar notificações** de cobranças específicas

## 🚀 API Principal

### Verificar Cobranças para Notificação
```typescript
const resultado = await automacaoNotificacaoService.verificarCobrancasParaNotificacao();
// Retorna array de cobranças que precisam de notificação
```

### Marcar Notificação como Enviada
```typescript
await automacaoNotificacaoService.marcarNotificacaoEnviada(
  cobrancaId, 
  marco,      // 3, 7, 15 ou 30
  canal       // 'whatsapp' ou 'email'
);
```

### Resetar Notificações (para testes)
```typescript
await automacaoNotificacaoService.resetarNotificacoes(cobrancaId);
```

## 📱 Integração com Webhooks

### Exemplo de Integração:
```typescript
// No CronJobService, após identificar cobranças:
for (const cobranca of resultado) {
  if (cobranca.deve_notificar_whatsapp) {
    // Chama seu webhook de WhatsApp existente
    await chamarWebhookWhatsApp(cobranca);
    
    // Marca como enviado
    await automacaoNotificacaoService.marcarNotificacaoEnviada(
      cobranca.id, 
      cobranca.proximo_marco, 
      'whatsapp'
    );
  }
  
  if (cobranca.deve_notificar_email) {
    // Chama seu webhook de Email existente
    await chamarWebhookEmail(cobranca);
    
    // Marca como enviado
    await automacaoNotificacaoService.marcarNotificacaoEnviada(
      cobranca.id, 
      cobranca.proximo_marco, 
      'email'
    );
  }
}
```

## 🔍 Logs e Monitoramento

O sistema gera logs detalhados no console:
- 🔄 Início/fim de verificações
- 📊 Quantidade de cobranças processadas
- ✅ Notificações identificadas
- ❌ Erros de processamento

## ⚙️ Configurações

### Alterar Horário de Execução:
```typescript
cronJobService.configurarHorario(10, 30); // 10:30 AM
```

### Verificar Status:
```typescript
const info = cronJobService.obterProximoAgendamento();
console.log(info.proximaExecucao, info.tempoRestante, info.estaAtivo);
```

## 🧪 Testes

### Execução Manual:
- Use o botão "Executar Verificação Manual" no painel
- Ou chame: `await cronJobService.executarManualmente()`

### Reset de Notificações:
- Use o botão "Reset" ao lado de cada cobrança
- Útil para testar o mesmo cenário múltiplas vezes

## 📈 Performance

- Consulta otimizada com índice específico
- Processamento em lote eficiente
- Timezone handling preciso (São Paulo)
- Controle de estado para evitar duplicações

## 🔒 Segurança

- Apenas usuários com permissões `admin` ou `financeiro` podem acessar
- Logs auditáveis de todas as operações
- Controle de travas para prevenir envios duplicados

---

**💡 Dica**: Este sistema substitui completamente a funcionalidade que estava no n8n, mantendo a mesma lógica mas com melhor controle e integração ao sistema principal.
