import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pkgPath = path.join(root, 'package.json')
const readmeEn = path.join(root, 'README.md')
const readmeTr = path.join(root, 'README_TR.md')
const buildYml = path.join(root, '.github', 'workflows', 'build.yml')

/** npm-style semver X.Y.Z with optional pre-release / build (loose) */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/

const RAW_PACKAGE_JSON_ENC =
  'https%3A%2F%2Fraw.githubusercontent.com%2Fozymandias-get%2Fquizlab%2Fmain%2Fpackage.json'
const DYNAMIC_QUERY = 'query=%24.version'

function fail(msg) {
  console.error(`[version-check] ${msg}`)
  process.exit(1)
}

const pkgRaw = fs.readFileSync(pkgPath, 'utf8')
let pkg
try {
  pkg = JSON.parse(pkgRaw)
} catch {
  fail('package.json is not valid JSON')
}

const version = pkg.version
if (typeof version !== 'string' || !SEMVER_RE.test(version)) {
  fail(`package.json "version" must be a valid semver string, got: ${JSON.stringify(pkg.version)}`)
}

for (const file of [readmeEn, readmeTr]) {
  if (!fs.existsSync(file)) {
    fail(`missing ${path.relative(root, file)}`)
  }
  const text = fs.readFileSync(file, 'utf8')

  if (!text.includes('img.shields.io/badge/dynamic/json')) {
    fail(`${path.relative(root, file)}: version badge must use shields dynamic/json`)
  }
  if (!text.includes(RAW_PACKAGE_JSON_ENC) || !text.includes(DYNAMIC_QUERY)) {
    fail(
      `${path.relative(root, file)}: version badge must read version from raw package.json on main (${RAW_PACKAGE_JSON_ENC} + ${DYNAMIC_QUERY})`
    )
  }

  if (/\/badge\/version-\d+\.\d+\.\d+-/.test(text)) {
    fail(`${path.relative(root, file)}: remove static English semver badge (use dynamic/json)`)
  }
  if (/%Cm-\d+\.\d+\.\d+-/.test(text)) {
    fail(`${path.relative(root, file)}: remove static Turkish semver badge (use dynamic/json)`)
  }
}

if (fs.existsSync(buildYml)) {
  const yml = fs.readFileSync(buildYml, 'utf8')
  if (/##[^\n]*\(v\d+\.\d+\.\d+\)/.test(yml)) {
    fail(
      '.github/workflows/build.yml: release body must not hardcode a version in parentheses; use ${{ github.ref_name }}'
    )
  }
}

const ref = process.env.GITHUB_REF
if (ref?.startsWith('refs/tags/')) {
  const tag = ref.slice('refs/tags/'.length)
  if (tag.startsWith('v')) {
    const expected = `v${version}`
    if (tag !== expected) {
      fail(
        `git tag ${JSON.stringify(tag)} does not match package.json version: expected ${JSON.stringify(expected)}`
      )
    }
  }
}

process.exit(0)
