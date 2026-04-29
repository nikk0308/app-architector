export const MAG_CONTRACT_VERSION = "0.2.0" as const;
export const ARCHITECTURE_SPEC_VERSION = "1.0" as const;
export const ARTIFACT_MANIFEST_VERSION = "1.0" as const;
export const VALIDATION_REPORT_VERSION = "1.0" as const;
export const ADVISOR_REPORT_VERSION = "1.0" as const;
export const ADVISOR_PHASE_VERSION = "phase3" as const;
export const AI_PROVIDER_CONTRACT_VERSION = "1.0" as const;
export const GENERATION_RESPONSE_VERSION = "1.0" as const;

export const CONTRACT_VERSIONS = {
  package: MAG_CONTRACT_VERSION,
  architectureSpec: ARCHITECTURE_SPEC_VERSION,
  artifactManifest: ARTIFACT_MANIFEST_VERSION,
  validationReport: VALIDATION_REPORT_VERSION,
  advisorReport: ADVISOR_REPORT_VERSION,
  advisorPhase: ADVISOR_PHASE_VERSION,
  aiProvider: AI_PROVIDER_CONTRACT_VERSION,
  generationResponse: GENERATION_RESPONSE_VERSION
} as const;

export type ContractVersionKey = keyof typeof CONTRACT_VERSIONS;
