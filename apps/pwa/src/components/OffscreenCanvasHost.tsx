import { useEffect, useRef } from "react";

type OffscreenCanvasHostProps = {
  onPayloadChange: (payload: { canvas: OffscreenCanvas; width: number; height: number } | undefined) => void;
};

export default function OffscreenCanvasHost({ onPayloadChange }: OffscreenCanvasHostProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined" || !("transferControlToOffscreen" in canvas)) {
      onPayloadChange(undefined);
      return;
    }

    if (!offscreenCanvasRef.current) {
      try {
        offscreenCanvasRef.current = canvas.transferControlToOffscreen();
      } catch (error) {
        console.warn("Failed to transfer canvas to OffscreenCanvas", error);
        onPayloadChange(undefined);
        return;
      }
    }

    onPayloadChange({
      canvas: offscreenCanvasRef.current,
      width: canvas.width || 1,
      height: canvas.height || 1,
    });
  }, [onPayloadChange]);

  return (
    <canvas
      ref={canvasRef}
      width={1}
      height={1}
      style={{ position: "absolute", width: 1, height: 1, left: -9999, top: -9999, opacity: 0 }}
    />
  );
}
