# Gemini Canvas project prompt

## Attach these files in Gemini Canvas

- `Datasets/sic_IoT_dataset_PJ3.csv` — training/practice data (5,832 hourly rows, January–August 2025)
- `Datasets/sic_IoT_test_PJ3.csv` — 30 rows designated as test data
- `Datasets/Energy Saving_Example.html` — official UI and behavior reference

## Prompt

You are helping build **Energy-Saving Assistant**, a prototype for a smart-home company whose customers underuse available energy-saving automations. The goal is to make energy-saving rules understandable and useful through timely alerts.

Build a polished, responsive alert application prototype in Gemini Canvas. Use the attached `Energy Saving_Example.html` as the reference for the alert experience, but improve its readability, accessibility, layout, and responsiveness. Do not copy its example rules as mandatory rules: derive three suitable IF–THEN rules from patterns in the training CSV. Their trigger conditions must be distinct so one reading produces at most one alert. Clearly state each rule's inputs, thresholds, and reasoning.

### Data analysis and evaluation

1. Explore the 5,832 training rows to identify useful, explainable energy-saving patterns.
2. Define exactly three deterministic IF–THEN rules using training data only. Do not tune thresholds by looking at the test results.
3. Check each rule against the 30 test rows and summarize its trigger count and whether any rows match more than one rule. If rules overlap, refine them using training data and recheck.
4. Be transparent about data quality: four test rows have `date` or `hour` values inconsistent with `timestamp`, and three test timestamps also occur in training. Use `timestamp` as the canonical time field, flag these issues, and avoid claiming the set is perfectly unseen.
5. Do not claim savings that the fields cannot support. Label any estimate and its assumptions. Do not present the sample history as a live connection.

### Application experience

- Put the **latest alert at the top** of the main view.
- Give each of the three rules a consistent, distinct color and icon. Do not rely on color alone.
- Each alert should show its timestamp, relevant readings, tariff period where relevant, and a short message explaining why its rule triggered.
- Separate rule logic from tip writing: the deterministic rule decides **when** to alert; Gemini writes a concise, friendly, practical energy-saving tip. Gemini must not decide whether a rule triggered.
- Present the friendly tip in a visually distinct, italicized area, as in the example.
- Place older alerts in an **Archived Alerts** section that is collapsed by default and can be expanded.
- Include a rule-management/settings view with a clear on/off control for each rule. Explain that these controls affect app alerts and do not operate appliances or HVAC equipment.
- Make historical/test data status clear. Avoid labels such as “Live Monitoring.”

### Visual and interaction guidance

- Use a dark visual theme built around neon blue and neon purple accents on charcoal gray and near-black surfaces. Keep the composition comfortable for extended use: use charcoal for most panels, near-black for the page background, and reserve neon colors for selected navigation, rule identity, key data, and focused actions. Avoid large areas of saturated neon, harsh glow, or bright text on pure black.
- Keep body text soft light gray or off-white, with clear contrast and restrained accent brightness. Use distinct, consistent blue/purple treatments for the three rule identities, supported by labels and icons so color is never the only signal.
- Create a professional, approachable smart-home energy interface with responsive desktop and phone layouts.
- Use clear hierarchy, readable typography, accessible contrast, keyboard-visible focus, semantic labels, and touch-friendly controls. Ensure neon accents remain legible without causing visual fatigue.
- Keep rule colors and icons consistent across the latest alert, archived items, and settings.
- Include useful empty, loading, and filtered-no-results states.
- Keep the interface focused on alerts and rules. Do not add authentication, billing, database administration, or device-control flows.

### Deliverables

Provide the working Canvas prototype, a concise explanation of the three rules and their test results, and any UI assets or source exports needed for implementation. Save/export the files under `Example/ui/assets/`. Keep the rules and data access organized so the prototype can later connect to the project's Python/FastAPI backend. The initial project does not use SQL storage.
