# Fluxogramas do Sistema de Cobrança

## 🔄 Ciclo Principal de Cobrança

```mermaid
flowchart TD
    A[📁 Upload Planilha Semanal] --> B[🔍 Validação Estrutura]
    B --> C{✅ Estrutura OK?}
    C -->|❌ Não| D[⚠️ Exibir Erros]
    C -->|✅ Sim| E[⚙️ Processar Dados]
    
    E --> F[🔐 Gerar Hash Títulos]
    F --> G[🔄 Comparar com BD]
    
    G --> H[➕ Inserir Novos]
    G --> I[🔄 Atualizar Existentes]
    G --> J[✅ Marcar Quitados]
    
    H --> K[📝 Registrar Tratativas]
    I --> K
    J --> K
    
    K --> L[📱 Disparar WhatsApp]
    L --> M[📊 Atualizar Dashboards]
    
    D --> N[🔄 Corrigir e Reenviar]
    N --> A
```

## 📱 Fluxo de Envio WhatsApp

```mermaid
flowchart TD
    A[🎯 Título Elegível] --> B{📞 Tem Telefone?}
    B -->|❌ Não| C[⏭️ Pular Envio]
    B -->|✅ Sim| D[📝 Gerar Mensagem]
    
    D --> E[📤 Enviar WhatsApp]
    E --> F{✅ Sucesso?}
    
    F -->|✅ Sim| G[📊 Log Sucesso]
    F -->|❌ Não| H[📊 Log Falha]
    
    G --> I[🔄 Atualizar Status: 'cobrado']
    H --> J[⏰ Reagendar Envio]
    
    I --> K[📝 Registrar Tratativa]
    J --> K
```

## 🎯 Fluxo de Tratativas

```mermaid
flowchart TD
    A[🎬 Evento Ocorre] --> B{🤔 Tipo de Evento?}
    
    B -->|📤 Mensagem Enviada| C[📝 Tratativa: mensagem_automatica]
    B -->|👤 Observação Manual| D[📝 Tratativa: observacao_manual]
    B -->|📅 Agendamento| E[📝 Tratativa: agendamento]
    B -->|✅ Quitação| F[📝 Tratativa: marcado_como_quitado]
    
    C --> G[💾 Salvar no BD]
    D --> G
    E --> G
    F --> G
    
    G --> H[🔄 Atualizar Status Cobrança]
    H --> I[📊 Atualizar Dashboard]
```

## ⚙️ Fluxo de Configurações

```mermaid
flowchart TD
    A[👤 Usuário Admin] --> B[⚙️ Acessar Configurações]
    B --> C[✏️ Alterar Parâmetros]
    
    C --> D{✅ Validação OK?}
    D -->|❌ Não| E[⚠️ Exibir Erros]
    D -->|✅ Sim| F[💾 Salvar no BD]
    
    F --> G[🔄 Aplicar Imediatamente]
    G --> H[📊 Atualizar Sistema]
    
    E --> C
```

## 🔐 Fluxo de Permissões

```mermaid
flowchart TD
    A[👤 Usuário Acessa] --> B{🔐 Tipo de Usuário?}
    
    B -->|👑 Admin| C[🌟 Acesso Total]
    B -->|💼 Financeiro Master| D[⚙️ Config + Operação]
    B -->|👨‍💼 Financeiro Operador| E[📊 Apenas Operação]
    B -->|👁️ Leitura| F[📈 Apenas Visualização]
    
    C --> G[✅ Todas as Funcionalidades]
    D --> H[✅ Config + Painel + Dashboard]
    E --> I[✅ Painel + Dashboard Básico]
    F --> J[✅ Apenas Dashboards]
```

## 📊 Fluxo do Dashboard

```mermaid
flowchart TD
    A[📊 Carregar Dashboard] --> B[🔍 Aplicar Filtros]
    B --> C[📈 Buscar Dados Supabase]
    
    C --> D[📊 Visão Geral]
    C --> E[🏆 Ranking Inadimplentes]
    C --> F[📈 Evolução Mensal]
    C --> G[⚡ Eficiência Cobranças]
    
    D --> H[🎨 Renderizar Gráficos]
    E --> H
    F --> H
    G --> H
    
    H --> I[📤 Opção Exportar]
    I --> J[📁 Download CSV/Excel]
```

## 🛠️ Fluxo de Manutenção

```mermaid
flowchart TD
    A[⚠️ Erro Detectado] --> B{🤔 Tipo de Erro?}
    
    B -->|📁 Importação| C[📋 Checklist Planilha]
    B -->|📱 WhatsApp| D[🔧 Verificar API]
    B -->|💾 Banco de Dados| E[🔍 Logs Supabase]
    B -->|🖥️ Interface| F[🐛 Debug Frontend]
    
    C --> G[✏️ Corrigir Planilha]
    D --> H[⚙️ Reconfigurar API]
    E --> I[🔄 Restaurar Backup]
    F --> J[🔧 Corrigir Código]
    
    G --> K[✅ Testar Solução]
    H --> K
    I --> K
    J --> K
    
    K --> L{✅ Funcionando?}
    L -->|❌ Não| M[📞 Contatar Suporte]
    L -->|✅ Sim| N[📝 Documentar Solução]
```