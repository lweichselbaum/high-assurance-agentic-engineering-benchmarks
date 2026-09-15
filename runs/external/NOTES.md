# Antigravity Model Availability and Selection Notes

## Models used

Selected from the models offered by this Antigravity installation at the time (2026-09-04), to span the Gemini
range from the smallest Flash tier to the largest Pro tier. Model ids are the strings the `agent` CLI accepted
and reported; they are recorded verbatim in `runs/agent-*-<n>.json`.

## Models Not Available
- Claude models (e.g., `claude-sonnet-4-5`, `claude-sonnet-5`, `claude-opus-5`) and open-weight GPT-OSS models are not available in this Antigravity installation. Attempting to select `claude-sonnet-4-5` returns:
  `Error: invalid model selection (--model "claude-sonnet-4-5"): model claude-sonnet-4-5 is not recognized as a known model or custom model in settings`.

## Selected Models for Matrix Runs (5 runs each)
Spanning the range of capability, reasoning tiers, and latency:
1. `gemini-3.5-flash-lite` (5 runs, indices 31–35) — smallest and fastest Gemini
2. `gemini-3.6-flash` (5 runs, indices 36–40) — fast Flash model
3. `gemini-3.7-flash-high` (5 runs, indices 41–45) — hybrid reasoning model (high effort)
4. `gemini-3.8-flash-high` (5 runs, indices 46–50) — frontier reasoning Flash model (high effort)
5. `gemini-3.1-pro-high` (5 runs, indices 51–55) — largest frontier Pro model (high effort)
