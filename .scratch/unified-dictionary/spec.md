# Unified Dictionary and Reusable Lookup

Status: ready-for-agent

## Problem Statement

Students reading Fluent Science Reading need to understand any English word without leaving the lesson or losing the scientific context. Today, the Words center and lesson paragraphs can open a shared dictionary drawer, but text tokenization is tied to one static lesson page, phrase lookup and reliable lemmatization are missing, pronunciation audio is fetched directly from third-party domains, and local and hosted servers maintain duplicated dictionary logic.

The current behavior creates several student-facing problems: an inflected word may not resolve, an approved science phrase cannot reliably be selected as a unit, a generic dictionary sense may outrank the meaning taught by the lesson, one failed external source can weaken the whole experience, and US/UK pronunciation may be slow or unavailable for mainland China users. It also creates content and engineering problems: draft Science Core terms can leak into the student catalog, lookup scans course content instead of using a publication index, images and pronunciation assets do not have a complete publication pipeline, and future pages cannot reuse paragraph lookup without copying code.

## Solution

Provide one curriculum-aware lookup capability for the Words center, lesson paragraphs, and future reading or practice surfaces. Students can select every English word and every approved multi-word Course Term. The lookup drawer opens from the right, blocks interaction with the page behind it, and presents a concise Lookup Summary first: the selected scope, phonetic information, independently identified US/UK pronunciation, the most useful Course Sense or common Dictionary Sense, and a reviewed Illustration Asset. Lookup Detail reveals less common meanings and additional information only on request.

The system resolves the Surface Form, normalizes or lemmatizes it to a Lexeme, applies longest-match recognition to approved phrases, ranks the current Course Sense ahead of general senses, and aggregates local and external sources without changing Vocabulary Catalog membership. Level 2, Level 3, and Science Core remain mutually exclusive. Only published courses contribute to the student Science Core catalog.

One framework-independent Dictionary Service becomes the source of truth behind a stable product API. Next.js/React receives reusable Lookup Presentation and Lookup Text modules. Existing static pages use temporary compatibility adapters during incremental migration. Mainland-accessible database, cache, object storage, dictionary, and pronunciation providers remain replaceable behind Infrastructure Adapters.

## User Stories

