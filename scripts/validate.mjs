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

if (typeof patchPath === 'string') {
  const document = parse(readFileSync(join(root, patchPath), 'utf8'))

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

    const plugins = config?.plugins
    check(Array.isArray(plugins) && plugins.length > 0, 'preset must declare a non-empty plugins list')
    for (const [index, plugin] of (Array.isArray(plugins) ? plugins : []).entries()) {
      check(typeof plugin?.name === 'string' && plugin.name.length > 0,
        `plugins[${index}] needs a package name`)
      check(plugin?.disabled !== false,
        `plugins[${index}] should not be hard-disabled in every environment`)
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

if (failures.length > 0) {
  console.error(`dsh-qa-mode: ${failures.length} check(s) failed`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`dsh-qa-mode ${pkg.version}: all bundle checks passed`)
