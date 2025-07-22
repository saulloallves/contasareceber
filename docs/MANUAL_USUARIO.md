# Manual do Usuário - Sistema de Cobrança

## 👋 Bem-vindo ao Sistema de Cobrança

Este manual irá guiá-lo através de todas as funcionalidades do sistema, desde o upload de planilhas até o acompanhamento de cobranças.

---

## 🚀 Primeiros Passos

### 1. Acesso ao Sistema
1. Acesse a URL do sistema fornecida pela equipe técnica
2. Faça login com suas credenciais
3. Você será direcionado para o Dashboard principal

### 2. Navegação Principal
O sistema possui as seguintes seções:
- **📊 Dashboard**: Visão geral e métricas
- **🎯 Painel Operacional**: Gestão de cobranças
- **📁 Importação**: Upload de planilhas
- **📝 Tratativas**: Histórico de interações
- **⚙️ Configurações**: Parâmetros do sistema
- **📱 WhatsApp Config**: Configuração de mensagens
- **📋 Histórico Envios**: Log de mensagens enviadas

---

## 📊 Dashboard

### Visão Geral
O Dashboard apresenta métricas importantes sobre a inadimplência:

#### Cards Principais
- **💰 Total em Aberto**: Soma de todos os valores em aberto
- **✅ Total Quitado**: Valores já recebidos
- **🤝 Em Negociação**: Títulos sendo negociados
- **📈 Taxa de Conversão**: Eficiência das cobranças

#### Gráficos Disponíveis
- **Pizza**: Distribuição por status (em aberto, quitado, negociando)
- **Barras**: Valores por faixa de atraso
- **Linha**: Evolução mensal de recebimentos
- **Tabela**: Ranking das unidades mais inadimplentes

### Como Usar os Filtros
1. Clique em "Filtros" no topo da página
2. Selecione os critérios desejados:
   - **Data Início/Fim**: Período de análise
   - **Status**: Tipo de cobrança
   - **CNPJ**: Franqueado específico
3. Clique em "Aplicar Filtros"

### Exportar Dados
1. Clique no botão "Exportar" no canto superior direito
2. O arquivo CSV será baixado automaticamente
3. Abra no Excel para análises detalhadas

---

## 🎯 Painel Operacional

### Visão Geral
O Painel Operacional é onde você gerencia o dia a dia das cobranças.

### Filtros Avançados
#### Filtros Disponíveis:
- **Status**: em_aberto, negociando, cobrado, quitado, novo
- **Busca**: Digite nome do cliente ou CNPJ
- **Faixa de Atraso**: 0-30, 31-90, 91-180, 180+ dias
- **Valor**: Mínimo e máximo
- **Vencimento**: Período de vencimento

#### Como Aplicar Filtros:
1. Preencha os campos desejados na seção "Filtros"
2. Clique em "Aplicar Filtros"
3. Use "Limpar" para resetar todos os filtros

### Ações Rápidas

#### 👁️ Ver Histórico
1. Clique no ícone de olho na linha da cobrança
2. Uma janela mostrará toda a timeline de interações
3. Você pode ver mensagens enviadas, observações e mudanças de status

#### ✅ Marcar como Quitado
1. Clique no ícone de check verde
2. Preencha:
   - **Valor Pago**: Quanto foi recebido
   - **Forma de Pagamento**: PIX, transferência, etc.
   - **Observações**: Detalhes adicionais
3. Clique em "Confirmar Quitação"

#### 📝 Adicionar Observação
1. Clique no ícone de documento
2. Digite sua observação no campo de texto
3. Opcionalmente, altere o status da cobrança
4. Clique em "Salvar Observação"

#### 📤 Reenviar Mensagem
1. Clique no ícone de mensagem (apenas se houver telefone)
2. A mensagem será enviada automaticamente via WhatsApp
3. O resultado aparecerá como notificação

