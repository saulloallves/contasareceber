-- Limpar templates existentes
DELETE FROM templates_notificacao;

-- Templates WhatsApp para CNPJ (com unidade)
INSERT INTO templates_notificacao (tipo, marco, assunto, conteudo, ativo, data_criacao, data_atualizacao) VALUES
('whatsapp_cnpj', 3, null, 'Olá {nomeFranqueado}!

Identificamos que há uma cobrança em aberto há 3 dias referente à sua unidade *{nomeUnidade}*.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Se o pagamento já foi feito, por favor, desconsidere esta mensagem.  
Obrigado pela atenção!

_Mensagem Automática_', true, now(), now()),

('whatsapp_cnpj', 7, null, 'Olá {nomeFranqueado}! ⚠️

Sua cobrança referente à unidade *{nomeUnidade}* está em aberto há 7 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos que regularize o pagamento para evitar transtornos.  
Se já pagou, por favor, ignore esta mensagem.

_Mensagem Automática_', true, now(), now()),

('whatsapp_cnpj', 15, null, 'Olá {nomeFranqueado}! 📮

A cobrança da sua unidade *{nomeUnidade}* está em aberto há 15 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos sua atenção para a regularização do valor o quanto antes, evitando medidas adicionais.

_Mensagem Automática_', true, now(), now()),

('whatsapp_cnpj', 30, null, '*⚠️ URGENTE – {nomeFranqueado}! ⚠️*

O débito da sua unidade *{nomeUnidade}* está em aberto há 30 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Efetue o pagamento imediatamente para evitar acionamento jurídico e restrições.

_Mensagem Automática_', true, now(), now());

-- Templates WhatsApp para CPF (sem unidade)
INSERT INTO templates_notificacao (tipo, marco, assunto, conteudo, ativo, data_criacao, data_atualizacao) VALUES
('whatsapp_cpf', 3, null, 'Olá {nomeFranqueado}!

Identificamos que há uma cobrança em aberto há 3 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Se o pagamento já foi feito, por favor, desconsidere esta mensagem.  
Obrigado pela atenção!

_Mensagem Automática_', true, now(), now()),

('whatsapp_cpf', 7, null, 'Olá {nomeFranqueado}! ⚠️

Sua cobrança está em aberto há 7 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos que regularize o pagamento para evitar transtornos.  
Se já pagou, por favor, ignore esta mensagem.

_Mensagem Automática_', true, now(), now()),

('whatsapp_cpf', 15, null, 'Olá {nomeFranqueado}! 📮

Sua cobrança está em aberto há 15 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Pedimos sua atenção para a regularização do valor o quanto antes, evitando medidas adicionais.

_Mensagem Automática_', true, now(), now()),

('whatsapp_cpf', 30, null, '*⚠️ URGENTE – {nomeFranqueado}! ⚠️*

Seu débito está em aberto há 30 dias.

📄 Tipo: {tipoCobranca}  
💰 Valor: {valorFormatado}

Efetue o pagamento imediatamente para evitar acionamento jurídico e restrições.

_Mensagem Automática_', true, now(), now());

-- Templates Email para CNPJ (com unidade)
INSERT INTO templates_notificacao (tipo, marco, assunto, conteudo, ativo, data_criacao, data_atualizacao) VALUES
('email_cnpj', 3, 'Lembrete de Cobrança - {nomeUnidade} - 3 dias', '<!DOCTYPE html>
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
</html>', true, now(), now()),

('email_cnpj', 7, 'Aviso Importante - {nomeUnidade} - 7 dias', '<!DOCTYPE html>
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
</html>', true, now(), now()),

('email_cnpj', 15, 'Alerta de Cobrança - {nomeUnidade} - 15 dias', '<!DOCTYPE html>
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
</html>', true, now(), now()),

('email_cnpj', 30, 'Notificação Urgente - {nomeUnidade} - 30 dias', '<!DOCTYPE html>
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
</html>', true, now(), now());

-- Templates Email para CPF (sem unidade)
INSERT INTO templates_notificacao (tipo, marco, assunto, conteudo, ativo, data_criacao, data_atualizacao) VALUES
('email_cpf', 3, 'Lembrete de Cobrança - {nomeFranqueado} - 3 dias', '<!DOCTYPE html>
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
      <p>Notamos que há uma cobrança em aberto há <strong>3 dias</strong>.</p>
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
</html>', true, now(), now()),

('email_cpf', 7, 'Aviso Importante - {nomeFranqueado} - 7 dias', '<!DOCTYPE html>
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
      <p>Sua cobrança encontra-se em aberto há <strong>7 dias</strong>.</p>
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
</html>', true, now(), now()),

('email_cpf', 15, 'Alerta de Cobrança - {nomeFranqueado} - 15 dias', '<!DOCTYPE html>
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
      <p>Há um débito pendente há <strong>15 dias</strong>.</p>
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
</html>', true, now(), now()),

('email_cpf', 30, 'Notificação Urgente - {nomeFranqueado} - 30 dias', '<!DOCTYPE html>
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
      <p>Seu débito encontra-se em aberto há <strong>30 dias</strong>.</p>
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
</html>', true, now(), now());
