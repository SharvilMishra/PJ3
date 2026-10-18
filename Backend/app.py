"""Small, file-backed API for the Energy Advisor prototype."""

from __future__ import annotations

import csv
import math
import os
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parents[1]
DATASETS = {
    "training": ROOT / "Datasets" / "sic_IoT_dataset_PJ3.csv",
    "test": ROOT / "Datasets" / "sic_IoT_test_PJ3.csv",
}
FRONTEND = ROOT / "Frontend"
REQUIRED_FIELDS = {
    "home_id", "timestamp", "occupied", "humidity", "outdoor_temp_c",
    "indoor_temp_c", "hvac_mode", "heat_set_c", "cool_set_c", "hvac_usage_kwh",
    "robot_vacuum_usage_kwh", "washer_dryer_usage_kwh",
    "dishwasher_usage_kwh", "total_usage_kwh", "price_tou_usd_per_kwh",
    "tariff_period", "cost_usd",
}
APPLIANCES = (
    ("climate_control", "Climate control", "hvac_usage_kwh"),
    ("dishwasher", "Dishwasher", "dishwasher_usage_kwh"),
    ("washer_dryer", "Washer & dryer", "washer_dryer_usage_kwh"),
    ("robot_vacuum", "Robot vacuum", "robot_vacuum_usage_kwh"),
)

RULES = (
    {
        "id": "peak_appliance_shift",
        "name": "Peak appliance shift",
        "short_description": "Shift flexible dishwasher use out of peak-price hours.",
        "condition": "dishwasher_usage_kwh > 0 and tariff_period is Peak",
        "priority": 1,
        "tip": "If it can wait, try running the dishwasher during an off-peak window.",
    },
    {
        "id": "night_heating_reduction",
        "name": "Night heating reduction",
        "short_description": "Offer a gentler heating suggestion on mild nights.",
        "condition": "00:00–04:59, HVAC is heating, and outdoor temperature is above 10°C",
        "priority": 2,
        "tip": "It is a mild night. A small heating adjustment may help keep energy use in check.",
    },
    {
        "id": "mild_weather_cooling",
        "name": "Mild-weather cooling",
        "short_description": "Suggest natural cooling when outdoor air is cooler than indoors.",
        "condition": "HVAC is cooling and outdoor temperature is no higher than indoor temperature",
        "priority": 3,
        "tip": "Cooler outdoor air may be a comfortable alternative to extra cooling.",
    },
)

app = FastAPI(title="Energy Advisor API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000,https://sharvilmishra.github.io",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept"],
)


def _number(value: str | float | int | None, field: str) -> float:
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"Missing number in {field}")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid number in {field}: {value!r}") from exc
    if not math.isfinite(result):
        raise ValueError(f"Non-finite number in {field}")
    return result


def _parse_record(source: dict[str, str], dataset: str, line: int) -> dict[str, Any]:
    missing = REQUIRED_FIELDS - source.keys()
    if missing:
        raise ValueError(f"{dataset} CSV is missing fields: {', '.join(sorted(missing))}")
    blank_fields = [field for field in REQUIRED_FIELDS if not (source.get(field) or "").strip()]
    if blank_fields:
        raise ValueError(f"{dataset} CSV row {line} has empty fields: {', '.join(sorted(blank_fields))}")
    try:
        raw_timestamp = source["timestamp"].strip()
        try:
            timestamp = datetime.fromisoformat(raw_timestamp)
        except ValueError:
            timestamp = datetime.strptime(raw_timestamp, "%Y-%m-%d %H:%M")
        record: dict[str, Any] = dict(source)
        record["timestamp_dt"] = timestamp
        for key in (
            "occupied", "humidity", "outdoor_temp_c", "indoor_temp_c",
            "heat_set_c", "cool_set_c",
            "hvac_usage_kwh", "robot_vacuum_usage_kwh", "washer_dryer_usage_kwh",
            "dishwasher_usage_kwh", "total_usage_kwh", "price_tou_usd_per_kwh", "cost_usd",
        ):
            record[key] = _number(source.get(key), key)
        if dataset == "test":
            try:
                record["date_timestamp_mismatch"] = date.fromisoformat(source.get("date", "")) != timestamp.date()
            except ValueError:
                record["date_timestamp_mismatch"] = True
            try:
                record["hour_timestamp_mismatch"] = int(source.get("hour", "-1")) != timestamp.hour
            except ValueError:
                record["hour_timestamp_mismatch"] = True
        else:
            record["date_timestamp_mismatch"] = False
            record["hour_timestamp_mismatch"] = False
        return record
    except (ValueError, OverflowError) as exc:
        raise ValueError(f"Invalid {dataset} CSV row {line}: {exc}") from exc


