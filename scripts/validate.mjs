#!/usr/bin/env node
/**
 * Validate this bundle before publishing.
 *
 * Checks the manifest and the Cordis patch together, because a marketplace
 * reader installs the patch and only trusts the manifest for display. Exits
 * non-zero on the first broken rule, so CI and a local run behave the same.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import semver from 'semver'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

/** Record a failed rule and keep checking, so one run lists every problem. */
function check(condition, message) {
  if (!condition) failures.push(message)
}

const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'))

const pkg = readJson('package.json')

check(typeof pkg.name === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(pkg.name),
  `package.json name must slug to ^[a-z0-9]+(-[a-z0-9]+)*$ (got ${JSON.stringify(pkg.name)})`)
check(semver.valid(pkg.version) !== null, `package.json version must be valid SemVer (got ${JSON.stringify(pkg.version)})`)
check(typeof pkg.description === 'string' && pkg.description.length > 0, 'package.json needs a description')
check(typeof pkg.license === 'string' && pkg.license.length > 0, 'package.json needs an SPDX license')

const patchPath = pkg.dsh?.bundle?.patch
check(typeof patchPath === 'string', 'package.json must declare dsh.bundle.patch (this is what makes it installable)')
check(pkg.dsh?.client === undefined, 'a preset-only bundle must not declare dsh.client')

const dshRange = pkg.engines?.dsh
check(typeof dshRange === 'string' && semver.validRange(dshRange) !== null,
  `engines.dsh must be a SemVer range (got ${JSON.stringify(dshRange)})`)

/* Parsed once, used by the structural checks inside the block below and by the
   composition checks after it. */
const document = typeof patchPath === 'string'
  ? parse(readFileSync(join(root, patchPath), 'utf8'))
  : []

if (typeof patchPath === 'string') {
  check(Array.isArray(document) && document.length > 0, `${patchPath} must be a non-empty YAML array`)

  const inserts = (Array.isArray(document) ? document : []).flatMap(entry => entry?.insert ?? [])
  check(inserts.length > 0, `${patchPath} must insert at least one Loader row`)

  const presets = inserts.filter(row => row?.name === '@deepseek-ai/dsh-agent-preset')
  check(presets.length > 0, `${patchPath} must insert one @deepseek-ai/dsh-agent-preset row`)

  for (const row of presets) {
    const id = row?.id
    const config = row?.config
    check(typeof id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id), `preset row id must be a Loader-safe id (got ${JSON.stringify(id)})`)
    check(typeof config?.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(config.id), `preset config.id must be a stable slug (got ${JSON.stringify(config?.id)})`)
    check(typeof config?.name === 'string' && config.name.length > 0, 'preset needs a display name')
    check(typeof config?.description === 'string' && config.description.length > 0, 'preset needs a description')
    check(Number.isFinite(config?.order), 'preset needs a numeric order')

    // Roster position is a product decision, not an implementation detail: the
    // registry sorts by order ascending and the client renders that order as-is,
    // so this number alone decides where the mode appears in the picker. Pin it
    // between Standard (1) and PTC (2); a plain 5 puts it at the bottom, which is
    // where it used to sit.
    check(config?.order > 1 && config?.order < 2,
      `preset order must sit between Standard (1) and PTC (2) (got ${JSON.stringify(config?.order)})`)

    const plugins = config?.plugins
    check(Array.isArray(plugins) && plugins.length > 0, 'preset must declare a non-empty plugins list')
    for (const [index, plugin] of (Array.isArray(plugins) ? plugins : []).entries()) {
      check(typeof plugin?.name === 'string' && plugin.name.length > 0,
        `plugins[${index}] needs a package name`)
      check(plugin?.disabled !== false,
        `plugins[${index}] should not be hard-disabled in every environment`)
      // `disabled: true` is the other way to write "never active". A `!!js`
      // expression is a string here and is deliberately allowed: it is a
      // platform gate, not a permanent off switch.
      check(plugin?.disabled !== true,
        `plugins[${index}] must not be permanently disabled in the declaration`)
      const grouped = plugin?.group === true
      if (grouped) {
        check(Array.isArray(plugin?.config) && plugin.config.length > 0,
          `plugins[${index}] is a cordis:group and needs a child list in config`)
      }
    }

    // A preset must not pin a web provider id: the host owns provider choice, and
    // a pinned id dangles whenever the owning plugin is disabled.
    const pinned = plugins?.filter(plugin => plugin?.name === '@deepseek-ai/dsh-web')
    check(pinned === undefined || pinned.length === 0,
      'do not mount or pin @deepseek-ai/dsh-web in a preset: provider choice belongs to the host profile')
  }
}

