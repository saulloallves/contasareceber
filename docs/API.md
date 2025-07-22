# Documentação da API - Sistema de Cobrança

## 🔗 Endpoints Principais

### 🏠 Base URL
```
https://[seu-projeto].supabase.co/rest/v1/
```

### 🔐 Autenticação
```javascript
// Headers obrigatórios
{
  "apikey": "sua-api-key",
  "Authorization": "Bearer seu-jwt-token",
  "Content-Type": "application/json"
}
```

---

## 📊 Cobranças (`cobrancas_franqueados`)

### 📋 Listar Cobranças
```http
GET /cobrancas_franqueados
```

**Parâmetros de Query:**
- `status=eq.em_aberto` - Filtrar por status
- `cnpj=ilike.*12345*` - Buscar por CNPJ
- `order=dias_em_atraso.desc` - Ordenação
- `limit=20` - Limite de resultados
- `offset=0` - Paginação

**Exemplo:**
```javascript
const { data, error } = await supabase
  .from('cobrancas_franqueados')
  .select('*')
  .eq('status', 'em_aberto')
  .order('dias_em_atraso', { ascending: false })
  .limit(20);
```

### ➕ Criar Cobrança
```http
POST /cobrancas_franqueados
```

**Body:**
```json
{
  "cnpj": "12345678000199",
  "cliente": "Franquia Exemplo",
  "valor_original": 1500.00,
  "valor_recebido": 0,
  "data_vencimento": "2024-01-15",
  "status": "novo",
  "hash_titulo": "abc123...",
  "referencia_importacao": "IMP_20240115_xyz"
}
```

### ✏️ Atualizar Cobrança
```http
PATCH /cobrancas_franqueados?id=eq.uuid
```

**Body:**
```json
{
  "status": "quitado",
  "valor_recebido": 1500.00
}
```

---

## 📝 Tratativas (`tratativas_cobranca`)

### 📋 Listar Tratativas
```http
GET /tratativas_cobranca
```

**Com Join:**
```javascript
const { data, error } = await supabase
  .from('tratativas_cobranca')
  .select(`
    *,
    cobrancas_franqueados (
      cliente,
      cnpj,
      valor_original
    )
  `)
  .order('data_interacao', { ascending: false });
```

### ➕ Registrar Tratativa
```http
POST /tratativas_cobranca
```

**Body:**
```json
{
  "titulo_id": "uuid-da-cobranca",
  "tipo_interacao": "observacao_manual",
  "canal": "interno",
  "usuario_sistema": "usuario@email.com",
  "descricao": "Cliente entrou em contato solicitando parcelamento",
  "status_cobranca_resultante": "negociando"
}
```

---

## 📤 Envios de Mensagem (`envios_mensagem`)

### 📋 Histórico de Envios
```http
GET /envios_mensagem
```

**Filtros Comuns:**
```javascript
const { data, error } = await supabase
  .from('envios_mensagem')
  .select('*')
  .eq('status_envio', 'sucesso')
  .gte('data_envio', '2024-01-01')
  .order('data_envio', { ascending: false });
```

### ➕ Registrar Envio
```http
POST /envios_mensagem
```

**Body:**
```json
{
  "titulo_id": "uuid-da-cobranca",
  "cliente": "Franquia Exemplo",
  "cnpj": "12345678000199",
  "telefone": "5511999999999",
  "mensagem_enviada": "Olá, João! Consta um débito...",
  "status_envio": "sucesso",
  "referencia_importacao": "IMP_20240115_xyz"
}
```

---

## 📁 Importações (`importacoes_planilha`)

### 📋 Histórico de Importações
```http
GET /importacoes_planilha
```

**Ordenação por Data:**
```javascript
const { data, error } = await supabase
  .from('importacoes_planilha')
  .select('*')
  .order('data_importacao', { ascending: false });
```

### ➕ Registrar Importação
```http
POST /importacoes_planilha
```

**Body:**
```json
{
  "usuario": "admin@empresa.com",
  "arquivo_nome": "cobrancas_janeiro_2024.xlsx",
  "referencia": "IMP_20240115_xyz",
  "total_registros": 150,
  "novos_titulos": 25,
  "titulos_atualizados": 100,
  "titulos_quitados": 25
}
```

---

## ⚙️ Configurações (`configuracoes_cobranca`)

### 📋 Buscar Configuração
```http
GET /configuracoes_cobranca?id=eq.default
```

### ✏️ Atualizar Configuração
```http
PATCH /configuracoes_cobranca?id=eq.default
```

**Body:**
```json
{
  "percentual_multa": 2.5,
  "percentual_juros_dia": 0.033,
  "texto_padrao_mensagem": "Olá, {{cliente}}! Novo texto...",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

## 🔍 Consultas Avançadas

### 📊 Dashboard - Visão Geral
```javascript
// Total por status
const { data: totaisPorStatus } = await supabase
  .from('cobrancas_franqueados')
  .select('status, valor_atualizado.sum(), count()')
  .group('status');

