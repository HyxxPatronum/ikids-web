# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring

Read the following files when they exist:

- `CONTEXT.md` at the repository root
- `CONTEXT-MAP.md` when present
- Relevant ADRs under `docs/adr/`

If these files do not exist, proceed silently.

## File structure

This repository uses a single-context layout:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

Domain documentation is created lazily when terminology or architectural decisions are resolved.

## Vocabulary

Use terms defined in `CONTEXT.md` consistently. Avoid introducing synonyms that conflict with its glossary.

If a required concept is missing, reconsider whether the project already has another term or record the gap for future domain modeling.

## ADR conflicts

If proposed work contradicts an existing ADR, identify the conflict explicitly instead of silently overriding the decision.