@lru_cache(maxsize=2)
def load_rows(dataset: str) -> tuple[dict[str, Any], ...]:
    path = DATASETS.get(dataset)
    if path is None or not path.is_file():
        raise ValueError(f"Dataset file not found: {dataset}")
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            rows = tuple(_parse_record(row, dataset, number) for number, row in enumerate(reader, start=2))
    except OSError as exc:
        raise ValueError(f"Unable to read {dataset} dataset: {exc}") from exc
    return tuple(sorted(rows, key=lambda row: row["timestamp_dt"]))


def _rule_matches(row: dict[str, Any], enabled_ids: set[str] | None = None) -> list[dict[str, Any]]:
    timestamp = row["timestamp_dt"]
    mode = str(row["hvac_mode"]).strip().lower()
    tariff = str(row["tariff_period"]).strip().lower()
    matches = []
    if (enabled_ids is None or RULES[0]["id"] in enabled_ids) and row["dishwasher_usage_kwh"] > 0 and tariff == "peak":
        matches.append(RULES[0])
    if (enabled_ids is None or RULES[1]["id"] in enabled_ids) and timestamp.hour < 5 and mode == "heat" and row["outdoor_temp_c"] > 10:
        matches.append(RULES[1])
    if (enabled_ids is None or RULES[2]["id"] in enabled_ids) and mode == "cool" and row["outdoor_temp_c"] <= row["indoor_temp_c"]:
        matches.append(RULES[2])
    return matches


def _alert(row: dict[str, Any], rule: dict[str, Any], matched: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": f"{rule['id']}:{row['timestamp_dt'].isoformat()}:{row['home_id']}",
        "rule_id": rule["id"],
        "rule_name": rule["name"],
        "timestamp": row["timestamp_dt"].isoformat(),
        "home_id": row["home_id"],
        "tip": rule["tip"],
        "total_usage_kwh": round(row["total_usage_kwh"], 3),
        "dishwasher_usage_kwh": round(row["dishwasher_usage_kwh"], 3),
        "tariff_period": row["tariff_period"],
        "rate_usd_per_kwh": round(row["price_tou_usd_per_kwh"], 4),
        "cost_usd": round(row["cost_usd"], 4),
        "outdoor_temp_c": round(row["outdoor_temp_c"], 1),
        "indoor_temp_c": round(row["indoor_temp_c"], 1),
        "matched_rule_ids": [item["id"] for item in matched],
        "suppressed_rule_ids": [item["id"] for item in matched if item["id"] != rule["id"]],
        "sample": True,
    }


def _resolve_alerts(rows: list[dict[str, Any]], enabled_ids: set[str] | None = None) -> tuple[list[dict[str, Any]], int]:
    alerts = []
    raw_overlaps = 0
    for row in rows:
        matches = _rule_matches(row, enabled_ids)
        if len(matches) > 1:
            raw_overlaps += 1
        if matches:
            alerts.append(_alert(row, matches[0], matches))
    alerts.sort(key=lambda item: item["timestamp"], reverse=True)
    return alerts, raw_overlaps


def _date_window(rows: tuple[dict[str, Any], ...], days: int) -> tuple[list[dict[str, Any]], datetime, datetime]:
    latest = rows[-1]["timestamp_dt"]
    start = latest - timedelta(days=days - 1)
    return [row for row in rows if start <= row["timestamp_dt"] <= latest], start, latest


def _enabled_rules(value: str | None) -> set[str] | None:
    if value is None:
        return None
    enabled = {item.strip() for item in value.split(",") if item.strip()}
    allowed = {rule["id"] for rule in RULES}
    unknown = enabled - allowed
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown rule ids: {', '.join(sorted(unknown))}")
    return enabled


