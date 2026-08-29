# Product

## Purpose

IKIDs helps Chinese primary-school students learn science English through short courses, listening, core-word practice, comprehension, and structure reconstruction.

## Current product scope

- `/courses` lists the bundled published courses and local learning progress.
- `/learn/:slug` is the complete student learning flow.
- `/admin` is a separate local content-validation workspace.
- Course content is build-time JSON; learning progress stays in the browser.

## Deferred capabilities

- Account login, remote progress and multi-device sync: `.scratch/react-frontend-rebuild/issues/01-account-sync-mobile.md`.
- Single-word dictionary lookup: `.scratch/react-frontend-rebuild/issues/02-single-word-dictionary.md`.
- Automatic pronunciation scoring: `.scratch/react-frontend-rebuild/issues/03-pronunciation-scoring-integration.md`.

## Product rules

1. A course must provide its article, 5–6 Core Words, three comprehension questions, and reconstruction steps.
2. Students can complete the full course without a network request after the page loads.
3. Local learning progress must be clear about its device-only limitation.
4. Content Workspace cannot claim to publish or persist content until its independent backend exists.
