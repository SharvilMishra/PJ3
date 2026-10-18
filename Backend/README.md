# Backend

Minimal FastAPI service that reads the original CSV files directly. It does not use SQL or write to the datasets. The API serves the frontend and exposes sample-backed overview, alerts, reference rules, evaluation counts, and dataset health.

## Run locally on Windows

Install Python 3.10 or newer if it is not already installed. From the project root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r Backend\requirements.txt
python -m uvicorn Backend.app:app --reload
```

Open `http://127.0.0.1:8000` for the app and `http://127.0.0.1:8000/api/docs` for the interactive API reference. The process must run from the project root so the relative project layout and source CSVs remain available.

## API

- `GET /api/health` — dataset dates, row counts, duplicates, and test date/hour inconsistencies.
- `GET /api/overview?days=30` — period totals, daily usage, appliance fields, and latest example alert.
- `GET /api/alerts?days=30&limit=50&offset=0` — deterministic alerts from the training data.
- `GET /api/rules` — the three reference conditions and their training match counts.
- `GET /api/evaluation` — raw training/test trigger counts, rule overlaps, and shared timestamps.

## Rule behavior and limits

The rules reproduce the three conditions described in the supplied project example. If multiple conditions match one reading, the API emits one alert using the listed priority order and reports the suppressed matches. It also reports raw overlaps for review. These are transparent reference rules, not thresholds discovered through optimization or savings guarantees. The test set is sparse and shares timestamps with training; its counts are an audit, not an unbiased holdout score. CSV changes require restarting the local service because loaded rows are cached for the process lifetime.
