/* core.js — 난수, 공용 도구, 세계·인물 생성, 돈·집·직업 기본 연산 */
var U = {}, Sim = {};
(function () {
  'use strict';

  /* ---------- 시드 난수 ---------- */
  U.hash = function (s) {
    s = String(s); var h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  U.mk = function (seed) { return { s: seed >>> 0 }; };
  U.rnd = function (r) {               // mulberry32, 상태는 r.s 하나(저장 가능)
    r.s = (r.s + 0x6D2B79F5) >>> 0; var t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.norm = function (r) { var u = 0; while (u < 1e-9) u = U.rnd(r); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * U.rnd(r)); };
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.rint = function (r, a, b) { return a + Math.floor(U.rnd(r) * (b - a + 1)); };
  U.range = function (r, ab) { return ab[0] + U.rnd(r) * (ab[1] - ab[0]); };
  U.pick = function (r, arr) { return arr[Math.floor(U.rnd(r) * arr.length)]; };
  U.wpick = function (r, items, ws) {
    var t = 0, i; for (i = 0; i < ws.length; i++) t += ws[i];
    var x = U.rnd(r) * t; for (i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
    return items[items.length - 1];
  };
  U.chance = function (r, p) { return U.rnd(r) < p; };
  U.sig = function (x) { return 1 / (1 + Math.exp(-x)); };
  U.lerp = function (tbl, x) {         // [[x0,y0],[x1,y1]...] 선형 보간
    if (x <= tbl[0][0]) return tbl[0][1];
    for (var i = 1; i < tbl.length; i++) if (x <= tbl[i][0]) { var a = tbl[i - 1], b = tbl[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return tbl[tbl.length - 1][1];
  };
  U.step = function (tbl, x) {         // [[상한,값]...] x < 상한인 첫 값, 없으면 마지막
    for (var i = 0; i < tbl.length; i++) if (x < tbl[i][0]) return tbl[i][1];
    return tbl[tbl.length - 1][1];
  };
  U.after = function (tbl, x) {        // [[하한,값]...] x >= 하한인 마지막 값, 없으면 0
    var v = 0; for (var i = 0; i < tbl.length; i++) if (x >= tbl[i][0]) v = tbl[i][1]; return v;
  };
  U.won = function (v) {
    v = Math.round(v); if (v === 0) return '0원'; var neg = v < 0; v = Math.abs(v); var s;
    if (v >= 10000) {
      v = Math.round(v / 100) * 100; var e = Math.floor(v / 10000), m = v % 10000;
      s = e.toLocaleString('ko-KR') + '억' + (m && e < 1000 ? ' ' + m.toLocaleString('ko-KR') + '만' : '');
    } else s = v.toLocaleString('ko-KR') + '만';
    return (neg ? '-' : '') + s + ' 원';
  };
  U.josa = function (word, pair) {     // U.josa('민수','은/는') → '민수는'
    var ab = pair.split('/'), w2 = word.replace(/[)\]\s]+$/, '') || word, c = w2.charCodeAt(w2.length - 1);
    var has = (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28 !== 0) : /[013678]$/.test(word);
    if (pair === '으로/로' && (c - 0xAC00) % 28 === 8) has = false;
    return word + (has ? ab[0] : ab[1]);
  };
  U.fill = function (s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k] == null ? '' : o[k]; }); };
  U.pct = function (p) { return Math.round(p * 100); };

  /* ---------- 세계(거시 경제) ---------- */
  Sim.newWorld = function (seed) {
    var r = U.mk(U.hash(seed + '#world')), macro = [], coin = [], cur = null, left = 0, a, k, x, acc, M;
    var KS = ['crisis', 'boom', 'hike', 'bull'];
    for (a = 0; a <= 101; a++) {
      var start = false;
      if (left <= 0) {
        cur = null; x = U.rnd(r); acc = 0;
        for (var i = 0; i < KS.length; i++) { acc += D.MACRO[KS[i]].p; if (x < acc) { cur = KS[i]; left = U.rint(r, D.MACRO[cur].dur[0], D.MACRO[cur].dur[1]); start = true; break; } }
      }
      M = cur ? D.MACRO[cur] : null;
      macro.push({
        k: cur, start: start,
        stock: M ? U.range(r, M.stock) : D.RATE.stockMean + U.norm(r) * D.RATE.stockSd,
        house: M ? M.house : 0, rate: M && M.rate || 0, hire: M ? M.hire : 1, layoff: M ? M.layoff : 1, biz: M ? M.biz : 1
      });
      x = U.rnd(r);
      if (x < D.MACRO.coinBoom) coin.push({ k: 'coinBoom', r: U.range(r, D.MACRO.coinBoomRet) });
      else if (x < D.MACRO.coinBoom + D.MACRO.coinCrash) coin.push({ k: 'coinCrash', r: U.range(r, D.MACRO.coinCrashRet) });
      else coin.push({ k: null, r: 0.05 + U.norm(r) * D.RATE.coinSd });
      left--;
    }
    var hg = {}, hx = {};
    D.REGION_KEYS.forEach(function (rk) {
      var R = D.REG[rk], g = [], idx = [], c = 1;
      for (a = 0; a <= 101; a++) {
        var m = macro[a], gg = R.g + (m.house > 0 ? m.house * R.boom : m.house) + U.norm(r) * 0.012;
        g.push(gg); c *= (1 + gg); idx.push(c);
      }
      hg[rk] = g; hx[rk] = idx;
    });
    return { seed: seed, macro: macro, coin: coin, hg: hg, hx: hx, peers: [], nr: U.mk(U.hash(seed + '#news')), lastNews: {} };
  };
  Sim.price = function (w, reg, age) { return Math.round(D.REG[reg].price * w.hx[reg][Math.max(0, Math.min(101, age))] / 100) * 100; };
  Sim.loanRate = function (w, p) { return D.LOAN.rate + w.macro[Math.max(0, p.age)].rate; };

  /* ---------- 인물 생성 ---------- */
  Sim.makeName = function (r, sex) { return U.pick(r, T.SUR) + U.pick(r, sex === 'M' ? T.GIVEN_M : T.GIVEN_F); };
  function st(r, mean, sd) { return Math.round(U.clamp(mean + U.norm(r) * (sd || 15), 1, 99)); }

  Sim.rollPerson = function (seedStr, isPlayer, name, forceSex) {
    var r = U.mk(U.hash(seedStr));
    var cls = U.wpick(r, D.CLASS.slice(1).map(function (c, i) { return i + 1; }), D.CLASS.slice(1).map(function (c) { return c.w; }));
    var C = D.CLASS[cls], u = U.rnd(r), assets;
    if (cls === 5) assets = Math.min(C.assets[1], C.assets[0] * Math.pow(1 / Math.max(0.02, u), 0.75));
    else assets = C.assets[0] * Math.pow(C.assets[1] / C.assets[0], u);
    var inc = C.inc[0] * Math.pow(C.inc[1] / C.inc[0], cls === 5 ? Math.pow(U.rnd(r), 2) : U.rnd(r));
    var edu = U.wpick(r, [0, 1, 2, 3, 4], D.PARENT_EDU_W[cls]);
    var region = U.wpick(r, D.REGION_KEYS, D.REGION_W[cls]);
    var sex = U.chance(r, 0.51) ? 'M' : 'F'; if (forceSex === 'M' || forceSex === 'F') sex = forceSex;   // 플레이어는 성별을 직접 고를 수 있음
    var harmony = st(r, 56 + (cls - 3) * 2, 17);
    var fAge = 31 + U.rint(r, -4, 8), mAge = Math.max(20, fAge - U.rint(r, 0, 5));
    var fam = {
      cls: cls, assets: Math.round(assets / 100) * 100, inc: Math.round(inc / 10) * 10, job: U.pick(r, D.PARENT_JOBS[cls]),
      edu: edu, zeal: st(r, 47 + (cls - 3) * 4 + (edu - 2) * 4, 15), harmony: harmony, region: region,
      sib: U.wpick(r, [0, 1, 2], [0.32, 0.5, 0.18]),
      fDeath: Math.round(U.clamp(81 + U.norm(r) * 8, 56, 99)) - fAge, mDeath: Math.round(U.clamp(87 + U.norm(r) * 7, 58, 101)) - mAge,
      alive: 2
    };
    var s = {
      iq: st(r, 50 + (edu - 2) * 2.4 + (cls - 3) * 0.8, 14.5),    // 부모 학력·재력과 약한 상관
      looks: st(r, 50 + (cls - 3) * 0.5), stamina: st(r, 50), dil: st(r, 50 + (harmony - 50) * 0.06),
      social: st(r, 50 + (harmony - 50) * 0.05), talent: st(r, 50), luck: st(r, 50),
      height: Math.round(sex === 'M' ? 174 + U.norm(r) * 5.6 : 161.5 + U.norm(r) * 5.2)
    };
    return {
      id: seedStr, name: name || Sim.makeName(r, sex), isPlayer: !!isPlayer, sex: sex, rng: U.mk(U.hash(seedStr + '#life')),
      fam: fam, st: s, age: -1, occ: 'child', region: region, ab: 0, art: 0, spec: 0,
      school: { mid: 'general', high: null, tutor: 'normal' }, univ: null, deg: 'none', nsu: 0, adm: null,
      job: null, inc: 0, hist: [], prep: null, prog: null, mil: null, milDone: sex === 'F',
      cash: 0, stock: 0, coin: 0, debt: 0, home: { type: 'parents', region: region }, gaps: [], rm: 0, rmPay: 0, inv: 'save',
      pen: { y: 0, s: 0, cy: 0, cs: 0 }, pension: 0,
      health: Math.round(U.clamp(74 + (s.stamina - 50) * 0.5 + U.norm(r) * 4, 40, 100)), happy: Math.round(U.clamp(58 + (harmony - 50) * 0.2, 30, 85)),
      hab: { ex: 0, vice: 0, chk: 0 }, over: 0,
      partner: null, spouse: null, mq: 0, kids: [], married: false, divorces: 0, widowed: false, noMarry: false, support: 0,
      q: [], cur: [], log: [], ms: [], gN: [], gH: [], gI: [], fl: {}, rel: null, dead: null, phase: 'idle', hSum: 0, hN: 0
    };
  };

  /* ---------- 로그 ---------- */
  Sim.say = function (p, t, c) { if (p.isPlayer) p.cur.push({ t: t, c: c || '' }); };
  Sim.ms = function (p, t, c) { p.ms.push({ a: p.age, t: t }); if (p.isPlayer && c !== false) p.cur.push({ t: t, c: c || 'ms' }); };
  Sim.q = function (p, id, c) { p.q.push({ id: id, c: c || {} }); };
  Sim.qFront = function (p, id, c) { p.q.unshift({ id: id, c: c || {} }); };

  /* ---------- 학업 ---------- */
  Sim.acad = function (p) {
    var W = D.EDU.w, s = p.st, f = p.fam;
    return 50 + W.iq * (s.iq - 50) + W.dil * (s.dil - 50) + W.zeal * (f.zeal - 50) + W.harmony * (f.harmony - 50) + p.ab + D.REG[f.region].acad;
  };
  Sim.susi = function (p) {
    var W = D.EDU.susi, s = p.st, f = p.fam, hs = p.school.high || 'general';
    return 50 + W.iq * (s.iq - 50) + W.dil * (s.dil - 50) + D.EDU.w.zeal * (f.zeal - 50) + p.ab * W.ab + (D.EDU.susiAdj[hs] || 0) + (p.fl.cons ? D.EDU.examPrep.cons.susi : 0)
      + (f.region === 'rural' ? D.EDU.ruralSusi : D.REG[f.region].acad * 0.5);
  };
  Sim.hsName = function (p) { var k = p.school.high || 'general'; return k === 'voc' && p.fl.meister ? '마이스터고' : D.EDU.high[k].name; };
  Sim.tierKey = function (p) { return p.univ && p.univ.done ? p.univ.tier : (p.school.high === 'voc' ? 'voc' : 'hs'); };
  Sim.eduLabel = function (p) {
    var a = p.age, u = p.univ, hs = Sim.hsName(p);
    if (a < 7) return '미취학'; if (a < 13) return '초등학교 재학'; if (a < 16) return '중학교 재학'; if (a < 19) return hs + ' 재학';
    if (p.occ === 'prog') return (u ? u.name + ' 졸업 · ' : '') + p.prog.name + ' 재학';
    if (u && u.done) return u.name + ' 졸업' + (p.deg === '석사' || p.deg === '박사' ? ' · ' + p.deg : '');
    if (u) return u.name + (p.occ === 'univ' ? ' ' + Math.min(u.y + 1, 6) + '학년' : ' 휴학');
    return hs + ' 졸업(고졸)';
  };
  Sim.isGrad = function (p) { return p.deg === '대졸' || p.deg === '석사' || p.deg === '박사'; };

  /* ---------- 돈 ---------- */
  Sim.tax = function (g) { return g <= 0 ? 0 : g * U.lerp(D.TAX, g); };
  Sim.liquid = function (p) { return p.cash + p.stock + p.coin; };
  Sim.pay = function (p, amt) {          // 현금 → 주식 → 코인 → 대출 순으로 지불
    p.cash -= amt; if (p.cash >= 0) return;
    var need = -p.cash, t; p.cash = 0;
    t = Math.min(p.stock, need); p.stock -= t; need -= t;
    t = Math.min(p.coin, need); p.coin -= t; need -= t;
    p.debt += need;
  };
  // 갭투자 주택 목록. 예전 저장(p.gap 한 채)도 여기서 목록으로 옮긴다
  Sim.gaps = function (p) { if (!p.gaps) p.gaps = p.gap ? [p.gap] : []; if (p.gap !== undefined) delete p.gap; return p.gaps; };
  Sim.gapEq = function (p) { var v = 0, L = Sim.gaps(p); for (var i = 0; i < L.length; i++) v += L[i].value - L[i].dep; return v; };
  Sim.houseVal = function (p) { return p.home.type === 'own' ? p.home.value : 0; };
  Sim.netWorth = function (p) {
    return p.cash + p.stock + p.coin + Sim.houseVal(p) + (p.home.deposit || 0) + Sim.gapEq(p) + (p.car ? p.car.value : 0) + Sim.bldVal(p) - p.debt - (p.rm || 0);
  };
  Sim.realEstate = function (p) { return Sim.houseVal(p) + (p.home.deposit || 0) + Sim.gapEq(p) + Sim.bldVal(p); };
  Sim.bldVal = function (p) { var v = 0, b = p.bld || []; for (var i = 0; i < b.length; i++) v += b[i].value; return v; };
  Sim.rentInc = function (p) { var v = 0, b = p.bld || []; for (var i = 0; i < b.length; i++) v += b[i].value * D.BLD[b[i].k].yield / 12; return Math.round(v / 5) * 5; };   // 세전 월 임대료
  Sim.spInc = function (p) { return p.spouse && p.spouse.works ? p.spouse.inc : 0; };
  Sim.otherInc = function (p) { return (p.pension || 0) + (p.spouse ? p.spouse.pension || 0 : 0) + (p.rmPay || 0) + (p.allow || 0) + Sim.rentInc(p); };
  Sim.hhGross = function (p) { return p.inc + Sim.spInc(p) + Sim.otherInc(p); };
  Sim.myInc = function (p) { return p.inc + (p.pension || 0) + (p.rmPay || 0) + Sim.rentInc(p); };
  Sim.loanCap = function (p, w, stretch) {   // 소득(DSR)에 연동된 총 대출 한도에서 기존 부채를 뺀 값
    var rate = Sim.loanRate(w, p), annual = Sim.hhGross(p) * 12;
    var cap = annual * (stretch ? D.LOAN.dsrStretch : D.LOAN.dsr) / (rate + 1 / D.LOAN.years);
    return Math.max(0, cap - p.debt);
  };
  Sim.famSize = function (p) { return 1 + (p.spouse ? 1 : 0) + p.kids.filter(function (k) { return k.age < 23 && k.withMe; }).length; };

  /* ---------- 집 ---------- */
  Sim.releaseHome = function (p) {
    var h = p.home;
    if (h.type === 'own') { p.cash += h.value * (1 - D.HOUSE.sellCost); if (p.rm) { p.cash -= p.rm; p.rm = 0; p.rmPay = 0; if (p.cash < 0) { p.debt -= p.cash; p.cash = 0; } } }
    else if (h.deposit) p.cash += h.deposit;
    p.home = { type: 'none', region: p.region };
  };
  Sim.homePrice = function (w, p, type, kind, region) {
    var R = D.REG[region], P = Sim.price(w, region, p.age) * (kind === 'villa' ? D.HOUSE.villa : 1);
    if (type === 'own') return P;
    if (type === 'jeonse') return Math.round(P * R.jr / 100) * 100;
    return D.HOUSE.monthlyDeposit;
  };
  Sim.setHome = function (p, w, type, o) {
    o = o || {}; var reg = o.region || p.region, kind = o.kind || 'apt';
    Sim.releaseHome(p); p.region = reg;
    if (type === 'parents') { p.home = { type: 'parents', region: reg }; return; }
    var price = o.price || Sim.homePrice(w, p, type, kind, reg);
    if (type === 'own') {
      Sim.pay(p, price * (1 + D.HOUSE.buyCost));
      p.home = { type: 'own', region: reg, kind: kind, value: o.value || price, since: p.age };
      p.fl.everOwned = 1; p.fl.ownAge = p.fl.ownAge || p.age; if (o.stretch) p.fl.yk = p.age;
      if (reg === 'gangnam') p.fl.gangnam = 1;
    } else if (type === 'jeonse') {
      Sim.pay(p, price); p.home = { type: 'jeonse', region: reg, kind: kind, deposit: price, since: p.age };
    } else {
      Sim.pay(p, price);
      p.home = { type: 'monthly', region: reg, kind: 'villa', deposit: price, rent: Math.round(D.REG[reg].rent * (Sim.famSize(p) > 1 ? D.HOUSE.familyRentMult : 1)), since: p.age };
    }
  };
  Sim.homeLabel = function (p) {
    var h = p.home, R = D.REG[h.region || p.region].short;
    if (h.type === 'parents') return '부모님 집';
    if (h.type === 'own') return R + ' 자가' + (h.kind === 'villa' ? '(빌라)' : '');
    if (h.type === 'jeonse') return R + ' 전세';
    if (h.type === 'monthly') return R + ' 월세';
    if (h.type === 'care') return '요양시설';
    return '거처 없음';
  };

  /* ---------- 직업 ---------- */
  function avgStat(p) { return (p.st.iq + p.st.dil + p.st.social) / 3; }
  Sim.jobTitle = function (p, j) {
    j = j || p.job; if (!j) return '무직';
    var J = D.JOBS[j.k];
    if (J.type === 'corp') return (j.co || J.name) + ' ' + J.ranks[j.rank][0];
    if (j.k === 'heir') return (j.co || '부모님 회사') + ' ' + Sim.heirRank(p, j);
    if (j.k === 'celeb') return D.CELEB.tiers[j.tier || 0][0];
    if (j.k === 'medEmp') return D.MEDPRO[j.sub].name;
    if (j.k === 'medOwn') return '개업 ' + D.MEDPRO[j.sub].name;
    if (j.k === 'doc') return (j.dept || '') + ' 봉직의';
    if (j.k === 'docOwn') return (j.dept || '') + ' 개원의';
    if (j.k === 'resident') return '전공의' + (j.dept && j.dept !== '일반의' ? '(' + j.dept + ')' : '');
    if (j.k === 'lawBig' && j.partner) return '대형 로펌 파트너 변호사';
    if (j.k === 'biz') return D.BIZ[j.biz].name + ' 사장';
    if (j.k === 'artist' && j.star) return '이름난 예술인';
    return j.co ? J.name + '(' + j.co + ')' : J.name;
  };
  Sim.heirRank = function (p, j) { return j.ceo === 1 ? (p.fam.cls >= 6 ? '회장' : '대표이사') : j.ceo === 2 ? '이사회 의장' : U.after(D.HEIR.ranks, j.y); };
  Sim.heirCo = function (p) { var L = p.fam.cls >= 6 ? T.CO.chaebol : T.CO.heir; return L[U.hash(p.id + 'heirco') % L.length]; };
  // 회사 이름은 난수 흐름을 건드리지 않도록 해시로 고른다
  Sim.coName = function (p, k, salt) { var L = T.CO[k]; return L ? L[U.hash(p.id + k + p.age + (salt || 0)) % L.length] : null; };
  Sim.jobInc = function (p, w, j) {
    j = j || p.job; if (!j) return 0;
    var J = D.JOBS[j.k], v;
    if (J.type === 'corp') v = J.ranks[j.rank][1] * (1 + Math.min(j.ry, 6) * 0.015) * j.mult * (p.over > 0 ? 1.05 : 1);
    else if (J.type === 'steady') v = (J.start + (J.max - J.start) * Math.min(1, j.y / J.span)) * j.mult * (j.ceo === 1 ? D.HEIR.ceoMult : j.ceo === 2 ? 1.25 : 1);
    else if (J.type === 'pro') {
      v = U.lerp(J.curve, j.y) * j.mult;
      if (j.k === 'medEmp') v *= D.MEDPRO[j.sub].emp;
      if (j.k === 'doc' && j.spec) v *= D.DOC_SPEC[j.spec].mult;
      if (j.partner) v = J.partnerInc * j.mult;
    } else v = j.cur || 0;
    return Math.round(v / 5) * 5;
  };
  Sim.setJob = function (p, w, k, o) {
    var J = D.JOBS[k], r = p.rng;
    if (p.job) Sim.leaveJob(p, w, 'move');
    var m;
    if (J.type === 'own' || J.type === 'biz' || J.type === 'gig') m = Math.exp(U.norm(r) * (J.sd || D.BIZ_RULE.sd)) * (1 + (avgStat(p) - 50) * 0.008);
    else m = U.clamp(1 + U.norm(r) * 0.07 + (avgStat(p) - 50) * 0.003, 0.8, 1.3);
    p.job = { k: k, since: p.age, y: 0, rank: 0, ry: 0, mult: m };
    var co = Sim.coName(p, k); if (co) p.job.co = co;
    if (o) for (var kk in o) p.job[kk] = o[kk];
    p.occ = 'work'; p.prep = null; p.prog = null;
    Sim.rollVar(p, w);
    p.inc = Sim.jobInc(p, w);
    p.hist.push({ a: p.age, t: Sim.jobTitle(p) });
    p.fl.worked = 1;
    // 일자리를 따라 수도권으로
    if (J.metro && D.REG[p.region].rank <= 2 && U.chance(r, J.metro)) {
      p.fl.moved = p.age; p.region = U.chance(r, 0.5) ? 'newtown' : 'seoul';
      Sim.say(p, '일자리를 따라 ' + U.josa(D.REG[p.region].short, '으로/로') + ' 올라왔습니다.');
      if (p.home.type === 'parents') { p.home = { type: 'none', region: p.region }; }
      p.fl.needHome = 1;
    }
  };
  // 변동 소득(개업·자영업·프리랜서)의 올해 소득을 굴린다
  Sim.rollVar = function (p, w) {
    var j = p.job; if (!j) return; var J = D.JOBS[j.k], r = p.rng, base;
    if (j.k === 'celeb') { j.cur = Math.max(30, D.CELEB.tiers[j.tier || 0][1] * Math.exp(U.norm(r) * 0.25)); return; }
    if (J.type === 'gig') {
      base = J.avg; if (J.skill) base *= 1 + (Math.max(p.st.iq, p.st.talent) - 50) * 0.012;
      if (j.k === 'artist') { base *= 1 + (p.st.talent + p.art - 50) * 0.012; if (j.star) base = j.starInc; }
      j.cur = Math.max(30, base * j.mult * Math.exp(U.norm(r) * 0.18));
    } else if (J.type === 'own') {
      base = j.k === 'medOwn' ? D.MEDPRO[j.sub].own : J.avg; if (j.k === 'docOwn' && j.spec) base *= D.DOC_SPEC[j.spec].mult;
      var ramp = Math.min(1, 0.75 + j.y * 0.1);
      j.cur = Math.max(base * 0.45, base * j.mult * ramp * Math.exp(U.norm(r) * 0.12) * (w.macro[Math.max(0, p.age)].k === 'crisis' ? 0.85 : 1));
    } else if (j.k === 'biz') {
      var B = D.BIZ[j.biz];
      j.cur = Math.max(0, B.avg * j.mult * (j.exp ? D.BIZ_RULE.expandMult : 1) * Math.exp(U.norm(r) * D.BIZ_RULE.yearSd) * (w.macro[Math.max(0, p.age)].k === 'crisis' ? 0.7 : 1));
    } else if (j.k === 'founder') {
      j.cur = D.FOUNDER.inc + Math.min(j.y, 8) * D.FOUNDER.growInc * j.mult;
    }
  };
  Sim.leaveJob = function (p, w, why) {
    var j = p.job; if (!j) return 0; var J = D.JOBS[j.k], sev = 0;
    if (J.sev && j.y > 0) { sev = Math.round(Sim.jobInc(p, w) * j.y * J.sev); p.cash += sev; }
    p.last = { k: j.k, t: Sim.jobTitle(p), y: j.y, a: p.age, why: why };
    if (j.y >= 1) p.fl.longest = Math.max(p.fl.longest || 0, j.y);
    p.job = null; p.inc = 0; p.occ = 'idle'; p.over = 0;
    return sev;
  };
  Sim.stage = function (p) { var a = p.age; return a < 4 ? 'baby' : a < 13 ? 'kid' : a < 19 ? 'teen' : a < 35 ? 'youth' : a < 60 ? 'middle' : 'senior'; };
  Sim.occLabel = function (p) {
    if (p.dead != null) return '별세';
    if (p.job) return Sim.jobTitle(p);
    var a = p.age;
    switch (p.occ) {
      case 'child': return a < 7 ? '미취학' : a < 13 ? '초등학생' : a < 16 ? '중학생' : '고등학생';
      case 'resu': return p.nsu >= 2 ? p.nsu + '수생' : '재수생';
      case 'univ': return (p.univ.name || '대학') + ' 재학';
      case 'mil': return '군 복무';
      case 'prog': return p.prog.name;
      case 'prep': return p.prep ? p.prep.name + ' 준비' : '취업 준비';
      case 'home': return '육아 전담';
      case 'retired': return '은퇴';
      default: return a >= 60 ? '은퇴' : '무직';
    }
  };
})();
