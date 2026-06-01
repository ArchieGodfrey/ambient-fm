export function useInference<T extends { infer: (prompt: string) => Promise<string> }>(kernel: T | null) {
  return async (prompt: string) => {
    if (!kernel) {
      throw new Error("Inference kernel is not initialized");
    }
    return kernel.infer(prompt);
  };
}
