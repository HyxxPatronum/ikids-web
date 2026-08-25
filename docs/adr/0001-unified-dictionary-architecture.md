# ADR-0001: Adopt a unified dictionary architecture

- Status: Accepted
- Date: 2026-08-24

## Context

At adoption, the real student interfaces ran as static HTML and global JavaScript while Next.js routes mostly redirected to those pages. `shared.js` contained a reusable dictionary drawer, but paragraph tokenization remained local to `index.html`. `server.js` and `app/api/[...path]/route.ts` separately implemented vocabulary classification, dictionary lookup, caching, and response normalization.

This duplication allows local and hosted behavior to drift. It also prevents future pages from reusing text lookup without copying parsing and event-binding code.

## Decision

Adopt a layered, incrementally migrated architecture:

1. A framework-independent Dictionary Service owns normalization, lemmatization, source aggregation, contextual ranking, catalog invariants, and the stable response contract.
2. Lookup Text owns conversion of article text and approved annotations into word and phrase lookup scopes.
3. React components provide `LookupProvider`, `LookupText`, and `DictionaryDrawer` for Next.js surfaces.
4. Temporary legacy adapters may connect existing static pages to the same service contract during migration.
5. The Next API becomes the sole target HTTP interface for local and production use.
6. `server.js` remains only until required local workflows reach parity, then is removed.
7. Root static source and generated `public/` copies must not be treated as two editable implementations.

Migration proceeds by establishing tests and shared contracts, unifying the API, migrating the Words center, migrating lesson paragraphs, and then removing obsolete static and server paths.

## Consequences

- Dictionary behavior has one source of truth across environments.
- New reading and practice surfaces can reuse the same lookup capability.
- Migration can proceed without a big-bang rewrite.
- Temporary compatibility code is expected and must have an explicit removal condition.
- Shared domain code must avoid DOM, React, Node-only, and cloud-vendor dependencies.

## Alternatives Considered

### Keep static HTML and extract only global JavaScript helpers

Rejected as the long-term direction because the project already carries Next.js and React, and global DOM coupling would continue to limit testing and composition.

### Rewrite the entire frontend immediately

Rejected because it would suspend feature delivery and create unnecessary parity risk.

### Keep two backend implementations

Rejected because dictionary behavior, cache policy, and data shape would continue to drift.

## Implementation Outcome

After Words, Paragraphs, content publication, and portable production initialization stabilized, the migration contract was collapsed. React owns student lookup presentation and text recognition; the Next API owns service-backed lookup through the shared Dictionary Service. The standalone compatibility server, static Words lookup page, static dictionary drawer, and static paragraph tokenizer are no longer executable product paths.