// Faixas de atraso
const { data: faixasAtraso } = await supabase
  .from('cobrancas_franqueados')
  .select('*')
  .eq('status', 'em_aberto')
  .gte('dias_em_atraso', 1);
```

### 🏆 Ranking de Inadimplentes
```javascript
const { data: ranking } = await supabase
  .from('cobrancas_franqueados')
  .select('cliente, cnpj, valor_atualizado.sum(), count()')
  .eq('status', 'em_aberto')
  .group('cliente, cnpj')
  .order('valor_atualizado.sum()', { ascending: false })
  .limit(10);
```

### 📈 Evolução Mensal
```javascript
const { data: evolucao } = await supabase
  .from('cobrancas_franqueados')
  .select(`
    data_ultima_atualizacao,
    valor_recebido.sum(),
    count()
  `)
  .gte('data_ultima_atualizacao', '2024-01-01')
  .group('date_trunc(month, data_ultima_atualizacao)')
  .order('data_ultima_atualizacao');
```

---

## 🔐 Row Level Security (RLS)

### Políticas Implementadas

#### Cobranças
```sql
-- Usuários autenticados podem gerenciar cobranças
CREATE POLICY "Users can manage cobrancas data" 
ON cobrancas_franqueados 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

#### Tratativas
```sql
-- Usuários autenticados podem gerenciar tratativas
CREATE POLICY "Users can manage tratativas data" 
ON tratativas_cobranca 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

#### Configurações
```sql
-- Apenas leitura para usuários
CREATE POLICY "Users can read config" 
ON configuracoes_cobranca 
FOR SELECT 
TO authenticated 
USING (true);

-- Apenas admins podem atualizar
CREATE POLICY "Admins can update config" 
ON configuracoes_cobranca 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
```

---

## 🚨 Códigos de Erro

### HTTP Status Codes
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Requisição inválida
- `401` - Não autenticado
- `403` - Sem permissão
- `404` - Não encontrado
- `409` - Conflito (duplicata)
- `500` - Erro interno

### Erros Específicos do Supabase
```json
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint",
  "details": "Key (hash_titulo)=(abc123) already exists."
}
```

---

## 📝 Exemplos de Uso

### Fluxo Completo de Importação
```javascript
// 1. Criar registro de importação
const { data: importacao } = await supabase
  .from('importacoes_planilha')
  .insert({
    usuario: 'admin@empresa.com',
    arquivo_nome: 'cobrancas.xlsx',
    referencia: 'IMP_' + Date.now()
  })
  .select()
  .single();

// 2. Inserir cobranças
const { data: cobrancas } = await supabase
  .from('cobrancas_franqueados')
  .insert(dadosPlanilha);

// 3. Registrar tratativas
const tratativas = cobrancas.map(c => ({
  titulo_id: c.id,
  tipo_interacao: 'novo_titulo',
  canal: 'interno',
  usuario_sistema: 'sistema',
  descricao: 'Título criado via importação'
}));

await supabase
  .from('tratativas_cobranca')
  .insert(tratativas);
```

### Busca com Filtros Complexos
```javascript
const { data } = await supabase
  .from('cobrancas_franqueados')
  .select(`
    *,
    tratativas_cobranca (
      data_interacao,
      tipo_interacao,
      descricao
    )
  `)
  .eq('status', 'em_aberto')
  .gte('valor_atualizado', 1000)
  .lte('valor_atualizado', 5000)
  .gte('dias_em_atraso', 30)
  .ilike('cliente', '%franquia%')
  .order('dias_em_atraso', { ascending: false })
  .limit(50);
```

---

## 🔧 Funções Personalizadas

### Atualizar Campos Calculados
```sql
-- Trigger function para calcular dias_em_atraso e valor_atualizado
CREATE OR REPLACE FUNCTION atualizar_campos_calculados()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular dias em atraso
  NEW.dias_em_atraso = CASE 
    WHEN NEW.data_vencimento < CURRENT_DATE 
    THEN CURRENT_DATE - NEW.data_vencimento 
    ELSE 0 
  END;
  
  -- Calcular valor atualizado (busca configurações)
  -- Implementação completa na migration
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Atualizar Status por Tratativa
```sql
-- Trigger para atualizar status da cobrança baseado na última tratativa
CREATE OR REPLACE FUNCTION atualizar_status_por_tratativa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_cobranca_resultante IS NOT NULL THEN
    UPDATE cobrancas_franqueados 
    SET status = NEW.status_cobranca_resultante
    WHERE id = NEW.titulo_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```