for (const locale of ['locale/en.json', 'locale/zh.json']) {
  const file = readJson(locale)
  check(typeof file?.meta?.title === 'string' && file.meta.title.length > 0, `${locale} needs meta.title`)
  check(typeof file?.meta?.description === 'string' && file.meta.description.length > 0, `${locale} needs meta.description`)
}

const icon = join(root, 'icon.svg')
check(statSync(icon, { throwIfNoEntry: false })?.isFile() === true, 'icon.svg must exist beside the manifest')
check(statSync(icon, { throwIfNoEntry: false })?.size < 256 * 1024, 'icon.svg must stay under 256 KiB')
check(readFileSync(icon, 'utf8').includes('<svg'), 'icon.svg must be an SVG document')

/* Both main READMEs must exist and cross-link each other. They now carry only
   highlights and navigation, so a missing language link is otherwise invisible
   until a reader clicks a dead end. */
for (const [file, other] of [['README.md', 'README.en.md'], ['README.en.md', 'README.md']]) {
  const path = join(root, file)
  check(statSync(path, { throwIfNoEntry: false })?.isFile() === true, `${file} must exist`)
  if (statSync(path, { throwIfNoEntry: false })?.isFile() !== true) continue
  const text = readFileSync(path, 'utf8')
  check(
    text.includes(`href="${other}"`) || text.includes(`](${other})`),
    `${file} must link to ${other}`,
  )
  check(text.length > 1000, `${file} looks too short to be the main README`)
}

/* The details now live in paired topic docs. A missing file or a missing
   language twin is a broken navigation link from the main README, so check all
   ten explicitly rather than trusting the links to resolve. */
const splitDocs = ['architecture', 'technical', 'release', 'development', 'repository']
  .flatMap(name => [`docs/${name}.md`, `docs/${name}.en.md`])
for (const file of splitDocs) {
  const path = join(root, file)
  const isFile = statSync(path, { throwIfNoEntry: false })?.isFile() === true
  check(isFile, `${file} must exist (split documentation)`)
  if (isFile) check(readFileSync(path, 'utf8').length > 500, `${file} looks too short to be a real doc`)
}

/* The Chinese architecture doc quotes the persona prompt exactly as the patch
   ships it; the English one carries a fenced translation. The main READMEs
   intentionally quote neither, so the verbatim check follows the prompt to its
   new home. A drifting quote is otherwise invisible until a reader notices. */
