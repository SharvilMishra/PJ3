# Proposed application architecture

## Initial shape

```text
Browser UI (Frontend)
        |
        | JSON API
        v
Python API (Backend) ---- reads ----> Datasets/*.csv
```

Use a clear frontend/backend boundary. The FastAPI service now serves the static frontend and JSON routes from one origin. It reads and normalizes the CSVs, calculates dashboard summaries, evaluates the three reference IF–THEN rules, and returns alert data. The 5,832-row file is the rule-development dataset and the 30-row file is reported separately for diagnostic counts. Keep rule triggering separate from friendly tips: deterministic rules decide when an alert appears; wording must not change that decision.

## Implemented API surface

- `GET /api/health` reports dataset ranges, row counts, duplicate timestamps, and test date/hour mismatches.
- `GET /api/overview?days=30` supplies the selected historical period's metrics, daily totals, recorded appliance-field mix, and latest matching alert.
- `GET /api/alerts?days=30&limit=50&offset=0` returns paginated alerts calculated from training rows.
- `GET /api/rules` returns the reference conditions and training match counts.
- `GET /api/evaluation` reports raw rule matches, overlaps, and shared timestamps. Test counts are diagnostic, not an unbiased holdout score.

If several example conditions match a row, the API returns one alert in fixed priority order and includes the overlapping/suppressed rule ids. It also reports the raw overlap count so this policy does not hide conflicts. Rule switches currently filter API results in the open browser session and are not persisted.

## Initial technology choices

- Frontend: a minimal static HTML, CSS, and JavaScript prototype. It has no package manager, build step, or UI framework; add one only if the project grows enough to justify it.
- Backend: Python with FastAPI. Python fits the tabular data and future forecasting or optimization work.
- Data for the prototype: keep the supplied CSVs as read-only source data. Normalize them through a documented loading/service layer rather than letting UI components parse files independently.
- Database: none in the initial version. The backend can derive alerts from the input files on demand.

## Database decision

The current scope does not require MySQL, PostgreSQL, or Supabase. A database would duplicate data already in the CSVs and add deployment and maintenance work. Reconsider persistence only if the product needs to retain settings across devices, saved plans, ongoing uploads, multiple homes, or alert history that cannot be regenerated from source data.

## Data and rule cautions

- Preserve the original CSVs; use a separate cleaned/derived representation if data normalization is needed.
- The test file's `date` and `hour` columns do not always match its `timestamp`; validate these fields before analysis.
- The training and test files share three timestamps. Report this limitation in evaluation results and avoid silently treating the test set as fully unseen.
- The example rules produce four overlapping training rows. Choose three rules from training patterns and verify non-overlap in training and test, or define a clear priority policy.
- Document each rule, assumptions, and calculation before presenting savings as guaranteed.
- Keep energy calculations and rules in backend services so the dashboard and alert history use consistent results.
