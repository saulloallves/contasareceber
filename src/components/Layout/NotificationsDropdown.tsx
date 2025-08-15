import { Bell, CheckCircle, X } from "lucide-react";
import { Alerta } from "../../types/alertas";
import { formatarCNPJCPF } from "../../utils/formatters";
import { useAuth } from "../Auth/AuthProvider";
import { alertasService } from "../../services/alertasService";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

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
  const [localResolved, setLocalResolved] = useState<Set<string>>(new Set());

  // Normaliza datas no formato M/D/YYYY dentro de um texto para DD/MM/YYYY
  const normalizeUsDateInText = (text: string) => {
    if (!text) return text;
    return text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_m, mm: string, dd: string, yyyy: string) => {
      const d = dd.padStart(2, "0");
      const m = mm.padStart(2, "0");
      return `${d}/${m}/${yyyy}`;
    });
  };

  const alertasVisiveis = useMemo(() => {
    return alertas.filter((a) => !localResolved.has(a.id));
  }, [alertas, localResolved]);

  const handleMarcarComoResolvido = async (alertaId: string) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await alertasService.marcarComoResolvido(alertaId);
      // Otimista: esconde imediatamente
      setLocalResolved((prev) => new Set(prev).add(alertaId));
      toast.success("Notificação marcada como resolvida.");
      onUpdate(); // Atualiza a lista de alertas no Header
    } catch (error) {
      console.error("Falha ao resolver alerta:", error);
      toast.error("Não foi possível marcar como resolvida. Verifique permissões RLS.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getUrgencyColor = (urgency: "baixa" | "media" | "alta" | "critica") => {
    switch (urgency) {
      case "alta":
        return "bg-red-500";
      case "critica":
        return "bg-red-700";
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
    {alertasVisiveis.length === 0 ? (
          <div className="text-center py-10">
            <Bell className="w-12 h-12 mx-auto text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma notificação nova.
            </p>
          </div>
        ) : (
          <ul>
      {alertasVisiveis.map((alerta) => (
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
                    <p className="text-sm text-gray-800 font-medium">{alerta.titulo}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{normalizeUsDateInText(alerta.descricao)}</p>
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      <p>
                        CNPJ:{" "}
                        {alerta.cnpj_unidade
                          ? formatarCNPJCPF(alerta.cnpj_unidade)
                          : "N/A"}
                      </p>
                      <p>
                        Data:{" "}
                        {(() => {
                          const d = alerta.data_criacao || alerta.created_at;
                          if (!d) return "N/A";
                          const dt = new Date(d);
                          return isNaN(dt.getTime())
                            ? "N/A"
                            : dt.toLocaleDateString("pt-BR");
                        })()}
                      </p>
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
