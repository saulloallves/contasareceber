# Exemplo de Uso do WhatsApp com Validação Automática

Com a função `tratarTelefone` agora centralizada no `n8nService`, todas as telas que precisarem enviar mensagens WhatsApp terão validação automática dos números de telefone.

## Como usar em outras telas:

### 1. Importar o serviço
```typescript
import { n8nService } from '../services/n8nService';
```

### 2. Usar o método enviarWhatsApp
```typescript
const enviarWhatsApp = async (telefone: string, mensagem: string) => {
  try {
    // O n8nService agora valida e trata o telefone automaticamente
    const resultado = await n8nService.enviarWhatsApp({
      number: telefone, // Pode ser o telefone "sujo" do banco
      text: mensagem,
      instanceName: "primary", // ou conforme sua configuração
      metadata: {
        // dados adicionais para o webhook
      }
    });

    if (resultado.success) {
      console.log('WhatsApp enviado com sucesso:', resultado.messageId);
      // Exibir sucesso para o usuário
    } else {
      console.error('Erro no envio:', resultado);
      // Exibir erro para o usuário
    }
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    // A validação de telefone já retorna erros específicos:
    // - "Número de telefone não informado"
    // - "Número de telefone não disponível" 
    // - "Não é possível enviar WhatsApp para telefone fixo"
    // - "Número de celular inválido - deve começar com 9"
    // etc.
  }
};
```

### 3. Exemplo prático em um componente:
```typescript
import React from 'react';
import { n8nService } from '../services/n8nService';

const ExemploComponente = () => {
  const enviarNotificacao = async (unidade: any) => {
    try {
      await n8nService.enviarWhatsApp({
        number: unidade.telefone, // Telefone pode estar "sujo"
        text: `Olá ${unidade.nome}, você tem uma nova notificação!`,
        instanceName: "primary",
        metadata: {
          unidadeId: unidade.id,
          tipo: "notificacao_geral"
        }
      });
      
      alert('Notificação enviada com sucesso!');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  return (
    <button onClick={() => enviarNotificacao(unidadeSelecionada)}>
      Enviar WhatsApp
    </button>
  );
};
```

## Validações automáticas que acontecem:

1. **Telefone nulo/vazio**: Retorna erro específico
2. **"Não possui" no campo**: Detecta e retorna erro
3. **Telefone fixo**: Detecta números de 10 dígitos e rejeita
4. **Formato inválido**: Valida se é celular brasileiro válido
5. **Código do país**: Adiciona automaticamente o "55" se necessário
6. **Limpeza**: Remove caracteres especiais automaticamente

## Benefícios:

- ✅ **Centralizado**: Uma única função para todas as telas
- ✅ **Consistente**: Mesma validação em todo o sistema
- ✅ **Automático**: Não precisa validar manualmente em cada tela
- ✅ **Robusto**: Trata todos os casos edge conhecidos
- ✅ **Mensagens claras**: Erros específicos para cada situação
