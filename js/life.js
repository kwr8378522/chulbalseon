/* life.js — 1년 단위 시뮬레이션 엔진, 동년배(친구들), 소식, 엔딩, 자동 테스트 */
(function () {
  'use strict';
  var clamp = U.clamp, won = U.won, say = Sim.say, ms = Sim.ms, DEC = Sim.DEC, H = Sim.H, chance = U.chance;
  Sim.errors = [];

  /* ---------- 갈림길 큐 ---------- */
  var baseQ = Sim.q, baseQF = Sim.qFront;
  Sim.q = function (p, id, c) { if (id !== 'childWedding' && id !== 'parentCare' && p.q.some(function (x) { return x.id === id; })) return; baseQ(p, id, c); };
  Sim.qFront = function (p, id, c) { p.q = p.q.filter(function (x) { return x.id !== id; }); baseQF(p, id, c); };
  var OWNABLE = { doc: 1, medEmp: 1, cpa: 1, tax: 1, lawIn: 1, lawBig: 1, lawGov: 1 };
  function valid(p, it) {
    var j = p.job, id = it.id, d = DEC[id];
    if (!d || (d.ok && !d.ok(p, it.c))) return false;     // 갈림길이 스스로 정한 조건(extras.js)
    switch (id) {
      case 'career': if (p.occ === 'retired' || p.occ === 'univ' || p.occ === 'prog' || p.occ === 'mil') return false; return it.c.keep ? !!j : !j;
      case 'careerFail': return !j;
      case 'promo': return !!j && D.JOBS[j.k].type === 'corp' && j.rank < 5;
      case 'erp': case 'jobchange': return !!j && D.JOBS[j.k].type === 'corp';
      case 'openPro': return !!j && !!OWNABLE[j.k] && !j.partner;
      case 'proRetire': return !!j;
      case 'bizCrisis': case 'bizExpand': return !!j && j.k === 'biz';
      case 'marry': return !!p.partner && !p.spouse;
      case 'match': return !p.partner && !p.spouse;
      case 'kids': case 'dualIncome': case 'divorce': return !!p.spouse;
      case 'childEdu': return p.kids.some(function (k) { return k.age < 19 && k.withMe !== false; });
      case 'moveUp': case 'downsize': case 'housePension': return p.home.type === 'own';
      case 'cheongyak': return p.home.type !== 'own';
      case 'admStrategy': case 'admTarget': case 'admFail': return !p.job && p.occ !== 'univ';
      case 'docPath': return !j || j.k === 'milDoc' || j.k === 'resident';
      case 'invest': case 'coinFomo': return Sim.liquid(p) > 300;
    }
    return true;
  }
  Sim.view = function (p, w) {
    while (p.q.length) {
      var it = p.q[0], v = null;
      try { if (valid(p, it)) v = DEC[it.id].build(p, w, it.c); } catch (e) { Sim.errors.push('build ' + it.id + ': ' + e.message); v = null; }
      if (v && v.opts.some(function (o) { return !o.dis; })) { v.id = it.id; if (p.isPlayer && p.fl.diff) v.opts.forEach(function (o) { if (o.prob != null) { o.base = o.prob; o.prob = H.dp(p, o.prob); } }); return v; }     // 난이도 보정은 화면에 보이는 확률에 그대로 반영된다
      p.q.shift();
    }
    return null;
  };
  // boost: 미니게임으로 얻은 성공 확률 보너스(0~0.1)
  Sim.choose = function (p, w, key, boost) {
    var v = Sim.view(p, w); if (!v) return null;
    var it = p.q.shift(), o = null, i;
    for (i = 0; i < v.opts.length; i++) if (v.opts[i].key === key && !v.opts[i].dis) o = v.opts[i];
    if (!o) for (i = 0; i < v.opts.length; i++) if (!v.opts[i].dis) { o = v.opts[i]; break; }
    if (boost > 0 && o.prob != null) { var o2 = {}; for (var kk in o) o2[kk] = o[kk]; o2.prob = clamp(o.prob + boost, 0.02, 0.97); o = o2; p.fl.mgN = (p.fl.mgN || 0) + 1; }
    var res;
    try { res = DEC[it.id].resolve(p, w, it.c, o.key, o) || {}; } catch (e) { Sim.errors.push('resolve ' + it.id + '/' + o.key + ': ' + e.message); res = { ok: null, title: '', text: '' }; }
    res.label = o.label; res.dec = v.title; res.icon = v.icon; if (boost > 0 && o.prob != null) res.boost = boost;
    if (p.isPlayer) {
      p.cur.push({ t: v.title + ' → ' + o.label + (res.prob != null ? ' (성공 확률 ' + U.pct(res.prob) + '%)' : ''), c: 'pick' });
      if (res.text) p.cur.push({ t: res.text, c: res.ok === true ? 'good' : res.ok === false ? 'bad' : '' });
      p.fl.decN = (p.fl.decN || 0) + 1;
    }
    p.happy = clamp(p.happy, 2, 99); p.health = clamp(p.health, 3, 100);
    return res;
  };
  Sim.auto = function (p, v) {
    var os = v.opts.filter(function (o) { return !o.dis; }), ws = os.map(function (o) { return Math.max(0, o.ai || 0); });
    if (!ws.some(function (x) { return x > 0; })) return os[0];
    return U.wpick(p.rng, os, ws);
  };
  function autoAll(p, w) { var n = 0, v; while ((v = Sim.view(p, w)) && n++ < 40) Sim.choose(p, w, Sim.auto(p, v).key); p.q = []; }

  /* ---------- 학교·군대·수련 ---------- */
  Sim.enroll = function (p, w, tier) {
    var Uv = D.UNIV[tier];
    p.univ = { tier: tier, name: Uv.name, left: Uv.years, y: 0, major: null, done: false }; p.occ = 'univ'; p.prep = null; p.adm = null;
    if (tier === 'medpro') { var sub = U.pick(p.rng, ['dent', 'orient', 'pharm', 'vet']); p.univ.sub = sub; p.univ.name = D.MEDPRO[sub].school; p.univ.major = 'med'; }
    else if (tier === 'med') p.univ.major = 'med'; else if (tier === 'arts') p.univ.major = 'arts'; else if (tier === 'edu') p.univ.major = 'edu';
    else if (tier === 'college') p.univ.major = 'voc2'; else Sim.q(p, 'major', {});
    p.happy += 6; ms(p, p.univ.name + '에 입학했습니다.', false);
  };
  Sim.startMil = function (p, back, pay) {
    p.mil = { left: 2, back: back, job: p.job, pay: pay || 90, inc: p.inc }; p.job = null; p.occ = 'mil'; p.inc = p.mil.pay;
  };
  function endMil(p, w) {
    var m = p.mil; p.milDone = true; p.mil = null; p.inc = 0; ms(p, '군 복무를 마쳤습니다.', false);
    if (m.back === 'univ' && p.univ && !p.univ.done) { p.occ = 'univ'; say(p, '전역했습니다. 복학 신청서를 냈습니다. 동기들은 벌써 고학년입니다.'); }
    else if (m.back === 'resu') { p.occ = 'resu'; }
    else if (m.job) { p.job = m.job; p.occ = 'work'; p.inc = Sim.jobInc(p, w); say(p, '전역 후 일터로 돌아왔습니다.'); }
    else if (p.fl.rotc && !p.fl.rotcDone) { p.fl.rotcDone = 1; p.occ = 'idle'; say(p, '의무 복무 기간이 끝나 갑니다. 군에 남을지, 사회로 나갈지 정해야 합니다.'); Sim.q(p, 'milCareer', {}); }
    else { p.occ = 'idle'; say(p, '전역했습니다. 사회의 시계는 그사이 2년을 앞서가 있었습니다.'); }
  }
  function graduate(p, w) {
    var u = p.univ, t = u.tier; u.done = true; p.deg = t === 'college' ? '전문대졸' : '대졸'; p.spec += (p.st.dil - 50) / 40;
    p.occ = 'idle';
    if (t === 'med') { say(p, '의대 6년을 마쳤습니다. 졸업식 가운이 수술 가운으로 바뀝니다.'); Sim.q(p, 'docSpec', {}); return; }
    if (t === 'medpro') {
      p.fl.lic = 'medpro'; p.fl.sub = u.sub; ms(p, D.MEDPRO[u.sub].name + ' 면허를 취득했습니다.');
      if (!p.milDone) Sim.setJob(p, w, 'milDoc'); else Sim.setJob(p, w, 'medEmp', { sub: u.sub });
      return;
    }
    say(p, U.josa(u.name, '을/를') + ' 졸업했습니다. 학사모를 던지는 사진을 찍었습니다.');
    if (!p.milDone) {
      if (p.fl.rotc) { Sim.startMil(p, 'career', 260); p.spec += 1.2; say(p, '소위로 임관했습니다. 2년 남짓 장교로 복무합니다.'); }
      else { Sim.startMil(p, 'career'); say(p, '졸업과 동시에 입대했습니다. 훈련소 동기들은 다섯 살쯤 어립니다.'); }
      return;
    }
    Sim.q(p, 'career', {});
  }
  Sim.docNext = function (p, w) {
    if (!p.milDone) { Sim.setJob(p, w, 'milDoc', { spec: p.fl.spec, dept: p.fl.dept }); say(p, '군의관·공중보건의로 3년을 복무합니다.'); }
    else Sim.q(p, 'docPath', {});
  };
  Sim.proBack = function (p, w) {
    var l = p.fl.lic, k = l === 'doc' ? 'doc' : l === 'medpro' ? 'medEmp' : l === 'law' ? 'lawIn' : l;
    Sim.setJob(p, w, k, { spec: p.fl.spec, dept: p.fl.dept, sub: p.fl.sub });
    p.job.y = Math.min(p.fl.proY || 0, 20); p.inc = Sim.jobInc(p, w);
  };
  function progDone(p, w) {
    var g = p.prog; p.prog = null; p.occ = 'idle';
    if (g.k === 'law') { say(p, '로스쿨 3년 과정을 마쳤습니다.'); Sim.q(p, 'barExam', {}); return; }
    if (g.k === 'grad') { p.deg = '석사'; p.spec += 1.5; ms(p, '석사 학위를 받았습니다.'); }
    else if (g.k === 'phd') { p.deg = '박사'; p.spec += 1; ms(p, '박사 학위를 받았습니다.'); }
    else if (g.k === 'abroad') { p.deg = '석사'; p.spec += 3; p.fl.abroad = 1; p.fl.lang = 1; if (p.univ && D.UNIV[p.univ.tier].cut < D.UNIV.top.cut) p.univ.tier = 'abroad'; ms(p, '해외 석사 학위를 받고 귀국했습니다.'); }
    Sim.q(p, 'career', {});
  }

  /* ---------- 부모·집안 ---------- */
  function famYear(p, w, a) {
    var f = p.fam, r = p.rng, E = D.FAM_EVENTS;
    if (a >= 2 && a <= 17 && f.alive > 0) {
      if (chance(r, E.fail)) { f.assets = Math.round(f.assets * (1 - U.range(r, E.failLoss))); f.inc = Math.round(f.inc * 0.6); f.cls = Math.max(1, f.cls - 1); f.harmony -= 8; p.happy -= 6; p.fl.famFail = 1; say(p, '집안 사업이 기울었습니다. 어른들의 목소리가 낮아지고, 이사 이야기가 나옵니다.', 'bad'); }
      else if (chance(r, E.rise)) { f.assets = Math.round(f.assets * (1 + U.range(r, E.riseGain)) + 3000); f.inc = Math.round(f.inc * 1.4); f.cls = Math.min(5, f.cls + 1); say(p, '부모님 일이 잘 풀렸습니다. 외식 메뉴가 달라졌습니다.', 'good'); }
      else if (!p.fl.pDiv && chance(r, E.divorce * (f.harmony < 40 ? 2.5 : 1))) { p.fl.pDiv = 1; f.harmony = Math.max(5, f.harmony - 20); f.inc = Math.round(f.inc * 0.7); p.happy -= 9; say(p, '부모님이 따로 살기로 했습니다. 주말마다 가방을 쌉니다.', 'bad'); }
    }
    if (a < 40 && f.cls >= 4) f.assets *= 1.012; else if (a >= 38 && f.cls <= 2) f.assets *= 0.97;
    [['f', f.fDeath, '아버지'], ['m', f.mDeath, '어머니']].forEach(function (x) {
      if (a === x[1] - 2 && a >= 30 && f.alive > 0) Sim.q(p, 'parentCare', { who: x[0] });
      if (a === x[1]) {
        f.alive--; p.happy -= a < 30 ? 15 : 8; ms(p, x[2] + '께서 세상을 떠나셨습니다.', 'bad');
        if (x[0] === 'f') { p.fl.fDead = a; if (p.job && p.job.k === 'heir' && !p.job.ceo) Sim.q(p, 'heirCeo', {}); }     // 가업: 아버지의 자리를 잇는다
        if (f.alive <= 0) {
          var share = f.assets / (f.sib + 1), tax = Math.max(0, share - D.GIFT.inheritFree) * D.GIFT.inheritTax, net = Math.round(share - tax);
          f.assets = 0; p.fl.psup = 0;
          if (p.isPlayer && a >= 19 && Sim.estate) Sim.estate(p, w, share);     // 플레이어의 상속은 건물·빚·한정승인까지 다룬다(extras.js)
          else if (a >= 19 && net >= 100) { p.cash += net; p.fl.inherit = net; if (net >= 3000) ms(p, '부모님으로부터 ' + won(net) + '을 상속받았습니다.'); else say(p, '부모님이 남긴 것은 ' + won(net) + '과 오래된 사진첩이었습니다.'); }
          else if (a >= 19) say(p, '부모님이 남긴 재산은 없었습니다. 장례비는 형제들과 나눠 냈습니다.');
          if (p.home.type === 'parents' && a >= 19) { p.home = { type: 'none', region: p.region }; }
        }
      }
    });
    if (a >= 36 && a <= 50 && f.cls <= 2 && f.alive > 0 && !p.fl.psAsk && p.inc > 0) Sim.q(p, 'parentSupport', {});
    if (p.fl.pcare && a > p.fl.pcare) { p.fl.pcare = 0; }
  }

  /* ---------- 직장의 한 해 ---------- */
  function lose(p, w, why, msText, sayText) { Sim.leaveJob(p, w, why); ms(p, msText, false); say(p, sayText, 'bad'); p.happy -= 8; Sim.q(p, 'career', {}); }
  function workYear(p, w, a) {
    var j = p.job, k = j.k, J = D.JOBS[k], m = w.macro[a], r = p.rng, sev, DF = H.diff(p);
    j.y++; j.ry++; if (p.over > 0) p.over--;
    p.fl.jy = p.fl.jy || {}; p.fl.jy[k] = (p.fl.jy[k] || 0) + 1;
    if (k === 'heir') { p.fl.heirY = j.y; p.fl.heirM = j.mult; }
    if (J.rankAge && a >= J.rankAge[j.rank]) {     // 계급정년
      var mt = Sim.jobTitle(p); sev = Sim.leaveJob(p, w, 'retire'); if (j.rank >= 4) p.fl.highPost = 1;
      ms(p, U.josa(mt, '으로/로') + ' 전역했습니다.'); say(p, '계급정년입니다. 전역식에서 마지막 경례를 받았습니다. 군복은 벗었지만 군인연금이 남았습니다.');
      Sim.q(p, 'career', {}); return;
    }
    if (J.type === 'pro' || J.type === 'own') p.fl.proY = (p.fl.proY || 0) + 1;
    if (J.retire && a >= J.retire) {
      var t = Sim.jobTitle(p); sev = Sim.leaveJob(p, w, 'retire'); p.fl.fullRetire = k;
      ms(p, U.josa(t, '으로/로') + ' 정년퇴직했습니다.'); if (sev) say(p, '퇴직금 ' + won(sev) + '이 들어왔습니다. 꽃다발과 감사패를 들고 마지막 퇴근을 했습니다.');
      if (J.type === 'steady' && J.pen === 'civil' || k === 'docProf' || k === 'lawGov') p.fl.highPost = p.fl.highPost || (k === 'civil5' || k === 'prof' || k === 'docProf' || k === 'lawGov' ? 1 : 0);
      Sim.q(p, 'career', {}); return;
    }
    if ((J.maxAge && a >= J.maxAge) || a >= 82 || (a >= 68 && p.health < 22)) {
      if (k === 'biz') p.cash += (j.cap || 0) * 0.3;
      Sim.leaveJob(p, w, 'old'); p.occ = 'retired'; ms(p, a >= 78 ? '여든 가까이 지켜 온 일터를 떠났습니다.' : '몸이 따라주지 않아 일을 그만뒀습니다.'); return;
    }
    switch (J.type) {
      case 'corp':
        if (chance(r, (J.layoff || 0) * m.layoff * DF.layoff)) { lose(p, w, 'layoff', '회사 사정으로 일자리를 잃었습니다.', k === 'small' ? '회사가 문을 닫았습니다. 마지막 달 월급은 석 달 뒤에 들어왔습니다.' : '구조조정 명단에 이름이 올랐습니다. 책상을 정리하는 데는 상자 하나면 충분했습니다.'); return; }
        if (j.rank === 5 && chance(r, J.execOut)) { Sim.leaveJob(p, w, 'execOut'); ms(p, J.mil ? '장군으로 군 생활을 마치고 전역했습니다.' : '임원 계약이 연장되지 않아 퇴임했습니다.'); say(p, J.mil ? '전역식 사열대에 섰습니다. 수십 년 입은 군복을 옷걸이에 걸었습니다.' : '12월 인사 발표. 내 이름은 "퇴임" 명단에 있었습니다. 임원은 임시 직원의 줄임말이었습니다.'); Sim.q(p, 'career', {}); return; }
        var et = D.ERP[k];
        if (et && j.rank < 5 && !(j.safe > a) && chance(r, U.after(et, a) * m.layoff * DF.layoff)) { Sim.q(p, 'erp', {}); break; }
        if (j.rank < 4 && j.ry >= J.ranks[j.rank][2]) {
          if (j.rank === 1 || j.rank === 3) Sim.q(p, 'promo', {});
          else if (chance(r, H.pr(p, J.ranks[j.rank][3], D.PROMO.stats, H.teamBonus(p) + DF.promo))) { j.rank++; j.ry = 0; say(p, U.josa(J.ranks[j.rank][0], '으로/로') + ' 승진했습니다. 명함을 새로 팠습니다.', 'good'); p.happy += 3; }
          else j.ry -= 1;
        } else if (j.rank === 4 && a >= 44 && a <= 55 && j.ry >= 3) {
          if (!j.execTried) Sim.q(p, 'promo', {});
          else if (chance(r, J.exec * 0.25 * DF.exec * (DF.execFloor ? 2.5 : 1))) { j.rank = 5; j.ry = 0; if (J.mil) { p.fl.general = 1; p.fl.highPost = 1; } else if (k !== 'small') { p.fl.exec = 1; p.fl.highPost = 1; } else p.fl.smExec = 1; ms(p, J.name + ' ' + U.josa(J.ranks[5][0], '으로/로') + ' 승진했습니다.', 'good'); }
        }
        if (a < 45 && j.rank < 4 && j.y % D.JOBCHANGE.every === 0 && (k === 'large' || k === 'mid' || k === 'small')) Sim.q(p, 'jobchange', {});
        break;
      case 'steady':
        if (chance(r, (J.layoff || 0) * m.layoff * DF.layoff)) { lose(p, w, 'layoff', '일자리를 잃었습니다.', k === 'service' ? '계약 기간이 끝났습니다. 재계약 이야기는 없었습니다.' : '일감이 끊겨 회사를 나왔습니다.'); return; }
        if (k === 'startup') {
          if (chance(r, J.fold * m.biz)) { lose(p, w, 'fold', '다니던 스타트업이 문을 닫았습니다.', '투자 유치에 실패한 회사가 폐업했습니다. 스톡옵션 계약서는 종이가 됐습니다.'); return; }
          if (chance(r, J.jackpot)) { var amt = Math.round(Math.exp(Math.log(J.jackpotAmt[0]) + U.rnd(r) * Math.log(J.jackpotAmt[1] / J.jackpotAmt[0])) / 100) * 100; p.cash += amt; p.fl.jackpot = amt; ms(p, '회사가 상장해 스톡옵션으로 ' + won(amt) + '을 벌었습니다.', 'good'); p.happy += 8; }
        }
        if ((k === 'service' || k === 'factoryS') && a < 50 && j.y % 3 === 0) Sim.q(p, 'career', { keep: 1 });
        if (k === 'heir' && !j.ceo && U.after(D.HEIR.ranks, j.y) !== U.after(D.HEIR.ranks, j.y - 1)) { say(p, U.josa(U.after(D.HEIR.ranks, j.y), '으로/로') + ' 승진했습니다. 인사 발령 공지에 축하 댓글이 유난히 많이 달렸습니다.', 'good'); p.hist.push({ a: a, t: Sim.jobTitle(p) }); }
        if (k === 'factoryL' && p.fl.medal && j.y === 15) { j.mult *= 1.15; p.fl.master = 1; ms(p, '대한민국 명장으로 선정됐습니다.', 'good'); p.happy += 8; }
        break;
      case 'pro':
        if (k === 'resident' && j.y >= 5) { ms(p, j.dept + ' 전문의 자격을 취득했습니다.'); Sim.docNext(p, w); if (!p.job || p.job.k === 'resident') { } return; }
        if (k === 'milDoc' && j.y >= 3) { p.milDone = true; if (p.fl.lic === 'medpro') { Sim.setJob(p, w, 'medEmp', { sub: p.fl.sub }); say(p, '복무를 마치고 ' + U.josa(D.MEDPRO[p.fl.sub].name, '으로/로') + ' 일하기 시작했습니다.'); } else Sim.q(p, 'docPath', {}); return; }
        if (k === 'lawBig' && !j.partner && j.y === J.partnerAt) {
          if (chance(r, H.pr(p, J.partner, { iq: 0.4, social: 0.5, dil: 0.3 }))) { j.partner = 1; p.fl.highPost = 1; ms(p, '대형 로펌 파트너 변호사가 되었습니다.', 'good'); p.happy += 8; }
          else { Sim.setJob(p, w, chance(r, 0.5) ? 'lawIn' : 'lawSolo'); p.job.y = 9; say(p, '파트너 심사에서 떨어졌습니다. 로펌을 나와 ' + U.josa(Sim.jobTitle(p), '으로/로') + ' 새 출발을 합니다.'); return; }
        }
        if (OWNABLE[k] && !j.partner && a < 58 && j.y >= 3 && j.y % 6 === 3) Sim.q(p, 'openPro', {});
        if (!J.retire && (a === 70 || a === 77)) Sim.q(p, 'proRetire', {});
        break;
      case 'own':
        if (j.mult < 1) j.mult += (1 - j.mult) * 0.2;     // 개업 초기에 고전해도 해마다 단골과 평판이 쌓인다
        Sim.rollVar(p, w);
        if (chance(r, DF.bad * J.close * (j.y < 5 ? 1 : 0.3) * m.biz * (j.mult < 0.6 ? 2.5 : 1))) {
          var nm = Sim.jobTitle(p); p.fl.proClosed = 1; ms(p, U.josa(nm, '을/를').replace('개업 ', '') + ' 접었습니다. 개업 대출은 남았습니다.', 'bad'); Sim.proBack(p, w); p.happy -= 8;
          say(p, '간판을 내리고 ' + U.josa(Sim.jobTitle(p), '으로/로') + ' 돌아갔습니다. 월급의 절반은 대출 상환에 씁니다.'); return;
        }
        if (a === 70 || a === 77) Sim.q(p, 'proRetire', {});
        break;
      case 'biz':
        Sim.rollVar(p, w);
        if (k === 'biz') {
          var B = D.BIZ[j.biz], Z = D.BIZ_RULE, pc = B.close * (j.y < 3 ? Z.earlyMult : j.y < 7 ? Z.midMult : Z.lateMult) * m.biz * (j.mult < 0.7 ? 1.7 : j.mult > 1.4 ? 0.45 : 1);
          if (j.held === a - 1) pc *= 0.3;
          if (chance(r, pc * DF.bad)) Sim.q(p, 'bizCrisis', {});
          else if (!j.exp && !j.expAsked && j.mult > 1.5 && j.y >= 3 && a < 62) Sim.q(p, 'bizExpand', {});
        } else {
          var F = D.FOUNDER;
          if (chance(r, Math.min(0.12, F.exit * Math.pow(j.mult, 0.8)))) {
            var ex = Math.round(Math.exp(Math.log(F.exitAmt[0]) + Math.pow(U.rnd(r), 2.2) * Math.log(F.exitAmt[1] / F.exitAmt[0])) / 1000) * 1000;
            p.cash += ex; p.fl.exit = ex; p.fl.highPost = 1; Sim.leaveJob(p, w, 'exit'); ms(p, '창업한 회사를 ' + won(ex) + '에 매각했습니다.', 'good'); p.happy += 12; Sim.q(p, 'career', {}); return;
          }
          if (chance(r, F.fail * m.biz / Math.sqrt(Math.max(0.4, j.mult)))) { Sim.pay(p, U.range(r, [0, 6000])); p.fl.bizClosed = (p.fl.bizClosed || 0) + 1; lose(p, w, 'close', '창업한 회사를 정리했습니다.', '런웨이가 끝났습니다. 직원들에게 마지막 월급을 주고 법인을 청산했습니다.'); return; }
        }
        break;
      case 'gig':
        if (k === 'celeb' && Sim.celebYear) Sim.celebYear(p, w, a);
        Sim.rollVar(p, w);
        if (k === 'artist') {
          var ts = p.st.talent + p.art;
          if (!j.star && chance(r, J.star * clamp(1 + (ts - 60) * 0.06, 0.15, 6))) { j.star = 1; j.starInc = Math.round(U.range(r, J.starInc)); p.fl.star = 1; ms(p, '작품이 주목받으며 이름을 알렸습니다.', 'good'); p.happy += 10; }
          else if (j.star && chance(r, 0.12)) { j.star = 0; say(p, '찾는 곳이 줄었습니다. 무대의 조명은 다음 사람에게 넘어갔습니다.'); }
          if (!j.star && a < 45 && j.y % 5 === 0) Sim.q(p, 'career', { keep: 1 });
        } else if ((k === 'parttime' || k === 'delivery' || k === 'lecturer' || k === 'freelance') && a < 50 && j.y % 3 === 0) Sim.q(p, 'career', { keep: 1 });
        break;
    }
    if (p.job && !J.retire && (a === 65 || a === 70 || a === 75 || a === 78)) Sim.q(p, 'proRetire', {});
    if (p.job) p.inc = Sim.jobInc(p, w);
  }

  /* ---------- 연애·자녀 ---------- */
  function loveYear(p, w, a) {
    var r = p.rng, L = D.LOVE;
    if (p.spouse) {
      var fAge = p.sex === 'F' ? a : p.spouse.age;
      if (p.fl.kidAsk && a >= p.fl.kidAsk && fAge < 46 && p.kids.length < 3) Sim.q(p, 'kids', {});
      if (p.mq < L.divorceMq && (!p.fl.divAsk || a - p.fl.divAsk >= 4)) Sim.q(p, 'divorce', {});
      return;
    }
    if (p.noMarry || a > 68) return;
    var pt = p.partner;
    if (pt) {
      pt.yrs++; pt.age++;
      var bond = pt.bond || 0; if (bond) pt.bond--;
      if (chance(r, H.diff(p).bad * L.breakup * (pt.yrs > 3 ? 0.5 : 1) * Math.max(0.4, 1 - bond * 0.15) * (pt.aff == null ? 1 : clamp(1.7 - pt.aff / 50, 0.2, 1.8)))) { p.partner = null; p.happy -= 6; say(p, U.josa(pt.name, '과/와') + ' 헤어졌습니다. 함께 가던 식당 앞을 한동안 돌아서 다녔습니다.'); return; }
      if (((a >= 26 && pt.yrs >= 2) || (a >= 31 && pt.yrs >= 1)) && a - pt.asked >= 2) Sim.q(p, 'marry', {});
      return;
    }
    var of = p.occ === 'univ' ? 1.3 : p.job ? 1 : p.occ === 'mil' ? 0.2 : 0.5, af = a < 35 ? 1 : a < 45 ? 0.5 : 0.2;
    var meet = L.meet * (1 + (p.st.looks - 50) * 0.012 + (p.st.social - 50) * 0.012) * of * af * (p.divorces ? 0.7 : 1);
    if (chance(r, meet)) { p.partner = Sim.mkPartner(p); p.happy += 5; say(p, U.josa(p.partner.name, '과/와') + ' 연애를 시작했습니다. 휴대폰을 보며 웃는 일이 늘었습니다.', 'good'); }
    else if (a === 31 || a === 36 || a === 41) Sim.q(p, 'match', {});
  }
  var KID_TIERS = ['med', 'sky', 'top', 'seoul', 'natl', 'local', 'college'];
  function kidsYear(p, w, a) {
    var r = p.rng;
    p.kids.forEach(function (k, i) {
      k.age++; if (p.isPlayer && Sim.kidLine) Sim.kidLine(p, k, i);
      if (k.age === 7 && !(p.fl.ceE && a - p.fl.ceE < 3) && k.withMe !== false) { p.fl.ceE = a; Sim.q(p, 'childEdu', { stage: 'elem' }); }
      if (k.age === 13 && !(p.fl.ceS && a - p.fl.ceS < 3) && k.withMe !== false) { p.fl.ceS = a; Sim.q(p, 'childEdu', { stage: 'sec' }); }
      if (k.age === 19) {
        var sc = 50 + 0.58 * (k.iq - 50) + D.KID.edu[k.lvl].score + (Sim.netWorth(p) > 100000 ? 1.5 : 0) + D.REG[p.region].acad + ((k.rel || 50) - 50) * 0.03 + U.norm(r) * 6; k.tier = 'hs';
        for (var t = 0; t < KID_TIERS.length; t++) if (sc >= D.UNIV[KID_TIERS[t]].cut) { k.tier = KID_TIERS[t]; break; }
        if (k.art && k.tier !== 'med' && k.tier !== 'sky') k.tier = 'arts';
        if (k.tier === 'hs') say(p, (i ? '둘째 ' : '첫째 ') + U.josa(k.name, '은/는') + ' 대학 대신 일을 시작했습니다.');
        else { var good = k.tier === 'med' || k.tier === 'sky' || k.tier === 'top'; (good ? ms : say)(p, '자녀 ' + U.josa(k.name, '이/가') + ' ' + D.UNIV[k.tier].name + '에 합격했습니다.' + (good && k.lvl === 2 ? ' 학원비 영수증이 아깝지 않은 날입니다.' : ''), good ? 'good' : ''); if (good) p.happy += 5; }
      }
      if (k.age === 27) {
        var g = { med: 5, sky: 3.6, top: 3, seoul: 2.3, natl: 1.9, local: 1.3, college: 1.1, hs: 0.8, arts: 1.5 }[k.tier] + U.norm(r) * 0.9 + (Sim.netWorth(p) > 200000 ? 0.5 : 0);
        k.job = k.art && k.tier === 'arts' ? (g > 2.4 ? '이름난 예술인' : g > 1.2 ? '예술인' : '취업 준비생') : k.tier === 'med' ? '의사' : g > 3.4 ? '대기업 직원' : g > 2.6 ? '공기업 직원' : g > 2.0 ? '공무원' : g > 1.3 ? '중소기업 직원' : g > 0.6 ? '계약직' : '취업 준비생';
        k.good = g > 1.3; say(p, '자녀 ' + U.josa(k.name, '은/는') + ' ' + (k.job === '취업 준비생' ? '아직 취업 준비 중입니다. 방문 너머로 한숨이 들립니다.' : U.josa(k.job, '으로/로') + ' 자리를 잡았습니다.'));
      }
      if ((k.age === 31 || k.age === 35) && !k.married && chance(r, k.age === 31 ? 0.5 : 0.35)) { k.married = k.age; Sim.q(p, 'childWedding', { i: i }); }
      if (k.married && k.age === k.married + 2 && chance(r, 0.6)) { k.grand = 1; p.happy += 6; say(p, '손주가 태어났습니다. 휴대폰 사진첩이 아기 사진으로 가득 찹니다.', 'good'); p.fl.grand = (p.fl.grand || 0) + 1; }
    });
    if (p.fl.supUntil && a >= p.fl.supUntil) { p.support = 0; p.fl.supUntil = 0; }
  }
  function spouseYear(p, w, a) {
    var sp = p.spouse, r = p.rng; if (!sp) return;
    sp.age++;
    if (!sp.works && sp.back && a >= sp.back && sp.age < 55) { sp.works = true; sp.back = 0; sp.base = Math.round(sp.base * 0.62 / 10) * 10; sp.job = sp.base < 230 ? '비정규직' : sp.job; say(p, '배우자가 다시 일을 시작했습니다. 예전 직급과 연봉은 돌아오지 않았습니다.'); }
    if (sp.works) { sp.inc = Math.round(sp.base * (1 + clamp(sp.age - 30, 0, 20) * 0.015) / 5) * 5; if (sp.age >= 60) { sp.works = false; sp.inc = 0; say(p, '배우자가 일을 그만뒀습니다.'); } }
    if (sp.age === 65) sp.pension = Math.round(Math.min(180, 25 + sp.base * 0.13));
    p.mq = clamp(p.mq + (62 - p.mq) * 0.08 + U.norm(r) * 3.2 - (p.over ? 2.5 : 0) - (p.fl.care ? 1.2 : 0) - (p.fl.tight === a ? 3 : 0) + (p.st.social - 50) * 0.02, 0, 100);
    if (p.fl.care && !p.kids.some(function (k) { return k.age < 7; })) p.fl.care = 0;
    if (sp.age >= sp.deathAge) {
      ms(p, '배우자 ' + U.josa(sp.name, '이/가') + ' 세상을 떠났습니다.', 'bad'); say(p, '장례식장의 사흘은 길었고, 돌아온 집은 너무 조용했습니다.');
      p.pension = (p.pension || 0) + Math.round((sp.pension || 0) * 0.4); p.spouse = null; p.married = false; p.widowed = true; p.happy -= 18;
    }
  }

  /* ---------- 한 해의 시작 ---------- */
  var DISEASES = ['위암', '대장암', '갑상선암', '심근경색', '뇌졸중', '폐암', '간 질환', '유방암', '전립선암'];
  function adultYear(p, w, a) {
    var r = p.rng, h, st;
    // 병역
    if (!p.milDone && p.occ !== 'mil' && p.occ !== 'univ' && p.occ !== 'prog' && !(p.univ && (p.univ.tier === 'med' || p.univ.tier === 'medpro')) && ((a >= 20 && p.occ !== 'resu' && p.occ !== 'child') || a >= 22)) {
      var back = p.occ === 'resu' ? 'resu' : 'career'; Sim.startMil(p, back); say(p, '입영 통지서가 왔습니다. 스무 살 남짓의 청년들이 같은 머리를 하고 연병장에 섰습니다.');
    }
    if (p.occ === 'mil' && p.mil.left <= 0) endMil(p, w);
    st = p.occ;
    if (st === 'child') { if (a === 19) Sim.q(p, 'admStrategy', {}); else { p.occ = 'idle'; st = 'idle'; } }
    if (st === 'resu') Sim.q(p, 'admStrategy', {});
    else if (st === 'univ') {
      var u = p.univ;
      if (u.left <= 0) graduate(p, w);
      else {
        var Uv = D.UNIV[u.tier], f = p.fam;
        if (f.alive > 0 && (f.inc * 12 * 0.22 >= Uv.tuition || f.assets >= Uv.tuition * 5)) f.assets = Math.max(0, f.assets - Uv.tuition * 0.5);
        else { p.debt += Uv.tuition + 400; if (u.y === 0) say(p, '등록금은 학자금 대출로 냈습니다. 졸업장보다 먼저 빚이 생겼습니다.'); }
        if (u.y === 1 && !p.milDone && !p.fl.milAfter && !p.fl.rotc && u.tier !== 'med' && u.tier !== 'medpro') Sim.q(p, 'milTiming', {});
        if (u.y === 2 && Uv.years === 4 && !p.fl.ulife) { p.fl.ulife = 1; Sim.q(p, 'univLife', {}); }
      }
    } else if (st === 'prog') {
      if (p.prog.left <= 0) progDone(p, w);
      else if (p.prog.cost) { if (H.lump(p, p.prog.cost) === 'self' && p.prog.left === 3) say(p, '학비와 생활비는 대출입니다. 마이너스 통장의 숫자가 해마다 커집니다.'); }
    } else if (st === 'home') {
      if (a >= (p.fl.homeUntil || 0) || !p.spouse) { p.occ = 'idle'; say(p, '아이가 학교에 가기 시작했습니다. 이력서의 공백을 어떻게 설명할지 고민합니다.'); }
    }
    if (p.occ === 'work' && p.job) workYear(p, w, a);
    if ((p.occ === 'idle' || p.occ === 'prep') && !p.job) {
      if (a >= 76) { p.occ = 'retired'; }
      else if (p.prep && p.prep.what === 'bar') Sim.q(p, 'barExam', {});
      else Sim.q(p, 'career', {});
    }
    loveYear(p, w, a);
    if (p.kids.length) kidsYear(p, w, a);
    // 주거
    h = p.home;
    var hq = p.q.some(function (x) { return x.id === 'housing'; });
    if (!hq) {
      if (p.fl.needHome || h.type === 'none') { p.fl.needHome = 0; Sim.q(p, 'housing', { why: h.type === 'none' && p.fl.forced === a - 1 ? 'forced' : 'job' }); }
      else if (h.type === 'parents') { if (p.job && a >= 27 && a - (p.fl.houseAsk || 0) >= 3) Sim.q(p, 'housing', { why: 'job' }); }
      else if (h.type === 'jeonse' || h.type === 'monthly') {
        if (a > h.since && (a - h.since) % 4 === 0 && a < 80) Sim.q(p, 'housing', {});
        else if (a >= 27 && a <= 55 && p.inc > 0 && chance(r, 0.12)) Sim.q(p, 'cheongyak', {});
      } else if (h.type === 'own') {
        if (a >= 30 && a <= 58 && (a - h.since) % 6 === 5) { try { var mv = DEC.moveUp.build(p, w, {}); if (mv.opts.some(function (o) { return o.buy && !o.dis; })) Sim.q(p, 'moveUp', {}); } catch (e) { Sim.errors.push('moveUp ' + e.message); } }
        if ((a === 63 || a === 72) && !p.rm) Sim.q(p, 'downsize', {});
        if ((a === 66 || a === 71 || a === 76) && !p.rmPay && Sim.myInc(p) < 200) Sim.q(p, 'housePension', {});
      }
    }
    // 재테크
    if (a >= 24 && a < 68 && p.inc > 0 && Sim.liquid(p) > 1500 && (!p.fl.invAsk || a - p.fl.invAsk >= 7) && !(p.fl.qmA >= a - 1)) { p.fl.invAsk = a; Sim.q(p, 'invest', {}); }
    if (a >= 22 && a <= 60 && w.coin[a - 1].k === 'coinBoom' && Sim.liquid(p) > 1000 && (!p.fl.coinAsk || a - p.fl.coinAsk >= 6) && !H.muted(p, 'coinFomo')) Sim.q(p, 'coinFomo', {});
    if (a >= 70 && p.inv !== 'save' && p.inv !== 'manual') p.inv = 'save';
    // 건강
    if (a === 25 || a === 45 || a === 60) Sim.q(p, 'habits', {});
    if (a === 40) Sim.q(p, 'checkup', {});
    if (a >= 35 && !(p.fl.lastSick && a - p.fl.lastSick < 5)) {
      var pd = U.step(D.HEALTH.disease, a) * (p.hab.vice ? 1.6 : 1) * (p.hab.ex ? 0.8 : 1) * clamp(1 + (60 - p.health) / 100, 0.7, 1.6);
      if (chance(r, pd * H.diff(p).bad)) { p.fl.lastSick = a; var early = chance(r, p.hab.chk === 2 || p.fl.chkY >= a - 1 ? 0.75 : p.hab.chk === 1 ? 0.45 : 0.12); Sim.q(p, 'disease', { name: U.pick(r, DISEASES.filter(function (d) { return d !== (p.sex === 'M' ? '유방암' : '전립선암'); })), early: early }); }
    }
    // 노년
    if ((a === 66 || a === 70) && !p.job && !p.fl.rl) Sim.q(p, 'retireLife', {});
    if (a === 80) Sim.q(p, 'will', {});
    if (a >= 68 && p.health < 27 && !p.fl.careAsk) Sim.q(p, 'eldercare', {});
  }
  Sim.yearStart = function (p, w) {
    p.age++; var a = p.age; p.cur = []; p.phase = 'mid';
    if (a === 0) { say(p, U.fill(U.pick(p.rng, T.BIRTH), { region: D.REG[p.region].name, job: p.fam.job })); return; }
    famYear(p, w, a);
    if (a <= 18) {
      if (a === 4) Sim.q(p, 'kinder', {});
      else if (a === 6) Sim.q(p, 'earlyArts', {});
      else if (a === 7) { say(p, '초등학교에 입학했습니다. 가방이 몸보다 큽니다.'); Sim.q(p, 'tutorElem', {}); }
      else if (a === 13) { Sim.q(p, 'middle', {}); Sim.q(p, 'tutorMid', {}); }
      else if (a === 15) Sim.q(p, 'hsPrep', {});
      else if (a === 16) Sim.q(p, 'high', {});
      else if (a === 17) { Sim.q(p, p.school.high === 'voc' ? 'vocLife' : 'highLife', {}); if (p.st.looks >= 74 && U.hash(p.id + 'cast') % 2 === 0) Sim.q(p, 'casting', {}); }
      else if (a === 18) { if (p.school.high === 'voc') { if (p.fl.skill) Sim.q(p, 'skillComp', {}); } else if (p.school.high !== 'arts') Sim.q(p, 'examPrep', {}); }
    } else adultYear(p, w, a);
  };

  /* ---------- 돈의 한 해 ---------- */
  function childCost(k, p) {
    if (k.withMe === false || k.age >= 23) return 0;
    var c = U.after(D.KID.base, k.age), e = D.KID.edu[k.lvl];
    if (k.age >= 7 && k.age < 13) c += e.elem; else if (k.age >= 13 && k.age < 19) c += e.sec;
    if (k.age < 7 && p.fl.care) c += D.KID.care;
    return c;
  }
  function startPension(p) {
    var P = D.PENSION, n = p.pen, nat = 0, civ = 0;
    if (n.y >= P.minYears) nat = (Math.min(n.s / n.y, P.cap) * 0.5 + P.avgA * 0.5) * P.perYear * Math.min(n.y, 40); else if (n.y > 0) p.cash += n.s * 0.09 * 12;
    if (n.cy >= P.minYears) civ = (n.cs / n.cy) * P.civilPerYear * Math.min(n.cy, 36); else if (n.cy > 0) p.cash += n.cs * 0.09 * 12;
    p.pension = Math.round(nat + civ) + (p.pension || 0);
    if (p.pension > 0) say(p, '연금 수령이 시작됐습니다. 매달 25일, ' + won(p.pension) + '이 들어옵니다.' + (civ > 150 ? ' 박봉을 견딘 세월이 이제야 값을 합니다.' : nat < 70 ? ' 용돈 연금이라는 말이 실감 납니다.' : ''));
    else say(p, '연금 가입 기간이 모자라 받을 연금이 없습니다.', 'bad');
  }
  function bankrupt(p, w) {
    if (p.home.type === 'own' || p.home.deposit) Sim.releaseHome(p);
    p.cash += Math.max(0, Sim.gapEq(p)); p.gaps = [];
    if (p.car) { p.cash += p.car.value * 0.7; p.car = null; }
    if (p.bld && p.bld.length) { p.cash += Sim.bldVal(p) * 0.85; p.bld = []; }
    var liq = Sim.liquid(p); p.cash = 0; p.stock = 0; p.coin = 0; p.debt = Math.max(0, p.debt - liq);
    p.fl.bkDebt = p.debt; p.debt = 0; p.fl.bk = (p.fl.bk || 0) + 1; p.fl.bkAge = p.age; p.happy -= 15;
    ms(p, '빚을 감당하지 못해 개인회생을 신청했습니다.', 'bad');
    p.home = { type: 'none', region: p.region }; p.fl.forced = p.age;
  }
  function finance(p, w) {
    var a = p.age, m = w.macro[a], r = p.rng, sp = p.spouse, h = p.home, g, gi, GL = Sim.gaps(p);
    p.cash *= 1 + D.RATE.deposit;
    if (p.fl.qmA !== a) {     // 분기 진행 중인 플레이어는 분기마다 이미 시세가 반영됐다(quarter.js)
      if (p.stock > 0) p.stock *= Math.max(0.05, 1 + m.stock - D.RATE.stockDrag + U.norm(r) * 0.06);
      if (p.coin > 0) p.coin *= Math.max(0.05, 1 + w.coin[a].r + U.norm(r) * 0.15);
    }
    if (p.car) { p.car.value = Math.round(p.car.value * D.CAR_DEP); p.car.y++; }
    if (h.type === 'own') h.value = Math.round(h.value * (1 + w.hg[h.region][a]));
    if (p.bld) p.bld.forEach(function (b) { b.value = Math.round(b.value * (1 + w.hg[b.region][a] * D.BLD_GROW)); });
    for (gi = GL.length - 1; gi >= 0; gi--) {     // 갭투자 주택마다 시세가 움직이고, 위기·금리 인상기에는 역전세가 난다
      g = GL[gi]; g.value = Math.round(g.value * (1 + w.hg[g.region][a]));
      var gnm = D.REG[g.region].short + (g.kind === 'villa' ? ' 빌라' : ' 아파트');
      if (m.k === 'crisis' || m.k === 'hike') {
        var need = g.value * 0.06;
        if (Sim.liquid(p) < need) say(p, gnm + '에 역전세가 났습니다. 세입자에게 돌려줄 돈이 없어 집을 급매로 내놓았습니다. ' + Sim.sellGap(p, true, gi), 'bad');
        else { Sim.pay(p, need); g.dep -= need; say(p, gnm + '의 전세 시세가 내려 세입자에게 ' + won(need) + '을 돌려줬습니다.'); }
      } else if (a >= 70) say(p, '갭투자한 ' + gnm + '를 정리했습니다. ' + Sim.sellGap(p, false, gi));
    }
    if (a === D.PENSION.start) startPension(p);
    var gross = p.inc; if (p.fl.leave === a) gross *= 0.4;
    var net = gross - Sim.tax(gross), spNet = sp && sp.works && sp.inc > 0 ? sp.inc - Sim.tax(sp.inc) : 0;
    var nw0 = Sim.netWorth(p);
    p.allow = a >= 70 && nw0 < 10000 ? p.kids.filter(function (k) { return k.good && (k.rel || 50) >= 45; }).length * 20 : 0;
    var hh = net + spNet + (p.pension || 0) + (sp ? sp.pension || 0 : 0) + (p.rmPay || 0) + p.allow + Sim.rentInc(p) * (1 - D.BLD_COST);
    var dep = h.type === 'parents' && p.fam.alive > 0, adults = sp ? 2 : 1, minL = D.LIVE.base + (adults - 1) * D.LIVE.addAdult;
    if (a >= D.PENSION.start && nw0 < D.PENSION.basicAssetLimit && (p.pension || 0) < 150) hh += D.PENSION.basic * (sp ? 1.6 : 1);
    var wf = D.LIVE.welfare * (adults === 2 ? 1.6 : 1);
    if (!dep && hh < wf && nw0 < D.LIVE.welfareAsset && p.occ !== 'univ' && p.occ !== 'mil') { hh = wf; p.fl.welfare = (p.fl.welfare || 0) + 1; if (p.fl.welfare === 1) say(p, '기초생활수급 신청서를 냈습니다. 주민센터 창구 앞에서 오래 망설였습니다.', 'bad'); }
    var spend;
    if (dep) spend = Math.min(hh * 0.55, 130);
    else {
      spend = minL + D.LIVE.mpc * Math.max(0, hh - minL);
      if (nw0 > 100000) spend += (nw0 - 100000) * D.LIVE.wealthSpend * (p.fl.yolo ? 3 : 1) / 12;
      if (p.fl.yolo) spend *= 1.2;
      if (p.fl.careType === 'silver' || p.fl.careType === 'fac') spend *= 0.4;
    }
    var kc = 0; p.kids.forEach(function (k) { kc += childCost(k, p); });
    var extra = (p.support || 0) + (p.fl.psup && p.fam.alive > 0 ? p.fl.psup : 0) + (p.fl.pcare && a <= p.fl.pcare ? p.fl.pcareCost : 0) + (p.fl.careCost || 0) + (p.hab.chk === 2 ? D.HEALTH.checkCost / 12 : 0) + (p.car ? D.CARS[p.car.k].keep : 0);
    var rent = h.rent || 0, rate = Sim.loanRate(w, p), interest = p.debt * rate / 12;
    var surplus = (hh - spend - kc - extra - rent - interest) * 12;
    if (surplus < 0 && Sim.liquid(p) < -surplus) { var cut = Math.min(-surplus / 12, Math.max(0, spend - D.LIVE.floor)); surplus += cut * 12; spend -= cut; if (!dep && a >= 23) p.fl.tight = a; if (surplus < 0 && hh < minL * 1.3) surplus = 0; }
    var settle = surplus - (p.fl.adv || 0); p.fl.adv = 0;     // 분기마다 미리 받은 몫을 뺀다
    if (settle >= 0) p.cash += settle; else Sim.pay(p, -settle);
    p.fl.save = surplus; p.fl.hh = hh;
    if (p.rmPay && h.type === 'own') p.rm = Math.min(h.value * 0.95, (p.rm || 0) + p.rmPay * 12);
    // 연금 가입 이력
    if (p.job && gross > 0 && a < 65) {
      var J = D.JOBS[p.job.k];
      if (J.pen === 'civil') { p.pen.cy++; p.pen.cs += gross; }
      else { p.pen.y++; p.pen.s += Math.min(gross, D.PENSION.cap) * (J.type === 'biz' || J.type === 'gig' || J.type === 'own' ? D.PENSION.selfRatio : 1); }
    }
    // 이자 부담으로 인한 급매, 채무 조정
    if (h.type === 'own' && p.debt > 3000 && interest > hh * 0.6 && Sim.liquid(p) < interest * 4) {
      h.value = Math.round(h.value * 0.93); Sim.releaseHome(p); p.fl.forced = a; p.fl.forcedSale = 1; p.happy -= 12;
      ms(p, '대출 이자를 감당하지 못해 집을 급매로 팔았습니다.', 'bad');
      var pd0 = Math.min(p.debt, p.cash); p.debt -= pd0; p.cash -= pd0;
    }
    var limit = (Sim.houseVal(p) + (p.home.deposit || 0) + Sim.bldVal(p)) * 0.9 + hh * 12 * 3.5 + 15000;
    if (p.debt > limit && p.debt > 12000 && p.occ !== 'univ' && p.occ !== 'prog' && p.occ !== 'mil' && !(p.job && (p.job.k === 'resident' || p.job.k === 'milDoc'))) { if (!(p.fl.bkAge && a - p.fl.bkAge < 8)) bankrupt(p, w); else p.debt = limit; }
    // 상환과 투자 배분
    var buffer = spend * 6, liq;
    if (p.debt > 0 && p.cash > buffer && !p.fl.noRepay) { var pay = Math.min(p.debt, (p.cash - buffer) * (p.inv === 'save' ? 1 : 0.6)); p.debt -= pay; p.cash -= pay; }
    liq = Sim.liquid(p); var inv = Math.max(0, liq - buffer);
    if (p.inv === 'manual') { }     // 직접 운용: 연말 자동 배분 없음
    else if (p.inv === 'save') { p.stock = 0; p.coin = 0; p.cash = liq; }
    else { p.stock = inv * (p.inv === 'stock' ? 0.7 : 0.6); p.coin = p.inv === 'aggr' ? inv * 0.2 : 0; p.cash = liq - p.stock - p.coin; }
    // 전세 사기
    h = p.home;
    if (h.type === 'jeonse' && chance(r, (h.kind === 'villa' ? D.HOUSE.fraudVilla : D.HOUSE.fraudApt) * H.diff(p).bad)) {
      var loss = Math.round(h.deposit * U.range(r, [0.5, 1.0])); p.cash += h.deposit - loss; p.home = { type: 'none', region: p.region }; p.fl.fraud = 1; p.happy -= 15;
      ms(p, '전세 사기로 보증금 ' + won(loss) + '을 잃었습니다.', 'bad'); say(p, '집주인은 연락이 끊겼고, 등기부에는 처음 보는 근저당이 찍혀 있었습니다.');
    }
  }
  function ambKey(p) {
    var a = p.age, j = p.job;
    if (a < 4) return 'baby'; if (a < 7) return 'kid'; if (a < 13) return 'elem'; if (a < 16) return 'mid'; if (a < 18) return 'high'; if (a === 18) return 'high3';
    if (j) {
      var J = D.JOBS[j.k];
      if (J.mil || j.k === 'nco') return 'mil2'; if (j.k === 'celeb') return 'celeb'; if (j.k === 'heir') return 'heir';
      if (J.type === 'corp') return j.y < 6 ? 'corp0' : a < 45 ? 'corp1' : 'corp2';
      if (J.type === 'steady') return (j.k === 'factoryL' || j.k === 'factoryS' || j.k === 'trade') ? 'labor' : j.k === 'service' ? 'gig' : j.k === 'startup' || j.k === 'foreign' ? 'corp0' : 'steady';
      if (J.type === 'pro') return 'pro'; if (J.type === 'own') return 'own'; if (J.type === 'biz') return 'biz';
      return j.k === 'artist' ? 'artist' : 'gig';
    }
    switch (p.occ) {
      case 'resu': return 'resu'; case 'univ': return p.univ.tier === 'med' || p.univ.tier === 'medpro' ? 'med' : 'univ';
      case 'mil': return 'mil'; case 'prog': return 'prog'; case 'prep': return 'prep'; case 'home': return 'home';
    }
    if (a < 60) return 'idle'; return a < 73 ? 'retired' : a < 87 ? 'old' : 'very';
  }
  Sim.ambKey = ambKey;
  Sim.yearEnd = function (p, w) {
    var a = p.age, m = w.macro[a], r = p.rng, t, j = p.job, J = j ? D.JOBS[j.k] : null;
    if (a >= 19) finance(p, w);
    if (p.occ === 'univ') { p.univ.y++; p.univ.left--; } else if (p.occ === 'mil') p.mil.left--; else if (p.occ === 'prog') p.prog.left--;
    spouseYear(p, w, a);
    // 건강
    var dec = U.step(D.HEALTH.decline, a) - (p.st.stamina - 50) * 0.004;
    if (a >= 25) { dec += p.hab.ex ? -D.HEALTH.exercise : -D.HEALTH.noExercise; if (p.hab.vice) dec -= D.HEALTH.vice; if (p.over) dec -= D.HEALTH.overwork; if (J) dec += J.wear * (a > 40 ? 0.25 : 0.12) * (j.half ? 0.5 : 1); if (j && j.spec === 'core') dec += 0.15; }
    p.health = clamp(p.health - Math.max(-0.4, dec), 3, 100);
    // 행복 목표치
    t = 56 + (p.st.social - 50) * 0.08 + (p.health - 60) * 0.2;
    if (a < 19) {
      t += 8 + (p.fam.harmony - 50) * 0.2 + (p.fam.cls - 3) * 1.5 + D.EDU.tutor[p.school.tutor].happy; if (a >= 16) t -= 4; if (a === 18) t -= 6;
    } else {
      var adults = p.spouse ? 2 : 1, hh = (p.fl.hh || 0) / Math.sqrt(adults), nw = Sim.netWorth(p);
      t += clamp(9 * Math.log((hh + 60) / 330), -14, 14);
      t += nw < -3000 ? -7 : nw < 0 ? -3 : nw > 100000 ? 4 : nw > 30000 ? 2 : 0;
      if (j) { t += J.joy || 0; if (j.spec) t += D.DOC_SPEC[j.spec].joy || 0; if (p.over) t -= 5; }
      else if (p.occ === 'prep' || p.occ === 'resu') t -= 7; else if (p.occ === 'idle' && a < 60) t -= 10; else if (p.occ === 'mil') t -= 6; else if (p.occ === 'univ') t += 4;
      else if (p.occ === 'retired' || a >= 60) t += p.fl.rl === 'vol' ? 4 : p.fl.rl === 'tv' ? -3 : p.fl.rl === 'grand' ? 3 : 1;
      if (p.spouse) t += 3 + (p.mq - 55) * 0.14; else if (a >= 40 && !p.noMarry && !p.widowed) t -= 3;
      if (p.widowed) t -= 5; if (p.partner) t += 3;
      t += Math.min(p.kids.length, 2) * 2.5 + (p.fl.grand ? 3 : 0);
      if (a >= 75 && !p.spouse && !p.kids.length) t -= 5;
      t += p.home.type === 'own' ? 3 : p.home.type === 'monthly' ? -2 : 0; if (p.car) t += D.CARS[p.car.k].joy * (p.car.y > 8 ? 0.5 : 1); if (p.fl.careType === 'fac') t -= 4;
      if (p.fl.yk && a - p.fl.yk < 6) t -= 3; if (p.fl.tight === a) t -= 7; if (p.fl.chronic) t -= 4; if (a >= 65) t += 3;     // 내려놓음의 나이
    }
    p.happy = clamp(p.happy + (t - p.happy) * 0.3 + U.norm(r) * 1.5, 2, 99);
    // 무작위 사건(연 1건까지)
    for (var i = 0; i < D.EVENTS.length; i++) {
      var e = D.EVENTS[i]; if (a < e.min || a > e.max) continue;
      if (e.cond === 'hasCash' && Sim.liquid(p) < 2000) continue; if (e.cond === 'working' && !j) continue;
      if (e.cond === 'indep' && (p.home.type === 'parents' || p.home.type === 'none')) continue; if (e.cond === 'corp' && !(J && J.type === 'corp')) continue;
      if (chance(r, e.p * ((e.happy || 0) < 0 || (e.cash || 0) < 0 ? H.diff(p).bad : 1))) {
        if (e.cash) { if (a < 19) { } else if (e.cash > 0) p.cash += e.cash; else Sim.pay(p, -e.cash); }
        if (e.happy) p.happy = clamp(p.happy + e.happy, 2, 99); if (e.health) p.health = clamp(p.health + e.health, 3, 100);
        say(p, e.t, (e.happy || 0) >= 0 ? '' : 'bad'); break;
      }
    }
    if (p.isPlayer) {
      if (a >= 15 && m.start && m.k) say(p, T.MACRO_LINE[m.k], 'macro');
      if (a >= 20 && w.coin[a].k && (p.coin > 0 || chance(r, 0.3))) say(p, T.MACRO_LINE[w.coin[a].k], 'macro');
      if (a > 0 && p.cur.filter(function (x) { return x.c !== 'pick' && x.c !== 'macro' && x.c !== 'qh' && x.c !== 'fin'; }).length < 2) {
        var pool = T.AMB[ambKey(p)], idx = U.rint(r, 0, pool.length - 1); if (idx === p.fl.amb) idx = (idx + 1) % pool.length; if (a < 4) idx = a - 1; p.fl.amb = idx;
        p.cur.splice(p.cur.length && p.cur[0].c === 'qh' ? 1 : 0, 0, { t: pool[idx], c: 'amb' });
      }
      if (a >= 19 && p.fl.save != null && Math.abs(p.fl.save) >= 100) say(p, (p.fl.save >= 0 ? '올해 ' + won(p.fl.save) + '을 모았습니다.' : '올해 ' + won(-p.fl.save) + '이 모자랐습니다.') + ' 순자산 ' + won(Sim.netWorth(p)) + '.', 'fin');
    }
    var nwE = Math.round(Sim.netWorth(p));
    p.gN.push(nwE); p.gH.push(Math.round(p.happy)); p.hSum += p.happy; p.hN++;
    p.fl.maxNW = Math.max(p.fl.maxNW || 0, nwE); p.fl.minNW = Math.min(p.fl.minNW || 0, nwE);
    if (a >= 19) p.fl.maxInc = Math.max(p.fl.maxInc || 0, p.inc);
    if (!p.isPlayer && a >= 55 && a < 100 && chance(r, U.step(D.HEALTH.mort, a) * clamp(1.6 - p.health / 60, 0.5, 2))) p.dead = a;
    p.phase = 'idle';
  };

  /* ---------- 게임(플레이어 + 동년배) ---------- */
  Sim.newGame = function (seed, rollIdx, name, sex, diff) {
    var w = Sim.newWorld(seed), p = Sim.rollPerson(seed + '#p' + rollIdx, true, name, sex), peers = [], names = {}; names[p.name] = 1;
    p.fl.diff = D.DIFF[diff] ? +diff : 0;
    for (var i = 0; i < D.PEERS; i++) {
      var q = Sim.rollPerson(seed + '#peer' + i, false), n = 0;
      while (names[q.name] && n++ < 20) q.name = Sim.makeName(q.rng, q.sex);
      names[q.name] = 1; peers.push(q);
    }
    return { v: D.VERSION, seed: seed, roll: rollIdx, sex: sex || '', diff: p.fl.diff, p: p, w: w, peers: peers, over: false };
  };
  function link(g, q, rel, line) { if (!q) return; q.rel = q.rel || rel; q.rels = (q.rels || []).concat([rel]); say(g.p, line.replace('{n}와(과)', U.josa(q.name, '과/와')).replace('{n}는(은)', U.josa(q.name, '은/는')).replace('{n}를(을)', U.josa(q.name, '을/를')), 'news'); }
  function linkPeers(g) {
    var p = g.p, a = p.age, r = g.w.nr, free = g.peers.filter(function (q) { return !q.rel && q.dead == null; });
    function find(fn) { var c = free.filter(fn); if (!c.length) c = free; return c.length ? U.pick(r, c) : null; }
    if (a === 8) link(g, find(function (q) { return q.region === p.region; }), '초등학교 짝꿍', '짝꿍 {n}와(과) 지우개를 나눠 씁니다. 책상 가운데에 금을 그었습니다.');
    if (a === 14) link(g, find(function (q) { return q.fam.cls === p.fam.cls; }), '중학교 친구', '{n}와(과) 단짝이 됐습니다. 하굣길 분식집 단골입니다.');
    if (a === 17) { link(g, find(function (q) { return q.school.high === p.school.high; }), '고등학교 동창', '같은 반 {n}와(과) 야자 시간에 쪽지를 주고받습니다.'); free = g.peers.filter(function (q) { return !q.rel && q.dead == null; }); link(g, find(function (q) { return q.school.high === p.school.high && q.sex === p.sex; }), '고등학교 동창', '{n}는(은) 늘 나보다 한 등수 위거나 아래였습니다.'); }
    if (p.occ === 'univ' && p.univ.y === 0 && !p.fl.lkU) { p.fl.lkU = 1; var u = free.filter(function (q) { return q.univ && q.univ.tier === p.univ.tier; }); if (u.length) link(g, U.pick(r, u), '대학 동기', '새내기 배움터에서 {n}를(을) 만났습니다. 같은 조였습니다.'); }
    if (p.job && p.job.y === 0 && !p.fl.lkJ && a >= 22) { p.fl.lkJ = 1; var c = free.filter(function (q) { return q.job && q.job.k === p.job.k; }); if (c.length) link(g, U.pick(r, c), '입사 동기', '입사 동기 {n}와(과) 연수원에서 같은 방을 썼습니다.'); }
  }
  function stateLine(q, r) {
    var a = q.age, inc = Sim.myInc(q), j = q.job, title = Sim.occLabel(q), n = q.kids.length, opts = [];
    if (a < 19) return (a < 13 ? '초등학교' : a < 16 ? (q.school.mid === 'intl' ? '국제중' : q.school.mid === 'arts' ? '예술중' : '중학교') : D.EDU.high[q.school.high || 'general'].name) + '에 다니고 있습니다.';
    if (j) {
      opts.push((j.y > 1 ? title + ' ' + j.y + '년 차로' : U.josa(title, '으로/로') + ' 일하며') + ' 월 ' + U.josa(won(inc), '을/를') + ' 벌고 있습니다.');
      if (q.home.type === 'own') opts.push(U.josa(title, '으로/로') + ' 일하며 ' + D.REG[q.home.region].name + '에 자가를 마련했습니다.');
      else if (a >= 33) opts.push(U.josa(title, '으로/로') + ' 일하며 ' + Sim.homeLabel(q) + '에 살고 있습니다.');
      if (n) opts.push(U.josa(title, '으로/로') + ' 일하며 ' + (n === 1 ? '아이 하나를' : '아이 ' + n + '명을') + ' 키우고 있습니다.');
      return U.pick(r, opts);
    }
    switch (q.occ) {
      case 'univ': return U.josa(q.univ.name, '을/를') + ' 다니고 있습니다.';
      case 'resu': return '수능을 다시 준비하고 있습니다.';
      case 'mil': return '군 복무 중입니다.';
      case 'prog': return q.prog.name + '에 재학 중입니다.';
      case 'prep': return q.prep.name + ' 준비 ' + q.prep.n + '년 차입니다.';
      case 'home': return '일을 그만두고 육아에 전념하고 있습니다.';
    }
    if (a < 60) return q.last ? q.last.t + ' 자리를 떠난 뒤 일을 쉬고 있습니다.' : '아직 일자리를 찾고 있습니다.';
    var nw = Sim.netWorth(q);
    if (q.fl.careType === 'fac') return '요양원에서 지내고 있습니다.';
    if (q.fl.careType === 'silver') return '실버타운에서 노후를 보내고 있습니다.';
    return nw > 150000 ? '은퇴 후 ' + won(nw) + '의 자산으로 여유로운 노후를 보내고 있습니다.' : inc >= 150 ? '은퇴 후 월 ' + won(inc) + '의 연금으로 생활하고 있습니다.' : nw < 5000 ? '은퇴 후 빠듯한 살림을 꾸리고 있습니다. 월 소득은 ' + won(inc) + '입니다.' : '은퇴 후 ' + Sim.homeLabel(q) + '에서 조용히 지내고 있습니다.';
  }
  function describe(q, r) {
    var a = q.age, last = null, i;
    for (i = q.ms.length - 1; i >= 0 && i >= q.ms.length - 3; i--) if (!q.ms[i].seen && a - q.ms[i].a <= 3 && !/세상을 떠나/.test(q.ms[i].t)) { last = q.ms[i]; break; }
    if (last && U.chance(r, 0.7)) { last.seen = 1; return (a - last.a >= 2 ? (a - last.a) + '년 전 ' : '') + last.t; }
    return stateLine(q, r);
  }
  function newsLine(q, r) { return { t: (q.rel ? q.rel + ' ' : '동창 ') + U.josa(q.name, '은/는') + ' ' + describe(q, r), c: 'news' }; }
  Sim.newsLine = newsLine;
  function news(g) {
    var p = g.p, a = p.age, w = g.w, r = w.nr, alive = g.peers.filter(function (q) { return q.dead == null; });
    g.peers.forEach(function (q) { if (q.dead === a && !q.deadSaid) { q.deadSaid = 1; if (q.rel) { p.cur.push({ t: q.rel + ' ' + U.josa(q.name, '이/가') + ' ' + a + '세를 일기로 세상을 떠났습니다. 장례식장에서 오랜 얼굴들을 만났습니다.', c: 'news bad' }); p.happy = clamp(p.happy - 4, 2, 99); } else p.fl.obit = (p.fl.obit || 0) + 1; } });
    if (D.NEWS_AGES.indexOf(a) < 0 || !alive.length) return;
    var pickd = [], rels = alive.filter(function (q) { return q.rel; }).sort(function (x, y) { return (w.lastNews[x.id] || 0) - (w.lastNews[y.id] || 0); });
    rels.slice(0, a < 19 ? 2 : 2).forEach(function (q) { pickd.push(q); });
    if (a >= 19) {
      var sorted = alive.slice().sort(function (x, y) { return Sim.netWorth(y) - Sim.netWorth(x); }), n = sorted.length, third = Math.max(1, Math.floor(n / 3));
      [[0, third], [third, n - third], [n - third, n]].forEach(function (rg) {
        var c = sorted.slice(rg[0], Math.max(rg[1], rg[0] + 1)).filter(function (q) { return pickd.indexOf(q) < 0 && (w.lastNews[q.id] || 0) < a - 4; });
        if (c.length && pickd.length < 4) pickd.push(U.pick(r, c));
      });
    }
    if (!pickd.length) return;
    p.cur.push({ t: '친구들 근황', c: 'newsHead' });
    pickd.forEach(function (q) { w.lastNews[q.id] = a; p.cur.push(newsLine(q, r)); });
    if (p.fl.obit) { p.cur.push({ t: '그사이 동창 ' + p.fl.obit + '명의 부고가 전해졌습니다.', c: 'news' }); p.fl.obit = 0; }
  }
  Sim.beginYear = function (g) {
    var w = g.w;
    Sim.yearStart(g.p, w);
    g.peers.forEach(function (q) { if (q.dead != null) return; Sim.yearStart(q, w); autoAll(q, w); Sim.yearEnd(q, w); });
    linkPeers(g);
  };
  Sim.closeYear = function (g) {
    var p = g.p, snap = Sim.snap ? Sim.snap(g) : null; Sim.yearEnd(p, g.w); if (snap) Sim.yearReport(g, snap); news(g);
    p.log.push({ a: p.age, l: p.cur }); p.cur = [];
    if (p.age >= 100) g.over = true;
  };
  Sim.ranks = function (g, all) {
    var p = g.p, al = all ? g.peers : g.peers.filter(function (q) { return q.dead == null; }), n = al.length + 1;
    function top(fn) { var v = fn(p), c = 1; al.forEach(function (q) { if (fn(q) > v) c++; }); return { rank: c, n: n, pct: Math.max(1, Math.round(c / n * 100)) }; }
    return { inc: top(function (q) { return all ? (q.fl.maxInc || 0) : Sim.hhGross(q); }), nw: top(Sim.netWorth), happy: top(function (q) { return q.happy; }) };
  };

  /* ---------- 엔딩 ---------- */
  Sim.title = function (p) {
    var f = p.fl, c = p.fam.cls, nick = D.CLASS[c].nick, nw = Sim.netWorth(p), own = p.home.type === 'own', avgH = p.hSum / Math.max(1, p.hN), jy = f.jy || {};
    var civil = (jy.civil9 || 0) + (jy.civil7 || 0) + (jy.civil5 || 0), corpY = (jy.large || 0) + (jy.mid || 0) + (jy.small || 0) + (jy.public || 0);
    var rules = [
      [c <= 2 && f.gangnam && (own && p.home.region === 'gangnam'), '강남 입성에 성공한 ' + nick],
      [f.exit >= 100000, '회사를 팔아 인생을 바꾼 창업가'],
      [f.lotto1, '로또 1등, 그 뒤의 삶까지 살아 본 사람'],
      [f.general, '어깨에 별을 단 장군'],
      [f.topStar, '한 시대를 풍미한 톱스타'],
      [c >= 6 && nw >= 3000000, '태어난 자리를 끝까지 지켜 낸 재벌가의 후계자'],
      [f.master, '손끝 하나로 명장의 반열에 오른 기술인'],
      [(p.bld || []).length >= 2, '조물주 위의 건물주'],
      [(f.donated || 0) >= 10000, '나눌 줄 알았던 자산가'],
      [f.exec && c <= 2, '별을 단 ' + nick],
      [f.exec, '별을 달아 본 월급쟁이'],
      [p.deg === '박사' && !f.everOwned, '평생 전세를 벗어나지 못한 박사'],
      [c >= 5 && nw < 30000, '물려받은 것을 다 쓰고 간 ' + nick],
      [c <= 1 && nw >= 200000, '맨손으로 일어선 흙수저 자산가'],
      [f.bk && nw > 30000, '파산을 딛고 다시 일어선 사람'],
      [(f.bizClosed || 0) >= 2, '넘어질 때마다 다시 셔터를 올린 사장님'],
      [f.erp && f.bizN, '희망퇴직 뒤 가게를 차린, 한국형 인생 2막의 주인공'],
      [f.otal, '다섯 번의 시험, 그 뒤의 삶을 살아낸 사람'],
      [f.star, '끝내 이름을 알린 예술가'],
      [(jy.artist || 0) >= 15, '가난했지만 무대를 떠나지 않은 예술가'],
      [f.lic === 'doc' && f.opened && !f.proClosed, '동네의 건강을 지킨 원장님'],
      [f.lic === 'doc', '평생 가운을 벗지 않은 의사'],
      [f.lic === 'medpro', '면허 한 장으로 평생을 일한 전문직'],
      [f.lic === 'law' && (jy.lawBig || 0) >= 9, '새벽 불빛 아래 늙어 간 로펌 변호사'],
      [f.lic === 'law', '법전과 함께 늙어 간 변호사'],
      [(jy.prof || 0) >= 10, '강단에서 정년을 맞은 교수'],
      [(jy.officer || 0) + (jy.nco || 0) >= 20, '군복을 입고 반평생을 보낸 군인'],
      [(jy.celeb || 0) >= 10, '무명의 시간을 끝까지 견딘 연예인'],
      [(jy.heir || 0) >= 15, '물려받은 회사를 지켜 낸 경영인'],
      [(jy.teacher || 0) >= 25, '교단에서 한 세대를 길러 낸 선생님'],
      [civil >= 25, '묵묵히 정년을 채운 공무원'],
      [f.fullRetire === 'large', '정년까지 버텨 낸 대기업의 생존자'],
      [f.fraud && own, '전세 사기를 딛고 내 집을 마련한 사람'],
      [f.fraud, '전세 사기의 상처를 안고 살아낸 세입자'],
      [(f.gapGain || 0) > 50000, '부동산으로 월급을 이긴 투자자'],
      [(f.coinLoss || 0) > 3000 && !(f.coinWin > f.coinLoss), '코인 차트에 한 시절을 맡겼던 사람'],
      [f.forcedSale, '금리의 파도에 집을 내준 영끌족'],
      [avgH >= 66 && nw < 20000, '가진 건 적어도 웃음이 많았던 사람'],
      [avgH < 44 && nw > 150000, '통장은 두둑했지만 마음은 허전했던 자산가'],
      [c <= 2 && nw >= 100000, '사다리를 끝까지 올라간 ' + nick],
      [nw >= 500000, '모두가 부러워한 자산가'],
      [f.yk && own, '영끌의 시대를 건너온 집주인'],
      [p.kids.length >= 3, '다둥이를 길러 낸 부모'],
      [(jy.factoryL || 0) + (jy.factoryS || 0) + (jy.trade || 0) >= 25, '손끝의 기술로 평생을 먹고산 장인'],
      [(f.welfare || 0) >= 10, '모진 세월을 끝까지 버텨 낸 사람'],
      [!f.everOwned && (f.wedAge || p.kids.length), '평생 무주택으로 가정을 지킨 사람'],
      [!f.everOwned, '평생 내 집 없이 살아낸 세입자'],
      [!f.wedAge, '혼자서도 단단했던 사람'],
      [c >= 4 && nw >= 100000, '물려받은 출발선을 지켜 낸 ' + nick],
      [f.smExec, '작은 회사에서 끝내 별을 단 사람'],
      [corpY >= 25, '회사에 청춘을 바친 보통의 월급쟁이'],
      [f.careerBreak, '아이를 키우며 두 번의 인생을 산 사람']
    ];
    for (var i = 0; i < rules.length; i++) if (rules[i][0]) return rules[i][1];
    return '평범해서 더 쉽지 않았던 보통의 삶';
  };
  Sim.code = function (g) { return g.seed + '-' + g.roll + (g.sex ? '-' + g.sex : ''); };
  Sim.summary = function (g) {
    var p = g.p, r = Sim.ranks(g, true), spans = [], i, hst = p.hist;
    for (i = 0; i < hst.length; i++) { var end = i + 1 < hst.length ? hst[i + 1].a : null; if (spans.length && spans[spans.length - 1].t === hst[i].t) continue; spans.push({ a: hst[i].a, t: hst[i].t }); }
    return { name: p.name, title: Sim.title(p), code: Sim.code(g), diff: p.fl.diff || 0, nw: Sim.netWorth(p), cash: p.cash, stock: p.stock + p.coin, re: Sim.realEstate(p), debt: p.debt + (p.rm || 0),
      avgHappy: Math.round(p.hSum / Math.max(1, p.hN)), ranks: r, jobs: spans, timeline: p.ms, kids: p.kids, cls: p.fam.cls,
      family: (p.fl.wedAge ? (p.divorces ? '결혼 후 이혼' + (p.spouse ? '·재혼' : '') : p.widowed ? '배우자와 사별' : '기혼') : '비혼') + (p.kids.length ? ' · 자녀 ' + p.kids.length + '명' : ' · 자녀 없음') + (p.fl.grand ? ' · 손주 ' + p.fl.grand + '명' : ''),
      maxInc: p.fl.maxInc || 0, maxNW: p.fl.maxNW || 0, home: Sim.homeLabel(p), alive: g.peers.filter(function (q) { return q.dead == null; }).length };
  };

  /* ---------- 자동 테스트 ---------- */
  Sim.runLife = function (seed, snapAges) {
    var g = Sim.newGame(seed, 0), snaps = {}, n;
    while (!g.over) {
      Sim.beginYear(g); n = 0; var v;
      while ((v = Sim.view(g.p, g.w)) && n++ < 40) Sim.choose(g.p, g.w, Sim.auto(g.p, v).key);
      Sim.closeYear(g);
      if (snapAges && snapAges.indexOf(g.p.age) >= 0) snaps[g.p.age] = [g.p].concat(g.peers).map(function (q) {
        return { cls: q.fam.cls, sex: q.sex, dead: q.dead != null, job: q.job ? q.job.k : q.occ, rank: q.job ? q.job.rank : 0, inc: q.inc, hh: Sim.hhGross(q), nw: Sim.netWorth(q), happy: q.happy, health: q.health, own: q.home.type === 'own', home: q.home.type, region: q.region, married: !!q.spouse, ever: !!q.fl.wedAge, kids: q.kids.length, tier: q.univ ? q.univ.tier : (q.school.high === 'voc' ? 'voc' : 'hs'), deg: q.deg, lic: q.fl.lic || '', exec: !!q.fl.exec, acad: Sim.acad(q), susi: Sim.susi(q), bk: q.fl.bk || 0, bizC: q.fl.bizClosed || 0, welfare: q.fl.welfare || 0, iq: q.st.iq };
      });
    }
    return { g: g, snaps: snaps };
  };
})();