1. As a primary-school student, I want to select any English word in a lesson paragraph, so that I can understand it without leaving the article.
2. As a primary-school student, I want punctuation around a word to be ignored during lookup, so that commas and full stops do not cause failed searches.
3. As a primary-school student, I want contractions, apostrophes, and hyphenated words to be handled consistently, so that ordinary English text remains queryable.
4. As a primary-school student, I want an inflected Surface Form such as `flowers` to resolve to the Lexeme `flower`, so that grammar does not prevent me from finding a meaning.
5. As a primary-school student, I want an irregular Surface Form such as `grew` to resolve to the appropriate Lexeme, so that irregular forms remain understandable.
6. As a primary-school student, I want an approved science phrase such as `living things` to open as one Lookup Scope, so that I see the meaning taught by the lesson.
7. As a primary-school student, I want a phrase to be preferred through longest-match recognition, so that a shorter overlapping term does not replace the intended Course Term.
8. As a primary-school student, I want to switch from an approved phrase to any constituent word, so that every individual word remains queryable.
9. As a primary-school student, I want unapproved adjacent words to remain separate, so that the product does not invent phrases that the course did not teach.
10. As a primary-school student, I want the current Course Sense shown before unrelated Dictionary Senses, so that the explanation matches the science article I am reading.
11. As a primary-school student, I want a concise Lookup Summary first, so that lookup does not interrupt my reading with too much information.
12. As a primary-school student, I want common parts of speech and meanings shown before uncommon ones, so that the most useful explanation is easiest to find.
13. As a curious student, I want a More action that reveals Lookup Detail, so that I can explore less common meanings and additional examples when needed.
14. As a student learning through Chinese, I want to switch to English-Chinese mode, so that I can confirm meaning in my strongest language.
15. As a student practicing English explanations, I want to switch to English-English mode, so that I can learn from age-appropriate English definitions.
16. As a returning student, I want my language-mode preference remembered on the current device, so that I do not need to reset it for every lookup.
17. As a primary-school student, I want phonetic information placed next to the selected word or phrase, so that pronunciation guidance is easy to associate with it.
18. As a primary-school student, I want separate US and UK pronunciation controls when each asset is genuinely available, so that I can hear the accent I selected.
19. As a primary-school student, I want an unavailable accent clearly identified, so that one recording is not misleadingly presented as two accents.
20. As a primary-school student, I want pronunciation playback to show starting, playing, failed, and fallback states, so that I understand what the control is doing.
21. As a student in mainland China, I want audio delivered through the product service or prepared course assets, so that playback does not depend on my browser reaching an unstable foreign CDN.
22. As a student, I want device speech to remain a final fallback, so that I can still hear an approximation when no recording is available.
23. As a primary-school student, I want a reviewed course illustration beside the Lookup Summary, so that a scientific concept is easier to understand visually.
24. As a student using assistive technology, I want every illustration to have useful alternative text, so that the visual explanation is not the only explanation.
25. As a student, I want a stable and intentional empty illustration state, so that a missing asset does not look like a broken page.
26. As a student, I want local Course Senses and Dictionary Senses to appear even when an external provider is slow, so that useful information is not blocked unnecessarily.
27. As a student, I want each result block to report and recover from its own failure, so that one missing audio or definition does not erase the rest of the result.
28. As a student, I want a retry action for temporarily unavailable external information, so that I can recover without closing the drawer.
29. As a student, I want a cached result when an upstream provider is temporarily unavailable, so that previously known information remains useful.
30. As a pointer or touch user, I want the dictionary drawer to slide in from the right with a blocking backdrop, so that the active lookup is visually clear and background controls cannot be triggered.
31. As a student, I want a small close icon, backdrop dismissal, and Escape dismissal where appropriate, so that I can leave lookup predictably.
32. As a keyboard user, I want focus to move into the drawer and return to the selected word when it closes, so that I do not lose my reading position.
33. As a keyboard user, I want long paragraphs to avoid hundreds of sequential Tab stops, so that every-word lookup remains practical without damaging navigation.
34. As a screen-reader user, I want the drawer announced as a modal dialog with a useful accessible name, so that its context and boundaries are clear.
35. As a user who prefers reduced motion, I want lookup transitions to respect that preference, so that animation does not cause discomfort.
36. As a mobile student, I want the drawer to adapt to the available viewport and safe areas, so that the close control and content remain reachable in portrait and landscape.
37. As a student browsing the Words center, I want Level 2, Level 3, and Science Core shown as separate catalogs, so that curriculum classification remains understandable.
38. As a student browsing Level 2, I want the fixed 505-word collection preserved, so that its curriculum scope does not change with course imports.
39. As a student browsing Level 3, I want the fixed 1095-word collection preserved without Level 2 overlap, so that the two levels remain distinct.
40. As a student browsing Science Core, I want only approved terms from published courses, so that I never encounter draft or unreviewed content.
41. As a student, I want a familiar Level 2 or Level 3 word to retain that catalog membership even when a lesson gives it a scientific Course Sense, so that lookup context does not corrupt catalog classification.
42. As a student, I want to return from a Science Core entry to its published source course, so that I can see the term in context.
43. As a content editor, I want imported Course Terms and Approved Phrase candidates validated, so that malformed or ambiguous annotations are caught before publication.
44. As a content editor, I want automatic phrase detection to produce review suggestions only, so that an algorithm cannot silently change student-facing lookup behavior.
45. As a content editor, I want to accept, reject, or correct a phrase candidate, so that the published Lookup Scope reflects instructional intent.
46. As a content editor, I want to preview draft Course Senses and phrase behavior, so that I can verify the experience before students see it.
47. As a content editor, I want draft Science Core terms excluded from the student catalog, so that publishing remains the visibility boundary.
48. As a content editor, I want generated or supplied illustrations reviewed with alternative text and provenance, so that student imagery is accurate, accessible, and accountable.
49. As a content editor, I want US and UK Pronunciation Assets to show their source and readiness independently, so that publication does not mislabel audio.
50. As a content editor, I want course publication to build or update the searchable term index, so that student lookup does not scan every course card.
51. As a content editor, I want unpublishing or archiving a course to update student-visible Science Core results without deleting historical course data, so that visibility and retention remain separate concerns.
52. As an application developer, I want one stable Dictionary Service contract, so that Words, Paragraphs, and future pages receive consistent results.
53. As an application developer, I want Lookup Text separated from Lookup Presentation, so that text recognition can be reused without copying drawer code.
54. As an application developer, I want provider behavior behind Infrastructure Adapters, so that changing cloud, dictionary, cache, storage, or pronunciation vendors does not rewrite domain logic.
55. As an application developer, I want legacy static pages to use temporary compatibility adapters, so that the product can migrate without a big-bang rewrite.
56. As an operator, I want repeatable database migrations and dictionary seed operations, so that a successful deployment also has working English-Chinese lookup.
57. As an operator, I want positive, negative, and stale-result caching, so that upstream cost and failure do not directly determine student experience.
58. As an operator, I want lookup latency, provider errors, cache hit rate, and stale-result use observable, so that production instability can be detected and diagnosed.
59. As an operator, I want external credentials and provider domains hidden behind the product API, so that browser clients do not expose secrets or hard-code suppliers.
60. As a maintainer, I want the compatibility server removed after local and production parity, so that dictionary behavior has one source of truth.

