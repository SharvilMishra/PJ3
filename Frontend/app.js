const pages = [...document.querySelectorAll("[data-page]")];
const routeLinks = [...document.querySelectorAll("[data-route]")];
const currentSection = document.querySelector("#current-section");
const startupLoader = document.querySelector("#startup-loader");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const statusText = document.querySelector("#backend-status-text");
let selectedDays = 30;
let alertOffset = 0;
let alertTotal = 0;
let requestSequence = 0;
let startupFinished = false;
let hasLoadedData = false;
let startupFallback;

function animatePage(page) {
  if (reducedMotion || !page) return;
  pages.forEach((item) => item.classList.remove("is-entering"));
  void page.offsetWidth;
  page.classList.add("is-entering");
  window.setTimeout(() => page.classList.remove("is-entering"), 1500);
}

function navigate(animate = true) {
  const route = window.location.hash.slice(1) || "overview";
  const pageName = pages.some((item) => item.dataset.page === route) ? route : "overview";
  pages.forEach((item) => { item.hidden = item.dataset.page !== pageName; });
  routeLinks.forEach((link) => {
    const active = link.dataset.route === pageName;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  currentSection.textContent = pageName === "rules" ? "Smart rules" : pageName[0].toUpperCase() + pageName.slice(1);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (animate) animatePage(pages.find((item) => item.dataset.page === pageName));
}

window.addEventListener("hashchange", () => navigate());
navigate(false);

function enabledRuleIds() {
  return [...document.querySelectorAll(".rule-setting .toggle[aria-checked='true']")]
    .map((toggle) => toggle.closest(".rule-setting").dataset.rule);
}

function requestUrl(path, includeRules = true) {
  const query = new URLSearchParams({ days: String(selectedDays) });
  if (includeRules) query.set("enabled_rules", enabledRuleIds().join(","));
  return `${path}?${query.toString()}`;
}

async function getJson(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

function setStatus(connected, message = "") {
  statusText.textContent = connected ? "HISTORICAL SAMPLE · API CONNECTED" : "SAMPLE PREVIEW · API OFFLINE";
  document.querySelector("#backend-status").classList.toggle("is-offline", !connected);
  const note = document.querySelector(".overview-aside .data-note p");
  if (note && message) {
    if (!note.dataset.original) note.dataset.original = note.innerHTML;
    note.innerHTML = `<strong>Backend unavailable</strong><br>${escapeText(message)}`;
  } else if (note?.dataset.original) {
    note.innerHTML = note.dataset.original;
    delete note.dataset.original;
  }
  if (!connected && !hasLoadedData) {
    const chart = document.querySelector(".usage-chart");
    chart.querySelectorAll(".chart-line, .chart-area").forEach((path) => path.setAttribute("d", ""));
    chart.querySelector(".chart-point").style.display = "none";
    document.querySelector("#daily-bars").replaceChildren();
  }
  if (message && document.querySelector("#alert-count").textContent === "Loading sample alerts") {
    document.querySelector("#alert-count").textContent = "Alerts unavailable";
    document.querySelector("#alert-period-label").textContent = "Start the local backend to load history.";
    const feed = document.querySelector("#alert-feed");
    feed.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "older-placeholder";
    empty.textContent = "Alert history needs the local backend. See Backend/README.md to start it.";
    feed.append(empty);
  }
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatNumber(value, digits = 1) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
}

function formatTimestamp(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function setMetric(key, value, unit = "") {
  document.querySelectorAll(`[data-bind="${key}"]`).forEach((element) => {
    if (unit) {
      const small = document.createElement("small");
      small.textContent = unit;
      element.replaceChildren(document.createTextNode(value), document.createTextNode(" "), small);
    } else {
      element.textContent = value;
    }
  });
}

function syncPeriodControls() {
  document.querySelectorAll("[data-period]").forEach((select) => { select.value = String(selectedDays); });
  document.querySelectorAll(".segmented").forEach((group) => {
    group.querySelectorAll("button").forEach((button) => {
      const active = (button.textContent.trim() === "Week" && selectedDays === 7)
        || (button.textContent.trim() === "Month" && selectedDays === 30);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
}

function renderOverview(data) {
  const { metrics, period, daily_usage: daily, previous_daily_usage: previous } = data;
  setMetric("average-daily", formatNumber(metrics.average_daily_kwh, 2), "kWh");
  setMetric("change", metrics.change_percent === null ? "No prior period" : `${metrics.change_percent > 0 ? "↑" : "↓"} ${formatNumber(Math.abs(metrics.change_percent), 1)}%`);
  document.querySelectorAll('[data-bind="change"]').forEach((element) => {
    element.classList.toggle("negative", metrics.change_percent !== null && metrics.change_percent > 0);
    element.classList.toggle("positive", metrics.change_percent === null || metrics.change_percent <= 0);
  });
  setMetric("period-cost", formatCurrency(metrics.estimated_cost_usd));
  setMetric("period-total", `${formatNumber(metrics.total_kwh, 1)} kWh total`);
  setMetric("period-days", `${period.days_with_readings} days with readings`);
  setMetric("peak-kwh", formatNumber(metrics.peak_hour_kwh, 2), "kWh");
  setMetric("peak-time", formatTimestamp(metrics.peak_hour_timestamp, { weekday: "short", month: "short", day: "numeric", hour: "numeric" }));

  const lowest = daily.reduce((result, item) => !result || item.kwh < result.kwh ? item : result, null);
  setMetric("lowest-day", lowest ? formatNumber(lowest.kwh, 2) : "—", "kWh");
  setMetric("lowest-date", lowest ? formatTimestamp(`${lowest.date}T12:00:00`, { weekday: "long", month: "short", day: "numeric" }) : "—");
  renderLineChart(daily, previous);
  renderBars(daily, previous);
  renderApplianceMix(data.appliance_mix);
  renderLatestAlert(data.latest_alert);
}

function weekdayAverages(daily) {
  const totals = Array.from({ length: 7 }, () => ({ kwh: 0, days: 0 }));
  daily.forEach((item) => {
    const weekday = new Date(`${item.date}T12:00:00Z`).getUTCDay();
    totals[weekday].kwh += item.kwh;
    totals[weekday].days += 1;
  });
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    kwh: totals[weekday].days ? totals[weekday].kwh / totals[weekday].days : 0,
  }));
}

function renderLineChart(daily, previous) {
  const svg = document.querySelector(".usage-chart");
  const current = weekdayAverages(daily);
  const past = weekdayAverages(previous);
  const max = Math.max(1, ...current.map((item) => item.kwh), ...past.map((item) => item.kwh));
  const pointsFor = (items) => items.map((item, index) => ({
    x: items.length < 2 ? 350 : (index / (items.length - 1)) * 700,
    y: 195 - (item.kwh / max) * 180,
  }));
  const pathFor = (points) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const currentPoints = pointsFor(current);
  const previousPoints = pointsFor(past);
  const currentPath = pathFor(currentPoints);
  svg.querySelector(".current-line").setAttribute("d", currentPath);
  svg.querySelector(".previous-line").setAttribute("d", pathFor(previousPoints));
  svg.querySelector(".chart-area").setAttribute("d", currentPoints.length ? `${currentPath} L${currentPoints.at(-1).x} 195 L${currentPoints[0].x} 195 Z` : "");
  const point = svg.querySelector(".chart-point");
  if (currentPoints.length) {
    point.setAttribute("cx", currentPoints.at(-1).x);
    point.setAttribute("cy", currentPoints.at(-1).y);
    point.style.display = "";
  } else point.style.display = "none";

  svg.querySelectorAll(".chart-line").forEach((line) => {
    try {
      const length = line.getTotalLength();
      line.style.strokeDasharray = `${length}px`;
      line.style.strokeDashoffset = `${length}px`;
    } catch { /* The static chart still works when SVG measurement is unavailable. */ }
  });
  document.querySelectorAll("[data-axis]").forEach((label) => {
    const fraction = Number(label.dataset.axis) / 3;
    label.textContent = formatNumber(max * fraction, 0);
  });
  const labels = document.querySelector("[data-chart-labels]");
  labels.replaceChildren(...current.map((item) => {
    const day = document.createElement("span");
    day.textContent = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][item.weekday];
    return day;
  }));
}

function renderBars(daily, previous) {
  const container = document.querySelector("#daily-bars");
  const items = weekdayAverages(daily);
  const prior = weekdayAverages(previous);
  const max = Math.max(1, ...items.map((item) => item.kwh), ...prior.map((item) => item.kwh));
  container.replaceChildren(...items.map((item, index) => {
    const group = document.createElement("div");
    group.className = "bar-group";
    const pair = document.createElement("div");
    pair.className = "bar-pair";
    const currentBar = document.createElement("i");
    currentBar.style.height = `${Math.max(2, item.kwh / max * 100)}%`;
    const previousBar = document.createElement("i");
    previousBar.style.height = `${Math.max(2, (prior[index]?.kwh || 0) / max * 100)}%`;
    pair.append(currentBar, previousBar);
    const label = document.createElement("span");
    label.textContent = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][item.weekday];
    group.append(pair, label);
    return group;
  }));
}

const mixDots = ["dot-blue", "dot-purple", "dot-cyan", "dot-muted"];
function renderApplianceMix(mix) {
  document.querySelectorAll(".appliance-row[data-appliance]").forEach((row) => {
    const item = mix.find((entry) => entry.id === row.dataset.appliance);
    if (!item) return;
    row.querySelector(".appliance-value").textContent = `${formatNumber(item.percent, 1)}%`;
    row.querySelector(".appliance-track i").style.width = `${item.percent}%`;
  });
  const allKwh = mix.reduce((sum, item) => sum + item.kwh, 0);
  setMetric("mix-total", formatNumber(allKwh, 1), "kWh");
  const list = document.querySelector("#mix-list");
  list.replaceChildren(...mix.map((item, index) => {
    const row = document.createElement("div");
    const dot = document.createElement("i");
    dot.className = mixDots[index % mixDots.length];
    const name = document.createElement("span");
    name.textContent = item.name;
    const percent = document.createElement("strong");
    percent.textContent = `${formatNumber(item.percent, 1)}%`;
    row.append(dot, name, percent);
    return row;
  }));
  document.querySelectorAll("#mix-bar i").forEach((bar, index) => {
    bar.style.flexGrow = String(mix[index]?.percent || 0);
  });
}

function renderLatestAlert(alert) {
  if (!alert) {
    setMetric("tip-title", "No matching alert in this period.");
    setMetric("tip-copy", "Try another period or enable a sample rule to see its suggestions.");
    return;
  }
  setMetric("tip-title", alert.rule_name);
  setMetric("tip-copy", alert.tip);
  renderRecentAlerts([alert]);
}

function renderRecentAlerts(alerts) {
  const container = document.querySelector("#preview-alerts");
  const icons = ["◷", "☾", "⌁"];
  container.replaceChildren(...alerts.slice(0, 3).map((alert, index) => {
    const row = document.createElement("div");
    row.className = "preview-alert";
    const icon = document.createElement("span");
    icon.className = `alert-icon ${index === 1 ? "blue-icon" : index === 2 ? "cyan-icon" : "violet-icon"}`;
    icon.textContent = icons[index % icons.length];
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = alert.rule_name;
    const date = document.createElement("small");
    date.textContent = formatTimestamp(alert.timestamp, { month: "short", day: "numeric", hour: "numeric" });
    copy.append(title, date);
    row.append(icon, copy);
    return row;
  }));
  if (!alerts.length) {
    const empty = document.createElement("div");
    empty.className = "preview-alert";
    empty.textContent = "No matching alerts in this period.";
    container.append(empty);
  }
}

function createAlertCard(alert, index) {
  const icons = ["◷", "☾", "⌁"];
  const colors = ["violet-icon", "blue-icon", "cyan-icon"];
  const card = document.createElement("article");
  card.className = "panel feed-card";
  const icon = document.createElement("span");
  icon.className = `feed-icon ${colors[index % colors.length]}`;
  icon.textContent = icons[index % icons.length];

  const content = document.createElement("div");
  content.className = "feed-content";
  const meta = document.createElement("div");
  meta.className = "feed-meta";
  const category = document.createElement("span");
  category.textContent = alert.rule_name.toUpperCase();
  const time = document.createElement("time");
  time.dateTime = alert.timestamp;
  time.textContent = formatTimestamp(alert.timestamp, { month: "short", day: "numeric", year: "numeric", hour: "numeric" });
  meta.append(category, time);

  const title = document.createElement("h2");
  title.textContent = alert.rule_name === "Peak appliance shift" ? "A flexible dishwasher cycle can wait for off-peak." : alert.rule_name;
  const description = document.createElement("p");
  description.textContent = alert.tip;
  const data = document.createElement("div");
  data.className = "feed-data";
  const reading = document.createElement("span");
  reading.textContent = `${formatNumber(alert.total_usage_kwh, 2)} kWh total load`;
  const rate = document.createElement("span");
  rate.textContent = `${alert.tariff_period} · ${formatCurrency(alert.rate_usd_per_kwh)}/kWh`;
  data.append(reading, rate);

  const expand = document.createElement("button");
  expand.className = "feed-expand";
  expand.type = "button";
  expand.setAttribute("aria-expanded", "false");
  expand.append(document.createTextNode("Why am I seeing this? "));
  const arrow = document.createElement("span");
  arrow.textContent = "⌄";
  expand.append(arrow);
  const detail = document.createElement("p");
  detail.className = "feed-detail";
  detail.hidden = true;
  detail.textContent = `Reference rule: ${alert.rule_id.replaceAll("_", " ")}. ${alert.suppressed_rule_ids.length ? `Priority kept this alert and suppressed ${alert.suppressed_rule_ids.length} overlapping condition(s).` : "This reading matched this reference condition."} Recorded outdoor temperature: ${formatNumber(alert.outdoor_temp_c, 1)}°C; indoor temperature: ${formatNumber(alert.indoor_temp_c, 1)}°C.`;
  content.append(meta, title, description, data, expand, detail);
  card.append(icon, content);
  return card;
}

function renderAlerts(payload, append = false) {
  const feed = document.querySelector("#alert-feed");
  if (!append) feed.replaceChildren();
  if (!append) {
    const heading = document.createElement("p");
    heading.className = "feed-date";
    heading.textContent = "RECENT SAMPLE SUGGESTIONS";
    feed.append(heading);
  }
  const list = document.createElement("div");
  list.className = "api-alert-list";
  payload.alerts.forEach((alert, index) => list.append(createAlertCard(alert, alertOffset + index)));
  feed.append(list);
  alertOffset += payload.alerts.length;
  alertTotal = payload.total;
  const countBadge = document.querySelector("#nav-alert-count");
  countBadge.textContent = payload.total > 99 ? "99+" : String(payload.total);
  countBadge.hidden = payload.total === 0;
  document.querySelector("#alert-count").textContent = `${payload.total} calculated sample suggestion${payload.total === 1 ? "" : "s"}`;
  document.querySelector("#alert-period-label").textContent = `${payload.period.start} to ${payload.period.end}`;
  const old = document.querySelector("#load-more-alerts");
  if (old) old.remove();
  if (alertOffset < alertTotal) {
    const more = document.createElement("button");
    more.className = "load-more-button";
    more.id = "load-more-alerts";
    more.type = "button";
    more.textContent = `Load older alerts (${alertOffset} of ${alertTotal})`;
    feed.append(more);
  } else if (!payload.total) {
    const empty = document.createElement("div");
    empty.className = "older-placeholder";
    empty.textContent = "No enabled reference rules matched readings in this period.";
    feed.append(empty);
  }
}

async function loadMoreAlerts() {
  const requestedDays = selectedDays;
  const requestedRules = enabledRuleIds().sort().join(",");
  try {
    const params = new URLSearchParams({ days: String(requestedDays), limit: "50", offset: String(alertOffset), enabled_rules: requestedRules });
    const payload = await getJson(`/api/alerts?${params}`);
    if (requestedDays !== selectedDays || requestedRules !== enabledRuleIds().sort().join(",")) return;
    renderAlerts(payload, true);
  } catch (error) {
    setStatus(false, error.message);
  }
}

function renderRules(data, evaluation) {
  data.rules.forEach((rule) => {
    const count = document.querySelector(`[data-rule="${rule.id}"] [data-rule-count]`);
    if (count) count.textContent = `${rule.training_matches.toLocaleString()} training matches`;
  });
  const summary = document.querySelector("#evaluation-summary");
  summary.textContent = `Reference-rule audit: ${evaluation.training.rows.toLocaleString()} training rows and ${evaluation.test.rows.toLocaleString()} test rows. Raw overlapping readings: ${evaluation.training.raw_overlap_rows} training, ${evaluation.test.raw_overlap_rows} test. ${evaluation.shared_timestamp_count} test timestamps also occur in training. Test counts are diagnostic, not an unbiased holdout score. Rule switches are temporary for this browser session.`;
}

async function refreshPeriod({ initial = false } = {}) {
  const sequence = ++requestSequence;
  const status = document.querySelector("#backend-status");
  status.classList.add("is-refreshing");
  try {
    const [overview, alertPayload] = await Promise.all([
      getJson(requestUrl("/api/overview")),
      getJson(`${requestUrl("/api/alerts")}&limit=50&offset=0`),
    ]);
    if (sequence !== requestSequence) return;
    renderOverview(overview);
    alertOffset = 0;
    renderAlerts(alertPayload);
    renderRecentAlerts(alertPayload.alerts);
    hasLoadedData = true;
    setStatus(true);
  } catch (error) {
    if (sequence === requestSequence) setStatus(false, error.message);
  } finally {
    if (sequence === requestSequence) {
      status.classList.remove("is-refreshing");
      if (!initial) animatePage(pages.find((item) => !item.hidden));
      if (initial || !startupFinished) finishStartup();
    }
  }
}

async function loadReferenceData() {
  try {
    const [rules, evaluation] = await Promise.all([getJson("/api/rules"), getJson("/api/evaluation")]);
    renderRules(rules, evaluation);
  } catch (error) {
    setStatus(false, error.message);
  }
}

function finishStartup() {
  if (startupFinished) return;
  startupFinished = true;
  window.clearTimeout(startupFallback);
  animatePage(pages.find((item) => !item.hidden));
  startupLoader.classList.add("is-done");
  startupLoader.setAttribute("aria-hidden", "true");
  window.setTimeout(() => startupLoader.remove(), 500);
}

document.querySelectorAll("[data-period]").forEach((select) => {
  select.addEventListener("change", () => {
    selectedDays = Number(select.value);
    syncPeriodControls();
    refreshPeriod();
  });
});

document.querySelectorAll(".segmented").forEach((group) => {
  group.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDays = button.textContent.trim() === "Week" ? 7 : 30;
      syncPeriodControls();
      refreshPeriod();
    });
  });
});

document.querySelector("#rules-page").addEventListener("click", (event) => {
  const toggle = event.target.closest(".toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-checked", toggle.getAttribute("aria-checked") !== "true");
  refreshPeriod();
});

document.querySelector("#open-alerts").addEventListener("click", () => { window.location.hash = "#alerts"; });

document.querySelector("#alert-feed").addEventListener("click", (event) => {
  const more = event.target.closest("#load-more-alerts");
  if (more) return loadMoreAlerts();
  const button = event.target.closest(".feed-expand");
  if (!button) return;
  const detail = button.nextElementSibling;
  const expanded = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(expanded));
  detail.hidden = !expanded;
  button.lastElementChild.textContent = expanded ? "⌃" : "⌄";
});

document.querySelector("#mark-read").addEventListener("click", () => {
  document.querySelectorAll(".feed-unread, .alert-summary-row .unread-dot").forEach((dot) => dot.remove());
  document.querySelector("#mark-read").textContent = "All caught up";
});

startupFallback = window.setTimeout(finishStartup, 5000);
syncPeriodControls();
loadReferenceData();
refreshPeriod({ initial: true });
