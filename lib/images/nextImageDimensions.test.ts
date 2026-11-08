import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * #327 PR3: every next/image must reserve space via `fill` (sized parent) or
 * explicit `width` + `height`. A bare `<Image src=...>` without either causes
 * layout shift once `/_next/image` paints.
 *
 * Parsed with the TypeScript compiler rather than a regex: a `>` inside an
 * attribute expression (`onLoad={() => …}`) or the word "fill" in a src or
 * objectFit value must not change the verdict.
 */

const ROOT = path.resolve(__dirname, '../..')
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.worktrees', '.claude', 'dist', 'coverage'])

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

function parse(fileName: string, source: string): ts.SourceFile {
  const kind = fileName.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
}

/** Local name bound to the default import of `next/image`, if any. */
function nextImageLocalName(sf: ts.SourceFile): string | null {
  for (const stmt of sf.statements) {
    if (
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === 'next/image' &&
      stmt.importClause?.name
    ) {
      return stmt.importClause.name.text
    }
  }
  return null
}

/** True for a bare attribute (`fill`) or one whose value is not literally false. */
function isTruthyAttr(attr: ts.JsxAttribute): boolean {
  const init = attr.initializer
  if (!init) return true
  if (ts.isJsxExpression(init)) {
    return init.expression?.kind !== ts.SyntaxKind.FalseKeyword
  }
  return true
}

function hasReservedSpace(attrs: ts.JsxAttributes): boolean {
  const names = new Map<string, ts.JsxAttribute>()
  for (const prop of attrs.properties) {
    // A spread could supply fill/width/height; it cannot be checked statically.
    if (ts.isJsxSpreadAttribute(prop)) return true
    if (ts.isJsxAttribute(prop)) names.set(prop.name.getText(), prop)
  }
  const fill = names.get('fill')
  if (fill && isTruthyAttr(fill)) return true
  return names.has('width') && names.has('height')
}

function offendersIn(fileName: string, source: string): string[] {
  const sf = parse(fileName, source)
  const local = nextImageLocalName(sf)
  if (!local) return []

  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(sf) === local &&
      !hasReservedSpace(node.attributes)
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      out.push(`${path.relative(ROOT, fileName)}:${line + 1}: ${node.getText(sf).replace(/\s+/g, ' ')}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

describe('next/image dimensions', () => {
  it('reserves layout space on every next/image usage', () => {
    const files = walk(ROOT).filter((f) => nextImageLocalName(parse(f, readFileSync(f, 'utf8'))))
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.flatMap((f) => offendersIn(f, readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  describe('checker', () => {
    const check = (body: string) => offendersIn('x.tsx', `import NextImage from 'next/image'\n${body}`)

    it('reads past a > inside an attribute expression', () => {
      expect(check('const a = <NextImage onLoad={() => {}} width={1} height={1} src="/a.png" alt="" />')).toEqual([])
    })

    it('does not treat "fill" in a value as the fill prop', () => {
      expect(check('const a = <NextImage src="/fill.png" alt="" style={{ objectFit: "fill" }} />')).toHaveLength(1)
    })

    it('rejects fill={false}', () => {
      expect(check('const a = <NextImage fill={false} src="/a.png" alt="" />')).toHaveLength(1)
    })

    it('accepts fill and width + height', () => {
      expect(check('const a = <NextImage fill src="/a.png" alt="" />')).toEqual([])
      expect(check('const a = <NextImage width={2} height={2} src="/a.png" alt="" />')).toEqual([])
    })

    it('ignores other components named Image', () => {
      const src = `import { Image } from '@chakra-ui/react'\nimport NextImage from 'next/image'\nconst a = <Image src="/a.png" />`
      expect(offendersIn('x.tsx', src)).toEqual([])
    })
  })
})
