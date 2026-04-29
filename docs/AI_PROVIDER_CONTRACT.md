# AI provider contract

The AI layer is intentionally constrained. It must improve the architecture package without taking ownership of the generated file tree.

## Provider responsibilities

AI providers may:

- produce structured advisor reports;
- synthesize structured spec notes for future review;
- propose allowlisted hybrid refinements;
- report execution metadata, warnings and failures.

AI providers must not:

- write project files directly;
- create ZIP archives;
- remove required artifacts;
- change the selected profile;
- change root directory structure;
- require tokens for baseline generation.

## Shared contract

The shared provider contract lives in `packages/shared/src/domain/provider.ts`.

The key types are:

- `AIProviderId`;
- `ProviderAdapter`;
- `ProviderContext`;
- `ProviderStructuredResult`;
- `PromptBuildResult`;
- `ModelExecutionResult`;
- `CostEstimate`;
- `ProviderModePolicy`.

## Hybrid policy

Hybrid refinements live behind `packages/shared/src/domain/hybrid.ts`.

Version 1 allows only documentation-oriented refinements:

- README sections;
- files under `docs/`;
- `.env.example`;
- comments or annotations in allowlisted starter stubs in future phases.

The default policy forbids file creation, required artifact removal, profile changes and root structure changes.

## Fallback rule

Every provider path must keep deterministic fallback. Missing API keys, timeouts, bad JSON or schema failures should appear as provider status metadata and advisor warnings, not as a broken generation flow.

## GitHub deploy configuration

Production deploy reads AI configuration from GitHub repository secrets and variables. Do not commit real keys to `.env` files.

Repository secrets:

- `OPENAI_API_KEY`
- `HF_TOKEN`

Repository variables:

- `OPENAI_MODEL`
- `HF_MODEL`
- `LLM_ENABLED` optional; deploy sets it to `true` automatically when an AI key is present
- `ENABLE_LLM_ENRICHMENT` optional; deploy sets it to `true` automatically when an AI key is present

The deploy workflow writes only redacted configured/not-configured summaries to diagnostics. Secret values must never appear in build logs, deploy logs or generated ZIP artifacts.
