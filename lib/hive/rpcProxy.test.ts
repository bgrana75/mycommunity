import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  ATTEMPT_TIMEOUT_MS,
  CROSS_CHECK_TIMEOUT_MS,
  FAILURE_COOLDOWN_MS,
  FALLBACK_NODES,
  dispatchHiveRpc,
  getHiveRpcNodes,
  resetRpcProxyState,
  selectBeaconNodes,
} from './rpcProxy'
import { POST } from '@/app/api/hive-rpc/route'

const body = { jsonrpc: '2.0', method: 'condenser_api.get_dynamic_global_properties', params: [], id: 1 }
const A = 'https://nodes.test/a'
const B = 'https://nodes.test/b'
const C = 'https://nodes.test/c'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  resetRpcProxyState()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('dispatchHiveRpc', () => {
  it('fails over in order, then prefers the node that succeeded and skips nodes in cooldown', async () => {
    const calls: string[] = []
    let now = 1_000_000
    const mode = new Map<string, 'throw' | '500' | 'ok'>([
      [A, 'throw'],
      [B, '500'],
      [C, 'ok'],
    ])

    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      const behavior = mode.get(url)
      if (behavior === 'throw') throw new TypeError('fetch failed')
      if (behavior === '500') return jsonResponse({ error: 'down' }, 500)
      return jsonResponse({ jsonrpc: '2.0', result: { ok: true }, id: 1 })
    })

    const first = await dispatchHiveRpc(body, [A, B, C], { fetchImpl, now: () => now })
    expect(first).toEqual({ ok: true, data: { jsonrpc: '2.0', result: { ok: true }, id: 1 } })
    expect(calls).toEqual([A, B, C])

    calls.length = 0
    mode.set(A, 'ok')
    mode.set(B, 'ok')
    now += 1_000
    const second = await dispatchHiveRpc(body, [A, B, C], { fetchImpl, now: () => now })
    expect(second.ok).toBe(true)
    expect(calls).toEqual([C])

    calls.length = 0
    mode.set(C, '500')
    now += FAILURE_COOLDOWN_MS
    const third = await dispatchHiveRpc(body, [A, B, C], { fetchImpl, now: () => now })
    expect(third.ok).toBe(true)
    expect(calls).toEqual([C, A])
  })

  it('returns a JSON-RPC application error without trying the next node', async () => {
    const calls: string[] = []
    const errorBody = { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params' }, id: 1 }
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      if (url === A) return jsonResponse(errorBody, 200)
      throw new Error(`unexpected call to ${url}`)
    })

    const outcome = await dispatchHiveRpc(body, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: errorBody })
    expect(calls).toEqual([A])

    calls.length = 0
    const again = await dispatchHiveRpc(body, [A, B], { fetchImpl })
    expect(again).toEqual({ ok: true, data: errorBody })
    expect(calls).toEqual([A])
  })

  it('returns an HTTP 400 JSON-RPC error body without failing over', async () => {
    const calls: string[] = []
    const errorBody = { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: 1 }
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      return jsonResponse(errorBody, 400)
    })

    const outcome = await dispatchHiveRpc(body, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: errorBody })
    expect(calls).toEqual([A])
  })

  it('does not treat an HTTP 5xx JSON-RPC body as an application error', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      if (url === A) {
        return jsonResponse(
          { jsonrpc: '2.0', error: { code: -32603, message: 'internal' }, id: 1 },
          500,
        )
      }
      return jsonResponse({ jsonrpc: '2.0', result: 1, id: 1 })
    })

    const outcome = await dispatchHiveRpc(body, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: { jsonrpc: '2.0', result: 1, id: 1 } })
    expect(calls).toEqual([A, B])
  })

  it('fails over only after the per-attempt timeout when a node never answers', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      calls.push(url)
      if (url === A) {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          const abort = () => {
            const error = new Error('The operation was aborted')
            error.name = 'AbortError'
            reject(error)
          }
          if (!signal) return
          if (signal.aborted) abort()
          else signal.addEventListener('abort', abort)
        })
      }
      return Promise.resolve(jsonResponse({ jsonrpc: '2.0', result: 'from-b', id: 1 }))
    })

    const pending = dispatchHiveRpc(body, [A, B], {
      fetchImpl,
      timeoutMs: ATTEMPT_TIMEOUT_MS,
    })

    await vi.advanceTimersByTimeAsync(ATTEMPT_TIMEOUT_MS - 1)
    expect(calls).toEqual([A])

    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({
      ok: true,
      data: { jsonrpc: '2.0', result: 'from-b', id: 1 },
    })
    expect(calls).toEqual([A, B])
  })
})

