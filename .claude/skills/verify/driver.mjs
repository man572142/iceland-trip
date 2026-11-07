#!/usr/bin/env node
/* verify 技能的驅動工具：起 wrangler dev、用 Playwright 跑 journeys/ 下的劇本、留證據。
   用法見 SKILL.md。 */
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const SKILL = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SKILL, '../../..');
const RUN_DIR = path.join(SKILL, '.run');
const STATE = path.join(RUN_DIR, 'state.json');
const LOG = path.join(RUN_DIR, 'wrangler.log');
const EVIDENCE = path.join(SKILL, 'evidence');
const JOURNEYS = path.join(SKILL, 'journeys');
const WRANGLER = path.join(SKILL, 'node_modules/wrangler/bin/wrangler.js');
const INDEX = path.join(REPO, 'public/index.html');
const FIRST_PORT = 8799;   // launch.json 的預覽佔 8788，這裡避開，不去碰使用者開著的那個
const isLocal = u => u.startsWith('http://127.0.0.1');

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Windows 上 workerd 剛被殺時檔案還鎖著，要等一下
async function rmRun(){
  for(let i = 0; ; i++){
    try{ fs.rmSync(RUN_DIR, {recursive:true, force:true}); return; }
    catch(e){ if(i >= 40) throw e; await sleep(500); }
  }
}
const sha = buf => createHash('sha256').update(buf).digest('hex');
const readState = () => { try{ return JSON.parse(fs.readFileSync(STATE, 'utf8')); }catch(e){ return null; } };
const alive = pid => { try{ process.kill(pid, 0); return true; }catch(e){ return false; } };

const portFree = port => new Promise(ok => {
  const s = net.createServer();
  s.once('error', () => ok(false));
  s.listen(port, '127.0.0.1', () => s.close(() => ok(true)));
});
// pid 會被系統重用：pid 還在且 port 有人聽才算活著
const live = async s => Boolean(s) && alive(s.pid) && !(await portFree(s.port));
async function freePort(from){
  for(let p = from; p < from + 100; p++) if(await portFree(p)) return p;
  throw new Error(`no free port from ${from}`);
}

function killTree(pid){
  if(process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio:'ignore'});
  else try{ process.kill(-pid, 'SIGTERM'); }catch(e){}
}

const gitSha = () => spawnSync('git', ['rev-parse', '--short', 'HEAD'], {cwd:REPO, encoding:'utf8'}).stdout.trim();

async function servedMatchesDisk(base){
  const res = await fetch(base + '/', {signal:AbortSignal.timeout(5000)});
  if(!res.ok) return {res, same:false};
  return {res, same:sha(Buffer.from(await res.arrayBuffer())) === sha(fs.readFileSync(INDEX))};
}

/* ---------- setup ---------- */
function setup(){
  const npm = spawnSync('npm', ['ci'], {cwd:SKILL, stdio:'inherit', shell:true});
  if(npm.status) process.exit(npm.status);
  const pw = spawnSync('npx', ['playwright', 'install', '--only-shell', 'chromium'], {cwd:SKILL, stdio:'inherit', shell:true});
  process.exit(pw.status ?? 1);
}

/* ---------- up ---------- */
async function up(){
  const prev = readState();
  if(await live(prev)){
    console.error(`REFUSED: instance already running at ${prev.base} (run ${prev.runId}). Drive it, or run down first.`);
    process.exit(1);
  }
  if(!fs.existsSync(WRANGLER)){ console.error('REFUSED: dependencies missing. Run: node .claude/skills/verify/driver.mjs setup'); process.exit(1); }
  await rmRun();
  fs.mkdirSync(RUN_DIR, {recursive:true});

  const port = await freePort(FIRST_PORT);
  const inspector = await freePort(port + 1000);
  const log = fs.openSync(LOG, 'a');
  const child = spawn(process.execPath, [WRANGLER, 'dev', '--ip', '127.0.0.1', '--port', String(port),
    '--inspector-port', String(inspector), '--persist-to', path.join(RUN_DIR, 'state')], {
    cwd:REPO, detached:true, windowsHide:true, stdio:['ignore', log, log],
    env:{...process.env, WRANGLER_SEND_METRICS:'false', CI:'1'}
  });
  child.unref();

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const state = {pid:child.pid, port, inspector, base:`http://127.0.0.1:${port}`, runId:`${stamp}-${gitSha()}`};
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

  // 就緒＝服務的 index.html 跟磁碟上的一模一樣，不只是 port 有回應
  for(let i = 0; i < 120; i++){
    if(!alive(child.pid)) break;
    try{
      if((await servedMatchesDisk(state.base)).same){
        fs.mkdirSync(path.join(EVIDENCE, state.runId), {recursive:true});
        console.log(`READY ${state.base}  run=${state.runId}  pid=${child.pid}`);
        console.log(`evidence: ${path.join(EVIDENCE, state.runId)}`);
        return;
      }
    }catch(e){}
    await sleep(500);
  }
  console.error('FAILED: not ready. Log tail:\n' + fs.readFileSync(LOG, 'utf8').slice(-2000));
  killTree(child.pid);
  fs.rmSync(STATE, {force:true});
  process.exit(1);
}

