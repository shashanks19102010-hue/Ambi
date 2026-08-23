export type EngineResult = {
  text: string;
  model: string;
  local: boolean;
};

class LocalEngine {
  async generate(prompt: string): Promise<EngineResult> {
    return {
      text: "Local model is not loaded yet.",
      model: "No Model",
      local: true,
    };
  }
}

let instance: LocalEngine | null = null;

export function getLocalEngine() {
  if (!instance) instance = new LocalEngine();
  return instance;
}