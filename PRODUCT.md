# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are Chinese primary-school students learning English through science reading. They need vocabulary help that is fast, understandable, and does not pull them away from the current article.

Content editors are a secondary operational audience. They import course cards, review Science Core terms and phrases, prepare illustrations and pronunciation assets, preview drafts, and publish approved content.

## Product Purpose

Fluent Science Reading combines short English science articles with listening, vocabulary, comprehension, structure reconstruction, and learning progress. The dictionary capability helps a student understand any English word in an article while preserving the scientific context of the lesson.

Success means that a student can open a concise, useful explanation from any supported reading surface, hear reliable pronunciation, understand the meaning intended by the current course, and resume reading without losing their place.

## Positioning

The product is a curriculum-aware science English reading assistant rather than a generic dictionary. Course-authored meaning and the current scientific context rank ahead of unrelated general meanings, while broader dictionary information remains available on demand.

## Operating Context

- Students use the product on desktop, tablet, and mobile web.
- Lookup is available from the Words center, lesson paragraphs, and future reading or practice surfaces.
- The default lookup view is concise; less common senses and additional examples are revealed through a More action.
- English-English and English-Chinese modes share the same lookup shell and pronunciation assets.
- Course content is imported and reviewed before publication. Draft Science Core terms remain visible only to content editors.

## Capabilities and Constraints

- Every English word in supported paragraphs can be selected for lookup.
- Approved multi-word course terms use longest-match phrase recognition. Selecting a word inside such a term opens the phrase first and offers the individual words as alternate lookup scopes.
- Inflected forms are queried as written and then normalized or lemmatized when necessary.
- Level 2 (505 words), Level 3 (1095 words), and Science Core are mutually exclusive catalog memberships.
- A lookup result may aggregate course senses, local dictionaries, and external English dictionary data without changing catalog membership.
- Course-authored senses and current scientific context rank first.
- Illustrations are generated or supplied during content production, reviewed, stored as course assets, and never generated live during student lookup.
- Published course and Science Core pronunciation assets are prepared ahead of use. Arbitrary words may use a server-mediated external source with device speech as a final fallback.
- US and UK pronunciation are represented independently; one recording must not be presented as both accents.
- The first production target is infrastructure accessible from mainland China. Business logic must remain portable across database, cache, and object-storage providers.
- The exact mainland cloud vendor, external dictionary provider, pronunciation licensing arrangement, and illustration-generation provider remain implementation-time decisions behind adapters.

## Brand Commitments

- Product name: Fluent Science Reading.
- Language should be clear, encouraging, age-appropriate, and instructionally precise.
- The interface must not fabricate definitions, pronunciation variants, scientific claims, or image provenance.

## Evidence on Hand

- Product requirements: `英语教学Web需求文档.md`
- Database design: `数据库设计文档.md`
- Level 2 vocabulary: `data/vocabulary-level2.json`
- Level 3 vocabulary: `data/vocabulary-level3.json`
- Local English-Chinese dictionary index: `data/ecdict-compact.json`
- Existing full lesson activity surface: `index.html`; paragraph lookup: `app/lesson/[slug]/LessonReader.tsx`
- Vocabulary center: `app/words/WordsCenter.tsx`; reusable lookup drawer: `app/components/Lookup.tsx`
- Existing application API: `app/api/[...path]/route.ts`

No verified production usage metrics or approved external-provider service guarantees are currently recorded. Future work must not invent them.

## Product Principles

1. Preserve reading flow: useful meaning should appear quickly and with minimal interruption.
2. Prefer taught context: course meaning outranks generic dictionary breadth.
3. Reveal complexity progressively: common information first, uncommon detail on demand.
4. Fail in parts, not as a whole: local meaning remains available when an external source fails.
5. Publish reviewed learning content: student-facing terms, images, and prepared audio come from approved course material.

## Accessibility & Inclusion

Core lookup actions must work with keyboard, touch, pointer, and assistive technology. The drawer must provide dialog semantics, constrained focus, focus restoration, clear loading and error states, reduced-motion support, and non-color-only feedback. Long passages must avoid creating an impractical number of Tab stops.
