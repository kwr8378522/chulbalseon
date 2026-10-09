/* decisions1.js — 갈림길(1): 유년기·입시·대학·진로·직장·전문직·자영업
 * 각 갈림길은 build(선택지 목록 만들기)와 resolve(선택 결과 처리)로 구성됩니다.
 * 선택지의 ai 값은 동년배(NPC)와 자동 테스트가 그 선택지를 고르는 가중치입니다. */
(function () {
  'use strict';
  var clamp = U.clamp, won = U.won, sig = U.sig, say = Sim.say, ms = Sim.ms;
  var DEC = Sim.DEC = {};
  var H = Sim.H = {};

  /* ---------- 공용 도우미 ---------- */
  H.O = function (key, label, o) { var x = { key: key, label: label, desc: '', prob: null, stats: [], dis: null, ai: 1 }; if (o) for (var k in o) x[k] = o[k]; return x; };
  // 평균 능력치(50)일 때 base, 능력치 15점(1표준편차)마다 로짓이 mods[k]만큼 이동
  H.pr = function (p, base, mods, extra) {
    base = clamp(base, 0.0005, 0.9995); var l = Math.log(base / (1 - base));
    if (mods) for (var k in mods) l += mods[k] * (p.st[k] - 50) / 15;
    return clamp(sig(l + (extra || 0)), 0.02, 0.97);     // 어떤 판정도 100%나 0%는 아니다
  };
  H.roll = function (p, prob) {
    var luck = (p.st.luck - 50) / 50 * D.LUCK_SHIFT, x = clamp(U.rnd(p.rng) - luck, 0, 0.9999);
    return { ok: x < prob, roll: Math.floor(x * 100) + 1, prob: prob };
  };
  H.R = function (ok, title, text, rl, fx) { return { ok: ok, title: title, text: text, roll: rl ? rl.roll : null, prob: rl ? rl.prob : null, fx: fx || null }; };
  H.risk = function (p) { return (U.hash(p.id + 'risk') % 1000) / 1000; };
  // 부모의 월 지출 여력: 2 여유 / 1 무리하면 가능 / 0 불가
  H.famCan = function (p, monthly) { var f = p.fam; if (f.alive <= 0) return 0; var x = monthly / f.inc; return x <= 0.2 ? 2 : x <= 0.42 ? 1 : 0; };
  H.famSpend = function (p, total) { p.fam.assets = Math.max(0, p.fam.assets - total); };
  // 목돈: 부모가 감당 가능하면 부모가, 아니면 본인 빚
  H.lump = function (p, amt) {
    if (p.fam.alive > 0 && p.fam.assets >= amt * 3 && p.age < 33) { p.fam.assets -= amt; return 'fam'; }
    Sim.pay(p, amt); return 'self';
  };
  H.topPct = function (score) {   // 점수 → 대략적인 상위 %
    var z = (score - 50) / 11, t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    var pr = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    var top = z > 0 ? pr : 1 - pr; return top < 0.01 ? '상위 1% 이내' : '상위 ' + Math.round(top * 100) + '%';
  };
  // "앞으로 이런 제안은 받지 않는다"를 고른 사건은 다시 나오지 않는다
  H.mute = function (p, id) { (p.fl.mute = p.fl.mute || {})[id] = 1; };
  H.muted = function (p, id) { return !!(p.fl.mute && p.fl.mute[id]); };
  // 직장 내 관계(상사·동료·줄)가 승진 판정에 주는 로짓 보정. 동년배는 팀이 없어 0이다
  H.teamBonus = function (p) { var t = p.job && p.job.team; if (!t) return 0; return clamp((t.rel - 50) / 30 + ((t.net || 50) - 50) / 80 + (t.line === 1 ? 0.5 : t.line === -1 ? -0.4 : 0), -1.2, 1.4); };
  // 난이도는 플레이어에게만 적용된다(동년배는 늘 보통)
  H.diff = function (p) { return D.DIFF[p.isPlayer ? p.fl.diff || 0 : 0]; };
  H.dp = function (p, x) { var d = H.diff(p).prob; return x == null || !d ? x : d > 0 ? Math.min(0.97, x + (1 - x) * d) : Math.max(0.01, x * (1 + d)); };
  H.relWord = function (v) { return v >= 80 ? '아주 좋음' : v >= 62 ? '좋음' : v >= 42 ? '보통' : v >= 25 ? '서먹함' : '나쁨'; };
  var O = H.O, pr = H.pr, roll = H.roll, R = H.R, famCan = H.famCan, famSpend = H.famSpend, lump = H.lump;
  function strain(can) { return can === 1 ? ' · 부모님이 무리합니다' : ''; }
  function noMoney(can) { return can ? null : '가계 형편상 어렵습니다'; }

  /* ================= 유년기 ================= */
  DEC.kinder = {
    build: function (p) {
      var c = D.EDU.kinder, can = famCan(p, c.cost);
      return { title: '영어유치원', icon: '🧸', desc: '네 살. 부모님이 유치원 상담을 다녀왔습니다. 영어유치원 원비는 월 ' + won(c.cost) + '입니다.', opts: [
        O('eng', '영어유치원에 보낸다', { desc: '학업 기초 +' + strain(can), dis: noMoney(can), ai: can === 2 ? 0.2 + p.fam.zeal / 80 : 0.1 + p.fam.zeal / 400 }),
        O('norm', '동네 유치원·어린이집', { desc: '친구들과 흙을 만지며 큽니다', ai: 1.2 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'eng') {
        var k = D.EDU.kinder; if (famCan(p, k.cost) === 1) p.fam.harmony -= 3;
        p.ab += k.acad; famSpend(p, k.cost * 36); p.fl.engK = 1;
        return R(null, '영어유치원 입학', '원어민 선생님 앞에서 "아임 파인"을 외칩니다. 부모님의 통장은 파인하지 않습니다.');
      }
      return R(null, '동네 유치원', '놀이터에서 해가 질 때까지 놀았습니다. 그 시절엔 그게 전부였습니다.');
    }
  };
  DEC.earlyArts = {
    build: function (p) {
      var c = D.EDU.earlyArts, can = famCan(p, c.cost);
      return { title: '예체능 조기교육', icon: '🎹', desc: '여섯 살. 피아노, 미술, 태권도, 수영. 동네 상가 2층에는 없는 학원이 없습니다. (월 ' + won(c.cost) + ')', opts: [
        O('arts', '예체능 학원에 보낸다', { desc: '재능이 있다면 일찍 꽃핍니다' + strain(can), stats: ['talent'], dis: noMoney(can), ai: 0.4 + p.fam.zeal / 150 }),
        O('none', '아직은 놀게 둔다', { ai: 1 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'arts') {
        var g = D.EDU.earlyArts.skill * p.st.talent / 50; p.art += g; famSpend(p, D.EDU.earlyArts.cost * 72);
        return R(null, '예체능 학원', p.st.talent >= 68 ? '선생님이 부모님을 따로 불렀습니다. "아이가 소질이 있어요." 학원의 단골 멘트지만, 이번엔 사실이었습니다.' : '체르니 30번 앞에서 멈췄습니다. 그래도 악보는 읽을 줄 알게 됐습니다.');
      }
      return R(null, '놀이의 시간', '또래보다 조금 더 많이 뛰어놀았습니다.');
    }
  };
  function tutorDec(stage) {
    return {
      build: function (p) {
        var Tt = D.EDU.tutor, z = p.fam.zeal, opts = [];
        ['none', 'normal', 'high', 'max'].forEach(function (k) {
          var t = Tt[k], can = k === 'none' ? 2 : famCan(p, t.cost), ai;
          if (k === 'none') ai = p.fam.cls <= 2 ? 1.2 : 0.4; else if (k === 'normal') ai = 2;
          else if (k === 'high') ai = (z / 45) * (can === 2 ? 1 : 0.4); else ai = z > 62 ? (can === 2 ? 0.8 : 0.1) : 0.05;
          opts.push(O(k, t.name, { desc: (t.cost ? '월 ' + won(t.cost) : '비용 없음') + ' · 학업 ' + (t.acad > 0 ? '+' : t.acad < 0 ? '−' : '±0') + (t.happy < 0 ? ' · 행복 −' : '') + strain(can), dis: noMoney(can), ai: ai, stats: k === 'max' ? ['dil'] : [] }));
        });
        return { title: stage === 'elem' ? '초등학교 사교육' : '중학교 학원 강도', icon: '📚',
          desc: stage === 'elem' ? '초등학교에 입학했습니다. 학부모 단톡방에서 학원 정보가 돌기 시작합니다. 부모님의 교육열은 ' + p.fam.zeal + '/100.' : '중학생이 됐습니다. "중학교 때 선행을 끝내야 한다"는 말이 정설처럼 돕니다.', opts: opts };
      },
      resolve: function (p, w, c, key) {
        var t = D.EDU.tutor[key], mult = stage === 'elem' ? 0.6 : 1, gain = t.acad * mult;
        if (key === 'max' && p.st.dil < 40) gain *= 0.4;
        if (key !== 'none' && famCan(p, t.cost) === 1) p.fam.harmony -= 2;
        p.ab += gain; p.school.tutor = key; p.happy += t.happy; famSpend(p, t.cost * 12 * (stage === 'elem' ? 6 : 6));
        var txt = { none: '학원 대신 운동장과 도서관이 방과 후 교실이 되었습니다.', normal: '남들 다니는 만큼 다닙니다. 평범함에도 수강료가 듭니다.', high: '중학교 수학을 초등학교 때 배웁니다. 이해는 나중 문제입니다.', max: key === 'max' && p.st.dil < 40 ? '밤 10시에 학원 차에서 내립니다. 몸은 책상에, 마음은 다른 곳에 있었습니다.' : '밤 10시에 학원 차에서 내립니다. 또래보다 두 학년쯤 앞서갑니다.' }[key];
        if (stage === 'mid' && key === 'high') txt = '수학·영어·과학 학원을 요일별로 돕니다. 저녁은 편의점 삼각김밥입니다.';
        return R(null, t.name, txt);
      }
    };
  }
  DEC.tutorElem = tutorDec('elem'); DEC.tutorMid = tutorDec('mid');

  DEC.middle = {
    build: function (p) {
      var I = D.EDU.mid.intl, A = D.EDU.mid.arts, ci = famCan(p, I.cost), ca = famCan(p, A.cost);
      return { title: '중학교 진학', icon: '🏫', desc: '열세 살. 대부분은 집 앞 중학교에 배정받지만, 다른 길을 알아보는 집도 있습니다.', opts: [
        O('intl', '국제중 지원', { desc: '추첨 · 월 ' + won(I.cost) + strain(ci), prob: I.lottery, dis: noMoney(ci), ai: ci === 2 ? p.fam.zeal / 120 : 0.05 }),
        O('arts', '예술중·체육중 지원', { desc: '실기 시험 · 레슨비 월 ' + won(A.cost) + strain(ca), prob: sig((p.st.talent + p.art - 72) / 6), stats: ['talent'], dis: noMoney(ca), ai: p.st.talent + p.art > 78 ? 0.8 : 0.02 }),
        O('gen', '일반 중학교', { desc: '걸어서 10분 거리', ai: 3 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'gen') return R(null, '일반중 입학', '집 앞 중학교에 배정받았습니다. 초등학교 친구 절반이 같은 반입니다.');
      var rl = roll(p, o.prob);
      if (!rl.ok) return R(false, '불합격', '떨어졌습니다. 결국 집 앞 일반 중학교에 갑니다. 인생 첫 탈락 통보였습니다.', rl);
      if (key === 'intl') { p.school.mid = 'intl'; p.ab += D.EDU.mid.intl.acad; famSpend(p, D.EDU.mid.intl.cost * 36); return R(true, '국제중 합격', '추첨 공이 굴러 나와 이름이 불렸습니다. 운도 입시의 일부라는 걸 일찍 배웁니다.', rl); }
      p.school.mid = 'arts'; p.art += D.EDU.mid.arts.skill; famSpend(p, D.EDU.mid.arts.cost * 36);
      return R(true, '예술중 합격', '실기 시험을 통과했습니다. 연습실에서 보내는 시간이 교실보다 길어집니다.', rl);
    }
  };

  // 고입 준비 점수: 입시 전문학원(15세 선택) + 중학교 때 다닌 학원 + 국제중
  H.hsBonus = function (p) { var E = D.EDU; return E.hsPrep[p.fl.hsPrep || 0].bonus + (E.tutorBonus[p.school.tutor] || 0) + (p.school.mid === 'intl' ? 1.5 : 0); };
  DEC.high = {
    build: function (p) {
      var Hh = D.EDU.high, ac = Sim.acad(p), opts = [], z = p.fam.zeal, bn = H.hsBonus(p), M = D.EDU.meister;
      [['sci', 12], ['foreign', 5], ['private', 3]].forEach(function (x) {
        var k = x[0], h = Hh[k], can = famCan(p, h.cost), pb = clamp(sig((ac + bn - h.cut) / h.k), 0.01, 0.97);
        opts.push(O(k, h.name, { desc: '월 ' + won(h.cost) + ' · 학업 +' + strain(can), prob: pb, stats: ['iq', 'dil'], dis: noMoney(can), ai: pb > 0.25 ? x[1] * pb * (can === 2 ? 1 : 0.4) * (0.5 + z / 100) : 0.02 }));
      });
      var ca = famCan(p, Hh.arts.cost), ts = p.st.talent + p.art;
      opts.push(O('arts', Hh.arts.name, { desc: '실기 전형 · 레슨비 월 ' + won(Hh.arts.cost) + strain(ca), prob: sig((ts - Hh.arts.cut) / Hh.arts.k), stats: ['talent'], dis: noMoney(ca), ai: ts > 80 ? 2.5 : ts > 72 ? 0.3 : 0.01 }));
      opts.push(O('general', Hh.general.name, { desc: '가장 많은 학생이 가는 길', ai: 6 }));
      opts.push(O('meister', '마이스터고', { desc: '기술 명문 · 기능반, 전국기능경기대회, 대기업 생산직 특채의 길 · 떨어지면 특성화고', prob: clamp(sig((ac - M.cut) / M.k), 0.05, 0.95), stats: ['dil', 'iq'], ai: ac < 40 ? 1.1 : ac < 47 ? 0.8 : 0.06 }));
      opts.push(O('voc', Hh.voc.name, { desc: '기술을 배워 일찍 취업 · 학업 −', ai: ac < 40 ? 2.4 : ac < 47 ? 0.5 : 0.05 }));
      return { title: '고등학교 진학', icon: '🎒', desc: '열여섯. 중학교 성적은 ' + H.topPct(ac) + '. 고등학교 이름이 대학 이름을 반쯤 정한다는 말이 돕니다. 학원에서 쌓은 입시 준비는 특목고·자사고 합격 점수에 ' + (bn >= 0 ? '+' : '−') + Math.abs(bn) + '점으로 반영됩니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      var Hh = D.EDU.high, h = Hh[key];
      if (key === 'meister') {
        var rm = roll(p, o.prob); p.school.high = 'voc'; p.ab += Hh.voc.acad; p.fl.meister = rm.ok ? 1 : 0; ms(p, (rm.ok ? '마이스터고' : '특성화고') + '에 진학했습니다.', false);
        return rm.ok ? R(true, '마이스터고 합격', '면접관이 물었습니다. "왜 대학이 아니라 기술입니까?" 준비한 대답은 떨렸지만 진심이었습니다. 기숙사 생활이 시작됩니다.', rm)
          : R(false, '마이스터고 불합격', '마이스터고 면접에서 떨어졌습니다. 집 근처 특성화고에서 기술을 배우기로 합니다.', rm);
      }
      if (o.prob != null) {
        var rl = roll(p, o.prob);
        if (!rl.ok) { p.school.high = 'general'; return R(false, '불합격', h.name + ' 입시에서 떨어졌습니다. 일반고 교복을 맞추러 갑니다.', rl); }
        p.school.high = key; p.ab += h.acad; if (h.skill) p.art += h.skill; famSpend(p, h.cost * 36);
        ms(p, h.name + '에 합격했습니다.', false);
        return R(true, '합격', h.name + '에 합격했습니다. ' + (key === 'arts' ? '이제부터는 재능 있는 아이들끼리의 경쟁입니다.' : '중학교에서는 1등이었지만, 여기서는 모두가 1등이었습니다.'), rl);
      }
      p.school.high = key; p.ab += h.acad;
      if (key === 'voc') { p.fl.meister = 0; ms(p, '특성화고에 진학했습니다.', false); return R(null, '특성화고 입학', '실습복을 받았습니다. 또래들이 수능 특강을 들을 때 자격증 책을 폅니다.'); }
      return R(null, '일반고 입학', '집에서 버스로 세 정거장. 평범한 고등학교의 평범한 1학년이 됐습니다.');
    }
  };

  DEC.highLife = {
    build: function (p) {
      var arts = p.school.high === 'arts';
      return { title: '고등학교 2학년', icon: '✏️', desc: '열일곱. 공부와 친구, 잠과 꿈 사이에서 시간은 모자랍니다.', opts: [
        O('all', arts ? '실기에 올인한다' : '공부에 올인한다', { desc: '성공하면 성적 +, 실패하면 번아웃', prob: pr(p, 0.6, { dil: 0.8 }), stats: ['dil'], ai: 1 + p.fam.zeal / 100 }),
        O('bal', '적당히 균형을 잡는다', { ai: 2.5 }),
        O('play', '놀 때 놀아야지', { desc: '행복 +, 사교성 +, 성적 −', ai: p.st.dil < 40 ? 1.5 : 0.4 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'bal') return R(null, '균형', '시험 기간에는 공부하고, 끝나면 노래방에 갔습니다. 대부분이 그렇게 삽니다.');
      if (key === 'play') { p.ab += D.EDU.highLife.play; p.happy += 8; p.st.social = clamp(p.st.social + 3, 1, 99); return R(null, '청춘', '야자를 빼먹고 본 노을이 예뻤습니다. 성적표는 예쁘지 않았습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { if (p.school.high === 'arts') p.art += 6; else p.ab += D.EDU.highLife.all; p.happy -= 5; return R(true, '몰입', '하루 네 시간 자며 버텼습니다. 모의고사 등급이 한 칸 올랐습니다.', rl); }
      p.ab += 0.4; p.happy -= 9; return R(false, '번아웃', '의욕은 넘쳤지만 몸이 따라주지 않았습니다. 책상에 앉아 있는 시간만 길었습니다.', rl);
    }
  };

  /* ================= 대입 ================= */
  DEC.admStrategy = {
    build: function (p, w) {
      var a = Sim.acad(p), s = Sim.susi(p), voc = p.school.high === 'voc', first = p.nsu === 0 && p.age <= 19;
      var opts = [], FL = D.JOBS.factoryL;
      if (first && voc && p.fl.medal) opts.push(O('fac', '대기업 생산직 특별채용 (기능경기대회 입상자)', { desc: '초임 월 ' + won(FL.start) + ' · 정년 ' + FL.retire + '세 · 메달이 곧 이력서입니다', ai: 9 }));
      else if (first && voc) opts.push(O('facTry', '대기업 생산직 고졸 공채에 지원한다', { desc: '초임 월 ' + won(FL.start) + ' · 마이스터고·기능반·자격증이 있으면 유리 · 떨어지면 다른 일자리를 찾습니다', prob: H.hireProb(p, w, 'factoryL'), stats: ['iq', 'dil', 'social'], ai: p.fl.meister ? 4 : 1 }));
      if (first) opts.push(O('susi', '수시(내신·학생부) 집중', { desc: '내신 환산 ' + H.topPct(s) + ' · 변수가 적습니다', stats: ['dil', 'iq'], ai: voc ? 0.3 : s > a ? 3 : 1 }));
      opts.push(O('jeongsi', '정시(수능) 집중', { desc: '모의고사 ' + H.topPct(a) + ' · 당일 컨디션이 변수', stats: ['iq', 'dil'], ai: voc ? 0.1 : a >= s ? 3 : 1 }));
      opts.push(O('job', '대학 대신 취업', { desc: '4년 먼저 돈을 법니다. 대신 "고졸"이라는 꼬리표가 붙습니다', ai: voc ? 5 : a < 37 ? 5 : a < 44 ? 1.3 : 0.03 }));
      return { title: p.nsu ? (p.nsu + 1) + '번째 수능' : '대학 입시', icon: '📝', desc: p.nsu ? '다시 11월입니다. 이번에는 정시뿐입니다.' : '열아홉. 12년 공부의 결산일이 다가옵니다. 어느 전형에 힘을 실을까요?', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'fac' || key === 'facTry') {
        var rf = key === 'fac' ? null : roll(p, o.prob); p.deg = '고졸';
        if (rf && !rf.ok) { p.occ = 'idle'; Sim.qFront(p, 'career', {}); return R(false, '불합격', '필기와 인성 검사는 넘었지만 최종 면접에서 떨어졌습니다. 졸업식 다음 날부터 다른 공고를 봅니다.', rf); }
        Sim.setJob(p, w, 'factoryL'); ms(p, '고등학교를 졸업하고 대기업 생산직으로 입사했습니다.', false); p.happy += 8;
        return R(true, '입사', '교복을 벗자마자 작업복을 입었습니다. 첫 월급 명세서를 본 부모님이 한참 말이 없었습니다. 대학 간 친구들이 등록금을 낼 때 월급을 받습니다.', rf);
      }
      if (key === 'job') { p.deg = '고졸'; p.occ = 'idle'; Sim.qFront(p, 'career', {}); ms(p, '대학에 가지 않고 사회로 나왔습니다.', false); return R(null, '사회로', '졸업식 다음 날부터 구인 공고를 봅니다. 친구들은 새내기 배움터에 갔습니다.'); }
      p.adm = { mode: key, score: key === 'susi' ? Sim.susi(p) : Sim.acad(p) };
      Sim.qFront(p, 'admTarget', {});
      return R(null, key === 'susi' ? '수시 지원' : '정시 지원', key === 'susi' ? '자기소개서를 열두 번 고쳐 썼습니다.' : '수능 날 아침, 교문 앞에서 후배들이 북을 쳤습니다.');
    }
  };
  var TIER_VALUE = { med: 400, medpro: 150, sky: 100, top: 45, edu: 7, seoul: 20, natl: 9, local: 3.5, college: 1, arts: 1, abroad: 30 };
  H.admProb = function (p, tier) {
    var Uv = D.UNIV[tier];
    if (tier === 'arts') return clamp(sig((p.st.talent + p.art - Uv.cut) / 6), 0.02, 0.97);
    var sc = p.adm.score + ((tier === 'med' || tier === 'medpro') && p.fl.medPrep ? D.EDU.examPrep.med.medBonus : 0);     // 의대 입시반
    return clamp(sig((sc - Uv.cut) / (p.adm.mode === 'susi' ? D.EDU.kSusi : D.EDU.kJeongsi)), 0.02, 0.97);
  };
  DEC.admTarget = {
    build: function (p) {
      var opts = [], sc = p.adm.score;
      ['med', 'medpro', 'sky', 'top', 'edu', 'seoul', 'natl', 'local', 'college', 'arts', 'abroad'].forEach(function (t) {
        var Uv = D.UNIV[t], pb = H.admProb(p, t), dis = null, desc = Uv.years + '년 · 등록금 연 ' + won(Uv.tuition), ai;
        if (t === 'abroad' && p.fam.assets < Uv.needAssets) dis = '유학 비용을 감당할 수 없습니다 (부모 자산 ' + won(Uv.needAssets) + ' 이상 필요)';
        if (t === 'arts') { desc += ' · 입시 레슨비 ' + won(Uv.lesson) + (p.fam.assets < Uv.lesson * 3 ? '(빚)' : ''); }
        if (t !== 'abroad' && t !== 'arts' && pb < 0.005) return;
        ai = TIER_VALUE[t] * Math.pow(pb > 0.28 ? pb : pb * 0.12, 1.3);
        if (t === 'arts') ai = (p.st.talent + p.art > 86 ? 4 : 0.01) * pb;
        if (t === 'abroad') ai = dis ? 0 : 8 * pb;
        if (t === 'med' && p.fam.zeal > 60) ai *= 1.5;
        if ((t === 'med' || t === 'medpro') && p.fl.medPrep) { ai *= 2; desc += ' · 의대 입시반 효과 반영'; }
        opts.push(O(t, Uv.name, { desc: desc, prob: pb, stats: t === 'arts' ? ['talent'] : (p.adm.mode === 'susi' ? ['dil', 'iq'] : ['iq', 'dil']), dis: dis, ai: ai }));
      });
      return { title: '지원 대학', icon: '🎓', desc: (p.adm.mode === 'susi' ? '수시' : '정시') + ' 성적은 ' + H.topPct(sc) + '. 한 곳을 정해 원서를 씁니다. 떨어지면 점수에 맞춘 진학, 재수, 취업 중에서 다시 골라야 합니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      var rl = roll(p, o.prob), Uv = D.UNIV[key];
      if (key === 'arts') lump(p, Uv.lesson);
      if (rl.ok) { Sim.enroll(p, w, key); return R(true, '합격', p.univ.name + ' 합격. 합격자 조회 화면을 열 번쯤 새로고침했습니다.', rl); }
      Sim.qFront(p, 'admFail', { tier: key });
      return R(false, '불합격', Uv.name + ' 불합격. "귀하의 우수한 역량에도 불구하고"로 시작하는 문장을 끝까지 읽지 못했습니다.', rl);
    }
  };
  DEC.admFail = {
    build: function (p, w, c) {
      var safe = 'college', list = ['medpro', 'sky', 'top', 'seoul', 'natl', 'local'], from = list.indexOf(c.tier) + 1;
      if (c.tier === 'edu') from = 4; if (c.tier === 'arts' || c.tier === 'abroad') from = 2;
      for (var i = from; i < list.length; i++) if (H.admProb(p, list[i]) >= 0.55) { safe = list[i]; break; }
      var can = famCan(p, D.EDU.resuCost / 12), near = H.admProb(p, c.tier);
      var aiR = (near > 0.12 ? 2.2 : 0.5) * (p.nsu === 0 ? 1 : p.nsu === 1 ? 0.5 : 0.15) * (can ? 1 : 0.4) * (0.5 + p.fam.zeal / 100);
      if (c.tier === 'med' || c.tier === 'medpro') aiR *= 2;
      return { title: '불합격 이후', icon: '🍂', desc: '합격 발표가 끝났습니다. 선택지는 셋입니다.', opts: [
        O('safe', '점수에 맞춰 진학: ' + D.UNIV[safe].name, { desc: '아쉬움은 남지만 1년을 아낍니다', ai: 2, tier: safe }),
        O('resu', can ? (p.nsu ? (p.nsu + 2) + '수 (재수학원)' : '재수 (재수학원)') : '독학 재수 (알바 병행)', { desc: can ? '1년 + 학원비 ' + won(D.EDU.resuCost) + strain(can) : '학원비가 없어 혼자 합니다. 1년 + 효과는 불확실', stats: ['dil'], ai: aiR, can: can }),
        O('job', '대학을 포기하고 취업', { ai: Sim.acad(p) < 42 ? 0.8 : 0.08 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'safe') { Sim.enroll(p, w, o.tier); return R(null, '진학', p.univ.name + '에 등록했습니다. 입학식 날, 여기가 목표였던 것처럼 웃었습니다.'); }
      if (key === 'job') { p.deg = '고졸'; p.occ = 'idle'; Sim.qFront(p, 'career', {}); return R(null, '사회로', '수험표를 서랍에 넣고 구직 사이트를 열었습니다.'); }
      p.nsu++; p.occ = 'resu';
      var g = o.can ? D.EDU.resuGain : D.EDU.resuSelfGain, gain = (g[0] + U.norm(p.rng) * g[1]) * (0.6 + p.st.dil / 125) * (p.nsu > 1 ? 0.6 : 1);
      p.ab += Math.max(-1.5, gain); p.happy -= 6;
      if (o.can) { famSpend(p, D.EDU.resuCost); if (o.can === 1) p.fam.harmony -= 3; }
      if ((c.tier === 'med' || c.tier === 'medpro') && !p.fl.medPrep && famCan(p, D.EDU.examPrep.med.cost) === 2) { p.fl.medPrep = 1; famSpend(p, D.EDU.examPrep.med.cost * 10); return R(null, '의대 전문 재수반', '부모님이 의대 전문 재수학원 기숙반에 등록해 주셨습니다. 한 반 서른 명이 전부 같은 곳을 봅니다. 다음 입시부터 의·치·한·약·수 합격 점수에 보정이 붙습니다.'); }
      return R(null, p.nsu > 1 ? p.nsu + '수 시작' : '재수 시작', o.can ? '재수학원 종합반에 등록했습니다. 학원비 고지서는 부모님이 말없이 가져가셨습니다.' : '낮에는 편의점, 밤에는 독서실. 문제집은 중고로 샀습니다.');
    }
  };
  DEC.major = {
    build: function (p) {
      var list = p.univ.tier === 'abroad' ? ['eng', 'biz', 'hum', 'sci'] : ['eng', 'biz', 'hum', 'sci', 'edu'];
      var W = { eng: 3.4, biz: 2.2, hum: 2.2, sci: 1.3, edu: 0.45 }, de = { eng: '취업 강세', biz: '무난한 선택, 전문직 시험의 발판', hum: '취업은 좁은 문, 로스쿨·공무원의 흔한 출발점', sci: '대학원 진학이 흔합니다', edu: '교원 임용시험 응시 자격' };
      return { title: '전공 선택', icon: '📖', desc: p.univ.name + '에 합격했습니다. 원서에 적을 전공을 고릅니다.', opts: list.map(function (k) { return O(k, D.MAJOR[k].name + ' 계열', { desc: de[k], ai: W[k] }); }) };
    },
    resolve: function (p, w, c, key) { p.univ.major = key; return R(null, D.MAJOR[key].name + ' 계열', '전공 서적의 무게로 대학 생활이 시작됐습니다.'); }
  };

  /* ================= 대학 생활 ================= */
  DEC.milTiming = {
    build: function (p) {
      return { title: '군 입대 시기', icon: '🪖', desc: '스무 살 남성에게는 병역의 의무가 있습니다. 복무 18개월, 복학까지 합치면 약 2년의 공백입니다.', opts: [
        O('now', '지금 입대한다', { desc: '일찍 다녀와서 복학', ai: 3 }),
        O('after', '졸업하고 간다', { desc: '공부 흐름은 이어지지만, 취업이 늦어집니다', ai: 0.6 }),
        O('rotc', '학군단(ROTC) 지원', { desc: '졸업 후 장교로 복무 · 월급과 경력이 남고, 장기복무를 택하면 직업군인의 길이 열립니다', prob: pr(p, 0.5, { stamina: 0.5, dil: 0.4, social: 0.2 }), stats: ['stamina', 'dil'], ai: 0.4 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'now') { Sim.startMil(p, 'univ'); return R(null, '입대', '논산행 버스에 올랐습니다. 머리를 밀고 나니 다들 비슷해 보였습니다.'); }
      if (key === 'rotc') { var rl = roll(p, o.prob); if (rl.ok) { p.fl.rotc = 1; return R(true, '학군단 합격', '제복을 받았습니다. 방학마다 훈련이 기다립니다.', rl); } p.fl.milAfter = 1; return R(false, '학군단 탈락', '체력 검정에서 떨어졌습니다. 졸업 후 일반병으로 입대하기로 합니다.', rl); }
      p.fl.milAfter = 1; return R(null, '입대 연기', '입영 통지서를 미뤘습니다. 동기들의 입대 송별회에 여러 번 참석했습니다.');
    }
  };
  DEC.univLife = {
    build: function (p) {
      var rich = p.fam.assets >= 9000 && p.fam.alive > 0;
      return { title: '대학 생활', icon: '☕', desc: '대학 생활이 반환점을 돕니다. 남은 시간을 어디에 쓸까요?', opts: [
        O('abroad', '휴학하고 어학연수', { desc: '1년 + ' + won(3000) + (rich ? '' : '(학자금·생활비 대출)') + ' · 스펙 ++', ai: rich ? 1.5 : 0.25 }),
        O('intern', '인턴·대외활동에 도전', { desc: '합격하면 스펙 ++', prob: pr(p, 0.5, { social: 0.5, dil: 0.4 }, p.univ.tier === 'sky' ? 0.6 : p.univ.tier === 'top' ? 0.3 : 0), stats: ['social', 'dil'], ai: 2 }),
        O('gpa', '학점에 집중', { desc: '스펙 + · 행복 −', stats: ['dil'], ai: 1.5 }),
        O('work', '알바로 생활비를 번다', { desc: '빚을 줄입니다. 스펙은 그대로', ai: p.fam.cls <= 2 ? 3 : 0.4 }),
        O('fun', '캠퍼스의 낭만을 즐긴다', { desc: '행복 ++, 사교성 +', ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'abroad') { lump(p, 3000); p.spec += 2; p.univ.left++; p.fl.lang = 1; return R(null, '어학연수', '1년을 해외에서 보냈습니다. 영어 점수와 함께 한국 음식의 소중함을 얻었습니다.'); }
      if (key === 'intern') { var rl = roll(p, o.prob); if (rl.ok) { p.spec += 2; return R(true, '인턴 합격', '인턴 사원증을 목에 걸었습니다. 복사기 사용법부터 배웁니다.', rl); } p.spec += 0.4; return R(false, '서류 탈락', '서른 곳에 지원해 서른 번 떨어졌습니다. 자기소개서 실력만 늘었습니다.', rl); }
      if (key === 'gpa') { p.spec += 0.6 + p.st.dil / 60; p.happy -= 3; return R(null, '학점 관리', '도서관 4층 창가 자리가 지정석이 됐습니다.'); }
      if (key === 'work') { p.debt = Math.max(0, p.debt - 700); if (p.debt === 0) p.cash += 300; return R(null, '아르바이트', '카페, 과외, 물류센터. 시급으로 등록금의 무게를 가늠하게 됐습니다.'); }
      p.happy += 7; p.st.social = clamp(p.st.social + 3, 1, 99); return R(null, '낭만', '축제와 MT, 새벽의 편의점. 훗날 가장 자주 꺼내 보게 될 기억입니다.');
    }
  };

  /* ================= 진로 ================= */
  var EXAM_JOB = { civil9: 'civil9', civil7: 'civil7', gosi5: 'civil5', teacher: 'teacher', cpa: 'cpa', tax: 'tax' };
  var HIRE_AI = { large: 12, public: 9, mid: 4, small: 2.2, startup: 0.35, foreign: 6, factoryL: 8 };
  H.hireProb = function (p, w, k) {
    var t = Sim.tierKey(p), a = p.age, M = w.macro[a], base = D.HIRE[k][t];
    if (base == null) base = D.HIRE[k].hs;
    var maj = p.univ && p.univ.done ? D.MAJOR[p.univ.major || 'hum'].hire : 1;
    if (k === 'small' || k === 'factoryL') maj = 1; else if (k === 'mid' || k === 'startup') maj = Math.sqrt(maj);
    if (k === 'factoryL') { if (p.fl.meister) base *= 2.2; if (p.fl.skill) base *= 1.6; if (p.fl.cert) base *= 1.3; if (p.fl.medal) base = Math.max(base, 0.8); }
    if (k === 'public' && p.fl.meister) base *= 3;
    base = clamp(base * maj * M.hire, 0.001, 0.97);
    var extra = p.spec * D.HIRE_SPEC - Math.max(0, a - D.HIRE_AGE.from) * D.HIRE_AGE.pen;
    if (p.deg === '석사' || p.deg === '박사') extra += 0.3;
    if (p.fl.worked && (k === 'small' || k === 'mid')) extra += Math.min(Math.max(0, a - D.HIRE_AGE.from), 22) * (k === 'small' ? 0.15 : 0.1);
    if (p.fl.lang && k === 'foreign') extra += 0.5;
    return pr(p, base, D.HIRE_STATS, extra);
  };
  H.examProb = function (p, k) {
    var E = D.EXAM[k], t = Sim.tierKey(p), base = E.base, extra = 0;
    if (k === 'teacher' && t === 'edu') base = E.baseEdu;
    if (E.tier) extra += E.tier[t] || 0;
    var n = p.prep && p.prep.what === k ? p.prep.n : 0;
    extra += Math.min(n, 3) * 0.25;                 // 수험 기간이 쌓이면 조금씩 유리
    if (p.job) extra -= 0.6;                        // 직장 병행
    if (p.age > 35) extra -= (p.age - 35) * 0.06;
    return pr(p, base, E.stats, extra);
  };
  function careerList(p, w, c) {
    var a = p.age, g = Sim.isGrad(p), t = Sim.tierKey(p), opts = [], liq = Sim.liquid(p), young = a < 45, hsOnly = t === 'hs' || t === 'voc';
    var prev = p.prep ? p.prep.what : null, pn = p.prep ? p.prep.n : 0, tal = p.st.talent + p.art;
    function add(o) { opts.push(o); }
    if (c.keep && p.job) add(O('stay', '지금 일을 계속한다', { desc: Sim.jobTitle(p) + ' · 월 ' + won(p.inc), ai: 3, kind: 'stay', grp: '현재' }));
    if (p.fl.lic) add(O('proBack', '전문직으로 복귀한다', { desc: '면허는 사라지지 않습니다', ai: 30, kind: 'proBack', grp: '취업' }));
    if (p.fam.alive > 0 && a < 50 && (p.fam.cls >= 5 || (p.fam.cls === 4 && U.hash(p.id + 'heir') % 2 === 0)) && !p.fl.heirSold && !(p.job && p.job.k === 'heir')) {
      var hy = p.fl.heirY || 0, hInc = Sim.jobInc(p, w, { k: 'heir', y: hy, mult: p.fl.heirM || (p.fam.cls >= 6 ? D.HEIR.chaebolMult : 1) });
      add(O('heir', hy ? '가업으로 돌아간다' : '가업에 합류한다', { desc: Sim.heirCo(p) + ' ' + U.after(D.HEIR.ranks, hy) + ' · 월 ' + won(hInc) + (hy ? ' · 떠나기 전 경력 ' + hy + '년과 연봉을 그대로 인정받습니다' : ' · 낙하산이라는 시선이 따라옵니다') + (p.fl.fDead ? ' · 아버지의 자리가 비어 있습니다' : ''), ai: 1.2, kind: 'heir', grp: '취업' }));
    }
    // --- 취업 ---
    ['large', 'public', 'mid', 'small', 'startup', 'foreign', 'factoryL'].forEach(function (k) {
      var pb = H.hireProb(p, w, k); if (pb < 0.004 && k !== 'large') return; if (a >= 60 && k !== 'small') return;
      var J = D.JOBS[k], inc0 = J.ranks ? J.ranks[0][1] : J.start, ai = HIRE_AI[k] * pb, note = k === 'factoryL' ? ' · 마이스터고·전문대 출신과 자격증 보유자가 유리합니다' : '';
      if (k === 'mid' && H.hireProb(p, w, 'large') > 0.3) ai *= 0.4;
      if (k === 'small' && H.hireProb(p, w, 'mid') > 0.5) ai *= 0.5;
      if (k === 'factoryL' && g) ai *= 0.15;
      if (k === 'foreign') ai *= 0.25;
      if (prev === 'job' && pn >= 2 && (k === 'small' || k === 'mid')) ai *= 2.5;
      add(O(k, J.name + (k === 'large' || k === 'public' ? ' 공채 지원' : k === 'foreign' ? ' 취업 도전' : ' 지원'), { desc: '초임 월 ' + won(inc0) + (J.retire ? ' · 정년 ' + J.retire + '세' : '') + note, prob: pb, stats: ['iq', 'dil', 'social'], ai: ai, kind: 'hire', grp: '취업' }));
    });
    if (a < 29) {     // 직업군인
      var OF = D.JOBS.officer, NC = D.JOBS.nco;
      if (g) add(O('officer', '학사장교 지원', { desc: '중위 임관 · 월 ' + won(OF.ranks[0][1]) + ' · 계급정년이 있고, 끝까지 가면 별을 답니다 · 군인연금', prob: pr(p, 0.4, { stamina: 0.5, dil: 0.4, social: 0.2 }), stats: ['stamina', 'dil', 'social'], ai: 0.05, kind: 'soldier', grp: '취업' }));
      add(O('nco', '부사관 지원', { desc: '하사 임관 · 월 ' + won(NC.start) + ' · 정년 ' + NC.retire + '세 · 군인연금', prob: pr(p, 0.55, { stamina: 0.6, dil: 0.3 }), stats: ['stamina', 'dil'], ai: hsOnly ? 0.25 : 0.03, kind: 'soldier', grp: '취업' }));
    }
    if (a < 60) {
      add(O('factoryS', '중소기업 생산직', { desc: '초임 월 ' + won(D.JOBS.factoryS.start) + ' · 몸이 고됩니다', ai: hsOnly ? 1.6 : t === 'college' ? 0.3 : 0.05, kind: 'direct', grp: '취업' }));
      add(O('trade', '기술을 배운다(전기·용접·설비)', { desc: '초임 월 ' + won(D.JOBS.trade.start) + ' · 숙련되면 독립 가능', stats: ['stamina'], ai: hsOnly ? 0.75 : t === 'college' ? 0.25 : 0.04, kind: 'direct', grp: '취업' }));
    }
    add(O('service', '비정규 서비스직', { desc: '월 ' + won(D.JOBS.service.start) + ' · 계약은 1년 단위', ai: (hsOnly ? 1.4 : 0.15) * (a >= 50 ? 3 : 1), kind: 'direct', grp: '취업' }));
    // --- 시험 ---
    if (a < 50) {
      [['civil9', 1], ['civil7', g ? 1 : 0], ['gosi5', g && a < 36 ? 1 : 0], ['teacher', (p.univ && p.univ.done && (p.univ.major === 'edu' || t === 'edu')) ? 1 : 0], ['cpa', g && a < 40 ? 1 : 0], ['tax', a < 45 ? 1 : 0]].forEach(function (x) {
        if (!x[1]) return; var k = x[0], E = D.EXAM[k], pb = H.examProb(p, k), ai;
        if (k === 'civil9') ai = (t === 'natl' || t === 'local' || t === 'seoul' || t === 'college' ? 0.9 : 0.35) * (p.st.dil / 50) * (a > 34 ? 0.3 : 1);
        else if (k === 'civil7') ai = g ? 0.22 : 0; else if (k === 'gosi5') ai = (t === 'sky' || t === 'top') ? 0.3 : 0.02;
        else if (k === 'teacher') ai = 3; else if (k === 'cpa') ai = (p.univ.major === 'biz' ? 0.5 : 0.05) * (pb > 0.05 ? 1.5 : 0.4); else ai = 0.07;
        if (prev === k) ai = pn < 4 ? Math.max(ai * 5, 2.5) : ai * 0.5;
        if (c.keep) ai *= 0.15;
        add(O(k, E.name + (prev === k ? ' 재도전 (' + (pn + 1) + '년 차)' : ' 준비'), { desc: '1년 수험 · 비용 ' + won(E.cost) + ' · 합격 시 ' + D.JOBS[EXAM_JOB[k]].name, prob: pb, stats: Object.keys(E.stats), ai: ai, kind: 'exam', grp: '시험' }));
      });
    }
    // --- 진학 ---
    if (g && a < 38) {
      var LA = D.EXAM.lawAdm, lp = pr(p, LA.tier[t] || 0.008, LA.stats, p.spec * 0.06 + (prev === 'lawAdm' ? 0.3 : 0));
      add(O('lawAdm', '로스쿨 진학', { desc: D.EXAM.lawYears + '년 · 연 ' + won(D.EXAM.lawCost) + ' · 이후 변호사시험', prob: lp, stats: ['iq', 'dil'], ai: lp > 0.08 ? lp * 3 * (p.univ.major === 'hum' || p.univ.major === 'biz' ? 1.5 : 0.6) : 0.02, kind: 'lawAdm', grp: '진학' }));
    }
    if (p.deg === '대졸' && a < 36) {
      var gp = pr(p, D.EXAM.grad.base, D.EXAM.grad.stats);
      add(O('grad', '대학원 진학(석사)', { desc: '2년 · 연 ' + won(D.EXAM.grad.cost), prob: gp, stats: ['iq'], ai: (p.univ.major === 'eng' || p.univ.major === 'sci' ? 0.8 : 0.2) * (t === 'sky' || t === 'top' ? 1.5 : 1), kind: 'grad', grp: '진학' }));
      var AS = D.EXAM.abroadStudy, rich = p.fam.alive > 0 && p.fam.assets >= AS.needAssets;
      add(O('abroadStudy', '해외 유학(석사)', { desc: AS.years + '년 · 총 ' + won(AS.cost) + (rich ? ' · 부모님 지원' : ' · 대출'), prob: pr(p, 0.5, { iq: 0.6, dil: 0.3 }, p.spec * 0.1 + (p.fl.lang ? 0.4 : 0)), stats: ['iq'], dis: rich || liq >= AS.cost ? null : (Sim.loanCap(p, w, true) >= AS.cost ? null : '학비를 마련할 길이 없습니다 (부모 자산 ' + won(AS.needAssets) + ' 이상 또는 대출 여력 필요)'), ai: rich ? 0.35 : 0.01, kind: 'abroadStudy', grp: '진학' }));
    }
    if (p.deg === '석사' && a < 40) add(O('phd', '박사과정 진학', { desc: '4년 · 연 ' + won(D.EXAM.phd.cost) + ' · 조교 장학금으로 연명', prob: pr(p, D.EXAM.phd.base, D.EXAM.phd.stats), stats: ['iq', 'dil'], ai: 0.5, kind: 'phd', grp: '진학' }));
    if (p.deg === '박사' && a < 50) {
      add(O('prof', '교수 임용 도전', { desc: '월 ' + won(D.JOBS.prof.start) + ' · 정년 65세 · 좁은 문', prob: pr(p, D.EXAM.prof.base, D.EXAM.prof.stats, (D.EXAM.prof.tier[t] || 0) + (p.fl.abroad ? 0.6 : 0)), stats: ['iq', 'social'], ai: 2, kind: 'prof', grp: '취업' }));
      add(O('research', '연구원 지원', { desc: '월 ' + won(D.JOBS.research.start), prob: pr(p, D.EXAM.research.base, D.EXAM.research.stats), stats: ['iq'], ai: 3.5, kind: 'hire2', grp: '취업' }));
      add(O('lecturer', '시간강사', { desc: '월 ' + won(D.JOBS.lecturer.avg) + ' 안팎 · 학기 단위 계약', ai: 0.8, kind: 'direct', grp: '취업' }));
    }
    if (!g && p.deg !== '전문대졸' && a < 26 && !c.keep) add(O('reExam', '수능을 다시 본다', { desc: '1년 뒤 정시 지원', ai: 0.12, kind: 'reExam', grp: '진학' }));
    // --- 내 일 ---
    if (a >= 22) {
      var F = D.FOUNDER;
      add(O('founder', '스타트업 창업', { desc: '자본금 ' + won(F.capital) + ' · 대부분 실패, 극소수 대박', stats: ['iq', 'social'], dis: liq + Sim.loanCap(p, w, true) < F.capital && !(p.fam.assets > F.capital * 5 && p.fam.alive > 0) ? '자본금이 없습니다' : null, ai: young ? 0.1 + H.risk(p) * 0.12 : 0.03, kind: 'founder', grp: '내 일' }));
      add(O('biz', '자영업 창업', { desc: '가게를 차립니다(업종 선택)', dis: liq < 1200 ? '창업 자금이 부족합니다' : null, ai: (a < 35 ? 0.15 : a < 45 ? 0.6 : 1.2) * (liq > 6000 ? 1 : 0.3), kind: 'biz', grp: '내 일' }));
    }
    add(O('freelance', '프리랜서', { desc: '월 ' + won(D.JOBS.freelance.avg) + ' 안팎 · 들쭉날쭉', stats: ['iq', 'talent'], ai: 0.12, kind: 'direct', grp: '내 일' }));
    if (a < 32 && (p.st.looks >= 62 || tal > 85)) add(O('celeb', prev === 'celeb' ? '연예인 오디션 재도전 (' + (pn + 1) + '년 차)' : '연예인 오디션', { desc: '외모와 끼, 그리고 운. 붙어도 대부분은 무명으로 끝나지만, 톱스타의 벌이는 상상을 넘습니다' + (p.fl.trainee ? ' · 연습생 경력 반영' : ''), prob: H.celebProb(p), stats: ['looks', 'talent', 'social'], ai: (p.st.looks >= 84 ? 1.2 : p.st.looks >= 74 ? 0.15 : 0.02) * (prev === 'celeb' && pn >= 2 ? 0.2 : 1) * (c.keep ? 0.2 : 1), kind: 'celeb', grp: '내 일' }));
    if (a < 45) add(O('artist', '예술·체육의 길', { desc: '재능과 운의 세계. 대부분은 생계가 빠듯합니다', stats: ['talent'], ai: t === 'arts' ? 5 : tal > 85 ? 2 : 0.02, kind: 'direct', grp: '내 일' }));
    // --- 중장년 ---
    if (a >= 40 && a < 67) add(O('delivery', '배달·대리운전', { desc: '월 ' + won(D.JOBS.delivery.avg) + ' 안팎 · 몸이 축납니다', stats: ['stamina'], ai: a >= 60 ? 0.15 : 0.3, kind: 'direct', grp: '취업' }));
    if (a >= 55 && a < 76) add(O('guard', '경비·시설관리', { desc: '월 ' + won(D.JOBS.guard.avg), ai: 1, kind: 'direct', grp: '취업' }));
    if (a >= 65 && a < 85) add(O('senior', '노인 일자리', { desc: '월 ' + won(D.JOBS.senior.avg) + ' · 하루 3시간', ai: 1.2, kind: 'direct', grp: '취업' }));
    if (a >= 50 && a < 72 && p.fl.highPost) add(O('advisor', '자문·고문으로 일한다', { desc: '월 ' + won(D.JOBS.advisor.avg) + ' 안팎 · 경력이 명함이 됩니다', ai: 6, kind: 'direct', grp: '취업' }));
    // --- 쉼 ---
    if (!c.keep) {
      if (a >= 55) { var nw = Sim.netWorth(p); add(O('retire', '일을 완전히 내려놓는다', { desc: '은퇴합니다. 연금과 모아둔 돈으로 삽니다', ai: a >= 70 ? 18 : a >= 65 ? 11 : a >= 60 ? (nw > 50000 ? 4 : 1.6) : nw > 80000 ? 2 : nw > 30000 ? 0.5 : 0.1, kind: 'retire', grp: '쉼' })); }
      else add(O('rest', '한 해 쉰다', { desc: '아무것도 하지 않습니다', ai: 0.12 + (pn >= 3 ? 0.4 : 0), kind: 'rest', grp: '쉼' }));
    }
    return opts;
  }
  H.celebProb = function (p) { return pr(p, D.CELEB.base, { looks: 1.1, talent: 0.4, social: 0.3 }, (p.fl.trainee ? 1.2 : 0) - Math.max(0, p.age - 24) * 0.25); };
  DEC.career = {
    build: function (p, w, c) {
      var a = p.age, t, d;
      if (c.keep) { t = '더 나은 일자리'; d = Sim.jobTitle(p) + '(으)로 일하고 있습니다. 다른 길을 알아볼까요? 떨어져도 지금 일은 계속합니다.'; }
      else if (a >= 55) { t = '인생 2막'; d = '퇴직 이후의 시간이 길게 남아 있습니다. 무엇을 할까요?'; }
      else if (p.last && a >= 30) { t = '다음 일자리'; d = '전 직장: ' + p.last.t + '. 통장 잔고가 줄어드는 속도를 계산하게 됩니다.'; }
      else if (p.prep) { t = '올해의 도전'; d = p.prep.name + ' 준비 ' + p.prep.n + '년 차. 계속할까요, 방향을 바꿀까요?'; }
      else { t = '진로 선택'; d = '사회로 나갈 시간입니다. 최종 학력은 ' + (p.deg === 'none' ? '고졸' : p.deg) + '. 한 해에 하나를 고를 수 있습니다.'; }
      return { title: t, icon: '🧭', desc: d, opts: careerList(p, w, c), grouped: true };
    },
    resolve: function (p, w, c, key, o) {
      var emp = !!p.job, rl, E, J = D.JOBS[key], who;
      function toPrep(what, name) { if (emp) return; p.occ = 'prep'; p.prep = { what: what, name: name, n: (p.prep && p.prep.what === what ? p.prep.n : 0) + 1 }; }
      switch (o.kind) {
        case 'stay': return R(null, '현상 유지', '익숙한 자리로 출근합니다. 변하지 않는 것도 선택입니다.');
        case 'proBack': Sim.proBack(p, w); return R(null, '복귀', '다시 가운과 명패 앞에 섰습니다.');
        case 'hire':
          rl = roll(p, o.prob);
          if (rl.ok) { Sim.setJob(p, w, key); ms(p, J.name + '에 입사했습니다.', false); p.happy += 6; return R(true, '합격', J.name + '에 합격했습니다. 사원증 사진은 마음에 들지 않지만, 목에 거는 순간만큼은 좋았습니다.', rl); }
          p.happy -= 3;
          if (!emp) { toPrep('job', '취업'); if (p.spec < 6) p.spec += 0.3; if (key !== 'small' && p.age < 55) Sim.qFront(p, 'careerFail', { from: key }); }
          return R(false, '불합격', J.name + ' 전형에서 떨어졌습니다. "지원자가 많아 부득이하게"라는 문장을 받았습니다.', rl);
        case 'hire2':
          rl = roll(p, o.prob);
          if (rl.ok) { Sim.setJob(p, w, key); ms(p, J.name + '이 되었습니다.', false); return R(true, '합격', '연구소 출입증을 받았습니다. 이제 논문이 월급이 됩니다.', rl); }
          toPrep('job', '취업'); return R(false, '불합격', '최종 면접에서 떨어졌습니다. 박사는 많고 자리는 적습니다.', rl);
        case 'heir':
          var hy = p.fl.heirY || 0;
          Sim.setJob(p, w, 'heir', { y: hy, co: Sim.heirCo(p) });
          p.job.mult = p.fl.heirM || p.job.mult * (p.fam.cls >= 6 ? D.HEIR.chaebolMult : 1); p.fl.heirM = p.job.mult;     // 떠났다 돌아와도 경력과 연봉은 이어진다
          p.inc = Sim.jobInc(p, w); p.hist[p.hist.length - 1].t = Sim.jobTitle(p);
          if (p.fl.fDead) Sim.qFront(p, 'heirCeo', {});
          ms(p, hy ? U.josa(p.job.co, '으로/로') + ' 돌아왔습니다.' : '가업 ' + p.job.co + '에 합류했습니다.', false);
          return hy ? R(null, '복귀', '자리는 그대로였습니다. 명패도, 연봉도, 뒤에서 수군대는 목소리도. ' + Sim.jobTitle(p) + ', 월 ' + won(p.inc) + '.')
            : R(null, '경영 수업', '첫 출근 날, 직원들이 일제히 일어나 인사했습니다. 명함에는 "' + U.after(D.HEIR.ranks, 0) + '"라고 적혀 있지만 아무도 그렇게 대하지 않습니다. 실력으로 증명해야 할 것이 남들보다 하나 더 많습니다.');
        case 'soldier':
          rl = roll(p, o.prob);
          if (!rl.ok) { p.happy -= 3; toPrep('job', '취업'); return R(false, '불합격', '체력 검정과 면접에서 떨어졌습니다. 군복은 아무나 입는 옷이 아니었습니다.', rl); }
          Sim.setJob(p, w, key); p.milDone = true; ms(p, (key === 'officer' ? '장교' : '부사관') + '로 임관했습니다.', false); p.happy += 5;
          return R(true, '임관', key === 'officer' ? '임관식에서 계급장을 달았습니다. 오늘부터 나보다 나이 많은 부하들이 경례를 합니다.' : '하사 계급장을 달았습니다. 병사와 장교 사이, 부대를 실제로 굴리는 자리입니다.', rl);
        case 'celeb':
          rl = roll(p, o.prob);
          if (!rl.ok) { p.happy -= 3; toPrep('celeb', '연예인 데뷔'); return R(false, '오디션 탈락', '"수고하셨습니다. 연락드릴게요." 연락은 오지 않았습니다. 복도에는 나보다 눈에 띄는 사람이 서른 명쯤 더 있었습니다.', rl); }
          Sim.setJob(p, w, 'celeb', { tier: p.fl.trainee ? 1 : 0 }); ms(p, p.fl.trainee ? '연예계에 데뷔했습니다.' : '기획사 연습생이 됐습니다.', false); p.happy += 6;
          return R(true, '합격', p.fl.trainee ? '연습생 시절이 끝나고 데뷔 무대에 섰습니다. 객석은 절반쯤 비어 있었지만, 조명은 분명히 나를 비췄습니다.' : '기획사 계약서에 사인했습니다. 연습실 거울 앞에서 하루 열두 시간을 보냅니다. 데뷔는 아직 약속되지 않았습니다.', rl);
        case 'direct':
          Sim.setJob(p, w, key); if (key === 'trade') p.fl.trade = 1;
          if (key === 'artist') ms(p, '예술인의 길을 걷기 시작했습니다.', false);
          return R(null, J.name, { factoryS: '안전화를 신고 라인에 섰습니다. 첫 월급으로 부모님께 내복을 사 드렸습니다.', trade: '사수 밑에서 공구 이름부터 배웁니다. 기술은 훔쳐 배우는 거라고 했습니다.', service: '유니폼을 받았습니다. 계약서의 기간란에는 "1년"이라고 적혀 있습니다.', lecturer: '세 학교를 돌며 강의합니다. 방학에는 수입이 없습니다.', freelance: '명함에 직함 대신 이름만 적었습니다. 일감은 인맥과 평판에서 옵니다.', artist: '좋아하는 일로 먹고살기로 했습니다. 통장은 걱정하지만 마음은 가볍습니다.', delivery: '헬멧을 쓰고 콜을 기다립니다. 비 오는 날은 단가가 오릅니다.', guard: '근무복을 입었습니다. 24시간 맞교대, 새벽 순찰이 일과입니다.', senior: '아침마다 초등학교 앞 횡단보도를 지킵니다. 아이들이 인사를 합니다.', advisor: '예전 직함 뒤에 "고문"이 붙었습니다. 출근은 주 이틀입니다.' }[key] || '새 일을 시작했습니다.');
        case 'exam':
          E = D.EXAM[key]; who = emp ? (Sim.pay(p, E.cost * 0.4), 'self') : lump(p, E.cost); rl = roll(p, o.prob);
          if (rl.ok) {
            Sim.setJob(p, w, EXAM_JOB[key]); if (key === 'cpa' || key === 'tax') p.fl.lic = key;
            ms(p, E.name + (key === 'teacher' ? '에 합격해 교단에 섰습니다.' : '에 합격했습니다.'), false); p.happy += 10;
            return R(true, '최종 합격', E.name + ' 합격자 명단에 이름이 있었습니다. 고시원 방을 빼는 날, 벽에 붙인 계획표를 한참 봤습니다.', rl);
          }
          toPrep(key, E.name); p.happy -= 5;
          return R(false, '불합격', E.name + '에서 떨어졌습니다. 커트라인과의 차이는 늘 "한두 문제"입니다.' + (who === 'self' && !emp ? ' 수험 비용은 빚으로 남았습니다.' : ''), rl);
        case 'lawAdm':
          rl = roll(p, o.prob);
          if (rl.ok) { p.prog = { k: 'law', name: '로스쿨', left: D.EXAM.lawYears, cost: D.EXAM.lawCost }; p.occ = 'prog'; p.prep = null; if (emp) Sim.leaveJob(p, w, 'quit'); ms(p, '로스쿨에 합격했습니다.', false); return R(true, '로스쿨 합격', '법학전문대학원 합격. 3년 치 학비 고지서가 함께 왔습니다.', rl); }
          toPrep('lawAdm', '로스쿨 입시'); return R(false, '불합격', '로스쿨 입시에서 떨어졌습니다. 리트 점수 1점에 수백 명이 서 있었습니다.', rl);
        case 'grad': case 'phd': case 'abroadStudy':
          rl = roll(p, o.prob);
          if (!rl.ok) { toPrep(key, key === 'abroadStudy' ? '유학' : '대학원'); return R(false, '불합격', '입학 허가를 받지 못했습니다.', rl); }
          if (emp) Sim.leaveJob(p, w, 'quit'); p.occ = 'prog'; p.prep = null;
          if (key === 'grad') { p.prog = { k: 'grad', name: '석사과정', left: D.EXAM.grad.years, cost: D.EXAM.grad.cost }; return R(true, '대학원 입학', '연구실 막내가 됐습니다. 커피 머신 관리가 첫 연구 주제입니다.', rl); }
          if (key === 'phd') { p.prog = { k: 'phd', name: '박사과정', left: D.EXAM.phd.years, cost: D.EXAM.phd.cost }; return R(true, '박사과정 입학', '졸업은 지도교수님만 아는 날짜에 합니다.', rl); }
          lump(p, D.EXAM.abroadStudy.cost); p.prog = { k: 'abroad', name: '해외 유학', left: D.EXAM.abroadStudy.years, cost: 0 }; ms(p, '해외 유학길에 올랐습니다.', false);
          return R(true, '유학', '인천공항 출국장에서 부모님이 오래 손을 흔드셨습니다.', rl);
        case 'prof':
          rl = roll(p, o.prob);
          if (rl.ok) { Sim.setJob(p, w, 'prof'); p.fl.highPost = 1; ms(p, '대학 교수로 임용됐습니다.', false); p.happy += 12; return R(true, '교수 임용', '연구실 문에 이름이 붙었습니다. 지원서를 낸 지 몇 번째 학기인지는 세지 않기로 했습니다.', rl); }
          if (!emp) { Sim.setJob(p, w, 'lecturer'); } return R(false, '임용 탈락', '최종 3인까지 갔지만 이름은 불리지 않았습니다. 이번 학기도 시간강사로 강단에 섭니다.', rl);
        case 'reExam': p.occ = 'resu'; p.nsu++; p.prep = null; p.ab += Math.max(-1, 1 + U.norm(p.rng) * 3) * (0.6 + p.st.dil / 125); return R(null, '다시 수험생', '서점에서 수능 기출 문제집을 다시 샀습니다.');
        case 'founder':
          if (emp) Sim.leaveJob(p, w, 'quit'); if (p.fam.assets > D.FOUNDER.capital * 5 && p.fam.alive > 0 && p.age < 35) p.fam.assets -= D.FOUNDER.capital; else Sim.pay(p, D.FOUNDER.capital);
          Sim.setJob(p, w, 'founder', { mult: clamp(Math.exp(U.norm(p.rng) * 0.5) * (1 + (p.st.iq + p.st.social - 100) * 0.006), 0.3, 4) }); ms(p, '스타트업을 창업했습니다.', false);
          return R(null, '창업', '공유 오피스 한 칸에서 법인 등기를 마쳤습니다. 직함은 대표, 업무는 전부입니다.');
        case 'biz': Sim.qFront(p, 'bizType', { emp: emp }); return R(null, '창업 준비', '상권 분석 영상을 밤새 봤습니다. 부동산 중개인은 어디든 "목이 좋다"고 합니다.');
        case 'retire': p.occ = 'retired'; p.prep = null; ms(p, '일을 완전히 내려놓았습니다.', false); return R(null, '은퇴', '알람을 끄고 잠들었습니다. 수십 년 만의 일입니다.');
        default: p.occ = 'idle'; p.prep = null; p.happy += 1; return R(null, '쉼', '한 해를 쉬었습니다. 쉬는 것도 생각보다 체력이 듭니다.');
      }
    }
  };
  DEC.careerFail = {
    build: function (p, w, c) {
      var sp = H.hireProb(p, w, 'small');
      return { title: '불합격 이후', icon: '📄', desc: '채용 시즌이 끝났습니다. 올해를 어떻게 보낼까요?', opts: [
        O('small', '눈높이를 낮춰 중소기업에 간다', { desc: '초임 월 ' + won(D.JOBS.small.ranks[0][1]), prob: sp, stats: ['dil', 'social'], ai: 1.5 + (p.prep ? p.prep.n : 0) }),
        O('again', '취업 재수', { desc: '스펙을 보완해 내년에 다시 도전', ai: p.prep && p.prep.n >= 3 ? 0.3 : 1.6 }),
        O('part', '알바를 하며 버틴다', { desc: '월 ' + won(D.JOBS.parttime.avg) + ' 안팎', ai: 0.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'small') { var rl = roll(p, o.prob); if (rl.ok) { Sim.setJob(p, w, 'small'); ms(p, '중소기업에 입사했습니다.', false); return R(true, '입사', '면접 다음 날 바로 출근하라는 연락이 왔습니다. 사수는 지난달에 퇴사했다고 합니다.', rl); } return R(false, '불합격', '중소기업도 쉽지 않았습니다. 올해는 취업 준비생으로 남습니다.', rl); }
      if (key === 'part') { Sim.setJob(p, w, 'parttime'); return R(null, '아르바이트', '낮에는 일하고 밤에는 공고를 봅니다.'); }
      p.spec = Math.min(8, p.spec + 0.6); return R(null, '취업 재수', '토익 학원과 스터디 카페를 오갑니다. 졸업 유예를 신청했습니다.');
    }
  };

  /* ================= 직장 ================= */
  DEC.promo = {
    build: function (p, w, c) {
      var j = p.job, J = D.JOBS[j.k], exec = j.rank === 4, base = exec ? J.exec : J.ranks[j.rank][3], P = D.PROMO, next = J.ranks[j.rank + 1][0], tb = H.teamBonus(p), tm = j.team, DF = H.diff(p);
      if (exec && DF.execFloor) base = Math.max(base * DF.exec, DF.execFloor[j.k === 'small' ? 0 : 1]);     // 축복 모드: 능력치가 낮아도 임원을 노려 볼 만하다
      var d = exec ? (J.mil ? '장군 진급 심사입니다. 대령 수백 명 가운데 한 줌만 별을 답니다.' : '임원 인사 시즌입니다. 부장 수십 명 중 한두 명만 별을 답니다.') : next + (J.mil ? ' 진급 심사 대상자 명단에 올랐습니다. 떨어지면 계급정년이 다가옵니다.' : ' 승진 대상자 명단에 올랐습니다. 어떻게 임할까요?');
      if (tm) d += ' ' + tm.boss + ' ' + (J.mil ? '지휘관' : '팀장') + '과의 관계는 "' + H.relWord(tm.rel) + '"' + (tb > 0.25 ? ' — 평소 쌓아 둔 관계가 심사에 힘이 됩니다.' : tb < -0.25 ? ' — 윗선의 평가가 발목을 잡습니다.' : '.') + (tm.line === 1 ? ' 줄을 선 임원이 밀어 줍니다.' : tm.line === -1 ? ' 줄을 섰던 임원이 밀려난 여파가 남아 있습니다.' : '');
      return { title: exec ? next + (J.mil ? ' 진급 심사' : ' 승진 심사') : next + (J.mil ? ' 진급 심사' : ' 승진 경쟁'), icon: '📈', desc: d, opts: [
        O('push', '모든 걸 건다 (야근·주말 반납)', { desc: '확률 ↑ · 건강 −, 가족관계 −', prob: pr(p, base, P.stats, P.push + tb), stats: ['dil', 'social', 'iq'], ai: 1 + p.st.dil / 50 }),
        O('norm', '평소대로 한다', { prob: pr(p, base, P.stats, tb), stats: ['dil', 'social', 'iq'], ai: 2 }),
        O('relax', '승진보다 저녁이 있는 삶', { desc: '확률 ↓ · 행복 +', prob: pr(p, base, P.stats, P.relax + tb), stats: ['dil', 'social', 'iq'], ai: 0.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job, J = D.JOBS[j.k], P = D.PROMO, exec = j.rank === 4, rl = roll(p, o.prob);
      if (key === 'push') { p.health += P.pushHealth; if (p.spouse) p.mq += P.pushMq; p.over = 3; p.happy -= 3; }
      if (key === 'relax') p.happy += 4;
      if (rl.ok) {
        j.rank++; j.ry = 0; p.inc = Sim.jobInc(p, w); p.happy += exec ? 12 : 5;
        if (exec && J.mil) { p.fl.general = 1; p.fl.highPost = 1; ms(p, '장군으로 진급해 별을 달았습니다.', false); return R(true, '장군 진급', '어깨에 별이 올라갔습니다. 삼정검을 받는 손이 떨렸습니다. 임관 동기 수천 명 가운데 여기까지 온 사람은 손에 꼽습니다.', rl); }
        if (exec) { if (j.k !== 'small') { p.fl.exec = 1; p.fl.highPost = 1; } else p.fl.smExec = 1; ms(p, J.name + ' ' + U.josa(J.ranks[j.rank][0], '으로/로') + ' 승진했습니다.', false); return R(true, '임원 승진', '별을 달았습니다. 법인 차량과 함께 "임시 직원"이라는 농담도 따라왔습니다.', rl); }
        if (j.rank >= 2) ms(p, J.name + ' ' + U.josa(J.ranks[j.rank][0], '으로/로') + ' 승진했습니다.', false);
        return R(true, '승진', J.ranks[j.rank][0] + ' 명함이 나왔습니다. 책임도 한 장 더 얹혔습니다.', rl);
      }
      j.ry = exec ? j.ry : Math.max(0, J.ranks[j.rank][2] - 2); if (exec) j.execTried = 1; p.happy -= exec ? 4 : 6;
      return R(false, '승진 누락', exec ? '임원 명단에 이름이 없었습니다. 회사에서 남은 시간을 세어 보게 됩니다.' : '후배가 먼저 승진했습니다. 축하한다고 말하는 목소리가 조금 갈라졌습니다.', rl);
    }
  };
  DEC.erp = {
    build: function (p, w, c) {
      var E = D.ERP, mo = Math.round(E.months[0] + (E.months[1] - E.months[0]) * Math.min(1, p.job.y / 25)), amt = mo * p.inc;
      return { title: '희망퇴직', icon: '📦', desc: p.age + '세. 인사팀 면담 요청 메일이 왔습니다. "제2의 인생을 지원합니다"라는 제목입니다. 위로금은 ' + mo + '개월 치 급여(' + won(amt) + ').', opts: [
        O('accept', '위로금을 받고 나간다', { desc: won(amt) + ' + 퇴직금', ai: 1.2, amt: amt }),
        O('resist', '버틴다', { desc: '성공하면 잔류, 실패하면 한직 발령 끝에 ' + E.kickMonths + '개월 치만 받고 나갑니다', prob: pr(p, E.resistBase, { dil: 0.3, social: 0.4 }, w.macro[p.age].k === 'crisis' ? -0.6 : 0), stats: ['dil', 'social'], ai: 1.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      var name = D.JOBS[p.job.k].name, sev;
      if (key === 'accept') { p.cash += o.amt; sev = Sim.leaveJob(p, w, 'erp'); p.fl.erp = p.age; p.happy -= 5; ms(p, name + '에서 희망퇴직했습니다.', false); Sim.q(p, 'career', {}); return R(null, '희망퇴직', '25년 다닌 회사의 출입증을 반납했습니다. 위로금과 퇴직금 ' + won(o.amt + sev) + '이 통장에 찍혔습니다. 큰돈 같지만, 남은 인생은 그보다 깁니다.', null, 'box'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { p.job.safe = p.age + 3; p.happy -= 4; return R(true, '잔류', '면담을 세 번 버텼습니다. 자리는 지켰지만 회의에 부르는 사람이 줄었습니다.', rl); }
      p.cash += D.ERP.kickMonths * p.inc; Sim.leaveJob(p, w, 'kick'); p.fl.erp = p.age; p.happy -= 10; ms(p, name + '에서 밀려나듯 퇴직했습니다.', false); Sim.q(p, 'career', {});
      return R(false, '퇴직', '창가 자리로 옮겨진 지 반년, 결국 사직서를 냈습니다. 위로금은 처음 제안의 일부였습니다.', rl);
    }
  };
  DEC.jobchange = {
    build: function (p, w, c) {
      var j = p.job, k = j.k, opts = [];
      if (k !== 'large') { var lp = pr(p, k === 'mid' ? 0.16 : 0.05, D.HIRE_STATS, -Math.max(0, p.age - 36) * 0.2); opts.push(O('up', '대기업 경력직 지원', { desc: '직급 유지 · 연봉 대폭 상승', prob: lp, stats: ['iq', 'dil', 'social'], ai: lp * 8 })); }
      opts.push(O('raise', '연봉을 올려 동종 업계로 이직', { desc: '성공하면 연봉 +' + U.pct(D.JOBCHANGE.raise[0]) + '~' + U.pct(D.JOBCHANGE.raise[1]) + '%', prob: pr(p, D.JOBCHANGE.base, { social: 0.3, iq: 0.2 }, w.macro[p.age].hire < 1 ? -0.8 : 0), stats: ['social', 'iq'], ai: 1.2 }));
      opts.push(O('startup', '스타트업으로 옮긴다', { desc: '월 ' + won(D.JOBS.startup.start) + '부터 · 스톡옵션이라는 복권', ai: 0.04 + H.risk(p) * 0.1 }));
      opts.push(O('stay', '지금 회사에 남는다', { ai: 2.2 }));
      return { title: '이직 제안', icon: '📨', desc: '헤드헌터의 연락이 왔습니다. "좋은 포지션이 있는데 관심 있으신가요?"', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'stay') return R(null, '잔류', '정중히 거절했습니다. 익숙한 자리의 가치를 다시 계산해 봤습니다.');
      if (key === 'startup') { Sim.setJob(p, w, 'startup'); ms(p, '스타트업으로 이직했습니다.', false); return R(null, '스타트업 이직', '직급 대신 영어 이름을 받았습니다. 회의실 이름이 행성입니다.'); }
      var rl = roll(p, o.prob), j = p.job;
      if (!rl.ok) return R(false, '이직 실패', '최종 면접에서 떨어졌습니다. 내일도 같은 자리로 출근합니다. 아무도 모르게.', rl);
      if (key === 'up') { var rank = j.rank, mult = j.mult; Sim.setJob(p, w, 'large', { rank: Math.min(rank, 3), mult: mult }); p.inc = Sim.jobInc(p, w); ms(p, '대기업 경력직으로 이직했습니다.', false); p.happy += 6; return R(true, '대기업 이직', '경력직 입사자 교육을 받았습니다. 공채 기수 문화가 낯설지만 연봉은 낯설지 않습니다.', rl); }
      j.mult *= 1 + U.range(p.rng, D.JOBCHANGE.raise); j.co = Sim.coName(p, j.k, 1) || j.co; p.hist.push({ a: p.age, t: Sim.jobTitle(p) }); p.inc = Sim.jobInc(p, w); p.fl.moves = (p.fl.moves || 0) + 1;
      return R(true, '이직 성공', '연봉 계약서의 숫자가 바뀌었습니다. 새 회사의 커피는 조금 더 맛있습니다.', rl);
    }
  };

  /* ================= 전문직 ================= */
  var DEPTS = { hot: ['피부과', '안과', '성형외과'], core: ['내과', '외과', '소아청소년과', '산부인과'], gp: ['일반의'] };
  DEC.docSpec = {
    build: function (p) {
      var S = D.DOC_SPEC;
      return { title: '전공 선택', icon: '🩺', desc: '의사 국가시험에 합격했습니다. 이제 수련의 시간입니다. 어느 과에 지원할까요?', opts: [
        O('hot', S.hot.name, { desc: '경쟁 치열 · 소득 ×' + S.hot.mult + ' · 떨어지면 필수과로', prob: pr(p, S.hot.base, { iq: 0.5, dil: 0.6, social: 0.2 }), stats: ['iq', 'dil'], ai: 3 }),
        O('core', S.core.name, { desc: '늘 사람이 모자랍니다. 고되지만 보람이 있습니다', ai: 1.5 }),
        O('gp', '수련 없이 일반의로 나간다', { desc: '5년을 아끼지만 소득 ×' + S.gp.mult, ai: 0.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      p.fl.lic = 'doc'; var spec = key, rl = null, txt;
      if (key === 'hot') { rl = roll(p, o.prob); if (!rl.ok) spec = 'core'; }
      var dept = DEPTS[spec][U.hash(p.id + 'dept') % DEPTS[spec].length];
      p.fl.spec = spec; p.fl.dept = dept;
      if (spec === 'gp') { Sim.docNext(p, w); return R(null, '일반의', '수련 대신 바로 현장으로 나갑니다. 동기들이 당직을 설 때 월급을 받습니다.'); }
      Sim.setJob(p, w, 'resident', { spec: spec, dept: dept });
      txt = dept + ' 전공의가 됐습니다. 주 80시간 근무, 병원 당직실이 집입니다.';
      if (key === 'hot') return R(rl.ok, rl.ok ? '인기과 합격' : '인기과 탈락', rl.ok ? txt : '인기과 정원에 들지 못했습니다. ' + txt, rl);
      return R(null, dept, txt);
    }
  };
  DEC.docPath = {
    build: function (p) {
      var J = D.JOBS, L = J.docOwn.loan, sm = D.DOC_SPEC[p.fl.spec].mult, help = p.fam.alive > 0 && p.fam.assets > L * 2;
      var opts = [O('emp', '봉직의(페이닥터)', { desc: '월 ' + won(J.doc.curve[0][1] * sm) + ' 안팎 · 안정적', ai: 2 }),
        O('own', '개원한다', { desc: '대출 ' + won(help ? L / 2 : L) + (help ? '(절반은 부모님 지원)' : '') + ' · 자리 잡으면 월 ' + won(J.docOwn.avg * sm) + ' 안팎, 아니면 빚', prob: pr(p, 0.68, { social: 0.4, dil: 0.3 }), stats: ['social', 'dil'], ai: 1.3 + H.risk(p) })];
      if (p.fl.spec !== 'gp') opts.push(O('prof', '대학병원 교수 트랙', { desc: '월 ' + won(J.docProf.curve[0][1]) + ' · 명예와 연구, 정년 65세', prob: pr(p, 0.12, { iq: 0.6, dil: 0.5 }), stats: ['iq', 'dil'], ai: 0.6 }));
      return { title: '의사의 갈림길', icon: '🏥', desc: '수련과 병역을 마쳤습니다. ' + p.age + '세, 이제야 진짜 시작입니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      var base = { spec: p.fl.spec, dept: p.fl.dept };
      if (key === 'emp') { Sim.setJob(p, w, 'doc', base); ms(p, p.fl.dept + ' 봉직의로 일하기 시작했습니다.', false); return R(null, '봉직의', '병원 로비에 의료진 소개 사진이 걸렸습니다.'); }
      if (key === 'prof') { var r2 = roll(p, o.prob); if (r2.ok) { Sim.setJob(p, w, 'docProf', base); p.fl.highPost = 1; ms(p, '대학병원 교수가 되었습니다.', false); return R(true, '임용', '임상 조교수 발령장을 받았습니다. 외래, 수술, 논문이 동시에 밀려옵니다.', r2); } Sim.setJob(p, w, 'doc', base); return R(false, '임용 탈락', '펠로우 자리는 이어지지 않았습니다. 봉직의로 방향을 틉니다.', r2); }
      return Sim.openOwn(p, w, 'docOwn', base, o.prob);
    }
  };
  var OWN_OF = { doc: 'docOwn', medEmp: 'medOwn', cpa: 'cpaOwn', tax: 'taxOwn', lawIn: 'lawSolo', lawBig: 'lawSolo', lawGov: 'lawSolo' };
  DEC.openPro = {
    build: function (p, w) {
      var j = p.job, ok = OWN_OF[j.k], J = D.JOBS[ok], loan = j.k === 'medEmp' ? D.MEDPRO[j.sub].loan : J.loan, avg = j.k === 'medEmp' ? D.MEDPRO[j.sub].own : J.avg * (j.spec ? D.DOC_SPEC[j.spec].mult : 1);
      return { title: '개업', icon: '🏪', desc: Sim.jobTitle(p) + ' ' + j.y + '년 차, 월 ' + won(p.inc) + '. "내 간판"을 걸 때가 됐을까요?', opts: [
        O('own', '개업한다', { desc: '대출 ' + won(loan) + ' · 자리 잡으면 월 ' + won(avg) + ' 안팎', prob: pr(p, 0.66, { social: 0.4, dil: 0.3 }, Math.min(j.y, 10) * 0.05), stats: ['social', 'dil'], ai: 0.9 + H.risk(p) }),
        O('stay', '월급 받는 자리에 남는다', { ai: 1.6 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'stay') return R(null, '잔류', '개업한 선배의 한숨을 떠올리며 계산기를 덮었습니다.');
      var j = p.job, base = { spec: j.spec, dept: j.dept, sub: j.sub };
      return Sim.openOwn(p, w, OWN_OF[j.k], base, o.prob);
    }
  };
  Sim.openOwn = function (p, w, k, base, prob) {
    var J = D.JOBS[k], loan = k === 'medOwn' ? D.MEDPRO[base.sub].loan : J.loan, rl = roll(p, prob);
    if (p.fam.alive > 0 && p.fam.assets > loan * 2) { p.fam.assets -= loan / 2; loan /= 2; }
    Sim.pay(p, loan);
    var m = Math.exp(Math.abs(U.norm(p.rng)) * J.sd * (rl.ok ? 1 : -0.8)) * (rl.ok ? 1 : 0.9);     // 초기에 고전해도 평판이 쌓이면 회복한다(life.js)
    base.mult = m; base.backK = p.job ? p.job.k : (k === 'docOwn' ? 'doc' : null);
    Sim.setJob(p, w, k, base); p.job.mult = m; Sim.rollVar(p, w); p.inc = Sim.jobInc(p, w);
    ms(p, U.josa(Sim.jobTitle(p), '으로/로').replace(/^개업 /, '') + ' 개업했습니다.', false); p.fl.opened = 1;
    return rl.ok ? R(true, '개업 성공', '개업 화환이 복도를 채웠습니다. 석 달 만에 예약이 차기 시작합니다.', rl, 'house')
      : R(false, '개업 초기 고전', '간판은 걸었지만 대기실이 조용합니다. 같은 건물에 같은 과가 둘 더 있었습니다.', rl);
  };
  DEC.barExam = {
    build: function (p) {
      var E = D.EXAM.bar, n = p.fl.barN || 0;
      return { title: '변호사시험' + (n ? ' ' + (n + 1) + '회차' : ''), icon: '⚖️', desc: n ? '다시 1월입니다. 응시 기회는 다섯 번, 이번이 ' + (n + 1) + '번째입니다.' : '로스쿨 3년의 끝. 닷새간의 시험이 기다립니다.', opts: [
        O('take', '시험장에 들어간다', { prob: pr(p, E.base, E.stats, -n * E.repeatPen), stats: ['iq', 'dil'], ai: 10 }),
        O('quit', '법조인의 길을 접는다', { ai: n >= 2 ? 1 : 0.01 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'quit') { p.occ = 'idle'; p.prep = null; p.deg = '석사'; Sim.qFront(p, 'career', {}); return R(null, '포기', '법전을 중고 서점에 넘겼습니다. 3년과 학비는 이력서 한 줄로 남았습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { p.fl.lic = 'law'; p.deg = '석사'; p.prep = null; ms(p, '변호사시험에 합격했습니다.', false); p.happy += 12; Sim.qFront(p, 'lawPath', {}); return R(true, '합격', '합격자 명단에서 수험번호를 찾았습니다. 부모님께 전화하는 손이 떨렸습니다.', rl); }
      p.fl.barN = (p.fl.barN || 0) + 1; p.happy -= 8;
      if (p.fl.barN >= D.EXAM.bar.max) { p.occ = 'idle'; p.prep = null; p.deg = '석사'; p.fl.otal = 1; ms(p, '변호사시험 응시 기회를 모두 소진했습니다.', false); return R(false, '오탈', '다섯 번의 기회가 모두 끝났습니다. 이른바 "오탈자"가 되었습니다.', rl); }
      p.occ = 'prep'; p.prep = { what: 'bar', name: '변호사시험', n: p.fl.barN };
      return R(false, '불합격', '불합격. 합격률 통계의 반대편에 섰습니다. 1년을 더 준비합니다.', rl);
    }
  };
  DEC.lawPath = {
    build: function (p, w, c) {
      var t = Sim.tierKey(p), J = D.JOBS, ex = c.ex || [], opts = [];
      if (ex.indexOf('big') < 0) opts.push(O('big', '대형 로펌', { desc: '초임 월 ' + won(J.lawBig.curve[0][1]) + ' · 새벽 퇴근', prob: pr(p, 0.13, { iq: 0.6, social: 0.3, dil: 0.3 }, t === 'sky' ? 1.0 : t === 'top' ? 0.4 : 0), stats: ['iq', 'social', 'dil'], ai: 3 }));
      if (ex.indexOf('gov') < 0) opts.push(O('gov', '판·검사 임용', { desc: '월 ' + won(J.lawGov.curve[0][1]) + ' · 명예와 격무', prob: pr(p, 0.06, { iq: 0.8, dil: 0.5 }), stats: ['iq', 'dil'], ai: 1 }));
      opts.push(O('in', '사내변호사', { desc: '월 ' + won(J.lawIn.curve[0][1]) + ' · 회사원의 삶', prob: pr(p, 0.75, { social: 0.3 }), stats: ['social'], ai: 2 }));
      opts.push(O('solo', '중소 로펌·개업', { desc: '월 ' + won(J.lawSolo.avg) + ' 안팎 · 수임이 곧 소득', ai: 1.5 }));
      return { title: '변호사의 갈림길', icon: '⚖️', desc: '변호사 배지를 받았습니다. 같은 자격증이지만 출발선은 제각각입니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'solo') { Sim.setJob(p, w, 'lawSolo'); Sim.pay(p, D.JOBS.lawSolo.loan); ms(p, '변호사 사무실을 열었습니다.', false); return R(null, '개업', '서초동 공유 사무실에 명패를 걸었습니다. 첫 사건은 지인의 전세 보증금 분쟁입니다.'); }
      var rl = roll(p, o.prob), map = { big: 'lawBig', gov: 'lawGov', 'in': 'lawIn' };
      if (rl.ok) { Sim.setJob(p, w, map[key]); if (key !== 'in') p.fl.highPost = 1; ms(p, D.JOBS[map[key]].name + (key === 'gov' ? '로 임용됐습니다.' : '가 되었습니다.'), false); return R(true, '합격', D.JOBS[map[key]].name + '. 첫 출근 날 받은 기록 뭉치가 책상을 덮었습니다.', rl); }
      Sim.qFront(p, 'lawPath', { ex: (c.ex || []).concat([key === 'in' ? 'x' : key]) });
      return R(false, '탈락', '컨펌을 받지 못했습니다. 다른 길을 찾습니다.', rl);
    }
  };
  DEC.proRetire = {
    build: function (p) {
      return { title: '언제까지 일할까', icon: '🕰️', desc: p.age + '세. ' + (D.JOBS[p.job.k].type === 'pro' || D.JOBS[p.job.k].type === 'own' ? '전문직에는 정년이 없습니다. 손이 떨리기 전까지는 현역입니다.' : '정년이 따로 없는 일입니다. 몸이 허락하는 한 계속할 수 있습니다.'), opts: [
        O('go', '일하는 시간을 줄여 계속 일한다', { desc: '소득 −30% · 건강 부담 감소', ai: p.health > 45 ? 2 : 0.5 }),
        O('stop', '은퇴한다', { ai: p.age >= 75 ? 3.5 : p.age >= 70 ? 2.2 : 1.2 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'go') { p.job.mult *= 0.7; p.job.half = 1; Sim.rollVar(p, w); p.inc = Sim.jobInc(p, w); return R(null, '현역', '오전에만 문을 엽니다. 단골들은 "선생님 그만두시면 어디로 가느냐"고 합니다.'); }
      if (p.job.k === 'biz') p.cash += (p.job.cap || 0) * 0.3;
      Sim.leaveJob(p, w, 'retire'); p.occ = 'retired'; ms(p, '오랜 현역 생활을 마치고 은퇴했습니다.', false); return R(null, '은퇴', '마지막 날, 평소처럼 문을 잠갔습니다. 열쇠를 돌리는 손이 조금 느렸습니다.');
    }
  };

  /* ================= 자영업 ================= */
  DEC.bizType = {
    build: function (p, w, c) {
      var liq = Sim.liquid(p), opts = [], B = D.BIZ, a = p.age;
      Object.keys(B).forEach(function (k) {
        var b = B[k], dis = null;
        if (b.needDeg && !Sim.isGrad(p)) dis = '대졸 이상 필요';
        else if (b.needTrade && !p.fl.trade) dis = '기술직 경력 필요';
        else if (liq < b.capital * 0.4) dis = '자기자본 ' + won(b.capital * 0.4) + ' 이상 필요';
        var loan = Math.max(0, b.capital - liq);
        opts.push(O(k, b.name, { desc: '창업 ' + won(b.capital) + (loan && !dis ? ' (대출 ' + won(loan) + ')' : '') + ' · 평균 월 ' + won(b.avg) + ' · 초기 연 폐업률 ' + U.pct(b.close) + '%', prob: pr(p, 0.5, D.BIZ_RULE.stats), stats: ['dil', 'social'], dis: dis, ai: k === 'franchise' ? 0.6 : k === 'repair' ? 4 : k === 'chicken' || k === 'cafe' ? 2 : 1 }));
      });
      opts.push(O('no', '다시 생각해 본다', { ai: 0.2 }));
      return { title: '업종 선택', icon: '🏪', desc: (a >= 45 ? '퇴직금과 대출을 합쳐 가게를 차립니다. ' : '') + '성공 확률은 "초기에 자리 잡을 확률"입니다. 자리를 잡지 못하면 평균보다 훨씬 적게 법니다.', opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'no') { if (!p.job) { p.occ = 'idle'; } return R(null, '보류', '임대차 계약서 앞에서 펜을 내려놓았습니다.'); }
      var b = D.BIZ[key], rl = roll(p, o.prob), sd = D.BIZ_RULE.sd;
      if (p.job) Sim.leaveJob(p, w, 'quit');
      Sim.pay(p, b.capital);
      var m = Math.exp(Math.abs(U.norm(p.rng)) * sd * (rl.ok ? 1 : -1)) * (rl.ok ? 1.05 : 0.8);
      Sim.setJob(p, w, 'biz', { biz: key, cap: b.capital }); p.job.mult = m; Sim.rollVar(p, w); p.inc = Sim.jobInc(p, w);
      p.fl.bizN = (p.fl.bizN || 0) + 1; ms(p, U.josa(b.name, '을/를') + ' 열었습니다.', false);
      return rl.ok ? R(true, '개업', b.name + ' 문을 열었습니다. 개업 첫 주, 줄이 가게 밖까지 이어졌습니다.', rl, 'house')
        : R(false, '개업 초기 고전', b.name + ' 문을 열었습니다. 개업 떡을 돌렸지만 손님은 지인뿐이었습니다.', rl);
    }
  };
  DEC.bizCrisis = {
    build: function (p, w, c) {
      var b = D.BIZ[p.job.biz];
      return { title: '폐업 위기', icon: '🚪', desc: b.name + ' 매출이 석 달째 임대료에 못 미칩니다. 통장 잔고가 바닥을 보입니다.', opts: [
        O('close', '가게를 정리한다', { desc: '권리금·집기 일부만 회수합니다', ai: 1.5 }),
        O('hold', '대출을 받아 버틴다', { desc: '대출 ' + won(3000) + ' · 성공하면 반등, 실패하면 빚만 늘어납니다', prob: pr(p, 0.38, D.BIZ_RULE.stats), stats: ['dil', 'social'], ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'hold') { Sim.pay(p, 3000); var rl = roll(p, o.prob); if (rl.ok) { p.job.mult = Math.max(p.job.mult * 1.3, 0.9); p.job.held = p.age; return R(true, '반등', '메뉴를 바꾸고 배달을 시작했습니다. 다시 손님이 듭니다.', rl); } var t = Sim.closeBiz(p, w, true); return R(false, '폐업', '버텼지만 결국 문을 닫았습니다. ' + t, rl); }
      return R(null, '폐업', Sim.closeBiz(p, w, false));
    }
  };
  Sim.closeBiz = function (p, w, worse) {
    var j = p.job, b = D.BIZ[j.biz], Bz = D.BIZ_RULE, back = j.cap * Bz.recover * (worse ? 0.5 : 1), extra = U.range(p.rng, Bz.extraDebt) * (worse ? 1.5 : 1);
    p.cash += back; Sim.pay(p, extra);
    p.fl.bizClosed = (p.fl.bizClosed || 0) + 1; p.happy -= 10;
    ms(p, U.josa(b.name, '을/를') + ' 폐업했습니다.', false);
    Sim.leaveJob(p, w, 'close'); Sim.q(p, 'career', {});
    return '"임대 문의" 종이를 유리문에 붙였습니다. 집기는 중고 업자가 헐값에 실어 갔습니다.';
  };
  DEC.bizExpand = {
    build: function (p, w) {
      var b = D.BIZ[p.job.biz];
      return { title: '2호점', icon: '🏬', desc: b.name + ' 장사가 잘됩니다(월 ' + won(p.inc) + '). 2호점 자리를 봐 둔 곳이 있습니다.', opts: [
        O('go', '2호점을 낸다', { desc: '투자 ' + won(b.capital) + ' · 성공하면 소득 ×' + D.BIZ_RULE.expandMult, prob: pr(p, 0.58, D.BIZ_RULE.stats), stats: ['dil', 'social'], ai: 0.8 + H.risk(p) }),
        O('stay', '지금 가게에 집중한다', { ai: 1.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      p.job.expAsked = 1; if (key === 'stay') return R(null, '내실', '욕심을 접었습니다. 한 가게를 지키는 것도 쉽지 않습니다.');
      var b = D.BIZ[p.job.biz], rl = roll(p, o.prob); Sim.pay(p, b.capital);
      if (rl.ok) { p.job.exp = 1; p.job.cap += b.capital; ms(p, b.name + ' 2호점을 냈습니다.', false); return R(true, '확장 성공', '2호점도 자리를 잡았습니다. 이제 "사장님" 대신 "대표님"이라 불립니다.', rl, 'house'); }
      p.job.mult *= 0.85; return R(false, '확장 실패', '2호점은 반년 만에 접었습니다. 본점 수익으로 손실을 메웁니다.', rl);
    }
  };
})();
