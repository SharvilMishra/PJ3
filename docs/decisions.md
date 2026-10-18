# Technical decisions

## Initial decisions

1. Build a Python/FastAPI backend for CSV loading, normalization, and energy-saving rule evaluation.
2. Keep the CSV source data as files for the first version; do not add SQL storage.
3. Build the alert-app prototype in Gemini Canvas, using the supplied HTML as a behavior reference.
4. Treat savings recommendations as estimates backed by explicit, reviewable rules.

Use training rows to discover three IF–THEN rules and the 30-row test file to evaluate them. Rules must not produce overlapping alerts. Revisit the no-database decision only if the app later needs persistent user-created data.
