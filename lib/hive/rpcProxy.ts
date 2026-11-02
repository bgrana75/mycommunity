/**
 * Server-side Hive RPC proxy: one node at a time, failing over only when
 * the node itself is unhealthy. JSON-RPC application errors are the caller's
 * result and are returned as-is. The one exception to "one node" is
 * bridge.unread_notifications, which is cross-checked against a second node
 * because a lagging node reports a stale (inflated) unread count.
 */

const BEACON_URL = 'https://beacon.peakd.com/api/nodes'
const BEACON_TIMEOUT_MS = 4000
const MIN_SCORE = 80
const NODE_CACHE_TTL_MS = 5 * 60 * 1000

/** Per-attempt budget. Transport failures return immediately; a hung socket waits this long. */
export const ATTEMPT_TIMEOUT_MS = 8000
/**
 * Budget for the unread_notifications second opinion. It shares the caller's
 * batch, which aborts well before a full extra attempt, so this stays short.
 */
export const CROSS_CHECK_TIMEOUT_MS = 3000
/** Skip a node that just failed so the next call does not start on it. */
export const FAILURE_COOLDOWN_MS = 60_000
const MAX_NODES_PER_CALL = 6
/** Extra nodes tried to get a second opinion on unread_notifications. */
const MAX_CROSS_CHECK_ATTEMPTS = 2

const EXCLUDED_HOSTS = ['api.deathwing.me']
// Live again (HTTP 200) but beacon score stays under MIN_SCORE and it has
// been flaky. Eligible only after healthier nodes, unless it was the last
// node that actually succeeded.
const DEMOTED_HOSTS = ['techcoderx.com']

export const FALLBACK_NODES = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.mahdiyari.info',
  'https://api.c0ff33a.uk',
  'https://api.syncad.com',
  // hapi.ecency.com is omitted: the name does not resolve, and beacon scores it 0.
  'https://techcoderx.com',
]

export const ALL_NODES_UNREACHABLE = {
  jsonrpc: '2.0',
  error: { code: -32603, message: 'All Hive nodes unreachable' },
  id: null,
}

type BeaconNode = { endpoint?: string; score?: number }

let nodeCache: { nodes: string[]; at: number } | null = null
let lastSuccessNode: string | null = null
const cooldownUntil = new Map<string, number>()

export function resetRpcProxyState(): void {
  nodeCache = null
  lastSuccessNode = null
  cooldownUntil.clear()
}

function hostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname
  } catch {
    return ''
  }
}

function isExcluded(endpoint: string): boolean {
  return EXCLUDED_HOSTS.some((host) => endpoint.includes(host))
}

function isDemoted(endpoint: string): boolean {
  const host = hostname(endpoint)
  return DEMOTED_HOSTS.some((demoted) => host === demoted)
}

/** Healthy nodes first; demoted hosts stay in the list but never lead it. */
function demoteNodes(nodes: string[]): string[] {
  const primary: string[] = []
  const demoted: string[] = []
  for (const node of nodes) {
    if (isDemoted(node)) demoted.push(node)
    else primary.push(node)
  }
  return [...primary, ...demoted]
}

export function selectBeaconNodes(data: unknown): string[] | null {
  if (!Array.isArray(data)) return null
  const nodes = (data as BeaconNode[])
    .filter(
      (n): n is { endpoint: string; score: number } =>
        typeof n.score === 'number' &&
        n.score >= MIN_SCORE &&
        typeof n.endpoint === 'string' &&
        n.endpoint.length > 0 &&
        !isExcluded(n.endpoint)
    )
    .sort((a, b) => b.score - a.score)
    .map((n) => n.endpoint.trim())

  const ordered = demoteNodes(nodes)
  return ordered.length >= 2 ? ordered : null
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function getHiveRpcNodes(fetchImpl: FetchLike = fetch): Promise<string[]> {
  if (nodeCache && Date.now() - nodeCache.at < NODE_CACHE_TTL_MS) {
    return nodeCache.nodes
  }
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      BEACON_URL,
      { method: 'GET' },
      BEACON_TIMEOUT_MS,
    )
    if (res.ok) {
      const data: unknown = await res.json()
      const nodes = selectBeaconNodes(data)
      if (nodes) {
        nodeCache = { nodes, at: Date.now() }
        return nodes
      }
    }
  } catch {
    /* fall through to the hardcoded list */
  }
  return demoteNodes(FALLBACK_NODES)
}

