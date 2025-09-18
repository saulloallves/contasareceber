/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';

const N8N_WEBHOOK_URL = 'https://n8n.girabot.com.br/webhook/atualizar-site';

const UploadAtualizacao: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Selecione um arquivo .zip.');
      return;
    }
    setStatus('uploading');
    setMessage('Enviando arquivo...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        setStatus('success');
        setMessage('Arquivo enviado com sucesso!');
      } else {
        setStatus('error');
        setMessage('Erro ao enviar arquivo.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erro ao enviar arquivo.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 2px 8px #0001', minWidth: 320 }}>
        <h2 style={{ marginBottom: 24, textAlign: 'center' }}>Atualizar Site (.zip)</h2>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          disabled={status === 'uploading'}
          style={{ marginBottom: 16, width: '100%' }}
        />
        <button
          type="submit"
          disabled={status === 'uploading' || !file}
          style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
        >
          {status === 'uploading' ? 'Enviando...' : 'Processar'}
        </button>
        {message && (
          <div style={{ marginTop: 16, color: status === 'error' ? '#dc2626' : '#16a34a', textAlign: 'center' }}>{message}</div>
        )}
      </form>
    </div>
  );
};

export default UploadAtualizacao;
