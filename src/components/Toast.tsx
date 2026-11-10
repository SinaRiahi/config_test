import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 bg-[#131D2B]/95 ${
            toast.type === 'success'
              ? 'border-[#34D399]/40 text-[#34D399]'
              : toast.type === 'error'
              ? 'border-[#FB7185]/40 text-[#FB7185]'
              : 'border-[#22D3EE]/40 text-[#22D3EE]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-[#FB7185] shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-[#22D3EE] shrink-0" />}
            <span className="text-xs font-medium text-[#E8EEF6] truncate">{toast.message}</span>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-[#94A3B8] hover:text-[#E8EEF6] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
