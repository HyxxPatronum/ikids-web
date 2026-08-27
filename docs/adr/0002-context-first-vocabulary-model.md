# ADR-0002: Use a context-first vocabulary model

- Status: Accepted
- Date: 2026-08-24

## Context

Students need to query every English word in lesson paragraphs, including inflected forms and approved science phrases. General dictionaries can return technically valid but instructionally irrelevant senses. The product also maintains three distinct word catalogs: Level 2, Level 3, and Science Core.

A single `word → definition` record cannot represent surface forms, phrase scopes, course-specific meaning, multiple dictionary sources, and independent catalog membership without conflating them.

## Decision

Model lookup identity and curriculum classification separately:

- A Lexeme represents normalized dictionary identity.
- A Surface Form records the text selected in context.
- Vocabulary Membership assigns a lexeme to exactly one of Level 2, Level 3, or Science Core for catalog browsing.
- A Course Term attaches a word or phrase to a course card.
- A Course Sense records the meaning intended in that lesson.
- Dictionary Senses from local or external sources supplement the Course Sense.
- Pronunciation and Illustration Assets are independently sourced records.

Lookup ranks information in this order:

1. current course sense;
2. approved Science Core course sense;
3. local Level 2 or Level 3 content;
4. local ECDICT content;
5. external English dictionary content.

The response aggregates useful information but does not merge catalog memberships.

Approved multi-word terms are identified during content import and review. Rendering uses longest-match phrase recognition. Selecting any word inside an approved phrase opens the phrase by default and exposes each constituent word as an alternate scope. Without an approved phrase annotation, words remain independent lookup scopes.

Only published courses contribute entries to the student-facing Science Core catalog. Draft terms remain available to content-editor preview only.

## Consequences

- Scientific meaning remains aligned with the lesson.
- Inflected words and phrases can resolve without sacrificing individual word lookup.
- A familiar word may receive a course-specific science sense without being duplicated into Science Core.
- Content import must validate term annotations and build an index rather than making every lookup scan all cards.
- Editors need a review surface for suggested phrases, senses, illustrations, and pronunciation assets.

## Alternatives Considered

### Treat every whitespace-separated token as a word

Rejected because it cannot represent terms such as `living things` or `take in`.

### Detect phrases dynamically for students

Rejected because adjacent words are ambiguous and unreviewed guesses would change learning content.

### Merge every source into one category field

Rejected because lookup-source aggregation and curriculum membership answer different questions.
