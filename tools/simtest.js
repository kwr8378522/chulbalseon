/* 밸런스 테스트: node tools/simtest.js [횟수=1000]
 * 자동 선택으로 인생을 N회 돌려(플레이어 1 + 동년배 30명씩) 결과 분포를 출력합니다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
['data', 'text', 'core', 'decisions1', 'decisions2', 'life', 'quarter', 'extras'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' }));
const N = +process.argv[2] || 1000, AGES = [25, 30, 40, 50, 65, 80, 100];
const all = {}; AGES.forEach(a => all[a] = []);
const players = [], titles = {}; let decN = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = Sim.runLife('test' + i, AGES);
  AGES.forEach(a => { all[a].push(...r.snaps[a]); });
  const p = r.g.p; players.push(r.snaps[100][0]); const t = Sim.title(p); titles[t] = (titles[t] || 0) + 1; decN += p.fl.decN || 0;
}
const pct = (x, n) => (100 * x / n).toFixed(1) + '%';
const q = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
const eok = v => (v / 10000).toFixed(2) + '억';
function dist(arr, key) { const m = {}; arr.forEach(x => { const k = typeof key === 'function' ? key(x) : x[key]; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + pct(v, arr.length)).join(', '); }
console.log(`=== ${N}회 × ${D.PEERS + 1}명 = ${all[40].length}명의 인생 (${((Date.now() - t0) / 1000).toFixed(1)}초) ===`);
console.log('엔진 오류:', Sim.errors.length, [...new Set(Sim.errors)].slice(0, 10));
console.log('플레이어 평균 선택 횟수:', (decN / N).toFixed(1));
console.log('\n[학력] ', dist(all[30], 'tier'));
AGES.forEach(a => {
  const L = all[a].filter(x => !x.dead), n = L.length;
  console.log(`\n--- ${a}세 (생존 ${pct(n, all[a].length)}) ---`);
  console.log('직업:', dist(L, 'job'));
  console.log(`월소득(본인) 중앙 ${q(L.map(x => x.inc), .5)} / 상위10% ${q(L.map(x => x.inc), .9)} / 상위1% ${q(L.map(x => x.inc), .99)}   가구 중앙 ${Math.round(q(L.map(x => x.hh), .5))}`);
  const nw = L.map(x => x.nw);
  console.log(`순자산 하위10% ${eok(q(nw, .1))} / 중앙 ${eok(q(nw, .5))} / 평균 ${eok(nw.reduce((s, v) => s + v, 0) / n)} / 상위10% ${eok(q(nw, .9))} / 상위1% ${eok(q(nw, .99))}`);
  const sorted = nw.slice().sort((x, y) => y - x), tot = sorted.reduce((s, v) => s + Math.max(0, v), 0), top10 = sorted.slice(0, Math.floor(n / 10)).reduce((s, v) => s + Math.max(0, v), 0);
  console.log(`상위 10%의 자산 점유율 ${pct(top10, tot)} · 자가 ${pct(L.filter(x => x.own).length, n)} · 기혼 ${pct(L.filter(x => x.married).length, n)} · 혼인 경험 ${pct(L.filter(x => x.ever).length, n)} · 평균 자녀 ${(L.reduce((s, x) => s + x.kids, 0) / n).toFixed(2)}`);
  console.log(`행복 평균 ${(L.reduce((s, x) => s + x.happy, 0) / n).toFixed(1)} · 건강 평균 ${(L.reduce((s, x) => s + x.health, 0) / n).toFixed(1)} · 주거: ${dist(L, 'home')}`);
});
const A = all[50].filter(x => !x.dead), n50 = A.length;
console.log('\n=== 핵심 점검 (50세 기준) ===');
console.log('의사 면허', pct(A.filter(x => x.lic === 'doc').length, n50), '· 치한약수', pct(A.filter(x => x.lic === 'medpro').length, n50), '· 변호사', pct(A.filter(x => x.lic === 'law').length, n50), '· 회계사', pct(A.filter(x => x.lic === 'cpa').length, n50), '· 세무사', pct(A.filter(x => x.lic === 'tax').length, n50));
const E = all[65]; console.log('임원 경험', pct(E.filter(x => x.exec).length, E.length), '· 폐업 경험', pct(E.filter(x => x.bizC > 0).length, E.length), '· 개인회생', pct(E.filter(x => x.bk > 0).length, E.length), '· 수급 경험', pct(all[80].filter(x => x.welfare > 0).length, all[80].length));
console.log('\n[출신 분위별 50세 순자산]');
const thr = q(A.map(x => x.nw), .8), thrLow = q(A.map(x => x.nw), .2);
for (let c = 1; c <= 5; c++) { const C = A.filter(x => x.cls === c), v = C.map(x => x.nw); console.log(` ${c}분위(${D.CLASS[c].nick}) n=${C.length}: 하위25% ${eok(q(v, .25))} · 중앙 ${eok(q(v, .5))} · 상위25% ${eok(q(v, .75))} · 상위20% 진입 ${pct(C.filter(x => x.nw >= thr).length, C.length)} · 하위20% 추락 ${pct(C.filter(x => x.nw <= thrLow).length, C.length)} · 대기업+전문직 ${pct(C.filter(x => x.job === 'large' || x.lic).length, C.length)} · 평균 행복 ${(C.reduce((s, x) => s + x.happy, 0) / C.length).toFixed(1)}`); }
console.log('\n[출신 분위별 학력]');
for (let c = 1; c <= 5; c++) { const C = all[30].filter(x => x.cls === c); console.log(` ${c}분위:`, dist(C, x => ['med', 'medpro', 'sky', 'top'].includes(x.tier) ? '상위권대' : ['seoul', 'natl', 'edu', 'abroad', 'arts'].includes(x.tier) ? '중위권대' : ['local', 'college'].includes(x.tier) ? '지방·전문대' : '고졸')); }
console.log('\n[플레이어 칭호 분포]'); Object.entries(titles).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(' ', pct(v, N), k));
{ const ac = all[25].map(x => x.acad), su = all[25].map(x => x.susi); const mean = ac.reduce((s, v) => s + v, 0) / ac.length;
  console.log('\n[학업 점수 분포] 평균', mean.toFixed(1), '· 상위 0.8%/2%/3.5%/9%/18%/38%/65%/88% 지점:', [.992, .98, .965, .91, .82, .62, .35, .12].map(f => q(ac, f).toFixed(1)).join(' / '), '· 수시 점수 같은 지점:', [.992, .98, .965, .91, .82, .62, .35, .12].map(f => q(su, f).toFixed(1)).join(' / ')); }
