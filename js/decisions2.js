/* decisions2.js — 갈림길(2): 연애·가족·주거·재테크·건강·노년 */
(function () {
  'use strict';
  var clamp = U.clamp, won = U.won, say = Sim.say, ms = Sim.ms, DEC = Sim.DEC, H = Sim.H;
  var O = H.O, pr = H.pr, roll = H.roll, R = H.R;

  /* ================= 연애·결혼 ================= */
  H.grade = function (p) {
    var g = Math.log(Math.max(p.inc, 120) / 120) * 1.5, t = Sim.tierKey(p);
    g += ({ med: 1.5, medpro: 1.2, sky: 1.2, top: 0.9, abroad: 0.9, seoul: 0.6, edu: 0.6, natl: 0.4, local: 0.2, college: 0.1 })[t] || 0;
    g += (p.fam.cls - 3) * 0.25 + (p.st.looks - 50) * 0.012 + (p.car ? D.CARS[p.car.k].charm : 0);
    return clamp(g, 0, 5);
  };
  function spJob(inc) { return inc <= 0 ? '무직' : inc < 230 ? '비정규직' : inc < 330 ? '중소기업 직원' : inc < 480 ? '회사원' : inc < 700 ? '대기업 직원' : inc < 1100 ? '전문직' : '고소득 전문직'; }
  Sim.mkPartner = function (p) {
    var r = p.rng, sex = p.sex === 'M' ? 'F' : 'M', g = clamp(H.grade(p) + U.norm(r) * 0.9, 0, 5.5);
    var inc = U.chance(r, 0.1) ? 0 : Math.max(120, Math.round((150 + g * g * 38 + U.norm(r) * 30) / 10) * 10);
    return { name: Sim.makeName(r, sex), sex: sex, age: Math.max(19, p.age + U.rint(r, -4, 3)), inc: inc, job: spJob(inc), cls: clamp(Math.round(p.fam.cls * 0.5 + 1.5 + U.norm(r)), 1, 5), yrs: 0, asked: 0, aff: 55 };
  };
  Sim.wed = function (p, w) {
    var pt = p.partner, r = p.rng;
    p.spouse = { name: pt.name, sex: pt.sex, age: pt.age, inc: pt.inc, base: pt.inc, works: pt.inc > 0, job: pt.job, cls: pt.cls, pension: 0, looks: pt.looks || 50,
      deathAge: Math.round(clamp((pt.sex === 'F' ? 88 : 82) + U.norm(r) * 7, Math.max(60, pt.age + 5), 101)) };
    p.partner = null; p.married = true; p.mq = clamp(D.LOVE.mqStart[0] + U.norm(r) * D.LOVE.mqStart[1] + ((pt.chem || 50) - 50) * 0.25 + ((pt.aff == null ? 55 : pt.aff) - 55) * 0.2, 30, 99); p.fl.wedAge = p.fl.wedAge || p.age;
    Sim.pay(p, D.WED.cost);
    var g1 = p.fam.alive > 0 ? Math.min(D.GIFT.marry[p.fam.cls], p.fam.assets * 0.3) : 0, g2 = D.GIFT.marry[pt.cls] * 0.6, sav = pt.inc * 12 * 0.15 * Math.max(0, pt.age - 25);
    p.fam.assets -= g1; p.cash += g1 + g2 + sav; p.happy += 8; p.fl.kidAsk = p.age + 1; p.fl.wedGift = g1 + g2;
    ms(p, U.josa(pt.name, '과/와') + ' 결혼했습니다.', false);
    Sim.q(p, 'housing', { why: 'marry' });
  };
  DEC.marry = {
    build: function (p, w, c) {
      var pt = p.partner, ex = (p.job ? 0.3 : -1.2) + (Sim.netWorth(p) < -3000 ? -0.5 : 0) + (p.home.type === 'own' ? 0.5 : 0) + Math.min(pt.yrs, 5) * 0.1 + ((pt.aff == null ? 55 : pt.aff) - 55) / 30 + (pt.metFam ? 0.4 : 0);     // 연애하며 쌓은 호감과 상견례 전 인사
      return { title: '결혼', icon: '💍', desc: U.josa(pt.name, '과/와') + ' 만난 지 ' + pt.yrs + '년. 상대는 ' + pt.age + '세, ' + pt.job + (pt.inc ? '(월 ' + won(pt.inc) + ')' : '') + '. 결혼 이야기가 나옵니다. 예식 비용은 ' + won(D.WED.cost) + ' 안팎.', opts: [
        O('yes', '결혼하자고 한다', { desc: '상대와 양가의 승낙이 필요합니다', prob: pr(p, D.LOVE.marryBase, { social: 0.3, looks: 0.2 }, ex), stats: ['social', 'looks'], ai: p.age >= 28 ? 3 : 1.2 }),
        O('wait', '조금 더 만나 본다', { ai: p.age < 30 ? 1.5 : 0.6 }),
        O('bye', '헤어진다', { ai: 0.25 })] };
    },
    resolve: function (p, w, c, key, o) {
      var pt = p.partner;
      if (key === 'wait') { pt.asked = p.age; return R(null, '유예', '"조금만 더 준비되면"이라고 말했습니다. 상대는 고개를 끄덕였지만 표정은 읽기 어려웠습니다.'); }
      if (key === 'bye') { p.partner = null; p.happy -= 8; return R(null, '이별', '카페에서 마지막 인사를 나눴습니다. 돌아오는 길이 유난히 길었습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { Sim.wed(p, w); return R(true, '결혼', '예식은 30분 만에 끝났습니다. 축의금 봉투를 세며 첫날밤을 보냈습니다.' + (p.fl.wedGift > 0 ? ' 양가에서 ' + won(p.fl.wedGift) + '을 보태 주셨습니다.' : ''), rl, 'wedding'); }
      p.partner = null; p.happy -= 10;
      return R(false, '파혼', '상견례 자리에서 집과 직장 이야기가 오갔고, 이야기는 거기서 끝났습니다.', rl);
    }
  };
  DEC.match = {
    build: function (p) {
      var g = H.grade(p);
      return { title: '혼자인 ' + p.age + '세', icon: '🌙', desc: '주말마다 청첩장이 옵니다. 명절의 단골 질문은 "만나는 사람은 있니?"입니다.', opts: [
        O('agency', '결혼정보회사에 가입한다', { desc: '가입비 ' + won(400) + ' · 조건이 등급이 됩니다', prob: pr(p, 0.3, { looks: 0.3 }, (g - 2) * 0.6 + (p.job ? 0.3 : -1)), stats: ['looks'], dis: Sim.liquid(p) < 400 ? '가입비가 없습니다' : null, ai: 0.8 }),
        O('blind', '주변에 소개를 부탁한다', { prob: pr(p, 0.3, { social: 0.6, looks: 0.3 }, p.job ? 0.2 : -0.8), stats: ['social', 'looks'], ai: 2 }),
        O('wait', '인연을 기다린다', { ai: 1.5 }),
        O('solo', '비혼을 선택한다', { desc: '더는 결혼을 고민하지 않습니다', ai: p.age >= 40 ? 1.5 : 0.35 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'wait') return R(null, '기다림', '인연은 억지로 되는 게 아니라고들 합니다.');
      if (key === 'solo') { p.noMarry = true; p.happy += 3; ms(p, '비혼을 선택했습니다.', false); return R(null, '비혼', '혼자 사는 삶을 계획하기 시작했습니다. 축의금은 돌려받지 못할 투자가 됐습니다.'); }
      if (key === 'agency') Sim.pay(p, 400);
      var rl = roll(p, o.prob);
      if (rl.ok) { p.partner = Sim.mkPartner(p); p.partner.yrs = 1; p.happy += 5; return R(true, '만남', U.josa(p.partner.name, '을/를') + ' 만났습니다. 세 번째 만남에서 서로의 연봉 대신 좋아하는 음식을 물었습니다.', rl); }
      return R(false, '인연 없음', key === 'agency' ? '프로필 교환만 여러 번, 만남은 이어지지 않았습니다.' : '소개팅 자리의 어색한 침묵만 기억에 남았습니다.', rl);
    }
  };
  Sim.birth = function (p, w) {
    var r = p.rng, sex = U.chance(r, 0.51) ? 'M' : 'F', sp = p.spouse;
    var sur = (p.sex === 'M' || !sp) ? p.name.charAt(0) : sp.name.charAt(0);
    var k = { name: sur + U.pick(r, sex === 'M' ? T.GIVEN_M : T.GIVEN_F), sex: sex, age: 0, lvl: 1, withMe: true,
      iq: clamp(50 + 0.42 * (p.st.iq - 50) + (sp ? (sp.cls - 3) * 1.5 : 0) + U.norm(r) * 12.5, 5, 99) };
    p.kids.push(k); p.happy += 8; p.fl.lastBirth = p.age;
    ms(p, (p.kids.length === 1 ? '첫째 ' : p.kids.length === 2 ? '둘째 ' : '셋째 ') + U.josa(k.name, '이/가') + ' 태어났습니다.', false);
    return k;
  };
  DEC.kids = {
    build: function (p) {
      var n = p.kids.length, fAge = p.sex === 'F' ? p.age : p.spouse.age, fp = U.step(D.KID.fert, fAge + 1);
      var aiH = n === 0 ? 5 : n === 1 ? 3.4 : 0.3, inc = Sim.hhGross(p);
      if (inc < 350) aiH *= 0.55; if (p.home.type === 'own') aiH *= 1.3;
      return { title: n ? (n === 1 ? '둘째' : '셋째') + ' 계획' : '자녀 계획', icon: '🍼', desc: n ? '아이가 "동생 낳아 줘"라고 합니다. 가계부는 다른 말을 합니다.' : '결혼 생활이 자리를 잡았습니다. 아이 한 명을 대학까지 보내는 데 수억 원이 든다고들 합니다.', opts: [
        O('have', '아이를 갖는다', { desc: '양육비 월 ' + won(D.KID.base[0][1]) + '부터 · 20년 넘는 책임', prob: fp, ai: aiH }),
        O('later', '조금 미룬다', { ai: n ? 0.3 : 1 }),
        O('none', n ? '여기까지만' : '아이 없이 산다(딩크)', { ai: n === 0 ? 0.55 : n === 1 ? 1.3 : 3 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'later') { p.fl.kidAsk = p.age + 2; return R(null, '보류', '"집부터 마련하고"라고 말했습니다. 그 말을 한 지 몇 해째입니다.'); }
      if (key === 'none') { p.fl.kidAsk = 0; if (!p.kids.length) p.fl.dink = 1; return R(null, p.kids.length ? '가족 완성' : '딩크', p.kids.length ? '지금의 가족으로 충분하다고 결론 내렸습니다.' : '둘이 사는 삶을 택했습니다. 명절마다 이유를 설명해야 합니다.'); }
      var rl = roll(p, o.prob);
      if (!rl.ok) { p.fl.kidAsk = p.age + 1; p.happy -= 3; return R(false, '기다림', '아이는 아직 찾아오지 않았습니다. 병원 대기실의 시간은 느리게 갑니다.', rl); }
      var k = Sim.birth(p, w); p.fl.kidAsk = p.kids.length < 3 ? p.age + 3 : 0;
      if (p.kids.length === 1) Sim.qFront(p, 'dualIncome', {});
      return R(true, '탄생', U.josa(k.name, '이/가') + ' 태어났습니다. 3.2kg, 울음소리가 컸습니다. 그날부터 잠은 사치가 됩니다.', rl, 'baby');
    }
  };
  DEC.dualIncome = {
    build: function (p) {
      var sp = p.spouse, opts = [], k = p.job ? p.job.k : null, J = k ? D.JOBS[k] : null;
      if (p.job && sp.works) opts.push(O('both', '맞벌이를 유지한다', { desc: '돌봄 비용 월 ' + won(D.KID.care) + ' · 부부 모두 지칩니다', ai: 2.2 }));
      if (sp.works) opts.push(O('sp', '배우자가 육아를 전담한다', { desc: '배우자 소득 ' + won(sp.inc) + ' 중단 · 복귀 시 경력단절', ai: sp.inc < p.inc ? 1.6 : 0.4 }));
      if (p.job) opts.push(O('me', '내가 육아를 전담한다', { desc: '퇴사 · 복귀는 쉽지 않습니다', ai: !sp.works ? 0.05 : p.inc < sp.inc * 0.8 ? 1.5 : 0.25 }));
      if (p.job && (J.pen === 'civil' || k === 'large' || k === 'public')) opts.push(O('leave', '내가 1년 육아휴직을 쓴다', { desc: '1년간 소득 60% 감소 · 자리는 유지', ai: 1.8 }));
      if (!opts.length || (!p.job && !sp.works)) opts = [O('ok', '함께 돌본다', { ai: 1 })];
      else if (!p.job) opts.push(O('ok', '지금처럼 내가 돌본다', { ai: 3 }));
      return { title: '맞벌이와 육아', icon: '👶', desc: '출산휴가가 끝나 갑니다. 어린이집 대기 번호는 87번입니다.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      var sp = p.spouse;
      if (key === 'both') { p.fl.care = 1; p.mq -= 4; return R(null, '맞벌이', '아침마다 아이를 어린이집에 맡기고 뜁니다. 퇴근 후에는 두 번째 출근이 기다립니다.'); }
      if (key === 'sp') { sp.works = false; sp.back = p.age + 8; p.fl.care = 0; return R(null, '외벌이', '배우자가 사직서를 냈습니다. 가계부의 수입 칸이 하나로 줄었습니다.'); }
      if (key === 'me') { Sim.leaveJob(p, w, 'care'); p.occ = 'home'; p.fl.homeUntil = p.age + 7; p.fl.careerBreak = 1; p.spec = Math.max(0, p.spec - 2); ms(p, '육아를 위해 일을 그만뒀습니다.', false); return R(null, '육아 전담', '사원증을 반납하고 아기띠를 멨습니다. 경력란이 비어 가는 대신 아이의 첫 순간들을 봅니다.'); }
      if (key === 'leave') { p.fl.leave = p.age; p.fl.care = 1; return R(null, '육아휴직', '1년간 휴직계를 냈습니다. 복직 후의 자리 걱정은 잠시 접어 둡니다.'); }
      return R(null, '육아', '낮과 밤이 뒤섞인 한 해를 보냈습니다.');
    }
  };
  DEC.childEdu = {
    build: function (p, w, c) {
      var sec = c.stage === 'sec', n = p.kids.filter(function (k) { return k.age < 19; }).length, inc = Sim.hhGross(p), opts = [];
      D.KID.edu.forEach(function (e, i) {
        var cost = (sec ? e.sec : e.elem) * n, ratio = cost / Math.max(inc, 1), ai = i === 0 ? (ratio > 0.2 ? 2 : 0.6) : i === 1 ? 2 : (inc > 900 ? 1.5 : inc > 600 ? 0.5 : 0.08);
        opts.push(O('' + i, e.name, { desc: '월 ' + won(cost) + ' (가구 소득의 ' + U.pct(ratio) + '%) · 자녀의 입시 ' + (e.score > 0 ? '+' : e.score < 0 ? '−' : '±0'), dis: i === 2 && ratio > 0.6 ? '소득으로 감당할 수 없습니다' : null, ai: ai }));
      });
      return { title: sec ? '자녀 중·고등 사교육' : '자녀 사교육', icon: '🎒', desc: sec ? '아이가 중학생이 됐습니다. 학원비 고지서의 자릿수가 달라집니다.' : '아이가 초등학교에 갑니다. 이제 내가 학부모 단톡방에 초대될 차례입니다.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      var lvl = +key; p.kids.forEach(function (k) { if (k.age < 19) k.lvl = lvl; }); p.fl.eduLvl = Math.max(p.fl.eduLvl || 0, lvl);
      return R(null, D.KID.edu[lvl].name, ['"공부는 스스로 하는 것"이라고 말해 주었습니다. 절반은 신념, 절반은 형편입니다.', '옆집 아이가 다니는 학원에 등록했습니다. 불안의 값은 매달 자동이체됩니다.', '학원 라이딩이 일과가 됐습니다. 노후 자금 계좌는 당분간 열어 보지 않기로 합니다.'][lvl]);
    }
  };
  DEC.childWedding = {
    build: function (p, w, c) {
      var k = p.kids[c.i], nw = Sim.netWorth(p), big = Math.round(clamp(nw * 0.12, 5000, 40000) / 1000) * 1000, liq = Sim.liquid(p);
      return { title: '자녀의 결혼', icon: '💐', desc: U.josa(k.name, '이/가') + ' 결혼을 합니다. 요즘 신혼집 전세금은 부모 도움 없이는 어렵다고들 합니다.', opts: [
        O('big', '전세 보증금을 보태 준다', { desc: won(big), dis: liq < big ? '여윳돈이 부족합니다' : null, ai: nw > big * 6 ? 3 : 0.5, amt: big }),
        O('mid', '결혼식 비용만 댄다', { desc: won(2000), dis: liq < 2000 ? '여윳돈이 부족합니다' : null, ai: 2, amt: 2000 }),
        O('none', '축하하는 마음만 전한다', { ai: 0.7, amt: 0 })] };
    },
    resolve: function (p, w, c, key, o) {
      var k = p.kids[c.i]; Sim.pay(p, o.amt); k.rel = (k.rel || 50) + (key === 'big' ? 20 : key === 'mid' ? 8 : -8); k.gift = o.amt;
      p.happy += key === 'none' ? -2 : 4; if (o.amt >= 5000) p.fl.gave = (p.fl.gave || 0) + o.amt;
      return R(null, '자녀의 결혼', key === 'big' ? '통장에서 ' + won(o.amt) + '이 빠져나갔습니다. 내 부모가 해 주지 못했던 것을 해 주었습니다.' : key === 'mid' ? '예식장에서 혼주석에 앉았습니다. 축의금 정산은 밤늦게 끝났습니다.' : '"알아서 잘 살아라." 해 줄 수 있는 것이 그 말뿐이라 마음이 무거웠습니다.', null, 'wedding');
    }
  };
  Sim.divorce = function (p, w) {
    var withKids = p.kids.filter(function (k) { return k.age < 19; });
    if (p.home.type === 'own' || p.home.deposit) Sim.releaseHome(p);
    p.cash += Math.max(0, Sim.gapEq(p)); p.gaps = [];
    if (p.bld && p.bld.length) { p.cash += Sim.bldVal(p) * 0.96; p.bld = []; }
    p.cash /= 2; p.stock /= 2; p.coin /= 2; p.debt /= 2;
    var custody = U.chance(p.rng, p.sex === 'F' ? 0.7 : 0.3);
    withKids.forEach(function (k) { k.withMe = custody; });
    p.support = custody ? 0 : withKids.length * D.KID.childSupport; p.fl.supUntil = withKids.length ? p.age + (19 - Math.min.apply(null, withKids.map(function (k) { return k.age; }))) : 0;
    p.spouse = null; p.married = false; p.divorces++; p.mq = 0; p.happy -= 12; p.fl.kidAsk = 0; p.fl.care = 0;
    ms(p, '이혼했습니다.', false);
    p.home = { type: 'none', region: p.region }; Sim.q(p, 'housing', { why: 'divorce' });
  };
  DEC.divorce = {
    build: function (p) {
      return { title: '부부 관계의 위기', icon: '💔', desc: '대화가 사라진 지 오래입니다. 같은 집에 살지만 식사 시간이 다릅니다.', opts: [
        O('div', '이혼한다', { desc: '재산을 나누고 각자의 길을 갑니다', ai: 1 }),
        O('talk', '부부 상담을 받는다', { desc: '비용 ' + won(300), prob: pr(p, 0.45, { social: 0.5, dil: 0.2 }), stats: ['social'], ai: 2 }),
        O('endure', '참고 산다', { desc: '행복 −', ai: 1.6 })] };
    },
    resolve: function (p, w, c, key, o) {
      p.fl.divAsk = p.age;
      if (key === 'div') { Sim.divorce(p, w); return R(null, '이혼', '법원 복도의 의자는 딱딱했습니다. 도장을 찍는 데는 5분이 걸리지 않았습니다.'); }
      if (key === 'endure') { p.happy -= 6; p.mq += 6; return R(null, '인내', '"애들 봐서"라는 말로 한 해를 넘겼습니다.'); }
      Sim.pay(p, 300); var rl = roll(p, o.prob);
      if (rl.ok) { p.mq += 30; p.happy += 4; return R(true, '회복', '오랜만에 서로의 이야기를 끝까지 들었습니다. 주말에 함께 장을 봅니다.', rl); }
      p.mq += 4; return R(false, '평행선', '상담실에서도 같은 말이 반복됐습니다. 문제는 그대로 집에 돌아왔습니다.', rl);
    }
  };
  DEC.parentSupport = {
    build: function (p) {
      return { title: '부모님 부양', icon: '🧓', desc: '부모님이 일을 그만두셨습니다. 모아 둔 돈도, 연금도 넉넉지 않습니다.', opts: [
        O('m50', '매달 50만 원씩 드린다', { desc: '부모님이 살아 계신 동안', ai: p.inc > 350 ? 2 : 0.7 }),
        O('m15', '명절과 생신에 챙긴다', { desc: '월 15만 원꼴', ai: 2 }),
        O('no', '내 코가 석 자다', { desc: '행복 −', ai: p.inc < 220 ? 2 : 0.3 })] };
    },
    resolve: function (p, w, c, key) {
      p.fl.psAsk = 1;
      if (key === 'm50') { p.fl.psup = 50; p.happy += 2; return R(null, '부양', '월급날 다음 날 자동이체를 걸어 두었습니다. 부모님은 "됐다"면서도 통장을 확인하십니다.'); }
      if (key === 'm15') { p.fl.psup = 15; return R(null, '용돈', '명절 봉투의 두께를 매번 고민합니다.'); }
      p.fl.psup = 0; p.happy -= 4; return R(null, '미안함', '전화를 끊고 한참 앉아 있었습니다. 부모님은 괜찮다고 하셨습니다.');
    }
  };
  DEC.parentCare = {
    build: function (p, w, c) {
      var f = p.fam, own = f.assets >= 6000, sib = f.sib > 0, rich = f.cls >= 4 || f.assets >= 50000;
      var opts = [rich ? O('fac', '입주 간병인을 두고 댁에서 모신다', { desc: '24시간 간병 · 부모님 자산으로 감당합니다', ai: 2.5 }) : O('fac', '요양병원·요양원에 모신다', { desc: own ? '부모님 자산으로 감당합니다' : '월 ' + won(120) + ' 부담(약 3년)', ai: 2 }),
        O('self', '직접 모신다', { desc: '건강 −, 행복 −' + (p.job ? ', 일을 그만둘 수도 있습니다' : '') + ' · 후회는 덜합니다', ai: p.job ? 0.6 : 1.5 })];
      if (rich) opts.splice(1, 0, O('vip', '대학병원 연계 프리미엄 요양병원에 모신다', { desc: '1인실 · 전담 의료진 · 부모님 자산으로 감당합니다', ai: 1.5 }));
      if (sib) opts.push(O('sib', '형제자매와 의논한다', { desc: '잘 풀리면 부담을 나눕니다', prob: pr(p, 0.5, { social: 0.4 }), stats: ['social'], ai: 1.5 }));
      return { title: '부모님 간병', icon: '🏥', desc: (c.who === 'f' ? '아버지' : '어머니') + '께서 혼자 생활하기 어려워지셨습니다. 병원에서는 "보호자"를 찾습니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      var f = p.fam, own = f.assets >= 6000, rich = f.cls >= 4 || f.assets >= 50000;
      function fac(share) { if (own) f.assets -= 5000; else { p.fl.pcare = p.age + 3; p.fl.pcareCost = 120 * (share || 1); } }
      if (key === 'vip') { f.assets = Math.max(0, f.assets - 20000); p.happy -= 2; return R(null, '프리미엄 요양병원', '호텔 로비 같은 병동. 주치의가 매일 회진을 돕니다. 돈으로 살 수 있는 것은 다 해 드렸지만, 손을 잡아 드리는 일은 여전히 내 몫입니다.'); }
      if (key === 'fac' && rich) { f.assets = Math.max(0, f.assets - 12000); p.happy -= 1; return R(null, '자택 간병', '간병인 두 분이 교대로 댁을 지킵니다. 익숙한 방, 익숙한 창밖. 주말마다 찾아뵙니다.'); }
      if (key === 'fac') { fac(1); p.happy -= 3; return R(null, '요양원', '면회는 주말 30분. 돌아오는 차 안에서 아무도 말을 하지 않았습니다.'); }
      if (key === 'self') {
        p.health -= 6; p.happy -= 5; if (p.spouse) p.mq -= 6; p.fl.filial = 1;
        if (p.job && D.JOBS[p.job.k].type === 'corp' && U.chance(p.rng, 0.3)) { Sim.leaveJob(p, w, 'care'); Sim.q(p, 'career', {}); return R(null, '간병 퇴사', '간병과 회사를 함께 할 수 없었습니다. 사직서의 사유란에 "가사"라고 적었습니다.'); }
        return R(null, '간병', '기저귀를 갈고 죽을 끓입니다. 어릴 적 받은 것을 돌려드리는 시간입니다.');
      }
      var rl = roll(p, o.prob);
      if (rl.ok) { fac(0.4); return R(true, '분담', '형제들과 비용과 당번을 나눴습니다. 단톡방 이름은 "부모님 케어"입니다.', rl); }
      fac(1); p.happy -= 5; return R(false, '다툼', '"장남이", "가까이 사는 사람이". 말은 돌고 돌아 결국 내가 맡게 됐습니다.', rl);
    }
  };

  /* ================= 주거 ================= */
  function fundsFor(p) {     // 집을 옮길 때 동원 가능한 자기 돈
    var h = p.home, v = Sim.liquid(p) + (h.deposit || 0);
    if (h.type === 'own') v += h.value * (1 - D.HOUSE.sellCost) - (p.rm || 0);
    return v;
  }
  H.buyPlan = function (p, w, price) {
    var need = price * (1 + D.HOUSE.buyCost), have = fundsFor(p), gift = 0;
    if (!p.fl.giftH && p.fam.alive > 0) gift = Math.min(D.GIFT.house[p.fam.cls], p.fam.assets * 0.25);
    var loan = Math.max(0, need - have - gift), cap = Sim.loanCap(p, w, false), capS = Sim.loanCap(p, w, true);
    var ok = loan <= Math.min(price * D.LOAN.ltv, cap), st = !ok && loan <= Math.min(price * D.LOAN.ltvStretch, capS);
    return { ok: ok, stretch: st, loan: loan, gift: loan > 0 || have < need ? gift : 0, mi: loan * Sim.loanRate(w, p) / 12, price: price };
  };
  H.doBuy = function (p, w, region, kind, plan, value) {
    if (plan.gift) { p.fam.assets -= plan.gift; p.cash += plan.gift; p.fl.giftH = 1; }
    Sim.setHome(p, w, 'own', { region: region, kind: kind, price: plan.price, value: value, stretch: plan.stretch });
  };
  function planDesc(pl) { return '시세 ' + won(pl.price) + (pl.loan > 0 ? ' · 대출 ' + won(pl.loan) + '(월 이자 ' + won(pl.mi) + ')' : ' · 대출 없이') + (pl.gift ? ' · 부모님 지원 ' + won(pl.gift) : ''); }
  function buyOpt(p, w, key, label, region, kind, aiBase) {
    var price = Sim.homePrice(w, p, 'own', kind, region), pl = H.buyPlan(p, w, price), dis = null, risk = H.risk(p);
    if (!pl.ok && !pl.stretch) dis = '대출 한도 초과 (필요 대출 ' + won(pl.loan) + ')';
    return O(key, (pl.stretch ? '영끌 ' : '') + label, { desc: planDesc(pl) + (pl.stretch ? ' · 한도까지 끌어모읍니다. 금리가 오르면 위험합니다' : ''), dis: dis, ai: pl.ok ? aiBase : aiBase * 0.25 * (0.3 + risk * 1.6) * (w.macro[p.age].k === 'boom' ? 2.2 : 1), plan: pl, region: region, kind: kind, buy: 1 });
  }
  function jeonseOpt(p, w, key, label, kind, ai, region) {
    var reg = region || p.region, dep = Sim.homePrice(w, p, 'jeonse', kind, reg), loan = Math.max(0, dep - fundsFor(p)), dis = null;
    if (loan > Math.min(dep * D.LOAN.jeonseLtv, Sim.loanCap(p, w, false))) dis = '전세대출 한도 초과 (필요 대출 ' + won(loan) + ')';
    return O(key, label, { desc: '보증금 ' + won(dep) + (loan > 0 ? ' · 전세대출 ' + won(loan) : '') + (kind === 'villa' ? ' · 전세 사기 위험이 조금 더 높습니다' : ''), dis: dis, ai: ai, kind: kind, region: reg });
  }
  var DOWN = { gangnam: 'seoul', seoul: 'newtown', newtown: 'metro', metro: 'city', city: 'rural' };
  var UP = { rural: 'city', city: 'metro', metro: 'newtown', newtown: 'seoul', seoul: 'gangnam' };
  DEC.housing = {
    build: function (p, w, c) {
      var h = p.home, reg = p.region, R0 = D.REG[reg], opts = [], single = !p.spouse && !p.kids.length, old = p.age >= 60;
      var cur = h.type !== 'none' && h.type !== 'parents';
      if (cur && c.why !== 'marry') opts.push(O('stay', '지금 집에 계속 산다', { desc: Sim.homeLabel(p), ai: h.type === 'monthly' ? 1 : 2.5 }));
      if (h.type === 'parents' && single && p.fam.alive > 0) opts.push(O('parents', '부모님 집에 남는다', { desc: '월세가 굳습니다. 잔소리는 덤입니다', ai: p.age < 30 ? 4 : p.age < 36 ? 1.5 : 0.5 }));
      var rent = Math.round(R0.rent * (Sim.famSize(p) > 1 ? D.HOUSE.familyRentMult : 1));
      if (h.type !== 'monthly') opts.push(O('monthly', '월세', { desc: '보증금 ' + won(D.HOUSE.monthlyDeposit) + ' · 월 ' + won(rent), ai: 1 }));
      opts.push(jeonseOpt(p, w, 'jv', '빌라 전세', 'villa', old ? 0.6 : 1.5));
      opts.push(jeonseOpt(p, w, 'ja', '아파트 전세', 'apt', old ? 0.8 : 2.6));
      var yf = p.age < 30 ? 0.2 : p.age < 34 ? 0.55 : 1;
      opts.push(buyOpt(p, w, 'bv', '빌라·소형 매매', reg, 'villa', (old ? 1.5 : 1.3) * yf));
      opts.push(buyOpt(p, w, 'ba', '아파트 매매', reg, 'apt', 5 * yf));
      if (DOWN[reg] && D.REG[reg].rank >= 3) opts.push(buyOpt(p, w, 'bd', D.REG[DOWN[reg]].name + ' 아파트 매매', DOWN[reg], 'apt', 1.6));
      // 상급지 갈아타기: 지금 집(자가·보증금)을 정리한 돈까지 합쳐 한두 단계 위 지역으로 옮긴다
      var up = UP[reg], up2 = up && UP[up], own = h.type === 'own';
      if (up) {
        opts.push(buyOpt(p, w, 'bu', '상급지 ' + (own ? '갈아타기' : '진입') + ': ' + D.REG[up].name + ' 아파트 매매', up, 'apt', own ? 0.5 : 0.25));
        opts.push(buyOpt(p, w, 'buv', '상급지 ' + (own ? '갈아타기' : '진입') + ': ' + D.REG[up].name + ' 빌라·소형 매매', up, 'villa', 0.1));
        opts.push(jeonseOpt(p, w, 'ju', '상급지 이사: ' + D.REG[up].name + ' 아파트 전세', 'apt', 0.2, up));
      }
      if (up2) opts.push(buyOpt(p, w, 'bu2', '상급지 ' + (own ? '갈아타기' : '진입') + ': ' + D.REG[up2].name + ' 아파트 매매', up2, 'apt', 0.12));
      var d = { marry: '신혼집을 구해야 합니다. ', divorce: '혼자 살 집을 구해야 합니다. ', job: '독립할 때가 됐습니다. ', fraud: '', forced: '집을 내주고 나왔습니다. ' }[c.why] || (h.type === 'jeonse' || h.type === 'monthly' ? '계약 만기가 다가옵니다. ' : '');
      return { title: '살 집', icon: '🏠', desc: d + D.REG[reg].name + ' 아파트 시세는 ' + won(Sim.price(w, reg, p.age)) + '. 가진 돈은 ' + won(fundsFor(p)) + ', 가구 소득은 월 ' + won(Sim.hhGross(p)) + '입니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      p.fl.houseAsk = p.age;
      if (key === 'stay') return R(null, '재계약', '집주인과 재계약을 했습니다. 다음 만기까지 한숨 돌립니다.');
      if (key === 'parents') return R(null, '캥거루', '방문에 "노크 필수"를 붙였습니다. 독립은 조금 더 미뤄집니다.');
      if (key === 'monthly') { Sim.setHome(p, w, 'monthly'); return R(null, '월세 계약', '보증금 ' + won(D.HOUSE.monthlyDeposit) + '에 월세 ' + won(p.home.rent) + '. 매달 25일, 집주인에게 돈이 건너갑니다.'); }
      if (key === 'jv' || key === 'ja' || key === 'ju') { Sim.setHome(p, w, 'jeonse', { kind: o.kind, region: o.region }); return R(null, '전세 계약', '등기부등본을 세 번 확인하고 도장을 찍었습니다. 보증금 ' + won(p.home.deposit) + '.' + (p.debt > 0 ? ' 은행과의 긴 동행이 시작됩니다.' : ''), null, 'house'); }
      var upMove = p.home.type === 'own' && D.REG[o.region].rank > D.REG[p.home.region].rank;
      H.doBuy(p, w, o.region, o.kind, o.plan); if (upMove) p.fl.movedUp = (p.fl.movedUp || 0) + 1;
      ms(p, D.REG[o.region].name + '에 ' + (o.kind === 'villa' ? '빌라' : '아파트') + '를 ' + (o.plan.stretch ? '영끌로 ' : '') + '매수했습니다.', false); p.happy += 7 - (o.plan.stretch ? 4 : 0);
      return R(true, '내 집 마련', '등기권리증을 받았습니다. ' + (o.plan.loan > 0 ? '현관문은 내 것이고, 나머지는 당분간 은행 것입니다.' : '대출 없는 내 집. 벽에 못을 박아도 되는 삶이 시작됩니다.'), null, 'house');
    }
  };
  DEC.moveUp = {
    build: function (p, w, c) {
      var h = p.home, opts = [];
      if (h.kind === 'villa') opts.push(buyOpt(p, w, 'apt', '같은 지역 아파트로 갈아타기', h.region, 'apt', 2));
      if (UP[h.region]) opts.push(buyOpt(p, w, 'up', D.REG[UP[h.region]].name + ' 아파트로 갈아타기', UP[h.region], 'apt', h.kind === 'villa' ? 0.5 : 1.5));
      opts.push(O('stay', '지금 집에 산다', { ai: 2 }));
      return { title: '갈아타기', icon: '🏙️', desc: '지금 집(' + Sim.homeLabel(p) + ', ' + won(h.value) + ')을 팔고 상급지로 옮길 수 있습니다. "집은 사는(live) 곳이 아니라 사는(buy) 것"이라는 말이 다시 유행합니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      p.fl.houseAsk = p.age;
      if (key === 'stay') return R(null, '정착', '이사는 접었습니다. 아이 학교와 단골 병원이 여기 있습니다.');
      H.doBuy(p, w, o.region, o.kind, o.plan); p.fl.movedUp = (p.fl.movedUp || 0) + 1; p.happy += 5 - (o.plan.stretch ? 4 : 0);
      ms(p, D.REG[o.region].name + ' 아파트로 갈아탔습니다.', false);
      return R(true, '갈아타기', '이삿짐 트럭이 다리를 건넜습니다. 평수는 줄었지만 주소가 달라졌습니다.', null, 'house');
    }
  };
  DEC.cheongyak = {
    build: function (p, w) {
      var Hh = D.HOUSE, yrs = Math.max(0, p.age - 26), pb = Math.min(Hh.cheongyakMax, Hh.cheongyakBase + yrs * Hh.cheongyakPerYear + p.kids.length * Hh.cheongyakPerKid);
      var mk = Sim.price(w, p.region, p.age), price = Math.round(mk * Hh.cheongyakDiscount / 100) * 100, pl = H.buyPlan(p, w, price);
      return { title: '아파트 청약', icon: '🎟️', desc: D.REG[p.region].name + '에 신축 분양 공고가 떴습니다. 분양가 ' + won(price) + '(시세의 ' + U.pct(Hh.cheongyakDiscount) + '%). 무주택 기간과 자녀 수가 가점이 됩니다.', opts: [
        O('go', '청약을 넣는다', { desc: pl.ok || pl.stretch ? planDesc(pl) : '당첨돼도 자금이 모자랍니다 (필요 대출 ' + won(pl.loan) + ')', prob: pb, ai: pl.ok ? 5 : pl.stretch ? 2 : 0.1, plan: pl, mk: mk }),
        O('no', '넣지 않는다', { ai: 0.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'no') return R(null, '패스', '경쟁률 기사만 읽고 창을 닫았습니다.');
      var rl = roll(p, o.prob);
      if (!rl.ok) return R(false, '낙첨', '예비 번호도 받지 못했습니다. 경쟁률은 수백 대 일이었습니다.', rl);
      var pl = o.plan;
      if (!pl.ok && !pl.stretch) { p.happy -= 5; return R(false, '당첨 포기', '당첨 문자를 받았지만 계약금과 중도금을 마련할 길이 없었습니다. 당첨은 무효가 됐습니다.', rl); }
      H.doBuy(p, w, p.region, 'apt', pl, o.mk); p.fl.cheongyak = 1; p.happy += 10;
      ms(p, '청약에 당첨돼 ' + D.REG[p.region].name + ' 신축 아파트에 입주했습니다.', false);
      return R(true, '청약 당첨', '당첨자 명단에 이름이 있었습니다. 주변에서는 "로또"라고 부릅니다.', rl, 'house');
    }
  };
  DEC.downsize = {
    build: function (p, w) {
      var h = p.home, opts = [], to = DOWN[h.region], to2 = to && DOWN[to] ? DOWN[to] : to;
      if (to2) { var pr2 = Sim.homePrice(w, p, 'own', 'apt', to2), free = h.value * (1 - D.HOUSE.sellCost) - pr2 * (1 + D.HOUSE.buyCost); if (free > 2000) opts.push(O('move', U.josa(D.REG[to2].name, '으로/로') + ' 이주한다', { desc: '차액 ' + won(free) + '이 노후 자금이 됩니다 · 친구와 병원에서 멀어집니다', ai: Sim.liquid(p) < 10000 ? 1.5 : 0.4, region: to2, kind: 'apt', price: pr2 })); }
      if (h.kind !== 'villa') { var pv = Sim.homePrice(w, p, 'own', 'villa', h.region), fr = h.value * (1 - D.HOUSE.sellCost) - pv * (1 + D.HOUSE.buyCost); if (fr > 2000) opts.push(O('small', '같은 동네 작은 집으로 옮긴다', { desc: '차액 ' + won(fr), ai: Sim.liquid(p) < 10000 ? 1.2 : 0.3, region: h.region, kind: 'villa', price: pv })); }
      opts.push(O('stay', '살던 집에서 산다', { ai: 2 }));
      return { title: '집 줄이기', icon: '🧳', desc: '자산의 대부분이 집 한 채에 묶여 있습니다(' + won(h.value) + '). 집을 줄이면 생활비가 나옵니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'stay') return R(null, '그대로', '익숙한 동네를 떠나지 않기로 했습니다.');
      Sim.setHome(p, w, 'own', { region: o.region, kind: o.kind, price: o.price }); p.fl.downsized = 1;
      if (key === 'move') { p.happy -= 2; ms(p, U.josa(D.REG[o.region].name, '으로/로') + ' 이주했습니다.', false); return R(null, '이주', '이삿짐을 절반으로 줄였습니다. 새 동네에는 아는 사람이 없지만 공기는 좋습니다.', null, 'house'); }
      return R(null, '집 줄이기', '방 하나를 줄였습니다. 청소는 편해졌고 통장은 두둑해졌습니다.', null, 'house');
    }
  };
  DEC.housePension = {
    build: function (p, w) {
      var rate = U.after(Object.keys(D.HOUSE.reversePension).map(function (k) { return [+k, D.HOUSE.reversePension[k]]; }), p.age), pay = Math.round(p.home.value * rate / 5) * 5;
      return { title: '주택연금', icon: '🏡', desc: '집(' + won(p.home.value) + ')을 담보로 맡기면 살던 집에 살면서 매달 연금을 받습니다. 대신 자녀에게 물려줄 집은 줄어듭니다.', opts: [
        O('join', '주택연금에 가입한다', { desc: '평생 월 ' + won(pay), ai: Sim.liquid(p) < 5000 ? 3 : 0.6, pay: pay }),
        O('no', '집은 지킨다', { ai: p.kids.length ? 1.5 : 0.7 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'no') return R(null, '보류', '"집 한 채는 남겨야지." 통장은 얇아도 등기부는 깨끗합니다.');
      p.rmPay = o.pay; p.fl.rm = 1; ms(p, '주택연금에 가입했습니다.', false);
      return R(null, '주택연금', '매달 ' + won(o.pay) + '이 들어옵니다. 집이 뒤늦게 효도를 합니다.');
    }
  };

  /* ================= 재테크 ================= */
  DEC.invest = {
    build: function (p, w) {
      var liq = Sim.liquid(p), reg = D.REG[p.region].rank >= 3 ? p.region : 'newtown', price = Sim.price(w, reg, p.age), jr = D.REG[reg].jr, eq = price * (1 - jr) + price * D.HOUSE.buyCost, risk = H.risk(p);
      var opts = [O('save', '예·적금', { desc: '연 ' + (D.RATE.deposit * 100).toFixed(1) + '%(실질) · 잃지 않습니다', ai: 2.2 - risk }),
        O('stock', '주식·ETF 적립', { desc: '평균 연 ' + U.pct(D.RATE.stockMean) + '% 안팎 · 위기 때 크게 빠집니다', ai: 1 + risk }),
        O('aggr', '주식 + 코인 공격 투자', { desc: '코인은 두 배가 되기도, 반의 반이 되기도 합니다', ai: risk > 0.6 ? 0.8 : 0.1 })];
      var GL = Sim.gaps(p);
      if (GL.length < (p.isPlayer ? D.GAP_MAX : 1)) {
        opts.push(O('gap', '갭투자 (' + D.REG[reg].name + ' 아파트)', { desc: '전세를 끼고 매수 · 내 돈 ' + won(eq) + ' · 집값이 내리면 역전세', dis: liq < eq ? '투자금 부족' : null, ai: risk > 0.5 && w.macro[p.age].k === 'boom' ? 2 : risk > 0.7 ? 0.5 : 0.08, reg: reg, price: price, eq: eq, gapBuy: 1 }));
        // 플레이어는 다른 지역도 고를 수 있다(동년배는 고르지 않는다)
        if (p.isPlayer) ['gangnam', 'seoul', 'newtown', 'metro', 'city'].forEach(function (rk) {
          if (rk === reg) return; var pr2 = Sim.price(w, rk, p.age), e2 = Math.round(pr2 * (1 - D.REG[rk].jr) + pr2 * D.HOUSE.buyCost);
          opts.push(O('gap_' + rk, '갭투자 (' + D.REG[rk].name + ' 아파트)', { desc: '매매가 ' + won(pr2) + ' · 내 돈 ' + won(e2) + ' · 평소 상승률 연 ' + (D.REG[rk].g * 100).toFixed(1) + '%', dis: liq < e2 ? '투자금 부족' : null, ai: 0, reg: rk, price: pr2, eq: e2, gapBuy: 1 }));
        });
      }
      GL.forEach(function (x, i) { opts.push(O('sellGap' + i, '갭투자한 ' + D.REG[x.region].name + (x.kind === 'villa' ? ' 빌라' : ' 아파트') + '를 판다', { desc: '현재 시세 ' + won(x.value) + ' · 매수가 ' + won(x.buy), ai: x.value > x.buy * 1.3 ? 1.5 : 0.3, sellIdx: i })); });
      return { title: '재테크', icon: '💹', desc: '굴릴 수 있는 돈은 ' + won(liq) + '. 지금은 "' + ({ save: '예·적금', stock: '주식 적립', aggr: '공격 투자', manual: '직접 운용' })[p.inv] + '" 중입니다. 앞으로 몇 년의 방침을 정합니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (o.gapBuy) { Sim.pay(p, o.eq); Sim.gaps(p).push({ region: o.reg, kind: 'apt', value: o.price, dep: Math.round(o.price * D.REG[o.reg].jr), buy: o.price }); p.fl.gapN = (p.fl.gapN || 0) + 1; ms(p, D.REG[o.reg].name + ' 아파트를 전세 끼고 매수했습니다.', false); return R(null, '갭투자', '세입자의 보증금이 내 지렛대가 됐습니다. 이제 부동산 뉴스가 남 일이 아닙니다.', null, 'house'); }
      if (o.sellIdx != null) { return R(null, '매도', Sim.sellGap(p, false, o.sellIdx)); }
      p.inv = key;
      return R(null, ({ save: '예·적금', stock: '주식 적립', aggr: '공격 투자' })[key], { save: '특판 적금을 찾아 은행 앱을 세 개 깔았습니다.', stock: '월급날마다 자동 매수를 걸었습니다. 계좌는 되도록 열어 보지 않기로 합니다.', aggr: '새벽에도 시세 알림이 울립니다. 수면의 질은 수익률과 반비례합니다.' }[key]);
    }
  };
  Sim.sellGap = function (p, forced, i) {
    var L = Sim.gaps(p), g = L[i || 0], sale = g.value * (forced ? 0.88 : 1) * (1 - D.HOUSE.sellCost), gain = sale - g.buy, tax = gain > 0 ? gain * D.HOUSE.gapTax : 0, net = sale - g.dep - tax;
    L.splice(i || 0, 1); if (net >= 0) p.cash += net; else Sim.pay(p, -net);
    p.fl.gapGain = (p.fl.gapGain || 0) + (gain - tax);
    ms(p, '갭투자한 ' + D.REG[g.region].short + (g.kind === 'villa' ? ' 빌라를 ' : ' 아파트를 ') + (gain >= 0 ? won(gain - tax) + ' 차익을 남기고' : won(-gain) + ' 손해를 보고') + ' 팔았습니다.', false);
    return gain >= 0 ? '양도세를 내고도 ' + won(gain - tax) + '이 남았습니다. 노동 소득으로는 몇 해가 걸릴 돈입니다.' : '매수가보다 낮게 팔았습니다. 세입자 보증금을 돌려주느라 대출을 받았습니다.';
  };
  DEC.coinFomo = {
    build: function (p) {
      var liq = Sim.liquid(p);
      return { title: '코인 불장', icon: '🚀', desc: '직장 동료가 코인으로 차를 바꿨다고 합니다. 점심시간마다 수익률 인증이 올라옵니다. 가진 돈은 ' + won(liq) + '.', opts: [
        O('big', '가진 돈의 30%를 넣는다', { desc: won(liq * 0.3) + ' · 제때 팔면 2~3배, 아니면 −60%', prob: 0.35, ai: H.risk(p) > 0.7 ? 1.2 : 0.12, amt: liq * 0.3 }),
        O('small', '잃어도 되는 만큼만 넣는다', { desc: won(liq * 0.05), prob: 0.35, ai: 1, amt: liq * 0.05 }),
        O('no', '쳐다보지 않는다', { ai: 2.5 }),
        O('mute', '코인 이야기는 앞으로 듣지 않기로 한다', { desc: '다시는 이런 유혹이 찾아오지 않습니다', ai: 0.25 })] };
    },
    resolve: function (p, w, c, key, o) {
      p.fl.coinAsk = p.age;
      if (key === 'mute') { H.mute(p, 'coinFomo'); return R(null, '차단', '코인 단체방을 전부 나오고 알림을 껐습니다. 누가 얼마를 벌었다는 소식이 더는 들리지 않습니다.'); }
      if (key === 'no') return R(null, '관망', '남의 수익률 인증에 "좋아요"만 눌렀습니다.');
      var rl = roll(p, o.prob), amt = o.amt;
      if (rl.ok) { var g = amt * U.range(p.rng, [1.0, 2.2]); p.cash += g; p.fl.coinWin = (p.fl.coinWin || 0) + g; p.happy += 5; return R(true, '익절', '고점 근처에서 팔았습니다. ' + won(g) + ' 수익. 이번에는 운이 좋았습니다.', rl); }
      Sim.pay(p, amt * 0.6); p.fl.coinLoss = (p.fl.coinLoss || 0) + amt * 0.6; p.happy -= key === 'big' ? 9 : 2;
      return R(false, '물림', '"존버"를 외쳤지만 차트는 계단처럼 내려갔습니다. ' + won(amt * 0.6) + ' 손실.', rl);
    }
  };

  /* ================= 건강 ================= */
  DEC.habits = {
    build: function (p) {
      var opts = [O('ex', '운동 루틴을 만든다', { desc: '성공하면 건강이 천천히 닳습니다', prob: pr(p, 0.45, { dil: 0.8 }), stats: ['dil'], ai: 1.5 })];
      if (p.hab.vice) opts.push(O('quit', '술·담배를 끊는다', { prob: pr(p, 0.4, { dil: 0.7 }), stats: ['dil'], ai: 1.2 }));
      else opts.push(O('vice', '술·담배·야식으로 푼다', { desc: '행복 + · 건강이 빨리 닳습니다', ai: 0.8 }));
      opts.push(O('none', '그냥 살던 대로 산다', { ai: 1.6 }));
      return { title: '생활 습관', icon: '🏃', desc: p.age + '세. ' + (p.age < 30 ? '사회생활의 스트레스를 푸는 방식이 굳어지는 시기입니다.' : p.age < 50 ? '건강검진 결과지에 "주의" 항목이 늘었습니다.' : '몸이 예전 같지 않습니다. 지금 습관이 노년을 정합니다.'), opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'none') return R(null, '그대로', '특별히 달라진 것은 없습니다. 헬스장 광고는 넘깁니다.');
      if (key === 'vice') { p.hab.vice = 1; p.happy += 3; return R(null, '한 잔', '퇴근길 한 잔이 하루의 마침표가 됐습니다.'); }
      var rl = roll(p, o.prob);
      if (key === 'ex') { p.hab.ex = rl.ok ? 1 : 0; return rl.ok ? R(true, '습관 형성', '석 달을 넘겼습니다. 운동이 양치질 같은 일이 됐습니다.', rl) : R(false, '작심삼일', '헬스장 1년 회원권을 끊었습니다. 세 번 갔습니다.', rl); }
      if (rl.ok) { p.hab.vice = 0; return R(true, '금연·절주', '서랍 속 마지막 담배를 버렸습니다. 아침 공기가 달라졌습니다.', rl); }
      return R(false, '실패', '사흘 만에 다시 편의점 계산대 앞에 섰습니다.', rl);
    }
  };
  DEC.checkup = {
    build: function (p) {
      return { title: '건강검진', icon: '🩻', desc: '마흔. 국가검진 안내문이 왔습니다. 조기 발견이 치료 결과를 가릅니다.', opts: [
        O('2', '매년 정밀검진을 받는다', { desc: '연 ' + won(D.HEALTH.checkCost) + ' · 큰 병의 조기 발견 확률 ↑↑', ai: p.inc > 500 ? 2 : 0.6 }),
        O('1', '국가검진만 받는다', { desc: '무료 · 조기 발견 확률 ↑', ai: 2.5 }),
        O('0', '바빠서 미룬다', { ai: 0.8 })] };
    },
    resolve: function (p, w, c, key) { p.hab.chk = +key; return R(null, '건강검진', ['검진 안내문은 식탁 위에서 해를 넘겼습니다.', '2년에 한 번, 금식하고 보건소 지정 병원에 갑니다.', '매년 수면 내시경을 받습니다. 깨어나면 늘 같은 말을 듣습니다. "용종 하나 뗐어요."'][+key]); }
  };
  DEC.disease = {
    build: function (p, w, c) {
      var Tt = D.HEALTH.treat, opts = [], liq = Sim.liquid(p);
      ['full', 'std', 'min'].forEach(function (k) {
        var t = Tt[k], pb = clamp(t.base + (c.early ? (1 - t.base) * 0.55 : 0) + (p.health - 50) * 0.002, 0.05, 0.97);
        opts.push(O(k, t.name, { desc: '비용 ' + won(t.cost) + (liq < t.cost ? ' (빚)' : ''), prob: pb, stats: ['stamina'], ai: k === 'full' ? (liq > t.cost * 2 ? 3 : 0.4) : k === 'std' ? 3 : 0.4 }));
      });
      return { title: c.name + ' 진단', icon: '🏥', desc: c.name + ' 진단을 받았습니다. ' + (c.early ? '다행히 검진에서 일찍 발견됐습니다.' : '증상이 나타난 뒤에야 병원을 찾았습니다.') + ' 치료 방침을 정해야 합니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      Sim.pay(p, D.HEALTH.treat[key].cost); var rl = roll(p, o.prob); p.fl.sick = (p.fl.sick || 0) + 1;
      if (rl.ok) { p.health -= D.HEALTH.hitOk; p.happy -= 3; ms(p, U.josa(c.name, '을/를') + ' 이겨냈습니다.', false); return R(true, '회복', '치료가 잘 됐습니다. 퇴원하는 날, 병원 앞 국밥이 유난히 맛있었습니다.', rl); }
      p.health -= D.HEALTH.hitFail; p.happy -= 10; p.fl.chronic = 1; ms(p, c.name + ' 투병으로 건강이 크게 상했습니다.', false);
      if (p.job && !D.JOBS[p.job.k].pen && D.JOBS[p.job.k].type !== 'own' && U.chance(p.rng, 0.4)) { Sim.leaveJob(p, w, 'sick'); if (p.age < 60) Sim.q(p, 'career', {}); else p.occ = 'retired'; return R(false, '후유증', '치료는 길어졌고, 병가는 퇴사로 바뀌었습니다.', rl); }
      return R(false, '후유증', '고비는 넘겼지만 몸은 예전으로 돌아오지 않았습니다. 약봉지가 식탁 한쪽을 차지합니다.', rl);
    }
  };
  DEC.eldercare = {
    build: function (p) {
      var Hh = D.HEALTH, inc = Sim.myInc(p) + (p.spouse ? p.spouse.pension || 0 : 0), liq = Sim.liquid(p), fam = p.spouse || p.kids.length;
      var opts = [O('silver', '실버타운에 들어간다', { desc: '월 ' + won(Hh.silverTown) + ' · 식사와 의료가 한 건물에', dis: liq + Sim.houseVal(p) * 0.5 < Hh.silverTown * 60 && inc < Hh.silverTown ? '감당할 수 없습니다' : null, ai: 1.5 }),
        O('fac', '요양원에 들어간다', { desc: '월 ' + won(Hh.careCost) + '(본인 부담)', ai: 2 })];
      if (fam) opts.push(O('home', '집에서 가족의 돌봄을 받는다', { desc: '월 ' + won(50) + ' · 가족의 손이 필요합니다', ai: 2.5 }));
      else opts.push(O('alone', '혼자 집에서 버틴다', { desc: '방문 요양 월 ' + won(50) + ' · 외롭습니다', ai: 1 }));
      return { title: '돌봄이 필요한 몸', icon: '🦯', desc: '혼자 씻고 먹는 일이 힘들어졌습니다. 장기요양등급 판정을 받았습니다.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      var Hh = D.HEALTH; p.fl.careAsk = 1;
      if (key === 'silver') { p.fl.careCost = Hh.silverTown; p.fl.careType = 'silver'; p.happy += 3; ms(p, '실버타운에 입주했습니다.', false); return R(null, '실버타운', '호텔 같은 로비와 병원 같은 복도. 식당에서 새 친구를 사귑니다.'); }
      if (key === 'fac') { p.fl.careCost = Hh.careCost; p.fl.careType = 'fac'; p.happy -= 5; ms(p, '요양원에 입소했습니다.', false); return R(null, '요양원', '4인실 창가 침대를 배정받았습니다. 면회 날을 달력에 표시해 둡니다.'); }
      p.fl.careCost = 50; p.fl.careType = key; p.happy -= key === 'alone' ? 6 : 0;
      return R(null, '재가 돌봄', key === 'home' ? '요양보호사가 하루 세 시간 다녀갑니다. 나머지 시간은 가족의 몫입니다.' : '요양보호사가 다녀간 뒤의 집은 조용합니다. TV를 켜 둡니다.');
    }
  };
  DEC.retireLife = {
    build: function (p) {
      var liq = Sim.liquid(p), gk = p.kids.some(function (k) { return k.grand; });
      var opts = [O('vol', '봉사·동호회 활동', { desc: '행복 +, 건강 +', stats: ['social'], ai: 2 })];
      if (gk) opts.push(O('grand', '손주를 돌본다', { desc: '행복 ++, 체력 −. 자녀와 가까워집니다', ai: 2 }));
      opts.push(O('travel', '미뤄 둔 세계여행', { desc: won(4000), dis: liq < 8000 ? '여윳돈이 부족합니다' : null, ai: 1 }));
      opts.push(O('tv', '집에서 조용히 지낸다', { desc: '돈은 안 듭니다. 몸과 마음이 조금씩 가라앉습니다', ai: 1.5 }));
      return { title: '은퇴 후의 하루', icon: '🌿', desc: '하루 24시간이 온전히 내 것이 됐습니다. 생각보다 깁니다.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      p.fl.rl = key;
      if (key === 'vol') { p.happy += 5; p.hab.ex = 1; return R(null, '활동', '복지관 배식 봉사와 탁구 동호회. 일정표가 다시 채워졌습니다.'); }
      if (key === 'grand') { p.happy += 7; p.health -= 3; p.kids.forEach(function (k) { k.rel = (k.rel || 50) + 10; }); return R(null, '황혼 육아', '손주 하원 시간에 맞춰 하루가 돌아갑니다. 허리는 아프지만 웃을 일이 많습니다.'); }
      if (key === 'travel') { Sim.pay(p, 4000); p.happy += 9; return R(null, '여행', '사진으로만 보던 곳에 섰습니다. "다리 떨릴 때 말고 가슴 떨릴 때 가라"던 말이 맞았습니다.'); }
      p.happy -= 3; return R(null, '칩거', '리모컨이 손에서 떠나지 않습니다. 하루에 말을 한마디도 하지 않는 날이 있습니다.');
    }
  };
  DEC.will = {
    build: function (p) {
      var nw = Sim.netWorth(p), opts = [];
      if (p.kids.length) opts.push(O('kids', '자녀에게 물려준다', { desc: '아끼며 삽니다', ai: 3 }));
      opts.push(O('give', '일부를 사회에 기부한다', { desc: '순자산의 10%(' + won(Math.max(0, nw * 0.1)) + ') · 행복 +', dis: Sim.liquid(p) < nw * 0.1 || nw < 5000 ? '기부할 여윳돈이 없습니다' : null, ai: 0.6 }));
      opts.push(O('use', '다 쓰고 간다', { desc: '소비 ↑ · 행복 +', ai: p.kids.length ? 0.8 : 3 }));
      return { title: '남길 것과 쓸 것', icon: '📜', desc: '여든. 가진 것을 정리할 나이입니다. 순자산은 ' + won(nw) + '.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      p.fl.will = key;
      if (key === 'give') { var a = Math.max(0, Sim.netWorth(p) * 0.1); Sim.pay(p, a); p.fl.donated = a; p.happy += 7; ms(p, won(a) + '을 사회에 기부했습니다.', false); return R(null, '기부', '장학재단에서 감사패가 왔습니다. 거실 TV 옆에 세워 두었습니다.'); }
      if (key === 'use') { p.fl.yolo = 1; p.happy += 4; return R(null, '쓰고 가기', '"자식에게 물려줄 건 추억뿐"이라고 선언했습니다. 좋은 것을 먹고, 좋은 곳에 갑니다.'); }
      return R(null, '상속 준비', '유언장을 썼습니다. 형제끼리 다투지 말라는 말을 세 번 적었습니다.');
    }
  };
})();