## Implementation Decisions

1. **Architecture layers.** Build framework-independent domain and application modules for Lookup Scope resolution, Lexeme normalization, source aggregation, contextual ranking, catalog invariants, and result shaping. Keep DOM, React, Node runtime, and cloud-provider concerns outside these modules.

2. **Presentation modules.** Provide reusable Lookup Provider, Lookup Text, and Dictionary Drawer modules. Lookup Provider owns open/close state, selected scope, language mode, request lifecycle, focus origin, and result state. Lookup Text exposes selectable words and Approved Phrases while preserving readable article semantics. Dictionary Drawer renders the modal experience and delegates all dictionary truth to the service response.

3. **Incremental migration.** Migrate to Next.js/React without rewriting the entire product at once. Establish shared contracts first, migrate the Words center, migrate lesson Paragraphs, require future pages to use the shared modules, and remove legacy implementations only after behavior parity is demonstrated.

4. **Single API.** The Next API is the sole target HTTP interface in development and production. The compatibility server may delegate to the shared service during migration but must not retain an independent dictionary implementation.

5. **Lookup request contract.** A request carries the Surface Form, selected Lookup Scope, requested language mode, optional course/card context, optional sentence context, and alternate phrase or word scopes. Existing simple word queries remain compatible during migration.

6. **Lookup response contract.** A response distinguishes the resolved Lexeme, selected and alternate scopes, Vocabulary Catalog membership, Lookup Summary, Lookup Detail, Pronunciation Assets, Illustration Asset, contributing sources, cache state, and per-source availability or error state. Clients do not infer accent, membership, or source priority from URLs or display strings.

7. **Normalization.** Query the selected Surface Form first, then apply conservative punctuation normalization, case folding, possessive handling, and lemmatization. Preserve both Surface Form and resolved Lexeme in the result. Ambiguous transformations must not silently replace a successful exact match.

8. **Phrase recognition.** Approved Phrases originate from imported course annotations or explicit editor approval. Content processing may suggest phrases but cannot publish them automatically. Runtime text preparation uses deterministic longest-match recognition and provides constituent words as alternate scopes.

9. **Contextual ranking.** Rank the current Course Sense first, then an approved Science Core sense, local Level 2 or Level 3 content, local ECDICT content, and finally external English dictionary content. Aggregate useful senses while retaining source identity and removing exact duplicates.

10. **Progressive disclosure.** Lookup Summary contains only the selected scope, phonetic information, available accent controls, the most useful common parts of speech and senses, illustration, and essential status. Lookup Detail contains less common senses, additional examples, forms, and source information.

11. **Catalog membership.** Model Lexeme identity separately from Vocabulary Catalog membership. Level 2, Level 3, and Science Core memberships are mutually exclusive. A Course Sense may enrich a Level 2 or Level 3 Lexeme without adding Science Core membership.

12. **Catalog source data.** Preserve the local Level 2 collection at 505 entries and Level 3 at 1095 entries with zero overlap. Treat changes to these source lists as explicit content migrations, not incidental course-import side effects.

13. **Publication boundary.** Only published courses contribute Course Terms to the student Science Core index. Draft terms and phrase behavior are available through editor preview. Unpublishing or archiving updates visibility and indexes without destroying historical records.

14. **Indexed lookup.** Publication builds normalized term, phrase, course-occurrence, membership, and asset references. Student lookup uses these indexes and must not parse every course card on each request.

