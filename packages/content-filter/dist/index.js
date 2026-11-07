'use strict';

// src/normalize.ts
function normalizeTag(raw) {
  return String(raw ?? "").trim().replace(/^#+/, "").trim().toLowerCase();
}
function normalizeApp(raw) {
  return String(raw ?? "").split("/")[0].trim().toLowerCase();
}
function parseMetadata(jsonMetadata) {
  if (!jsonMetadata) return {};
  if (typeof jsonMetadata === "object") return jsonMetadata;
  try {
    const parsed = JSON.parse(jsonMetadata);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
var BODY_HASHTAG = /(?:^|[^\w/&#])#([a-z][\w-]{0,63})/gi;
function extractBodyHashtags(body) {
  if (!body) return [];
  const out = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(BODY_HASHTAG)) out.add(m[1].toLowerCase());
  return [...out];
}
function extractSignals(item) {
  const meta = parseMetadata(item.json_metadata);
  const tags = /* @__PURE__ */ new Set();
  if (Array.isArray(meta.tags)) {
    for (const t of meta.tags) {
      const n = normalizeTag(t);
      if (n) tags.add(n);
    }
  }
  for (const t of extractBodyHashtags(item.body)) tags.add(t);
  return { app: normalizeApp(meta.app), tags };
}

// src/presets.ts
var GAMES_PRESET = {
  id: "games",
  label: "Hide game results",
  description: "Scores, streaks and recaps auto-posted by games like HiveWord, HiveGrove, Scroddle and HiveSuite.",
  rules: [
    { kind: "app", app: "hivegrove" },
    { kind: "app", app: "mydempire" },
    { kind: "app", app: "hiveword" },
    { kind: "tag", tag: "hivegrove" },
    { kind: "tag", tag: "mydempire" },
    { kind: "tag", tag: "hiveword" },
    { kind: "tag", tag: "scroddle" },
    { kind: "tag", tag: "holohover" },
    { kind: "tag", tag: "holovortex" },
    { kind: "tag", tag: "hologoal" },
    { kind: "app_tag", app: "hivesuite", tag: "hivegaming" },
    { kind: "app_tag", app: "hivesuite", tag: "scratchcard" },
    { kind: "app_tag", app: "hivesuite", tag: "dailyrewards" },
    { kind: "app_tag", app: "zingit", tag: "pinnacle" }
  ]
};
var DEFAULT_PRESETS = {
  [GAMES_PRESET.id]: GAMES_PRESET
};

// src/matcher.ts
function effectiveRules(prefs, catalog = DEFAULT_PRESETS) {
  const out = [...prefs.rules];
  for (const id of prefs.presets) {
    const preset = catalog[id];
    if (preset) out.push(...preset.rules);
  }
  return out;
}
function compileFilter(rules) {
  const tags = /* @__PURE__ */ new Set();
  const apps = /* @__PURE__ */ new Set();
  const appTags = /* @__PURE__ */ new Map();
  for (const r of rules) {
    if (r.kind === "tag") {
      const t = normalizeTag(r.tag);
      if (t) tags.add(t);
    } else if (r.kind === "app") {
      const a = normalizeApp(r.app);
      if (a) apps.add(a);
    } else if (r.kind === "app_tag") {
      const a = normalizeApp(r.app);
      const t = normalizeTag(r.tag);
      if (!a || !t) continue;
      let set = appTags.get(a);
      if (!set) appTags.set(a, set = /* @__PURE__ */ new Set());
      set.add(t);
    }
  }
  if (tags.size === 0 && apps.size === 0 && appTags.size === 0) return () => false;
  return (item) => {
    if (!item) return false;
    const { app, tags: itemTags } = extractSignals(item);
    if (app && apps.has(app)) return true;
    const scoped = app ? appTags.get(app) : void 0;
    for (const t of itemTags) {
      if (tags.has(t)) return true;
      if (scoped?.has(t)) return true;
    }
    return false;
  };
}
function createContentFilter(prefs, catalog = DEFAULT_PRESETS) {
  return compileFilter(effectiveRules(prefs, catalog));
}

// src/prefs.ts
var MAX_RULES = 500;
var MAX_FIELD = 64;
var PRESET_ID = /^[a-z0-9_-]{1,32}$/;
var SAFE_TEXT = /^[^\u0000-\u001f\u007f]+$/;
function emptyPrefs() {
  return { v: 1, rules: [], presets: [], updatedAt: 0 };
}
function ruleKey(r) {
  if (r.kind === "tag") return `tag:${r.tag}`;
  if (r.kind === "app") return `app:${r.app}`;
  return `app_tag:${r.app}:${r.tag}`;
}
function cleanField(raw, normalize) {
  if (typeof raw !== "string") return null;
  const v = normalize(raw);
  if (!v || v.length > MAX_FIELD || !SAFE_TEXT.test(v)) return null;
  return v;
}
function sanitizeRule(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (r.kind === "tag") {
    const tag = cleanField(r.tag, normalizeTag);
    return tag ? { kind: "tag", tag } : null;
  }
  if (r.kind === "app") {
    const app = cleanField(r.app, normalizeApp);
    return app ? { kind: "app", app } : null;
  }
  if (r.kind === "app_tag") {
    const app = cleanField(r.app, normalizeApp);
    const tag = cleanField(r.tag, normalizeTag);
    return app && tag ? { kind: "app_tag", app, tag } : null;
  }
  return null;
}
function dedupeRules(rules) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const r of rules) {
    const k = ruleKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out.slice(0, MAX_RULES);
}
function sanitizePrefs(raw) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw;
  if (!Array.isArray(p.rules) || !Array.isArray(p.presets)) return null;
  const rules = dedupeRules(p.rules.map(sanitizeRule).filter((r) => r !== null));
  const presets = [...new Set(p.presets.filter((id) => typeof id === "string" && PRESET_ID.test(id)))];
  const updatedAt = typeof p.updatedAt === "number" && Number.isFinite(p.updatedAt) && p.updatedAt >= 0 ? p.updatedAt : 0;
  return { v: 1, rules, presets, updatedAt };
}
function fromLegacyTags(tags, now = Date.now()) {
  const list = Array.isArray(tags) ? tags : [];
  const rules = dedupeRules(
    list.map((t) => sanitizeRule({ kind: "tag", tag: t })).filter((r) => r !== null)
  );
  return { v: 1, rules, presets: [], updatedAt: rules.length ? now : 0 };
}
function hasRule(prefs, rule) {
  const k = ruleKey(rule);
  return prefs.rules.some((r) => ruleKey(r) === k);
}
function addRule(prefs, raw, now = Date.now()) {
  const rule = sanitizeRule(raw);
  if (!rule || hasRule(prefs, rule) || prefs.rules.length >= MAX_RULES) return prefs;
  return { ...prefs, rules: [...prefs.rules, rule], updatedAt: now };
}
function removeRule(prefs, raw, now = Date.now()) {
  const rule = sanitizeRule(raw);
  if (!rule) return prefs;
  const k = ruleKey(rule);
  const rules = prefs.rules.filter((r) => ruleKey(r) !== k);
  return rules.length === prefs.rules.length ? prefs : { ...prefs, rules, updatedAt: now };
}
function setPreset(prefs, id, enabled, now = Date.now()) {
  if (!PRESET_ID.test(id)) return prefs;
  const has = prefs.presets.includes(id);
  if (has === enabled) return prefs;
  const presets = enabled ? [...prefs.presets, id] : prefs.presets.filter((p) => p !== id);
  return { ...prefs, presets, updatedAt: now };
}
function prefsFingerprint(prefs) {
  const rules = prefs.rules.map(ruleKey).sort();
  const presets = [...prefs.presets].sort();
  return JSON.stringify([presets, rules]);
}
function samePrefs(a, b) {
  return prefsFingerprint(a) === prefsFingerprint(b);
}
function mergePrefs(local, remote, opts) {
  if (!remote) return local;
  if (opts.firstSync) {
    return {
      v: 1,
      rules: dedupeRules([...remote.rules, ...local.rules]),
      presets: [.../* @__PURE__ */ new Set([...remote.presets, ...local.presets])],
      updatedAt: Math.max(local.updatedAt, remote.updatedAt)
    };
  }
  return local.updatedAt > remote.updatedAt ? local : remote;
}
var GENERIC_TAGS = /* @__PURE__ */ new Set(["snaps", "hivesnaps", "waves", "hive", "snapie", "leofinance", "neoxian", "peakd", "ecency"]);
var GENERAL_CLIENTS = /* @__PURE__ */ new Set([
  "snapie",
  "hivesnaps",
  "peakd",
  "ecency",
  "hiveblog",
  "hive.blog",
  "leofinance",
  "inleo",
  "waves",
  "3speak",
  "mycommunity-mobile",
  "actifit",
  "liketu",
  "stemgeeks",
  "sportsblock",
  "skatehive app 3.0",
  "skatehive",
  "hivesigner",
  "condenser",
  "steemit",
  "esteem",
  "flexus"
]);
function suggestRules(item, opts = {}) {
  const signals = extractSignals(item);
  const tags = signals.tags;
  const app = GENERAL_CLIENTS.has(signals.app) ? "" : signals.app;
  const maxTags = opts.maxTags ?? 4;
  const specific = [...tags].filter((t) => !GENERIC_TAGS.has(t) && !/^hive-\d+$/.test(t) && t !== app).slice(0, maxTags);
  const out = [];
  if (app) out.push({ rule: { kind: "app", app }, label: `Everything from ${app}` });
  for (const tag of specific) out.push({ rule: { kind: "tag", tag }, label: `#${tag}` });
  if (app) {
    for (const tag of specific) out.push({ rule: { kind: "app_tag", app, tag }, label: `#${tag} from ${app}` });
  }
  return out;
}
function describeRule(r) {
  if (r.kind === "tag") return `#${r.tag}`;
  if (r.kind === "app") return `App: ${r.app}`;
  return `#${r.tag} from ${r.app}`;
}

// src/api.ts
var CONTENT_FILTER_PATHS = {
  prefs: "/api/user/content-filters",
  presets: "/api/content-filters/presets"
};
function createContentFilterRemote(request) {
  return {
    async load() {
      const res = await request(CONTENT_FILTER_PATHS.prefs, { method: "GET" });
      if (!res) throw new Error("content-filter: not authenticated");
      if (!res.ok) throw new Error(`content-filter: load failed (${res.status})`);
      const body = await res.json();
      return body.prefs ? sanitizePrefs(body.prefs) : null;
    },
    async save(prefs) {
      const res = await request(CONTENT_FILTER_PATHS.prefs, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs })
      });
      if (!res) throw new Error("content-filter: not authenticated");
      if (!res.ok) throw new Error(`content-filter: save failed (${res.status})`);
      const body = await res.json().catch(() => ({}));
      return body.applied === false && body.prefs ? sanitizePrefs(body.prefs) : null;
    }
  };
}
function sanitizeCatalog(raw) {
  if (!raw || typeof raw !== "object") return null;
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  const out = {};
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const { id, label, description, rules } = p;
    if (typeof id !== "string" || typeof label !== "string" || !Array.isArray(rules)) continue;
    out[id] = {
      id,
      label,
      description: typeof description === "string" ? description : "",
      rules: rules.map(sanitizeRule).filter((r) => r !== null)
    };
  }
  return Object.keys(out).length ? out : null;
}
async function fetchPresetCatalog(baseUrl = "", fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${baseUrl}${CONTENT_FILTER_PATHS.presets}`);
    if (!res.ok) return null;
    const body = await res.json();
    return sanitizeCatalog(body.presets);
  } catch {
    return null;
  }
}

// src/store.ts
function createContentFilterStore(opts) {
  const key = opts.storageKey ?? "snapie_content_filters";
  const saveDelay = opts.saveDelayMs ?? 800;
  const onError = opts.onError ?? (() => {
  });
  let syncedFor = null;
  let remote = null;
  let saveTimer = null;
  let hydratePromise = null;
  let syncGen = 0;
  const listeners = /* @__PURE__ */ new Set();
  const build = (prefs, catalog, patch = {}) => ({
    ...state,
    ...patch,
    prefs,
    catalog,
    filter: createContentFilter(prefs, catalog),
    fingerprint: prefsFingerprint(prefs)
  });
  const initialCatalog = opts.catalog ?? DEFAULT_PRESETS;
  let state = {
    prefs: emptyPrefs(),
    catalog: initialCatalog,
    filter: () => false,
    fingerprint: prefsFingerprint(emptyPrefs()),
    hydrated: false,
    syncUser: null
  };
  const serverState = state;
  const emit = () => listeners.forEach((l) => l());
  const set = (next) => {
    if (next.fingerprint === state.fingerprint && next.catalog === state.catalog && next.hydrated === state.hydrated && next.syncUser === state.syncUser && next.prefs.updatedAt === state.prefs.updatedAt) return;
    state = next;
    emit();
  };
  const persist = async () => {
    const body = { prefs: state.prefs, syncedFor };
    try {
      await opts.storage.setItem(key, JSON.stringify(body));
    } catch (err) {
      onError(err);
    }
  };
  const pushNow = async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!remote || !state.syncUser) return;
    const user = state.syncUser;
    try {
      const newer = await remote.save(state.prefs);
      if (state.syncUser === user) {
        syncedFor = user;
        if (newer) set(build(newer, state.catalog));
        await persist();
      }
    } catch (err) {
      onError(err);
    }
  };
  const schedulePush = () => {
    if (!remote || !state.syncUser) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void pushNow();
    }, saveDelay);
  };
  const mutate = (fn) => {
    const next = fn(state.prefs);
    if (next === state.prefs) return;
    set(build(next, state.catalog));
    void persist();
    schedulePush();
  };
  const hydrate = () => {
    if (!hydratePromise) {
      hydratePromise = (async () => {
        let prefs = null;
        try {
          const raw = await opts.storage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            prefs = sanitizePrefs(parsed.prefs);
            syncedFor = typeof parsed.syncedFor === "string" ? parsed.syncedFor : null;
          }
        } catch (err) {
          onError(err);
        }
        if (!prefs && opts.readLegacyTags) {
          try {
            prefs = fromLegacyTags(await opts.readLegacyTags());
          } catch (err) {
            onError(err);
          }
        }
        const base = prefs ?? emptyPrefs();
        const merged = state.prefs.updatedAt > base.updatedAt ? state.prefs : base;
        set(build(merged, state.catalog, { hydrated: true }));
        if (prefs || merged !== base) void persist();
      })();
    }
    return hydratePromise;
  };
  const setSyncUser = async (username, nextRemote = null) => {
    const user = username ? username.toLowerCase() : null;
    const gen = ++syncGen;
    if (saveTimer) await pushNow();
    remote = user ? nextRemote : null;
    set({ ...state, syncUser: user && remote ? user : null });
    if (!user || !remote) return;
    await hydrate();
    let server;
    try {
      server = await remote.load();
    } catch (err) {
      onError(err);
      return;
    }
    if (gen !== syncGen) return;
    let merged;
    if (!server) {
      merged = state.prefs;
    } else if (syncedFor === null) {
      merged = mergePrefs(state.prefs, server, { firstSync: true });
    } else if (syncedFor !== user) {
      merged = server;
    } else {
      merged = mergePrefs(state.prefs, server, { firstSync: false });
    }
    set(build(merged, state.catalog));
    const needsUpload = !server || !samePrefs(merged, server) || merged.updatedAt !== server.updatedAt;
    if (needsUpload) {
      await pushNow();
    } else {
      syncedFor = user;
      await persist();
    }
  };
  return {
    getState: () => state,
    getServerState: () => serverState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate,
    setSyncUser,
    setCatalog(catalog) {
      set(build(state.prefs, catalog));
    },
    addRule: (rule) => mutate((p) => addRule(p, rule)),
    removeRule: (rule) => mutate((p) => removeRule(p, rule)),
    setPreset: (id, enabled) => mutate((p) => setPreset(p, id, enabled)),
    flush: pushNow
  };
}

exports.CONTENT_FILTER_PATHS = CONTENT_FILTER_PATHS;
exports.DEFAULT_PRESETS = DEFAULT_PRESETS;
exports.GAMES_PRESET = GAMES_PRESET;
exports.GENERAL_CLIENTS = GENERAL_CLIENTS;
exports.MAX_RULES = MAX_RULES;
exports.addRule = addRule;
exports.compileFilter = compileFilter;
exports.createContentFilter = createContentFilter;
exports.createContentFilterRemote = createContentFilterRemote;
exports.createContentFilterStore = createContentFilterStore;
exports.describeRule = describeRule;
exports.effectiveRules = effectiveRules;
exports.emptyPrefs = emptyPrefs;
exports.extractBodyHashtags = extractBodyHashtags;
exports.extractSignals = extractSignals;
exports.fetchPresetCatalog = fetchPresetCatalog;
exports.fromLegacyTags = fromLegacyTags;
exports.hasRule = hasRule;
exports.mergePrefs = mergePrefs;
exports.normalizeApp = normalizeApp;
exports.normalizeTag = normalizeTag;
exports.parseMetadata = parseMetadata;
exports.prefsFingerprint = prefsFingerprint;
exports.removeRule = removeRule;
exports.ruleKey = ruleKey;
exports.samePrefs = samePrefs;
exports.sanitizeCatalog = sanitizeCatalog;
exports.sanitizePrefs = sanitizePrefs;
exports.sanitizeRule = sanitizeRule;
exports.setPreset = setPreset;
exports.suggestRules = suggestRules;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map