const personaSource = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
const personaMatch = personaSource.match(/prefix: \|\n((?: {16}.*\n| *\n)+)/)
check(personaMatch !== null, 'cordis.patch.yml must declare the persona prompt as a block scalar')
if (personaMatch !== null) {
  const normalize = value => value.split('\n').map(line => line.trim()).filter(Boolean).join('\n')
  const expected = normalize(personaMatch[1].replace(/^ {16}/gm, ''))
  const zhDoc = readFileSync(join(root, 'docs/architecture.md'), 'utf8')
  const fencedZh = [...zhDoc.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
    .map(match => match[1])
    .find(block => block.includes('问答助手'))
  check(fencedZh !== undefined, 'docs/architecture.md must quote the persona prompt in a fenced block')
  if (fencedZh !== undefined) {
    check(normalize(fencedZh) === expected, 'docs/architecture.md quotes a persona prompt that differs from cordis.patch.yml')
  }
  const enDoc = readFileSync(join(root, 'docs/architecture.en.md'), 'utf8')
  const fencedEn = [...enDoc.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
    .map(match => match[1])
    .find(block => block.includes('Answer first'))
  check(fencedEn !== undefined, 'docs/architecture.en.md must quote the English persona prompt in a fenced block')
}

/* The persona is the complete system prompt, so any rule missing from it is
   missing from the request. Pin the rules that make the preset what it is:
   losing one silently weakens the mode rather than breaking it.

   These are matched against the extracted persona block, not the whole patch
   file: the preset's own `description` repeats phrases like 结论先行, so a
   whole-file search would let a rule vanish from the prompt while the check
   stayed green. */
const personaBody = personaMatch === null ? '' : personaMatch[1]
const personaRules = [
  '结论先行',
  '先检索再回答',
  '优先一次拿到足够信息，避免多轮串行检索',
  '把能并行的检索放进同一条回复里同时发起',
  '只有后一步依赖前一步结果时才分轮',
  '补检索只在确实缺关键事实时做一次定向检索或抓取',
  '时间过滤',
  '不可信外部数据',
  '不写代码、不修改文件、不执行命令',
  '不要自行更改引擎配置',
]
for (const rule of personaRules) {
  check(personaBody.includes(rule), `the persona prompt must keep the rule containing ${JSON.stringify(rule)}`)
}

/* The remaining checks read the parsed declaration rather than the file text:
   a number quoted in a comment, or a plugin name mentioned in prose, must not
   satisfy a check about what the composition actually mounts. */
const presetConfig = (Array.isArray(document) ? document : [])
  .flatMap(entry => entry?.insert ?? [])
  .find(row => row?.name === '@deepseek-ai/dsh-agent-preset')?.config
const presetPlugins = Array.isArray(presetConfig?.plugins) ? presetConfig.plugins : []
const rowOf = id => presetPlugins.find(plugin => plugin?.id === id)

/* `complete: true` is what removes ~2.6 KB of coding-agent guidance from every
   request. Dropping it silently restores that cost, and the persona's restated
   rules would then sit beside the originals instead of replacing them. */
check(rowOf('persona')?.config?.complete === true,
  'the persona row must set complete: true (it is what bounds the system prompt)')

/* The pruner only helps when the preset mounts it: the host plane disables its
   own row, so an absent child means fetched pages stay verbatim for the turn. */
const compactionChildren = rowOf('compaction')?.config
check(Array.isArray(compactionChildren)
  && compactionChildren.some(child => child?.name === '@deepseek-ai/dsh-compaction-tool-result-pruner'),
  'the compaction group must mount @deepseek-ai/dsh-compaction-tool-result-pruner')

/* Bounds the preset is tuned around. They are config, so a typo or a later edit
   would quietly undo the tuning this release is about. */
const toolWeb = rowOf('tool-web')?.config ?? {}
const boundChecks = [
  ['searchMaxResults', 5],
  ['searchMaxQueries', 10],
  ['searchSummaryMaxChars', 400],
  ['fetchMaxOutputChars', 60000],
]
for (const [field, expected] of boundChecks) {
  check(toolWeb[field] === expected, `tool-web.${field} must stay at ${expected} (got ${JSON.stringify(toolWeb[field])})`)
}

/* The behavioural verifier is part of the release: it is what proves the
   declaration produced the composition. A missing script would let `npm run
   verify` fail only after publishing. */
const verifyScript = join(root, 'scripts/verify-session.mjs')
check(statSync(verifyScript, { throwIfNoEntry: false })?.isFile() === true, 'scripts/verify-session.mjs must exist')
check(pkg.scripts?.verify === 'node scripts/verify-session.mjs',
  'package.json scripts.verify must run scripts/verify-session.mjs')

if (failures.length > 0) {
  console.error(`dsh-qa-mode: ${failures.length} check(s) failed`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`dsh-qa-mode ${pkg.version}: all bundle checks passed`)