/* ---------- down ---------- */
async function down(){
  const s = readState();
  if(!s){ console.log('nothing to tear down'); return; }
  killTree(s.pid);
  for(let i = 0; i < 20 && !(await portFree(s.port)); i++) await sleep(500);
  const free = await portFree(s.port);
  const dest = path.join(EVIDENCE, s.runId);
  fs.mkdirSync(dest, {recursive:true});
  try{ fs.copyFileSync(LOG, path.join(dest, 'wrangler.log')); }catch(e){}
  if(free) await rmRun();
  console.log(`${free ? 'DOWN' : `WARNING: port ${s.port} still listening; state kept in ${RUN_DIR}`}  evidence kept: ${dest}`);
  if(!free) process.exit(1);
}

/* ---------- doctor（只讀） ---------- */
async function doctor(){
  let failed = false;
  const row = (ok, name, detail = '') => {
    if(ok === false) failed = true;
    console.log(`${ok === null ? 'WARN' : ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  };
  const s = readState();
  row(Boolean(s), 'state file', s ? `${s.base} run=${s.runId}` : 'no instance; run up');
  if(s){
    row(await live(s), 'wrangler process', `pid ${s.pid}`);
    try{
      const {res, same} = await servedMatchesDisk(s.base);
      row(res.ok, 'GET /', String(res.status));
      row(same, 'served index.html == public/index.html');
      row(res.headers.get('x-content-type-options') === 'nosniff', 'public/_headers applied');
      const places = await fetch(s.base + '/places.json');
      row(places.ok, 'GET /places.json', String(places.status));
    }catch(e){ row(false, 'GET /', e.message); }
  }
  row(gitSha() !== '', 'commit', gitSha());

  let chromium;
  try{ ({chromium} = await import('playwright')); }catch(e){ row(false, 'playwright', 'run setup'); }
  if(chromium){
    // 擋掉所有外部連線：只問瀏覽器起得來、本機這份頁面自己 render 得出來嗎
    let b = null;
    try{ b = await chromium.launch(); row(true, 'chromium', b.version()); }
    catch(e){ row(false, 'chromium', 'run setup'); }
    if(b && s){
      try{
        const page = await b.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.route('**/*', r => isLocal(r.request().url()) ? r.continue() : r.abort());
        await page.goto(s.base + '/');
        const days = await page.locator('#dayList > li.day').count();
        row(days > 0 && !errs.length, 'page renders', `${days} days${errs.length ? '; ' + errs[0] : ''}`);
      }catch(e){ row(false, 'page renders', e.message); }
    }
    await b?.close();
  }

  // 外部服務掛了不算 instance 壞，但會讓對應的 journey 失敗
  const ext = [
    ['Leaflet CDN (all map steps)', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'],
    ['OSRM (map-route)', 'https://router.project-osrm.org/route/v1/driving/-21.9,64.1;-21.8,64.1?overview=false'],
    ['Flickr API (spot-detail photos, when FLICKR_KEY is set)', 'https://api.flickr.com/services/rest/?method=flickr.test.echo&format=json&nojsoncallback=1'],
    ['Commons (spot-detail photos)', 'https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json&origin=*'],
    ['Wikipedia (edit-draft summaries)', 'https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json&origin=*']
  ];
  await Promise.all(ext.map(async ([name, url]) => {
    try{
      const r = await fetch(url, {signal:AbortSignal.timeout(8000), headers:{'user-agent':'iceland-trip-verify'}});
      row(r.ok ? true : null, name, String(r.status));
    }catch(e){ row(null, name, e.message); }
  }));
  if(failed) process.exit(1);
}

/* ---------- run ---------- */
function journeyFiles(arg){
  if(arg === 'all') return fs.readdirSync(JOURNEYS).filter(f => f.endsWith('.mjs') && f !== 'lib.mjs').sort()
    .map(f => path.join(JOURNEYS, f));
  return [arg.endsWith('.mjs') ? path.resolve(arg) : path.join(JOURNEYS, arg + '.mjs')];
}

async function runJourney(file, state, chromium){
  const name = path.basename(file, '.mjs');
  const dir = path.join(EVIDENCE, state.runId, name);
  fs.rmSync(dir, {recursive:true, force:true});
  fs.mkdirSync(dir, {recursive:true});
  const browser = await chromium.launch();
  const report = {journey:name, commit:gitSha(), base:state.base, steps:[], pageErrors:[], consoleErrors:[],
    badResponses:[], external:{}, blocked:[]};
  let ctx = null, seq = 0;

  const t = {
    base:state.base,
    page:null,
    requests:[],
    /* 全新的 context＝空的 localStorage。每個 context 都擋 github.com：
       「開 GitHub Issue」若真的送出，會觸發工作流程改寫 main。 */
    async newPage({viewport = {width:1440, height:900}, block = [], fulfill = {}} = {}){
      await ctx?.close();
      ctx = await browser.newContext({viewport, locale:'zh-TW', serviceWorkers:'block'});
      ctx.setDefaultTimeout(15000);
      await ctx.route(/^https:\/\/([^/]+\.)?github\.com\//, r => { report.blocked.push(r.request().url()); return r.abort(); });
      for(const host of block) await ctx.route(u => u.hostname === host, r => { report.blocked.push(r.request().url()); return r.abort(); });
      for(const [host, fn] of Object.entries(fulfill)) await ctx.route(u => u.hostname === host, r => r.fulfill(fn(r.request().url())));
      const page = t.page = await ctx.newPage();
      page.on('pageerror', e => report.pageErrors.push(e.stack.split(String.fromCharCode(10)).slice(0, 3).join(' ')));
      page.on('console', m => { if(m.type() === 'error') report.consoleErrors.push(m.text()); });
      page.on('response', r => { if(r.status() >= 400) report.badResponses.push(`${r.status()} ${r.url()}`); });
      page.on('request', r => {
        const u = r.url();
        t.requests.push(u);
        if(!isLocal(u) && !u.startsWith('data:')){ const h = new URL(u).hostname; report.external[h] = (report.external[h] || 0) + 1; }
      });
      return page;
    },
    open:(p = '/') => t.page.goto(state.base + p),
    check(ok, msg, detail){
      const cur = report.steps.at(-1);
      cur.checks.push({ok:Boolean(ok), msg, ...(detail === undefined ? {} : {detail})});
    },
    eq(actual, expected, msg){
      const a = JSON.stringify(actual), b = JSON.stringify(expected);
      t.check(a === b, msg, a === b ? a : `got ${a}, want ${b}`);
    },
    async step(title, fn){
      const n = String(++seq).padStart(2, '0');
      const st = {n, title, checks:[]};
      report.steps.push(st);
      try{ await fn(); }
      catch(e){ st.checks.push({ok:false, msg:'step threw', detail:e.message.split('\n').slice(0, 4).join(' | ')}); st.threw = true; }
      try{
        st.shot = `${n}.png`;
        await t.page.screenshot({path:path.join(dir, st.shot)});
        fs.writeFileSync(path.join(dir, `${n}.aria.txt`), await t.page.locator('body').ariaSnapshot({timeout:5000}));
      }catch(e){ st.evidenceError = e.message.split('\n')[0]; }
      const bad = st.checks.filter(c => !c.ok);
      console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${n} ${title}`);
      bad.forEach(c => console.log(`       ✗ ${c.msg}${c.detail ? ': ' + c.detail : ''}`));
      if(st.threw) throw new Error('stop');
    }
  };

  console.log(name);
  await t.newPage();
  const mod = await import(pathToFileURL(file).href);
  let aborted = false;
  try{ await mod.default(t); }catch(e){
    aborted = true;
    if(e.message !== 'stop') report.steps.push({n:'--', title:'journey crashed', checks:[{ok:false, msg:e.message}]});
    if(e.message !== 'stop') console.log(`  FAIL journey crashed: ${e.message}`);
  }
  await browser.close();

  report.pass = !aborted && !report.pageErrors.length && report.steps.every(s => s.checks.every(c => c.ok));
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  if(report.pageErrors.length) console.log(`  FAIL uncaught page errors: ${report.pageErrors.join(' | ')}`);
  console.log(`  ${report.pass ? 'PASS' : 'FAIL'}  ${dir}`);
  return report.pass;
}

async function run(arg){
  if(!arg){ console.error('usage: driver.mjs run <journey|path.mjs|all>'); process.exit(2); }
  const s = readState();
  if(!(await live(s))){ console.error('REFUSED: no instance from this checkout. Run up first.'); process.exit(1); }
  const {chromium} = await import('playwright');
  let ok = true;
  for(const f of journeyFiles(arg)) ok = await runJourney(f, s, chromium) && ok;
  process.exit(ok ? 0 : 1);
}

const [cmd, arg] = process.argv.slice(2);
const cmds = {setup, up, down, doctor, run:() => run(arg)};
if(!cmds[cmd]){ console.error('usage: driver.mjs setup|up|doctor|run <journey|path.mjs|all>|down'); process.exit(2); }
await cmds[cmd]();