15. **Persistence model.** Persist records equivalent to Lexeme, Vocabulary Membership, Course Term and occurrence, Course Sense, cached Dictionary Sense, Pronunciation Asset, and Illustration Asset. Store structured metadata in the database and binary image/audio content in object storage.

16. **Dictionary sources.** Use local course data and ECDICT without a paid English-Chinese API dependency. Keep the external English dictionary behind an adapter so a provider can be replaced after mainland availability, licensing, and production-service review.

17. **Cache behavior.** Support positive, negative, and stale-success entries with configurable expiry. Preserve the current seven-day positive and thirty-minute not-found durations as initial defaults unless production evidence justifies adjustment. Merge concurrent requests for the same normalized lookup to avoid duplicate upstream calls.

18. **Progressive failure.** Resolve and return available local information even when an external source fails. Each external block reports its own loading, unavailable, stale, and retry states. Distinguish confirmed not-found results from temporary provider failure.

19. **Pronunciation chain.** Prefer prepared published-course assets, then product-served or product-proxied provider audio, then device speech synthesis. Keep US and UK records independent, with explicit accent, source, availability, and fallback metadata. Never use one recording under both accent labels.

20. **Audio delivery.** Browser clients do not fetch external provider audio domains directly. The product service applies validation, timeout, provider policy, and optional caching or storage where licensing permits.

21. **Illustration workflow.** Generate or supply illustrations during content production, require editor review, alternative text, and provenance, then store them as course assets. Lookup does not run live image generation or unreviewed image search.

22. **Language modes.** English-English and English-Chinese modes use the same resolved Lexeme, Course Sense, pronunciation, and illustration data. Store the current mode as a device preference initially; account synchronization is not required by this specification.

23. **Modal behavior.** Open the drawer from the right with a blocking backdrop. While open, background controls are inert, focus is constrained to the dialog, Escape and the close icon close it, permitted backdrop dismissal closes it, and focus returns to the initiating scope after the exit transition completes.

24. **Accessible text navigation.** Pointer and touch users can select every word directly. Keyboard interaction uses an efficient focus strategy such as sentence entry plus roving active-word navigation rather than placing every word in the document-wide Tab order. Screen-reader reading order and text comprehension must remain usable.

25. **Responsive behavior.** Desktop uses a bounded right drawer with the illustration beside the Lookup Summary. Small screens may use a full-width drawer while keeping close controls, language modes, accent controls, content, and safe-area spacing reachable. Honor reduced-motion preference.

26. **Security and abuse controls.** Validate query length and allowed text shape, encode output, keep credentials server-side, apply rate limits appropriate to anonymous student lookup, and prevent an arbitrary audio proxy target from becoming an open proxy.

27. **Portable infrastructure.** Target a mainland-accessible production environment while defining adapters for relational storage, cache, object storage, external dictionary, and pronunciation services. Exact provider selection remains outside the domain modules.

28. **Repeatable operations.** Production setup includes deterministic schema migrations, ECDICT import, course term indexing, asset upload, health verification, and safe re-execution. Application requests must not perform schema creation or bulk seed work.

29. **Observability.** Record aggregate lookup success, exact/not-found/provider-failure outcomes, latency percentiles, adapter error rates, cache hit and stale use, audio fallback use, and publication-index failures without logging sensitive free-form student context unnecessarily.

30. **Source ownership.** During static compatibility, maintain one editable source and treat generated public assets as build output. Do not apply independent fixes to generated copies.

## Testing Decisions

1. Good tests assert externally observable behavior and stable public contracts. They do not assert private helper calls, DOM implementation structure, cloud SDK details, CSS class names, or the internal order of adapters when the result is unchanged.

2. Use two testing seams: browser-level student behavior as the primary acceptance seam, and the public Dictionary Service contract with controlled in-memory adapters as the exhaustive domain seam.

3. Add browser tests that start from both a lesson Paragraph and the Words center. They select a word or Approved Phrase, observe the drawer, switch Lookup Scope and language mode, expand Lookup Detail, play available accents, recover from partial failures, close the drawer, and verify focus restoration.

4. Run browser behavior at representative desktop and mobile viewports. Include keyboard-only navigation, reduced-motion behavior, backdrop blocking, Escape dismissal, safe-area reachability, long words, long definitions, and missing Illustration Assets.

5. Prefer role, accessible name, visible content, focus, and network-contract assertions over screenshot-only or selector-structure assertions. Use screenshots for bounded visual regression coverage of the drawer's major responsive states, not as the sole behavioral oracle.