function noteSuccess(node: string): void {
  lastSuccessNode = node
  cooldownUntil.delete(node)
}

function noteFailure(node: string, now: number): void {
  cooldownUntil.set(node, now + FAILURE_COOLDOWN_MS)
  if (lastSuccessNode === node) lastSuccessNode = null
}

/** Last success first, then the configured order, skipping nodes still in cooldown. */
function orderNodesForAttempt(nodes: string[], now: number): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const raw of nodes) {
    if (typeof raw !== 'string') continue
    const node = raw.trim()
    if (!node || seen.has(node)) continue
    seen.add(node)
    unique.push(node)
  }

  const ready = unique.filter((node) => (cooldownUntil.get(node) ?? 0) <= now)
  const pool = ready.length > 0 ? ready : unique
  const preferred = lastSuccessNode
  const ordered =
    preferred && pool.includes(preferred)
      ? [preferred, ...pool.filter((node) => node !== preferred)]
      : pool
  return ordered.slice(0, MAX_NODES_PER_CALL)
}

function isJsonRpcApplicationError(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const error = (data as { error?: unknown }).error
  if (!error || typeof error !== 'object') return false
  return typeof (error as { code?: unknown }).code === 'number'
}

export type RpcDispatchResult = { ok: true; data: unknown } | { ok: false }

export type DispatchOptions = {
  fetchImpl?: FetchLike
  timeoutMs?: number
  now?: () => number
}

/**
 * One attempt against one node. Marks the node failed (cooldown) on transport
 * errors, timeouts, HTTP 5xx and unparseable bodies. Success bookkeeping is left
 * to the caller so a cross-check call cannot change which node leads.
 */
async function attemptNode(
  node: string,
  payload: unknown,
  fetchImpl: FetchLike,
  timeoutMs: number,
  now: () => number,
): Promise<RpcDispatchResult> {
  try {
    const res = await fetchWithTimeout(
      fetchImpl,
      node,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      timeoutMs,
    )

    if (res.status >= 500) {
      await res.body?.cancel().catch(() => undefined)
      noteFailure(node, now())
      return { ok: false }
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      noteFailure(node, now())
      return { ok: false }
    }

    if (res.ok || isJsonRpcApplicationError(data)) return { ok: true, data }

    noteFailure(node, now())
    return { ok: false }
  } catch {
    noteFailure(node, now())
    return { ok: false }
  }
}

type RpcItem = Record<string, unknown>
type UnreadState = { lastread?: unknown; unread?: unknown }

/** `bridge.unread_notifications`, in either JSON-RPC shape a client may send. */
function isUnreadNotificationsCall(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const { method, params } = item as RpcItem
  if (method === 'bridge.unread_notifications') return true
  return (
    method === 'call' &&
    Array.isArray(params) &&
    params[0] === 'bridge' &&
    params[1] === 'unread_notifications'
  )
}

function unreadResult(item: unknown): UnreadState | null {
  if (!item || typeof item !== 'object') return null
  const result = (item as RpcItem).result
  if (!result || typeof result !== 'object') return null
  return result as UnreadState
}

