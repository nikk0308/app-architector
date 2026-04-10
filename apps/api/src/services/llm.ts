import type { NormalizedProfile } from "@mag/shared";

export interface LlmHelper {
  describe(profile: NormalizedProfile): Promise<string>;
}

export class DisabledLlmHelper implements LlmHelper {
  async describe(profile: NormalizedProfile): Promise<string> {
    return [
      `LLM helper disabled.`,
      `Architecture: ${profile.architectureStyle}.`,
      `Navigation: ${profile.navigationStyle}.`,
      `State: ${profile.stateManagement}.`
    ].join(" ");
  }
}

export function createLlmHelper(): LlmHelper {
  return new DisabledLlmHelper();
}
