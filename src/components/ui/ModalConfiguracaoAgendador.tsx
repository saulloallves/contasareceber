import { useState, useEffect } from 'react';
import { X, Clock, Calendar, CalendarDays } from 'lucide-react';
import { ConfiguracaoCron, FrequenciaExecucao } from '../../services/cronJobService';

interface ModalConfiguracaoAgendadorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ConfiguracaoCron) => void;
  configuracaoAtual: ConfiguracaoCron;
}

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda-feira', short: 'Seg' },
  { value: 2, label: 'Terça-feira', short: 'Ter' },
  { value: 3, label: 'Quarta-feira', short: 'Qua' },
  { value: 4, label: 'Quinta-feira', short: 'Qui' },
  { value: 5, label: 'Sexta-feira', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sab' }
];

export default function ModalConfiguracaoAgendador({
  isOpen,
  onClose,
  onSave,
  configuracaoAtual
}: ModalConfiguracaoAgendadorProps) {
  const [config, setConfig] = useState<ConfiguracaoCron>(configuracaoAtual);

  useEffect(() => {
    setConfig(configuracaoAtual);
  }, [configuracaoAtual]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Validações
    if (config.frequencia === 'semanal' && (!config.diasSemana || config.diasSemana.length === 0)) {
      alert('Para frequência semanal, selecione pelo menos um dia da semana');
      return;
    }
    
    if (config.frequencia === 'mensal' && (!config.diaMes || config.diaMes < 1 || config.diaMes > 31)) {
      alert('Para frequência mensal, selecione um dia válido (1-31)');
      return;
    }

    onSave(config);
    onClose();
  };

  const toggleDiaSemana = (dia: number) => {
    const diasSemana = config.diasSemana || [];
    const novoDias = diasSemana.includes(dia)
      ? diasSemana.filter(d => d !== dia)
      : [...diasSemana, dia].sort();
    
    setConfig({ ...config, diasSemana: novoDias });
  };

  const formatarHorario = () => {
    const hora = config.hora.toString().padStart(2, '0');
    const minuto = config.minuto.toString().padStart(2, '0');
    return `${hora}:${minuto}`;
  };

  const getFrequenciaDescricao = () => {
    switch (config.frequencia) {
      case 'diario':
        return `Diariamente às ${formatarHorario()}`;
      case 'semanal': {
        const dias = config.diasSemana?.map(d => DIAS_SEMANA[d].short).join(', ') || 'Nenhum';
        return `Semanalmente (${dias}) às ${formatarHorario()}`;
      }
      case 'mensal':
        return `Mensalmente no dia ${config.diaMes || 1} às ${formatarHorario()}`;
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Clock className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Configurar Agendador
              </h2>
              <p className="text-sm text-gray-600">
                Defina quando as notificações serão enviadas automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Horário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Horário de Execução
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="23"
                value={config.hora}
                onChange={(e) => setConfig({ ...config, hora: parseInt(e.target.value) || 0 })}
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder="HH"
              />
              <span className="text-gray-500">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={config.minuto}
                onChange={(e) => setConfig({ ...config, minuto: parseInt(e.target.value) || 0 })}
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                placeholder="MM"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Horário atual: {formatarHorario()}
            </p>
          </div>

          {/* Frequência */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Frequência de Execução
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="frequencia"
                  value="diario"
                  checked={config.frequencia === 'diario'}
                  onChange={(e) => setConfig({ ...config, frequencia: e.target.value as FrequenciaExecucao })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Diário
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="frequencia"
                  value="semanal"
                  checked={config.frequencia === 'semanal'}
                  onChange={(e) => setConfig({ ...config, frequencia: e.target.value as FrequenciaExecucao })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center">
                  <CalendarDays className="w-4 h-4 mr-1" />
                  Semanal
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="frequencia"
                  value="mensal"
                  checked={config.frequencia === 'mensal'}
                  onChange={(e) => setConfig({ ...config, frequencia: e.target.value as FrequenciaExecucao })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Mensal
                </span>
              </label>
            </div>
          </div>

          {/* Configurações específicas para semanal */}
          {config.frequencia === 'semanal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dias da Semana
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.value}
                    onClick={() => toggleDiaSemana(dia.value)}
                    className={`p-2 text-xs rounded-lg border transition-colors ${
                      config.diasSemana?.includes(dia.value)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {dia.short}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Configurações específicas para mensal */}
          {config.frequencia === 'mensal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dia do Mês
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={config.diaMes || 1}
                onChange={(e) => setConfig({ ...config, diaMes: parseInt(e.target.value) || 1 })}
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dia 1-31 do mês
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-1">
              Resumo da Configuração
            </h4>
            <p className="text-sm text-blue-700">
              {getFrequenciaDescricao()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
