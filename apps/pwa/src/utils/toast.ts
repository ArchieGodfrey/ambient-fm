export type ToastType = "info" | "success" | "warning" | "error";

export type ToastPayload = {
  message: string;
  type?: ToastType;
};

export function postToast(message: string, type: ToastType = "info") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ToastPayload>("app-toast", {
      detail: { message, type },
    }),
  );
}