def _daily_totals(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[date, dict[str, Any]] = defaultdict(lambda: {
        "kwh": 0.0, "cost_usd": 0.0, "readings": 0, "occupied": 0.0,
        "humidity": 0.0, "outdoor_temp_c": 0.0, "indoor_temp_c": 0.0,
        "heat_set_c": 0.0, "cool_set_c": 0.0, "price": 0.0,
        "appliance_kwh": {key: 0.0 for key, _, _ in APPLIANCES},
        "hvac_modes": Counter(), "tariff_periods": Counter(),
    })
    for row in rows:
        day = row["timestamp_dt"].date()
        summary = grouped[day]
        summary["kwh"] += row["total_usage_kwh"]
        summary["cost_usd"] += row["cost_usd"]
        summary["readings"] += 1
        for target, field in (
            ("occupied", "occupied"), ("humidity", "humidity"),
            ("outdoor_temp_c", "outdoor_temp_c"), ("indoor_temp_c", "indoor_temp_c"),
            ("heat_set_c", "heat_set_c"), ("cool_set_c", "cool_set_c"),
            ("price", "price_tou_usd_per_kwh"),
        ):
            summary[target] += row[field]
        for key, _, field in APPLIANCES:
            summary["appliance_kwh"][key] += row[field]
        summary["hvac_modes"][str(row["hvac_mode"]).strip().lower()] += 1
        summary["tariff_periods"][str(row["tariff_period"]).strip()] += 1
    return [
        {
            "date": day.isoformat(),
            "kwh": round(values["kwh"], 3),
            "cost_usd": round(values["cost_usd"], 3),
            "readings": int(values["readings"]),
            "occupied_percent": round(values["occupied"] / values["readings"] * 100, 1),
            "humidity_percent": round(values["humidity"] / values["readings"], 1),
            "outdoor_temp_c": round(values["outdoor_temp_c"] / values["readings"], 1),
            "indoor_temp_c": round(values["indoor_temp_c"] / values["readings"], 1),
            "heat_set_c": round(values["heat_set_c"] / values["readings"], 1),
            "cool_set_c": round(values["cool_set_c"] / values["readings"], 1),
            "average_rate_usd_per_kwh": round(values["price"] / values["readings"], 4),
            "hvac_mode": values["hvac_modes"].most_common(1)[0][0],
            "tariff_period": values["tariff_periods"].most_common(1)[0][0],
            "appliance_kwh": {key: round(amount, 3) for key, amount in values["appliance_kwh"].items()},
        }
        for day, values in sorted(grouped.items())
    ]


def _mix(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    totals = [(key, label, sum(row[field] for row in rows)) for key, label, field in APPLIANCES]
    denominator = sum(value for _, _, value in totals)
    return [
        {"id": key, "name": label, "kwh": round(value, 3), "percent": round(value / denominator * 100, 1) if denominator else 0}
        for key, label, value in totals
    ]


def _diagnostics(rows: tuple[dict[str, Any], ...], dataset: str) -> dict[str, Any]:
    timestamps = [row["timestamp_dt"].isoformat() for row in rows]
    return {
        "rows": len(rows),
        "duplicate_timestamps": len(timestamps) - len(set(timestamps)),
        "start": rows[0]["timestamp_dt"].isoformat() if rows else None,
        "end": rows[-1]["timestamp_dt"].isoformat() if rows else None,
        "date_mismatches": sum(row["date_timestamp_mismatch"] for row in rows),
        "hour_mismatches": sum(row["hour_timestamp_mismatch"] for row in rows),
        "usage_component_mismatches": sum(
            abs(row["total_usage_kwh"] - sum(row[field] for _, _, field in APPLIANCES)) > 0.0001 for row in rows
        ),
        "cost_arithmetic_mismatches": sum(
            abs(row["cost_usd"] - row["total_usage_kwh"] * row["price_tou_usd_per_kwh"]) > 0.0001 for row in rows
        ),
        "timestamp_is_canonical": True,
        "source_file": DATASETS[dataset].name,
    }


def _api_error(message: str) -> HTTPException:
    return HTTPException(status_code=500, detail=message)


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        return {
            "status": "ok",
            "service": "Energy Advisor API",
            "storage": "CSV files; no database",
            "datasets": {name: _diagnostics(load_rows(name), name) for name in DATASETS},
        }
    except ValueError as exc:
        raise _api_error(str(exc)) from exc


@app.get("/api/overview")
def overview(days: int = Query(default=30, ge=1, le=365), enabled_rules: str | None = None) -> dict[str, Any]:
    try:
        all_rows = load_rows("training")
        rows, start, end = _date_window(all_rows, days)
        if not rows:
            raise HTTPException(status_code=404, detail="No training readings found for this period.")
        previous_start = start - timedelta(days=days)
        previous_rows = [row for row in all_rows if previous_start <= row["timestamp_dt"] < start]
        daily = _daily_totals(rows)
        previous_daily = _daily_totals(previous_rows)
        energy = sum(row["total_usage_kwh"] for row in rows)
        cost = sum(row["cost_usd"] for row in rows)
        prior_energy = sum(row["total_usage_kwh"] for row in previous_rows)
        peak = max(rows, key=lambda row: row["total_usage_kwh"])
        alerts, raw_overlaps = _resolve_alerts(rows, _enabled_rules(enabled_rules))
        current_alert = alerts[0] if alerts else None
        return {
            "sample": True,
            "dataset": "training",
            "period_days": days,
            "period": {"start": start.date().isoformat(), "end": end.date().isoformat(), "days_with_readings": len(daily)},
            "metrics": {
                "total_kwh": round(energy, 3),
                "average_daily_kwh": round(energy / len(daily), 3) if daily else 0,
                "estimated_cost_usd": round(cost, 2),
                "cost_per_day_usd": round(cost / len(daily), 2) if daily else 0,
                "peak_hour_kwh": round(peak["total_usage_kwh"], 3),
                "peak_hour_timestamp": peak["timestamp_dt"].isoformat(),
                "change_percent": round((energy - prior_energy) / prior_energy * 100, 1) if prior_energy else None,
                "change_period_available": bool(previous_rows),
                "triggered_alerts": len(alerts),
                "raw_rule_overlaps": raw_overlaps,
            },
            "latest_reading": {
                "timestamp": all_rows[-1]["timestamp_dt"].isoformat(),
                "total_kwh": round(all_rows[-1]["total_usage_kwh"], 3),
                "cost_usd": round(all_rows[-1]["cost_usd"], 4),
                "tariff_period": all_rows[-1]["tariff_period"],
                "rate_usd_per_kwh": round(all_rows[-1]["price_tou_usd_per_kwh"], 4),
                "outdoor_temp_c": round(all_rows[-1]["outdoor_temp_c"], 1),
                "indoor_temp_c": round(all_rows[-1]["indoor_temp_c"], 1),
            },
            "latest_alert": current_alert,
            "daily_usage": daily,
            "previous_daily_usage": previous_daily,
            "appliance_mix": _mix(rows),
            "disclaimer": "Historical training data; results are examples, not live home monitoring or guaranteed savings.",
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise _api_error(str(exc)) from exc


@app.get("/api/alerts")
def alerts(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    enabled_rules: str | None = None,
) -> dict[str, Any]:
    try:
        rows, start, end = _date_window(load_rows("training"), days)
        found, overlaps = _resolve_alerts(rows, _enabled_rules(enabled_rules))
        return {
            "sample": True,
            "period": {"start": start.date().isoformat(), "end": end.date().isoformat(), "days": days},
            "total": len(found),
            "raw_rule_overlaps": overlaps,
            "conflict_policy": "When more than one example condition matches a reading, return the highest-priority alert only.",
            "alerts": found[offset : offset + limit],
        }
    except ValueError as exc:
        raise _api_error(str(exc)) from exc


@app.get("/api/rules")
def rules() -> dict[str, Any]:
    try:
        rows = load_rows("training")
        counts: Counter[str] = Counter()
        raw_overlaps = 0
        for row in rows:
            matches = _rule_matches(row)
            counts.update(rule["id"] for rule in matches)
            raw_overlaps += len(matches) > 1
        return {
            "sample": True,
            "conflict_policy": "Priority order prevents more than one alert per reading; raw overlaps are still reported for review.",
            "raw_overlaps_in_training": raw_overlaps,
            "rules": [{**rule, "training_matches": counts[rule["id"]]} for rule in RULES],
        }
    except ValueError as exc:
        raise _api_error(str(exc)) from exc


@app.get("/api/evaluation")
def evaluation() -> dict[str, Any]:
    try:
        train = load_rows("training")
        test = load_rows("test")
        train_counts: Counter[str] = Counter()
        test_counts: Counter[str] = Counter()
        train_overlaps = test_overlaps = 0
        for dataset_rows, counts in ((train, train_counts), (test, test_counts)):
            for row in dataset_rows:
                matches = _rule_matches(row)
                counts.update(rule["id"] for rule in matches)
                if len(matches) > 1:
                    if counts is train_counts:
                        train_overlaps += 1
                    else:
                        test_overlaps += 1
        train_stamps = {row["timestamp_dt"] for row in train}
        shared = sorted({row["timestamp_dt"].isoformat() for row in test if row["timestamp_dt"] in train_stamps})
        return {
            "sample": True,
            "rules_are_reference_examples": True,
            "priority_order": [rule["id"] for rule in RULES],
            "training": {"rows": len(train), "raw_matches_by_rule": dict(train_counts), "raw_overlap_rows": train_overlaps},
            "test": {"rows": len(test), "raw_matches_by_rule": dict(test_counts), "raw_overlap_rows": test_overlaps},
            "shared_timestamps": shared,
            "shared_timestamp_count": len(shared),
            "test_date_mismatches": sum(row["date_timestamp_mismatch"] for row in test),
            "test_hour_mismatches": sum(row["hour_timestamp_mismatch"] for row in test),
            "interpretation": "Test rows are sparse and share timestamps with training. Counts are a rule audit, not an unbiased holdout score. The rules remain reference examples and are not optimized from test data.",
        }
    except ValueError as exc:
        raise _api_error(str(exc)) from exc


@app.get("/api/docs/summary")
def api_summary() -> dict[str, str]:
    return {"openapi": "/api/docs", "health": "/api/health", "overview": "/api/overview", "alerts": "/api/alerts", "rules": "/api/rules", "evaluation": "/api/evaluation"}


app.mount("/Example", StaticFiles(directory=ROOT / "Example"), name="example-assets")
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