describe('unread_notifications cross-check', () => {
  const unreadCall = {
    jsonrpc: '2.0',
    method: 'bridge.unread_notifications',
    params: { account: 'alice' },
    id: 1,
  }
  const reply = (id: number, lastread: string, unread: number) => ({
    jsonrpc: '2.0',
    id,
    result: { lastread, unread },
  })
  const STALE = reply(1, '2026-01-01T00:00:00', 100)
  const FRESH = reply(1, '2026-10-30T12:00:00', 2)

  function nodesReturning(answers: Record<string, unknown>, calls: string[] = []) {
    return vi.fn(async (url: string) => {
      calls.push(url)
      const answer = answers[url]
      if (answer === undefined) throw new TypeError('fetch failed')
      return jsonResponse(answer)
    })
  }

  it('prefers the newer lastread when the leading node is stale', async () => {
    const fetchImpl = nodesReturning({ [A]: STALE, [B]: FRESH })
    const outcome = await dispatchHiveRpc(unreadCall, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: FRESH })
  })

  it('keeps the leading answer when the second node is the stale one', async () => {
    const fetchImpl = nodesReturning({ [A]: FRESH, [B]: STALE })
    const outcome = await dispatchHiveRpc(unreadCall, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: FRESH })
  })

  it('takes the smaller count when both nodes report the same lastread', async () => {
    const fetchImpl = nodesReturning({
      [A]: reply(1, '2026-10-30T12:00:00', 7),
      [B]: reply(1, '2026-10-30T12:00:00', 3),
    })
    const outcome = await dispatchHiveRpc(unreadCall, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: reply(1, '2026-10-30T12:00:00', 3) })
  })

  it('returns the first answer when no second node responds, trying at most two others', async () => {
    const calls: string[] = []
    const D = 'https://nodes.test/d'
    const fetchImpl = nodesReturning({ [A]: STALE }, calls)
    const outcome = await dispatchHiveRpc(unreadCall, [A, B, C, D], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: STALE })
    expect(calls).toEqual([A, B, C])
  })

  it('does not let the cross-check node become the preferred node', async () => {
    const calls: string[] = []
    const fetchImpl = nodesReturning({ [A]: STALE, [B]: FRESH }, calls)
    await dispatchHiveRpc(unreadCall, [A, B], { fetchImpl })
    calls.length = 0
    await dispatchHiveRpc(body, [A, B], {
      fetchImpl: vi.fn(async (url: string) => {
        calls.push(url)
        return jsonResponse({ jsonrpc: '2.0', result: 1, id: 1 })
      }),
    })
    expect(calls).toEqual([A])
  })

  it('also handles the dhive `call` request shape', async () => {
    const dhiveCall = { jsonrpc: '2.0', method: 'call', params: ['bridge', 'unread_notifications', { account: 'alice' }], id: 1 }
    const fetchImpl = nodesReturning({ [A]: STALE, [B]: FRESH })
    const outcome = await dispatchHiveRpc(dhiveCall, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: FRESH })
  })

  it('reconciles only the unread items inside a batch and re-sends only those', async () => {
    const batch = [
      { jsonrpc: '2.0', id: 1, method: 'condenser_api.get_content', params: ['a', 'b'] },
      { ...unreadCall, id: 2 },
    ]
    const content = { jsonrpc: '2.0', id: 1, result: { title: 'x' } }
    const sent: Record<string, unknown[]> = {}
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      ;(sent[url] ??= []).push(JSON.parse(String(init?.body)))
      if (url === A) return jsonResponse([content, reply(2, '2026-01-01T00:00:00', 100)])
      return jsonResponse([reply(2, '2026-10-30T12:00:00', 2)])
    })
    const outcome = await dispatchHiveRpc(batch, [A, B], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: [content, reply(2, '2026-10-30T12:00:00', 2)] })
    expect(sent[B]).toEqual([[{ ...unreadCall, id: 2 }]])
  })

  it('does not ask a node that already failed in this call', async () => {
    const calls: string[] = []
    const D = 'https://nodes.test/d'
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      if (url === A) throw new TypeError('fetch failed')
      if (url === B) return jsonResponse(STALE)
      if (url === C) return jsonResponse(FRESH)
      throw new TypeError('fetch failed')
    })
    const outcome = await dispatchHiveRpc(unreadCall, [A, B, C, D], { fetchImpl })
    expect(outcome).toEqual({ ok: true, data: FRESH })
    expect(calls).toEqual([A, B, C])
  })

  it('skips nodes still in cooldown when every candidate is cooled down', async () => {
    let now = 1_000_000
    const calls: string[] = []
    const fail = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await dispatchHiveRpc(body, [A], { fetchImpl: fail, now: () => now })
    await dispatchHiveRpc(body, [B], { fetchImpl: fail, now: () => now })
    await dispatchHiveRpc(body, [C], { fetchImpl: fail, now: () => now })

    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url)
      if (url === A) return jsonResponse(STALE)
      if (url === C) return jsonResponse(FRESH)
      throw new TypeError('fetch failed')
    })
    now += 1_000
    const outcome = await dispatchHiveRpc(unreadCall, [A, B, C], { fetchImpl, now: () => now })
    expect(outcome).toEqual({ ok: true, data: STALE })
    expect(calls).toEqual([A])
  })

  it('aborts a hanging cross-check at its own short timeout', async () => {
    vi.useFakeTimers()
    const calls: string[] = []
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      calls.push(url)
      if (url === A) return Promise.resolve(jsonResponse(STALE))
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        const abort = () => {
          const error = new Error('The operation was aborted')
          error.name = 'AbortError'
          reject(error)
        }
        if (!signal) return
        if (signal.aborted) abort()
        else signal.addEventListener('abort', abort)
      })
    })

    const pending = dispatchHiveRpc(unreadCall, [A, B, C], { fetchImpl })
    await vi.advanceTimersByTimeAsync(CROSS_CHECK_TIMEOUT_MS * 2)
    await expect(pending).resolves.toEqual({ ok: true, data: STALE })
    expect(calls).toEqual([A, B, C])
    expect(CROSS_CHECK_TIMEOUT_MS * 2).toBeLessThan(ATTEMPT_TIMEOUT_MS * 2)
  })

  it('does not contact a second node for other methods', async () => {
    const calls: string[] = []
    const fetchImpl = nodesReturning({ [A]: { jsonrpc: '2.0', result: 1, id: 1 } }, calls)
    await dispatchHiveRpc(body, [A, B], { fetchImpl })
    expect(calls).toEqual([A])
  })
})

