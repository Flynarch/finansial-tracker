import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const TARGET_DIRS = ['src/pages', 'src/components']
const FILE_EXTENSIONS = new Set(['.jsx', '.tsx'])

const ATTRIBUTE_RE = /\b(title|placeholder|aria-label)\s*=\s*"([^"{][^"]*)"/g

function isIgnorableText(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return true
  if (/^[\d\s.,:%()+\-/*]+$/.test(cleaned)) return true
  if (/^[A-Z]{1,3}$/.test(cleaned)) return true
  if (/^(true|false|null)$/i.test(cleaned)) return true
  return false
}

function lineOf(content, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
      continue
    }
    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue
    files.push(fullPath)
  }

  return files
}

async function run() {
  const targetFiles = []
  for (const relativeDir of TARGET_DIRS) {
    const absoluteDir = path.join(ROOT, relativeDir)
    targetFiles.push(...(await collectFiles(absoluteDir)))
  }

  const violations = []

  for (const filePath of targetFiles) {
    const source = await readFile(filePath, 'utf8')

    for (const match of source.matchAll(ATTRIBUTE_RE)) {
      const value = match[2]?.trim() ?? ''
      if (isIgnorableText(value)) continue
      violations.push({
        filePath,
        line: lineOf(source, match.index ?? 0),
        kind: 'attribute',
        value,
      })
    }

  }

  if (violations.length === 0) {
    console.log('No hardcoded UI text found in scanned JSX files.')
    return
  }

  console.error('Hardcoded UI text detected. Use i18n keys via t(...):')
  for (const violation of violations) {
    const relative = path.relative(ROOT, violation.filePath).replaceAll('\\', '/')
    console.error(`- ${relative}:${violation.line} [${violation.kind}] "${violation.value}"`)
  }

  process.exitCode = 1
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
