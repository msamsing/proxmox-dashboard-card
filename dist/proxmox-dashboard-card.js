const PROXMOX_DASHBOARD_CARD_VERSION = "0.2.1";
const PROXMOX_DASHBOARD_CARD_TYPE = "proxmox-dashboard-card";
const DEFAULT_ALERT_DELAY_SECONDS = 300;
const STATISTICS_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATISTICS_MAX_SAMPLES = 720;

const DEFAULT_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 75, critical: 90 },
  disk: { warning: 75, critical: 90 },
  storage: { warning: 75, critical: 90 },
  disk_temperature: { warning: 50, critical: 60 },
  wearout: { warning: 60, critical: 85 },
};

const LEVELS = {
  ok: 0,
  unknown: 1,
  warn: 2,
  critical: 3,
};

const ENTITY_FIELDS = [
  "status_entity",
  "cpu_entity",
  "memory_used_percentage_entity",
  "memory_free_entity",
  "memory_used_entity",
  "disk_used_percentage_entity",
  "containers_running_entity",
  "virtual_machines_running_entity",
  "last_boot_entity",
  "updates_entity",
  "updates_packages_entity",
  "temperature_entity",
  "used_percentage_entity",
  "used_entity",
  "free_entity",
  "total_entity",
  "health_entity",
  "wearout_entity",
  "size_entity",
  "power_on_hours_entity",
  "power_cycles_entity",
  "node_entity",
  "uptime_entity",
];

const FIELD_LABELS = {
  status_entity: "Status",
  cpu_entity: "CPU used",
  memory_used_percentage_entity: "Memory used percentage",
  memory_free_entity: "Memory free",
  memory_used_entity: "Memory used",
  disk_used_percentage_entity: "Disk used percentage",
  containers_running_entity: "Containers running",
  virtual_machines_running_entity: "Virtual machines running",
  last_boot_entity: "Last boot",
  updates_entity: "Total updates",
  updates_packages_entity: "Update package status",
  temperature_entity: "Temperature",
  used_percentage_entity: "Used percentage",
  used_entity: "Used",
  free_entity: "Free",
  total_entity: "Total",
  health_entity: "Health",
  wearout_entity: "Wearout",
  size_entity: "Size",
  power_on_hours_entity: "Power-on hours",
  power_cycles_entity: "Power cycles",
  node_entity: "Node",
  uptime_entity: "Uptime",
};

const DEFAULT_NODE = {
  name: "Node",
  status_entity: "",
  cpu_entity: "",
  memory_used_percentage_entity: "",
  disk_used_percentage_entity: "",
  containers_running_entity: "",
  virtual_machines_running_entity: "",
  storages: [],
  disks: [],
  guests: [],
};

const DEFAULT_STORAGE = {
  name: "Storage",
  used_percentage_entity: "",
  status_entity: "",
};

const DEFAULT_DISK = {
  name: "Disk",
  health_entity: "",
  temperature_entity: "",
  wearout_entity: "",
  size_entity: "",
};

const DEFAULT_GUEST = {
  name: "Guest",
  type: "vm",
  status_entity: "",
  cpu_entity: "",
  memory_used_percentage_entity: "",
  disk_used_percentage_entity: "",
};

function deepMerge(base, override) {
  const output = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key]) {
      output[key] = deepMerge(base[key], value);
      return;
    }
    output[key] = value;
  });
  return output;
}

function normalizeConfig(config) {
  const alertDelay = Number(config.alert_delay_seconds);

  return {
    ...config,
    title: config.title || "Proxmox Cluster",
    show_details: config.show_details !== false,
    collapsible: config.collapsible !== false,
    show_statistics: config.show_statistics === true,
    statistics_collapsible: config.statistics_collapsible !== false,
    alert_delay_seconds: Number.isFinite(alertDelay) ? Math.max(0, alertDelay) : DEFAULT_ALERT_DELAY_SECONDS,
    thresholds: deepMerge(DEFAULT_THRESHOLDS, config.thresholds || {}),
    nodes: Array.isArray(config.nodes) ? config.nodes : [],
  };
}

