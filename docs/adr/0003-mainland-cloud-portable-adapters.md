# ADR-0003: Target mainland China through portable infrastructure adapters

- Status: Accepted
- Date: 2026-08-24

## Context

The primary users are in mainland China. The current English definition response passes through the product API, but pronunciation audio is fetched by the browser directly from third-party domains. This causes unstable playback. The hosted implementation also depends directly on Cloudflare D1, has no guaranteed ECDICT seed step, does not yet use configured object storage, and performs broad course scans during lookup.

The product needs a stable initial mainland deployment without permanently coupling domain behavior to one cloud vendor.

## Decision

Use mainland-accessible cloud infrastructure as the first production target while placing provider-specific behavior behind adapters:

- relational database adapter for courses, terms, indexes, and persistent dictionary cache;
- cache adapter for positive, negative, and stale lookup results;
- object-storage adapter for reviewed illustrations and pronunciation assets;
- external English dictionary adapter;
- pronunciation provider and proxy adapter;
- content-publication jobs for indexes and prepared assets.

Published course and Science Core words should use prepared pronunciation assets when available. Arbitrary words use the product server to resolve or proxy external audio. Device speech synthesis is the final fallback. US and UK availability is represented independently.

Illustrations are generated or supplied during content production, reviewed, assigned alternative text and provenance, and stored before publication. Student lookup never performs live image generation or unreviewed image search.

Lookup responses are progressively assembled. Failure of an external English dictionary or pronunciation source does not prevent course senses, local definitions, cached information, or illustrations from rendering.

Provider choice remains open behind the adapter contracts. Production setup must include repeatable database migrations, ECDICT import, object upload, health checks, and observability for latency, provider errors, cache hit rate, and stale-result use.

## Consequences

- Mainland users no longer depend on direct browser access to a foreign audio CDN.
- Common course content can remain available during upstream outages.
- A cloud migration requires adapter work rather than domain rewrites.
- Storage, bandwidth, provider licensing, and content provenance become explicit operational responsibilities.
- External providers must be evaluated for mainland reachability, terms, and commercial use before production selection.

## Alternatives Considered

### Let browsers call third-party dictionary and audio services directly

Rejected because availability, privacy, timeout behavior, and provider replacement would be outside product control.

### Generate every possible pronunciation in advance

Rejected because arbitrary lookup has an open vocabulary and would create unnecessary storage and generation cost.

### Bind the domain layer directly to the first cloud vendor

Rejected because the selected mainland provider may change and the project already has a different hosted prototype environment.
