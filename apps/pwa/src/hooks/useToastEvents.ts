import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import type { ToastType } from "../utils/toast";

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
};

export default function useToastEvents() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; type: ToastType }>).detail;
      if (!detail?.message) return;
      const id = nanoid();
      setToasts((prev) => [{ id, ...detail }, ...prev]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 5000);
    };

    window.addEventListener("app-toast", listener as EventListener);
    return () => window.removeEventListener("app-toast", listener as EventListener);
  }, []);

  return toasts;
}