function hiveTime(value: unknown): number {
  if (typeof value !== 'string') return NaN
  // Hive timestamps carry no zone and are UTC.
  return Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`)
}

/**
 * Choose between two nodes' answers to the same unread_notifications call.
 * A node whose notification index lags reports an older `lastread` and so a
 * much larger `unread` (the bell showing 99+ after "mark all read"). The newer
 * `lastread` wins; on a tie the smaller count does. Returns `first` when the
 * answers cannot be compared.
 */
export function pickFreshestUnreadItem(first: unknown, second: unknown): unknown {
  const a = unreadResult(first)
  const b = unreadResult(second)
  if (!a) return b ? second : first
  if (!b) return first

  const aTime = hiveTime(a.lastread)
  const bTime = hiveTime(b.lastread)
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return bTime > aTime ? second : first
  }
  if (typeof a.unread === 'number' && typeof b.unread === 'number' && b.unread < a.unread) {
    return second
  }
  return first
}

/**
 * Ask later nodes for just the unread_notifications calls in `body` and keep
 * the fresher answer for each. Nodes this call already tried (they timed out
 * or 5xx'd before one answered) are not asked again, and neither is a node
 * still in cooldown. A single node's stale answer is otherwise the app's
 * truth, because the proxy sticks to the last node that succeeded.
 * Best effort, on CROSS_CHECK_TIMEOUT_MS: with no later node reachable the
 * first answer is returned.
 */
async function crossCheckUnreadNotifications(
  body: unknown,
  data: unknown,
  answeredBy: string,
  candidates: string[],
  fetchImpl: FetchLike,
  now: () => number,
): Promise<unknown> {
  const isBatch = Array.isArray(body)
  const requests: unknown[] = isBatch ? body : [body]
  const checks = requests.filter(isUnreadNotificationsCall)
  if (checks.length === 0) return data
  if (isBatch !== Array.isArray(data)) return data

  const payload = isBatch ? checks : checks[0]
  const answeredAt = candidates.indexOf(answeredBy)
  const at = now()
  const others = (answeredAt === -1 ? [] : candidates.slice(answeredAt + 1))
    .filter((node) => (cooldownUntil.get(node) ?? 0) <= at)
    .slice(0, MAX_CROSS_CHECK_ATTEMPTS)
  for (const node of others) {
    const outcome = await attemptNode(node, payload, fetchImpl, CROSS_CHECK_TIMEOUT_MS, now)
    if (!outcome.ok) continue

    const otherItems: unknown[] = Array.isArray(outcome.data) ? outcome.data : [outcome.data]
    const otherById = new Map<unknown, unknown>()
    for (const item of otherItems) {
      if (item && typeof item === 'object') otherById.set((item as RpcItem).id, item)
    }

    if (!isBatch) return pickFreshestUnreadItem(data, otherItems[0])

    const checkIds = new Set(checks.map((check) => (check as RpcItem).id))
    return (data as unknown[]).map((item) => {
      const id = item && typeof item === 'object' ? (item as RpcItem).id : undefined
      if (!checkIds.has(id) || !otherById.has(id)) return item
      return pickFreshestUnreadItem(item, otherById.get(id))
    })
  }
  return data
}

/**
 * POST `body` to one node at a time. Fail over on transport errors, timeouts,
 * and HTTP 5xx. A JSON-RPC error object (the node understood the call and
 * rejected it) is returned unchanged. Calls to `bridge.unread_notifications`
 * are cross-checked against a second node (see crossCheckUnreadNotifications).
 */
export async function dispatchHiveRpc(
  body: unknown,
  nodes: string[],
  options: DispatchOptions = {},
): Promise<RpcDispatchResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? ATTEMPT_TIMEOUT_MS
  const now = options.now ?? Date.now
  const candidates = orderNodesForAttempt(nodes, now())

  for (const node of candidates) {
    const outcome = await attemptNode(node, body, fetchImpl, timeoutMs, now)
    if (!outcome.ok) continue

    noteSuccess(node)
    const data = await crossCheckUnreadNotifications(
      body,
      outcome.data,
      node,
      candidates,
      fetchImpl,
      now,
    )
    return { ok: true, data }
  }

  return { ok: false }
}