#### 📅 Gerar Agendamento
1. Clique no ícone de calendário
2. Será aberto o link do Calendly em nova aba
3. O franqueado poderá agendar uma reunião

### Ordenação
- Clique no cabeçalho de qualquer coluna para ordenar
- Uma seta indicará a direção da ordenação (crescente/decrescente)
- Por padrão, a tabela é ordenada por "Dias em Atraso" (decrescente)

### Paginação
- Use os botões "Anterior" e "Próxima" para navegar
- O sistema mostra 20 registros por página
- O total de registros é exibido na parte inferior

---

## 📁 Importação de Planilhas

### Preparando a Planilha

#### Colunas Obrigatórias:
- **CLIENTE**: Nome ou razão social do franqueado
- **CNPJ**: CNPJ com ou sem formatação
- **VALOR**: Valor original do título
- **DATA_VENCIMENTO**: Data de vencimento (DD/MM/AAAA)

#### Colunas Opcionais:
- **VALOR_RECEBIDO**: Valor já pago (padrão: 0)
- **TELEFONE**: Para envio de WhatsApp

#### Formatos Aceitos:
- **.xlsx** (Excel)
- **.xml** (XML)

### Processo de Upload

#### Passo a Passo:
1. Acesse a seção "Importação"
2. Clique em "Clique para selecionar arquivo" ou arraste o arquivo
3. Aguarde o upload e validação
4. Clique em "Processar Planilha"
5. Aguarde o processamento (pode levar alguns minutos)

#### Resultado da Importação:
Após o processamento, você verá:
- **Total de Registros**: Quantas linhas foram processadas
- **Novos Títulos**: Cobranças criadas
- **Atualizados**: Títulos que já existiam e foram atualizados
- **Quitados**: Títulos marcados como quitados (não estavam na planilha)

### Tratamento de Erros

#### Erros Comuns:
- **CNPJ inválido**: Verifique se tem 14 dígitos
- **Data inválida**: Use formato DD/MM/AAAA
- **Valor inválido**: Use números com ponto ou vírgula decimal
- **Coluna ausente**: Verifique se todas as colunas obrigatórias estão presentes

#### Como Corrigir:
1. Anote os erros mostrados na tela
2. Corrija a planilha
3. Faça um novo upload

---

## 📝 Tratativas

### Visualizando o Histórico
1. Acesse "Tratativas" no menu
2. Você pode ver:
   - **Histórico específico**: De uma cobrança (via Painel Operacional)
   - **Todas as tratativas**: Visão geral do sistema

### Tipos de Tratativas
- **📤 Mensagem Automática**: Enviada pelo sistema
- **💬 Resposta Franqueado**: Interação do cliente
- **📅 Agendamento**: Reunião marcada
- **📝 Observação Manual**: Anotação da equipe
- **📋 Proposta Enviada**: Proposta de negociação
- **✅ Proposta Aceita**: Acordo fechado
- **💰 Marcado como Quitado**: Pagamento confirmado

### Adicionando Observações
1. No histórico de uma cobrança específica
2. Clique em "Adicionar Observação"
3. Preencha:
   - **Canal**: Como foi a interação (WhatsApp, telefone, etc.)
   - **Observação**: Descrição detalhada
   - **Alterar Status**: Se necessário
4. Clique em "Salvar Observação"

### Filtros de Tratativas
- **Tipo**: Filtrar por tipo de interação
- **Canal**: WhatsApp, telefone, interno, etc.
- **Usuário**: Quem fez a interação
- **Período**: Data da interação

---

## ⚙️ Configurações Administrativas

> **⚠️ Atenção**: Esta seção é restrita a usuários com perfil Admin ou Financeiro Master.

### Parâmetros Financeiros

#### Percentual de Multa
- **Valor**: 0 a 100%
- **Padrão**: 2%
- **Aplicação**: Sobre o valor original quando vencido

