const PROXMOX_DASHBOARD_CARD_VERSION = "0.1.1";
const PROXMOX_DASHBOARD_CARD_TYPE = "proxmox-dashboard-card";

const DEFAULT_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 75, critical: 90 },
  disk: { warning: 75, critical: 90 },
  storage: { warning: 75, critical: 90 },
  disk_temperature: { warning: 50, critical: 60 },
  wearout: { warning: 60, critical: 85 },
  updates: { warning: 1, critical: 30 },
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
  return {
    ...config,
    title: config.title || "Proxmox Cluster",
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
  if (level === "ok") return "var(--pdc-ok)";
  return "var(--pdc-unknown)";
}

function worstLevel(levels, fallback = "ok") {
  const knownLevels = (levels || []).filter(Boolean);
  if (!knownLevels.length) return fallback;

  return knownLevels.reduce((worst, level) => {
    if (!level) return worst;
    return LEVELS[level] > LEVELS[worst] ? level : worst;
  }, knownLevels[0]);
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

  if (["ok", "online", "running", "healthy", "active", "on", "ready", "available", "true"].includes(state)) {
    return "ok";
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
      "error",
      "failed",
      "failure",
      "offline",
      "down",
      "unhealthy",
      "unavailable",
      "unknown",
      "not ok",
      "false",
      "lost",
    ].includes(state)
  ) {
    return "critical";
  }

  return "unknown";
}