describe('node list', () => {
  it('omits the unresolved Ecency host and keeps techcoderx last in the fallback list', () => {
    expect(FALLBACK_NODES.some((node) => node.includes('hapi.ecency.com'))).toBe(false)
    expect(FALLBACK_NODES.at(-1)).toBe('https://techcoderx.com')
    expect(FALLBACK_NODES[0]).not.toBe('https://techcoderx.com')
  })

  it('drops low-score and excluded beacon nodes and demotes techcoderx below healthier ones', () => {
    const selected = selectBeaconNodes([
      { endpoint: 'https://techcoderx.com', score: 100 },
      { endpoint: 'https://api.deathwing.me', score: 100 },
      { endpoint: 'https://hapi.ecency.com', score: 0 },
      { endpoint: 'https://api.hive.blog', score: 90 },
      { endpoint: 'https://api.openhive.network', score: 80 },
    ])
    expect(selected).toEqual([
      'https://api.hive.blog',
      'https://api.openhive.network',
      'https://techcoderx.com',
    ])
  })

  it('uses the fallback list when beacon is unavailable, and caches a good beacon response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }))
    await expect(getHiveRpcNodes(fetchImpl)).resolves.toEqual(FALLBACK_NODES)
    expect(fetchImpl).toHaveBeenCalledOnce()

    resetRpcProxyState()
    const beacon = [
      { endpoint: 'https://api.hive.blog', score: 100 },
      { endpoint: 'https://api.openhive.network', score: 99 },
    ]
    fetchImpl.mockResolvedValue(jsonResponse(beacon))
    await expect(getHiveRpcNodes(fetchImpl)).resolves.toEqual([
      'https://api.hive.blog',
      'https://api.openhive.network',
    ])
    await expect(getHiveRpcNodes(fetchImpl)).resolves.toEqual([
      'https://api.hive.blog',
      'https://api.openhive.network',
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/hive-rpc', () => {
  it('rejects an invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/hive-rpc', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' })
  })

  it('returns the unreachable JSON-RPC error when every node fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const req = new NextRequest('http://localhost/api/hive-rpc', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'All Hive nodes unreachable' },
      id: null,
    })
  })
})
