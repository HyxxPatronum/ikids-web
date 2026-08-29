# Domain Context

## Course

A published science-reading record containing a title, article, core words, comprehension questions, and reconstruction steps. Courses are build-time JSON files in the current frontend prototype.

## Learning Session

The local progress for one Course on one browser. It records module completion, answers, reconstruction order, and last update time. It is not an Account and is not synchronized between devices.

## Core Word

A teaching word intentionally included in a Course. It supplies the word review and matching activities; it is not a general dictionary entry.

## Pronunciation Practice

A learner recording of a course sentence. The React interface can record and replay practice. Automatic scoring is intentionally pending its own module and external implementation.

## Content Workspace

A separate operational interface for viewing registered Courses and validating proposed course JSON. It does not publish content or manage user data in the current frontend prototype.
