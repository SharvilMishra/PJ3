# Smart Home Energy Saver

A web application for understanding household energy use and exploring energy-saving actions using the supplied smart-home dataset.

## Project layout

```text
About/          Project brief and product notes
Backend/        Python API and energy analysis services
Datasets/       Original input CSV files; keep source files unchanged
docs/           Architecture, dataset notes, and technical decisions
Example/        Provided HTML reference and Gemini Canvas output assets
Frontend/       Responsive frontend prototype with four workspaces
Gemini_Canvas_Prompt/ Gemini Canvas prompt and project handoff notes
PROJECT_TOKEN_USAGE.md  Manual project-wide token usage ledger
```

See [About/readme.md](About/readme.md) for the project brief, [docs/architecture.md](docs/architecture.md) for the proposed application shape, and [Gemini_Canvas_Prompt/gemini-canvas-prompt.md](Gemini_Canvas_Prompt/gemini-canvas-prompt.md) for the Canvas build prompt.

## Current status

The responsive frontend has separate Overview, Insights, Alerts, and Smart Rules workspaces. The FastAPI service reads the original CSVs directly and calculates the charts, sample alerts, rule counts, and data-quality summary. The three alert conditions are reference examples with explicit conflict priority; they still need rule review before being described as optimized recommendations. The original CSV files remain unchanged in `Datasets/`.

## Initial technical approach

Run the local app using the instructions in [Backend/README.md](Backend/README.md). The initial version uses a Python/FastAPI backend and CSV files, with no SQL database. Revisit persistence only if the app later needs cross-device settings, saved plans, uploads, or live history. The source CSV files are read-only inputs.
