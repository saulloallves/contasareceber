import { useState } from 'react';
import { automacaoNotificacaoService } from '../../services/automacaoNotificacaoService';

export function TesteAutomacao() {
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  const executarTeste = async () => {
    setCarregando(true);
    try {
      const res = await automacaoNotificacaoService.executarManualmente();
      setResultado(res);
      console.log('🧪 Teste executado:', res);
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      alert('Erro: ' + error);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
      <h3 className="text-lg font-semibold mb-4">🧪 Teste de Automação</h3>
      
      <button
        onClick={executarTeste}
        disabled={carregando}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {carregando ? '🔄 Testando...' : '▶️ Executar Teste'}
      </button>

      {resultado && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">📊 Resultado:</h4>
          <pre className="text-sm bg-gray-100 p-3 rounded overflow-auto">
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