6. Run browser tests against deterministic local fixtures or fake adapters. Tests must not depend on live Free Dictionary, TTS, image-generation, cloud database, object storage, or audio CDN availability.

7. Test the Dictionary Service contract with exact matches, punctuation, capitalization, possessives, regular inflections, irregular inflections, unknown words, Approved Phrases, overlapping phrases, and constituent-word alternatives.

8. Test contextual ranking with conflicting Course Sense, Science Core, Level 2/3, ECDICT, and external Dictionary Senses. Assert the student-visible order and source labels, not private sorting implementation.

9. Test catalog invariants using the real fixed Level 2 and Level 3 source datasets: expected counts, zero overlap, deterministic alias handling, and exclusion of their members from Science Core membership.

10. Test content publication behavior with draft, published, unpublished, and archived courses. Assert that only published terms appear in the student Science Core index while editor preview retains draft data.

11. Test the publication index through its public operation and resulting lookup behavior. Assert idempotent re-publication, changed phrases, removed terms, asset references, and no dependency on scanning all course cards at request time.

12. Test source aggregation with duplicate senses, complementary senses, exact not-found, timeout, malformed provider data, positive cache, negative cache, expired cache, stale success, and concurrent identical requests.

13. Test pronunciation behavior with US only, UK only, both accents, neither accent, prepared asset failure, proxied provider failure, and device-speech fallback. Assert that accent labels never duplicate an unidentified recording.

14. Test the audio-serving boundary against invalid target hosts, unsupported media types, oversized responses, timeout, and cache policy so it cannot behave as an unrestricted proxy.

15. Test English-English and English-Chinese modes against the same Lexeme and Course Sense context. Assert that a missing external English result does not remove local Chinese or course information.

16. Test accessibility behavior with automated checks plus explicit focus assertions. Automated scans supplement but do not replace keyboard and screen-reader-semantic scenarios.

17. Retain the existing syntax and static-page checks during migration. The existing checks are prior art only for build-time validation; the repository currently has no prior behavioral test suite.

18. Add one migration-parity suite that exercises the same fixtures through the legacy compatibility entry and the new product API until the legacy path is removed. Delete this suite with the compatibility path rather than preserving obsolete behavior indefinitely.

19. Define the compatibility-server removal gate as passing API contract tests, Words browser tests, Paragraph browser tests, local development workflows, and production seed/index health checks through the single Next API.

## Out of Scope

- Selecting or purchasing a specific mainland cloud, dictionary, pronunciation, image-generation, database, cache, or object-storage provider.
- Provisioning production infrastructure, domains, credentials, compliance filings, monitoring accounts, or CI secrets.
- Acquiring commercial licenses or making legal conclusions about external dictionary, image, or audio data.
- Live image generation or unreviewed image search during student lookup.
- Automatically publishing machine-detected phrases without editor approval.
- Generating pronunciation audio for every possible English word in advance.
- AI pronunciation scoring, speech assessment, or changes to the existing student recording-assignment feature.
- Translating external English definitions automatically when no approved English-Chinese entry exists.
- Redesigning the entire product brand or unrelated learning modules.
- Migrating account, syllabus, administration, comprehension, or rebuild surfaces except where a shared shell change is strictly required for lookup integration.
- Adding payment, subscription, parent dashboards, class management, social features, rankings, or gamification.
- Synchronizing dictionary language preference across user accounts in this phase.
- Deleting historical course, term, learning-progress, or asset records when content is unpublished or archived.

## Further Notes

- This specification implements ADR-0001, ADR-0002, and ADR-0003 and uses the glossary in the project's Domain Context.
- The existing shared drawer is useful behavioral prior art, but it is not the final architectural boundary because it couples state, rendering, audio, global DOM, and storage.
- The current 505-entry Level 2 and 1095-entry Level 3 datasets have no direct overlap and should become invariant fixtures.
- The current hosted ECDICT table can exist without the full dictionary seed. Deployment readiness must verify data presence, not only schema presence.
- Current direct third-party audio fetching is the principal known cause of unreliable pronunciation for mainland users.
- Exact provider choices remain open intentionally; Infrastructure Adapter contracts allow implementation and procurement to proceed independently.
- Delivery should be split into tracer-bullet tickets after this spec. Early tickets should establish the Dictionary Service contract and one browser-visible lookup slice before broad migration or infrastructure expansion.
