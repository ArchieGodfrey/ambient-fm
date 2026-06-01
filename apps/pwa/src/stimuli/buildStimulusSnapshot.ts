import { createStimulusRegistryFromConfig } from "../stimulus/setup";

export async function buildStimulusSnapshot() {
  const { registry } = await createStimulusRegistryFromConfig();
  return await registry.collect();
}
