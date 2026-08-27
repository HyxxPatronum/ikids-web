# Issue tracker: Local Markdown

Issues and specs for this repository live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The specification is `.scratch/<feature-slug>/spec.md`
- Implementation issues use one file per ticket:
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Ticket numbering starts at `01`
- Status is recorded with a `Status:` line near the top
- Comments are appended under a `## Comments` heading

## Publishing an issue

Create a file under `.scratch/<feature-slug>/`, creating the directory when needed.

## Fetching a ticket

Read the referenced file directly. The user will normally provide its path or ticket number.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`
- Child ticket: `.scratch/<effort>/issues/<NN>-<slug>.md`
- Ticket type is recorded using `Type:`
- Ticket state is recorded using `Status:`
- Dependencies use `Blocked by: NN, NN`
- Claiming a ticket changes its status to `claimed`
- Resolving a ticket adds an `## Answer` section and changes its status to `resolved`
