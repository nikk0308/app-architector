# App Architector phase roadmap

This document captures the current engineering roadmap after Phase 4. The system is no longer treated as a broken MVP: baseline generation, advisor artifacts, diagnostics and the result UI are considered the working baseline.

## Current position

```text
Phase 0    done
Phase 1    mostly done, cleanup remains
Phase 2    done
Phase 3    done
Phase 3.5  done
Phase 4    done
Phase 5    in progress
```

## Completed baseline

### Phase 0: repo baseline and stabilization

- Monorepo workspaces are established for API, web and shared packages.
- Build, verify, smoke and doctor scripts are available at the root.
- Generated outputs, diagnostics and dependency folders are kept out of source.

### Phase 1: shared contract v1

- Shared exports define profiles, generation modes, specs, manifests, validation reports, advisor reports and generation metadata.
- Compatibility exports remain available through `@mag/shared`.
- Phase 5 continues by splitting the domain into modular barrels while keeping the old import surface.

### Phase 2: generator core and ZIP contract

- The Python generator materializes deterministic project files.
- Generated archives include `.mag` metadata, manifest, validation report and user-facing documentation.
- The ZIP smoke test checks advisor artifacts and JSON readability.

### Phase 3: architecture advisor v1

- The advisor can produce deterministic reports without any LLM token.
- Hugging Face remains optional and falls back safely.
- Generated packages include `.mag/architecture-advisor.json` and `docs/architecture-decisions.md`.

### Phase 3.5: diagnostics hardening

- Static contract verification and generated ZIP inspection create diagnostics artifacts.
- CI uploads diagnostics with `if: always()`.
- Diagnostics avoid raw environment dumps and secrets.

### Phase 4: web result UX

- The web UI shows generated artifacts, advisor summary, warnings, recommendations and download flow.
- The API returns additive `artifacts` and `advisorSummary` fields.
- Older responses remain valid because the UI keeps fallback rendering.

## Active phase

### Phase 5: AI-ready domain core v2

Goal: prepare the shared domain for real AI modes without rewriting the working generator.

Implementation direction:

- Keep `@mag/shared` compatibility exports stable.
- Add explicit contract version constants.
- Add modular domain barrels for spec, manifest, validation, advisor, generation, provider and hybrid policy.
- Define provider execution metadata and prompt metadata before adding more model behavior.
- Keep AI providers from writing generated files directly.

Acceptance:

- Root build passes.
- Existing API and web imports still work.
- Generated ZIP contract stays unchanged.
- `npm run doctor` passes.

## Upcoming phases

### Phase 6: AI provider layer v1

- Introduce provider adapters for deterministic, Hugging Face and OpenAI-backed modes.
- Providers return structured results or controlled patches.
- Provider failures must produce fallback advisor output, not failed generation.

### Phase 7: hybrid refinement policy

- Baseline owns structure.
- AI may only refine allowlisted docs, README sections, setup notes and comments.
- Required artifacts, profile and root structure cannot be changed by AI.

### Phase 8: run repository, metrics and compare data

- Store spec, manifest, validation, advisor, provider metadata, artifacts and metrics per run.
- Prepare baseline/HF/commercial/hybrid comparison without re-running generation.

### Phase 9: validation v2

- Add stronger pre-materialization and post-materialization checks.
- Validate required artifacts, duplicate paths, naming, profile compatibility, ZIP integrity and registry drift.

### Phase 10: web console v2

- Split the current UI into durable pages and components.
- Add run details, validation summary, provider status and compare view.

### Phase 11: platform packs v2

- Deepen iOS, Flutter, React Native and Unity starter packs.
- Add explicit feature support levels: `full`, `partial`, `reserved`.

### Phase 12: production hardening

- Add stronger environment validation, logging, health checks, timeout policy and deploy smoke.

### Phase 13: diploma packaging and evaluation

- Prepare diagrams, methodology, screenshots and comparison results for baseline vs AI vs hybrid.

## Non-negotiable system rule

AI is not allowed to generate the ZIP directly. AI can advise, synthesize structured data or propose allowlisted refinements. The deterministic materializer remains the only component that writes the generated project package.
