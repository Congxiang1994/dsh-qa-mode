#!/usr/bin/env node
/**
 * 复核五个插件索引源是否收录 dsh-qa-mode，版本是否跟上 npm latest。
 *
 *   node scripts/check-indexes.mjs             # 查五个源，逐行打印状态
 *   node scripts/check-indexes.mjs --strict    # 任一源 absent / 版本滞后即非 0
 *   node scripts/check-indexes.mjs --self-test # 注入式验证判定逻辑（不联网）
 *
 * 退出码约定：
 *   0  = 五个源都查询成功并输出状态（absent 是允许状态，由人判断是未登记还是索引器阈值）
 *   非 0 = 技术性失败（网络 / JSON / npm latest 查不到），或 --strict 下有源未跟上
 */
const PKG = 'dsh-qa-mode';

const SOURCES = [
  { id: 1, name: 'cdn.dsh.so/market', url: 'https://cdn.dsh.so/market/index.json', kind: 'auto' },
  { id: 2, name: 'cdn.dsh.so/market/top-rank', url: 'https://cdn.dsh.so/market/top-rank.json', kind: 'auto' },
  { id: 3, name: 'dshopen.org', url: 'https://dshopen.org/index.json', kind: 'registered' },
  { id: 4, name: 'api.dshfind.com', url: 'https://api.dshfind.com/market/dsh-index.json', kind: 'pr#96' },
  { id: 5, name: 'xivie-a.github.io', url: 'https://xivie-a.github.io/dsh-market/index.json', kind: 'issue#1' },
];

function pickVersion(entry) {
  const v = entry?.versions;
  if (Array.isArray(v)) return v[0]?.version ?? (typeof v[0] === 'string' ? v[0] : null);
  if (v && typeof v === 'object') return Object.keys(v)[0] ?? null;
  return null;
}

/** 纯判定函数，供联网复核与 self-test 共用。 */
function classify(entry, latest) {
  if (!entry) return { state: 'absent', ok: false };
  const version = pickVersion(entry);
  if (!version) return { state: 'listed@?', ok: false };
  if (version !== latest) return { state: `outdated@${version}`, ok: false };
  return { state: `listed@${version}`, ok: true };
}

function selfTest() {
  const latest = '1.0.6';
  const cases = [
    [{ versions: [{ version: '1.0.6' }] }, 'listed@1.0.6', true],
    [{ versions: [{ version: '1.0.5' }] }, 'outdated@1.0.5', false],
    [null, 'absent', false],
  ];
  for (const [entry, expectState, expectOk] of cases) {
    const r = classify(entry, latest);
    if (r.state !== expectState || r.ok !== expectOk) {
      console.error(`self-test FAIL: expected ${expectState}/${expectOk}, got ${r.state}/${r.ok}`);
      process.exit(1);
    }
  }
  // 注入式：strict 必须能抓到 absent 与 outdated
  const results = cases.map(([entry]) => classify(entry, latest));
  if (!results.some((r) => !r.ok)) {
    console.error('self-test FAIL: injected failures not detected');
    process.exit(1);
  }
  console.log('self-test: 3/3 passed, strict would flag 2/3 as not-ok');
  process.exit(0);
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  if (process.argv.includes('--self-test')) selfTest();
  const strict = process.argv.includes('--strict');

  let latest;
  try {
    const reg = await getJson(`https://registry.npmjs.org/${PKG}`);
    latest = reg['dist-tags']?.latest;
  } catch (e) {
    console.error(`npm registry unreachable: ${e.message}`);
    process.exit(2);
  }
  if (!latest) {
    console.error('npm registry returned no dist-tags.latest');
    process.exit(2);
  }
  console.log(`npm latest = ${latest}`);

  let technicalFailures = 0;
  const notOk = [];
  for (const s of SOURCES) {
    try {
      const data = await getJson(s.url);
      const entry = (data.plugins || []).find(
        (p) => p.name === PKG || p.name?.toLowerCase().endsWith(`/${PKG}`),
      );
      const r = classify(entry, latest);
      console.log(`${s.id}. ${s.name.padEnd(28)} ${r.state.padEnd(16)} [${s.kind}]`);
      if (!r.ok) notOk.push(`${s.id}:${r.state}`);
    } catch (e) {
      console.log(`${s.id}. ${s.name.padEnd(28)} unreachable (${e.message})`);
      technicalFailures += 1;
    }
  }

  if (technicalFailures > 0) {
    console.error(`${technicalFailures} index(es) unreachable — cannot prove listing state`);
    process.exit(2);
  }
  if (notOk.length > 0) {
    console.log(`not-listed-or-outdated: ${notOk.join(', ')}`);
    if (strict) process.exit(1);
  }
  console.log('index check complete');
}

main().catch((e) => {
  console.error(`fatal: ${e.stack || e.message}`);
  process.exit(2);
});
