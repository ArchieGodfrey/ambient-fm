import { useEffect, useRef } from "react";

export function useRuntime<T>(kernelFactory: () => T) {
  const kernel = useRef<T | null>(null);

  useEffect(() => {
    kernel.current = kernelFactory();
  }, [kernelFactory]);

  return kernel.current;
}
