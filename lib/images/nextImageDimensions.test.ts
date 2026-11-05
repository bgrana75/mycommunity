import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * #327 PR3: every next/image must reserve space via `fill` (sized parent) or
 * explicit `width` + `height`. A bare `<Image src=...>` without either causes
 * layout shift once `/_next/image` paints.
 */

const ROOT = path.resolve(__dirname, '../..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.worktrees', 'dist', 'coverage'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full)
  }
  return out
}

function importsNextImage(source: string): boolean {
  return /from\s+['"]next\/image['"]/.test(source)
}

/** Rough JSX openings for next/image (default import Image/NextImage). */
function imageOpenings(source: string): string[] {
  const openings: string[] = []
  const re = /<(?:Image|NextImage)\b[^>]*(?:\/>|>)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) openings.push(m[0])
  return openings
}

function hasReservedSpace(tag: string): boolean {
  const hasFill = /\bfill\b/.test(tag)
  const hasWidth = /\bwidth\s*=/.test(tag)
  const hasHeight = /\bheight\s*=/.test(tag)
  return hasFill || (hasWidth && hasHeight)
}

describe('next/image dimensions', () => {
  it('reserves layout space on every next/image usage', () => {
    const files = walk(ROOT).filter((f) => importsNextImage(readFileSync(f, 'utf8')))
    expect(files.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const tag of imageOpenings(source)) {
        if (!hasReservedSpace(tag)) {
          offenders.push(`${path.relative(ROOT, file)}: ${tag}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
