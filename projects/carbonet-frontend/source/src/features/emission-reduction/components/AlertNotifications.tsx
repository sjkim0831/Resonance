export type AlertNotification = {
  id: string;
  type: "warning" | "info" | "success";
  title: string;
  description: string;
  timestamp: string;
};

type Props = {
  alerts: AlertNotification[];
  onDismiss?: (id: string) => void;
};

const alertConfig = {
  warning: { icon: "warning", bg: "bg-amber-50", border: "border-amber-200" },
  info: { icon: "info", bg: "bg-blue-50", border: "border-blue-200" },
  success: { icon: "check_circle", bg: "bg-green-50", border: "border-green-200" }
};

export function AlertNotifications({ alerts, onDismiss }: Props) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-gray-800">
        <span className="material-symbols-outlined text-amber-500">notifications_active</span>
        알림 / Notifications
      </h3>
      <div className="space-y-3">
        {alerts.map((alert) => {
          const cfg = alertConfig[alert.type];
          return (
            <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg ${cfg.bg} border ${cfg.border}`}>
              <span className="material-symbols-outlined">{cfg.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{alert.title}</p>
                <p className="text-xs text-gray-500 mt-1">{alert.description}</p>
                <p className="text-[10px] text-gray-400 mt-1">{alert.timestamp}</p>
              </div>
              {onDismiss && (
                <button onClick={() => onDismiss(alert.id)} className="text-gray-400 hover:text-gray-600">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
