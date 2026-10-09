/* extras.js — 월별 계절·일상, 직장 인간관계, 연애·자녀 사건, 학교·군·연예·가업 갈림길, 결혼정보회사, 부동산(건물·갭투자), 상속, 연말 결산
 * quarter.js의 Sim.Q와 life.js·quarter.js가 불러 주는 훅(teamCheck, monthHook, flavor, kidLine, celebYear, estate, snap, yearReport, miniType)을 채웁니다.
 * 달마다 나오는 사건은 QX(직장·연애·연예·가업)와 NEWS(선택지 없는 소소한 일) 목록에 한 줄씩 추가합니다. */
(function () {
  'use strict';
  var clamp = U.clamp, won = U.won, say = Sim.say, ms = Sim.ms, DEC = Sim.DEC, H = Sim.H, Q = Sim.Q;
  var O = H.O, pr = H.pr, roll = H.roll, R = H.R, famCan = H.famCan, famSpend = H.famSpend, A = Q.A, r100 = Q.r100, single = Q.single, toDec = Q.toDec;
  function strain(can) { return can === 1 ? ' · 부모님이 무리합니다' : ''; }
  function noMoney(can) { return can ? null : '가계 형편상 어렵습니다'; }
  function quiet() { var x = R(null, '', ''); x.quiet = 1; return x; }     // 연출 없이 다음 갈림길로 바로 넘어간다
  function sgn(d) { return (d >= 0 ? '+' : '−') + Math.abs(Math.round(d)); }
  function jobIs(p, k) { return !!p.job && p.job.k === k; }
  function kidCall(i) { return i === 0 ? '첫째' : i === 1 ? '둘째' : '셋째'; }

  /* ================= 학교: 고입 준비, 특성화·마이스터고, 기능경기대회, 고3 입시 전략 ================= */
  DEC.hsPrep = {
    build: function (p) {
      var L = D.EDU.hsPrep, ac = Sim.acad(p), z = p.fam.zeal;
      return { title: '고입 준비', icon: '🏫', desc: '열다섯, 중3. 내년이면 고등학교 원서를 씁니다. 과학고·외고·자사고는 학교 공부만으로는 어렵고, 입시 학원이 합격선을 가른다고들 합니다. 지금 성적은 ' + H.topPct(ac) + ', 부모님 월소득은 ' + won(p.fam.inc) + '.', opts: L.map(function (x, i) {
        var can = i ? famCan(p, x.cost) : 2;
        return O('' + i, x.name, { desc: (x.cost ? '월 ' + won(x.cost) : '비용 없음') + ' · 특목고·자사고 합격 점수 +' + x.bonus + (i === 2 ? ' · 자기소개서와 면접까지 봐 줍니다 · 행복 −' : '') + strain(can), dis: noMoney(can),
          ai: i === 0 ? 2.5 : i === 1 ? (ac > 55 ? z / 50 : 0.3) : ac > 57 ? (can === 2 ? z / 32 : 0.35) : 0.03 });
      }) };
    },
    resolve: function (p, w, c, key) {
      var i = +key, x = D.EDU.hsPrep[i]; p.fl.hsPrep = i;
      if (i) { if (famCan(p, x.cost) === 1) p.fam.harmony -= 2; famSpend(p, x.cost * 12); p.happy -= i * 2; }
      return R(null, x.name, ['학교 도서관과 문제집으로 준비합니다. 학원 다니는 친구들이 보는 자료가 가끔 부럽습니다.', '주말마다 입시 특강을 듣습니다. 기출 면접 질문을 처음 봤습니다.', '입시 전문학원 특목고반에 들어갔습니다. 자기소개서를 일곱 번 고쳤고, 모의 면접에서는 세 번 울었습니다. 학원비 영수증은 부모님이 조용히 접어 넣으셨습니다.'][i]);
    }
  };
  DEC.vocLife = {
    build: function (p) {
      var m = p.fl.meister;
      return { title: (m ? '마이스터고' : '특성화고') + ' 2학년', icon: '🔧', desc: '열일곱. 실습동의 기계 소리가 익숙해졌습니다. ' + (m ? '학교는 대기업과 채용 협약을 맺고 있고, ' : '') + '기능반 선배들은 전국기능경기대회 메달로 대기업 생산직 특별채용을 노립니다.', opts: [
        O('skill', '기능반에 들어간다 (기능생)', { desc: '방과 후와 주말을 실습실에서 보냅니다 · 내년 전국기능경기대회 출전', prob: pr(p, m ? 0.7 : 0.5, { dil: 0.6, talent: 0.3 }), stats: ['dil', 'talent'], ai: 1.2 + p.st.dil / 60 }),
        O('cert', '자격증을 여러 개 따 둔다', { desc: '기능사 자격증 · 생산직·기술직 취업에 유리', ai: 2 }),
        O('univ', '대학 진학을 준비한다', { desc: '특성화고 특별전형 · 학업 +', ai: 0.6 }),
        O('play', '놀 때 놀아야지', { desc: '행복 +, 사교성 +', ai: p.st.dil < 40 ? 1.2 : 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'cert') { p.fl.cert = 1; p.spec += 0.8; return R(null, '자격증', '전기기능사, 용접기능사, 지게차. 필통보다 자격증 수첩이 두꺼워졌습니다.'); }
      if (key === 'univ') { p.ab += 3; return R(null, '진학 준비', '실습이 끝나면 교실에 남아 문제집을 풉니다. 담임 선생님이 특별전형 요강을 뽑아 주셨습니다.'); }
      if (key === 'play') { p.happy += 8; p.st.social = clamp(p.st.social + 3, 1, 99); return R(null, '청춘', '실습복을 사물함에 넣고 PC방으로 갑니다. 그 시절엔 그게 제일 재밌었습니다.'); }
      var rl = roll(p, o.prob); p.fl.cert = 1;
      if (rl.ok) { p.fl.skill = 1; p.happy -= 3; return R(true, '기능반 선발', '기능반 명찰을 받았습니다. 밤 열 시까지 실습실 불이 꺼지지 않습니다. 손끝의 감각이 하루가 다르게 달라집니다.', rl); }
      return R(false, '선발 탈락', '기능반 선발 과제에서 떨어졌습니다. 대신 자격증을 하나씩 따 두기로 했습니다.', rl);
    }
  };
  DEC.skillComp = {
    build: function (p) {
      var S = D.EDU.skillComp, st = { dil: 0.7, talent: 0.5, stamina: 0.3 };
      return { title: '전국기능경기대회', icon: '🏅', desc: '열여덟. 지방대회를 통과해 전국기능경기대회 출전권을 땄습니다. 나흘 동안 과제 하나를 붙들고 0.1mm를 다툽니다. 입상하면 대기업 생산직 특별채용의 문이 열립니다.', opts: [
        O('all', '합숙 훈련에 모든 걸 건다', { desc: '입상 확률 ↑ · 건강 −, 행복 −', prob: pr(p, S.base, st, 0.8), stats: ['dil', 'talent', 'stamina'], ai: 2 }),
        O('norm', '평소 실력대로 나간다', { prob: pr(p, S.base, st), stats: ['dil', 'talent', 'stamina'], ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'all') { p.health -= 2; p.happy -= 3; }
      var rl = roll(p, o.prob), S = D.EDU.skillComp;
      if (!rl.ok) return R(false, '입상 실패', '마지막 날, 치수 하나가 공차를 벗어났습니다. 메달은 놓쳤지만 기능반에서 보낸 2년은 손에 남았습니다. 생산직 공채에서는 여전히 유리합니다.', rl);
      var pc = o.prob * 100, m = rl.roll <= Math.max(1, pc * 0.25) ? 3 : rl.roll <= pc * 0.6 ? 2 : 1, name = ['', '동메달', '은메달', '금메달'][m];
      p.fl.medal = m; p.cash += S.prize[m]; p.happy += 8; ms(p, '전국기능경기대회에서 ' + U.josa(name, '을/를') + ' 땄습니다.', false);
      return R(true, name, '시상대에 올랐습니다. 상금 ' + won(S.prize[m]) + '과 함께 대기업 인사 담당자들의 명함을 받았습니다. 학교 정문에 이름이 적힌 현수막이 걸렸습니다.', rl, 'house');
    }
  };
  DEC.examPrep = {
    build: function (p) {
      var E = D.EDU.examPrep, ac = Sim.acad(p), cm = famCan(p, E.med.cost), cc = famCan(p, E.cons.cost), z = p.fam.zeal;
      return { title: '고3 입시 전략', icon: '🎯', desc: '열여덟, 고3. 모의고사 성적은 ' + H.topPct(ac) + '. 대치동에는 의대만 보내는 입시반이 있고, 한 달 수강료가 웬만한 월급보다 많습니다. 부모님 월소득은 ' + won(p.fam.inc) + '.', opts: [
        O('med', E.med.name, { desc: '월 ' + won(E.med.cost) + ' · 의·치·한·약·수 합격 점수 +' + E.med.medBonus + ', 학업 + · 행복 −−' + strain(cm), dis: noMoney(cm), ai: cm === 2 && ac > 62 ? z / 75 : cm && ac > 68 ? 0.25 : 0.02 }),
        O('cons', E.cons.name, { desc: '월 ' + won(E.cons.cost) + ' · 수시(학생부) 점수 +' + strain(cc), dis: noMoney(cc), ai: cc === 2 ? z / 50 : 0.25 }),
        O('self', '학교 수업과 인강으로 버틴다', { desc: '비용 없음', ai: 2 })] };
    },
    resolve: function (p, w, c, key) {
      var E = D.EDU.examPrep;
      if (key === 'med') { p.fl.medPrep = 1; p.ab += E.med.ab; p.happy -= 6; if (famCan(p, E.med.cost) === 1) p.fam.harmony -= 3; famSpend(p, E.med.cost * 12); return R(null, E.med.name, '의대 전문 입시반에 들어갔습니다. 수업은 새벽 한 시에 끝나고, 옆자리 친구는 이미 두 번째 고3입니다. 여기서는 전교 1등이 평균입니다. 의·치·한·약·수 지원 때 합격 점수에 보정이 붙습니다.'); }
      if (key === 'cons') { p.fl.cons = 1; famSpend(p, E.cons.cost * 12); return R(null, E.cons.name, '컨설턴트가 학생부를 한 줄씩 뜯어 봅니다. 동아리 이름 하나, 독서 목록 하나까지 "전략"이 됩니다.'); }
      return R(null, '독학', '학교 자습실과 인터넷 강의. 질문할 사람은 없지만 버틸 줄은 알게 됐습니다.');
    }
  };

  /* ================= 연예인 ================= */
  DEC.casting = {
    build: function (p) {
      return { title: '길거리 캐스팅', icon: '🎬', desc: '하굣길에 누군가 명함을 내밉니다. "엔터테인먼트 신인개발팀입니다. 혹시 연예인에 관심 있어요?" 거울 속 얼굴이 남들 눈에도 띄는 모양입니다.', opts: [
        O('yes', '연습생 계약을 한다', { desc: '방과 후는 전부 연습실 · 학업 −, 예체능 + · 훗날 오디션에서 크게 유리', ai: 0.25 }),
        O('card', '명함만 받아 둔다', { desc: '공부를 계속합니다. 연예인 오디션은 성인이 된 뒤에도 볼 수 있습니다', ai: 1.5 }),
        O('no', '사기일지도 모른다. 지나친다', { ai: 1 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'yes') { p.fl.trainee = 1; p.ab -= 3; p.art += 6; p.happy += 2; ms(p, '기획사 연습생이 됐습니다.', false); return R(null, '연습생', '학교가 끝나면 연습실로 갑니다. 춤, 노래, 연기, 다이어트. 월말 평가에서 떨어지면 짐을 싸야 합니다.'); }
      if (key === 'card') return R(null, '보류', '명함을 필통에 넣어 두었습니다. 가끔 꺼내 보며 다른 삶을 상상합니다.');
      return R(null, '거절', '"죄송합니다." 걸음을 재촉했습니다. 그날 밤 거울을 평소보다 오래 봤습니다.');
    }
  };
  var CELEB_UP = ['', '', '얼굴이 알려지기 시작했습니다. 식당에서 사인 요청을 받았습니다.', '인기 연예인의 반열에 올랐습니다.', '톱스타가 됐습니다. 광고판마다 얼굴이 걸립니다.'];
  // 연예인의 한 해: 외모·끼·사교성·운에 따라 등급이 오르내린다(동년배 포함)
  Sim.celebYear = function (p, w, a) {
    var j = p.job, C = D.CELEB, r = p.rng, t = j.tier || 0, s = p.st;
    var sc = (s.looks - 50) * 0.02 + (s.talent + p.art - 50) * 0.01 + (s.social - 50) * 0.008 + (s.luck - 50) * 0.01 + (j.boost || 0);
    j.boost = (j.boost || 0) * 0.5;
    if (t < 4 && U.chance(r, C.up[t] * clamp(1 + sc * 1.5, 0.2, 4) * (a > 35 && t < 2 ? 0.4 : 1))) {
      j.tier = t + 1; p.happy += 5 + t * 2; p.hist.push({ a: a, t: Sim.jobTitle(p) });
      if (j.tier === 1) say(p, '데뷔했습니다. 첫 출연료는 교통비 수준이었지만, 화면에 이름이 떴습니다.', 'good'); else ms(p, CELEB_UP[j.tier], 'good');
      if (j.tier === 4) { p.fl.topStar = 1; p.fl.highPost = 1; }
    } else if (t >= 2 && U.chance(r, C.down[t])) {
      j.tier = t - 1; p.happy -= 6; p.hist.push({ a: a, t: Sim.jobTitle(p) }); say(p, '찾는 곳이 줄었습니다. 대중의 관심은 다음 얼굴에게 넘어갔습니다.', 'bad');
    } else if (t <= 1 && j.y >= 3 && j.y % 3 === 0 && a < 50) Sim.q(p, 'career', { keep: 1 });
  };
  DEC.celebRole = {
    ok: function (p) { return jobIs(p, 'celeb'); },
    build: function (p) {
      var t = p.job.tier || 0, pay = r100(D.CELEB.tiers[t][1] * 4);
      return { title: '작품 제안', icon: '🎬', desc: '소속사에서 연락이 왔습니다. 들어온 일이 셋인데 일정이 겹칩니다. 지금 위치는 "' + D.CELEB.tiers[t][0] + '". 무엇을 잡을까요?', opts: [
        O('lead', '저예산 영화의 주연', { desc: '출연료는 거의 없지만, 터지면 한 번에 올라섭니다', prob: pr(p, 0.22, { talent: 0.6, looks: 0.4 }), stats: ['talent', 'looks'], ai: 1 }),
        O('var', '예능 고정 출연', { desc: '얼굴을 알립니다 · 말실수 위험', prob: pr(p, 0.5, { social: 0.7 }), stats: ['social'], ai: 1.5 }),
        O('cf', '광고와 행사를 돈다', { desc: won(pay) + ' · 당장 돈이 되지만 이미지가 소모됩니다', ai: 1.2, amt: pay })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job, rl;
      if (key === 'cf') { p.cash += o.amt; j.boost = (j.boost || 0) - 0.15; return R(null, '행사', '지방 축제 무대와 온라인 광고를 돌았습니다. ' + won(o.amt) + '이 들어왔습니다. 통장은 든든해졌지만 "요즘 뭐 찍어요?"라는 질문에는 대답이 궁합니다.'); }
      rl = roll(p, o.prob);
      if (key === 'lead') {
        if (rl.ok && (j.tier || 0) < 4) { j.tier = (j.tier || 0) + 1; p.hist.push({ a: p.age, t: Sim.jobTitle(p) }); p.happy += 8; if (j.tier === 4) { p.fl.topStar = 1; p.fl.highPost = 1; } ms(p, '출연한 영화가 입소문을 타며 ' + U.josa(D.CELEB.tiers[j.tier][0], '으로/로') + ' 올라섰습니다.', false); Sim.rollVar(p, w); p.inc = Sim.jobInc(p, w); return R(true, '흥행', '상영관이 스무 개에서 팔백 개로 늘었습니다. 시상식 초대장이 처음 왔습니다.', rl, 'house'); }
        if (rl.ok) { j.boost = (j.boost || 0) + 0.6; return R(true, '호평', '평론가들이 연기를 다시 봤다고 썼습니다. 정상의 자리가 조금 더 단단해졌습니다.', rl); }
        p.happy -= 3; return R(false, '흥행 실패', '개봉 첫 주에 내려갔습니다. 넉 달을 쏟았지만 필모그래피에 한 줄이 남았을 뿐입니다.', rl);
      }
      if (rl.ok) { j.boost = (j.boost || 0) + 0.5; p.cash += r100(D.CELEB.tiers[j.tier || 0][1] * 2); return R(true, '예능감', '편집 없이 통으로 나간 장면이 짤로 돌았습니다. 길에서 알아보는 사람이 늘었습니다. 내년에 등급이 오를 가능성이 커졌습니다.', rl); }
      p.happy -= 4; j.boost = (j.boost || 0) - 0.2; return R(false, '말실수', '무심코 던진 한마디가 기사 제목이 됐습니다. 댓글 창을 닫고 사과문 초안을 썼습니다.', rl);
    }
  };
  DEC.celebScandal = {
    ok: function (p) { return jobIs(p, 'celeb') && (p.job.tier || 0) >= 2; },
    build: function (p) {
      return { title: '논란', icon: '📰', desc: '새벽에 매니저의 전화가 왔습니다. 과장된 기사 하나가 실시간 검색어에 올랐습니다. 소속사는 입장을 정하라고 합니다.', opts: [
        O('sorry', '빠르게 사과문을 낸다', { desc: '대개는 가라앉습니다', prob: pr(p, 0.62, { social: 0.4 }), stats: ['social'], ai: 2 }),
        O('silent', '침묵으로 버틴다', { desc: '잊히거나, 커지거나', prob: 0.42, ai: 1 }),
        O('law', '법적 대응에 나선다', { desc: won(2000) + ' · 사실무근임을 밝힙니다', prob: 0.72, dis: Sim.liquid(p) < 2000 ? '소송 비용이 없습니다' : null, ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job; if (key === 'law') Sim.pay(p, 2000);
      var rl = roll(p, o.prob);
      if (rl.ok) { p.happy -= 1; return R(true, '진화', key === 'law' ? '정정 보도가 나왔습니다. 처음 기사만큼 읽히지는 않았지만, 기록은 남았습니다.' : '며칠 뒤 다른 뉴스가 그 자리를 덮었습니다. 대중의 기억은 생각보다 짧았습니다.', rl); }
      j.tier = Math.max(1, (j.tier || 0) - 1); p.happy -= 8; p.hist.push({ a: p.age, t: Sim.jobTitle(p) }); Sim.rollVar(p, w); p.inc = Sim.jobInc(p, w);
      return R(false, '하차', '광고 계약이 줄줄이 해지됐습니다. 촬영 중이던 작품에서도 하차했습니다. 다시 올라가려면 시간이 필요합니다.', rl);
    }
  };
  var grade0 = H.grade;
  H.grade = function (p) { return clamp(grade0(p) + (jobIs(p, 'celeb') ? (p.job.tier || 0) * 0.5 : 0) + (p.fam.cls >= 6 ? 0.8 : 0), 0, 5); };

  /* ================= 직업군인: 학군장교의 장기복무 ================= */
  DEC.milCareer = {
    ok: function (p) { return !p.job; },
    build: function (p) {
      var OF = D.JOBS.officer;
      return { title: '장기복무', icon: '🎖️', desc: '학군장교 의무 복무가 끝나 갑니다. 대대장이 묻습니다. "자네, 군에 남을 생각 없나?" 장기복무에 선발되면 직업군인의 길입니다. 대위 월 ' + won(OF.ranks[1][1]) + ', 계급마다 정년이 있고, 끝까지 올라가면 별을 답니다.', opts: [
        O('long', '장기복무를 지원한다', { desc: '선발되면 직업군인 · 진급 심사와 군인연금', prob: pr(p, 0.5, { stamina: 0.4, dil: 0.4, social: 0.3 }), stats: ['stamina', 'dil', 'social'], ai: 0.5 }),
        O('out', '전역해서 사회로 나간다', { desc: '장교 경력은 취업 스펙으로 남습니다', ai: 2 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'out') return R(null, '전역', '전역 신고를 마쳤습니다. 부대 정문을 나서며 뒤를 한 번 돌아봤습니다.');
      var rl = roll(p, o.prob);
      if (!rl.ok) return R(false, '선발 탈락', '장기복무 선발 명단에 이름이 없었습니다. 군복을 벗고 이력서를 씁니다.', rl);
      Sim.setJob(p, w, 'officer', { y: 2, ry: 1 }); ms(p, '장기복무 장교로 선발돼 직업군인이 됐습니다.', false); p.happy += 5;
      return R(true, '장기복무 선발', '선발 통지를 받았습니다. 이제 군은 거쳐 가는 곳이 아니라 직장입니다. 다음 목표는 대위 계급장입니다.', rl);
    }
  };

  /* ================= 가업: 대표이사 승계, 경영 능력 증명 ================= */
  DEC.heirCeo = {
    ok: function (p) { return jobIs(p, 'heir') && !p.job.ceo; },
    build: function (p, w) {
      var j = p.job, top = p.fam.cls >= 6 ? '회장' : '대표이사', inc1 = Sim.jobInc(p, w, { k: 'heir', y: j.y, mult: j.mult, ceo: 1 }), inc2 = Sim.jobInc(p, w, { k: 'heir', y: j.y, mult: j.mult, ceo: 2 });
      var val = r100(Math.max(p.inc * 60, p.fam.assets * 0.3));
      return { title: top + ' 승계', icon: '🏢', desc: '아버지의 집무실이 비었습니다. ' + j.co + ' 임직원과 거래처가 모두 한 사람을 봅니다. 지금 직급은 ' + Sim.heirRank(p, j) + ', 입사 ' + j.y + '년 차입니다.', opts: [
        O('ceo', top + '에 취임한다', { desc: '월 ' + won(inc1) + ' · 회사의 모든 결정과 책임이 내 것이 됩니다', ai: 3 }),
        O('pro', '전문경영인을 세우고 이사회 의장으로 남는다', { desc: '월 ' + won(inc2) + ' · 일의 무게는 줄고, 회사는 남의 손에서 굴러갑니다', ai: 1 }),
        O('sell', '회사를 매각하고 내 길을 간다', { desc: won(val) + ' · 가업은 여기서 끝납니다', ai: 0.3, amt: val })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job, top = p.fam.cls >= 6 ? '회장' : '대표이사';
      if (key === 'sell') { p.cash += o.amt; p.fam.assets = Math.max(0, p.fam.assets - o.amt); p.fl.heirSold = 1; var co = j.co; Sim.leaveJob(p, w, 'exit'); ms(p, co + '를 ' + won(o.amt) + '에 매각했습니다.', false); Sim.q(p, 'career', {}); return R(null, '매각', '인수 계약서에 도장을 찍었습니다. 간판은 그대로지만 주인이 바뀌었습니다. 30년 다닌 직원들의 눈을 마주치기 어려웠습니다.', null, 'box'); }
      j.ceo = key === 'ceo' ? 1 : 2; if (key === 'pro') j.half = 1;
      p.inc = Sim.jobInc(p, w); p.fl.highPost = 1; p.fl.ceo = 1; p.hist.push({ a: p.age, t: Sim.jobTitle(p) });
      ms(p, key === 'ceo' ? '아버지의 뒤를 이어 ' + j.co + ' ' + top + '에 취임했습니다.' : j.co + ' 이사회 의장이 됐습니다.', false);
      return key === 'ceo' ? R(true, top + ' 취임', '취임식 단상에 섰습니다. 아버지가 쓰던 만년필이 책상 위에 그대로 있었습니다. 이제 결재 서류의 마지막 칸은 내 이름입니다.', null, 'house')
        : R(null, '이사회 의장', '경영은 전문가에게 맡겼습니다. 분기마다 보고를 받고, 큰 방향만 정합니다. 저녁 시간이 돌아왔습니다.');
    }
  };
  DEC.heirProve = {
    ok: function (p) { return jobIs(p, 'heir'); },
    build: function (p) {
      return { title: '경영 수업', icon: '📊', desc: p.job.co + ' 임원 회의. 안건은 내가 낸 신사업 제안입니다. 오래된 임원들은 팔짱을 끼고 있습니다. "젊은 사람이 현장을 몰라서…"라는 말이 들리는 듯합니다.', opts: [
        O('new', '신사업을 밀어붙인다', { desc: '성공하면 소득 +25%, 사내 평판 ++ · 실패하면 손실과 뒷말', prob: pr(p, 0.4, { iq: 0.5, social: 0.3, dil: 0.2 }), stats: ['iq', 'social', 'dil'], ai: 0.8 + H.risk(p) }),
        O('field', '한 달간 현장부터 돈다', { desc: '사내 평판 + · 건강 −', ai: 1.5 }),
        O('safe', '아버지가 하던 방식대로 간다', { desc: '무난합니다', ai: 1.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      var j = p.job, t = j.team;
      if (key === 'safe') return R(null, '안정', '안건을 철회했습니다. 회사는 작년과 같은 속도로 굴러갑니다.');
      if (key === 'field') { if (t) t.rel = clamp(t.rel + 9, 0, 100); p.health -= 0.6; return R(null, '현장', '작업복을 입고 공장과 물류센터를 돌았습니다. 구내식당에서 같이 밥을 먹으니 직원들의 말투가 조금 달라졌습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { j.mult *= 1.25; p.fl.heirM = j.mult; if (t) t.rel = clamp(t.rel + 12, 0, 100); p.inc = Sim.jobInc(p, w); p.happy += 5; return R(true, '신사업 성공', '첫 분기부터 숫자가 나왔습니다. 팔짱을 끼던 임원들이 먼저 보고하러 옵니다. 월 ' + won(p.inc) + '.', rl); }
      j.mult *= 0.93; p.fl.heirM = j.mult; if (t) t.rel = clamp(t.rel - 8, 0, 100); p.inc = Sim.jobInc(p, w); p.happy -= 4;
      return R(false, '신사업 실패', '1년 만에 사업을 접었습니다. "그럴 줄 알았다"는 말을 아무도 하지 않았지만 모두의 얼굴에 적혀 있었습니다.', rl);
    }
  };

  /* ================= 직장 인간관계: 상사·동기·후배 ================= */
  // rel 상사와의 관계(0~100), net 사내 평판·인맥, line 줄서기(1 성공, -1 몰락). 승진(H.teamBonus)과 연말 고과에 반영된다.
  var BT = [{ n: '숫자로만 말하는 성과주의자', like: 'perf' }, { n: '의전과 술자리를 챙기는 옛날 사람', like: 'flat' }, { n: '칼퇴근을 지키는 합리주의자', like: 'fair' }, { n: '사내 정치에 밝은 야심가', like: 'pol' }];
  function hasTeam(p) { var j = p.job; if (!j) return false; var t = D.JOBS[j.k].type; return t === 'corp' || t === 'steady'; }
  function team(p) { return hasTeam(p) ? p.job.team : null; }
  function bossT(p) { var k = p.job.k, J = D.JOBS[k]; return J.mil || k === 'nco' ? '지휘관' : k === 'heir' ? '부사장' : k === 'teacher' ? '교감' : k === 'prof' ? '학과장' : J.pen === 'civil' ? '과장' : '팀장'; }
  function rnName(r) { return Sim.makeName(r, U.chance(r, 0.6) ? 'M' : 'F'); }
  Sim.teamCheck = function (g) {
    var p = g.p, j = p.job, r = p.rng; if (!hasTeam(p)) return;
    var t = j.team;
    if (!t) {
      t = j.team = { boss: rnName(r), bt: U.rint(r, 0, 3), rel: Math.round(clamp(46 + U.norm(r) * 8 + (p.st.social - 50) * 0.2, 15, 85)), net: 50, peer: rnName(r), since: p.age };
      if (j.k === 'heir') { t.rel = Math.round(clamp(t.rel - 10, 10, 80)); p.cur.push({ t: '회사 살림은 ' + t.boss + ' 부사장이 쥐고 있습니다. ' + BT[t.bt].n + '입니다. 후계자를 보는 눈이 곱지만은 않습니다.', c: 'news' }); }
      else p.cur.push({ t: '새 자리에 배치됐습니다. ' + bossT(p) + ' ' + U.josa(t.boss, '은/는') + ' ' + BT[t.bt].n + '입니다. 동기 ' + t.peer + '도 같은 층에 있습니다.', c: 'news' });
      return;
    }
    if (g.mon === 1 && p.age - t.since >= 3 && U.chance(r, 0.35)) {
      var old = t.boss; t.boss = rnName(r); t.bt = U.rint(r, 0, 3); t.rel = Math.round(50 + (t.rel - 50) * 0.3); t.since = p.age; if (t.line === -1) t.line = 0;
      p.cur.push({ t: '인사 발령. ' + old + ' ' + bossT(p) + '이 자리를 옮기고 ' + U.josa(t.boss, '이/가') + ' 새로 왔습니다. ' + BT[t.bt].n + '입니다. 관계는 다시 처음부터입니다.', c: 'news' });
    } else if (!t.jr && j.y >= 3 && g.mon === 3 && j.k !== 'heir') {
      t.jr = rnName(r); p.cur.push({ t: '후배 ' + U.josa(t.jr, '이/가') + ' 들어왔습니다. 어느새 누군가의 사수가 됐습니다.', c: 'news' });
    }
  };
  A('boss', 1, '🍶', '상사에게 잘 보이기', { cd: 'q', show: function (p) { return !!team(p); },
    desc: function (p) { var t = p.job.team; return bossT(p) + ' ' + t.boss + ' · 관계 "' + H.relWord(t.rel) + '" · 승진과 고과에 반영됩니다'; }, run: function (p) { return toDec(p, 'flatter'); } });
  A('mate', 1, '🍺', '동기·후배와 한잔', { cost: 15, cd: 'q', show: function (p) { return !!team(p); }, desc: '사내 평판과 인맥이 쌓입니다 · 승진에 조금 도움',
    run: function (p, g, rl, dim) { var t = p.job.team; t.net = clamp((t.net || 50) + 6 * dim, 0, 100); p.happy += dim; p.health -= 0.1; return R(null, '한잔', '동기 ' + U.josa(t.peer, '과/와') + (t.jr ? ' 후배 ' + t.jr + '까지 불러' : '') + ' 회사 앞 포차에 앉았습니다. 누가 어디로 가고 누가 누구 라인인지, 공식 문서에는 없는 정보를 들었습니다.'); } });
  DEC.flatter = {
    ok: function (p) { return !!team(p); },
    build: function (p) {
      var t = p.job.team, B = BT[t.bt], bt = bossT(p);
      return { title: '상사에게 잘 보이기', icon: '🍶', desc: bt + ' ' + U.josa(t.boss, '은/는') + ' ' + B.n + '입니다. 지금 관계는 "' + H.relWord(t.rel) + '"(' + Math.round(t.rel) + '/100). 상사의 성향에 맞는 방법일수록 효과가 큽니다. 관계가 좋으면 승진 확률과 연말 고과가 올라갑니다.', opts: [
        O('golf', '주말 골프·등산에 따라나선다', { desc: won(30) + ' · 주말 반납 · 행복 −', ai: 1 }),
        O('drink', '회식 자리를 끝까지 지킨다', { desc: '건강 −', ai: 1.5 }),
        O('gift', '명절 선물과 경조사를 챙긴다', { desc: won(20), ai: 1 }),
        O('credit', '내 성과를 상사의 공으로 돌린다', { desc: '관계 ++ · 올해 고과에는 손해', ai: 0.8 }),
        O('work', '아부 대신 보고서로 말한다', { desc: '성공하면 관계 +, 성과 +', prob: pr(p, 0.5, { dil: 0.5, iq: 0.4 }), stats: ['dil', 'iq'], ai: 1.5 })] };
    },
    resolve: function (p, w, c, key, o) {
      var t = p.job.team, like = BT[t.bt].like, d = 0, txt = '', rl = null;
      if (key === 'golf') { Sim.pay(p, 30); d = like === 'flat' || like === 'pol' ? 11 : like === 'fair' ? 2 : 6; p.happy -= 1.5; if (p.spouse) p.mq = clamp(p.mq - 2, 0, 100); txt = like === 'fair' ? '"주말엔 좀 쉬지 그래." 따라나선 게 오히려 머쓱했습니다.' : '새벽 다섯 시에 집을 나섰습니다. 공이 숲으로 들어갈 때마다 "나이스 샷"을 외쳤습니다.'; }
      else if (key === 'drink') { d = like === 'flat' ? 9 : like === 'fair' ? 0 : 5; p.health -= 0.6; txt = like === 'fair' ? '상사는 1차만 하고 먼저 일어났습니다. 남은 사람끼리 3차까지 갔습니다.' : '3차 노래방에서 탬버린을 흔들었습니다. 다음 날 상사가 먼저 해장국을 사 줬습니다.'; }
      else if (key === 'gift') { Sim.pay(p, 20); d = like === 'fair' ? -3 : like === 'flat' ? 7 : 4; txt = like === 'fair' ? '"이런 건 받기 곤란해요." 선물은 그대로 돌아왔습니다.' : '한우 세트에 손편지를 얹었습니다. "뭘 이런 걸 다"라는 말은 싫지 않은 목소리였습니다.'; }
      else if (key === 'credit') { d = like === 'pol' ? 12 : 8; p.fl.perf = (p.fl.perf || 0) - 1; txt = '보고서 첫 장에서 내 이름을 뺐습니다. 임원 회의에서 상사가 칭찬을 받았고, 돌아오는 길에 어깨를 두드려 줬습니다.'; }
      else { rl = roll(p, o.prob); if (rl.ok) { d = like === 'perf' ? 10 : like === 'fair' ? 7 : 3; p.fl.perf = (p.fl.perf || 0) + 1; txt = '숫자와 근거로 채운 보고서가 그대로 위로 올라갔습니다. "이건 누가 했나?"라는 질문에 내 이름이 불렸습니다.'; } else { d = like === 'perf' ? -3 : 0; txt = '밤을 새워 만든 보고서는 "방향이 다르다"는 한마디로 돌아왔습니다.'; } }
      t.rel = clamp(t.rel + d, 0, 100);
      return R(rl ? rl.ok : d >= 6 ? true : d < 0 ? false : null, '관계 ' + sgn(d), txt + ' (관계 ' + Math.round(t.rel) + '/100 · ' + H.relWord(t.rel) + ')', rl);
    }
  };
  DEC.offDinner = {
    ok: function (p) { return !!team(p); },
    build: function (p) {
      var t = p.job.team;
      return { title: '회식', icon: '🍻', desc: '금요일 저녁, ' + bossT(p) + ' ' + U.josa(t.boss, '이/가') + ' 말합니다. "오늘 다들 약속 없지?" 약속은 있었습니다.', opts: [
        O('all', '2차까지 따라간다', { desc: '관계 + · 건강 −', ai: 1.5 }),
        O('one', '1차만 하고 일어난다', { ai: 2 }),
        O('skip', '선약이 있다고 빠진다', { desc: '행복 + · 상사에 따라 관계 −', ai: 0.8 }),
        O('mute', '"저는 회식 안 갑니다"라고 선언한다', { desc: '회식이 다시는 선택지로 뜨지 않습니다 · 관계 −', ai: 0.1 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'mute') { H.mute(p, 'offDinner'); p.job.team.rel = clamp(p.job.team.rel - 5, 0, 100); p.happy += 2; return R(null, '선언', '"저는 저녁엔 개인 일정이 있습니다. 앞으로도요." 잠깐 정적이 흘렀습니다. 그 뒤로 회식 공지에서 내 이름은 빠졌습니다. (관계 −5)'); }
      var t = p.job.team, fair = BT[t.bt].like === 'fair', d = key === 'all' ? (fair ? 2 : 5) : key === 'skip' ? (fair ? 0 : -4) : 1;
      if (key === 'all') p.health -= 0.5; if (key === 'skip') p.happy += 1.5;
      t.rel = clamp(t.rel + d, 0, 100); t.net = clamp((t.net || 50) + (key === 'skip' ? -1 : 2), 0, 100);
      return R(null, '회식', (key === 'all' ? '막차가 끊긴 뒤 택시를 탔습니다. 영수증은 회사가, 숙취는 내가 가져갑니다.' : key === 'one' ? '고기 3인분쯤에서 조용히 일어났습니다. 아무도 붙잡지 않았습니다.' : fair ? '"그래, 약속 있으면 가야지." 진심인 것 같았습니다.' : '"요즘 친구들은 다 그렇지 뭐." 월요일 아침 인사가 조금 짧았습니다.') + ' (관계 ' + sgn(d) + ')');
    }
  };
  DEC.offOrder = {
    ok: function (p) { return !!team(p); },
    build: function (p) {
      var t = p.job.team;
      return { title: '무리한 지시', icon: '😮‍💨', desc: bossT(p) + ' ' + U.josa(t.boss, '이/가') + ' 퇴근 10분 전에 부릅니다. "이거 월요일 아침까지 되지? 아, 그리고 토요일에 우리 애 이삿짐 좀…" 업무와 사적인 부탁이 한 문장에 들어 있습니다.', opts: [
        O('yes', '웃으며 다 받는다', { desc: '관계 ++ · 주말이 사라집니다', ai: 1.5 }),
        O('half', '업무만 하고, 사적인 부탁은 정중히 거절한다', { desc: '잘 말하면 선을 지키고도 관계를 지킵니다', prob: pr(p, 0.55, { social: 0.6 }), stats: ['social'], ai: 2 }),
        O('hr', '인사팀에 알린다', { desc: '성공하면 상사가 바뀝니다 · 실패하면 관계가 무너집니다', prob: 0.4, ai: 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      var t = p.job.team, rl;
      if (key === 'yes') { t.rel = clamp(t.rel + 8, 0, 100); p.happy -= 3; p.health -= 0.4; if (p.spouse) p.mq = clamp(p.mq - 2, 0, 100); return R(null, '수락', '토요일에 남의 집 냉장고를 날랐습니다. 짜장면 한 그릇을 얻어먹었습니다. (관계 +8)'); }
      rl = roll(p, o.prob);
      if (key === 'half') { if (rl.ok) { t.rel = clamp(t.rel + 2, 0, 100); p.happy += 1; return R(true, '선 긋기', '"주말엔 집안일이 있어서요. 보고서는 월요일 아침에 올려 두겠습니다." 상사는 잠깐 멈칫했지만 고개를 끄덕였습니다.', rl); } t.rel = clamp(t.rel - 8, 0, 100); return R(false, '찍힘', '"요즘 사람들 참…" 그 뒤로 회의에서 내 의견을 묻지 않습니다. (관계 −8)', rl); }
      if (rl.ok) { var old = t.boss; t.boss = rnName(p.rng); t.bt = U.rint(p.rng, 0, 3); t.rel = 50; t.since = p.age; t.net = clamp((t.net || 50) + 5, 0, 100); return R(true, '조치', '인사팀 조사 끝에 ' + old + ' ' + bossT(p) + '은 다른 부서로 갔습니다. 새로 온 ' + U.josa(t.boss, '은/는') + ' ' + BT[t.bt].n + '입니다.', rl); }
      t.rel = clamp(t.rel - 15, 0, 100); p.happy -= 4; return R(false, '역풍', '"오해가 있었던 것 같다"는 결론이 났습니다. 신고한 사람이 누구인지는 모두가 압니다. (관계 −15)', rl);
    }
  };
  DEC.offCredit = {
    ok: function (p) { return !!team(p); },
    build: function (p) {
      var t = p.job.team;
      return { title: '가로채인 공', icon: '🗂️', desc: '석 달을 매달린 프로젝트의 발표 자리. 동기 ' + U.josa(t.peer, '이/가') + ' 내 장표를 그대로 띄우고 말합니다. "제가 기획한 내용입니다."', opts: [
        O('fix', '회의에서 바로잡는다', { desc: '성공하면 성과 인정 · 실패하면 분위기만 얼어붙습니다', prob: pr(p, 0.5, { social: 0.5, iq: 0.3 }), stats: ['social', 'iq'], ai: 1.5 }),
        O('boss', '끝나고 상사에게 따로 말한다', { desc: '상사와의 관계에 달렸습니다', prob: clamp(0.25 + t.rel / 140, 0.1, 0.9), ai: 1.5 }),
        O('pass', '이번엔 넘어간다', { desc: '행복 −', ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var t = p.job.team;
      if (key === 'pass') { p.happy -= 3; t.net = clamp((t.net || 50) + 2, 0, 100); return R(null, '침묵', '박수 소리를 들으며 노트북을 덮었습니다. 다음부터는 파일에 내 이름을 크게 적기로 했습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { p.fl.perf = (p.fl.perf || 0) + 2; p.happy += 2; return R(true, '바로잡음', key === 'fix' ? '"그 부분은 제가 설명드리겠습니다." 질문이 쏟아졌고, 대답할 수 있는 사람은 나뿐이었습니다. 올해 고과에 반영됩니다.' : '상사는 이미 알고 있었습니다. "누가 한 건지는 내가 봤어." 올해 고과에 반영됩니다.', rl); }
      if (key === 'fix') { t.rel = clamp(t.rel - 5, 0, 100); t.net = clamp((t.net || 50) - 5, 0, 100); return R(false, '싸늘', '목소리가 떨렸고, 회의실이 조용해졌습니다. "그런 건 나중에 둘이 얘기하지." 옳았지만 이기지는 못했습니다.', rl); }
      p.happy -= 2; return R(false, '흐지부지', '"팀이 한 거지, 누가 한 게 어디 있나." 이야기는 거기서 끝났습니다.', rl);
    }
  };
  DEC.offJunior = {
    ok: function (p) { var t = team(p); return !!t && !!t.jr; },
    build: function (p) {
      var t = p.job.team;
      return { title: '후배의 실수', icon: '🧯', desc: '후배 ' + U.josa(t.jr, '이/가') + ' 하얗게 질려 찾아왔습니다. 거래처에 잘못된 견적서가 나갔습니다. 아직 위에서는 모릅니다.', opts: [
        O('cover', '내 책임이라고 보고한다', { desc: '사내 평판 ++ · 올해 고과에는 손해', ai: 1 }),
        O('fix', '둘이 밤새 수습한다', { desc: '성공하면 평판 +, 성과 + · 건강 −', prob: pr(p, 0.55, { dil: 0.6, iq: 0.3 }), stats: ['dil', 'iq'], ai: 2 }),
        O('report', '있는 그대로 보고한다', { desc: '원칙대로 · 후배와는 서먹해집니다', ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var t = p.job.team;
      if (key === 'cover') { t.net = clamp((t.net || 50) + 10, 0, 100); p.fl.perf = (p.fl.perf || 0) - 1; return R(null, '방패', '"검토를 제가 놓쳤습니다." 한참 깨졌습니다. 그날 이후 ' + U.josa(t.jr, '은/는') + ' 내 일이라면 먼저 손을 듭니다. (사내 평판 +10)'); }
      if (key === 'report') { t.net = clamp((t.net || 50) - 6, 0, 100); t.rel = clamp(t.rel + 2, 0, 100); return R(null, '원칙', '경위서는 후배가 썼습니다. 틀린 일은 아니었지만, 점심을 같이 먹자는 말이 줄었습니다. (사내 평판 −6)'); }
      var rl = roll(p, o.prob); p.health -= 0.5;
      if (rl.ok) { t.net = clamp((t.net || 50) + 6, 0, 100); p.fl.perf = (p.fl.perf || 0) + 1; return R(true, '수습', '새벽 네 시에 정정 견적서를 보냈습니다. 거래처는 아침에 "꼼꼼하시네요"라고 답했습니다. 위에서는 끝내 몰랐습니다.', rl); }
      t.rel = clamp(t.rel - 4, 0, 100); return R(false, '들통', '수습하기 전에 거래처 전화가 먼저 위로 올라갔습니다. "왜 바로 보고 안 했나." 둘이 나란히 깨졌습니다.', rl);
    }
  };
  DEC.offLine = {
    ok: function (p) { return !!team(p); },
    build: function (p) {
      return { title: '줄서기', icon: '🪜', desc: '회사에 두 임원의 줄이 있다는 건 다들 아는 비밀입니다. 한쪽에서 저녁 자리에 부릅니다. "자네 같은 사람이 필요해." 받으면 그 줄에 서는 것입니다.', opts: [
        O('in', '줄을 선다', { desc: '그 임원이 살아남으면 승진에 날개 · 밀려나면 함께 한직으로', prob: 0.5, ai: 0.6 + H.risk(p) }),
        O('no', '어느 줄에도 서지 않는다', { desc: '느리지만 안전합니다', ai: 2 })] };
    },
    resolve: function (p, w, c, key, o) {
      var t = p.job.team;
      if (key === 'no') { t.net = clamp((t.net || 50) + 3, 0, 100); return R(null, '중립', '"저는 일만 하겠습니다." 양쪽 모두에게 애매한 사람이 됐지만, 누구의 적도 아닙니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { t.line = 1; return R(true, '동아줄', '연말 인사에서 줄을 선 임원이 부사장이 됐습니다. 엘리베이터에서 마주치면 이름을 불러 줍니다. 다음 승진 심사에 힘이 실립니다.', rl); }
      t.line = -1; p.happy -= 3; return R(false, '썩은 동아줄', '줄을 선 임원이 연말 인사에서 물러났습니다. 그 줄에 섰던 사람들의 자리가 하나둘 창가로 옮겨집니다. 당분간 승진이 어렵습니다.', rl);
    }
  };

  /* ================= 연애: 캠퍼스 커플, 데이트, 연인 사이의 일 ================= */
  var LIKES = ['food', 'trip', 'home', 'gift'];
  function lv(pt) { if (pt.aff == null) pt.aff = 55; if (!pt.like) pt.like = LIKES[U.hash(pt.name + 'like') % LIKES.length]; return pt; }
  function addAff(pt, d) { lv(pt).aff = clamp(pt.aff + d, 0, 100); return ' (호감도 ♥' + Math.round(pt.aff) + ')'; }
  function ptJob(inc) { return inc <= 0 ? '취업 준비생' : inc < 230 ? '계약직' : inc < 330 ? '중소기업 직원' : inc < 480 ? '회사원' : inc < 700 ? '대기업 직원' : '전문직'; }
  var CC_S = {
    cc: { name: 'CC의 기회', bias: 0, sd: 0.6, chem: 64, base: 0.5, student: 1, go: '고백한다', okText: 'CC(캠퍼스 커플)가 됐습니다. 과 단톡방에 소문이 도는 데는 반나절이 걸리지 않았습니다. 시간표를 서로 맞추기 시작합니다.' },
    fest: { name: '축제의 밤', bias: 0, sd: 0.9, chem: 58, base: 0.45, student: 1, go: '번호를 물어본다', okText: '축제가 끝나고도 연락이 이어졌습니다. 다른 과 건물 앞에서 기다리는 일이 생겼습니다.' },
    mt: { name: '미팅', bias: 0, sd: 0.9, chem: 50, base: 0.42, student: 1, go: '애프터를 신청한다', okText: '미팅에서 만나 사귀는 건 드문 일이라고들 했습니다. 드문 일이 일어났습니다.' }
  };
  A('meeting', 0, '🎓', '미팅·과팅', { cost: 5, cd: 'q', show: function (p) { return p.occ === 'univ' && single(p); }, desc: '대학생 때만 할 수 있습니다 · 캠퍼스 커플의 기회', run: function (p) { Q.meet(p, 'mt', CC_S.mt); return null; } });
  var DATES = {
    food: ['맛집 탐방', 30, '줄 서는 맛집에서 한 시간을 기다렸습니다. 기다리는 동안 나눈 이야기가 음식보다 오래 남았습니다.'],
    trip: ['근교 여행', 80, '기차를 타고 바다를 보러 갔습니다. 돌아오는 길, 어깨에 기대 잠든 얼굴을 한참 봤습니다.'],
    home: ['집에서 영화와 배달 음식', 5, '영화는 반쯤 보다 말았습니다. 식은 떡볶이를 나눠 먹으며 새벽까지 이야기했습니다.'],
    gift: ['깜짝 선물', 50, '지나가며 예쁘다고 했던 것을 기억해 뒀다가 건넸습니다. 포장지를 뜯는 손이 조심스러웠습니다.']
  };
  DEC.dateHow = {
    ok: function (p) { return !!p.partner; },
    build: function (p) {
      var pt = lv(p.partner), opts = Object.keys(DATES).map(function (k) { var X = DATES[k], hit = pt.known && pt.like === k; return O(k, X[0] + (hit ? ' ♥' : ''), { desc: won(X[1]) + (hit ? ' · ' + U.josa(pt.name, '이/가') + ' 가장 좋아하는 데이트입니다' : ''), ai: 1 }); });
      opts.push(O('talk', '우리의 미래를 이야기한다', { desc: '만난 지 1년이 넘었다면 사이가 깊어집니다', ai: 0.6 }));
      return { title: '데이트', icon: '🎡', face: pt.face, desc: U.josa(pt.name, '과/와') + (pt.yrs ? ' 만난 지 ' + pt.yrs + '년' : ' 만나기 시작한 지 얼마 안 됐습니다') + '. 호감도 ♥' + Math.round(pt.aff) + '/100. ' + (pt.known ? '호감도가 높을수록 헤어질 일이 줄고, 프로포즈가 잘 받아들여집니다.' : '상대가 어떤 데이트를 가장 좋아하는지는 아직 모릅니다. 맞히면 호감이 크게 오릅니다.'), opts: opts };
    },
    resolve: function (p, w, c, key) {
      var pt = lv(p.partner), d, txt; pt.bond = Math.min(4, (pt.bond || 0) + 1); p.happy += 1.5;
      if (key === 'talk') { d = pt.yrs >= 1 ? 7 : -2; txt = pt.yrs >= 1 ? '어디서 살고 싶은지, 아이는 몇을 원하는지. 처음으로 "우리"를 주어로 긴 이야기를 했습니다.' : '"우리 나중에…"로 시작한 말에 상대가 웃으며 화제를 돌렸습니다. 아직은 이른 이야기였습니다.'; }
      else { var X = DATES[key]; Sim.pay(p, X[1]); if (pt.like === key) { d = 11; txt = X[2] + (pt.known ? '' : ' ' + pt.name + '의 눈이 유난히 반짝였습니다. 이런 데이트를 가장 좋아한다는 걸 알았습니다.'); pt.known = 1; } else { d = 4; txt = X[2]; } }
      return R(d >= 7 ? true : null, '데이트', txt + addAff(pt, d));
    }
  };
  DEC.lvAnniv = {
    ok: function (p) { return !!p.partner; },
    build: function (p) {
      var pt = lv(p.partner);
      return { title: '기념일', icon: '🎂', face: pt.face, desc: U.josa(pt.name, '과/와') + ' 만난 지 ' + pt.yrs + '주년이 이번 주입니다. 달력에는 표시해 뒀지만 준비한 건 아직 없습니다.', opts: [
        O('rest', '근사한 레스토랑을 예약한다', { desc: won(40), ai: 2 }),
        O('letter', '손편지와 직접 만든 선물', { desc: '진심이 닿으면 크게 오릅니다', prob: pr(p, 0.6, { social: 0.4, talent: 0.2 }), stats: ['social', 'talent'], ai: 1.5 }),
        O('skip', '바빠서 그냥 넘어간다', { desc: '호감도 −−', ai: 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      var pt = lv(p.partner);
      if (key === 'skip') { p.happy -= 2; return R(false, '서운함', '"괜찮아, 바쁜 거 알아." 괜찮지 않은 목소리였습니다.' + addAff(pt, -10)); }
      if (key === 'rest') { Sim.pay(p, 40); p.happy += 2; return R(null, '기념일', '창가 자리, 코스 요리, 초 하나 꽂힌 디저트. 뻔하지만 뻔해서 좋은 저녁이었습니다.' + addAff(pt, 7)); }
      var rl = roll(p, o.prob); p.happy += 2;
      return rl.ok ? R(true, '감동', '편지를 읽던 ' + U.josa(pt.name, '이/가') + ' 말없이 한참 고개를 숙이고 있었습니다.' + addAff(pt, 12), rl) : R(false, '어색', '삐뚤빼뚤한 글씨와 덜 마른 풀 자국. 웃어 주긴 했습니다.' + addAff(pt, 2), rl);
    }
  };
  DEC.lvFight = {
    ok: function (p) { return !!p.partner; },
    build: function (p) {
      var pt = lv(p.partner);
      return { title: '다툼', icon: '⚡', face: pt.face, desc: '사소한 일이었습니다. 답장이 늦었다는 얘기에서 시작해, 어느새 석 달 전 일까지 나왔습니다. 전화는 끊겼고 메시지 창에는 "…"만 떴다 사라집니다.', opts: [
        O('sorry', '먼저 사과한다', { desc: '자존심은 상해도 사이는 지킵니다', ai: 2 }),
        O('explain', '내 입장을 차분히 설명한다', { desc: '통하면 더 단단해지고, 아니면 더 커집니다', prob: pr(p, 0.5, { social: 0.6 }), stats: ['social'], ai: 1.5 }),
        O('cold', '연락을 끊고 시간을 갖는다', { desc: '호감도 − · 사이가 나쁘면 그대로 끝날 수도 있습니다', ai: 0.6 })] };
    },
    resolve: function (p, w, c, key, o) {
      var pt = lv(p.partner);
      if (key === 'sorry') { p.happy -= 1; return R(null, '화해', '"내가 미안해." 그 한마디에 두 시간짜리 통화가 이어졌습니다. 끝에는 둘 다 웃고 있었습니다.' + addAff(pt, 5)); }
      if (key === 'cold') {
        addAff(pt, -7);
        if (pt.aff < 28) { p.partner = null; p.happy -= 7; return R(false, '이별', '일주일 뒤 온 메시지는 짧았습니다. "우리 그만하자." 답장을 쓰다 지우기를 반복했습니다.'); }
        return R(null, '냉전', '사흘 뒤 아무 일 없었다는 듯 연락이 왔습니다. 아무 일 없었던 것은 아니었습니다. (호감도 ♥' + Math.round(pt.aff) + ')');
      }
      var rl = roll(p, o.prob);
      return rl.ok ? R(true, '이해', '끝까지 듣고, 끝까지 말했습니다. 싸우기 전보다 서로를 조금 더 알게 됐습니다.' + addAff(pt, 7), rl) : R(false, '확전', '"지금 그게 중요해?" 설명은 변명으로 들렸습니다.' + addAff(pt, -8), rl);
    }
  };
  DEC.lvMeet = {
    ok: function (p) { return !!p.partner && !p.partner.metFam; },
    build: function (p) {
      var pt = lv(p.partner), ex = (p.job ? 0.4 : -0.6) + (H.grade(p) - 2) * 0.3;
      return { title: '상대 부모님께 인사', icon: '🙇', face: pt.face, desc: U.josa(pt.name, '이/가') + ' 말합니다. "이번 주말에 우리 집에 올래? 부모님이 한번 보고 싶대." 손바닥에 땀이 납니다.', opts: [
        O('go', '정장을 꺼내 입고 찾아뵙는다', { desc: won(20) + '(과일 바구니) · 잘 보이면 결혼 승낙이 쉬워집니다', prob: pr(p, 0.6, { social: 0.5, looks: 0.2 }, ex), stats: ['social', 'looks'], ai: 2 }),
        O('later', '아직은 이르다고 한다', { desc: '호감도 −', ai: 0.8 })] };
    },
    resolve: function (p, w, c, key, o) {
      var pt = lv(p.partner);
      if (key === 'later') return R(null, '다음에', '"조금만 더 준비되면." 상대는 알겠다고 했지만 한동안 그 얘기를 다시 꺼내지 않았습니다.' + addAff(pt, -4));
      Sim.pay(p, 20); var rl = roll(p, o.prob);
      if (rl.ok) { pt.metFam = 1; return R(true, '합격점', '직장, 고향, 부모님 하시는 일. 면접 같은 저녁이었지만 마지막에 반찬을 싸 주셨습니다. 결혼 이야기를 꺼낼 때 큰 힘이 됩니다.' + addAff(pt, 8), rl); }
      return R(false, '어색한 저녁', '젓가락 소리만 들리는 식탁이었습니다. 돌아오는 길에 ' + U.josa(pt.name, '이/가') + ' 대신 미안하다고 했습니다.' + addAff(pt, -3), rl);
    }
  };
  DEC.lvBusy = {
    ok: function (p) { return !!p.partner; },
    build: function (p) {
      var pt = lv(p.partner);
      return { title: '바쁜 계절', icon: '📵', face: pt.face, desc: '일이 몰렸습니다. 약속을 두 번 미뤘고, 통화는 "나 지금 들어가 봐야 해"로 끝납니다. ' + U.josa(pt.name, '이/가') + ' 묻습니다. "우리 요즘 만나긴 하는 거야?"', opts: [
        O('go', '무리해서라도 시간을 낸다', { desc: '일에는 손해 · 건강 −', ai: 2 }),
        O('call', '매일 밤 통화로 대신한다', { desc: '호감도 −', ai: 1.5 }),
        O('work', '이해해 달라고 한다', { desc: '성과 + · 호감도 −−', ai: 0.6 })] };
    },
    resolve: function (p, w, c, key) {
      var pt = lv(p.partner);
      if (key === 'go') { p.health -= 0.4; p.fl.perf = (p.fl.perf || 0) - 0.5; return R(true, '시간', '밤 열한 시에 집 앞으로 찾아갔습니다. 편의점 앞 의자에서 삼십 분. 그 삼십 분이 한 달을 버티게 했습니다.' + addAff(pt, 6)); }
      if (key === 'call') return R(null, '통화', '졸린 목소리로 하루를 주고받습니다. 화면 속 얼굴은 가깝고도 멉니다.' + addAff(pt, -2));
      p.fl.perf = (p.fl.perf || 0) + 1; return R(null, '일', '"이번 일만 끝나면." 그 말을 지난번에도 했다는 걸 둘 다 압니다.' + addAff(pt, -8));
    }
  };

  /* ================= 결혼정보회사: 상향혼·동급·하향혼과 중시 조건을 고르고, 프로필 세 장 중에서 고른다 ================= */
  function agOk(p) { return single(p) && !!p.fl.ag; }
  function stars(v) { var n = v >= 85 ? 5 : v >= 70 ? 4 : v >= 50 ? 3 : v >= 30 ? 2 : 1; return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function gL(g) { return g >= 4 ? 'S' : g >= 3 ? 'A' : g >= 2 ? 'B' : g >= 1 ? 'C' : 'D'; }
  DEC.agPref = {
    ok: function (p) { return agOk(p) && p.fl.ag.left > 0; },
    build: function (p) {
      var ag = p.fl.ag, A0 = D.DATE.agency[ag.tier];
      return { title: '희망 조건', icon: '📋', desc: A0.name + ' 회원 · 남은 매칭 ' + ag.left + '회. 매니저가 묻습니다. "어느 정도 조건의 분을 찾으세요?" 내 등급은 ' + gL(H.grade(p)) + '입니다. 눈을 높이면 상대의 조건은 좋아지지만, 상대가 나를 고를 확률은 내려갑니다.', opts: [
        O('up', '상향혼 — 나보다 조건이 좋은 상대', { desc: '상대 등급 ↑↑ · 성사 확률 ↓', ai: 1 }),
        O('eq', '비슷한 조건의 상대', { desc: '무난합니다', ai: 2 }),
        O('down', '하향혼 — 조건을 낮춰서 본다', { desc: '상대 등급 ↓ · 성사 확률 ↑ · 나를 더 아껴 줍니다', ai: 0.6 }),
        O('no', '이번 달은 미룬다', { desc: '횟수는 그대로 남습니다', ai: 0.2 })] };
    },
    resolve: function (p, w, c, key) {
      if (key === 'no') return R(null, '보류', '"천천히 생각해 보세요." 매니저의 미소는 변함이 없습니다.');
      p.fl.ag.dir = key; Sim.qFront(p, 'agFocus', {}); return quiet();
    }
  };
  DEC.agFocus = {
    ok: function (p) { return agOk(p) && !!p.fl.ag.dir && p.fl.ag.left > 0; },
    build: function () {
      return { title: '가장 보는 것', icon: '🔎', desc: '"한 가지만 고르신다면요?" 매니저의 펜이 체크리스트 위에 멈춰 있습니다. 하나를 얻으면 다른 것은 평범해집니다.', opts: [
        O('looks', '외모', { desc: '눈에 띄는 외모 · 다른 조건은 조금 내려갑니다', ai: 1 }),
        O('money', '경제력', { desc: '직업과 연봉이 좋은 상대', ai: 1.5 }),
        O('fam', '집안', { desc: '부모의 재력과 배경 · 결혼 때 양가 지원이 달라집니다', ai: 0.8 }),
        O('chem', '성격과 대화', { desc: '궁합이 좋은 상대 · 결혼 생활이 순탄합니다', ai: 2 }),
        O('young', '나이', { desc: '나보다 어린 상대', ai: 0.6 })] };
    },
    resolve: function (p, w, c, key) {
      var ag = p.fl.ag, A0 = D.DATE.agency[ag.tier], S = { name: '결혼정보회사 매칭', bias: A0.bias + { up: 1, eq: 0, down: -1 }[ag.dir], sd: 0.4, chem: ag.dir === 'down' ? 60 : ag.dir === 'up' ? 44 : 52, base: 0.6, yrs: 1 };
      if (key === 'looks') { S.looks = 78; S.bias -= 0.4; } else if (key === 'money') S.inc = 0.9; else if (key === 'fam') S.cls = 1.3; else if (key === 'chem') S.chem += 20; else S.young = 1;
      ag.S = S; ag.c = [Q.mkCand(p, S), Q.mkCand(p, S), Q.mkCand(p, S)]; ag.left--; ag.dir = null;
      Sim.qFront(p, 'agPick', {}); return quiet();
    }
  };
  DEC.agPick = {
    ok: function (p) { return agOk(p) && !!p.fl.ag.c; },
    build: function (p) {
      var ag = p.fl.ag, g = H.grade(p), opts = ag.c.map(function (d, i) {
        var pb = H.dp(p, pr(p, ag.S.base, { looks: 0.35, social: 0.35 }, (g - d.g) * 0.45 + (d.chem - 50) / 40));
        return O('' + i, d.name + ' · ' + d.age + '세 · ' + gL(d.g) + '등급', { face: d.face, desc: d.job + (d.inc ? ' · 연봉 ' + won(d.inc * 12) : ' · 소득 없음') + ' · ' + d.edu + ' · 집안 ' + D.CLASS[d.cls].nick + ' · 키 ' + d.height + 'cm · 외모 ' + stars(d.looks) + ' · 예상 성사율 ' + U.pct(pb) + '%', ai: pb * (1 + d.g) });
      });
      opts.push(O('no', '세 분 모두 정중히 사양한다', { desc: '매칭 횟수는 차감됩니다', ai: 0.1 }));
      return { title: '프로필 세 장', icon: '💌', desc: '매니저가 태블릿을 돌려 보여 줍니다. "회원님 조건에 맞춰 세 분을 골랐어요. 한 분을 고르시면 약속을 잡아 드릴게요." 남은 매칭 ' + ag.left + '회.', opts: opts };
    },
    resolve: function (p, w, c, key) {
      var ag = p.fl.ag, list = ag.c; ag.c = null;
      if (key === 'no') return R(null, '사양', '"눈이 높으시네요." 매니저가 웃으며 태블릿을 덮었습니다.');
      Q.meetCand(p, list[+key], 'ag', ag.S); return quiet();
    }
  };

  /* ================= 자녀: 자라는 모습과 부모의 선택 ================= */
  // 플레이어의 자녀가 한 살 먹을 때마다 불린다(life.js kidsYear)
  Sim.kidLine = function (p, k, i) {
    if (k.withMe === false) return;
    var n = kidCall(i) + ' ' + k.name, me = p.sex === 'M' ? '아빠' : '엄마', t = null, c = '';
    switch (k.age) {
      case 1: t = U.josa(n, '이/가') + ' 처음으로 "' + me + '"라고 불렀습니다. 그 한마디에 하루치 피로가 사라졌습니다.'; c = 'good'; break;
      case 2: t = U.josa(n, '이/가') + ' 뛰어다니기 시작했습니다. 가장 자주 하는 말은 "싫어"와 "내 거"입니다.'; break;
      case 3: t = U.josa(n, '이/가') + ' 어린이집에 갑니다. 첫날은 문 앞에서 아이도 울고 ' + me + '도 울었습니다.'; break;
      case 5: t = n + '의 유치원 재롱잔치. 율동은 반 박자씩 늦었지만 휴대폰 용량이 모자랄 만큼 찍었습니다.'; break;
      case 7: t = U.josa(n, '이/가') + ' 초등학교에 입학했습니다. 가방이 몸보다 큽니다. 교문 앞에서 한참 뒷모습을 봤습니다.'; c = 'good'; break;
      case 10: t = n + '의 장래 희망은 이번 달에만 세 번 바뀌었습니다. 요즘은 유튜버입니다.'; break;
      case 13: t = U.josa(n, '이/가') + ' 중학생이 됐습니다. 교복을 한 치수 크게 맞췄습니다. 방문 닫는 소리가 조금 커졌습니다.'; break;
      case 16: t = U.josa(n, '이/가') + ' 고등학생이 됐습니다. 얼굴 보는 시간은 아침 십 분이 전부입니다.'; break;
      case 18: t = n + '의 수능 날. 도시락에 평소 먹던 반찬만 담았습니다. 교문이 닫힌 뒤에도 한참 서 있었습니다.'; break;
      case 20: if (k.sex === 'M') t = U.josa(n, '이/가') + ' 입대했습니다. 훈련소 앞에서 짧게 깎은 머리를 쓰다듬었습니다. 첫 편지는 일주일 뒤에 왔습니다.'; break;
      case 24: if (k.tier && k.tier !== 'hs') t = U.josa(n, '이/가') + ' 대학을 졸업했습니다. 학사모를 씌워 주는 사진을 찍었습니다.'; break;
    }
    if (t) say(p, t, c);
  };
  function kidOk(p, c) { var k = p.kids[c.i]; return !!k && k.withMe !== false; }
  function kRel(k, d) { k.rel = clamp((k.rel || 50) + d, 0, 100); }
  DEC.kdDay = {
    ok: kidOk,
    build: function (p, w, c) {
      var k = p.kids[c.i];
      return { title: '어린이날', icon: '🎈', desc: '5월 5일. ' + U.josa(k.name, '이/가') + '(' + k.age + '세) 일주일 전부터 달력에 동그라미를 쳐 놨습니다.', opts: [
        O('park', '놀이공원에 간다', { desc: won(30) + ' · 줄 서는 데 반나절', ai: 2 }),
        O('toy', '갖고 싶다던 장난감을 사 준다', { desc: won(15), ai: 2 }),
        O('work', '일이 밀려서 다음에 가자고 한다', { desc: '아이와의 사이 −' + (p.job && office(p) ? ' · 성과 +' : ''), ai: 0.4 })] };
    },
    resolve: function (p, w, c, key) {
      var k = p.kids[c.i];
      if (key === 'park') { Sim.pay(p, 30); kRel(k, 6); p.happy += 3; if (p.spouse) p.mq = clamp(p.mq + 1.5, 0, 100); return R(null, '놀이공원', '회전목마 줄에서 한 시간을 섰습니다. 목말을 태운 어깨가 저렸지만, 돌아오는 차에서 잠든 얼굴을 보니 잊혔습니다.'); }
      if (key === 'toy') { Sim.pay(p, 15); kRel(k, 3); p.happy += 1; return R(null, '선물', '상자를 뜯는 데 3초, 조립하는 데 세 시간이 걸렸습니다. 조립은 내 몫이었습니다.'); }
      kRel(k, -6); if (p.job) p.fl.perf = (p.fl.perf || 0) + 1; p.happy -= 2; return R(null, '다음에', '"다음에 꼭 가자." 아이는 고개를 끄덕였지만 달력의 동그라미는 지우지 않았습니다.');
    }
  };
  // 일하는 사람이 평일 낮에 자리를 비울 때: [겹친 일, 자리를 비우는 방법, 치르는 값]
  function workCtx(p) {
    var k = p.job.k, t = jt(p), J = D.JOBS[k];
    if (k === 'doc' || k === 'docOwn' || k === 'docProf' || k === 'resident' || k === 'milDoc' || k === 'medEmp' || k === 'medOwn') return ['예약 환자가 꽉 차 있습니다', t === 'own' ? '오후 진료를 휴진하고 간다' : '동료에게 진료를 부탁하고 간다', t === 'own' ? '하루 매출과 헛걸음한 환자들' : '동료에게 빚을 집니다'];
    if (t === 'pro' || t === 'own') return ['의뢰인과의 약속이 잡혀 있습니다', '일정을 미루고 간다', '의뢰인에게 양해를 구해야 합니다'];
    if (t === 'biz') return ['가게가 가장 바쁜 시간입니다', '가게 문을 잠시 닫고 간다', '반나절 매출을 포기합니다'];
    if (J.mil || k === 'nco') return ['부대 훈련 일정이 잡혀 있습니다', '휴가를 내고 간다', '지휘관의 눈치'];
    if (k === 'teacher' || k === 'prof') return ['내 수업이 있는 시간입니다', '수업을 바꾸고 간다', '동료에게 부탁해야 합니다'];
    if (t === 'gig') return ['일감이 들어온 날입니다', '일을 하루 쉬고 간다', '하루 벌이를 포기합니다'];
    return ['중요한 회의가 잡혀 있습니다', '반차를 내고 간다', '회사에서는 눈치'];
  }
  DEC.kdRecital = {
    ok: function (p, c) { return kidOk(p, c) && !!p.job; },
    build: function (p, w, c) {
      var k = p.kids[c.i], X = workCtx(p);
      return { title: '학예회', icon: '🎭', desc: U.josa(k.name, '이/가') + ' 학예회에서 대사가 있는 역을 맡았습니다. 목요일 오후 두 시. 하필 그 시간에 ' + X[0] + '.', opts: [
        O('go', X[1], { desc: '아이와의 사이 ++ · ' + X[2], ai: 2 }),
        O('video', (p.spouse ? '배우자에게 맡기고' : '선생님께 부탁해') + ' 영상으로 본다', { desc: '아이와의 사이 −', ai: 1.2 })] };
    },
    resolve: function (p, w, c, key) {
      var k = p.kids[c.i], t = team(p);
      if (key === 'go') { kRel(k, 9); p.happy += 3; if (t) t.rel = clamp(t.rel - 3, 0, 100); else if (jt(p) === 'own' || jt(p) === 'biz' || jt(p) === 'gig') Sim.pay(p, Math.round(p.inc / 25)); return R(true, '객석', '무대 위에서 객석을 두리번거리던 아이가 나를 찾고는 활짝 웃었습니다. 대사는 한 줄이었습니다. 그 한 줄을 평생 기억할 것 같습니다.'); }
      kRel(k, -4); if (p.spouse) p.mq = clamp(p.mq - 2, 0, 100); return R(null, '영상', '밤에 휴대폰으로 영상을 돌려 봤습니다. "다른 애들은 다 왔는데." 아이는 그 말만 하고 방에 들어갔습니다.');
    }
  };
  DEC.kdTeen = {
    ok: kidOk,
    build: function (p, w, c) {
      var k = p.kids[c.i];
      return { title: '사춘기', icon: '🚪', desc: U.josa(k.name, '이/가')+ '(' + k.age + '세) 달라졌습니다. 묻는 말에는 "몰라", 밥상에서는 휴대폰, 방문은 늘 잠겨 있습니다. 성적표는 가방 밑바닥에서 나왔습니다.', opts: [
        O('wait', '잔소리를 삼키고 기다려 준다', { desc: '통하면 사이가 깊어집니다', prob: pr(p, 0.55, { social: 0.5 }), stats: ['social'], ai: 2 }),
        O('trip', '둘이서 여행을 간다', { desc: won(100), dis: Sim.liquid(p) < 100 ? '여윳돈이 없습니다' : null, ai: 1.2 }),
        O('nag', '휴대폰을 압수하고 학원을 늘린다', { desc: '성적 + · 아이와의 사이 −−', ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var k = p.kids[c.i];
      if (key === 'trip') { Sim.pay(p, 100); kRel(k, 8); p.happy += 2; return R(null, '여행', '차 안에서 세 시간 동안 말이 없었습니다. 돌아오는 길에는 아이가 먼저 좋아하는 노래를 틀었습니다.'); }
      if (key === 'nag') { kRel(k, -10); k.iq = clamp(k.iq + 1.5, 5, 99); p.happy -= 2; return R(null, '전쟁', '방문 닫는 소리가 집을 울렸습니다. 성적은 조금 올랐고, 저녁 식탁은 조용해졌습니다.'); }
      var rl = roll(p, o.prob);
      if (rl.ok) { kRel(k, 10); return R(true, '문이 열림', '어느 밤 아이가 먼저 방문을 열고 나왔습니다. "' + (p.sex === 'M' ? '아빠' : '엄마') + ', 라면 먹을래?" 그 라면이 올해 먹은 것 중 가장 맛있었습니다.', rl); }
      return R(false, '평행선', '기다렸지만 문은 열리지 않았습니다. 시간이 해결해 주기를 바랄 뿐입니다.', rl);
    }
  };
  DEC.kdDream = {
    ok: kidOk,
    build: function (p, w, c) {
      var k = p.kids[c.i], f = ['그림을', '음악을', '운동을', '연기를'][U.hash(k.name + 'dream') % 4];
      return { title: '아이의 꿈', icon: '🎨', desc: U.josa(k.name, '이/가') + ' 어렵게 말을 꺼냅니다. "나, ' + f + ' 제대로 해 보고 싶어." 입시 레슨비는 한 해 ' + won(2500) + '쯤 든다고 합니다.', opts: [
        O('yes', '끝까지 밀어준다', { desc: won(2500) + ' · 예체능 계열로 진학합니다 · 아이와의 사이 ++', dis: Sim.liquid(p) + Sim.hhGross(p) * 6 < 2500 ? '감당할 수 없습니다' : null, ai: 1 }),
        O('hobby', '취미로만 하라고 한다', { desc: '아이와의 사이 −', ai: 2 }),
        O('no', '공부나 하라고 한다', { desc: '성적 + · 아이와의 사이 −−', ai: 1 })] };
    },
    resolve: function (p, w, c, key) {
      var k = p.kids[c.i];
      if (key === 'yes') { Sim.pay(p, 2500); k.art = 1; kRel(k, 12); p.happy += 2; return R(null, '응원', '"해 봐. 대신 끝까지 해." 아이의 눈이 커졌습니다. 그날부터 연습실 불이 가장 늦게 꺼집니다.'); }
      if (key === 'hobby') { kRel(k, -3); return R(null, '타협', '"대학 가서 해도 늦지 않아." 아이는 알겠다고 했습니다. 스케치북은 책장 맨 위로 올라갔습니다.'); }
      kRel(k, -10); k.iq = clamp(k.iq + 1, 5, 99); return R(null, '반대', '"그걸로 어떻게 먹고살려고." 내 부모에게 들었던 말이 내 입에서 나왔습니다.');
    }
  };

  /* ================= 상속: 건물·현금·빚, 한정승인 ================= */
  // 부모가 모두 떠났을 때 플레이어 몫(share)을 구성해 갈림길로 넘긴다(life.js famYear)
  Sim.estate = function (p, w, share) {
    var r = p.rng, seoul = Sim.price(w, 'seoul', p.age), c = { cash: 0, bld: [], debt: 0 }, left = share;
    if (share < 400 && p.fam.cls <= 2 && U.chance(r, 0.4)) c.debt = r100(U.range(r, [1500, 9000]));     // 물려받는 것이 빚일 수도 있다
    ['tower', 'small', 'shop'].forEach(function (k) {
      var v = r100(seoul * D.BLD[k].mult);
      if (!c.bld.length && left >= v * (k === 'shop' ? 2 : 1.6) && U.chance(r, 0.7)) { c.bld.push({ k: k, region: 'seoul', value: v, buy: v }); left -= v; }
    });
    c.cash = Math.round(left);
    if (c.cash < 100 && !c.bld.length && !c.debt) { say(p, '부모님이 남긴 재산은 없었습니다. 장례비는 형제들과 나눠 냈습니다. 오래된 사진첩 한 권을 가져왔습니다.'); return; }
    Sim.q(p, 'estate', c);
  };
  DEC.estate = {
    build: function (p, w, c) {
      var bv = c.bld.reduce(function (s, b) { return s + b.value; }, 0), tot = c.cash + bv, tax = Math.round(Math.max(0, tot - D.GIFT.inheritFree) * D.GIFT.inheritTax), opts = [];
      var what = (c.bld.length ? D.BLD[c.bld[0].k].name + ' 한 채(' + won(bv) + ')와 ' : '') + '현금·예금 ' + won(c.cash) + (c.debt ? ', 그리고 빚 ' + won(c.debt) : '');
      if (c.debt > tot) {
        opts.push(O('limit', '한정승인을 신청한다', { desc: '법무 비용 ' + won(150) + ' · 물려받은 재산 한도 안에서만 빚을 갚습니다', ai: 3 }));
        opts.push(O('renounce', '상속을 포기한다', { desc: '재산도 빚도 받지 않습니다', ai: 1.5 }));
        opts.push(O('accept', '빚까지 모두 떠안는다', { desc: '빚 ' + won(c.debt - tot) + '이 내 것이 됩니다 · 부모님 이름으로 진 빚을 끝까지 갚습니다', ai: 0.2 }));
      } else {
        if (c.bld.length) {
          opts.push(O('keep', '건물은 물려받아 임대를 놓는다', { desc: '상속세 ' + won(tax) + (tax > c.cash ? ' (현금으로 모자란 ' + won(tax - c.cash) + '은 대출)' : '') + ' · 월 임대료가 들어옵니다', ai: 3, tax: tax }));
          opts.push(O('sell', '건물을 팔아 전부 현금으로 받는다', { desc: '세금과 비용을 떼고 ' + won(tot * 0.98 - tax - c.debt), ai: 1.5, tax: tax }));
        } else opts.push(O('ok', '상속받는다', { desc: '세금과 빚을 떼고 ' + won(tot - tax - c.debt), ai: 4, tax: tax }));
        if (tot - tax - c.debt >= 3000) opts.push(O('donate', '10%를 부모님 이름으로 기부하고 받는다', { desc: won((tot - tax - c.debt) * 0.1) + ' 기부 · 행복 +', ai: 0.4, tax: tax }));
      }
      return { title: '상속', icon: '📜', desc: '장례를 마치고 서류를 정리합니다. 내 몫은 ' + what + '입니다.' + (c.debt > tot ? ' 남긴 재산보다 빚이 많습니다. 석 달 안에 결정해야 합니다.' : tax > 0 ? ' 상속세는 ' + won(tax) + '(공제 ' + won(D.GIFT.inheritFree) + ' 초과분의 ' + U.pct(D.GIFT.inheritTax) + '%)입니다.' : ' 공제 범위 안이라 상속세는 없습니다.'), opts: opts };
    },
    resolve: function (p, w, c, key, o) {
      var bv = c.bld.reduce(function (s, b) { return s + b.value; }, 0), tot = c.cash + bv, net;
      if (key === 'renounce') return R(null, '상속 포기', '법원에 상속 포기 신고서를 냈습니다. 빚도 유품도 내 것이 아니게 됐습니다. 사진첩만은 챙겼습니다.');
      if (key === 'limit') { Sim.pay(p, 150); p.fl.limited = 1; return R(null, '한정승인', '한정승인 결정문을 받았습니다. 남은 재산은 채권자들에게 돌아갔고, 내 통장은 건드려지지 않았습니다. 부모님의 빚은 여기서 끝났습니다.'); }
      if (key === 'accept') { p.cash += tot; p.debt += c.debt; p.happy += 1; ms(p, '부모님이 남긴 빚 ' + won(c.debt - tot) + '을 떠안았습니다.', false); return R(null, '단순 승인', '채권자들에게 전화를 돌렸습니다. "제가 갚겠습니다." 부모님 이름에 남은 얼룩을 지우는 데는 시간이 걸릴 겁니다.'); }
      if (key === 'keep') {
        p.bld = (p.bld || []).concat(c.bld); net = c.cash - o.tax - c.debt; if (net >= 0) p.cash += net; else Sim.pay(p, -net);
        p.fl.inherit = tot - o.tax - c.debt; ms(p, '부모님으로부터 ' + D.BLD[c.bld[0].k].name + '과 현금을 상속받았습니다. (총 ' + won(tot) + ')', false);
        return R(true, '건물 상속', '등기부의 소유자 이름이 바뀌었습니다. 매달 ' + won(Sim.rentInc(p) * (1 - D.BLD_COST)) + '의 임대료가 들어옵니다. 세입자들은 새 건물주의 얼굴을 살핍니다.', null, 'house');
      }
      net = (key === 'sell' ? tot - bv * 0.02 : tot) - o.tax - c.debt;
      if (key === 'donate') { var dn = Math.round(net * 0.1); net -= dn; p.fl.donated = (p.fl.donated || 0) + dn; p.happy += 5; ms(p, '상속 재산 가운데 ' + won(dn) + '을 부모님 이름으로 기부했습니다.', false); }
      p.cash += net; p.fl.inherit = net;
      if (net >= 3000) ms(p, '부모님으로부터 ' + won(net) + '을 상속받았습니다.', false);
      return R(null, '상속', net >= 3000 ? '통장에 ' + won(net) + '이 찍혔습니다. 숫자는 큰데, 전화를 걸어 알릴 사람이 없습니다.' : '부모님이 남긴 것은 ' + won(net) + '과 오래된 사진첩이었습니다.');
    }
  };

  /* ================= 부동산: 수익형 건물과 갭투자를 투자 탭에서 바로 사고판다 ================= */
  Sim.reMarket = function (g) {
    var p = g.p, w = g.w, seoul = Sim.price(w, 'seoul', p.age), liq = Sim.liquid(p), n = (p.bld || []).length, cap = Sim.loanCap(p, w, false);
    return Object.keys(D.BLD).map(function (k) {
      var B = D.BLD[k], price = r100(seoul * B.mult), cost = price * (1 + D.HOUSE.buyCost), loan = Math.max(0, Math.ceil((cost - liq) / 100) * 100), lim = Math.min(price * D.BLD_LTV, cap);
      return { k: k, name: B.name, price: price, rent: Math.round(price * B.yield / 12 * (1 - D.BLD_COST)), loan: loan, cost: cost,
        dis: p.age < 22 ? '아직은 이릅니다' : n >= D.BLD_MAX ? '건물은 ' + D.BLD_MAX + '채까지 가질 수 있습니다' : loan > lim ? '자금 부족 (필요 대출 ' + won(loan) + ' · 한도 ' + won(lim) + ')' : null };
    });
  };
  Sim.buyBld = function (g, k) {
    var p = g.p, m = Sim.reMarket(g).filter(function (x) { return x.k === k; })[0]; if (!m || m.dis) return 0;
    if (m.loan) { p.debt += m.loan; p.cash += m.loan; }
    Sim.pay(p, m.cost); (p.bld = p.bld || []).push({ k: k, region: 'seoul', value: m.price, buy: m.price });
    p.happy = clamp(p.happy + 4, 2, 99); p.fl.bldN = (p.fl.bldN || 0) + 1;
    ms(p, U.josa(m.name, '을/를') + ' ' + won(m.price) + '에 매입했습니다.', false);
    p.cur.push({ t: U.josa(m.name, '을/를') + ' 매입했습니다(' + won(m.price) + (m.loan ? ', 대출 ' + won(m.loan) : '') + '). 매달 임대료 ' + won(m.rent) + '이 들어옵니다. 공실과 수리 전화도 함께 옵니다.', c: 'good' });
    return m.price;
  };
  Sim.sellBld = function (g, i) {
    var p = g.p, b = (p.bld || [])[i]; if (!b) return 0;
    var sale = b.value * (1 - D.HOUSE.sellCost), gain = sale - b.buy, tax = gain > 0 ? gain * D.HOUSE.gapTax : 0;
    p.cash += sale - tax; p.bld.splice(i, 1);
    p.cur.push({ t: U.josa(D.BLD[b.k].name, '을/를') + ' ' + won(b.value) + '에 팔았습니다. ' + (gain >= 0 ? '세금을 내고 ' + won(gain - tax) + '이 남았습니다.' : won(-gain) + ' 손해를 봤습니다.'), c: gain >= 0 ? 'good' : 'bad' });
    return sale;
  };
  // 갭투자 매물: 지역(강남~지방 도시) × 아파트/빌라·소형. 전세가율이 높은 지방일수록 내 돈이 적게 들지만 집값이 잘 오르지 않는다
  Sim.GAP_REGS = ['gangnam', 'seoul', 'newtown', 'metro', 'city'];
  Sim.gapList = function (g) {
    var p = g.p, w = g.w, liq = Sim.liquid(p), out = [];
    Sim.GAP_REGS.forEach(function (reg) {
      ['apt', 'villa'].forEach(function (kind) {
        var R0 = D.REG[reg], price = r100(Sim.price(w, reg, p.age) * (kind === 'villa' ? D.HOUSE.villa : 1)), eq = Math.round(price * (1 - R0.jr) + price * D.HOUSE.buyCost);
        out.push({ reg: reg, kind: kind, name: R0.name + (kind === 'villa' ? ' 빌라·소형' : ' 아파트'), price: price, eq: eq, jr: R0.jr, g: R0.g,
          dis: p.age < 22 ? '아직은 이릅니다' : Sim.gaps(p).length >= D.GAP_MAX ? D.GAP_MAX + '채까지 가질 수 있습니다' : liq < eq ? '투자금 부족' : null });
      });
    });
    return out;
  };
  Sim.buyGap = function (g, reg, kind) {
    var p = g.p, x = Sim.gapList(g).filter(function (m) { return m.reg === reg && m.kind === kind; })[0]; if (!x || x.dis) return 0;
    Sim.pay(p, x.eq); Sim.gaps(p).push({ region: x.reg, kind: x.kind, value: x.price, dep: Math.round(x.price * x.jr), buy: x.price }); p.fl.gapN = (p.fl.gapN || 0) + 1;
    ms(p, x.name + '를 전세 끼고 매수했습니다.', false);
    p.cur.push({ t: '갭투자: ' + x.name + '(' + won(x.price) + ')를 내 돈 ' + won(x.eq) + '으로 샀습니다. 세입자의 보증금이 지렛대입니다.', c: 'pick' });
    return x.eq;
  };
  Sim.sellGapNow = function (g, i) { var p = g.p; if (!Sim.gaps(p)[i]) return 0; p.cur.push({ t: Sim.sellGap(p, false, i), c: '' }); return 1; };

  /* ================= 재력가: 부모 찬스, 플렉스, 기부, 사모펀드, 집안 혼담 ================= */
  A('giftAsk', 0, '🎁', '부모 찬스 (증여 부탁)', { cd: 'y', show: function (p) { return p.fam.alive > 0 && p.fam.cls >= 4 && p.fam.assets >= 30000; }, desc: function (p) { return '부모님 자산 ' + won(p.fam.assets) + ' · 미리 받으면 상속 때 줄어듭니다'; }, run: function (p) { return toDec(p, 'giftAsk'); } });
  DEC.giftAsk = {
    ok: function (p) { return p.fam.alive > 0; },
    build: function (p) {
      var f = p.fam, hx = (f.harmony - 50) / 25, free = !p.fl.gift10 || p.age - p.fl.gift10 >= 10, mid = r100(clamp(f.assets * 0.05, 10000, 100000)), big = r100(f.assets * 0.15);
      return { title: '부모 찬스', icon: '🎁', desc: '부모님 댁 거실. 과일을 깎으며 말을 꺼낼 틈을 봅니다. 부모님 자산은 ' + won(f.assets) + ', 가정 화목도는 ' + Math.round(f.harmony) + '/100. 증여는 10년에 ' + won(5000) + '까지 세금이 없고, 그 위로는 세금이 붙습니다.', opts: [
        O('s', '비과세 한도만큼 부탁드린다', { desc: won(5000) + ' · 세금 없음' + (free ? '' : ' (10년 안에 이미 받았습니다)'), prob: pr(p, 0.85, { social: 0.2 }, hx), stats: ['social'], dis: free ? null : '10년이 지나야 다시 받을 수 있습니다', ai: 2, amt: 5000, tax: 0 }),
        O('m', '목돈을 부탁드린다', { desc: won(mid) + ' · 증여세 20%', prob: pr(p, 0.55, { social: 0.3 }, hx), stats: ['social'], ai: 1, amt: mid, tax: 0.2 }),
        O('b', '큰돈을 미리 물려 달라고 한다', { desc: won(big) + ' · 증여세 35% · 집안 분위기가 달라질 수 있습니다', prob: pr(p, 0.28, { social: 0.3 }, hx), stats: ['social'], ai: 0.3, amt: big, tax: 0.35 }),
        O('no', '말을 꺼내지 않는다', { ai: 1 })] };
    },
    resolve: function (p, w, c, key, o) {
      var f = p.fam; if (key === 'no') return R(null, '다음에', '과일만 먹고 일어났습니다. "별일 없지?"라는 물음에 그렇다고 했습니다.');
      var rl = roll(p, o.prob);
      if (!rl.ok) { f.harmony = Math.max(5, f.harmony - (key === 'b' ? 5 : 2)); return R(false, '거절', '"네 힘으로 해 봐라. 우리 때는 말이다…" 이야기는 길어졌고, 통장은 그대로입니다.', rl); }
      var net = Math.round(o.amt * (1 - o.tax)); f.assets = Math.max(0, f.assets - o.amt); p.cash += net; if (key === 's') p.fl.gift10 = p.age; f.harmony = Math.max(5, f.harmony - (key === 'b' ? 3 : 1));
      p.fl.gifted = (p.fl.gifted || 0) + net; if (o.amt >= 10000) ms(p, '부모님께 ' + won(o.amt) + '을 증여받았습니다.', false);
      return R(true, '증여', (o.tax ? '증여세를 내고 ' : '') + won(net) + '이 들어왔습니다. "아껴 써라." 출발선이 한 번 더 앞당겨졌습니다.', rl);
    }
  };
  A('flex', 2, '💎', '플렉스 (명품·시계·파인다이닝)', { cd: 'q', cost: function (p) { return r100(clamp(Sim.liquid(p) * 0.01, 300, 30000)); }, show: function (p) { return Sim.liquid(p) >= 10000; }, desc: '행복 ++ · 가진 돈의 1%를 씁니다',
    run: function (p, g, rl, dim) { p.happy += 3.5 * dim; p.fl.flex = (p.fl.flex || 0) + 1; return R(null, '플렉스', U.pick(p.rng, ['매장 직원이 장갑을 끼고 시계를 꺼내 왔습니다. 손목이 조금 무거워졌습니다.', '예약에만 석 달이 걸리는 식당의 열두 접시. 맛은 좋았고, 사진은 더 좋았습니다.', '쇼핑백 여섯 개를 차에 실었습니다. 쓰는 것도 재능이라는 걸 알았습니다.'])); } });
  A('donate', 2, '🤲', '기부', { cd: 'y', cost: function (p) { return r100(clamp(Sim.liquid(p) * 0.02, 100, 200000)); }, show: function (p) { return Sim.liquid(p) >= 3000; }, desc: '행복 + · 가진 돈의 2%를 나눕니다',
    run: function (p, g, rl, dim) { var a = r100(clamp((Sim.liquid(p)) * 0.02, 100, 200000)); p.happy += 2.5 * dim; p.fl.donated = (p.fl.donated || 0) + a; if (a >= 5000) ms(p, won(a) + '을 기부했습니다.', false); return R(null, '기부', '후원 증서와 아이들이 쓴 편지가 왔습니다. 삐뚤빼뚤한 글씨를 냉장고에 붙여 두었습니다.'); } });
  DEC.qPE = {
    build: function (p, w, c) {
      return { title: '사모펀드 제안', icon: '🏦', desc: '프라이빗 뱅커가 조용한 방으로 안내합니다. "아무에게나 드리는 제안이 아닙니다. 비상장 기업 인수 펀드, 최소 출자 ' + won(c.amt) + ', 3년 뒤 회수입니다." 설명서는 두껍고 수수료 항목은 작게 적혀 있습니다.', opts: [
        O('in', '출자한다', { desc: won(c.amt) + ' · 성공하면 1.5~2.8배, 실패하면 절반을 잃습니다', prob: pr(p, 0.52, { iq: 0.4 }), stats: ['iq'], dis: Sim.liquid(p) < c.amt ? '여윳돈이 부족합니다' : null, ai: 0.5 + H.risk(p), amt: c.amt }),
        O('half', '절반만 넣는다', { desc: won(c.amt / 2), prob: pr(p, 0.52, { iq: 0.4 }), stats: ['iq'], ai: 1, amt: c.amt / 2 }),
        O('no', '예금이 마음 편하다', { ai: 2 }),
        O('mute', '이런 제안은 앞으로 받지 않겠다고 한다', { desc: '사모펀드 권유가 다시는 오지 않습니다', ai: 0.3 })] };
    },
    resolve: function (p, w, c, key, o) {
      if (key === 'mute') { H.mute(p, 'qPE'); return R(null, '사양', '"저는 모르는 데는 안 넣습니다." 뱅커는 정중히 고개를 숙였고, 그 뒤로 조용한 방에 불려 가는 일은 없었습니다.'); }
      if (key === 'no') return R(null, '거절', '두꺼운 설명서를 돌려주고 나왔습니다. 커피는 맛있었습니다.');
      var rl = roll(p, o.prob), g;
      if (rl.ok) { g = r100(o.amt * U.range(p.rng, [0.5, 1.8])); p.cash += g; p.happy += 5; if (g >= 10000) ms(p, '사모펀드 투자로 ' + won(g) + '을 벌었습니다.', false); return R(true, '회수 성공', '인수한 회사가 좋은 값에 다시 팔렸습니다. 원금에 ' + won(g) + '이 얹혀 돌아왔습니다. 돈이 돈을 버는 속도를 실감합니다.', rl); }
      g = r100(o.amt * 0.5); Sim.pay(p, g); p.happy -= 5; return R(false, '손실', '인수한 회사의 실적이 꺾였습니다. 펀드는 헐값에 청산됐고 ' + won(g) + '이 사라졌습니다. 수수료는 꼬박꼬박 나갔습니다.', rl);
    }
  };
  Q.QEV.push(['qPE', 1.2, function (p) { return Sim.liquid(p) > 30000 && p.age >= 28 && p.age < 75; }, function (p) { return { amt: r100(clamp(Sim.liquid(p) * 0.15, 10000, 500000)) }; }, 6]);
  Q.QEV.push(['meet', 1.5, function (p) { return single(p) && !p.noMarry && p.age >= 26 && p.age <= 42 && p.fam.alive > 0 && (p.fam.cls >= 5 || Sim.netWorth(p) > 300000); }, function (p) {
    var S = { name: '집안 혼담', bias: 1.3, sd: 0.4, chem: 42, base: 0.62, cls: 2, yrs: 1, inc: 0.5, go: '만남을 이어 간다', okText: '두 번째 만남부터는 어른들 없이 봤습니다. 집안끼리는 이미 날짜를 고르는 눈치입니다.' };
    return { cand: Q.mkCand(p, S), src: 'rich', sn: S.name, base: S.base, yrs: 1, go: S.go, okText: S.okText };
  }, 4]);

  /* ================= 달마다: 예정된 일, 직장·연애 사건, 소소한 사건, 계절 한 줄 ================= */
  function tm(p) { return !!team(p); }
  // [갈림길, 한 달 확률, 조건, 문맥, 다시 나오기까지의 최소 간격(년)]
  var QX = [
    ['lvAnniv', 0.045, function (p) { return !!p.partner && p.partner.yrs >= 1; }, null, 1],
    ['lvFight', 0.03, function (p) { return !!p.partner; }, null, 1],
    ['lvMeet', 0.035, function (p) { return !!p.partner && p.partner.yrs >= 1 && !p.partner.metFam && p.age >= 24; }, null, 1],
    ['lvBusy', 0.018, function (p) { return !!p.partner && !!p.job; }, null, 2],
    ['offDinner', 0.025, tm, null, 2],
    ['offOrder', 0.015, function (p) { return tm(p) && p.job.k !== 'heir'; }, null, 4],
    ['offCredit', 0.015, function (p) { return tm(p) && p.job.y >= 1 && p.job.k !== 'heir'; }, null, 5],
    ['offJunior', 0.018, function (p) { return tm(p) && !!p.job.team.jr; }, null, 4],
    ['offLine', 0.012, function (p) { var j = p.job; return tm(p) && D.JOBS[j.k].type === 'corp' && !D.JOBS[j.k].mil && j.rank >= 2 && j.rank < 5 && !j.team.line; }, null, 8],
    ['heirProve', 0.03, function (p) { return jobIs(p, 'heir') && p.job.y >= 1; }, null, 3],
    ['celebRole', 0.05, function (p) { return jobIs(p, 'celeb') && (p.job.tier || 0) >= 1; }, null, 2],
    ['celebScandal', 0.02, function (p) { return jobIs(p, 'celeb') && (p.job.tier || 0) >= 2; }, null, 4]
  ];
  // 예정된 일: 캠퍼스 커플, 연인의 변화, 자녀의 순간. 무언가 일어났으면 true
  function scheduled(g) {
    var p = g.p, r = p.rng, m = g.mon, pt = p.partner, i, k;
    if (p.occ === 'univ' && single(p) && !p.noMarry) {
      if (!p.fl.ccN && m <= 3) { p.fl.ccN = 1; p.cur.push({ t: '캠퍼스에는 CC(캠퍼스 커플)의 기회가 있습니다. 4월의 조별 과제와 가을 축제에 인연이 찾아오곤 하고, 자유 행동의 "미팅·과팅"으로 직접 찾아 나설 수도 있습니다. 졸업하면 이런 만남은 다시 오지 않습니다.', c: 'news' }); return true; }
      var slot = p.age * 2 + (m > 6 ? 1 : 0);
      if ((m === 4 || m === 10) && p.fl.ccT !== slot && U.chance(r, 0.65)) { p.fl.ccT = slot; Q.meet(p, m === 4 ? 'cc' : 'fest', CC_S[m === 4 ? 'cc' : 'fest']); return true; }
    }
    if (pt) {
      lv(pt);
      if (m === 1) {
        pt.aff = clamp(pt.aff - 4, 0, 100);     // 가꾸지 않으면 식는다
        if (pt.student && pt.age >= 24) { pt.student = 0; pt.inc = U.chance(r, 0.2) ? 0 : Math.max(180, Math.round((180 + Math.pow(clamp(H.grade(p) + U.norm(r), 0, 5), 2) * 30) / 10) * 10); pt.job = ptJob(pt.inc); p.cur.push({ t: U.josa(pt.name, '이/가') + ' 학교를 졸업했습니다. ' + (pt.inc ? U.josa(pt.job, '으로/로') + ' 첫 출근을 했습니다(월 ' + won(pt.inc) + ').' : '취업 준비를 시작했습니다.'), c: 'news' }); return true; }
      }
      if (pt.aff < 18) { p.partner = null; p.happy = clamp(p.happy - 6, 2, 99); p.cur.push({ t: U.josa(pt.name, '과/와') + ' 헤어졌습니다. 연락이 뜸해진 지 오래였습니다. 마지막 통화는 3분이 걸리지 않았습니다.', c: 'bad' }); return true; }
      if (pt.aff >= 84 && pt.yrs >= 1 && p.age >= 25 && !pt.hinted) { pt.hinted = 1; p.cur.push({ t: U.josa(pt.name, '이/가') + ' 지나가듯 말합니다. "우리, 같이 사는 건 어때?" 농담처럼 들리지 않았습니다.', c: 'good' }); Sim.q(p, 'marry', {}); return true; }
    }
    for (i = 0; i < p.kids.length; i++) {
      k = p.kids[i]; if (k.withMe === false) continue; k.ev = k.ev || {};
      if (m === 5 && (k.age === 5 || k.age === 9) && p.fl.kdDay !== p.age) { p.fl.kdDay = p.age; Sim.q(p, 'kdDay', { i: i }); return true; }
      if (m === 10 && k.age >= 7 && k.age <= 10 && p.job && !k.ev.rec) { k.ev.rec = 1; Sim.q(p, 'kdRecital', { i: i }); return true; }
      if (k.age >= 14 && k.age <= 15 && !k.ev.teen && U.chance(r, 0.12)) { k.ev.teen = 1; Sim.q(p, 'kdTeen', { i: i }); return true; }
      if (m === 3 && k.age === 17 && !k.ev.dream && U.hash(k.name + 'dr') % 2 === 0) { k.ev.dream = 1; Sim.q(p, 'kdDream', { i: i }); return true; }
    }
    return false;
  }
  Sim.monthHook = function (g) {
    var p = g.p, r = p.rng, seen = p.fl.qev = p.fl.qev || {}, i, e;
    if (p.occ === 'mil') return false;
    if (scheduled(g)) return true;
    for (i = 0; i < QX.length; i++) {
      e = QX[i]; if (H.muted(p, e[0]) || (seen[e[0]] != null && p.age - seen[e[0]] < e[4])) continue;
      if (!e[2](p, g) || !U.chance(r, e[1])) continue;
      seen[e[0]] = p.age; Sim.q(p, e[0], e[3] ? e[3](p, g) : {}); return true;
    }
    return false;
  };
  // 선택지 없는 소소한 사건: [가중치, 조건, 변형 목록, 문장 색]. 변형은 [문장, 효과] 또는 문장만.
  // 최근에 나온 변형은 한동안(RECENT개) 다시 나오지 않는다. 문구를 늘리려면 변형 목록에 한 줄씩 더한다.
  function yes() { return true; }
  function jt(p) { return p.job ? D.JOBS[p.job.k].type : ''; }
  function office(p) { var t = jt(p); return (t === 'corp' || t === 'steady') && !D.JOBS[p.job.k].mil && p.job.k !== 'nco'; }
  function proJob(p) { var t = jt(p); return t === 'pro' || t === 'own'; }
  function indep(p) { return p.home.type !== 'parents' && p.home.type !== 'none'; }
  function hp(d) { return function (p) { p.health += d; }; }
  function hj(d) { return function (p) { p.happy += d; }; }
  function pay(n, d) { return function (p) { Sim.pay(p, n); if (d) p.happy += d; }; }
  function gain(n, d) { return function (p) { p.cash += n; p.happy += d || 0.5; }; }
  function mq(d) { return function (p) { p.mq = clamp(p.mq + d, 0, 100); }; }
  var RECENT = 45;
  var NEWS = [
    [3, yes, [['감기에 걸렸습니다. 사흘을 코를 훌쩍이며 보냈습니다.', hp(-0.4)], ['장염으로 이틀을 앓았습니다. 죽 한 그릇이 이렇게 고마울 줄 몰랐습니다.', hp(-0.5)], ['자고 일어났더니 목이 돌아가지 않습니다. 베개를 바꿀 때가 됐습니다.', hp(-0.2)], ['눈에 다래끼가 났습니다. 안대를 하고 다니니 다들 한 번씩 묻습니다.', hp(-0.2)], ['계단에서 발목을 접질렸습니다. 일주일을 절뚝이며 다녔습니다.', hp(-0.5)], ['환절기 비염이 도졌습니다. 휴지 한 통을 하루에 다 썼습니다.', hp(-0.3)], ['사랑니가 욱신거립니다. 치과 예약 버튼 앞에서 사흘째 망설입니다.', hp(-0.2)]]],
    [3, function (p) { return p.age >= 24; }, [['지인의 결혼식이 있었습니다. 봉투에 10만 원을 넣었습니다.', pay(10)], ['부고 문자를 받았습니다. 검은 양복을 꺼내 입고 조의금 10만 원을 냈습니다.', pay(10)], ['조카 돌잔치에 다녀왔습니다. 돌잡이에서 아이는 마이크를 잡았습니다. 봉투는 5만 원.', pay(5)], ['친구 집들이에 갔습니다. 휴지와 세제를 들고 가서 새집 냄새를 맡고 왔습니다.', pay(3, 0.5)], ['선배의 개업식에 화분을 보냈습니다. 리본 문구를 고르는 데 십 분이 걸렸습니다.', pay(7)], ['은사님 퇴임식에 다녀왔습니다. 교탁 앞의 선생님은 기억보다 작았습니다.', pay(5, 0.5)]]],
    [2.6, yes, [['휴대폰 액정이 깨졌습니다. 수리비 30만 원. 보험은 지난달에 해지했습니다.', pay(30, -0.5)], ['무선 이어폰 한쪽을 지하철 선로에 떨어뜨렸습니다. 한쪽만 다시 사는 데 12만 원.', pay(12, -0.3)], ['우산을 또 잃어버렸습니다. 올해만 세 번째입니다. 편의점 비닐우산의 단골이 됐습니다.', pay(1)], ['지갑을 택시에 두고 내렸습니다. 카드 재발급에 일주일, 현금 8만 원은 돌아오지 않았습니다.', pay(8, -0.5)], ['노트북에 커피를 쏟았습니다. 키보드 교체비 18만 원. 한동안 책상에서 음료를 치웠습니다.', pay(18, -0.4)], ['안경을 깔고 앉았습니다. 새 안경테 15만 원. 도수도 조금 올랐습니다.', pay(15)], ['충전기가 또 단선됐습니다. 정품은 비싸고 싼 건 석 달을 못 갑니다.', pay(3)], ['택배가 사라졌습니다. 배송 완료 사진 속 문은 우리 집 문이 아니었습니다.', pay(4, -0.3)], ['아끼던 옷에 김칫국물이 튀었습니다. 세탁소 사장님도 고개를 저었습니다.', hj(-0.3)], ['자전거 안장을 도둑맞았습니다. 안장만 가져가는 사람의 마음을 알 수 없습니다.', pay(4, -0.3)]], 'bad'],
    [1.6, indep, [['세탁기가 탈수 중에 멈췄습니다. 수리 기사님 출장비까지 22만 원.', pay(22)], ['한겨울에 보일러가 고장 났습니다. 이틀을 전기장판 위에서 버텼습니다. 수리비 15만 원.', pay(15, -0.5)], ['싱크대 배수구가 막혔습니다. 유튜브를 보고 직접 뚫었습니다. 뿌듯함은 사흘 갔습니다.', hj(0.5)], ['현관 도어락 건전지가 나갔습니다. 문 앞에서 편의점까지 뛰었습니다.'], ['관리비 고지서를 보고 숫자를 다시 셌습니다. 난방을 그렇게 틀었던가 생각합니다.', pay(8)], ['화장실 전등이 나갔습니다. 휴대폰 불빛으로 사흘을 씻었습니다.']]],
    [2.2, yes, [['겨울 외투 주머니에서 5만 원이 나왔습니다. 작년의 내가 올해의 나에게 준 선물입니다.', gain(5)], ['안 쓰던 물건을 중고로 팔았습니다. 8만 원. 방이 조금 넓어졌습니다.', gain(8)], ['이벤트 경품으로 치킨 쿠폰에 당첨됐습니다. 인생에 이런 날도 있습니다.', hj(1)], ['카드 포인트가 3만 원어치 쌓여 있었습니다. 있는 줄도 몰랐던 돈입니다.', gain(3)], ['길에서 만 원을 주웠습니다. 주위를 두 번 둘러보고 주머니에 넣었습니다.', gain(1)], ['보험 환급금 12만 원이 들어왔습니다. 무엇의 환급인지는 끝내 알아내지 못했습니다.', gain(12)], ['단골 카페 쿠폰 열 칸을 다 채웠습니다. 공짜 커피는 유난히 맛있습니다.', hj(0.6)]], 'good'],
    [2, function (p) { return !!p.car; }, [['주차장에서 기둥을 긁었습니다. 도색비 50만 원. 블랙박스는 내 한숨을 녹음했습니다.', pay(50, -0.5)], ['타이어에 못이 박혔습니다. 보험사 긴급출동을 처음 불러 봤습니다.', pay(3)], ['과속 단속 고지서가 날아왔습니다. 사진 속 내 표정은 평온했습니다. 6만 원.', pay(6)], ['마트 주차장에서 문콕을 당했습니다. 범인은 찾지 못했습니다.', hj(-0.4)], ['엔진오일 교환 시기를 넘겼습니다. 정비소에서 이것저것 권하는 대로 18만 원을 썼습니다.', pay(18)], ['세차를 하자마자 비가 왔습니다. 이 법칙은 한 번도 틀린 적이 없습니다.']], 'bad'],
    [3, function (p, g) { return !!Q.friend(g) && p.age >= 20; }, [['건너 건너 소식을 들었습니다. ', function (p, g) { var q = Q.friend(g); g.w.lastNews[q.id] = p.age; return Sim.newsLine(q, g.w.nr).t; }]], 'news'],
    [3, function (p) { return p.kids.some(function (k) { return k.age >= 3 && k.age <= 9 && k.withMe !== false; }); }, [['아이가 그려 온 가족 그림을 냉장고에 붙였습니다. 내 머리가 실제보다 큽니다.', hj(1)], ['아이의 앞니가 빠졌습니다. 베개 밑에 넣어 둔 이는 밤사이 천 원으로 바뀌었습니다.', hj(1)], ['아이가 받아쓰기 100점을 받아 왔습니다. 시험지를 사진 찍어 양가 단톡방에 올렸습니다.', hj(1.2)], ['아이의 자전거 보조 바퀴를 뗐습니다. 뒤에서 잡아 주다 손을 놓았는데, 그대로 달려갔습니다.', hj(1.5)], ['아이가 하루에 "왜?"를 백 번쯤 묻습니다. 하늘이 왜 파란지 결국 검색했습니다.', hj(0.5)], ['아이가 편식을 합니다. 당근을 잘게 다져 숨겼지만 한 조각도 놓치지 않고 골라냈습니다.'], ['잠든 아이의 이불을 덮어 주다 한참 얼굴을 봤습니다. 자는 동안에도 크는 것 같습니다.', hj(1)]], 'good'],
    [2, function (p) { return p.kids.some(function (k) { return k.age >= 10 && k.age <= 18 && k.withMe !== false; }); }, [['아이가 용돈 인상을 요구합니다. 물가 상승률을 근거로 들었습니다. 협상은 결렬됐습니다.'], ['아이의 성적표가 식탁 위에 놓여 있습니다. 서로 먼저 말을 꺼내지 않았습니다.'], ['아이 휴대폰 요금이 내 것보다 많이 나왔습니다. 데이터 무제한의 의미를 다시 생각합니다.', pay(4)], ['아이가 처음으로 저녁을 차려 줬습니다. 라면이었지만 계란이 두 개 들어 있었습니다.', hj(1.5)], ['아이 키가 나를 넘어섰습니다. 문틀에 그어 둔 연필 선이 더는 필요 없게 됐습니다.', hj(0.8)]]],
    [3, function (p) { return !!p.spouse; }, [['배우자가 말없이 야식을 사 왔습니다. 좋아하는 메뉴를 아직 기억하고 있었습니다.', mq(1.5)], ['생일 아침, 식탁에 미역국이 올라와 있었습니다. 간이 조금 짰지만 한 그릇을 다 비웠습니다.', mq(2)], ['배우자가 내 차에 기름을 가득 채워 놨습니다. 아무 말도 없었습니다. 그래서 더 고마웠습니다.', mq(1.5)], ['둘이 같은 드라마에 빠졌습니다. 다음 화를 먼저 보면 배신이라는 규칙이 생겼습니다.', mq(1.5)], ['퇴근길에 배우자와 동네를 한 바퀴 걸었습니다. 별 얘기는 안 했는데 집에 오니 마음이 가벼웠습니다.', mq(1.2)], ['아픈 날, 배우자가 죽을 끓여 줬습니다. 맛은 없었지만 그릇을 싹 비웠습니다.', mq(2)], ['배우자가 옛날 연애 시절 사진을 꺼내 왔습니다. 둘 다 지금보다 말랐고, 지금보다 철이 없었습니다.', mq(1.5)]], 'good'],
    [2, function (p) { return !!p.spouse; }, [['분리수거 당번을 두고 배우자와 말다툼을 했습니다. 이긴 사람은 없습니다.', mq(-1.5)], ['치약을 중간부터 짜느냐 끝부터 짜느냐. 결혼 생활의 오랜 쟁점이 다시 불거졌습니다.', mq(-1)], ['명절에 어느 집을 먼저 가느냐로 저녁 식탁이 조용해졌습니다.', mq(-2)], ['에어컨 온도를 두고 리모컨 쟁탈전이 벌어졌습니다. 24도와 27도 사이에 평화는 없습니다.', mq(-1)], ['이번 달 카드값을 같이 봤습니다. 서로의 항목에 밑줄을 그었습니다.', mq(-1.5)], ['"아무거나"라고 해서 아무거나 시켰더니 그건 아니라고 합니다.', mq(-0.8)]]],
    [3, function (p) { return p.fam.alive > 0 && p.home.type !== 'parents'; }, [['부모님이 반찬을 택배로 보내셨습니다. 상자 틈에 접힌 만 원짜리가 끼워져 있었습니다.', hj(0.7)], ['부모님 전화. "밥은 먹었니." 먹었다고 했습니다. 컵라면이었다는 말은 하지 않았습니다.', hj(0.3)], ['부모님이 스마트폰 사용법을 묻는 전화를 하셨습니다. 사십 분 동안 "아니, 그 옆에 거"를 반복했습니다.'], ['부모님 건강검진 결과가 나왔습니다. "별거 아니래"라는 말을 세 번 되물었습니다.'], ['부모님이 보내신 김치가 도착했습니다. 냉장고에 들어갈 자리가 없어 한참 테트리스를 했습니다.', hj(0.5)], ['부모님 댁 텔레비전이 고장 났다고 합니다. 새것을 주문해 드렸더니 "뭘 이런 걸" 하시며 좋아하셨습니다.', pay(60, 1)]], 'good'],
    [3, office, [['월요일 아침 회의가 한 시간 반으로 늘어났습니다. 결론은 "다음 주에 다시 보자"였습니다.', hj(-0.5)], ['퇴근 5분 전, 메신저가 울립니다. "잠깐 될까요?" 잠깐은 두 시간이었습니다.', hj(-0.6)], ['복합기가 또 걸렸습니다. 종이를 빼내는 법을 이제 사무실에서 제일 잘 압니다.'], ['인사평가 자기기술서를 씁니다. 1년 동안 한 일을 다섯 줄로 줄이니 허무합니다.'], ['엘리베이터에서 임원과 단둘이 탔습니다. 12층까지 가는 30초가 길었습니다.'], ['법인카드 영수증을 잃어버렸습니다. 경위서 양식이 따로 있다는 걸 처음 알았습니다.'], ['옆 팀 동기가 퇴사했습니다. 송별회에서 다들 "부럽다"고 했습니다. 진심 반, 인사 반이었습니다.']]],
    [2, proJob, [['예약이 한 달 뒤까지 찼습니다. 점심은 십 분 만에 삼각김밥으로 때웠습니다.', hj(-0.3)], ['오래 본 고객이 손편지를 두고 갔습니다. 서랍에 넣어 두고 힘든 날 꺼내 봅니다.', hj(1.5)], ['주말에 학회와 보수교육이 겹쳤습니다. 전문직의 공부는 면허를 딴 뒤에 시작됩니다.'], ['무리한 요구를 하는 사람과 한 시간을 씨름했습니다. 문이 닫히고 나서야 숨을 쉬었습니다.', hj(-0.8)], ['후배가 조언을 구하러 왔습니다. 내가 십 년 전에 하던 고민을 그대로 하고 있었습니다.', hj(0.5)], ['직원 월급과 임대료를 내고 나니 통장이 가벼워졌습니다. 간판의 무게를 실감합니다.']]],
    [2, function (p) { return jt(p) === 'biz'; }, [['단골이 가족을 데리고 왔습니다. "여기가 내가 말한 집이야." 서비스를 하나 더 냈습니다.', hj(1.2)], ['별점 하나짜리 리뷰가 달렸습니다. 답글을 세 번 썼다 지웠습니다.', hj(-1)], ['식자재 값이 또 올랐습니다. 메뉴판을 고칠지, 양을 줄일지 계산기를 두드립니다.'], ['아르바이트생이 문자 한 통으로 그만뒀습니다. 오늘은 혼자 뜁니다.', hj(-0.6)], ['비 오는 날, 손님이 한 테이블뿐이었습니다. 그 한 테이블이 그렇게 고마울 수 없었습니다.']]],
    [2.2, function (p) { return !!p.job; }, [['점심에 새로 생긴 식당에 갔습니다. 맛있었습니다. 이런 날은 오후가 조금 견딜 만합니다.', hj(0.8)], ['"덕분에 살았어요." 지나가며 들은 한마디가 종일 귀에 남았습니다.', hj(1)], ['출근길 지하철에서 자리가 났습니다. 오늘 운은 여기서 다 쓴 것 같습니다.', hj(0.4)], ['월급날입니다. 통장을 스쳐 간 돈의 행선지를 하나씩 확인했습니다.'], ['일하다 문득 창밖을 봤는데 해가 지고 있었습니다. 오늘 하늘을 본 건 이게 처음입니다.'], ['금요일 저녁, 약속이 취소됐습니다. 솔직히 조금 기뻤습니다.', hj(0.6)]]],
    [2, function (p) { return p.stock + p.coin > 500; }, [['', function (p, g) { var x = g.mkt && g.mkt.idx; return x == null ? null : x >= 0 ? '출근길에 계좌를 열어 봤습니다. 빨간색입니다. 커피를 한 사이즈 크게 시켰습니다.' : '출근길에 계좌를 열어 봤습니다. 파란색입니다. 앱을 조용히 닫았습니다.'; }], ['증권사 앱 알림을 껐습니다. 사흘 뒤 다시 켰습니다.'], ['유튜브 알고리즘이 온통 경제 채널입니다. 전문가 열 명의 전망이 열 가지입니다.'], ['배당금이 들어왔습니다. 치킨 한 마리 값이지만, 자는 동안 번 돈입니다.', gain(3)]]],
    [2, function (p) { return p.hab.ex; }, [['운동을 거르지 않은 지 꽤 됐습니다. 계단을 올라도 숨이 차지 않습니다.', hp(0.2)], ['체중계 숫자가 조금 내려갔습니다. 바지 허리에 손가락 하나가 들어갑니다.', hp(0.2)], ['운동 가기 싫은 날이었습니다. 그래도 갔습니다. 가고 나면 늘 가길 잘했다고 생각합니다.', hp(0.2)]], 'good'],
    [2, function (p) { return p.home.type === 'monthly' || p.home.type === 'jeonse'; }, [['윗집에서 새벽마다 발소리가 납니다. 쪽지를 쓸지 말지 사흘째 고민합니다.'], ['집주인이 "잠깐 통화 되느냐"고 문자를 보냈습니다. 답장하기 전에 심호흡을 했습니다.'], ['옆집이 이사를 갔습니다. 인사 한 번 못 한 이웃이었지만 복도가 조금 허전합니다.'], ['벽에 곰팡이가 피었습니다. 내 집이었다면 진작 고쳤을 텐데, 사진만 찍어 둡니다.']]],
    [2, function (p) { return p.occ === 'univ'; }, [['동아리 엠티에서 밤새 기타 소리를 들었습니다. 돌아오는 버스에서 다들 기절했습니다.', hj(0.8)], ['조별 과제 단톡방. 넷 중 둘은 읽기만 합니다. 발표는 결국 내가 맡았습니다.', hj(-0.5)], ['수강 정정 기간, 새로고침을 이백 번쯤 눌러 한 자리를 잡았습니다.', hj(0.5)], ['학식이 오백 원 올랐습니다. 총학생회 대자보가 붙었습니다.'], ['공강 시간에 잔디밭에 누웠습니다. 이런 오후가 다시 올까 싶었습니다.', hj(1)], ['과제 마감 십 분 전에 제출했습니다. 다음에는 미리 하겠다고 다짐합니다. 매번 합니다.']]],
    [2, function (p) { return p.age >= 60; }, [['병원 대기실에서 번호표를 뽑았습니다. 앞에 서른두 명. 옆자리 어르신과 날씨 얘기를 오래 했습니다.'], ['돋보기를 찾아 온 집을 뒤졌습니다. 머리 위에 걸려 있었습니다.'], ['오랜 친구에게서 전화가 왔습니다. 용건은 없었습니다. 그게 제일 반가운 전화입니다.', hj(1)], ['손주가 가르쳐 준 대로 영상 통화를 걸었습니다. 화면에 내 이마만 나왔습니다.', hj(0.6)], ['공원 벤치에 한참 앉아 있었습니다. 바쁘게 걷는 사람들을 보니 예전의 내가 보입니다.'], ['단골 약국 약사가 이름을 부르며 인사합니다. 좋은 일인지는 모르겠습니다.']]],
    [1.6, function (p) { return !p.spouse && p.home.type !== 'parents'; }, [['배달 최소 주문 금액을 채우려고 먹지도 않을 사이드 메뉴를 담았습니다.', pay(1)], ['혼자 고깃집에 갔습니다. 2인분부터 주문 가능이라 2인분을 먹었습니다.'], ['냉장고에서 정체 모를 반찬통이 나왔습니다. 열어 보지 않고 버렸습니다.'], ['일요일 저녁, 오늘 한마디도 안 했다는 걸 깨달았습니다. 편의점에서 "봉투 주세요"를 말했습니다.']]],
    [1.6, yes, [['점심값이 또 올랐습니다. 김치찌개 한 그릇에 만 원이 넘습니다.'], ['커피값이 오백 원 올랐습니다. 텀블러 할인으로 삼백 원을 지켰습니다.'], ['택시 기본요금에 놀라 한 정거장을 걸었습니다.'], ['미용실에서 "조금만 다듬어 주세요"라고 했습니다. 조금의 기준이 서로 달랐습니다.', hj(-0.4)], ['볼 영상을 고르다 한 시간이 갔습니다. 결국 예전에 본 걸 또 틀었습니다.'], ['새벽 세 시, 모기 한 마리와 전쟁을 치렀습니다. 불을 켜면 사라집니다.'], ['마트에서 장바구니에 담은 것의 절반은 계획에 없던 것입니다.', pay(4)]]]
  ];
  // 한 건을 고른다: 조건에 맞는 묶음 가운데 가중치로 뽑고, 그 안에서 최근에 안 나온 변형을 고른다
  function pickNews(g) {
    var p = g.p, r = p.rng, rec = p.fl.nwR = p.fl.nwR || [], tries = 0, c, n, i, v, k, t;
    c = NEWS.map(function (x, idx) { return [x, idx]; }).filter(function (x) { return x[0][1](p, g); });
    while (c.length && tries++ < 4) {
      n = U.wpick(r, c, c.map(function (x) { return x[0][0]; }));
      var vs = n[0][2].map(function (x, j) { return j; }).filter(function (j) { return rec.indexOf(n[1] + '.' + j) < 0; });
      if (!vs.length) { c = c.filter(function (x) { return x !== n; }); continue; }
      i = U.pick(r, vs); v = n[0][2][i]; k = n[1] + '.' + i;
      t = v[0]; if (typeof v[1] === 'function') { var o = v[1](p, g); if (typeof o === 'string') t += o; else if (o === null) { c = c.filter(function (x) { return x !== n; }); continue; } }
      rec.push(k); if (rec.length > RECENT) rec.shift();
      return { t: t, c: n[0][3] || 'amb' };
    }
    return null;
  }
  // 달에 맞는 조건부 계절 문장: [월, 조건, 문장]
  var MONX = [
    [1, function (p) { return !!p.job; }, '새해 첫 출근. 다이어리 첫 장에 "올해는 다르게"라고 적었습니다. 작년에도 적었던 말입니다.'],
    [2, function (p) { return !!p.spouse; }, '설 연휴. 양가를 오가느라 연휴가 출장 같았습니다. 전 부치는 냄새가 옷에 뱄습니다.'],
    [2, function (p) { return !p.spouse && !p.partner && p.age >= 28 && p.age < 45 && p.fam.alive > 0; }, '설날 밥상. "만나는 사람은 있니?" 떡국이 유난히 뜨거웠습니다.'],
    [3, function (p) { return p.occ === 'univ'; }, '개강했습니다. 캠퍼스에 새내기들의 과 잠바가 반짝입니다. 수강 신청은 올해도 전쟁이었습니다.'],
    [3, function (p) { return p.kids.some(function (k) { return k.age >= 7 && k.age < 19; }); }, '새 학기. 아이의 가방에서 가정통신문이 열 장쯤 나왔습니다. 준비물 목록이 깁니다.'],
    [4, function (p) { return !!p.partner; }, '벚꽃이 피었습니다. 둘이 걷는 길이 평소보다 느립니다. 사진첩에 꽃잎과 웃는 얼굴이 쌓입니다.'],
    [4, function (p) { return p.occ === 'univ'; }, '중간고사 기간에 벚꽃이 핍니다. 도서관 창밖으로 꽃비가 내립니다. 대학의 봄은 늘 이런 식입니다.'],
    [5, function (p) { return p.fam.alive > 0 && p.age >= 20; }, '어버이날. 카네이션과 봉투를 드렸습니다. "뭘 이런 걸"이라면서도 봉투는 금방 주머니로 들어갔습니다.'],
    [6, function (p) { return p.occ === 'univ'; }, '기말고사가 끝났습니다. 종강 총회에서 한 학기 치 이야기를 풀었습니다. 여름방학입니다.'],
    [7, office, '여름휴가 일정을 두고 팀원들과 눈치 게임을 했습니다. 남들 다 가는 8월 첫 주는 올해도 내 차지가 아닙니다.'],
    [7, function (p) { return p.kids.some(function (k) { return k.age >= 4 && k.age < 13 && k.withMe !== false; }); }, '아이들 방학이 시작됐습니다. 삼시 세끼와 "심심해"의 계절입니다.'],
    [8, function (p) { return p.home.type === 'monthly'; }, '에어컨을 켤지 말지 전기요금과 싸웁니다. 선풍기를 하나 더 샀습니다.'],
    [9, function (p) { return !!p.spouse; }, '추석 연휴. 귀성길 차 안에서 세 시간째 같은 노래를 듣습니다. 트렁크에는 선물 세트가 층층이 쌓였습니다.'],
    [9, function (p) { return p.occ === 'univ'; }, '2학기 개강, 그리고 축제 준비. 과 주점 메뉴를 정하느라 단톡방이 밤새 울립니다.'],
    [10, function (p) { return p.age >= 50; }, '단풍 구경을 다녀왔습니다. 올라갈 때보다 내려올 때 무릎이 더 아픕니다.'],
    [11, function (p) { return p.kids.some(function (k) { return k.age === 18; }); }, '아이의 수능이 이번 달입니다. 집 안에서 발소리를 죽이고 다닙니다. 미역국은 한 달째 금지입니다.'],
    [11, function (p) { return p.occ === 'prep'; }, '찬 바람이 붑니다. 독서실 창문에 김이 서립니다. 시험까지 남은 날짜를 다시 셉니다.'],
    [12, office, '송년회가 일주일에 세 번입니다. 건배사는 매번 같고, 다음 날 아침은 매번 다릅니다.'],
    [12, function (p) { return !p.spouse && !p.partner && p.age >= 20 && p.age < 45; }, '크리스마스이브. 거리의 연인들 사이를 이어폰을 끼고 걸었습니다. 케이크는 조각으로 샀습니다.'],
    [12, function (p) { return !!p.partner; }, '크리스마스. 예약 전쟁에서 겨우 이긴 식당에 마주 앉았습니다. 창밖에 눈이 조금 날렸습니다.']
  ];
  Sim.flavor = function (g) {
    var p = g.p, r = p.rng, m = g.mon, c, t = null, cls = 'sea';
    if (p.occ !== 'mil' && U.chance(r, D.QTR.newsP)) {
      var nw = pickNews(g); if (nw) { t = nw.t; cls = nw.c; }
      p.happy = clamp(p.happy, 2, 99); p.health = clamp(p.health, 3, 100);
    }
    if (!t) {     // 계절·일상 한 줄: 최근에 쓴 문장은 피한다
      cls = 'sea'; var mx = p.fl.mxR = p.fl.mxR || [], mi = p.fl.mi = p.fl.mi || {}, i;
      c = MONX.map(function (x, idx) { return idx; }).filter(function (idx) { return MONX[idx][0] === m && mx.indexOf(idx) < 0 && MONX[idx][1](p, g); });
      if (c.length && U.chance(r, 0.4)) { i = U.pick(r, c); mx.push(i); if (mx.length > 12) mx.shift(); t = MONX[i][2]; }
      else if (p.occ === 'mil' || U.chance(r, 0.12)) { var pool = T.AMB[Sim.ambKey(p)]; i = U.rint(r, 0, pool.length - 1); if (i === p.fl.ambM) i = (i + 1) % pool.length; p.fl.ambM = i; t = pool[i]; }
      else { var L = T.MON[m], used = mi[m] instanceof Array ? mi[m] : (mi[m] = []), free = L.map(function (x, idx) { return idx; }).filter(function (idx) { return used.indexOf(idx) < 0; }); i = U.pick(r, free.length ? free : [0]); used.push(i); if (used.length > L.length - 2) used.shift(); t = L[i]; }
    }
    p.cur.push({ t: t, c: cls });
  };

  /* ================= 연말 결산과 시황 ================= */
  Sim.snap = function (g) { var p = g.p; return p.age >= D.QTR.from && p.fl.ys ? p.fl.ys : null; };
  function pc(x) { return (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%'; }
  Sim.yearReport = function (g, s) {
    var p = g.p, w = g.w, a = p.age, m = w.macro[a], nw = Math.round(Sim.netWorth(p)), d = nw - s.nw, reg = p.home.region || p.region;
    p.cur.push({ t: a + '세 결산 · 순자산 ' + won(s.nw) + ' → ' + won(nw) + ' (' + (d >= 0 ? '+' : '−') + won(Math.abs(d)) + ')' + (Math.abs(s.gain) >= 10 ? ' · 투자 손익 ' + (s.gain >= 0 ? '+' : '−') + won(Math.abs(s.gain)) : '') + (Sim.rentInc(p) ? ' · 임대 수입 월 ' + won(Sim.rentInc(p) * (1 - D.BLD_COST)) : ''), c: 'rep' });
    var t = '올해의 시황 · 증시 ' + pc(m.stock) + ' · ' + D.REG[reg].short + ' 집값 ' + pc(w.hg[reg][a]) + ' · 대출 금리 연 ' + (Sim.loanRate(w, p) * 100).toFixed(1) + '%' + (m.k ? ' · ' + D.MACRO[m.k].name : '');
    if (a < 100) {     // 증권가 전망은 열 번에 일곱 번쯤 맞는다
      var v = w.macro[a + 1].stock, x = U.hash(w.seed + 'fc' + a) % 10 < 7 ? v : 0.05 - v;
      t += ' · 증권가의 내년 전망은 ' + (x > 0.12 ? '"강세장"' : x < -0.08 ? '"폭풍우"' : '"박스권"') + '입니다(전망은 자주 틀립니다).';
    }
    p.cur.push({ t: t, c: 'rep' });
    // 연말 결산 화면(ui.js)에 넘길 자료
    var J = p.job ? D.JOBS[p.job.k] : null, hv = Sim.houseVal(p) + (p.home.deposit || 0), fc = t.match(/내년 전망은 ("[^"]+")/);
    g.rep = { a: a, nw0: s.nw, nw1: nw, gain: Math.round(s.gain), save: Math.round(p.fl.save || 0), inc: Math.round(Sim.myInc(p) * 12), hh: Math.round(Sim.hhGross(p) * 12), job: Sim.occLabel(p),
      as: { home: Math.round(hv), inv: Math.round(Sim.gapEq(p) + Sim.bldVal(p)), cash: Math.round(p.cash), stock: Math.round(p.stock), coin: Math.round(p.coin), car: p.car ? Math.round(p.car.value) : 0, debt: Math.round(p.debt + (p.rm || 0)) },
      rent: Math.round(Sim.rentInc(p) * (1 - D.BLD_COST)), h0: s.h, h1: Math.round(p.happy), hp0: s.hp, hp1: Math.round(p.health),
      mk: { stock: m.stock, house: w.hg[reg][a], reg: D.REG[reg].short, rate: Sim.loanRate(w, p), k: m.k ? D.MACRO[m.k].name : '', coin: w.coin[a].r }, fc: fc ? fc[1] : '', hist: p.gN.slice(-12), rank: Sim.ranks(g, false).nw };
  };

  /* ================= 미니게임: 어떤 판정 앞에서 열리는지(화면은 ui.js) ================= */
  // seq 숫자 순서대로 누르기(시험·입시의 집중력), timing 타이밍 맞추기(면접·승진·고백의 한 방)
  var MG = { high: 'seq', admTarget: 'seq', barExam: 'seq', docSpec: 'seq', skillComp: 'timing', vocLife: 'timing', qDrive: 'timing', promo: 'timing', meet: 'timing', marry: 'timing', careerFail: 'timing', milCareer: 'timing', lawPath: 'timing', docPath: 'timing', openPro: 'timing', celebRole: 'timing', lvMeet: 'timing', heirProve: 'timing' };
  var MGK = { exam: 'seq', lawAdm: 'seq', grad: 'seq', phd: 'seq', abroadStudy: 'seq', hire: 'timing', hire2: 'timing', prof: 'timing', soldier: 'timing', celeb: 'timing' };
  Sim.miniType = function (v, o) {
    if (!v || !o || o.prob == null || o.dis) return null;
    return v.id === 'career' ? (MGK[o.kind] || null) : (MG[v.id] || null);
  };
})();