#### Juros Diário
- **Valor**: 0 a 10%
- **Padrão**: 0,033% ao dia
- **Aplicação**: Por dia de atraso

#### Tempo de Tolerância
- **Valor**: 0 a 30 dias
- **Padrão**: 3 dias
- **Aplicação**: Dias após vencimento antes de iniciar cobrança

### Parâmetros de Envio

#### Dia do Disparo Mensal
- **Valor**: 1 a 31
- **Padrão**: 15
- **Aplicação**: Dia do mês para envio automático

#### Canal de Envio
- **WhatsApp**: Apenas WhatsApp
- **E-mail**: Apenas e-mail
- **Ambos**: WhatsApp e e-mail

#### Link de Agendamento
- **Formato**: URL válida
- **Exemplo**: https://calendly.com/sua-empresa/negociacao
- **Aplicação**: Link enviado nas mensagens

### Template da Mensagem

#### Variáveis Disponíveis:
- `{{cliente}}`: Nome do franqueado
- `{{valor_atualizado}}`: Valor com multa e juros
- `{{data_vencimento}}`: Data de vencimento
- `{{link_negociacao}}`: Link do Calendly

#### Exemplo de Template:
```
Olá, {{cliente}}!

Consta um débito da sua unidade, vencido em {{data_vencimento}}.
Valor atualizado até hoje: *{{valor_atualizado}}*

Deseja regularizar? {{link_negociacao}}

_Esta é uma mensagem automática do sistema de cobrança._
```

### Como Alterar Configurações
1. Acesse "Configurações Administrativas"
2. Altere os valores desejados
3. Visualize o preview da mensagem
4. Clique em "Salvar Alterações"
5. As mudanças são aplicadas imediatamente

### Funções Especiais

#### Resetar Configurações
- Volta todos os valores para o padrão
- **⚠️ Cuidado**: Não pode ser desfeito

#### Exportar Configurações
- Baixa um arquivo JSON com backup das configurações
- Útil para documentação ou restauração

---

## 📱 Configuração WhatsApp

### Configuração Inicial

#### Informações Necessárias:
1. **Token de Acesso**: Obtido no Facebook Developers
2. **Phone Number ID**: ID do número configurado
3. **Link de Negociação**: URL do Calendly

#### Passo a Passo:
1. Acesse "WhatsApp Config" no menu
2. Preencha os campos obrigatórios
3. Clique em "Testar Conexão" para validar
4. Se o teste passar, clique em "Salvar Configurações"

### Como Obter as Credenciais

#### 1. Criar App no Facebook Developers
1. Acesse developers.facebook.com
2. Crie um novo app Business
3. Adicione o produto "WhatsApp Business API"

#### 2. Configurar Número
1. No painel do app, vá para WhatsApp > Getting Started
2. Configure um número de telefone
3. Anote o Phone Number ID

#### 3. Gerar Token
1. Ainda no painel, gere um token de acesso
2. **⚠️ Importante**: Use um token permanente para produção

### Testando a Configuração
1. Após preencher os dados, clique em "Testar Conexão"
2. Se aparecer "Conexão estabelecida", está funcionando
3. Se houver erro, verifique as credenciais

### Preview da Mensagem
- A seção inferior mostra como a mensagem aparecerá
- Use para validar o template antes de enviar

---

## 📋 Histórico de Envios

### Visualizando Envios
1. Acesse "Histórico Envios" no menu
2. Você verá todas as mensagens enviadas pelo sistema

### Informações Disponíveis
- **Cliente**: Nome do franqueado
- **Telefone**: Número de destino
- **Data/Hora**: Quando foi enviado
- **Status**: Sucesso, falha ou reagendado
- **Mensagem**: Conteúdo enviado
- **Erro**: Detalhes se houve falha

### Filtros de Histórico
- **Período**: Data de início e fim
- **Status**: Sucesso, falha, reagendado
- **Cliente**: Nome específico

