-- Migration: Create templates_notificacao table
-- Cria tabela para armazenar templates de notificação personalizáveis

CREATE TABLE IF NOT EXISTS templates_notificacao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('whatsapp', 'email')),
    marco INTEGER NOT NULL CHECK (marco IN (3, 7, 15, 30)),
    assunto TEXT, -- Para emails (pode ser NULL para WhatsApp)
    conteudo TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que não existem duplicatas tipo+marco
    UNIQUE(tipo, marco)
);

-- Comentários nas colunas
COMMENT ON TABLE templates_notificacao IS 'Templates de notificação automática por WhatsApp e Email';
COMMENT ON COLUMN templates_notificacao.tipo IS 'Tipo da notificação: whatsapp ou email';
COMMENT ON COLUMN templates_notificacao.marco IS 'Marco em dias para notificação: 3, 7, 15 ou 30';
COMMENT ON COLUMN templates_notificacao.assunto IS 'Assunto para emails (NULL para WhatsApp)';
COMMENT ON COLUMN templates_notificacao.conteudo IS 'Template da mensagem com variáveis {nomeFranqueado}, {nomeUnidade}, etc';
COMMENT ON COLUMN templates_notificacao.ativo IS 'Se o template está ativo para uso';

-- Criar função para atualizar data_atualizacao
CREATE OR REPLACE FUNCTION update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar automaticamente data_atualizacao
CREATE TRIGGER update_templates_notificacao_updated_at
    BEFORE UPDATE ON templates_notificacao
    FOR EACH ROW
    EXECUTE FUNCTION update_template_updated_at();

-- Inserir templates padrão de WhatsApp (sem assunto)
INSERT INTO templates_notificacao (tipo, marco, conteudo) VALUES
('whatsapp', 3, 'Olá {nomeFranqueado}!

Identificamos que há uma cobrança em aberto há 3 dias referente à sua unidade *{nomeUnidade}*.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Se o pagamento já foi feito, por favor, desconsidere esta mensagem.  
Obrigado pela atenção!

_Mensagem Automática_'),

('whatsapp', 7, 'Olá {nomeFranqueado}! ⚠️

Sua cobrança referente à unidade *{nomeUnidade}* está em aberto há 7 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos que regularize o pagamento para evitar transtornos.  
Se já pagou, por favor, ignore esta mensagem.

_Mensagem Automática_'),

('whatsapp', 15, 'Olá {nomeFranqueado}! 📢

A cobrança da sua unidade *{nomeUnidade}* está em aberto há 15 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos sua atenção para a regularização do valor o quanto antes, evitando medidas adicionais.

_Mensagem Automática_'),

('whatsapp', 30, '*⚠️ URGENTE – {nomeFranqueado}! ⚠️*

O débito da sua unidade *{nomeUnidade}* está em aberto há 30 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Efetue o pagamento imediatamente para evitar acionamento jurídico e restrições.

_Mensagem Automática_')
ON CONFLICT (tipo, marco) DO NOTHING;

-- Inserir templates padrão de Email (com assunto)
INSERT INTO templates_notificacao (tipo, marco, assunto, conteudo) VALUES
('email', 3, 'Lembrete de Cobrança - {nomeUnidade} - 3 dias', '<!DOCTYPE html>
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
</html>'),

('email', 7, 'Aviso Importante - {nomeUnidade} - 7 dias', '<!DOCTYPE html>
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
</html>'),

('email', 15, 'Alerta de Cobrança - {nomeUnidade} - 15 dias', '<!DOCTYPE html>
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
</html>'),

('email', 30, 'Notificação Urgente - {nomeUnidade} - 30 dias', '<!DOCTYPE html>
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
</html>')
ON CONFLICT (tipo, marco) DO NOTHING;

-- Criar política RLS (Row Level Security)
ALTER TABLE templates_notificacao ENABLE ROW LEVEL SECURITY;

-- Política para permitir SELECT, INSERT, UPDATE para usuários autenticados
CREATE POLICY "Permitir acesso completo a usuários autenticados" ON templates_notificacao
    FOR ALL USING (auth.role() = 'authenticated');
