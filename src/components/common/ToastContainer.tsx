import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useCrm } from "../../context/CrmContext";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useCrm();

  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none"
    >
      {toasts.map((t) => {
        let bg = "bg-slate-900 text-white border-slate-800";
        let icon = <Info className="w-5 h-5 text-blue-400 shrink-0" />;

        if (t.type === "success") {
          bg = "bg-emerald-950/90 text-emerald-100 border-emerald-800/60";
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
        } else if (t.type === "error") {
          bg = "bg-rose-950/90 text-rose-100 border-rose-800/60";
          icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
        } else if (t.type === "warning") {
          bg = "bg-amber-950/90 text-amber-100 border-amber-800/60";
          icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
        }

        return (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${bg}`}
          >
            {icon}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-slate-100">{t.title}</div>
              {t.message && <div className="text-slate-300 text-xs mt-0.5 leading-relaxed">{t.message}</div>}
            </div>
            <button
              id={`toast-close-${t.id}`}
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
