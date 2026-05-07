export const ${mode_boundary_camel} = {
  mode: "${generation_mode}",
  strategy: "${mode_strategy_summary}",
  relationship: "${mode_relationship_summary}",
} as const;

export function explainGenerationMode(): string {
  return ${mode_boundary_camel}.mode + ": " + ${mode_boundary_camel}.strategy;
}
