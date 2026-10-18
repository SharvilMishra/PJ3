# Dataset notes

## Files

| File | Records | Notes |
| --- | ---: | --- |
| `Datasets/sic_IoT_dataset_PJ3.csv` | 5,832 | Hourly observations from 2025-01-01 00:00 through 2025-08-31 23:00 (243 calendar days); training/practice data. One home ID. |
| `Datasets/sic_IoT_test_PJ3.csv` | 30 | Sparse rows designated as test data by the briefing; includes separate `date` and `hour` columns. One home ID. |
| `Datasets/Energy Saving_Example.html` | — | Supplied UI/behavior example with three rule descriptions and hardcoded sample alerts. |

## Common fields

The files include home and time identifiers, occupancy, humidity, outdoor and indoor temperature, HVAC mode and set points, HVAC/appliance energy in kWh, total usage in kWh, time-of-use price, tariff period, and cost in USD.

## Handling guidance

- Keep the originals unchanged in `Datasets/`.
- Parse timestamps explicitly; do not rely on locale-dependent date parsing.
- Use `timestamp` as the canonical time field unless the dataset owner says otherwise. Four test rows have `date` or `hour` values inconsistent with `timestamp`.
- Three test timestamps also occur in training, so the test file is not fully disjoint by timestamp. Preserve the source files; document how these rows are handled before reporting a holdout score.
- Check missing values, duplicate timestamps, units, and arithmetic consistency (`total_usage_kwh` and `cost_usd`) before using the data for savings estimates.
- Define rules using the training file only; use the 30 test rows for evaluation rather than threshold tuning.

## Rules shown in the supplied HTML example

1. **Appliance Peak Shift:** suggest moving dishwasher use out of a Peak tariff period.
2. **Night Heating Reduction:** between midnight and 05:00, suggest reducing the heating setpoint if outdoor temperature is above 10°C.
3. **Mild-Weather Free Cooling:** while HVAC is cooling, suggest using outdoor air when outdoor temperature is no higher than indoor temperature.

These are example rules, not required final rules and not fields directly stored in the CSV. Applying their stated conditions (dishwasher usage > 0 and Peak tariff; heating from 00:00–04:59 with outdoor temperature > 10°C; cooling with outdoor temperature <= indoor temperature) gives:

| Dataset | Peak dishwasher | Night heating | Mild-weather cooling | Rows with multiple triggers |
| --- | ---: | ---: | ---: | ---: |
| Training | 97 | 35 | 67 | 4 |
| Test | 5 | 1 | 2 | 0 |

All four training overlaps are between Peak dishwasher and mild-weather cooling. If reusing these example rules, refine them or define an explicit conflict policy so one reading cannot create overlapping alerts. The HTML's alerts are hardcoded examples, and its “Live Monitoring” footer does not establish a live device connection.
