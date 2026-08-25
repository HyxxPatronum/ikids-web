# Domain Context

Fluent Science Reading is a curriculum-aware science English learning product. This document defines the vocabulary used when designing or implementing its shared lookup capability.

## Glossary

### Lookup

A request to explain one selected lookup scope. The scope is either a single word or an approved multi-word term. Use **lookup**, not generic synonyms such as search, when referring to the dictionary interaction.

### Lookup Scope

The exact text unit the student is querying. A scope can be a word such as `living`, or an approved phrase such as `living things`.

### Lexeme

The normalized dictionary identity behind a surface form. `flowers` can resolve to the lexeme `flower`. A lexeme does not by itself imply membership in a curriculum catalog.

### Surface Form

The text exactly as it appears in the article, including an inflected form such as `grew` or `flowers`.

### Course Term

A word or phrase intentionally attached to a course card by the content workflow. Course terms may carry an approved course sense, illustration, pronunciation, and source location.

### Course Sense

The meaning intended in the current lesson. It is authored or approved with the course and ranks ahead of general dictionary senses.

### Dictionary Sense

A meaning supplied by ECDICT or an external English dictionary. Dictionary senses supplement a course sense; they do not replace or reclassify it.

### Vocabulary Catalog

One of the three student-browsable collections: **Level 2**, **Level 3**, or **Science Core**. Catalog membership is separate from lookup-result aggregation.

### Level 2

The fixed local catalog of 505 curriculum words.

### Level 3

The fixed local catalog of 1095 curriculum words. It has no overlap with Level 2.

### Science Core

The dynamic catalog of approved science concepts gathered from published course cards. A word already assigned to Level 2 or Level 3 does not gain Science Core catalog membership; it may still receive a course-specific science sense.

### Approved Phrase

A multi-word Course Term imported with course content or accepted by an editor. Automatic phrase detection may suggest candidates in the content workspace but cannot directly change student-facing text behavior.

### Lookup Summary

The concise first view: selected scope, phonetic information, available US/UK pronunciation, the most useful common part of speech and meaning, course illustration, and source-aware status.

### Lookup Detail

Information revealed by More, including less common senses, additional examples, forms, and source detail.

### Pronunciation Asset

An audio recording with an explicit accent, source, availability state, and storage location. US and UK assets are independent.

### Illustration Asset

A reviewed image stored with course content, including alternative text and provenance. It is prepared before publication, not generated during lookup.

## Bounded Responsibilities

### Lookup Presentation

Owns the shared drawer, language mode, summary/detail disclosure, pronunciation controls, illustration layout, focus behavior, and per-block loading or error feedback. It does not decide dictionary truth or vocabulary membership.

### Lookup Text

Turns article text plus approved term annotations into selectable scopes. It performs longest-match phrase selection, exposes alternate word scopes, and preserves readable text semantics.

### Dictionary Service

Normalizes input, resolves lexemes, ranks course context, aggregates sources, applies catalog invariants, and returns one stable response contract. It contains no cloud-vendor or DOM code.

### Content Publishing

Validates terms and phrases, prepares or verifies illustrations and pronunciation assets, builds searchable indexes, and exposes Science Core entries only after a course is published.

### Infrastructure Adapters

Connect the Dictionary Service to the local catalogs, ECDICT, external dictionary providers, database, cache, object storage, and pronunciation providers. Provider-specific behavior stays behind these adapters.

## Invariants

1. Level 2, Level 3, and Science Core catalog memberships are mutually exclusive.
2. Aggregating lookup sources never changes catalog membership.
3. Course Sense ranks ahead of unrelated general senses in the current lesson.
4. Only approved phrases alter student-facing lookup scope.
5. Only published courses contribute terms to the student Science Core catalog.
6. One unavailable provider cannot erase results already available from another source.
7. US and UK labels require independently identified pronunciation assets.
8. Student lookup never performs live image generation or unreviewed image search.
9. Browser clients call the product API rather than binding directly to external dictionary or audio domains.

## System Direction

Lookup behavior belongs in shared domain modules, React presentation components, and the Next API. The Next API is the sole product HTTP interface for lookup in local development, automated tests, and production startup; the former compatibility server has been removed.