### Estatísticas
Na parte inferior, você vê:
- **Enviados com Sucesso**: Quantidade e percentual
- **Falhas no Envio**: Problemas ocorridos
- **Reagendados**: Envios que serão tentados novamente

---

## 🔐 Perfis e Permissões

### Tipos de Usuário

#### 👑 Admin
- Acesso total ao sistema
- Pode alterar configurações
- Gerencia usuários
- Faz importações

#### 💼 Financeiro Master
- Configurações do sistema
- Importação de planilhas
- Painel operacional completo
- Dashboards e relatórios

#### 👨‍💼 Financeiro Operador
- Painel operacional
- Tratativas e observações
- Dashboards básicos
- **Não pode**: Configurar ou importar

#### 👁️ Leitura
- Apenas visualização
- Dashboards e relatórios
- Consulta de cobranças
- **Não pode**: Alterar dados

### Verificando Suas Permissões
- Seu perfil determina quais menus você vê
- Se não conseguir acessar algo, verifique com o administrador
- Algumas funções podem estar desabilitadas conforme seu perfil

---

## 🆘 Solução de Problemas

### Problemas Comuns

#### "Erro ao carregar dados"
1. Verifique sua conexão com a internet
2. Atualize a página (F5)
3. Se persistir, contate o suporte

#### "Planilha com estrutura inválida"
1. Verifique se as colunas obrigatórias estão presentes
2. Confira os nomes das colunas (CLIENTE, CNPJ, VALOR, DATA_VENCIMENTO)
3. Valide o formato do arquivo (.xlsx ou .xml)

#### "Falha no envio WhatsApp"
1. Verifique as configurações da API
2. Confirme se o telefone está correto
3. Verifique se há créditos na conta WhatsApp Business

#### "Acesso negado"
1. Verifique se você está logado
2. Confirme suas permissões com o administrador
3. Tente fazer logout e login novamente

### Quando Contatar o Suporte
- Erros que persistem após tentativas de solução
- Problemas com configurações técnicas
- Dúvidas sobre funcionalidades específicas
- Solicitações de alteração de permissões

### Informações para o Suporte
Ao contatar o suporte, tenha em mãos:
- Seu usuário/e-mail de acesso
- Descrição detalhada do problema
- Prints da tela (se possível)
- Horário em que o erro ocorreu

---

## 📞 Contatos e Suporte

### Suporte Técnico
- **E-mail**: [inserir e-mail de suporte]
- **Telefone**: [inserir telefone]
- **Horário**: Segunda a sexta, 8h às 18h

### Suporte Operacional
- **E-mail**: [inserir e-mail financeiro]
- **Telefone**: [inserir telefone]
- **Horário**: Segunda a sexta, 8h às 18h

### Documentação
- **Manual Técnico**: Para desenvolvedores
- **Manual do Usuário**: Este documento
- **API Documentation**: Para integrações

---

## 📝 Dicas e Boas Práticas

### Para Importação de Planilhas
- ✅ Sempre faça backup da planilha original
- ✅ Valide os dados antes do upload
- ✅ Importe semanalmente para manter dados atualizados
- ❌ Não altere títulos em "negociando" manualmente

### Para Gestão de Cobranças
- ✅ Registre todas as interações como observações
- ✅ Use filtros para focar em faixas de atraso específicas
- ✅ Acompanhe o ranking de inadimplentes regularmente
- ❌ Não marque como quitado sem confirmação do pagamento

### Para Configurações
- ✅ Teste mudanças em horários de baixo movimento
- ✅ Documente alterações importantes
- ✅ Mantenha backup das configurações
- ❌ Não altere parâmetros sem entender o impacto

### Para WhatsApp
- ✅ Teste a conexão regularmente
- ✅ Monitore o histórico de envios
- ✅ Mantenha o template de mensagem atualizado
- ❌ Não envie mensagens fora do horário comercial

---

*Manual atualizado em: Janeiro 2025*
*Versão: 1.0.0*