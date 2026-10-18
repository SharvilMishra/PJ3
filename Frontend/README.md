# Frontend

Responsive, framework-free frontend prototype for Energy Advisor. Run the local backend using [Backend/README.md](../Backend/README.md), then open `http://127.0.0.1:8000`. The backend serves this frontend and its JSON API from one origin.

Overview metrics and charts, Insights, Alerts, and rule counts are calculated from the supplied CSVs. The startup house animation and skeleton preview lead into the four hash-routed workspaces. Rule switches filter alerts for the current page session only; no user settings are written to disk or a database.
