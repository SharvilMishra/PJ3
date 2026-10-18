# Backend

Minimal FastAPI service that reads the original CSV files directly. It does not use SQL or write to the datasets. The API serves the frontend and exposes sample-backed overview, alerts, reference rules, evaluation counts, and dataset health.

## Run locally on Windows

Install Python 3.10 or newer if it is not already installed. From the project root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn Backend.app:app --reload
```

Open `http://127.0.0.1:8000` for the app and `http://127.0.0.1:8000/api/docs` for the interactive API reference. The process must run from the project root so the relative project layout and source CSVs remain available.

## Deploy the app to Vercel

Import the repository into Vercel with the project root set to the repository root (do not set it to `Frontend/`). Vercel detects FastAPI from `requirements.txt`; `pyproject.toml` points it at the app, `vercel.json` includes both CSV datasets in the function bundle, and the FastAPI static mounts serve the frontend and logo assets. Deploy the project, then open `/api/health` on its Vercel URL to confirm that both datasets loaded.

The intended deployment serves the frontend and API from the same Vercel project, so leave `window.ENERGY_API_BASE` empty in `Frontend/index.html`; the frontend will use same-origin `/api/...` routes. If you keep the frontend on GitHub Pages instead, set that value to the Vercel URL and retain the Pages origin in `FRONTEND_ORIGINS` for CORS.

## API

- `GET /api/health` — dataset dates, row counts, duplicates, and test date/hour inconsistencies.
- `GET /api/overview?days=30` — period totals, daily usage, appliance fields, and latest example alert.
- `GET /api/alerts?days=30&limit=50&offset=0` — deterministic alerts from the training data.
- `GET /api/rules` — the three reference conditions and their training match counts.
- `GET /api/evaluation` — raw training/test trigger counts, rule overlaps, and shared timestamps.

## Rule behavior and limits

The rules reproduce the three conditions described in the supplied project example. If multiple conditions match one reading, the API emits one alert using the listed priority order and reports the suppressed matches. It also reports raw overlaps for review. These are transparent reference rules, not thresholds discovered through optimization or savings guarantees. The test set is sparse and shares timestamps with training; its counts are an audit, not an unbiased holdout score. CSV changes require restarting the local service because loaded rows are cached for the process lifetime.
