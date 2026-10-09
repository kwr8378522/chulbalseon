/* quarter.js — 성인기 플레이어의 월 단위 진행: 시장, 직접 투자, 자유 행동, 만남, 자동차, 연봉 협상, 돌발 사건
 * 동년배(NPC)와 자동 테스트는 여전히 life.js의 1년 단위 엔진만 씁니다. */
(function () {
  'use strict';
  var clamp = U.clamp, won = U.won, say = Sim.say, ms = Sim.ms, DEC = Sim.DEC, H = Sim.H;
  var O = H.O, pr = H.pr, roll = H.roll, R = H.R;
  function grd(v) { for (var i = 0; i < T.GRADE.length; i++) if (v >= T.GRADE[i][0]) return T.GRADE[i][1]; return ''; }
  function r100(v) { return Math.max(0, Math.round(v / 100) * 100); }

  /* ================= 시장 ================= */
  // 분기 수익률은 시드에서만 파생된다(플레이어의 행동과 무관). 연간 수익률을 네 분기에 나눠 싣는다.
  Sim.mktQ = function (w, a, q) {
    var r = U.mk(U.hash(w.seed + '#mkt' + a + 'q' + q)), m = w.macro[a], o = {}, k, A;
    var base = Math.pow(Math.max(0.05, 1 + m.stock - D.RATE.stockDrag), 0.25) - 1, common = U.norm(r) * 0.02;
    for (k in D.ASSETS) { A = D.ASSETS[k]; o[k] = Math.max(-0.9, (base + common) * A.beta + A.add + (m.k && A[m.k] || 0) + U.norm(r) * A.sd); }
    o.coin = Math.max(-0.9, Math.pow(Math.max(0.05, 1 + w.coin[a].r), 0.25) - 1 + U.norm(r) * D.COIN_QSD);
    return o;
  };
  // p.stock은 엔진이 쓰는 주식 총액, p.sw는 그 안의 종목별 비중
  Sim.holdings = function (p) {
    var sw = p.sw || { idx: 1 }, h = {}, t = 0, k;
    for (k in sw) t += sw[k];
    for (k in D.ASSETS) h[k] = t > 0 && sw[k] ? p.stock * sw[k] / t : 0;
    if (!(t > 0)) h.idx = p.stock;
    return h;
  };
  function setHold(p, h) { var t = 0, k; for (k in h) t += h[k]; p.stock = t; p.sw = {}; for (k in h) if (h[k] > 0.5) p.sw[k] = h[k] / t; if (!Object.keys(p.sw).length) p.sw = { idx: 1 }; }
  function applyMkt(p, rs) {
    var before = p.stock + p.coin, h, k;
    if (p.stock > 0) { h = Sim.holdings(p); for (k in h) h[k] *= 1 + rs[k]; setHold(p, h); }
    if (p.coin > 0) p.coin *= 1 + rs.coin;
    return p.stock + p.coin - before;
  }
  function manual(p) { if (p.inv !== 'manual') p.inv = 'manual'; }
  // amt > 0 매수, amt < 0 매도. k는 D.ASSETS의 키 또는 'coin'
  Sim.trade = function (g, k, amt) {
    var p = g.p, h = Sim.holdings(p), name = k === 'coin' ? '코인' : D.ASSETS[k].name, have = k === 'coin' ? p.coin : h[k];
    if (amt > 0) {
      amt = Math.floor(Math.min(amt, p.cash)); if (amt < 1) return 0;
      p.cash -= amt; if (k === 'coin') p.coin += amt; else { h[k] += amt; setHold(p, h); }
    } else {
      amt = Math.min(-amt, have); if (amt < 1) return 0;
      if (k === 'coin') p.coin -= amt; else { h[k] -= amt; setHold(p, h); }
      p.cash += amt * (1 - D.TRADE_FEE); amt = -amt;
    }
    manual(p);
    p.cur.push({ t: name + ' ' + won(Math.abs(amt)) + (amt > 0 ? ' 매수' : ' 매도'), c: 'pick' });
    return amt;
  };
  // 월 적립식: 달이 바뀔 때마다 정해 둔 금액만큼 자동으로 산다(현금이 모자라면 있는 만큼만). p.fl.dca = { 자산키: 월 금액 }
  Sim.DCA_STEPS = [0, 10, 30, 50, 100, 200, 300, 500, 1000];
  Sim.setDca = function (g, k, amt) {
    var p = g.p, d = p.fl.dca = p.fl.dca || {}; amt = Math.max(0, Math.round(+amt || 0));
    if (amt) { d[k] = amt; manual(p); } else delete d[k];     // 연말 자동 운용이 적립분을 되팔지 않도록 직접 운용으로 바꾼다
    return amt;
  };
  function runDca(g) {
    var p = g.p, d = p.fl.dca, k, amt, h = null, parts = [], tot = 0; if (!d) return;
    for (k in d) {
      amt = Math.floor(Math.min(d[k], p.cash)); if (amt < 1) continue;
      p.cash -= amt; tot += amt;
      if (k === 'coin') p.coin += amt; else { h = h || Sim.holdings(p); h[k] += amt; }
      parts.push((k === 'coin' ? '코인' : D.ASSETS[k].name) + ' ' + won(amt));
    }
    if (h) setHold(p, h);
    if (tot > 0) p.cur.push({ t: '적립식 자동 매수 · ' + parts.join(', '), c: 'fin' });
    else if (Object.keys(d).length) p.cur.push({ t: '적립식 자동 매수 · 통장에 돈이 없어 이번 달은 건너뛰었습니다.', c: 'fin' });
  }
  Sim.creditCap = function (p, w) { return r100(Math.min(Sim.loanCap(p, w, false), Sim.hhGross(p) * 12 * D.CREDIT_MULT) - 50); };
  Sim.borrow = function (g, amt) {
    var p = g.p; amt = Math.min(r100(amt), Sim.creditCap(p, g.w)); if (amt < 100) return 0;
    p.debt += amt; p.cash += amt; p.cur.push({ t: '신용대출 ' + won(amt) + ' 실행', c: 'pick' }); return amt;
  };
  Sim.repay = function (g, amt) {
    var p = g.p; amt = Math.floor(Math.min(amt, p.cash, p.debt)); if (amt < 1) return 0;
    p.debt -= amt; p.cash -= amt; p.cur.push({ t: '대출 ' + won(amt) + ' 상환', c: 'pick' }); return amt;
  };
  Sim.annual = function (p) { return Sim.myInc(p) * 12; };

  /* ================= 월 단위 진행 ================= */
  // 성인기는 한 달씩 흐른다. 시세는 분기 말(3·6·9·12월)에 움직이고, 소득에서 지출을 뺀 몫은 달마다 미리 들어온다(연말 정산).
  Sim.isQ = function (g) { return !g.over && g.p.age >= D.QTR.from; };
  function gainAp(g) { g.ap = Math.min(D.QTR.apMax, (g.ap || 0) + D.QTR.ap); }
  Sim.startQuarters = function (g) {
    var p = g.p; g.mon = 1; g.qtr = 1; gainAp(g); p.fl.perf = 0;
    p.fl.ys = { nw: Math.round(Sim.netWorth(p)), gain: 0, h: Math.round(p.happy), hp: Math.round(p.health) };     // 연말 결산용 연초 기록
    p.cur.unshift({ t: '1월', c: 'qh' });
    if (p.age === 20 && !p.fl.drv && !p.fl.drvAsk) { p.fl.drvAsk = 1; Sim.q(p, 'qDrive', {}); }
    runDca(g); qEvent(g);
  };
  Sim.endMonth = function (g) {
    var p = g.p;
    if (g.mon % 3 === 0) {
      var rs = Sim.mktQ(g.w, p.age, g.mon / 3), d = applyMkt(p, rs);
      p.fl.qmA = p.age; g.mkt = rs; if (p.fl.ys) p.fl.ys.gain += d;
      if (Math.abs(d) >= 10) p.cur.push({ t: (g.mon / 3) + '분기 투자 손익 ' + (d >= 0 ? '+' : '−') + won(Math.abs(d)), c: 'fin' });
    }
    if (g.mon < 12) {      // 작년 기준 추정치를 달마다 미리 받는다
      var adv = Math.round((p.fl.save || 0) / 12);
      if (adv > 0) p.cash += adv; else if (adv < 0) Sim.pay(p, -adv);
      p.fl.adv = (p.fl.adv || 0) + adv;
    }
  };
  Sim.nextMonth = function (g) {
    var p = g.p; Sim.endMonth(g); g.mon++; g.qtr = Math.ceil(g.mon / 3); gainAp(g);
    p.cur.push({ t: g.mon + '월', c: 'qh' });
    if (g.mon === 12 && canNego(p)) Sim.q(p, 'salary', { g: gradeOf(p, g.w) });
    runDca(g); qEvent(g);
  };
  // 더 고를 것이 없을 때 호출. 다음 달 또는 다음 해로 넘어간다.
  Sim.advance = function (g) {
    var p = g.p, wasQ = Sim.isQ(g), closed = false;
    if (p.phase === 'mid') {
      if (wasQ && g.mon < 12) { Sim.nextMonth(g); return 'q'; }
      if (wasQ) { Sim.endMonth(g); p.cur = p.cur.filter(function (x, i) { return x.c !== 'qh' || (i + 1 < p.cur.length && p.cur[i + 1].c !== 'qh'); }); p.cur.push({ t: '연말', c: 'qh' }); }   // 아무 일 없던 달의 제목은 지운다
      Sim.closeYear(g); closed = true;
      if (g.over || !wasQ) return 'closed';
    }
    Sim.beginYear(g); if (Sim.isQ(g)) Sim.startQuarters(g);
    return closed ? 'year' : 'begin';
  };

  /* ================= 만남 ================= */
  function candJob(inc) { return inc <= 0 ? '취업 준비생' : inc < 230 ? '계약직' : inc < 330 ? '중소기업 직원' : inc < 480 ? '회사원' : inc < 700 ? '대기업 직원' : inc < 1100 ? '전문직' : '고소득 전문직'; }
  function eduOf(g) { return g >= 4 ? '서울 최상위권 대학 졸' : g >= 3 ? '서울 상위권 대학 졸' : g >= 2 ? '서울 소재·국립대 졸' : g >= 1 ? '지방대 졸' : '전문대·고졸'; }
  // S: bias 내 등급 대비 상대 등급, sd 편차, chem 평균 궁합. 선택: inc 경제력 보정, looks 외모 평균, young 연하, cls 집안 보정, student 대학생
  function mkCand(p, S) {
    var r = p.rng, sex = p.sex === 'M' ? 'F' : 'M', g = clamp(H.grade(p) + S.bias + U.norm(r) * S.sd, 0, 5.5), gi = clamp(g + (S.inc || 0), 0, 5.8);
    var inc = S.student ? 0 : U.chance(r, 0.08) ? 0 : Math.max(120, Math.round((150 + gi * gi * 38 + U.norm(r) * 30) / 10) * 10);
    var age = S.student ? Math.max(19, p.age + U.rint(r, -1, 2)) : Math.max(19, p.age + (S.young ? -U.rint(r, 2, 7) : U.rint(r, -4, 3)));
    var c = { name: Sim.makeName(r, sex), sex: sex, age: age, inc: inc, job: S.student ? '대학생' : candJob(inc),
      cls: clamp(Math.round(p.fam.cls * 0.5 + 1.5 + U.norm(r) + (S.cls || 0)), 1, S.cls >= 2 ? 6 : 5), yrs: 0, asked: 0,
      looks: Math.round(clamp((S.looks || 50) + U.norm(r) * (S.looks ? 8 : 15), 5, 99)), chem: Math.round(clamp(S.chem + U.norm(r) * 18, 5, 99)), g: g, fake: S.fake && U.chance(r, S.fake) ? 1 : 0,
      edu: S.student ? '같은 학교 재학' : eduOf(g + U.norm(r) * 0.5), height: Math.round(sex === 'M' ? 174 + U.norm(r) * 5.6 : 161.5 + U.norm(r) * 5.2) };
    c.face = T.FACE[sex][U.hash(c.name + c.age) % T.FACE[sex].length];
    return c;
  }
  function meetCand(p, cand, key, S) { Sim.qFront(p, 'meet', { cand: cand, src: key, sn: S.name, base: S.base, yrs: S.yrs || 0, go: S.go, okText: S.okText }); }
  function meet(p, key, S) { S = S || D.DATE.src[key]; meetCand(p, mkCand(p, S), key, S); }
  var LIKES = ['food', 'trip', 'home', 'gift'];
  var INTRO = {
    blind: '주말 오후, 카페 구석 자리. 주선자는 "둘이 잘 맞을 것 같아서"라고만 했습니다.',
    app: '프로필 사진과 실물 사이의 거리를 가늠하며 약속 장소로 갑니다.',
    club: '모임 뒤풀이에서 자꾸 옆자리에 앉게 되는 사람이 있습니다.',
    mat: '호텔 커피숍. 양가 어른들은 이미 서로의 집안을 다 알고 있습니다.',
    ag: '매니저가 잡아 준 호텔 라운지 약속. 프로필로 먼저 본 얼굴이 맞은편에 앉아 있습니다.',
    cc: '같은 수업, 같은 조. 조별 과제 때문에 시작한 연락이 과제가 끝나도 이어집니다.',
    mt: '과 대표가 잡아 온 미팅 자리. 게임 벌칙으로 옆자리가 바뀌었습니다.',
    fest: '대학 축제의 밤, 주점 천막 아래. 옆 테이블과 합석하게 됐습니다.',
    rich: '어른들이 잡은 자리입니다. 양가의 사업 이야기가 먼저 오가고, 두 사람은 그다음입니다.'
  };
  DEC.meet = {
    build: function (p, w, c) {
      var d = c.cand; if (p.partner || p.spouse) return { title: '', icon: '', desc: '', opts: [] };
      var pb = pr(p, c.base, { looks: 0.35, social: 0.35 }, (H.grade(p) - d.g) * 0.45 + (d.chem - 50) / 40);
      var chem = d.chem >= 70 ? '시간 가는 줄 모르고 이야기했습니다' : d.chem >= 45 ? '대화는 무난하게 흘러갔습니다' : '대화가 자꾸 끊겼습니다';
      return { title: c.sn, icon: '☕', face: d.face, desc: INTRO[c.src] + ' 상대는 ' + d.name + ', ' + d.age + '세 ' + d.job + (d.inc ? '(연봉 ' + won(d.inc * 12) + ')' : '') + (d.edu && d.job !== '대학생' ? ', ' + d.edu : '') + (d.height ? ', 키 ' + d.height + 'cm' : '') + '. 외모는 "' + grd(d.looks) + '", ' + chem + '.', opts: [
        O('go', c.go || '애프터를 신청한다', { desc: '조건과 궁합이 맞을수록 잘 됩니다', prob: pb, stats: ['looks', 'social'], ai: d.chem >= 45 ? 3 : 1 }),
        O('pass', '좋은 분이지만 여기까지', { ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var d = c.cand;
      if (key === 'pass') return R(null, '다음 기회에', '"조심히 들어가세요." 메시지를 보내고 대화방을 나왔습니다.');
      var rl = roll(p, o.prob);
      if (!rl.ok) { p.happy -= 2; return R(false, '읽씹', '"즐거웠어요"라는 답장 뒤로 연락이 끊겼습니다. 거울을 한 번 더 봤습니다.', rl); }
      var extra = '';
      if (d.fake) { d.inc = Math.round(d.inc * 0.6 / 10) * 10; d.job = candJob(d.inc); extra = ' 만나다 보니 프로필의 직업은 조금 부풀려져 있었습니다.'; }
      p.partner = { name: d.name, sex: d.sex, age: d.age, inc: d.inc, job: d.job, cls: d.cls, yrs: c.yrs, asked: 0, chem: d.chem, looks: d.looks, face: d.face,
        aff: Math.round(clamp(48 + (d.chem - 50) * 0.4, 25, 80)), like: LIKES[U.hash(d.name + 'like') % LIKES.length], student: d.job === '대학생' ? 1 : 0 };
      p.happy += 5; say(p, U.josa(d.name, '과/와') + ' 연애를 시작했습니다. (' + c.sn + ')', 'good');
      return R(true, '연애 시작', (c.okText || '세 번째 만남에서 서로의 연봉 대신 좋아하는 음식을 물었습니다.') + extra, rl);
    }
  };
  function gLetter(g) { return g >= 4 ? 'S' : g >= 3 ? 'A' : g >= 2 ? 'B' : g >= 1 ? 'C' : 'D'; }
  DEC.agency = {
    build: function (p) {
      var g = H.grade(p), liq = Sim.liquid(p), opts = D.DATE.agency.map(function (A, i) {
        return O('' + i, A.name + ' 가입', { desc: '가입비 ' + won(A.fee) + ' · 매칭 ' + A.n + '회 · ' + ['비슷한 조건의 상대', '조건이 좋은 상대', '최상위 조건의 상대'][i], dis: g < A.need ? '가입 심사 탈락 (' + gLetter(A.need) + '등급 이상)' : liq < A.fee ? '가입비가 없습니다' : null, ai: i === 0 ? 1 : 0.4 });
      });
      opts.push(O('no', '상담만 받고 나온다', { ai: 1 }));
      return { title: '결혼정보회사', icon: '📋', desc: '상담 매니저가 직업, 연봉, 학력, 집안, 키, 차를 차례로 받아 적습니다. 잠시 뒤 모니터를 돌려 보여 줍니다. "회원님은 ' + gLetter(g) + '등급이세요."', opts: opts };
    },
    resolve: function (p, w, c, key) {
      if (key === 'no') return R(null, '상담 종료', '사람에게 등급이 매겨지는 걸 보고 나오니 커피가 썼습니다.');
      var A = D.DATE.agency[+key]; Sim.pay(p, A.fee); p.fl.ag = { tier: +key, left: A.n };
      return R(null, A.name + ' 회원', '가입비 ' + won(A.fee) + '을 결제했습니다. 이제 매칭을 ' + A.n + '번 받을 수 있습니다. 자유 행동에서 "결정사 매칭"을 고르세요.');
    }
  };

  /* ================= 자동차 ================= */
  function drive(p, o) {
    Sim.pay(p, D.DRIVE.cost); var rl = roll(p, o.prob);
    if (rl.ok) { p.fl.drv = 1; ms(p, '운전면허를 땄습니다.', false); return R(true, '면허 취득', '도로주행 시험관이 고개를 끄덕였습니다. 지갑에 신분증이 하나 늘었습니다.', rl); }
    return R(false, '탈락', '기능 시험 T자 코스에서 선을 밟았습니다. 학원비는 돌아오지 않습니다.', rl);
  }
  function drvProb(p) { return pr(p, D.DRIVE.base, { dil: 0.2, iq: 0.1 }); }
  DEC.qDrive = {
    build: function (p) {
      return { title: '운전면허', icon: '🪪', desc: '스무 살. 친구들이 방학을 맞아 운전면허 학원에 등록합니다. "지금 안 따면 평생 못 딴다"고들 합니다.', opts: [
        O('go', '학원에 등록한다', { desc: '학원비 ' + won(D.DRIVE.cost), prob: drvProb(p), stats: ['dil'], dis: Sim.liquid(p) < D.DRIVE.cost && p.fam.alive <= 0 ? '학원비가 없습니다' : null, ai: 2 }),
        O('later', '나중에 딴다', { desc: '자유 행동에서 언제든 도전할 수 있습니다', ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'later') return R(null, '다음에', '버스와 지하철이면 충분하다고 생각했습니다. 아직은요.');
      if (Sim.liquid(p) < D.DRIVE.cost && p.fam.alive > 0) { p.cash += D.DRIVE.cost; H.famSpend(p, D.DRIVE.cost); }   // 부모님이 학원비를 내 준다
      return drive(p, o);
    }
  };
  DEC.car = {
    build: function (p, w) {
      var have = p.car, room = Sim.liquid(p) + Sim.creditCap(p, w) + (have ? have.value * 0.9 : 0), opts = [];
      Object.keys(D.CARS).forEach(function (k) {
        var C = D.CARS[k]; if (have && have.k === k) return;
        var loan = Math.max(0, C.price - Sim.liquid(p) - (have ? have.value * 0.9 : 0));
        opts.push(O(k, have ? U.josa(C.name, '으로/로') + ' 바꾼다' : U.josa(C.name, '을/를') + ' 산다', { desc: won(C.price) + ' · 유지비 월 ' + won(C.keep) + (loan > 0 ? ' · 할부 ' + won(loan) : ' · 일시불'), dis: room < C.price ? '가진 돈과 대출 한도로는 살 수 없습니다' : null, ai: 0.2 }));
      });
      if (have) opts.push(O('sell', '차를 팔고 뚜벅이로 돌아간다', { desc: '중고 시세 ' + won(have.value * 0.9) + ' · 유지비가 사라집니다', ai: 0.2 }));
      opts.push(O('no', have ? '지금 차를 계속 탄다' : '다음에 산다', { ai: 3 }));
      return { title: '자동차', icon: '🚗', desc: have ? '지금 차는 ' + D.CARS[have.k].name + '(' + have.y + '년 탐, 시세 ' + won(have.value) + ')입니다. 차는 사는 순간부터 값이 내립니다.' : '전시장 유리 너머로 새 차가 반짝입니다. 차값보다 무서운 건 보험료, 기름값, 주차비입니다.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      if (key === 'no') return R(null, '보류', '견적서만 받아 들고 나왔습니다. 영업사원의 문자가 일주일쯤 이어집니다.');
      var old = p.car;
      if (key === 'sell') { p.cash += old.value * 0.9; p.car = null; return R(null, '매각', '중고차 딜러에게 열쇠를 넘겼습니다. 주차 걱정이 사라지고 환승 걱정이 생겼습니다.'); }
      var C = D.CARS[key]; if (old) p.cash += old.value * 0.9;
      Sim.pay(p, C.price); p.car = { k: key, value: C.price, y: 0 }; p.happy += C.joy * 1.5;
      if (!p.fl.car1) { p.fl.car1 = 1; ms(p, '첫 차로 ' + U.josa(C.name, '을/를') + ' 샀습니다.', false); }
      else if (C.price >= 9000) ms(p, U.josa(C.name, '을/를') + ' 샀습니다.', false);
      return R(true, '출고', key === 'super' ? '시동을 거는 순간 주차장의 모든 시선이 모였습니다. 과속방지턱이 세상에서 가장 무섭습니다.' : key === 'lux' ? '엠블럼 하나에 이 돈을 냈나 싶다가도, 운전석에 앉으면 잊습니다.' : key === 'used' ? '주행거리 12만 km. 에어컨에서 낯선 냄새가 나지만, 내 차입니다.' : '비닐도 뜯지 않은 시트에 앉았습니다. 첫 흠집이 나기 전까지는 조심히 탑니다.', null, 'house');
    }
  };

  /* ================= 연봉 협상 (연말 고과) ================= */
  function canNego(p) {
    var j = p.job; if (!j || j.y < 1) return false; var J = D.JOBS[j.k];
    if (J.pen === 'civil' || j.k === 'resident' || j.k === 'milDoc' || j.k === 'heir' || j.partner) return false;
    return J.type === 'corp' || J.type === 'steady' || J.type === 'pro';
  }
  // 고과는 올해 성과(야근·자격증·프로젝트), 상사와의 관계, 능력치로 기운다. 평고과(B)가 가장 흔하다.
  function gradeOf(p, w) {
    var Z = D.SALARY, j = p.job, sc = (p.fl.perf || 0) * 0.45 + ((j.team ? j.team.rel : 50) - 50) / 25 + (p.st.dil + p.st.iq + p.st.social - 150) / 45 + (w.macro[p.age].hire < 1 ? -0.4 : 0) + H.diff(p).promo * 0.7;
    return U.wpick(p.rng, Z.grades, Z.w.map(function (x, i) { return x * Math.exp((2 - i) * 0.45 * clamp(sc, -2.5, 2.5)); }));
  }
  var GTXT = { S: '최고 등급입니다. 팀에서 한 명만 받습니다.', A: '기대 이상이라는 평가입니다.', B: '무난한 평고과입니다. 대부분이 받는 등급입니다.', C: '"조금 아쉬웠다"는 평가입니다.', D: '최하 등급입니다. 면담 자리의 공기가 무겁습니다.' };
  function pc(x) { return (x * 100).toFixed(1); }
  DEC.salary = {
    build: function (p, w, c) {
      var j = p.job, Z = D.SALARY, G = c.g || 'B', rs = Z.raise[G], yr = p.inc * 12, corp = D.JOBS[j.k].type === 'corp';
      var offer = G === 'D' ? '동결' : '+' + pc(rs[0]) + '~' + pc(rs[1]) + '% 인상';
      return { title: '연봉 협상', icon: '💼', desc: '연말 평가 면담. ' + (j.co ? j.co + ' ' : '') + '올해 고과는 ' + G + '등급 — ' + GTXT[G] + ' 올해 연봉은 ' + won(yr) + '(월 ' + won(p.inc) + '), 회사 제시안은 ' + offer + '입니다.', opts: [
        O('accept', '제시안에 사인한다', { desc: offer, ai: 3 }),
        O('nego', '근거를 들어 조금 더 요구한다', { desc: '성공하면 +' + pc(Z.nego.add[0]) + '~' + pc(Z.nego.add[1]) + '%p 추가 · 실패해도 제시안은 그대로', prob: pr(p, Z.nego.base, { social: 0.4, dil: 0.2 }, (p.fl.perf || 0) * 0.2), stats: ['social', 'dil'], ai: 2 }),
        O('counter', '다른 회사의 오퍼를 내민다', { desc: '성공하면 +' + pc(Z.counter.add[0]) + '~' + pc(Z.counter.add[1]) + '%p 추가 · 실패하면 제시안 그대로, 상사와 서먹해집니다', prob: pr(p, Z.counter.base, { social: 0.3, iq: 0.2 }, p.spec * 0.1), stats: ['social', 'iq'], ai: 0.4 }),
        O('move', '일단 사인하고 이직을 알아본다', { desc: corp ? '헤드헌터에게 연락합니다' : '다른 일자리를 알아봅니다 · 떨어져도 지금 일은 계속합니다', ai: 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job, Z = D.SALARY, G = c.g || 'B', before = p.inc, up = U.range(p.rng, Z.raise[G]), rl = null, ok = null;
      if (key === 'nego' || key === 'counter') { rl = roll(p, o.prob); ok = rl.ok; if (ok) up += U.range(p.rng, Z[key].add); else if (key === 'counter' && j.team) j.team.rel = Math.max(0, j.team.rel - 10); }
      j.mult = Math.min(Z.capMult, j.mult * (1 + up)); p.inc = Sim.jobInc(p, w);
      if (G === 'S' || G === 'A') p.happy += 2; else if (G === 'D') p.happy -= 4;
      var line = '연봉 ' + won(before * 12) + ' → ' + won(p.inc * 12) + '.';
      if (key === 'move') { if (D.JOBS[j.k].type === 'corp') Sim.q(p, 'jobchange', {}); else Sim.q(p, 'career', { keep: 1 }); return R(null, G + '등급', line + ' 사인한 펜을 내려놓고 이력서를 꺼냈습니다.'); }
      if (key === 'accept') return R(null, G + '등급', line + (G === 'D' ? ' "내년에는 꼭 챙겨 주겠다"는 말을 들었습니다.' : G === 'B' ? ' 물가 상승률과 비슷합니다.' : G === 'C' ? ' 숫자를 오래 들여다봤습니다.' : ' 인사팀장이 먼저 악수를 청했습니다.'));
      if (ok) return R(true, '추가 인상', '"이번만 특별히 맞춰 드리는 겁니다." ' + line, rl);
      return R(false, '제시안 그대로', (key === 'counter' ? '"그럼 그 회사로 가셔도 됩니다." 블러핑은 통하지 않았습니다. ' : '"형평성 문제가 있어서요." ') + line, rl);
    }
  };

  /* ================= 자유 행동 ================= */
  var ACT = Sim.ACTS = [];
  Sim.ACT_CATS = ['연애·가족', '일·자기계발', '생활', '집·자동차·자산'];
  function A(key, cat, icon, label, o) { o.key = key; o.cat = Sim.ACT_CATS[cat]; o.icon = icon; o.label = label; ACT.push(o); }
  function marks(p, g) { var f = p.fl, t = p.age * 4 + g.qtr; if (!f.aq || f.aq.t !== t) f.aq = { t: t, k: {} }; if (!f.ay || f.ay.a !== p.age) f.ay = { a: p.age, k: {} }; return f; }
  function single(p) { return !p.spouse && !p.partner; }
  function friend(g) { var c = g.peers.filter(function (q) { return q.rel && q.dead == null; }); if (!c.length) c = g.peers.filter(function (q) { return q.dead == null; }); return c.length ? U.pick(g.w.nr, c) : null; }
  function toDec(p, id, c) { Sim.qFront(p, id, c || {}); return null; }

  // --- 연애·가족 ---
  A('blind', 0, '☕', '소개팅', { cost: 10, cd: 'q', show: single, desc: '지인에게 주선을 부탁합니다', prob: function (p) { return pr(p, 0.7, { social: 0.5 }); }, stats: ['social'],
    run: function (p, g, rl) { if (!rl.ok) return R(false, '주선 불발', '"괜찮은 사람 있으면 소개해 줘." 다들 알아보겠다고만 했습니다.', rl); meet(p, 'blind'); return null; } });
  A('app', 0, '📱', '데이팅 앱', { cost: 5, cd: 'q', show: single, desc: '누구든 만날 수 있지만, 프로필이 전부 사실은 아닙니다', run: function (p) { meet(p, 'app'); return null; } });
  A('club', 0, '🎸', '동호회·모임 나가기', { cost: 30, cd: 'q', show: function (p) { return p.occ !== 'mil'; }, desc: '취미도 생기고, 사람도 만납니다',
    run: function (p, g, rl, dim) { p.happy += 1.5 * dim; if (single(p) && U.chance(p.rng, pr(p, 0.3, { social: 0.5 }))) { meet(p, 'club'); return null; } return R(null, '모임', '러닝 크루 단체 사진에 얼굴이 작게 나왔습니다. 다음 주에도 나가기로 했습니다.'); } });
  A('agency', 0, '📋', '결혼정보회사 상담', { cd: 'y', show: function (p) { return single(p) && p.age >= 25 && !(p.fl.ag && p.fl.ag.left > 0); }, desc: '조건이 등급이 되는 곳 · 가입비 ' + won(D.DATE.agency[0].fee) + '부터', run: function (p) { return toDec(p, 'agency'); } });
  A('agMeet', 0, '💌', function (p) { return '결정사 매칭 (남은 ' + p.fl.ag.left + '회)'; }, { cd: 'q', show: function (p) { return single(p) && p.fl.ag && p.fl.ag.left > 0; }, desc: '매니저가 조건에 맞는 상대를 골라 줍니다',
    run: function (p) { return toDec(p, 'agPref'); } });
  A('mat', 0, '🍵', '맞선', { cd: 'y', show: function (p) { return single(p) && p.age >= 27 && p.fam.alive > 0; }, desc: '부모님이 발 벗고 나섭니다 · 집안을 봅니다', run: function (p) { meet(p, 'mat'); return null; } });
  A('date', 0, '🎡', '데이트', { cd: 'q', show: function (p) { return !!p.partner; }, desc: function (p) { return U.josa(p.partner.name, '과/와') + ' 어디로 갈지 고릅니다 · 호감도 ♥' + Math.round(p.partner.aff == null ? 55 : p.partner.aff); }, run: function (p) { return toDec(p, 'dateHow'); } });
  A('propose', 0, '💍', '프로포즈', { cd: 'y', show: function (p) { return !!p.partner; }, dis: function (p) { return p.partner.yrs < 1 ? '아직 만난 지 얼마 안 됐습니다' : null; }, desc: '결혼 이야기를 꺼냅니다', run: function (p) { return toDec(p, 'marry'); } });
  A('family', 0, '🍲', '배우자와 시간 보내기', { cost: 40, cd: 'q', show: function (p) { return !!p.spouse; }, desc: '부부 사이가 좋아집니다',
    run: function (p, g, rl, dim) { p.mq = clamp(p.mq + 4 * dim, 0, 100); p.happy += 1.2 * dim; return R(null, '둘만의 저녁', '오랜만에 휴대폰을 뒤집어 놓고 밥을 먹었습니다. 할 말이 생각보다 많았습니다.'); } });
  A('baby', 0, '🍼', '자녀 계획 의논', { cd: 'y', show: function (p) { return !!p.spouse && p.kids.length < 3 && (p.sex === 'F' ? p.age : p.spouse.age) < 46; }, desc: '아이를 가질지 다시 이야기합니다', run: function (p) { return toDec(p, 'kids'); } });
  A('parents', 0, '🏡', '부모님 찾아뵙기', { cost: 20, cd: 'q', show: function (p) { return p.fam.alive > 0 && p.home.type !== 'parents' && p.occ !== 'mil'; }, desc: '반찬통이 따라옵니다',
    run: function (p, g, rl, dim) { p.happy += dim; p.fam.harmony = Math.min(99, p.fam.harmony + 1); return R(null, '본가', '"밥은 먹고 다니니." 돌아오는 길, 트렁크에 김치통이 세 개 실렸습니다.'); } });

  // --- 일·자기계발 ---
  A('overtime', 1, '🌙', '야근하며 성과 내기', { cd: 'q', show: function (p) { return !!p.job && D.JOBS[p.job.k].type === 'corp'; }, desc: '승진이 빨라지고 연봉 협상에 유리합니다 · 건강·행복 −',
    run: function (p, g) { var j = p.job; j.ry += 0.25; p.fl.perf = (p.fl.perf || 0) + 1; p.health -= 0.3; p.happy -= 1; if (U.chance(p.rng, 0.25)) { var b = Math.round(p.inc * 0.3 / 10) * 10; p.cash += b; return R(true, '성과 인정', '분기 평가에서 이름이 불렸습니다. 인센티브 ' + won(b) + '이 들어왔습니다.'); } return R(null, '야근', '사무실 불을 마지막으로 껐습니다. 택시비 영수증이 책상에 쌓입니다.'); } });
  A('study', 1, '📚', '자격증·어학 공부', { cost: 60, cd: 'q', mil: 1, show: function (p) { return p.age < 70; }, desc: '스펙이 쌓이면 취업·이직·연봉 협상에 유리합니다', prob: function (p) { return pr(p, 0.55, { dil: 0.5, iq: 0.3 }); }, stats: ['dil', 'iq'],
    run: function (p, g, rl) { if (rl.ok) { p.spec = Math.min(8, p.spec + 0.4); if (p.job) p.fl.perf = (p.fl.perf || 0) + 1; return R(true, '합격', '합격 문자를 받았습니다. 이력서에 한 줄이 늘었습니다.', rl); } p.spec = Math.min(8, p.spec + 0.1); return R(false, '불합격', '커트라인에서 두 문제가 모자랐습니다. 교재는 중고로 팔지 않기로 했습니다.', rl); } });
  A('side', 1, '🛵', '부업·알바', { cd: 'q', show: function (p) { return p.occ !== 'mil' && p.age < 75; }, desc: function (p) { return '이번 분기 약 ' + won(sideInc(p)) + ' · 건강·행복 −' + (p.car ? ' · 차가 있어 벌이가 낫습니다' : ''); },
    run: function (p) { var e = Math.round(sideInc(p) * U.range(p.rng, [0.8, 1.2]) / 10) * 10; p.cash += e; p.health -= 0.3; p.happy -= 1; return R(null, '부업', (p.occ === 'univ' ? '강의가 끝나면 편의점 조끼를 입습니다. ' : '퇴근 뒤와 주말을 팔았습니다. ') + won(e) + '을 벌었습니다.'); } });
  A('job', 1, '🧭', '이직·진로 알아보기', { cd: 'y', show: function (p) { return !!p.job && p.age < 62; }, desc: '떨어져도 지금 일은 계속합니다', run: function (p) { return toDec(p, 'career', { keep: 1 }); } });
  function sideInc(p) { return Math.round(3 * (45 + Math.max(0, (p.st.iq + p.st.dil + p.st.talent) / 3 - 40) * 2) * (p.car ? 1.2 : 1) / 10) * 10; }

  // --- 생활 ---
  A('gym', 2, '🏃', '운동', { cost: 15, mil: 1, desc: '건강 + · 꾸준히 하면 습관이 됩니다',
    run: function (p, g, rl, dim) { p.health += 0.25 * dim; p.happy += 0.3; p.fl.gymN = (p.fl.gymN || 0) + 1; if (!p.hab.ex && p.fl.gymN >= 4) { p.hab.ex = 1; return R(true, '운동 습관', '어느새 운동이 양치질 같은 일이 됐습니다. 건강이 천천히 닳기 시작합니다.'); } return R(null, '운동', '땀을 흘리고 나니 머리가 맑아졌습니다. 근육통은 내일의 몫입니다.'); } });
  A('rest', 2, '🛋️', '푹 쉬기·취미', { mil: 1, desc: '행복 +', run: function (p, g, rl, dim) { p.happy += 1.5 * dim; p.health += 0.1; return R(null, '휴식', U.pick(p.rng, ['주말 이틀을 침대와 소파 사이에서 보냈습니다. 아무 일도 없었고, 그래서 좋았습니다.', '밀린 드라마를 정주행했습니다. 새벽 세 시의 "다음 화"는 참기 어렵습니다.', '오래 묵혀 둔 취미를 꺼냈습니다. 시간 가는 줄 몰랐습니다.'])); } });
  A('trip', 2, '🚆', '국내 여행', { cost: 80, cd: 'q', show: function (p) { return p.occ !== 'mil'; }, desc: '행복 +', run: function (p, g, rl, dim) { p.happy += 2 * dim; if (p.spouse) p.mq = clamp(p.mq + 1.5, 0, 100); return R(null, '여행', p.car ? '차에 짐을 싣고 바다까지 달렸습니다. 휴게소 호두과자가 여행의 절반입니다.' : '기차 창가 자리에서 도시락을 먹었습니다. 바다는 생각보다 가까웠습니다.'); } });
  A('abroad', 2, '✈️', '해외 여행', { cost: 400, cd: 'y', show: function (p) { return p.occ !== 'mil'; }, desc: '행복 ++', run: function (p, g, rl, dim) { p.happy += 4 * dim; if (p.spouse) p.mq = clamp(p.mq + 3, 0, 100); return R(null, '해외 여행', '낯선 도시의 골목을 걸었습니다. 돌아오는 비행기에서 다음 여행을 검색했습니다.'); } });
  A('friends', 2, '🍻', '친구 만나기', { cost: 15, cd: 'q', show: function (p) { return p.occ !== 'mil'; }, desc: '행복 + · 친구들 근황을 듣습니다',
    run: function (p, g, rl, dim) {
      var q = friend(g), line = ''; p.happy += 1.2 * dim;
      if (q) { line = Sim.newsLine(q, g.w.nr).t; g.w.lastNews[q.id] = p.age; p.cur.push({ t: line, c: 'news' }); }
      if (single(p) && !p.noMarry && U.chance(p.rng, 0.15)) { meet(p, 'blind'); say(p, '술자리 끝에 친구가 말했습니다. "너 소개받을래? 진짜 괜찮은 사람 있어."'); return null; }
      return R(null, '친구', line || '오랜만에 만나도 어제 본 것 같은 얼굴들입니다. 다들 사는 게 비슷했습니다.');
    } });
  A('checkup', 2, '🩺', '건강검진', { cost: 60, cd: 'y', show: function (p) { return p.age >= 30; }, desc: '큰 병을 일찍 발견할 확률이 올라갑니다(2년)', run: function (p) { p.fl.chkY = p.age; p.health += 0.3; return R(null, '건강검진', '수면 내시경에서 깨어나니 "용종 하나 뗐어요"라는 말이 들렸습니다. 결과지는 2주 뒤에 옵니다.'); } });

  // --- 집·자동차·자산 ---
  A('license', 3, '🪪', '운전면허 따기', { cost: D.DRIVE.cost, cd: 'q', show: function (p) { return !p.fl.drv && p.age < 70; }, desc: '차를 사려면 필요합니다', prob: drvProb, stats: ['dil'], nopay: 1, run: function (p, g, rl) { return drive(p, { prob: rl.prob }); }, noroll: 1 });
  A('car', 3, '🚗', function (p) { return p.car ? '차 바꾸기·팔기' : '자동차 알아보기'; }, { cd: 'y', show: function (p) { return p.occ !== 'mil'; }, dis: function (p) { return p.fl.drv ? null : '운전면허가 없습니다'; }, desc: function (p) { return p.car ? '지금 차: ' + D.CARS[p.car.k].name + ' · 시세 ' + won(p.car.value) : '행복 +, 연애에도 조금 도움 · 유지비가 듭니다'; }, run: function (p) { return toDec(p, 'car'); } });
  A('house', 3, '🏠', '집 알아보기', { cd: 'y', show: function (p) { return p.occ !== 'mil'; }, desc: '이사, 전세, 매매를 검토합니다', run: function (p) { return toDec(p, 'housing', {}); } });
  A('cheong', 3, '🎟️', '아파트 청약 넣기', { cd: 'y', show: function (p) { return p.home.type !== 'own' && p.age >= 20 && p.occ !== 'mil'; }, desc: '무주택 기간과 자녀 수가 가점', run: function (p) { return toDec(p, 'cheongyak'); } });
  A('moveUp', 3, '🏙️', '상급지로 갈아타기', { cd: 'y', show: function (p) { return p.home.type === 'own'; }, desc: '지금 집을 팔고 옮깁니다', run: function (p) { return toDec(p, 'moveUp'); } });

  A('gap', 3, '🏘️', '갭투자·자동 운용 방침', { cd: 'y', show: function (p) { return p.age >= 22 && p.occ !== 'mil'; }, dis: function (p) { return Sim.liquid(p) <= 300 ? '굴릴 돈이 300만 원은 있어야 합니다' : null; }, desc: '전세 낀 아파트 매수, 연말 자동 배분 방식', run: function (p) { return toDec(p, 'invest'); } });
  A('lotto', 2, '🎰', '로또 사기', { cost: D.LOTTO.cost, cd: 'q', ap: 0, desc: '행동력을 쓰지 않습니다 · 1등 확률 ' + (D.LOTTO.tiers[0].p * 100) + '%',
    run: function (p) {
      var x = U.rnd(p.rng), acc = 0, L = D.LOTTO.tiers, i, amt;
      for (i = 0; i < L.length; i++) { acc += L[i].p; if (x < acc) { amt = Math.round(U.range(p.rng, L[i].amt)); p.cash += amt; if (i === 0) { p.fl.lotto1 = 1; p.happy += 15; ms(p, '로또 1등에 당첨돼 ' + won(amt) + '을 받았습니다.', false); return R(true, '1등 당첨', '번호 여섯 개를 세 번 다시 확인했습니다. 세금을 떼고 ' + won(amt) + '. 은행 본점에 갈 때는 아무에게도 말하지 않았습니다.', null, 'house'); } p.happy += i === 1 ? 6 : i === 2 ? 2 : 0.3; return R(true, L[i].name + ' 당첨', i >= 3 ? won(amt) + '. 본전입니다. 다음 주에도 사게 됩니다.' : won(amt) + '에 당첨됐습니다. 인생이 바뀌진 않지만, 한동안 저녁 메뉴가 바뀝니다.'); } }
      return R(null, '낙첨', U.pick(p.rng, ['번호 두 개가 맞았습니다. 일주일 치 희망의 값으로는 나쁘지 않았습니다.', '하나도 맞지 않았습니다. 종이를 구겨 버리고 다음 주 번호를 생각합니다.', '토요일 밤 8시 35분. 이번에도 내 번호는 아니었습니다.']));
    } });
  function val(x, p) { return typeof x === 'function' ? x(p) : x; }
  function actDis(g, a) {
    var p = g.p, f = marks(p, g), cost = val(a.cost, p) || 0, d = a.dis ? a.dis(p, g) : null;
    if (d) return d;
    if (a.ap !== 0 && g.ap < 1) return '행동력이 없습니다 (매달 ' + D.QTR.ap + '씩 회복, 최대 ' + D.QTR.apMax + ')';
    if (a.cd === 'q' && f.aq.k[a.key]) return '이번 분기에 이미 했습니다';
    if (a.cd === 'y' && f.ay.k[a.key]) return '올해 이미 했습니다';
    if (cost > 0 && Sim.liquid(p) < cost && Sim.hhGross(p) < cost) return '돈이 부족합니다 (' + won(cost) + ')';     // 월소득 이내면 카드로 긁는다
    return null;
  }
  Sim.actList = function (g) {
    var p = g.p;
    return ACT.filter(function (a) { return (p.occ !== 'mil' || a.mil) && (!a.show || a.show(p, g)); }).map(function (a) {
      return { key: a.key, cat: a.cat, icon: a.icon, label: val(a.label, p), desc: val(a.desc, p) || '', cost: val(a.cost, p) || 0, prob: a.prob ? H.dp(p, a.prob(p)) : null, base: a.prob ? a.prob(p) : null, dis: actDis(g, a), free: a.ap === 0 };
    });
  };
  // 반환: 결과(연출용) | { queued: true }(갈림길이 열림) | { none: true }(해당 없음) | null(실행 불가)
  Sim.act = function (g, key) {
    var p = g.p, a = null, i; for (i = 0; i < ACT.length; i++) if (ACT[i].key === key) a = ACT[i];
    if (!a || !Sim.isQ(g) || (a.show && !a.show(p, g)) || actDis(g, a)) return null;
    var f = marks(p, g), dim = 1 / (1 + (f.ay.k[key] || 0)), label = val(a.label, p), pb = a.prob ? H.dp(p, a.prob(p)) : null, cost = val(a.cost, p) || 0;
    if (cost && !a.nopay) Sim.pay(p, cost);
    var rl = pb == null ? null : a.noroll ? { prob: pb } : roll(p, pb), n0 = p.cur.length;
    p.cur.push({ t: '자유 행동 → ' + label, c: 'pick' });
    var res = a.run(p, g, rl, dim);
    if (!res && !Sim.view(p, g.w)) { p.cur.length = n0; if (cost && !a.nopay) p.cash += cost; return { none: true }; }
    if (a.ap !== 0) g.ap--; f.aq.k[key] = 1; f.ay.k[key] = (f.ay.k[key] || 0) + 1;
    p.happy = clamp(p.happy, 2, 99); p.health = clamp(p.health, 3, 100);
    if (!res) return { queued: true };
    if (res.text) p.cur.push({ t: res.text, c: res.ok === true ? 'good' : res.ok === false ? 'bad' : '' });
    res.label = label; res.dec = '자유 행동'; res.icon = a.icon;
    return res;
  };

  /* ================= 분기 돌발 사건 ================= */
  DEC.qLend = {
    build: function (p, w, c) {
      var no = Sim.liquid(p) < c.amt ? '여윳돈이 없습니다' : null;
      return { title: '돈 부탁', icon: '🤝', desc: c.rel + ' ' + U.josa(c.name, '이/가') + ' 어렵게 말을 꺼냅니다. "' + won(c.amt) + '만 빌려줄 수 있을까? 석 달 안에 꼭 갚을게."', opts: [
        O('lend', '빌려준다', { desc: '돌려받을 수도, 사람과 돈을 함께 잃을 수도 있습니다', prob: pr(p, 0.6, { social: 0.2 }), stats: ['social'], dis: no, ai: 0.6 }),
        O('half', '절반만, 받을 생각 없이 준다', { desc: won(c.amt / 2) + ' · 관계는 지킵니다', dis: Sim.liquid(p) < c.amt / 2 ? '여윳돈이 없습니다' : null, ai: 1 }),
        O('no', '미안하다고 거절한다', { ai: 1.5 }),
        O('mute', '"돈거래는 누구와도 안 한다"고 못 박아 둔다', { desc: '앞으로는 돈 부탁이 들어오지 않습니다', ai: 0.4 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'mute') { H.mute(p, 'qLend'); p.happy -= 1; return R(null, '원칙', '"미안한데, 나는 누구하고도 돈거래는 안 해." 소문은 빨리 돌았습니다. 그 뒤로 돈 얘기를 꺼내는 사람이 없습니다.'); }
      if (key === 'no') { p.happy -= 1.5; return R(null, '거절', '"미안, 나도 요즘 빠듯해서." 전화를 끊고 한동안 휴대폰을 내려다봤습니다.'); }
      if (key === 'half') { Sim.pay(p, c.amt / 2); p.happy += 2; return R(null, '그냥 준 돈', '"갚지 않아도 돼." 그 말을 하고 나니 오히려 마음이 편했습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { p.cash += c.amt * 0.02; p.happy += 3; return R(true, '돌려받음', U.josa(c.name, '은/는') + ' 약속한 날에 돈을 갚고 밥을 샀습니다. 사람을 믿어도 되는 날이 있습니다.', rl); }
      Sim.pay(p, c.amt); p.happy -= 5; return R(false, '연락 두절', '석 달이 지나고 여섯 달이 지났습니다. ' + won(c.amt) + '과 함께 친구 하나가 사라졌습니다.', rl);
    }
  };
  DEC.qTip = {
    build: function (p) {
      var liq = Sim.liquid(p);
      return { title: '"너만 알고 있어"', icon: '🤫', desc: '동료가 목소리를 낮춥니다. "이거 진짜 나만 아는 건데… 다음 주에 큰 공시가 뜬대." 듣도 보도 못한 종목입니다. 가진 돈은 ' + won(liq) + '.', opts: [
        O('big', '가진 돈의 20%를 태운다', { desc: won(liq * 0.2) + ' · 맞으면 두세 배, 틀리면 −65%', prob: 0.3, ai: H.risk(p) > 0.7 ? 1 : 0.1, amt: liq * 0.2 }),
        O('small', '재미로 조금만 넣는다', { desc: won(liq * 0.03), prob: 0.3, ai: 1, amt: liq * 0.03 }),
        O('no', '"나만 아는 정보"는 없다', { ai: 2.5 }),
        O('mute', '앞으로 이런 정보는 무시하기로 한다', { desc: '종목 귀띔이 다시는 들어오지 않습니다', ai: 0.4 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'mute') { H.mute(p, 'qTip'); return R(null, '차단', '"나는 주식 얘기 안 들어." 한 번 선을 그으니 그 뒤로는 아무도 목소리를 낮추지 않습니다.'); }
      if (key === 'no') return R(null, '무시', '고개만 끄덕이고 자리로 돌아왔습니다. 그 종목이 어떻게 됐는지는 찾아보지 않았습니다.');
      var rl = roll(p, o.prob);
      if (rl.ok) { var g = o.amt * U.range(p.rng, [0.6, 2.0]); p.cash += g; p.happy += 4; return R(true, '급등', '공시가 정말로 떴습니다. ' + won(g) + '을 벌었습니다. 다음에도 통할 거라는 착각이 함께 생겼습니다.', rl); }
      Sim.pay(p, o.amt * 0.65); p.happy -= key === 'big' ? 7 : 1.5; return R(false, '작전주', '공시는 없었고, 거래 정지 공지가 떴습니다. ' + won(o.amt * 0.65) + ' 손실. 동료는 그 뒤로 눈을 피합니다.', rl);
    }
  };
  DEC.qBonus = {
    build: function (p, w, c) {
      var heir = p.job && p.job.k === 'heir';
      return { title: heir ? '경영 성과급' : '성과급', icon: '💰', desc: (p.job && p.job.co ? p.job.co + '에서 ' : '') + (heir ? '올해 실적에 따른 경영 성과급 ' : '성과급 ') + won(c.amt) + '이 들어왔습니다. ' + (heir ? '숫자로 증명한 몫입니다.' : '통장에 잠깐 봄이 왔습니다.'), opts: [
        O('save', '전부 모은다', { ai: 2 }),
        heir ? O('staff', '직원들에게 회식과 상품권으로 돌린다', { desc: '절반을 씁니다 · 사내 평판 +', ai: 1.5 })
          : O('fam', p.spouse ? '배우자와 근사한 저녁을 먹는다' : p.fam.alive > 0 ? '부모님께 용돈을 드린다' : '고마운 사람들에게 한턱낸다', { desc: '절반을 씁니다 · 행복 +', ai: 1.5 }),
        O('flex', '나를 위해 다 쓴다', { desc: '행복 ++', ai: 0.6 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'save') { p.cash += c.amt; return R(null, '저축', '들어온 돈을 그대로 옮겼습니다. 숫자가 늘어나는 것도 하나의 취미입니다.'); }
      if (key === 'staff') { p.cash += c.amt / 2; p.happy += 2; if (p.job && p.job.team) p.job.team.rel = clamp(p.job.team.rel + 8, 0, 100); return R(null, '한턱', '전 직원 회식에 상품권을 얹었습니다. "낙하산"이라던 뒷말이 그날만큼은 "우리 ' + (p.job ? Sim.heirRank(p, p.job) : '대표') + '님"으로 바뀌었습니다.'); }
      if (key === 'fam') { p.cash += c.amt / 2; p.happy += 3; if (p.spouse) p.mq = clamp(p.mq + 4, 0, 100); else p.fam.harmony = Math.min(99, p.fam.harmony + 2); return R(null, '한턱', p.spouse ? '코스 요리의 마지막 접시까지 비웠습니다. 계산서는 보여 주지 않았습니다.' : '봉투를 받은 손이 한참 머뭇거렸습니다. "너 쓰지, 뭘 이런 걸."'); }
      p.happy += 6; return R(null, '플렉스', '택배 상자가 사흘 연속 도착했습니다. 다음 달의 나에게는 비밀입니다.');
    }
  };
  DEC.qWed = {
    build: function (p, w, c) {
      return { title: '청첩장', icon: '💌', desc: c.rel + ' ' + U.josa(c.name, '이/가') + ' 결혼합니다. 모바일 청첩장 아래에 계좌번호가 적혀 있습니다.', opts: [
        O('go', '참석해서 10만 원을 낸다', { desc: '뷔페는 먹고 옵니다', ai: 2 }),
        O('send', '5만 원만 보낸다', { ai: 1.5 }),
        O('no', '못 본 척한다', { desc: '행복 −', ai: 0.3 }),
        O('mute', '앞으로 청첩장은 챙기지 않기로 한다', { desc: '경조사 연락이 다시는 선택지로 뜨지 않습니다', ai: 0.1 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'mute') { H.mute(p, 'qWed'); return R(null, '정리', '모바일 청첩장 알림을 껐습니다. 낸 만큼 돌려받겠다는 계산도 함께 접었습니다.'); }
      if (key === 'no') { p.happy -= 1.5; return R(null, '읽씹', '단체방 알림을 껐습니다. 다음에 마주치면 뭐라고 할지 생각해 둡니다.'); }
      if (key === 'send') { Sim.pay(p, 5); return R(null, '송금', '"축하해! 못 가서 미안." 이모티콘을 세 개 붙였습니다.'); }
      Sim.pay(p, 10); p.happy += 1.5;
      if (single(p) && !p.noMarry && U.chance(p.rng, 0.25)) { meet(p, 'blind'); return R(null, '하객', '피로연 원형 테이블. 옆자리에 앉은 신부 측 친구와 자꾸 눈이 마주칩니다.'); }
      return R(null, '하객', '신랑 신부보다 뷔페 동선을 먼저 파악했습니다. 단체 사진 셋째 줄에 섰습니다.', null, 'wedding');
    }
  };
  DEC.qScam = {
    build: function (p, w, c) {
      return { title: '수익 보장', icon: '📈', desc: '"회원님만 특별히 모십니다. 원금 보장, 월 15% 수익." 단체방에는 수익 인증 사진이 쉴 새 없이 올라옵니다. 최소 입금액은 ' + won(c.amt) + '.', opts: [
        O('check', '수익 구조를 꼼꼼히 따져 본다', { desc: '간파하면 무사, 넘어가면 입금합니다', prob: pr(p, 0.6, { iq: 0.7 }), stats: ['iq'], ai: 1 }),
        O('in', '일단 넣어 본다', { desc: '진짜일 수도 있습니다', prob: 0.04, ai: 0.1 }),
        O('no', '방을 나간다', { ai: 3 }),
        O('mute', '모르는 초대와 투자 권유는 전부 차단한다', { desc: '"수익 보장" 권유가 다시는 오지 않습니다', ai: 0.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'mute') { H.mute(p, 'qScam'); return R(null, '영구 차단', '스팸 차단 앱을 깔고 모르는 번호와 단체방 초대를 전부 막았습니다. 세상이 조금 조용해졌습니다.'); }
      if (key === 'no') return R(null, '차단', '신고 버튼을 누르고 방을 나왔습니다. 세상에 공짜 점심은 없습니다.');
      var rl = roll(p, o.prob);
      if (key === 'check') { if (rl.ok) { p.happy += 1; return R(true, '간파', '사업자 등록번호를 조회해 보니 없는 회사였습니다. 인증 사진의 날짜도 전부 같았습니다.', rl); } Sim.pay(p, c.amt); p.happy -= 6; return R(false, '입금', '따져 볼수록 그럴듯했습니다. 입금한 다음 날 단체방이 사라졌습니다. ' + won(c.amt) + ' 손실.', rl); }
      if (rl.ok) { p.cash += c.amt; p.happy += 3; return R(true, '수익', '믿기지 않게도 돈이 두 배로 돌아왔습니다. 초기 회원이라 운이 좋았을 뿐입니다.', rl); }
      Sim.pay(p, c.amt); p.happy -= 6; return R(false, '먹튀', '출금 신청을 하자 "수수료를 먼저 입금하라"는 답이 왔습니다. ' + won(c.amt) + '은 돌아오지 않았습니다.', rl);
    }
  };
  DEC.qSick = {
    build: function (p) {
      return { title: '몸의 신호', icon: '🤒', desc: '며칠째 몸이 무겁습니다. 계단을 오르면 숨이 차고, 자고 일어나도 개운하지 않습니다.', opts: [
        O('doc', '병원에 간다', { desc: '진료비 ' + won(30), ai: 2 }),
        O('wait', '바쁘니까 좀 더 지켜본다', { desc: '대개는 괜찮아집니다', prob: 0.7, ai: 1.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'doc') { Sim.pay(p, 30); p.health += 1.5; p.fl.chkY = p.age; return R(null, '진료', '"과로네요. 쉬세요." 처방전과 함께 당연한 말을 돈 내고 들었습니다. 그래도 마음이 놓입니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) return R(true, '회복', '주말에 푹 자고 나니 괜찮아졌습니다. 이번에는요.', rl);
      p.health -= 5; Sim.pay(p, 150); return R(false, '악화', '결국 응급실에 갔습니다. 며칠 입원하고 ' + won(150) + '을 냈습니다. "왜 이제 오셨어요."', rl);
    }
  };
  DEC.qPartner = {
    build: function (p, w, c) {
      return { title: '동업 제안', icon: '🤝', desc: c.rel + ' ' + U.josa(c.name, '이/가') + ' 사업 계획서를 내밉니다. "자리는 봐 뒀어. ' + won(c.amt) + '만 넣으면 지분 30%야."', opts: [
        O('in', '투자한다', { desc: '잘 되면 몇 배, 안 되면 전부 잃습니다', prob: pr(p, 0.28, { iq: 0.2, social: 0.2 }), stats: ['iq', 'social'], ai: H.risk(p) > 0.6 ? 0.8 : 0.1 }),
        O('no', '응원만 한다', { ai: 3 }),
        O('mute', '지인과는 동업도 투자도 하지 않기로 한다', { desc: '동업 제안이 다시는 오지 않습니다', ai: 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'mute') { H.mute(p, 'qPartner'); return R(null, '원칙', '"사람은 사람으로, 돈은 돈으로." 그렇게 정하고 나니 거절이 쉬워졌습니다.'); }
      if (key === 'no') return R(null, '거절', '"잘 될 거야." 개업 날 화환을 보냈습니다.');
      Sim.pay(p, c.amt); var rl = roll(p, o.prob);
      if (rl.ok) { var g = Math.round(c.amt * U.range(p.rng, [2, 5]) / 100) * 100; p.cash += g; p.happy += 6; ms(p, '지인 사업에 투자해 ' + won(g) + '을 돌려받았습니다.', false); return R(true, '대박', '가게는 2호점을 냈고, 지분을 넘기며 ' + won(g) + '을 받았습니다.', rl); }
      p.happy -= 6; return R(false, '폐업', '1년을 못 채우고 간판이 내려갔습니다. ' + won(c.amt) + '과 함께 명절에 볼 얼굴 하나가 불편해졌습니다.', rl);
    }
  };
  DEC.qReunion = {
    build: function (p) {
      return { title: '동창 모임', icon: '🍶', desc: '단체방에 공지가 올라왔습니다. "이번 주 토요일, 다들 얼굴 좀 보자." 누가 뭘 하며 사는지 궁금하기도, 비교될까 겁나기도 합니다.', opts: [
        O('go', '나간다', { desc: '회비 ' + won(10) + ' · 친구들 근황을 듣습니다', ai: 2 }),
        O('no', '일이 있다고 한다', { ai: 1 }),
        O('mute', '동창 모임은 앞으로 나가지 않기로 한다', { desc: '모임 공지가 다시는 선택지로 뜨지 않습니다 · 친구 소식은 연말 근황으로만 듣습니다', ai: 0.15 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'mute') { H.mute(p, 'qReunion'); return R(null, '단체방 나가기', '"○○님이 나갔습니다." 한 줄을 남기고 단체방을 나왔습니다. 비교할 일도, 궁금해할 일도 조금 줄었습니다.'); }
      if (key === 'no') return R(null, '불참', '"다음엔 꼭 갈게." 사진이 올라오는 단체방을 조용히 지켜봤습니다.');
      Sim.pay(p, 10); p.happy += 2; c.lines.forEach(function (t) { p.cur.push({ t: t, c: 'news' }); });
      return R(null, '동창 모임', '명함이 오가고, 누군가는 집 얘기를, 누군가는 아이 얘기를 했습니다. 2차는 결국 학창 시절 이야기였습니다.');
    }
  };
  // [id, 가중치, 조건, 문맥 만들기]
  var QEV = [
    ['qLend', 0.25, function (p) { return Sim.liquid(p) > 500 && p.age < 70; }, function (p, g) { var q = friend(g); return { name: q ? q.name : '민수', rel: q && q.rel || '오랜 친구', amt: clamp(r100(Sim.liquid(p) * 0.1), 100, 2000) }; }],
    ['qTip', 2, function (p) { return Sim.liquid(p) > 500 && !!p.job && p.age < 65; }],
    ['qBonus', 3, function (p) { var J = p.job && D.JOBS[p.job.k]; return !!J && (J.type === 'corp' || J.type === 'steady') && J.pen !== 'civil'; }, function (p) { return { amt: Math.round(p.inc * U.range(p.rng, [0.6, 1.5]) / 10) * 10 }; }],
    ['qWed', 3, function (p) { return p.age >= 24 && p.age <= 42; }, function (p, g) { var q = friend(g); return { name: q ? q.name : '지은', rel: q && q.rel || '친구' }; }],
    ['qScam', 1.5, function (p) { return Sim.liquid(p) > 1000 && p.age >= 25; }, function (p) { return { amt: clamp(r100(Sim.liquid(p) * 0.1), 300, 3000) }; }],
    ['qSick', 2, function (p) { return p.age >= 30; }],
    ['qPartner', 1, function (p) { return Sim.liquid(p) > 3000 && p.age >= 30 && p.age <= 62; }, function (p, g) { var q = friend(g); return { name: q ? q.name : '성민', rel: q && q.rel || '지인', amt: 2000 }; }],
    ['qReunion', 2, function (p, g) { return p.age >= 25 && g.peers.some(function (q) { return q.dead == null; }); }, function (p, g) {
      var c = g.peers.filter(function (q) { return q.dead == null; }).sort(function (x, y) { return (g.w.lastNews[x.id] || 0) - (g.w.lastNews[y.id] || 0); }).slice(0, 3);
      return { lines: c.map(function (q) { g.w.lastNews[q.id] = p.age; return Sim.newsLine(q, g.w.nr).t; }) };
    }],
    ['jobchange', 1.5, function (p) { var j = p.job; return !!j && D.JOBS[j.k].type === 'corp' && j.rank < 4 && p.age < 45 && j.y >= 2; }]
  ];
  QEV.forEach(function (e) { e[4] = { qLend: 22, qPartner: 12, qSick: 5, qReunion: 5, qScam: 8, qTip: 5 }[e[0]] || 3; });     // 같은 사건이 다시 나오기까지의 최소 간격(년)
  Sim.Q = { A: A, meet: meet, meetCand: meetCand, mkCand: mkCand, friend: friend, toDec: toDec, single: single, QEV: QEV, r100: r100, grd: grd };       // extras.js가 이어서 쓴다
  // 달마다: 예정된 일(monthHook) → 돌발 사건(선택지 있음) → 소소한 사건·계절 한 줄(선택지 없음, flavor) 순으로 하나가 일어난다
  function qEvent(g) {
    var p = g.p, r = p.rng; if (Sim.teamCheck) Sim.teamCheck(g);
    if (Sim.monthHook && Sim.monthHook(g)) return;
    if (p.occ !== 'mil' && U.chance(r, D.QTR.eventP)) {
      var seen = p.fl.qev = p.fl.qev || {}, c = QEV.filter(function (e) { return !H.muted(p, e[0]) && !(seen[e[0]] && p.age - seen[e[0]] < e[4]) && e[2](p, g); });
      if (c.length) { var e = U.wpick(r, c, c.map(function (x) { return x[1]; })); seen[e[0]] = p.age; Sim.q(p, e[0], e[3] ? e[3](p, g) : {}); return; }
    }
    if (Sim.flavor) Sim.flavor(g);
  }
})();
