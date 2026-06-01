type ToastType = "info" | "success" | "warning" | "error";

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

const toastClasses: Record<ToastType, string> = {
  info: "bg-sky-600 text-white toast-info",
  success: "bg-emerald-600 text-white toast-success",
  warning: "bg-amber-500 text-slate-950 toast-warning",
  error: "bg-rose-600 text-white toast-error",
};

export default function Toasts({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 flex flex-col gap-3 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-message min-w-[260px] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${toastClasses[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
