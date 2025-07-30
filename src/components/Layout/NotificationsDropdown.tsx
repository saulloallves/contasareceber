import { Bell, CheckCircle, X } from "lucide-react";
import { Alerta } from "../../types/alertas";
import { formatarMoeda, formatarData } from "../../utils/formatters"; // Supondo que você tenha formatters
import { useAuth } from "../Auth/AuthProvider";
import { alertasService } from "../../services/alertasService.ts";
import { useState } from "react";

interface NotificationsDropdownProps {
  alertas: Alerta[];
  onClose: () => void;
  onUpdate: () => void; // Para recarregar os alertas após uma ação
}

export function NotificationsDropdown({
  alertas,
  onClose,
  onUpdate,
}: NotificationsDropdownProps) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleMarcarComoResolvido = async (alertaId: number) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await alertasService.marcarComoResolvido(alertaId, user.id);
      onUpdate(); // Atualiza a lista de alertas no Header
    } catch (error) {
      console.error("Falha ao resolver alerta:", error);
      // Adicionar um toast de erro aqui seria uma boa prática
    } finally {
      setIsUpdating(false);
    }
  };

  const getUrgencyColor = (urgency: "baixa" | "media" | "alta") => {
    switch (urgency) {
      case "alta":
        return "bg-red-500";
      case "media":
        return "bg-yellow-500";
      case "baixa":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="absolute top-16 right-6 w-80 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      <div className="flex justify-between items-center p-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Notificações</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {alertas.length === 0 ? (
          <div className="text-center py-10">
            <Bell className="w-12 h-12 mx-auto text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma notificação nova.
            </p>
          </div>
        ) : (
          <ul>
            {alertas.map((alerta) => (
              <li
                key={alerta.id}
                className="p-3 border-b border-gray-100 hover:bg-gray-50"
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 ${getUrgencyColor(
                      alerta.nivel_urgencia
                    )}`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{alerta.descricao}</p>
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      <p>Cliente: {alerta.cobranca?.cliente || "N/A"}</p>
                      <p>
                        Valor:{" "}
                        {formatarMoeda(alerta.cobranca?.valor_atualizado || 0)}
                      </p>
                      <p>Data: {formatarData(alerta.data_criacao)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarcarComoResolvido(alerta.id)}
                    disabled={isUpdating}
                    className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full disabled:opacity-50"
                    title="Marcar como resolvido"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