function html(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

function parseNumber(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized || ["unknown", "unavailable", "none", "null"].includes(normalized.toLowerCase())) {
    return undefined;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function levelColor(level) {
  if (level === "critical") return "var(--pdc-critical)";
  if (level === "warn") return "var(--pdc-warn)";
  if (level === "info") return "var(--pdc-info)";
  if (level === "ok") return "var(--pdc-ok)";
  return "var(--pdc-unknown)";
}

function worstLevel(levels, fallback = "ok") {
  const knownLevels = (levels || []).filter(Boolean);
  if (!knownLevels.length) return fallback;

  const actionableLevels = knownLevels.filter((level) => level !== "unknown" && level !== "info" && LEVELS[level] !== undefined);
  if (!actionableLevels.length) return "unknown";

  return actionableLevels.reduce((worst, level) => {
    if (!level) return worst;
    return LEVELS[level] > LEVELS[worst] ? level : worst;
  }, actionableLevels[0]);
}

function levelForValue(value, thresholds) {
  if (!Number.isFinite(value)) return "unknown";
  if (value >= thresholds.critical) return "critical";
  if (value >= thresholds.warning) return "warn";
  return "ok";
}

function levelForStatus(rawState) {
  if (rawState === undefined || rawState === null || rawState === "") return "unknown";
  const state = String(rawState).trim().toLowerCase();

  if (
    ["ok", "online", "running", "healthy", "active", "on", "ready", "available", "true", "passed", "pass", "good", "enabled"].includes(
      state,
    )
  ) {
    return "ok";
  }

  if (["unknown", "unavailable", "none", "null", "not configured"].includes(state)) {
    return "unknown";
  }

  if (
    [
      "warn",
      "warning",
      "degraded",
      "maintenance",
      "pending",
      "standby",
      "update available",
      "updates available",
      "reboot required",
      "stopped",
      "paused",
    ].includes(state)
  ) {
    return "warn";
  }

  if (
    [
      "critical",
      "problem",
      "problems",
      "error",
      "failed",
      "failure",
      "failing",
      "offline",
      "down",
      "unhealthy",
      "bad",
      "smart failed",
      "smart failure",
      "not ok",
      "false",
      "lost",
    ].includes(state)
  ) {
    return "critical";
  }

  return "unknown";
}

function levelForUpdates(value) {
  if (!Number.isFinite(value)) return "unknown";
  return value > 0 ? "info" : "ok";
}

function levelForUpdateState(rawState) {
  if (rawState === undefined || rawState === null || rawState === "") return "unknown";
  const state = String(rawState).trim().toLowerCase();
  const numeric = parseNumber(state);

  if (Number.isFinite(numeric)) return numeric > 0 ? "info" : "ok";

  if (["unknown", "unavailable", "none", "null", "not configured"].includes(state)) return "unknown";

  if (
    [
      "ok",
      "up to date",
      "up-to-date",
      "no updates",
      "no update",
      "no updates available",
      "no update available",
      "false",
      "off",
      "clear",
      "idle",
    ].includes(state)
  ) {
    return "ok";
  }

  return "info";
}

function updateIndicatorLevel(levels) {
  const knownLevels = (levels || []).filter(Boolean);
  if (knownLevels.includes("info")) return "info";
  return worstLevel(knownLevels, "unknown");
}

function labelForLevel(level) {
  if (level === "critical") return "Critical";
  if (level === "warn") return "Attention";
  if (level === "info") return "Info";
  if (level === "ok") return "Nominal";
  return "Unknown";
}

function isAlarmLevel(level) {
  return level === "warn" || level === "critical";
}

function isConfigured(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function sourceKey(...parts) {
  return parts
    .map((part) =>
      String(part ?? "item")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join(":");
}

function icon(kind) {
  const common = 'viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const icons = {
    cluster: `<svg ${common}><path d="M16 17h16v10H16z"/><path d="M8 32h14v8H8zM26 32h14v8H26z"/><path d="M24 27v5M15 32l5-5M33 32l-5-5"/><path d="M20 21h1M27 21h1M12 36h1M30 36h1"/></svg>`,
    server: `<svg ${common}><rect x="9" y="9" width="30" height="8" rx="2"/><rect x="9" y="20" width="30" height="8" rx="2"/><rect x="9" y="31" width="30" height="8" rx="2"/><path d="M15 13h1M15 24h1M15 35h1M24 13h10M24 24h10M24 35h10"/></svg>`,
    chip: `<svg ${common}><rect x="16" y="16" width="16" height="16" rx="2"/><path d="M20 8v8M28 8v8M20 32v8M28 32v8M8 20h8M8 28h8M32 20h8M32 28h8"/><path d="M21 21h6v6h-6z"/></svg>`,
    memory: `<svg ${common}><rect x="10" y="15" width="28" height="18" rx="3"/><path d="M14 9v6M20 9v6M26 9v6M32 9v6M14 33v6M20 33v6M26 33v6M32 33v6"/><path d="M17 24h14"/></svg>`,
    storage: `<svg ${common}><ellipse cx="24" cy="12" rx="14" ry="5"/><path d="M10 12v20c0 3 6 5 14 5s14-2 14-5V12"/><path d="M10 22c0 3 6 5 14 5s14-2 14-5"/></svg>`,
    disk: `<svg ${common}><rect x="10" y="8" width="28" height="32" rx="4"/><circle cx="24" cy="24" r="7"/><circle cx="24" cy="24" r="1"/><path d="M16 35h3M29 35h3"/></svg>`,
    thermometer: `<svg ${common}><path d="M28 29.5V10a5 5 0 0 0-10 0v19.5a9 9 0 1 0 10 0z"/><path d="M23 15v17"/></svg>`,
    gauge: `<svg ${common}><path d="M10 33a16 16 0 1 1 28 0"/><path d="M24 33l9-13"/><path d="M14 34h20"/></svg>`,
    guest: `<svg ${common}><rect x="9" y="10" width="13" height="13" rx="2"/><rect x="26" y="10" width="13" height="13" rx="2"/><rect x="9" y="27" width="13" height="13" rx="2"/><rect x="26" y="27" width="13" height="13" rx="2"/></svg>`,
    updates: `<svg ${common}><path d="M37 19a14 14 0 1 0 2 11"/><path d="M37 9v10H27"/><path d="M24 17v10h8"/></svg>`,
    power: `<svg ${common}><path d="M24 8v17"/><path d="M15 14a16 16 0 1 0 18 0"/></svg>`,
  };
  return icons[kind] || icons.server;
}

class ProxmoxDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._renderQueued = false;
    this._detailsVisible = undefined;
    this._statisticsVisible = undefined;
    this._delayedAlerts = new Map();
    this._indicatorLatches = new Map();
    this._acknowledgedAlerts = new Map();
    this._currentIndicatorSignatures = new Map();
    this._statisticsSamples = new Map();
    this._statisticsTriggered = new Map();
    this._statisticsHistory = new Map();
    this._historyRequests = new Set();
    this._alertTimer = undefined;
  }

  static getConfigElement() {
    return document.createElement("proxmox-dashboard-card-editor");
  }

  static getStubConfig(hass) {
    const nodeEntity = Object.keys(hass?.states || {}).find((entityId) => entityId.includes("cpu") || entityId.includes("proxmox"));
    return {
      type: `custom:${PROXMOX_DASHBOARD_CARD_TYPE}`,
      title: "Proxmox Cluster",
      nodes: [
        {
          name: "Node A",
          cpu_entity: nodeEntity || "",
          memory_used_percentage_entity: "",
          disk_used_percentage_entity: "",
          status_entity: "",
          storages: [],
          disks: [],
          guests: [],
        },
      ],
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const normalized = normalizeConfig(config);
    const previousShowDetails = this._config?.show_details;
    const previousShowStatistics = this._config?.show_statistics;
    this._config = normalized;
    if (this._detailsVisible === undefined || previousShowDetails !== normalized.show_details) {
      this._detailsVisible = normalized.show_details;
    }
    if (this._statisticsVisible === undefined || previousShowStatistics !== normalized.show_statistics) {
      this._statisticsVisible = normalized.show_statistics;
    }
    this._scheduleRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._scheduleRender();
  }

  getCardSize() {
    const nodes = this._config?.nodes?.length || 1;
    let size = this._detailsAreVisible() ? Math.max(6, Math.min(12, 4 + nodes * 2)) : 3;
    if (this._statisticsAreVisible()) size += 3;
    return size;
  }

  _detailsAreVisible() {
    if (!this._config) return false;
    return this._config.collapsible ? this._detailsVisible !== false : this._config.show_details !== false;
  }

  _statisticsAreVisible() {
    if (!this._config) return false;
    return this._config.statistics_collapsible ? this._statisticsVisible === true : this._config.show_statistics === true;
  }

  _scheduleRender() {
    if (!this._config || this._renderQueued) return;
    this._renderQueued = true;
    window.requestAnimationFrame(() => {
      this._renderQueued = false;
      this._render();
    });
  }

  _state(entityId) {
    if (!entityId || !this._hass?.states) return undefined;
    return this._hass.states[entityId];
  }

  _stateValue(entityId) {
    return this._state(entityId)?.state;
  }

  _number(entityId) {
    return parseNumber(this._stateValue(entityId));
  }

  _display(entityId, fallback = "--") {
    const entity = this._state(entityId);
    if (!entity) return fallback;
    if (this._hass && typeof this._hass.formatEntityState === "function") {
      return this._hass.formatEntityState(entity);
    }
    const unit = entity.attributes?.unit_of_measurement || "";
    if (["unknown", "unavailable"].includes(String(entity.state).toLowerCase())) return String(entity.state);
    return `${entity.state}${unit ? ` ${unit}` : ""}`;
  }

  _alertDelayMs() {
    return Math.max(0, Number(this._config?.alert_delay_seconds || 0) * 1000);
  }

  _scheduleAlarmRefresh(delayMs) {
    if (!Number.isFinite(delayMs) || delayMs <= 0) return;
    const delay = Math.max(50, Math.ceil(delayMs));
    if (this._alertTimer) window.clearTimeout(this._alertTimer);
    this._alertTimer = window.setTimeout(() => {
      this._alertTimer = undefined;
      this._scheduleRender();
    }, delay);
  }

  _delayedMetricLevel(key, rawLevel) {
    if (!isAlarmLevel(rawLevel)) {
      this._delayedAlerts.delete(key);
      return rawLevel;
    }

    const delayMs = this._alertDelayMs();
    if (delayMs === 0) return rawLevel;

    const now = Date.now();
    const existing = this._delayedAlerts.get(key);
    const startedAt = existing?.startedAt || now;
    const level = LEVELS[rawLevel] > LEVELS[existing?.level] ? rawLevel : existing?.level || rawLevel;
    this._delayedAlerts.set(key, { startedAt, level });

    const elapsed = now - startedAt;
    if (elapsed >= delayMs) return level;

    this._scheduleAlarmRefresh(delayMs - elapsed);
    return "ok";
  }

  _numericSource({ key, label, category, entityId, value, unit = "%", warning, critical, level, statistics = true }) {
    return {
      key,
      label,
      category,
      entityId,
      value,
      unit,
      warning,
      critical,
      level,
      numeric: true,
      statistics,
    };
  }

  _statusSource({ key, label, category, entityId, state, level, statistics = true }) {
    return {
      key,
      label,
      category,
      entityId,
      state: state ?? "--",
      level,
      numeric: false,
      statistics,
    };
  }

  _recordStatisticSample(source) {
    if (!source?.key || source.statistics === false) return;
    const now = Date.now();
    const samples = this._statisticsSamples.get(source.key) || [];
    const sample = {
      time: now,
      value: source.numeric ? source.value : isAlarmLevel(source.level) ? 1 : 0,
      state: source.state,
      level: source.level,
    };
    const last = samples[samples.length - 1];

    if (last && now - last.time < 5000) {
      samples[samples.length - 1] = sample;
    } else {
      samples.push(sample);
    }

    const cutoff = now - STATISTICS_WINDOW_MS;
    while (samples.length > STATISTICS_MAX_SAMPLES || (samples[0] && samples[0].time < cutoff)) {
      samples.shift();
    }

    this._statisticsSamples.set(source.key, samples);
  }

  _markStatisticTriggered(source) {
    if (!source?.key || source.statistics === false || !isAlarmLevel(source.level)) return;
    const now = Date.now();
    const existing = this._statisticsTriggered.get(source.key);
    this._statisticsTriggered.set(source.key, {
      ...existing,
      source: { ...source },
      firstSeen: existing?.firstSeen || now,
      lastSeen: now,
      level: worstLevel([existing?.level, source.level], source.level),
    });
  }

  _historyKey(source) {
    return `${source.key}:${source.entityId || "local"}`;
  }

  _ensureHistory(source) {
    if (!source?.entityId || source.statistics === false || !this._hass?.callApi) return;

    const key = this._historyKey(source);
    if (this._statisticsHistory.has(key) || this._historyRequests.has(key)) return;

    this._historyRequests.add(key);
    const start = encodeURIComponent(new Date(Date.now() - STATISTICS_WINDOW_MS).toISOString());
    const query = new URLSearchParams({
      filter_entity_id: source.entityId,
      minimal_response: "true",
      no_attributes: "true",
    });

    this._hass
      .callApi("GET", `history/period/${start}?${query.toString()}`)
      .then((history) => {
        const rows = Array.isArray(history?.[0]) ? history[0] : [];
        const samples = rows
          .map((entry) => this._historySampleFromState(source, entry))
          .filter(Boolean)
          .sort((a, b) => a.time - b.time);
        this._statisticsHistory.set(key, samples);
      })
      .catch(() => {
        this._statisticsHistory.set(key, []);
      })
      .finally(() => {
        this._historyRequests.delete(key);
        this._scheduleRender();
      });
  }

  _historySampleFromState(source, entry) {
    const time = new Date(entry?.last_changed || entry?.last_updated || entry?.last_reported || 0).getTime();
    if (!Number.isFinite(time) || time <= 0) return undefined;

    if (source.numeric) {
      const value = parseNumber(entry?.state);
      if (!Number.isFinite(value)) return undefined;
      return {
        time,
        value,
        state: entry?.state,
        level: levelForValue(value, { warning: source.warning, critical: source.critical }),
      };
    }

    const state = entry?.state ?? "";
    const level = levelForStatus(state);
    return {
      time,
      value: isAlarmLevel(level) ? 1 : 0,
      state,
      level,
    };
  }

  _samplesForSource(source) {
    const fallback = this._statisticsSamples.get(source.key) || [];
    this._ensureHistory(source);

    const history = this._statisticsHistory.get(this._historyKey(source));
    const base = history?.length ? history : fallback;
    const lastHistorySample = history?.[history.length - 1];
    const merged =
      history?.length && fallback.length
        ? [
            ...history,
            ...fallback.filter((sample) => !lastHistorySample || sample.time > lastHistorySample.time + 5000),
          ]
        : base;

    const cutoff = Date.now() - STATISTICS_WINDOW_MS;
    return merged
      .filter((sample) => sample?.time >= cutoff)
      .sort((a, b) => a.time - b.time)
      .slice(-STATISTICS_MAX_SAMPLES);
  }

  _activeSources(sources) {
    return (sources || []).filter((source) => source && isAlarmLevel(source.level));
  }

  _sourceSignature(indicator, activeSources) {
    if (!activeSources.length) return `${indicator.key}:${indicator.level}`;
    return activeSources
      .map((source) => `${source.key}:${source.level}`)
      .sort()
      .join("|");
  }

  _applyIndicatorState(indicator) {
    const activeSources = this._activeSources(indicator.sources);
    const signature = this._sourceSignature(indicator, activeSources);
    const latch = this._indicatorLatches.get(indicator.key);
    this._currentIndicatorSignatures.set(indicator.key, { signature, level: indicator.level });

    if (isAlarmLevel(indicator.level)) {
      activeSources.forEach((source) => this._markStatisticTriggered(source));

      if (this._acknowledgedAlerts.get(indicator.key) === signature) {
        return { ...indicator, displayLevel: "ok", acknowledged: true, activeSources };
      }

      const latchedLevel = worstLevel([latch?.level, indicator.level], indicator.level);
      this._indicatorLatches.set(indicator.key, {
        level: latchedLevel,
        signature,
        sources: activeSources,
        firstSeen: latch?.firstSeen || Date.now(),
      });

      return { ...indicator, displayLevel: latchedLevel, latched: true, activeSources };
    }

    this._acknowledgedAlerts.delete(indicator.key);

    if (latch) {
      latch.sources?.forEach((source) => this._markStatisticTriggered(source));
      return { ...indicator, displayLevel: latch.level, latched: true, activeSources: latch.sources || [] };
    }

    return { ...indicator, displayLevel: indicator.level, activeSources };
  }

  _nodeModel(node) {
    const thresholds = this._config.thresholds;
    const cpu = this._number(node.cpu_entity);
    const memory = this._number(node.memory_used_percentage_entity);
    const disk = this._number(node.disk_used_percentage_entity);
    const temp = this._number(node.temperature_entity);
    const nodeName = node.name || "Node";
    const storages = (node.storages || []).map((storage) => this._storageModel(storage, nodeName));
    const disks = (node.disks || []).map((diskItem) => this._diskModel(diskItem, nodeName));
    const guests = (node.guests || []).map((guest) => this._guestModel(guest, nodeName));
    const updates = this._number(node.updates_entity);
    const cpuLevel = node.cpu_entity ? levelForValue(cpu, thresholds.cpu) : undefined;
    const memoryLevel = node.memory_used_percentage_entity ? levelForValue(memory, thresholds.memory) : undefined;
    const diskLevel = node.disk_used_percentage_entity ? levelForValue(disk, thresholds.disk) : undefined;
    const tempLevel = node.temperature_entity ? levelForValue(temp, thresholds.disk_temperature) : undefined;
    const updateLevel = node.updates_entity ? levelForUpdates(updates) : undefined;
    const statusLevel = node.status_entity ? levelForStatus(this._stateValue(node.status_entity)) : undefined;
    const packageLevel = node.updates_packages_entity ? levelForUpdateState(this._stateValue(node.updates_packages_entity)) : undefined;
    const cpuSource = node.cpu_entity
      ? this._numericSource({
          key: sourceKey("node", nodeName, "cpu"),
          label: `${nodeName} CPU`,
          category: "Load",
          entityId: node.cpu_entity,
          value: cpu,
          warning: thresholds.cpu.warning,
          critical: thresholds.cpu.critical,
          level: cpuLevel,
        })
      : undefined;
    const memorySource = node.memory_used_percentage_entity
      ? this._numericSource({
          key: sourceKey("node", nodeName, "memory"),
          label: `${nodeName} memory`,
          category: "Memory",
          entityId: node.memory_used_percentage_entity,
          value: memory,
          warning: thresholds.memory.warning,
          critical: thresholds.memory.critical,
          level: memoryLevel,
        })
      : undefined;
    const diskSource = node.disk_used_percentage_entity
      ? this._numericSource({
          key: sourceKey("node", nodeName, "disk"),
          label: `${nodeName} node disk`,
          category: "Disk",
          entityId: node.disk_used_percentage_entity,
          value: disk,
          warning: thresholds.disk.warning,
          critical: thresholds.disk.critical,
          level: diskLevel,
        })
      : undefined;
    const tempSource = node.temperature_entity
      ? this._numericSource({
          key: sourceKey("node", nodeName, "temperature"),
          label: `${nodeName} temperature`,
          category: "Temperature",
          entityId: node.temperature_entity,
          value: temp,
          unit: "deg",
          warning: thresholds.disk_temperature.warning,
          critical: thresholds.disk_temperature.critical,
          level: tempLevel,
        })
      : undefined;
    const updateSource = node.updates_entity
      ? this._numericSource({
          key: sourceKey("node", nodeName, "updates"),
          label: `${nodeName} updates`,
          category: "Updates",
          entityId: node.updates_entity,
          value: updates,
          unit: "",
          level: updateLevel,
          statistics: false,
        })
      : undefined;
    const statusSource = node.status_entity
      ? this._statusSource({
          key: sourceKey("node", nodeName, "status"),
          label: `${nodeName} status`,
          category: "Nodes",
          entityId: node.status_entity,
          state: this._display(node.status_entity, "--"),
          level: statusLevel,
        })
      : undefined;
    const packageSource = node.updates_packages_entity
      ? this._statusSource({
          key: sourceKey("node", nodeName, "update-packages"),
          label: `${nodeName} update packages`,
          category: "Updates",
          entityId: node.updates_packages_entity,
          state: this._display(node.updates_packages_entity, "--"),
          level: packageLevel,
          statistics: false,
        })
      : undefined;
    [cpuSource, memorySource, diskSource, tempSource, updateSource, statusSource, packageSource].forEach((source) =>
      this._recordStatisticSample(source),
    );
    [diskSource, tempSource, statusSource].forEach((source) => this._markStatisticTriggered(source));
    const delayedCpuLevel = cpuSource ? this._delayedMetricLevel(cpuSource.key, cpuLevel) : undefined;
    const delayedMemoryLevel = memorySource ? this._delayedMetricLevel(memorySource.key, memoryLevel) : undefined;
    const cpuAlarmSource = cpuSource ? { ...cpuSource, level: delayedCpuLevel } : undefined;
    const memoryAlarmSource = memorySource ? { ...memorySource, level: delayedMemoryLevel } : undefined;
    [cpuAlarmSource, memoryAlarmSource].forEach((source) => this._markStatisticTriggered(source));

    const levels = [];
    const alarmLevels = [];
    if (node.status_entity) levels.push(statusLevel);
    if (node.cpu_entity) levels.push(cpuLevel);
    if (node.memory_used_percentage_entity) levels.push(memoryLevel);
    if (node.disk_used_percentage_entity) levels.push(diskLevel);
    if (node.temperature_entity) levels.push(tempLevel);
    levels.push(...storages.map((storage) => storage.level));
    levels.push(...disks.map((diskItem) => diskItem.level));
    levels.push(...guests.map((guest) => guest.level));
    alarmLevels.push(statusLevel, delayedCpuLevel, delayedMemoryLevel, diskLevel, tempLevel);
    alarmLevels.push(...storages.map((storage) => storage.level));
    alarmLevels.push(...disks.map((diskItem) => diskItem.level));
    alarmLevels.push(...guests.map((guest) => guest.level));
    const sources = [
      statusSource,
      cpuAlarmSource,
      memoryAlarmSource,
      diskSource,
      tempSource,
      ...storages.flatMap((storage) => storage.sources || []),
      ...disks.flatMap((diskItem) => diskItem.sources || []),
      ...guests.flatMap((guest) => guest.sources || []),
    ].filter(Boolean);

    return {
      raw: node,
      name: nodeName,
      status: this._display(node.status_entity, "Not configured"),
      cpu,
      memory,
      disk,
      temp,
      updates,
      storages,
      disks,
      guests,
      level: worstLevel(levels, "unknown"),
      alarmLevel: worstLevel(alarmLevels, "unknown"),
      sources,
      cpuSource,
      cpuAlarmSource,
      memorySource,
      memoryAlarmSource,
      diskSource,
      tempSource,
      updateSource,
      packageSource,
      statusSource,
    };
  }

  _storageModel(storage, nodeName) {
    const thresholds = this._config.thresholds.storage;
    let used = this._number(storage.used_percentage_entity);
    const total = this._number(storage.total_entity);
    const usedAbsolute = this._number(storage.used_entity);

    if (!Number.isFinite(used) && Number.isFinite(total) && total > 0 && Number.isFinite(usedAbsolute)) {
      used = (usedAbsolute / total) * 100;
    }

    const levels = [];
    if (storage.status_entity) levels.push(levelForStatus(this._stateValue(storage.status_entity)));
    if (storage.used_percentage_entity || storage.used_entity) levels.push(levelForValue(used, thresholds));
    const usedLevel = storage.used_percentage_entity || storage.used_entity ? levelForValue(used, thresholds) : undefined;
    const statusLevel = storage.status_entity ? levelForStatus(this._stateValue(storage.status_entity)) : undefined;
    const usedSource =
      storage.used_percentage_entity || storage.used_entity
        ? this._numericSource({
            key: sourceKey("storage", nodeName, storage.name || "storage", "used"),
            label: `${nodeName} ${storage.name || "storage"} used`,
            category: "Storage",
            entityId: storage.used_percentage_entity || undefined,
            value: used,
            warning: thresholds.warning,
            critical: thresholds.critical,
            level: usedLevel,
          })
        : undefined;
    const statusSource = storage.status_entity
      ? this._statusSource({
          key: sourceKey("storage", nodeName, storage.name || "storage", "status"),
          label: `${nodeName} ${storage.name || "storage"} status`,
          category: "Storage",
          entityId: storage.status_entity,
          state: this._display(storage.status_entity, "--"),
          level: statusLevel,
        })
      : undefined;
    const sources = [usedSource, statusSource].filter(Boolean);
    sources.forEach((source) => {
      this._recordStatisticSample(source);
      this._markStatisticTriggered(source);
    });

    return {
      raw: storage,
      name: storage.name || "Storage",
      used,
      level: worstLevel(levels, "unknown"),
      sources,
    };
  }

  _diskModel(disk, nodeName) {
    const temperature = this._number(disk.temperature_entity);
    const wearout = this._number(disk.wearout_entity);
    const levels = [];
    const healthLevel = disk.health_entity ? levelForStatus(this._stateValue(disk.health_entity)) : undefined;
    const temperatureLevel = disk.temperature_entity ? levelForValue(temperature, this._config.thresholds.disk_temperature) : undefined;
    const wearoutLevel = disk.wearout_entity ? levelForValue(wearout, this._config.thresholds.wearout) : undefined;
    if (disk.health_entity) levels.push(healthLevel);
    if (disk.temperature_entity) levels.push(temperatureLevel);
    if (disk.wearout_entity) levels.push(wearoutLevel);
    const diskName = disk.name || "Disk";
    const healthSource = disk.health_entity
      ? this._statusSource({
          key: sourceKey("disk", nodeName, diskName, "health"),
          label: `${nodeName} ${diskName} health`,
          category: "Disks",
          entityId: disk.health_entity,
          state: this._display(disk.health_entity, "--"),
          level: healthLevel,
        })
      : undefined;
    const temperatureSource = disk.temperature_entity
      ? this._numericSource({
          key: sourceKey("disk", nodeName, diskName, "temperature"),
          label: `${nodeName} ${diskName} temperature`,
          category: "Temperature",
          entityId: disk.temperature_entity,
          value: temperature,
          unit: "deg",
          warning: this._config.thresholds.disk_temperature.warning,
          critical: this._config.thresholds.disk_temperature.critical,
          level: temperatureLevel,
        })
      : undefined;
    const wearoutSource = disk.wearout_entity
      ? this._numericSource({
          key: sourceKey("disk", nodeName, diskName, "wearout"),
          label: `${nodeName} ${diskName} wearout`,
          category: "Disks",
          entityId: disk.wearout_entity,
          value: wearout,
          warning: this._config.thresholds.wearout.warning,
          critical: this._config.thresholds.wearout.critical,
          level: wearoutLevel,
        })
      : undefined;
    const sources = [healthSource, temperatureSource, wearoutSource].filter(Boolean);
    sources.forEach((source) => {
      this._recordStatisticSample(source);
      this._markStatisticTriggered(source);
    });

    return {
      raw: disk,
      name: diskName,
      temperature,
      wearout,
      level: worstLevel(levels, "unknown"),
      sources,
    };
  }

  _guestModel(guest, nodeName) {
    const cpu = this._number(guest.cpu_entity);
    const memory = this._number(guest.memory_used_percentage_entity);
    const disk = this._number(guest.disk_used_percentage_entity);
    const levels = [];
    const statusLevel = guest.status_entity ? levelForStatus(this._stateValue(guest.status_entity)) : undefined;
    const cpuLevel = guest.cpu_entity ? levelForValue(cpu, this._config.thresholds.cpu) : undefined;
    const memoryLevel = guest.memory_used_percentage_entity ? levelForValue(memory, this._config.thresholds.memory) : undefined;
    const diskLevel = guest.disk_used_percentage_entity ? levelForValue(disk, this._config.thresholds.disk) : undefined;
    if (guest.status_entity) levels.push(statusLevel);
    if (guest.cpu_entity) levels.push(cpuLevel);
    if (guest.memory_used_percentage_entity) levels.push(memoryLevel);
    if (guest.disk_used_percentage_entity) levels.push(diskLevel);
    const guestName = guest.name || "Guest";
    const statusSource = guest.status_entity
      ? this._statusSource({
          key: sourceKey("guest", nodeName, guestName, "status"),
          label: `${nodeName} ${guestName} status`,
          category: "VM/LXC",
          entityId: guest.status_entity,
          state: this._display(guest.status_entity, "--"),
          level: statusLevel,
          statistics: false,
        })
      : undefined;
    const sources = [statusSource].filter(Boolean);
    sources.forEach((source) => {
      this._recordStatisticSample(source);
      this._markStatisticTriggered(source);
    });

    return {
      raw: guest,
      name: guestName,
      type: guest.type || "vm",
      cpu,
      memory,
      disk,
      level: worstLevel(levels, "unknown"),
      sources,
    };
  }

  _clusterModel() {
    const nodes = this._config.nodes.map((node) => this._nodeModel(node));
    const rawNodes = this._config.nodes;
    const allDisks = nodes.flatMap((node) => node.disks);
    const allStorages = nodes.flatMap((node) => node.storages);
    const allGuests = nodes.flatMap((node) => node.guests);
    const hasCluster = nodes.length > 1;
    const hasNodeStatus = nodes.length > 0;
    const hasGuests =
      allGuests.length > 0 ||
      rawNodes.some((node) => isConfigured(node.virtual_machines_running_entity) || isConfigured(node.containers_running_entity));
    const hasLoad = rawNodes.some((node) => isConfigured(node.cpu_entity));
    const hasMemory = rawNodes.some(
      (node) =>
        isConfigured(node.memory_used_percentage_entity) ||
        isConfigured(node.memory_used_entity) ||
        isConfigured(node.memory_free_entity),
    );
    const hasStorage = allStorages.length > 0;
    const hasDisks = allDisks.length > 0;
    const hasTemperature =
      rawNodes.some((node) => isConfigured(node.temperature_entity)) ||
      rawNodes.some((node) => (node.disks || []).some((disk) => isConfigured(disk.temperature_entity)));
    const hasUpdates = rawNodes.some((node) => isConfigured(node.updates_entity) || isConfigured(node.updates_packages_entity));
    const loadSources = nodes.map((node) => node.cpuAlarmSource).filter(Boolean);
    const memorySources = nodes.map((node) => node.memoryAlarmSource).filter(Boolean);
    const storageSources = allStorages.flatMap((storage) => storage.sources || []);
    const diskSources = allDisks.flatMap((disk) => disk.sources || []);
    const tempSources = [
      ...nodes.map((node) => node.tempSource).filter(Boolean),
      ...allDisks.flatMap((disk) => (disk.sources || []).filter((source) => source.category === "Temperature")),
    ];
    const updateSources = nodes.flatMap((node) => [node.updateSource, node.packageSource]).filter(Boolean);
    const nodeSources = nodes.flatMap((node) => node.sources || []);
    const loadLevels = loadSources.map((source) => source.level);
    const memoryLevels = memorySources.map((source) => source.level);
    const guestCountLevels = nodes.flatMap((node) => [
      isConfigured(node.raw.virtual_machines_running_entity) ? (Number.isFinite(this._number(node.raw.virtual_machines_running_entity)) ? "ok" : "unknown") : undefined,
      isConfigured(node.raw.containers_running_entity) ? (Number.isFinite(this._number(node.raw.containers_running_entity)) ? "ok" : "unknown") : undefined,
    ]);
    const temperatureLevels = [
      ...nodes.map((node) => (Number.isFinite(node.temp) ? levelForValue(node.temp, this._config.thresholds.disk_temperature) : undefined)),
      ...allDisks.map((disk) => (Number.isFinite(disk.temperature) ? levelForValue(disk.temperature, this._config.thresholds.disk_temperature) : undefined)),
    ];
    const updateLevels = nodes.flatMap((node) => [
      node.raw.updates_entity ? levelForUpdates(node.updates) : undefined,
      node.raw.updates_packages_entity ? levelForUpdateState(this._stateValue(node.raw.updates_packages_entity)) : undefined,
    ]);
    const indicators = [
      hasCluster
        ? {
            key: "cluster",
            label: "Cluster",
            icon: "cluster",
            level: worstLevel(nodes.map((node) => node.alarmLevel), "unknown"),
            sources: nodeSources,
          }
        : undefined,
      hasNodeStatus
        ? {
            key: "nodes",
            label: "Nodes",
            icon: "server",
            level: worstLevel(nodes.map((node) => node.alarmLevel), "unknown"),
            sources: nodeSources,
          }
        : undefined,
      hasGuests
        ? {
            key: "guests",
            label: "VM/LXC",
            icon: "guest",
            level: allGuests.length ? worstLevel(allGuests.map((guest) => guest.level)) : worstLevel(guestCountLevels, "unknown"),
            sources: allGuests.flatMap((guest) => guest.sources || []),
          }
        : undefined,
      hasLoad ? { key: "load", label: "Load", icon: "gauge", level: worstLevel(loadLevels, "unknown"), sources: loadSources } : undefined,
      hasMemory
        ? {
            key: "memory",
            label: "Memory",
            icon: "memory",
            level: worstLevel(memoryLevels, "unknown"),
            sources: memorySources,
          }
        : undefined,
      hasStorage ? { key: "storage", label: "Storage", icon: "storage", level: worstLevel(allStorages.map((storage) => storage.level), "unknown"), sources: storageSources } : undefined,
      hasDisks ? { key: "disks", label: "Disks", icon: "disk", level: worstLevel(allDisks.map((disk) => disk.level), "unknown"), sources: diskSources } : undefined,
      hasTemperature ? { key: "temperature", label: "Temp", icon: "thermometer", level: worstLevel(temperatureLevels, "unknown"), sources: tempSources } : undefined,
      hasUpdates ? { key: "updates", label: "Updates", icon: "updates", level: updateIndicatorLevel(updateLevels), sources: updateSources } : undefined,
    ]
      .filter(Boolean)
      .map((indicator) => this._applyIndicatorState(indicator));
    const healthIndicators = indicators.filter((indicator) => indicator.key !== "updates");

    return {
      nodes,
      overall: worstLevel(healthIndicators.map((indicator) => indicator.displayLevel), "unknown"),
      indicators,
      totals: {
        nodes: nodes.length,
        guests: allGuests.length,
        storages: allStorages.length,
        disks: allDisks.length,
        attention: nodes.filter((node) => ["warn", "critical"].includes(node.level)).length,
      },
    };
  }

  _render() {
    if (!this._config) return;
    const cluster = this._clusterModel();
    const hasNodes = cluster.nodes.length > 0;
    const detailsVisible = this._detailsAreVisible();
    const statisticsVisible = this._statisticsAreVisible();

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="pdc-card">
        <section class="pdc-shell">
          <header class="pdc-header">
            <div>
              <p class="eyebrow">Proxmox observability</p>
              <h2>${html(this._config.title)}</h2>
            </div>
            <div class="header-actions">
              <div class="overall overall-${cluster.overall}">
                <span class="pulse"></span>
                <strong>${labelForLevel(cluster.overall)}</strong>
              </div>
              ${hasNodes && this._config.collapsible ? this._renderDetailsToggle(detailsVisible) : ""}
              ${hasNodes && this._config.show_statistics && this._config.statistics_collapsible ? this._renderStatisticsToggle(statisticsVisible) : ""}
            </div>
          </header>

          ${hasNodes ? this._renderDashboardStrip(cluster) : this._renderEmptyState()}
          ${hasNodes && statisticsVisible ? this._renderStatisticsSection() : ""}
          ${
            hasNodes && detailsVisible
              ? `
                <section class="details-panel">
                  ${this._renderClusterSummary(cluster)}
                  <div class="node-grid">${cluster.nodes.map((node) => this._renderNode(node)).join("")}</div>
                </section>
              `
              : ""
          }
        </section>
      </ha-card>
    `;
    this._attachCardEvents();
  }

  _renderDetailsToggle(detailsVisible) {
    return `
      <button
        class="details-toggle details-view-toggle"
        type="button"
        aria-expanded="${detailsVisible ? "true" : "false"}"
        aria-label="${detailsVisible ? "Hide Proxmox details" : "Show Proxmox details"}"
        title="${detailsVisible ? "Hide details" : "Show details"}"
      >
        <span class="toggle-icon" aria-hidden="true">${detailsVisible ? "^" : "v"}</span>
        <span>Details</span>
      </button>
    `;
  }

  _renderStatisticsToggle(statisticsVisible) {
    return `
      <button
        class="details-toggle statistics-toggle"
        type="button"
        aria-expanded="${statisticsVisible ? "true" : "false"}"
        aria-label="${statisticsVisible ? "Hide Proxmox statistics" : "Show Proxmox statistics"}"
        title="${statisticsVisible ? "Hide statistics" : "Show statistics"}"
      >
        <span class="toggle-icon" aria-hidden="true">${statisticsVisible ? "^" : "v"}</span>
        <span>Statistics</span>
      </button>
    `;
  }

  _attachCardEvents() {
    const toggle = this.shadowRoot.querySelector(".details-view-toggle");
    toggle?.addEventListener("click", () => {
      this._detailsVisible = !this._detailsAreVisible();
      this._scheduleRender();
    });
    const statisticsToggle = this.shadowRoot.querySelector(".statistics-toggle");
    statisticsToggle?.addEventListener("click", () => {
      this._statisticsVisible = !this._statisticsAreVisible();
      this._scheduleRender();
    });
    this.shadowRoot.querySelectorAll(".indicator").forEach((indicator) => {
      indicator.addEventListener("click", () => {
        const key = indicator.dataset.indicatorKey;
        const latch = this._indicatorLatches.get(key);
        const current = this._currentIndicatorSignatures.get(key);
        if (latch?.signature) this._acknowledgedAlerts.set(key, latch.signature);
        else if (current?.signature && isAlarmLevel(current.level)) this._acknowledgedAlerts.set(key, current.signature);
        this._indicatorLatches.delete(key);
        this._scheduleRender();
      });
    });
  }

  _renderDashboardStrip(cluster) {
    return `
      <section class="indicator-strip" aria-label="Proxmox health indicators">
        ${cluster.indicators
          .map(
            (item) => `
              <button
                class="indicator indicator-${item.displayLevel}"
                type="button"
                data-indicator-key="${html(item.key)}"
                title="${html(item.label)}: ${labelForLevel(item.displayLevel)}${item.latched ? " (latched, click to acknowledge)" : ""}"
                aria-label="${html(item.label)} ${labelForLevel(item.displayLevel)}"
              >
                <div class="indicator-icon">${icon(item.icon)}</div>
                <span>${html(item.label)}</span>
              </button>
            `,
          )
          .join("")}
      </section>
    `;
  }

  _renderClusterSummary(cluster) {
    const summaryItems = [
      ["Nodes", cluster.totals.nodes, "server"],
      ["Guests", cluster.totals.guests, "guest"],
      ["Storage", cluster.totals.storages, "storage"],
      ["Disks", cluster.totals.disks, "disk"],
      ["Attention", cluster.totals.attention, "updates"],
    ];

    return `
      <section class="cluster-summary">
        ${summaryItems
          .map(
            ([label, value, itemIcon]) => `
              <div class="summary-item">
                <span class="summary-icon">${icon(itemIcon)}</span>
                <span class="summary-value">${html(value)}</span>
                <span class="summary-label">${html(label)}</span>
              </div>
            `,
          )
          .join("")}
      </section>
    `;
  }

  _statisticsItems() {
    return [...this._statisticsTriggered.values()]
      .filter((item) => item.source?.statistics !== false)
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        samples: this._samplesForSource(item.source),
      }));
  }

  _renderStatisticsSection() {
    const items = this._statisticsItems();

    return `
      <section class="statistics-panel">
        <div class="statistics-header">
          <div>
            <h3>Statistics</h3>
            <p>${items.length ? "Threshold-triggering parameters over the last 24 hours." : "No statusbar warnings have been triggered."}</p>
          </div>
        </div>
        ${
          items.length
            ? `<div class="statistics-grid">${items.map((item) => this._renderStatisticItem(item)).join("")}</div>`
            : ""
        }
      </section>
    `;
  }

  _renderStatisticItem(item) {
    const source = item.source;
    const current = source.numeric && Number.isFinite(source.value) ? `${compactNumber(source.value)}${source.unit || ""}` : html(source.state || labelForLevel(item.level));

    return `
      <article class="stat-card stat-${item.level}">
        <div class="stat-topline">
          <div>
            <strong>${html(source.label)}</strong>
            <span>${html(source.category)} · ${labelForLevel(item.level)}</span>
          </div>
          <b>${current}</b>
        </div>
        ${source.numeric ? this._renderNumericStatisticChart(source, item.samples) : this._renderStatusStatisticChart(item, item.samples)}
      </article>
    `;
  }

  _renderNumericStatisticChart(source, samples) {
    const chartSamples = samples.filter((sample) => Number.isFinite(sample.value));
    const width = 320;
    const height = 92;
    const padding = 12;
    const now = Date.now();
    const start = now - STATISTICS_WINDOW_MS;
    const end = now;
    const maxValue = Math.max(source.critical || 0, source.warning || 0, ...chartSamples.map((sample) => sample.value), 1) * 1.12;
    const x = (time) => padding + ((time - start) / Math.max(1, end - start)) * (width - padding * 2);
    const y = (value) => height - padding - (clamp(value, 0, maxValue) / maxValue) * (height - padding * 2);
    const points = chartSamples.map((sample) => `${x(sample.time).toFixed(1)},${y(sample.value).toFixed(1)}`).join(" ");
    const warningY = y(source.warning);
    const criticalY = y(source.critical);
    const bands = chartSamples
      .slice(0, -1)
      .map((sample, index) => {
        const next = chartSamples[index + 1];
        const level = levelForValue(sample.value, { warning: source.warning, critical: source.critical });
        if (!isAlarmLevel(level)) return "";
        const bandX = x(sample.time);
        const bandWidth = Math.max(2, x(next.time) - bandX);
        return `<rect class="stat-band stat-band-${level}" x="${bandX.toFixed(1)}" y="8" width="${bandWidth.toFixed(1)}" height="${height - 16}"></rect>`;
      })
      .join("");

    return `
      <svg class="stat-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${html(source.label)} history">
        <rect class="stat-chart-bg" x="0" y="0" width="${width}" height="${height}"></rect>
        ${bands}
        <line class="threshold critical" x1="${padding}" x2="${width - padding}" y1="${criticalY.toFixed(1)}" y2="${criticalY.toFixed(1)}"></line>
        <line class="threshold warning" x1="${padding}" x2="${width - padding}" y1="${warningY.toFixed(1)}" y2="${warningY.toFixed(1)}"></line>
        <polyline class="stat-line" points="${html(points)}"></polyline>
      </svg>
      <div class="stat-legend">
        <span>Warn ${compactNumber(source.warning)}${html(source.unit || "")}</span>
        <span>Critical ${compactNumber(source.critical)}${html(source.unit || "")}</span>
      </div>
    `;
  }

  _renderStatusStatisticChart(item, samples = []) {
    const chartSamples = samples.filter((sample) => Number.isFinite(sample.time));
    const width = 320;
    const height = 74;
    const padding = 8;
    const now = Date.now();
    const start = now - STATISTICS_WINDOW_MS;
    const end = now;
    const x = (time) => padding + ((time - start) / Math.max(1, end - start)) * (width - padding * 2);
    const bands = chartSamples
      .map((sample, index) => {
        const level = sample.level || levelForStatus(sample.state);
        if (!isAlarmLevel(level)) return "";
        const next = chartSamples[index + 1];
        const bandX = x(sample.time);
        const bandEnd = x(next?.time || end);
        const bandWidth = Math.max(2, bandEnd - bandX);
        return `<rect class="stat-band stat-band-${level}" x="${bandX.toFixed(1)}" y="8" width="${bandWidth.toFixed(1)}" height="${height - 16}"></rect>`;
      })
      .join("");

    return `
      <div class="status-stat-chart status-stat-${item.level}">
        <svg class="status-stat-timeline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
          <rect class="stat-chart-bg" x="0" y="0" width="${width}" height="${height}"></rect>
          ${bands}
        </svg>
        <span>${html(item.source.state || labelForLevel(item.level))}</span>
      </div>
      <div class="stat-legend">
        <span>Last 24 hours</span>
      </div>
    `;
  }

  _renderNode(node) {
    const raw = node.raw;
    const vmCount = this._display(raw.virtual_machines_running_entity, "--");
    const lxcCount = this._display(raw.containers_running_entity, "--");

    return `
      <article class="node-card node-${node.level}">
        <div class="node-topline">
          <div>
            <span class="node-state">${labelForLevel(node.level)}</span>
            <h3>${html(node.name)}</h3>
          </div>
          <div class="node-icon">${icon("server")}</div>
        </div>

        <div class="gauge-row">
          ${this._renderGauge("CPU", node.cpu, "cpu")}
          ${this._renderGauge("MEM", node.memory, "memory")}
          ${this._renderGauge("DISK", node.disk, "disk")}
        </div>

        <div class="quick-stats">
          ${this._renderQuickStat("VMs", vmCount, "guest")}
          ${this._renderQuickStat("LXCs", lxcCount, "guest")}
          ${this._renderQuickStat("Boot", this._display(raw.last_boot_entity, "--"), "power")}
          ${this._renderQuickStat("Updates", this._display(raw.updates_entity, "--"), "updates")}
        </div>

        ${this._renderStorageSection(node)}
        ${this._renderDiskSection(node)}
        ${this._renderGuestSection(node)}
      </article>
    `;
  }

  _renderGauge(label, value, thresholdKey) {
    const level = levelForValue(value, this._config.thresholds[thresholdKey]);
    const percent = clamp(value);
    const display = Number.isFinite(value) ? `${compactNumber(value)}%` : "--";
    return `
      <div class="gauge gauge-${level}" style="--value:${percent}; --gauge-color:${levelColor(level)}">
        <div class="gauge-face">
          <span>${html(display)}</span>
        </div>
        <small>${html(label)}</small>
      </div>
    `;
  }

  _renderQuickStat(label, value, itemIcon) {
    return `
      <div class="quick-stat">
        <span>${icon(itemIcon)}</span>
        <div>
          <strong>${html(value)}</strong>
          <small>${html(label)}</small>
        </div>
      </div>
    `;
  }

  _renderStorageSection(node) {
    if (!node.storages.length) return "";
    return `
      <section class="subsection">
        <div class="subsection-title">
          <span>${icon("storage")}</span>
          <strong>Storage</strong>
        </div>
        <div class="storage-list">
          ${node.storages
            .map(
              (storage) => `
                <div class="storage-row storage-${storage.level}">
                  <div class="storage-label">
                    <span>${html(storage.name)}</span>
                    <strong>${Number.isFinite(storage.used) ? `${compactNumber(storage.used)}%` : "--"}</strong>
                  </div>
                  <div class="bar"><span style="width:${clamp(storage.used)}%"></span></div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  _renderDiskSection(node) {
    if (!node.disks.length) return "";
    return `
      <section class="subsection">
        <div class="subsection-title">
          <span>${icon("disk")}</span>
          <strong>Physical disks</strong>
        </div>
        <div class="disk-grid">
          ${node.disks
            .map(
              (disk) => `
                <div class="disk-tile disk-${disk.level}">
                  <span class="disk-light"></span>
                  <strong>${html(disk.name)}</strong>
                  <small>${this._display(disk.raw.health_entity, "Health --")}</small>
                  <div class="disk-meta">
                    <span>${Number.isFinite(disk.temperature) ? `${compactNumber(disk.temperature)} deg` : "--"}</span>
                    <span>${Number.isFinite(disk.wearout) ? `${compactNumber(disk.wearout)}% wear` : "--"}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  _renderGuestSection(node) {
    if (!node.guests.length) return "";
    return `
      <section class="subsection">
        <div class="subsection-title">
          <span>${icon("guest")}</span>
          <strong>VMs and LXCs</strong>
        </div>
        <div class="guest-list">
          ${node.guests
            .map(
              (guest) => `
                <div class="guest-row guest-${guest.level}">
                  <div class="guest-main">
                    <span class="status-dot"></span>
                    <strong>${html(guest.name)}</strong>
                    <small>${html(String(guest.type).toUpperCase())}</small>
                  </div>
                  <div class="guest-bars">
                    ${this._renderMicroBar("CPU", guest.cpu, "cpu")}
                    ${this._renderMicroBar("MEM", guest.memory, "memory")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  _renderMicroBar(label, value, thresholdKey) {
    const level = levelForValue(value, this._config.thresholds[thresholdKey]);
    return `
      <div class="micro-bar micro-${level}" title="${html(label)} ${Number.isFinite(value) ? `${compactNumber(value)}%` : "--"}">
        <span>${html(label)}</span>
        <div><b style="width:${clamp(value)}%"></b></div>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <section class="empty-state">
        <div>${icon("cluster")}</div>
        <h3>Add Proxmox nodes</h3>
        <p>Open the visual editor and add the Home Assistant entities for each node, disk, storage pool, VM, and LXC.</p>
      </section>
    `;
  }

  _styles() {
    return `
      :host {
        --pdc-ok: #28c76f;
        --pdc-info: #2d9cdb;
        --pdc-warn: #ffb020;
        --pdc-critical: #ff4d4f;
        --pdc-unknown: #8a94a6;
        --pdc-panel: #080b0f;
        --pdc-panel-soft: #111821;
        --pdc-text: var(--primary-text-color, #17202a);
        --pdc-muted: var(--secondary-text-color, #5b6573);
        --pdc-border: rgba(127, 139, 153, 0.28);
        --pdc-card: var(--card-background-color, #ffffff);
        --pdc-card-soft: color-mix(in srgb, var(--pdc-card) 88%, #eef2f6 12%);
        display: block;
      }

      * {
        box-sizing: border-box;
      }

      ha-card.pdc-card {
        display: block;
        overflow: hidden;
        color: var(--pdc-text);
        background: var(--pdc-card);
        border-radius: var(--ha-card-border-radius, 8px);
      }

      .pdc-shell {
        padding: 18px;
        display: grid;
        gap: 16px;
      }

      .pdc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      .eyebrow {
        margin: 0 0 3px;
        color: var(--pdc-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0;
        font-weight: 700;
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      h2 {
        font-size: clamp(1.35rem, 2vw, 1.8rem);
        line-height: 1.12;
        letter-spacing: 0;
      }

      h3 {
        margin-top: 3px;
        font-size: 1.1rem;
        line-height: 1.15;
        letter-spacing: 0;
      }

      .overall {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        padding: 8px 10px;
        border: 1px solid var(--pdc-border);
        border-radius: 8px;
        background: var(--pdc-card-soft);
        white-space: nowrap;
        font-size: 0.86rem;
      }

      .pulse {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 18%, transparent);
      }

      .details-toggle {
        min-height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 10px;
        border: 1px solid var(--pdc-border);
        border-radius: 8px;
        color: var(--pdc-text);
        background: var(--pdc-card-soft);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 800;
        cursor: pointer;
      }

      .details-toggle:focus-visible {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: 2px;
      }

      .toggle-icon {
        width: 16px;
        display: inline-grid;
        place-items: center;
        color: var(--pdc-muted);
      }

      .overall-ok,
      .indicator-ok,
      .node-ok,
      .storage-ok,
      .disk-ok,
      .guest-ok,
      .gauge-ok,
      .micro-ok {
        color: var(--pdc-ok);
      }

      .overall-info,
      .indicator-info {
        color: var(--pdc-info);
      }

      .overall-warn,
      .indicator-warn,
      .node-warn,
      .storage-warn,
      .disk-warn,
      .guest-warn,
      .gauge-warn,
      .micro-warn {
        color: var(--pdc-warn);
      }

      .overall-critical,
      .indicator-critical,
      .node-critical,
      .storage-critical,
      .disk-critical,
      .guest-critical,
      .gauge-critical,
      .micro-critical {
        color: var(--pdc-critical);
      }

      .overall-unknown,
      .indicator-unknown,
      .node-unknown,
      .storage-unknown,
      .disk-unknown,
      .guest-unknown,
      .gauge-unknown,
      .micro-unknown {
        color: var(--pdc-unknown);
      }

      .indicator-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
        gap: 10px;
        padding: 14px;
        border-radius: 8px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent),
          var(--pdc-panel);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }

      .indicator {
        min-width: 0;
        display: grid;
        place-items: center;
        gap: 5px;
        padding: 10px 4px 8px;
        border: 0;
        border-radius: 6px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        font: inherit;
        cursor: pointer;
      }

      .indicator:focus-visible {
        outline: 2px solid color-mix(in srgb, currentColor 70%, white 30%);
        outline-offset: 2px;
      }

      .indicator-icon {
        width: 36px;
        height: 36px;
        filter: drop-shadow(0 0 7px color-mix(in srgb, currentColor 35%, transparent));
      }

      .indicator svg,
      .summary-icon svg,
      .node-icon svg,
      .quick-stat svg,
      .subsection-title svg {
        width: 100%;
        height: 100%;
      }

      .indicator span {
        max-width: 100%;
        color: color-mix(in srgb, currentColor 75%, white 25%);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cluster-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
        gap: 10px;
      }

      .details-panel {
        display: grid;
        gap: 14px;
      }

      .statistics-panel {
        display: grid;
        gap: 12px;
        padding: 14px;
        border: 1px solid var(--pdc-border);
        border-radius: 8px;
        background: var(--pdc-card-soft);
      }

      .statistics-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .statistics-header h3 {
        margin: 0;
        font-size: 1rem;
      }

      .statistics-header p {
        margin-top: 4px;
        color: var(--pdc-muted);
        font-size: 0.82rem;
      }

      .statistics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 10px;
      }

      .stat-card {
        min-width: 0;
        display: grid;
        gap: 9px;
        padding: 10px;
        border: 1px solid color-mix(in srgb, currentColor 26%, var(--pdc-border));
        border-radius: 8px;
        background: var(--pdc-card);
        color: var(--pdc-text);
      }

      .stat-warn {
        --stat-color: var(--pdc-warn);
      }

      .stat-critical {
        --stat-color: var(--pdc-critical);
      }

      .stat-topline {
        min-width: 0;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .stat-topline div {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .stat-topline strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .stat-topline span,
      .stat-legend {
        color: var(--pdc-muted);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .stat-topline b {
        color: var(--stat-color, var(--pdc-warn));
        white-space: nowrap;
      }

      .stat-chart {
        width: 100%;
        height: 92px;
        overflow: hidden;
        border-radius: 6px;
      }

      .stat-chart-bg {
        fill: rgba(127, 139, 153, 0.1);
      }

      .stat-band {
        opacity: 0.16;
      }

      .stat-band-warn {
        fill: var(--pdc-warn);
      }

      .stat-band-critical {
        fill: var(--pdc-critical);
      }

      .threshold {
        stroke-width: 1.5;
        stroke-dasharray: 5 4;
      }

      .threshold.warning {
        stroke: var(--pdc-warn);
      }

      .threshold.critical {
        stroke: var(--pdc-critical);
      }

      .stat-line {
        fill: none;
        stroke: var(--stat-color, var(--pdc-warn));
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .status-stat-chart {
        min-height: 74px;
        position: relative;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 6px;
        color: var(--stat-color, var(--pdc-warn));
        background: color-mix(in srgb, currentColor 10%, transparent);
        font-size: 1rem;
        font-weight: 900;
      }

      .status-stat-timeline {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .status-stat-chart span {
        position: relative;
        z-index: 1;
      }

      .stat-legend {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .summary-item {
        min-width: 0;
        display: grid;
        grid-template-columns: 30px 1fr;
        grid-template-areas:
          "icon value"
          "icon label";
        align-items: center;
        column-gap: 9px;
        padding: 11px;
        border: 1px solid var(--pdc-border);
        border-radius: 8px;
        background: var(--pdc-card-soft);
      }

      .summary-icon {
        grid-area: icon;
        width: 28px;
        height: 28px;
        color: var(--pdc-muted);
      }

      .summary-value {
        grid-area: value;
        font-size: 1.25rem;
        line-height: 1;
        font-weight: 800;
      }

      .summary-label {
        grid-area: label;
        color: var(--pdc-muted);
        font-size: 0.76rem;
        font-weight: 700;
      }

      .node-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 14px;
        align-items: start;
      }

      .node-card {
        min-width: 0;
        display: grid;
        gap: 13px;
        align-content: start;
        align-self: start;
        padding: 14px;
        border: 1px solid var(--pdc-border);
        border-top: 4px solid var(--node-level-color, var(--pdc-unknown));
        border-radius: 8px;
        background: var(--pdc-card);
        color: var(--pdc-text);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.05);
      }

      .node-card.node-ok {
        --node-level-color: var(--pdc-ok);
      }

      .node-card.node-warn {
        --node-level-color: var(--pdc-warn);
      }

      .node-card.node-critical {
        --node-level-color: var(--pdc-critical);
      }

      .node-card.node-unknown {
        --node-level-color: var(--pdc-unknown);
      }

      .node-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .node-state {
        display: inline-flex;
        color: var(--node-level-color, var(--pdc-unknown));
        font-size: 0.71rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .node-icon {
        flex: 0 0 38px;
        width: 38px;
        height: 38px;
        color: var(--node-level-color, var(--pdc-unknown));
      }

      .gauge-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .gauge {
        min-width: 0;
        display: grid;
        justify-items: center;
        gap: 6px;
        color: var(--pdc-text);
      }

      .gauge-face {
        width: min(84px, 100%);
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background:
          radial-gradient(circle at center, var(--pdc-card) 0 56%, transparent 57%),
          conic-gradient(var(--gauge-color) calc(var(--value) * 1%), rgba(127, 139, 153, 0.16) 0);
        box-shadow: inset 0 0 0 1px rgba(127, 139, 153, 0.2);
      }

      .gauge-face span {
        color: var(--pdc-text);
        font-size: clamp(0.78rem, 2.5vw, 1rem);
        font-weight: 800;
      }

      .gauge small {
        color: var(--pdc-muted);
        font-size: 0.72rem;
        font-weight: 800;
      }

      .quick-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .quick-stat {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 8px;
        background: var(--pdc-card-soft);
      }

      .quick-stat > span {
        flex: 0 0 24px;
        width: 24px;
        height: 24px;
        color: var(--pdc-muted);
      }

      .quick-stat div {
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .quick-stat strong {
        min-width: 0;
        color: var(--pdc-text);
        font-size: 0.9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .quick-stat small {
        color: var(--pdc-muted);
        font-size: 0.7rem;
        font-weight: 700;
      }

      .subsection {
        display: grid;
        gap: 8px;
        padding-top: 11px;
        border-top: 1px solid var(--pdc-border);
      }

      .subsection-title {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--pdc-muted);
        font-size: 0.8rem;
        text-transform: uppercase;
        font-weight: 800;
      }

      .subsection-title span {
        width: 20px;
        height: 20px;
      }

      .storage-list,
      .guest-list {
        display: grid;
        gap: 8px;
      }

      .storage-row {
        display: grid;
        gap: 6px;
      }

      .storage-label {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 0.82rem;
      }

      .storage-label span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bar,
      .micro-bar div {
        width: 100%;
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(127, 139, 153, 0.18);
      }

      .bar span,
      .micro-bar b {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: currentColor;
      }

      .disk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
        gap: 8px;
      }

      .disk-tile {
        min-width: 0;
        display: grid;
        gap: 4px;
        padding: 9px;
        border: 1px solid color-mix(in srgb, currentColor 30%, var(--pdc-border));
        border-radius: 8px;
        background: color-mix(in srgb, currentColor 6%, transparent);
      }

      .disk-light,
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 16%, transparent);
      }

      .disk-tile strong,
      .guest-main strong {
        min-width: 0;
        color: var(--pdc-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .disk-tile small,
      .guest-main small {
        color: var(--pdc-muted);
        font-weight: 700;
      }

      .disk-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        color: var(--pdc-text);
        font-size: 0.75rem;
        font-weight: 800;
      }

      .disk-meta span {
        padding: 3px 6px;
        border-radius: 6px;
        background: var(--pdc-card);
      }

      .guest-row {
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(110px, 0.85fr);
        gap: 10px;
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        background: var(--pdc-card-soft);
      }

      .guest-main {
        min-width: 0;
        display: grid;
        grid-template-columns: 12px minmax(0, 1fr) auto;
        gap: 7px;
        align-items: center;
      }

      .guest-bars {
        min-width: 0;
        display: grid;
        gap: 5px;
      }

      .micro-bar {
        display: grid;
        grid-template-columns: 32px minmax(0, 1fr);
        gap: 5px;
        align-items: center;
      }

      .micro-bar span {
        color: var(--pdc-muted);
        font-size: 0.66rem;
        font-weight: 800;
      }

      .empty-state {
        display: grid;
        justify-items: center;
        gap: 8px;
        padding: 36px 16px;
        border: 1px dashed var(--pdc-border);
        border-radius: 8px;
        text-align: center;
      }

      .empty-state div {
        width: 58px;
        height: 58px;
        color: var(--pdc-muted);
      }

      .empty-state p {
        max-width: 420px;
        color: var(--pdc-muted);
      }

      @media (max-width: 520px) {
        .pdc-shell {
          padding: 14px;
        }

        .pdc-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .header-actions,
        .overall,
        .details-toggle {
          width: 100%;
        }

        .header-actions {
          justify-content: stretch;
        }

        .overall,
        .details-toggle {
          justify-content: center;
        }

        .indicator-strip {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .gauge-row {
          gap: 6px;
        }

        .guest-row {
          grid-template-columns: 1fr;
        }
      }
    `;
  }
}

class ProxmoxDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalizeConfig({});
    this._hass = undefined;
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._populateEntityOptions();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="editor">
        <section class="panel">
          <h3>Card</h3>
          ${this._textField("Title", "title", this._config.title || "")}
          <div class="grid two card-options">
            ${this._checkboxField("Show details by default", "show_details", this._config.show_details !== false)}
            ${this._checkboxField("Show details toggle button", "collapsible", this._config.collapsible !== false)}
            ${this._checkboxField("Show statistics by default", "show_statistics", this._config.show_statistics === true)}
            ${this._checkboxField("Show statistics toggle button", "statistics_collapsible", this._config.statistics_collapsible !== false)}
            ${this._numberField("Load/memory alert delay (seconds)", "alert_delay_seconds", this._config.alert_delay_seconds)}
          </div>
        </section>

        <section class="panel">
          <h3>Thresholds</h3>
          <div class="threshold-grid">
            ${Object.keys(DEFAULT_THRESHOLDS)
              .map((key) => this._thresholdFields(key))
              .join("")}
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h3>Nodes</h3>
            <button type="button" data-action="add-node">Add node</button>
          </div>
          ${(this._config.nodes || []).map((node, index) => this._nodeEditor(node, index)).join("")}
        </section>
        <datalist id="pdc-entity-options"></datalist>
      </div>
    `;
    this._attachEvents();
    this._populateEntityOptions();
  }

  _nodeEditor(node, index) {
    return `
      <details class="group" open>
        <summary>
          <span>${html(node.name || `Node ${index + 1}`)}</span>
          <button type="button" data-action="remove-node" data-index="${index}">Remove</button>
        </summary>
        <div class="grid two">
          ${this._textField("Node name", `nodes.${index}.name`, node.name || "")}
          ${this._entityField("Node status", `nodes.${index}.status_entity`, node.status_entity)}
          ${this._entityField("CPU used", `nodes.${index}.cpu_entity`, node.cpu_entity)}
          ${this._entityField("Memory used %", `nodes.${index}.memory_used_percentage_entity`, node.memory_used_percentage_entity)}
          ${this._entityField("Disk used %", `nodes.${index}.disk_used_percentage_entity`, node.disk_used_percentage_entity)}
          ${this._entityField("Temperature", `nodes.${index}.temperature_entity`, node.temperature_entity)}
          ${this._entityField("Memory free", `nodes.${index}.memory_free_entity`, node.memory_free_entity)}
          ${this._entityField("Memory used", `nodes.${index}.memory_used_entity`, node.memory_used_entity)}
          ${this._entityField("VMs running", `nodes.${index}.virtual_machines_running_entity`, node.virtual_machines_running_entity)}
          ${this._entityField("LXCs running", `nodes.${index}.containers_running_entity`, node.containers_running_entity)}
          ${this._entityField("Last boot", `nodes.${index}.last_boot_entity`, node.last_boot_entity)}
          ${this._entityField("Updates", `nodes.${index}.updates_entity`, node.updates_entity)}
          ${this._entityField("Update package status", `nodes.${index}.updates_packages_entity`, node.updates_packages_entity)}
        </div>
        ${this._collectionEditor("Storage", "storage", `nodes.${index}.storages`, node.storages || [], (item, storageIndex) =>
          this._storageEditor(index, item, storageIndex),
        )}
        ${this._collectionEditor("Physical disks", "disk", `nodes.${index}.disks`, node.disks || [], (item, diskIndex) => this._diskEditor(index, item, diskIndex))}
        ${this._collectionEditor("VMs and LXCs", "guest", `nodes.${index}.guests`, node.guests || [], (item, guestIndex) => this._guestEditor(index, item, guestIndex))}
      </details>
    `;
  }

  _collectionEditor(title, action, path, items, renderer) {
    return `
      <div class="collection">
        <div class="collection-header">
          <h4>${html(title)}</h4>
          <button type="button" data-action="add-${action}" data-path="${html(path)}">Add</button>
        </div>
        ${items.length ? items.map(renderer).join("") : `<p class="empty">No ${html(title.toLowerCase())} configured yet.</p>`}
      </div>
    `;
  }

  _storageEditor(nodeIndex, storage, storageIndex) {
    const path = `nodes.${nodeIndex}.storages.${storageIndex}`;
    return `
      <details class="nested">
        <summary>
          <span>${html(storage.name || `Storage ${storageIndex + 1}`)}</span>
          <button type="button" data-action="remove-item" data-path="nodes.${nodeIndex}.storages" data-index="${storageIndex}">Remove</button>
        </summary>
        <div class="grid two">
          ${this._textField("Name", `${path}.name`, storage.name || "")}
          ${this._entityField("Status", `${path}.status_entity`, storage.status_entity)}
          ${this._entityField("Used percentage", `${path}.used_percentage_entity`, storage.used_percentage_entity)}
          ${this._entityField("Used", `${path}.used_entity`, storage.used_entity)}
          ${this._entityField("Free", `${path}.free_entity`, storage.free_entity)}
          ${this._entityField("Total", `${path}.total_entity`, storage.total_entity)}
        </div>
      </details>
    `;
  }

  _diskEditor(nodeIndex, disk, diskIndex) {
    const path = `nodes.${nodeIndex}.disks.${diskIndex}`;
    return `
      <details class="nested">
        <summary>
          <span>${html(disk.name || `Disk ${diskIndex + 1}`)}</span>
          <button type="button" data-action="remove-item" data-path="nodes.${nodeIndex}.disks" data-index="${diskIndex}">Remove</button>
        </summary>
        <div class="grid two">
          ${this._textField("Name", `${path}.name`, disk.name || "")}
          ${this._entityField("Health", `${path}.health_entity`, disk.health_entity)}
          ${this._entityField("Temperature", `${path}.temperature_entity`, disk.temperature_entity)}
          ${this._entityField("Wearout", `${path}.wearout_entity`, disk.wearout_entity)}
          ${this._entityField("Size", `${path}.size_entity`, disk.size_entity)}
          ${this._entityField("Power-on hours", `${path}.power_on_hours_entity`, disk.power_on_hours_entity)}
          ${this._entityField("Power cycles", `${path}.power_cycles_entity`, disk.power_cycles_entity)}
          ${this._entityField("Node", `${path}.node_entity`, disk.node_entity)}
        </div>
      </details>
    `;
  }

  _guestEditor(nodeIndex, guest, guestIndex) {
    const path = `nodes.${nodeIndex}.guests.${guestIndex}`;
    return `
      <details class="nested">
        <summary>
          <span>${html(guest.name || `Guest ${guestIndex + 1}`)}</span>
          <button type="button" data-action="remove-item" data-path="nodes.${nodeIndex}.guests" data-index="${guestIndex}">Remove</button>
        </summary>
        <div class="grid two">
          ${this._textField("Name", `${path}.name`, guest.name || "")}
          ${this._selectField("Type", `${path}.type`, guest.type || "vm", [
            ["vm", "VM"],
            ["lxc", "LXC"],
          ])}
          ${this._entityField("Status", `${path}.status_entity`, guest.status_entity)}
          ${this._entityField("CPU used", `${path}.cpu_entity`, guest.cpu_entity)}
          ${this._entityField("Memory used %", `${path}.memory_used_percentage_entity`, guest.memory_used_percentage_entity)}
          ${this._entityField("Disk used %", `${path}.disk_used_percentage_entity`, guest.disk_used_percentage_entity)}
          ${this._entityField("Uptime", `${path}.uptime_entity`, guest.uptime_entity)}
        </div>
      </details>
    `;
  }

  _thresholdFields(key) {
    const threshold = this._config.thresholds?.[key] || DEFAULT_THRESHOLDS[key];
    const label = key.replace(/_/g, " ");
    return `
      <div class="threshold">
        <strong>${html(label)}</strong>
        ${this._numberField("Warn", `thresholds.${key}.warning`, threshold.warning)}
        ${this._numberField("Critical", `thresholds.${key}.critical`, threshold.critical)}
      </div>
    `;
  }

  _textField(label, path, value) {
    return `
      <label class="field">
        <span>${html(label)}</span>
        <input type="text" data-path="${html(path)}" value="${html(value || "")}" autocomplete="off">
      </label>
    `;
  }

  _numberField(label, path, value) {
    return `
      <label class="field compact">
        <span>${html(label)}</span>
        <input type="number" data-path="${html(path)}" value="${html(value ?? "")}" min="0" step="1">
      </label>
    `;
  }

  _checkboxField(label, path, checked) {
    return `
      <label class="checkbox-field">
        <input type="checkbox" data-path="${html(path)}" ${checked ? "checked" : ""}>
        <span>${html(label)}</span>
      </label>
    `;
  }

  _entityField(label, path, value) {
    return `
      <label class="field">
        <span>${html(label)}</span>
        <input
          class="entity-input"
          type="text"
          list="pdc-entity-options"
          data-path="${html(path)}"
          value="${html(value || "")}"
          placeholder="sensor.example_entity"
          autocomplete="off"
          spellcheck="false"
        >
      </label>
    `;
  }

  _selectField(label, path, value, options) {
    return `
      <label class="field">
        <span>${html(label)}</span>
        <select data-path="${html(path)}">
          ${options.map(([optionValue, optionLabel]) => `<option value="${html(optionValue)}" ${optionValue === value ? "selected" : ""}>${html(optionLabel)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  _attachEvents() {
    this.shadowRoot.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("change", (event) => {
        const target = event.currentTarget;
        const value = target.type === "checkbox" ? target.checked : target.type === "number" ? parseNumber(target.value) : target.value;
        this._updatePath(target.dataset.path, value);
      });
    });

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._handleAction(event.currentTarget);
      });
    });
  }

  _populateEntityOptions() {
    if (!this.shadowRoot || !this._hass?.states) return;
    const datalist = this.shadowRoot.querySelector("#pdc-entity-options");
    if (!datalist) return;

    const entityIds = Object.keys(this._hass.states).sort((a, b) => a.localeCompare(b));
    const signature = entityIds.join("|");
    if (datalist.dataset.signature === signature) return;

    datalist.dataset.signature = signature;
    datalist.innerHTML = entityIds.map((entityId) => `<option value="${html(entityId)}"></option>`).join("");
  }

  _handleAction(button) {
    const action = button.dataset.action;
    const config = structuredClone(this._config);

    if (action === "add-node") {
      config.nodes = [...(config.nodes || []), { ...DEFAULT_NODE, name: `Node ${(config.nodes || []).length + 1}` }];
      this._commit(config);
      return;
    }

    if (action === "remove-node") {
      config.nodes.splice(Number(button.dataset.index), 1);
      this._commit(config);
      return;
    }

    if (action === "add-storage") {
      const list = this._ensureListAtPath(config, button.dataset.path);
      list.push({ ...DEFAULT_STORAGE, name: `Storage ${list.length + 1}` });
      this._commit(config);
      return;
    }

    if (action === "add-disk") {
      const list = this._ensureListAtPath(config, button.dataset.path);
      list.push({ ...DEFAULT_DISK, name: `Disk ${list.length + 1}` });
      this._commit(config);
      return;
    }

    if (action === "add-guest") {
      const list = this._ensureListAtPath(config, button.dataset.path);
      list.push({ ...DEFAULT_GUEST, name: `Guest ${list.length + 1}` });
      this._commit(config);
      return;
    }

    if (action === "remove-item") {
      const list = this._ensureListAtPath(config, button.dataset.path);
      list.splice(Number(button.dataset.index), 1);
      this._commit(config);
    }
  }

  _ensureListAtPath(object, path) {
    const parts = path.split(".");
    let target = object;
    parts.slice(0, -1).forEach((part) => {
      if (target[part] === undefined) target[part] = {};
      target = target[part];
    });
    const key = parts[parts.length - 1];
    if (!Array.isArray(target[key])) target[key] = [];
    return target[key];
  }

  _getAtPath(object, path) {
    return path.split(".").reduce((target, key) => target?.[key], object);
  }

  _updatePath(path, value) {
    const config = structuredClone(this._config);
    const parts = path.split(".");
    let target = config;
    parts.slice(0, -1).forEach((part) => {
      if (target[part] === undefined) target[part] = {};
      target = target[part];
    });
    const key = parts[parts.length - 1];

    if (value === "" || value === undefined || value === null) {
      delete target[key];
    } else {
      target[key] = value;
    }

    this._commit(config);
  }

  _commit(config) {
    this._config = normalizeConfig(this._stripEmpty(config));
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
    this._render();
  }

  _stripEmpty(value) {
    if (Array.isArray(value)) return value.map((item) => this._stripEmpty(item));
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, this._stripEmpty(entry)])
        .filter(([key, entry]) => {
          if (key === "type") return true;
          if (ENTITY_FIELDS.includes(key) && entry === "") return false;
          if (entry === "") return false;
          if (Array.isArray(entry)) return true;
          if (entry && typeof entry === "object") return Object.keys(entry).length > 0;
          return entry !== undefined;
        }),
    );
  }

  _styles() {
    return `
      :host {
        display: block;
        color: var(--primary-text-color, #17202a);
      }

      * {
        box-sizing: border-box;
      }

      .editor {
        display: grid;
        gap: 14px;
      }

      .panel,
      .group,
      .nested,
      .collection {
        border: 1px solid var(--divider-color, rgba(127, 139, 153, 0.28));
        border-radius: 8px;
        background: var(--card-background-color, #ffffff);
      }

      .panel {
        padding: 14px;
      }

      .panel-header,
      .collection-header,
      summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      h3,
      h4 {
        margin: 0;
        letter-spacing: 0;
      }

      h3 {
        font-size: 1rem;
      }

      h4 {
        color: var(--secondary-text-color, #5b6573);
        font-size: 0.82rem;
        text-transform: uppercase;
      }

      .group,
      .nested {
        margin-top: 10px;
        overflow: hidden;
      }

      .nested {
        background: color-mix(in srgb, var(--card-background-color, #fff) 88%, #eef2f6 12%);
      }

      summary {
        padding: 11px 12px;
        cursor: pointer;
        font-weight: 800;
      }

      .grid {
        display: grid;
        gap: 10px;
        padding: 12px;
      }

      .grid.two,
      .threshold-grid {
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      }

      .field {
        display: grid;
        gap: 5px;
      }

      .card-options {
        padding: 12px 0 0;
      }

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 40px;
        color: var(--primary-text-color, #17202a);
        font-weight: 700;
      }

      .checkbox-field input {
        width: 18px;
        height: 18px;
      }

      .field span {
        color: var(--secondary-text-color, #5b6573);
        font-size: 0.76rem;
        font-weight: 700;
      }

      input,
      select,
      .entity-input {
        width: 100%;
      }

      input,
      select {
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid var(--divider-color, rgba(127, 139, 153, 0.35));
        border-radius: 6px;
        color: var(--primary-text-color, #17202a);
        background: var(--card-background-color, #fff);
        font: inherit;
      }

      button {
        min-height: 34px;
        padding: 7px 10px;
        border: 1px solid var(--primary-color, #03a9f4);
        border-radius: 6px;
        color: var(--primary-color, #03a9f4);
        background: transparent;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .threshold-grid {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .threshold {
        display: grid;
        grid-template-columns: 1fr 86px 86px;
        gap: 8px;
        align-items: end;
        padding: 10px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--card-background-color, #fff) 88%, #eef2f6 12%);
      }

      .threshold strong {
        text-transform: capitalize;
      }

      .collection {
        margin: 12px;
        padding: 10px;
      }

      .empty {
        margin: 8px 0 0;
        color: var(--secondary-text-color, #5b6573);
        font-size: 0.86rem;
      }

      @media (max-width: 520px) {
        .threshold {
          grid-template-columns: 1fr;
        }
      }
    `;
  }
}

if (!customElements.get(PROXMOX_DASHBOARD_CARD_TYPE)) {
  customElements.define(PROXMOX_DASHBOARD_CARD_TYPE, ProxmoxDashboardCard);
}

if (!customElements.get("proxmox-dashboard-card-editor")) {
  customElements.define("proxmox-dashboard-card-editor", ProxmoxDashboardCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === PROXMOX_DASHBOARD_CARD_TYPE)) {
  window.customCards.push({
    type: PROXMOX_DASHBOARD_CARD_TYPE,
    name: "Proxmox Dashboard Card",
    description: "Cluster health card for Proxmox nodes, VMs, LXCs, storage, and physical disks.",
    preview: true,
  });
}

console.info(
  `%cPROXMOX-DASHBOARD-CARD%c ${PROXMOX_DASHBOARD_CARD_VERSION}`,
  "color:#28c76f;font-weight:700",
  "color:inherit;font-weight:400",
);
