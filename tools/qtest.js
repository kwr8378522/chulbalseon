/* 월 단위 진행 테스트: node tools/qtest.js [횟수=30]
 * 화면과 같은 순서(Sim.advance → 갈림길 → 자유 행동·매매)로 인생을 끝까지 돌려 오류와 이상 수치를 찾습니다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
['data', 'text', 'core', 'decisions1', 'decisions2', 'life', 'quarter', 'extras'].forEach(f => vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' }));
const N = +process.argv[2] || 30, used = {}, decs = {}, bad = [];
let nw = [], cars = 0, wed = 0, nego = 0, maxRe = 0;
for (let i = 0; i < N; i++) {
  const g = Sim.newGame('q' + i, 0), p = g.p, rnd = U.mk(U.hash('act' + i));
  const drain = () => { let v, n = 0; while ((v = Sim.view(p, g.w)) && n++ < 40) { decs[v.id] = (decs[v.id] || 0) + 1; Sim.choose(p, g.w, Sim.auto(p, v).key); } };
  let guard = 0;
  while (!g.over && guard++ < 2000) {
    Sim.advance(g); drain();
    if (Sim.isQ(g)) {
      for (let k = 0; k < 3; k++) {
        const L = Sim.actList(g).filter(a => !a.dis); if (!L.length) break;
        const a = U.pick(rnd, L), r = Sim.act(g, a.key);
        if (r && !r.none) used[a.key] = (used[a.key] || 0) + 1;
        drain();
      }
      if (U.chance(rnd, 0.3)) Sim.trade(g, U.pick(rnd, Object.keys(D.ASSETS).concat(['coin'])), p.cash * 0.3);
      if (U.chance(rnd, 0.02)) Sim.setDca(g, U.pick(rnd, Object.keys(D.ASSETS).concat(['coin'])), U.pick(rnd, Sim.DCA_STEPS));
      if (U.chance(rnd, 0.1)) Sim.trade(g, U.pick(rnd, Object.keys(D.ASSETS).concat(['coin'])), -1e9);
      if (U.chance(rnd, 0.03)) Sim.borrow(g, Sim.creditCap(p, g.w) * 0.5);
      if (U.chance(rnd, 0.04)) { const m = U.pick(rnd, Sim.gapList(g)); Sim.buyGap(g, m.reg, m.kind); }
      if (U.chance(rnd, 0.02)) Sim.buyBld(g, 'shop');
      if (U.chance(rnd, 0.02)) Sim.sellGapNow(g, 0);
      if (U.chance(rnd, 0.01)) Sim.sellBld(g, 0);
      maxRe = Math.max(maxRe, Sim.gaps(p).length + (p.bld || []).length);
      if (U.chance(rnd, 0.05)) Sim.repay(g, 1e9);
    } else if (p.phase === 'mid') Sim.closeYear(g);
    for (const k of ['cash', 'stock', 'coin', 'debt', 'happy', 'health', 'inc']) if (!isFinite(p[k]) || (k !== 'happy' && k !== 'health' && p[k] < -0.01)) bad.push(`seed q${i} age ${p.age} ${k}=${p[k]}`);
  }
  if (!g.over) bad.push('q' + i + ' 끝나지 않음 (age ' + p.age + ')');
  nw.push(Sim.netWorth(p)); if (p.fl.car1) cars++; if (p.fl.wedAge) wed++; nego += decs.salary || 0;
  if (i === 0) { console.log('직업 이력:', p.hist.map(h => h.a + ' ' + h.t).join(' → ')); console.log('마지막 해 기록 예:', JSON.stringify(p.log[34].l.map(l => l.t)).slice(0, 700)); }
}
nw.sort((a, b) => a - b);
console.log(`\n${N}회 완주 · 엔진 오류 ${Sim.errors.length}건`, [...new Set(Sim.errors)].slice(0, 10));
console.log('이상 수치', bad.length, bad.slice(0, 10), '· 동시에 가진 투자 부동산 최대', maxRe, '채');
console.log('순자산 하위10%/중앙/상위10%:', [.1, .5, .9].map(f => U.won(nw[Math.floor(N * f)])).join(' / '), '· 차 구매', cars, '· 결혼', wed);
console.log('자유 행동 횟수:', Object.entries(used).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
console.log('갈림길 횟수(월 진행 전용):', ['hsPrep', 'vocLife', 'skillComp', 'examPrep', 'casting', 'milCareer', 'heirCeo', 'heirProve', 'estate', 'flatter', 'offDinner', 'offOrder', 'offCredit', 'offJunior', 'offLine', 'dateHow', 'lvAnniv', 'lvFight', 'lvMeet', 'lvBusy', 'agPref', 'agFocus', 'agPick', 'kdDay', 'kdRecital', 'kdTeen', 'kdDream', 'giftAsk', 'qPE', 'celebRole', 'celebScandal', 'meet', 'agency', 'car', 'salary', 'qDrive', 'qLend', 'qTip', 'qBonus', 'qWed', 'qScam', 'qSick', 'qPartner', 'qReunion', 'jobchange'].map(k => k + ' ' + (decs[k] || 0)).join(', '));