function labelForLevel(level) {
  if (level === "critical") return "Critical";
  if (level === "warn") return "Attention";
  if (level === "ok") return "Nominal";
  return "Unknown";
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
    this._config = normalizeConfig(config);
    this._scheduleRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._scheduleRender();
  }

  getCardSize() {
    const nodes = this._config?.nodes?.length || 1;
    return Math.max(6, Math.min(12, 4 + nodes * 2));
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

  _nodeModel(node) {
    const thresholds = this._config.thresholds;
    const cpu = this._number(node.cpu_entity);
    const memory = this._number(node.memory_used_percentage_entity);
    const disk = this._number(node.disk_used_percentage_entity);
    const temp = this._number(node.temperature_entity);
    const storages = (node.storages || []).map((storage) => this._storageModel(storage));
    const disks = (node.disks || []).map((diskItem) => this._diskModel(diskItem));
    const guests = (node.guests || []).map((guest) => this._guestModel(guest));
    const updates = this._number(node.updates_entity);

    const levels = [];
    if (node.status_entity) levels.push(levelForStatus(this._stateValue(node.status_entity)));
    if (node.cpu_entity) levels.push(levelForValue(cpu, thresholds.cpu));
    if (node.memory_used_percentage_entity) levels.push(levelForValue(memory, thresholds.memory));
    if (node.disk_used_percentage_entity) levels.push(levelForValue(disk, thresholds.disk));
    if (node.temperature_entity) levels.push(levelForValue(temp, thresholds.disk_temperature));
    if (node.updates_entity) levels.push(levelForValue(updates, thresholds.updates));
    if (node.updates_packages_entity) levels.push(levelForStatus(this._stateValue(node.updates_packages_entity)));
    levels.push(...storages.map((storage) => storage.level));
    levels.push(...disks.map((diskItem) => diskItem.level));
    levels.push(...guests.map((guest) => guest.level));

    return {
      raw: node,
      name: node.name || "Node",
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
    };
  }

  _storageModel(storage) {
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

    return {
      raw: storage,
      name: storage.name || "Storage",
      used,
      level: worstLevel(levels, "unknown"),
    };
  }

  _diskModel(disk) {
    const temperature = this._number(disk.temperature_entity);
    const wearout = this._number(disk.wearout_entity);
    const levels = [];
    if (disk.health_entity) levels.push(levelForStatus(this._stateValue(disk.health_entity)));
    if (disk.temperature_entity) levels.push(levelForValue(temperature, this._config.thresholds.disk_temperature));
    if (disk.wearout_entity) levels.push(levelForValue(wearout, this._config.thresholds.wearout));

    return {
      raw: disk,
      name: disk.name || "Disk",
      temperature,
      wearout,
      level: worstLevel(levels, "unknown"),
    };
  }

  _guestModel(guest) {
    const cpu = this._number(guest.cpu_entity);
    const memory = this._number(guest.memory_used_percentage_entity);
    const disk = this._number(guest.disk_used_percentage_entity);
    const levels = [];
    if (guest.status_entity) levels.push(levelForStatus(this._stateValue(guest.status_entity)));
    if (guest.cpu_entity) levels.push(levelForValue(cpu, this._config.thresholds.cpu));
    if (guest.memory_used_percentage_entity) levels.push(levelForValue(memory, this._config.thresholds.memory));
    if (guest.disk_used_percentage_entity) levels.push(levelForValue(disk, this._config.thresholds.disk));

    return {
      raw: guest,
      name: guest.name || "Guest",
      type: guest.type || "vm",
      cpu,
      memory,
      disk,
      level: worstLevel(levels, "unknown"),
    };
  }

  _clusterModel() {
    const nodes = this._config.nodes.map((node) => this._nodeModel(node));
    const allDisks = nodes.flatMap((node) => node.disks);
    const allStorages = nodes.flatMap((node) => node.storages);
    const allGuests = nodes.flatMap((node) => node.guests);
    const loadLevels = nodes.flatMap((node) => [
      Number.isFinite(node.cpu) ? levelForValue(node.cpu, this._config.thresholds.cpu) : undefined,
      Number.isFinite(node.memory) ? levelForValue(node.memory, this._config.thresholds.memory) : undefined,
    ]);
    const temperatureLevels = [
      ...nodes.map((node) => (Number.isFinite(node.temp) ? levelForValue(node.temp, this._config.thresholds.disk_temperature) : undefined)),
      ...allDisks.map((disk) => (Number.isFinite(disk.temperature) ? levelForValue(disk.temperature, this._config.thresholds.disk_temperature) : undefined)),
    ];
    const updateLevels = nodes.flatMap((node) => [
      node.raw.updates_entity ? levelForValue(node.updates, this._config.thresholds.updates) : undefined,
      node.raw.updates_packages_entity ? levelForStatus(this._stateValue(node.raw.updates_packages_entity)) : undefined,
    ]);

    return {
      nodes,
      overall: worstLevel(nodes.map((node) => node.level), "unknown"),
      indicators: [
        { key: "cluster", label: "Cluster", icon: "cluster", level: worstLevel(nodes.map((node) => node.level), "unknown") },
        { key: "nodes", label: "Nodes", icon: "server", level: worstLevel(nodes.map((node) => node.level), "unknown") },
        { key: "guests", label: "VM/LXC", icon: "guest", level: allGuests.length ? worstLevel(allGuests.map((guest) => guest.level)) : "unknown" },
        { key: "load", label: "Load", icon: "gauge", level: worstLevel(loadLevels, "unknown") },
        { key: "memory", label: "Memory", icon: "memory", level: worstLevel(nodes.map((node) => (Number.isFinite(node.memory) ? levelForValue(node.memory, this._config.thresholds.memory) : undefined)), "unknown") },
        { key: "storage", label: "Storage", icon: "storage", level: allStorages.length ? worstLevel(allStorages.map((storage) => storage.level)) : "unknown" },
        { key: "disks", label: "Disks", icon: "disk", level: allDisks.length ? worstLevel(allDisks.map((disk) => disk.level)) : "unknown" },
        { key: "temperature", label: "Temp", icon: "thermometer", level: worstLevel(temperatureLevels, "unknown") },
        { key: "updates", label: "Updates", icon: "updates", level: worstLevel(updateLevels, "unknown") },
      ],
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

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="pdc-card">
        <section class="pdc-shell">
          <header class="pdc-header">
            <div>
              <p class="eyebrow">Proxmox observability</p>
              <h2>${html(this._config.title)}</h2>
            </div>
            <div class="overall overall-${cluster.overall}">
              <span class="pulse"></span>
              <strong>${labelForLevel(cluster.overall)}</strong>
            </div>
          </header>

          ${hasNodes ? this._renderDashboardStrip(cluster) : this._renderEmptyState()}
          ${hasNodes ? this._renderClusterSummary(cluster) : ""}
          ${hasNodes ? `<div class="node-grid">${cluster.nodes.map((node) => this._renderNode(node)).join("")}</div>` : ""}
        </section>
      </ha-card>
    `;
  }

  _renderDashboardStrip(cluster) {
    return `
      <section class="indicator-strip" aria-label="Proxmox health indicators">
        ${cluster.indicators
          .map(
            (item) => `
              <div class="indicator indicator-${item.level}" title="${html(item.label)}: ${labelForLevel(item.level)}" aria-label="${html(item.label)} ${labelForLevel(item.level)}">
                <div class="indicator-icon">${icon(item.icon)}</div>
                <span>${html(item.label)}</span>
              </div>
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
        border-radius: 6px;
        background: color-mix(in srgb, currentColor 7%, transparent);
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
      }

      .node-card {
        min-width: 0;
        display: grid;
        gap: 13px;
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

        .overall {
          width: 100%;
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
        const value = target.type === "number" ? parseNumber(target.value) : target.value;
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
