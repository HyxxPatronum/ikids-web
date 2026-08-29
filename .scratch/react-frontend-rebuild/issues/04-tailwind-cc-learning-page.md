# Tailwind CSS Component Compiler migration for learning page

Type: technical-debt
Status: open

## Context

The React learning page currently reproduces the legacy `ikids-web/index.html`
markup and stylesheet directly so the established visual and interaction design
can be migrated without a visual redesign.

## Requested follow-up

Migrate the `/learn/[slug]` surface from the copied legacy CSS to Tailwind CSS
and the project's component conventions (Tailwind CC), without changing the
approved page appearance or the learning-flow behavior.

## Acceptance criteria

- Replace `app/learn/reference-learning.css` with Tailwind utilities and small
  reusable components where repetition is real.
- Preserve every desktop and mobile layout, state, animation, and interaction
  represented in `C:/Users/A/Desktop/web-raw/ikids-web/index.html`.
- Keep the current course data contract and browser-only progress behavior.
- Verify production build, typecheck, and a desktop/mobile visual comparison
  against the legacy page.

## Notes

Do not begin this migration until the legacy DOM reproduction has been accepted;
it is the visual baseline for the Tailwind implementation.
