/* ui.js — 화면, 저장/불러오기, 연출. 시뮬레이션 규칙은 전혀 없고 Sim.* 만 호출합니다. */
(function () {
  'use strict';
  var KEY = 'baeknyeon.save', SKEY = 'baeknyeon.settings', won = U.won;
  var $ = function (s) { return document.querySelector(s); };
  var g = null, busy = false, auto = false, skip = false, autoT = null, pre = null, tab = 'act', unit = 0.25;   // pre: 캐릭터 생성 중 상태
  var S = { mv: 0.5, sv: 0.6, mm: false, sm: false, skip: false, autoPick: false, spd: 'norm', mini: true, rep: true };
  var SPD = { slow: [2400, 2600], norm: [1300, 1500], fast: [450, 650] };     // 자동 진행 간격(ms): [성인기 한 달, 유년기 한 해]
  try { var ss = JSON.parse(localStorage.getItem(SKEY) || '{}'); for (var k in ss) S[k] = ss[k]; } catch (e) { }
  ['mv', 'sv', 'mm', 'sm'].forEach(function (k) { Snd.set(k, S[k]); });
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) { } }
  function save() { if (!g) return; try { localStorage.setItem(KEY, JSON.stringify(g)); } catch (e) { toast('저장 공간이 부족해 자동 저장에 실패했습니다'); } }
  function loadSave() { try { var o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && o.v === D.VERSION && o.p && o.w ? o : null; } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(id) { ['title', 'create', 'game', 'end'].forEach(function (x) { $('#scr-' + x).classList.toggle('on', x === id); }); $('#app').classList.toggle('wide', id === 'game'); }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
  function grade(v) { for (var i = 0; i < T.GRADE.length; i++) if (v >= T.GRADE[i][0]) return T.GRADE[i][1]; return ''; }
  function mny(v) { return '<span class="' + (v < 0 ? 'neg' : '') + '">' + won(v) + '</span>'; }

  /* ---------- 캐릭터 아이콘(인라인 SVG) ---------- */
  function avatar(stage, sex) {
    var cloth = { baby: '#f3b28a', kid: '#7fb46a', teen: '#5f86b5', youth: '#7a6fc0', middle: '#58706f', senior: '#a98c5c' }[stage];
    var hair = stage === 'senior' ? '#d5d2cc' : '#3a2f2a', h = { baby: 0.6, kid: 0.74, teen: 0.9, youth: 1, middle: 1, senior: 0.93 }[stage];
    var s = '<svg viewBox="0 0 40 56" aria-hidden="true"><g transform="translate(20 56) scale(' + h + ') translate(-20 -56)">';
    if (stage === 'teen') s += '<rect x="7" y="24" width="8" height="16" rx="3" fill="#39506b"/>';
    if (stage === 'senior') s += '<path d="M34 54V31q0-4-4-3" stroke="#7a5a35" stroke-width="2" fill="none" stroke-linecap="round"/>';
    s += '<rect x="14" y="40" width="5" height="15" rx="2" fill="#4a4a4a"/><rect x="21" y="40" width="5" height="15" rx="2" fill="#4a4a4a"/>';
    s += '<rect x="11" y="22" width="18" height="22" rx="6" fill="' + cloth + '"/>';
    if (stage === 'middle') s += '<path d="M20 23l-2 3 2 9 2-9z" fill="#b0483f"/>';
    if (stage === 'baby') s += '<circle cx="20" cy="30" r="3" fill="#fff" opacity=".7"/>';
    s += '<circle cx="20" cy="13" r="9" fill="#f1c9a5"/>';
    if (sex === 'F' && stage !== 'baby') s += '<path d="M11 12q-3 9 0 14l3-1q-2-6-1-12zM29 12q3 9 0 14l-3-1q2-6 1-12z" fill="' + hair + '"/>';
    s += '<path d="M11 12a9 9 0 0 1 18 0q-9-6-18 0z" fill="' + hair + '"/>';
    s += '<circle cx="17" cy="14" r="1.1" fill="#2a2927"/><circle cx="23" cy="14" r="1.1" fill="#2a2927"/><path d="M17.5 18q2.5 2 5 0" stroke="#2a2927" stroke-width="1" fill="none" stroke-linecap="round"/>';
    return s + '</g></svg>';
  }

  /* ---------- 타이틀 ---------- */
  function randSeed() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  // 타이틀 연출: 한 사람이 출발선에서 100세까지 달려가고, 지나는 자리마다 인생의 장면이 켜진다
  var TMS = [[0, '🍼'], [7, '🎒'], [19, '🎓'], [24, '💼'], [31, '💍'], [34, '👶'], [40, '🏠'], [55, '📈'], [65, '🎂'], [82, '🌅'], [100, '🏁']], titleT = null;
  var TFL = ['🎲', '🍼', '🎒', '📝', '🎓', '🪖', '💼', '💍', '🏠', '👶', '📈', '🚗', '🩺', '🌅', '💌', '🏅'];
  function stageOf(a) { return a < 4 ? 'baby' : a < 13 ? 'kid' : a < 19 ? 'teen' : a < 35 ? 'youth' : a < 60 ? 'middle' : 'senior'; }
  function titleAnim() {
    var age = 0, hold = 0, last = '', sex = Math.random() < 0.5 ? 'M' : 'F', run = $('#t-runner');
    $('#t-ms').innerHTML = TMS.map(function (m) { return '<i style="left:' + m[0] + '%" data-a="' + m[0] + '">' + m[1] + '</i>'; }).join('');
    $('#t-float').innerHTML = TFL.map(function (e, i) { return '<i style="left:' + (3 + (i * 37) % 94) + '%;animation-delay:-' + (i * 1.7) + 's;animation-duration:' + (11 + i % 5 * 2.2) + 's">' + e + '</i>'; }).join('');
    clearInterval(titleT);
    titleT = setInterval(function () {
      if (!$('#scr-title').classList.contains('on')) { clearInterval(titleT); return; }
      if (hold > 0) { if (--hold === 0) { age = 0; sex = sex === 'M' ? 'F' : 'M'; last = ''; [].forEach.call($('#t-ms').children, function (x) { x.classList.remove('on'); }); } return; }
      age = Math.min(100, age + 0.42); var st = stageOf(age);
      if (st !== last) { last = st; run.innerHTML = avatar(st, sex); document.body.dataset.stage = st; $('#t-stg').textContent = T.STAGE[st]; }
      run.style.left = age + '%'; $('#t-fill').style.width = age + '%'; $('#t-age').textContent = Math.floor(age);
      [].forEach.call($('#t-ms').children, function (x) { if (+x.dataset.a <= age) x.classList.add('on'); });
      if (age >= 100) hold = 28;
    }, 60);
  }
  function sndBtn() { $('#btn-snd').textContent = !Snd.ready() ? '🔈 음악 켜기' : S.mm ? '🔇 음악 꺼짐' : '🔊 음악 켜짐'; }
  function titleMusic() { Snd.unlock(); Snd.setMood('title'); sndBtn(); }
  function initTitle() {
    $('#btn-continue').hidden = !loadSave();
    document.body.dataset.stage = 'baby'; show('title'); Snd.setMood('title'); sndBtn(); titleAnim();
  }
  // 브라우저는 첫 클릭 전에는 소리를 내지 못한다. 타이틀 어디든 누르면 음악이 시작된다
  $('#scr-title').addEventListener('pointerdown', function () { if (!Snd.ready()) titleMusic(); });
  $('#btn-snd').onclick = function () { if (!Snd.ready()) return titleMusic(); S.mm = !S.mm; Snd.set('mm', S.mm); saveSettings(); sndBtn(); };
  $('#btn-continue').onclick = function () { Snd.unlock(); Snd.sfx('click'); g = loadSave(); if (!g) return initTitle(); if (g.over) showEnding(); else enterGame(); };
  $('#btn-new').onclick = function () {
    Snd.unlock(); Snd.sfx('click');
    if (loadSave() && !confirm('저장된 인생이 있습니다. 새 인생을 시작하면 이전 기록은 사라집니다. 계속할까요?')) return;
    // 시드는 입력받지 않는다. 같은 출발선을 다시 살아 보려면 주소 뒤에 ?seed=ABC123-0-M 을 붙인다
    var raw = '', m; try { raw = (new URLSearchParams(location.search).get('seed') || '').trim().replace(/#/g, ''); } catch (e) { }
    m = raw.match(/^(.+?)-(\d+)(?:-([MFmf]))?$/);
    pre = { seed: m ? m[1] : (raw || randSeed()), idx: m ? +m[2] : 0, name: '', sex: m && m[3] ? m[3].toUpperCase() : '', diff: 0 };
    modal('<h2>이름을 지어 주세요</h2><p class="fine">곧 태어날 아이의 이름입니다. 비워 두면 부모님이 지어 줍니다.</p>' +
      '<input id="nm-in" class="nm-in" maxlength="8" placeholder="예: 김민수" autocomplete="off">' +
      '<div class="end-btns"><button class="btn" id="nm-rand">부모님께 맡긴다</button><button class="btn primary" id="nm-ok">주사위 굴리러 가기 🎲</button></div>');
    function go(useName) { pre.name = useName ? $('#nm-in').value.trim() : ''; closeModal(); show('create'); rollShow(); }
    $('#nm-ok').onclick = function () { Snd.sfx('click'); go(true); }; $('#nm-rand').onclick = function () { Snd.sfx('click'); go(false); };
    $('#nm-in').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(true); } };
    setTimeout(function () { var i = $('#nm-in'); if (i) i.focus(); }, 60);
  };
  /* ---------- 캐릭터 생성 ---------- */
  // 같은 규칙으로 굴린 표본 4,000명과 비교해 이번 주사위가 상위 몇 %인지 계산한다
  var DIST = null;
  function famScore(q) { return q.fam.assets + q.fam.inc * 120; }
  function abScore(q) { var s = q.st; return s.iq + s.looks + s.stamina + s.dil + s.social + s.talent; }
  function below(arr, v) { var lo = 0, hi = arr.length; while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / arr.length; }
  function rollPct(p) {
    var num = function (a, b) { return a - b; };
    if (!DIST) {
      var F = [], A = [], i, q; for (i = 0; i < 4000; i++) { q = Sim.rollPerson('pct#' + i, false); F.push(famScore(q)); A.push(abScore(q)); }
      var Fs = F.slice().sort(num), As = A.slice().sort(num);
      DIST = { F: Fs, A: As, C: F.map(function (_, k) { return below(Fs, F[k]) + below(As, A[k]); }).sort(num) };
    }
    var f = below(DIST.F, famScore(p)), a = below(DIST.A, abScore(p));
    function top(x) { var v = Math.min(99, Math.max(0.1, (1 - x) * 100)); return v < 1 ? v.toFixed(1) : Math.round(v); }
    return { fam: top(f), ab: top(a), all: top(below(DIST.C, f + a)) };
  }
  function statRow(label, v, text) { return '<div class="stat"><span>' + label + '</span><div class="bar"><i style="width:' + v + '%"></i></div><small>' + text + '</small></div>'; }
  function rollShow() {
    var p = Sim.rollPerson(pre.seed + '#p' + pre.idx, true, pre.name || null, pre.sex), f = p.fam, C = D.CLASS[f.cls], s = p.st, body = $('#create-body'), dr = $('#dice-row');
    pre.p = p; body.innerHTML = ''; diffShow(); [].forEach.call(document.querySelectorAll('#sex-pick button'), function (b) { b.classList.toggle('on', b.dataset.sex === pre.sex); });
    var avg = Math.round((s.iq + s.looks + s.stamina + s.dil + s.social + s.talent) / 6); $('#btn-start').disabled = true; $('#btn-reroll').disabled = true;
    dr.innerHTML = [0, 1, 2, 3, 4].map(function () { return '<div class="die roll">?</div>'; }).join(''); Snd.sfx('dice');
    var faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'], spin = setInterval(function () { [].forEach.call(dr.children, function (d) { d.textContent = faces[Math.floor(Math.random() * 6)]; }); }, 80);
    setTimeout(function () {
      clearInterval(spin); var vals = [f.cls, Math.ceil(s.iq / 17), Math.ceil(s.dil / 17), Math.ceil(s.social / 17), Math.ceil(s.looks / 17)];
      [].forEach.call(dr.children, function (d, i) { d.classList.remove('roll'); d.textContent = faces[Math.min(5, Math.max(0, vals[i] - 1))]; });
      var pc = rollPct(p);
      body.innerHTML = '<div class="pctl"><b>종합 상위 ' + pc.all + '%</b><span>집안 상위 ' + pc.fam + '% · 능력 상위 ' + pc.ab + '% · 같은 주사위를 굴린 4,000명과 비교</span></div>' +
        '<div class="cc"><h3>집안</h3><div class="who">' + C.name + ' · ' + C.nick + '</div>' +
        '<div class="kv"><span>부모 순자산</span><b>' + won(f.assets) + '</b></div><div class="kv"><span>부모 월소득</span><b>' + won(f.inc) + '</b></div>' +
        '<div class="kv"><span>부모 직업</span><b>' + f.job + '</b></div><div class="kv"><span>부모 학력</span><b>' + D.PARENT_EDU[f.edu] + '</b></div>' +
        '<div class="kv"><span>교육열</span><b>' + f.zeal + ' / 100</b></div><div class="kv"><span>가정 화목도</span><b>' + f.harmony + ' / 100</b></div>' +
        '<div class="kv"><span>출생지</span><b>' + D.REG[f.region].name + '</b></div><div class="kv"><span>형제자매</span><b>' + (f.sib ? f.sib + '명' : '외동') + '</b></div></div>' +
        '<div class="cc" style="animation-delay:.12s"><div class="avg" title="여섯 능력치의 평균"><b>' + avg + '</b><small>평균</small></div><h3>능력</h3><div class="who">' + esc(p.name) + ' · ' + (p.sex === 'M' ? '남성' : '여성') + '</div>' +
        statRow('지능', s.iq, grade(s.iq) + ' ' + s.iq) + statRow('외모', s.looks, grade(s.looks) + ' ' + s.looks) + statRow('체력', s.stamina, grade(s.stamina) + ' ' + s.stamina) +
        statRow('성실성', s.dil, grade(s.dil) + ' ' + s.dil) + statRow('사교성', s.social, grade(s.social) + ' ' + s.social) + statRow('예체능 재능', s.talent, grade(s.talent) + ' ' + s.talent) +
        '<div class="kv"><span>성인 키(예상)</span><b>' + s.height + 'cm</b></div><div class="kv"><span>숨은 운</span><b>???</b></div></div>';
      var left = D.REROLLS ? D.REROLLS - pre.idx : Infinity;
      $('#btn-reroll').textContent = D.REROLLS ? '다시 굴리기 (' + left + '회 남음)' : '다시 굴리기 (' + (pre.idx + 1) + '번째 주사위)'; $('#btn-reroll').disabled = left <= 0; $('#btn-start').disabled = false;
      $('#create-seed').textContent = '시드 ' + pre.seed + '-' + pre.idx + (pre.sex ? '-' + pre.sex : '') + ' · 능력치 50이 평균이며, 대부분의 사람은 35~65 사이입니다.';
      Snd.sfx(f.cls >= 4 ? 'ok' : 'click');
    }, 950);
  }
  $('#btn-reroll').onclick = function () { if (D.REROLLS && pre.idx >= D.REROLLS) return; pre.idx++; rollShow(); };
  [].forEach.call(document.querySelectorAll('#sex-pick button'), function (b) { b.onclick = function () { if (pre.sex === b.dataset.sex) return; pre.sex = b.dataset.sex; rollShow(); }; });
  var DIFF_DESC = { '2': '거의 모든 일이 뜻대로 풀립니다. 입시·취업·시험·승진·연애 판정에서 실패 확률의 70%가 성공으로 바뀌고(선택지에 "축복 +N%p"로 표시), 질병·이별·해고 같은 나쁜 일은 5분의 1로 줄어듭니다. 능력치가 낮아도 임원까지 올라갑니다.',
    '1': '입시·취업·시험·승진·연애까지 모든 판정이 쉬워집니다(실패 확률의 40%가 성공으로 바뀌고, 선택지에 "쉬움 +N%p"로 표시). 질병·이별·해고 같은 나쁜 일도 절반으로 줄어듭니다.', '0': '현실에 가까운 확률 그대로입니다.', '-1': '모든 판정 확률이 20% 깎이고, 해고와 나쁜 일이 잦아집니다.' };
  function diffShow() { [].forEach.call(document.querySelectorAll('#diff-pick button'), function (b) { b.classList.toggle('on', +b.dataset.diff === (pre.diff || 0)); }); $('#diff-desc').textContent = '난이도: ' + DIFF_DESC[pre.diff || 0]; }
  [].forEach.call(document.querySelectorAll('#diff-pick button'), function (b) { b.onclick = function () { pre.diff = +b.dataset.diff; Snd.sfx('click'); diffShow(); }; });
  $('#btn-start').onclick = function () { Snd.sfx('click'); g = Sim.newGame(pre.seed, pre.idx, pre.name || null, pre.sex, pre.diff || 0); save(); enterGame(); };

  /* ---------- 본 게임 ---------- */
  function enterGame() { $('#log').innerHTML = ''; skip = false; show('game'); hideDec(); syncLog(); renderStatus(); if (g.p.age < 0) step(); else pump(); }
  function moodOf(p) { var a = p.age; if (a < 4) return 'baby'; if (a < 13) return 'child'; if (a === 18 || ((p.occ === 'resu' || p.occ === 'prep') && a >= 18 && a < 36)) return 'exam'; if (a < 19) return 'teen'; if (a < 30) return 'youth'; if (a < 45) return 'work'; if (a < 60) return 'mid'; if (a < 80) return 'elder'; return 'late'; }
  function familyLine(p) {
    var a = [];
    if (p.age < 19) { a.push('부모님과 거주'); a.push(p.fam.sib ? '형제자매 ' + p.fam.sib + '명' : '외동'); return a.join(' · '); }
    a.push(p.spouse ? '기혼(' + esc(p.spouse.name) + ')' : p.partner ? '연애 중(' + esc(p.partner.name) + ' ♥' + Math.round(p.partner.aff == null ? 55 : p.partner.aff) + ')' : p.widowed ? '사별' : p.divorces ? '이혼' : p.noMarry ? '비혼' : '미혼');
    if (p.kids.length) a.push('자녀 ' + p.kids.length + '명(' + p.kids.map(function (k) { return k.age + '세'; }).join('·') + ')'); if (p.fl.grand) a.push('손주 ' + p.fl.grand + '명');
    if (p.fam.alive > 0) a.push('부모 ' + p.fam.alive + '분 생존');
    a.push(Sim.homeLabel(p)); if (p.car) a.push(D.CARS[p.car.k].name); else if (p.fl.drv) a.push('면허 있음'); return a.join(' · ');
  }
  function chip(ic, label, v, cls) { return '<span class="' + (cls || '') + '"><i>' + ic + '</i>' + label + ' <b>' + won(v) + '</b></span>'; }
  function renderStatus() {
    var p = g.p, stg = Sim.stage(p), a = Math.max(0, p.age), inc = Sim.myInc(p), re = Sim.realEstate(p), debt = p.debt + (p.rm || 0);
    document.body.dataset.stage = stg; Snd.setMood(moodOf(p));
    $('#status').innerHTML =
      '<div class="st-top">' + avatar(stg, p.sex) + '<div class="st-name"><b>' + esc(p.name) + '</b>' + (p.fl.diff ? '<small class="dtag ' + (p.fl.diff > 0 ? 'easy' : 'hard') + '">' + D.DIFF[p.fl.diff].name.replace(/ \(.*/, '') + '</small>' : '') + '<span class="job">' + esc(Sim.occLabel(p)) + (p.job && p.job.co && D.JOBS[p.job.k].type === 'corp' ? ' · ' + D.JOBS[p.job.k].name : '') + '</span></div>' +
      '<div class="st-age">' + a + '세<small>' + T.STAGE[stg] + (Sim.isQ(g) && p.phase === 'mid' ? ' · ' + g.mon + '월' : '') + '</small></div></div>' +
      (p.age < 19 ? '<div class="st-grid"><div><span class="k">집안</span><span class="v">' + D.CLASS[p.fam.cls].name + ' ' + D.CLASS[p.fam.cls].nick + '</span></div><div><span class="k">부모 월소득</span><span class="v">' + won(p.fam.inc) + '</span></div></div><div class="st-sub">월소득 0원 · 순자산 0원 (현금·주식·부동산·부채 없음) · 부모 자산 ' + won(p.fam.assets) + '</div>' :
      '<div class="st-grid"><div><span class="k">월소득</span><span class="v">' + won(inc) + (inc > 0 ? ' <small>연봉 ' + won(inc * 12) + '</small>' : '') + '</span></div><div><span class="k">순자산</span><span class="v">' + mny(Sim.netWorth(p)) + '</span></div></div>' +
      '<div class="st-as">' + chip('🏠', '부동산', re) + chip('💵', '현금', p.cash) + chip('📈', '주식', p.stock) + (p.coin >= 1 ? chip('🪙', '코인', p.coin) : '') + (p.car ? chip('🚗', '자동차', p.car.value) : '') + (debt >= 1 ? chip('💳', '부채', debt, 'neg') : '') + (p.spouse && p.spouse.works ? chip('💑', '배우자 월', p.spouse.inc) : '') + '</div>') +
      '<div class="st-bars"><div class="row"><span>건강</span><div class="bar hp"><i style="width:' + p.health + '%"></i></div><span>' + Math.round(p.health) + '</span></div>' +
      '<div class="row"><span>행복</span><div class="bar joy"><i style="width:' + p.happy + '%"></i></div><span>' + Math.round(p.happy) + '</span></div></div>' +
      '<div class="st-sub">학력 ' + esc(Sim.eduLabel(p)) + '</div><div class="st-sub">' + familyLine(p) + '</div>';
    var q = Sim.isQ(g);
    $('#btn-next').textContent = q && p.phase === 'mid' && g.mon < 12 ? '다음 달 ▶' : '다음 해 ▶'; $('#btn-year').hidden = !q;
    renderSide();
  }
  function yearCard(age, lines, tmp) {
    var d = document.createElement('div'); d.className = 'yr' + (tmp ? ' tmp' : '');
    d.innerHTML = '<h3>' + age + '세</h3>' + lines.map(function (l) { return '<p class="' + (l.c || '') + '">' + esc(l.t) + '</p>'; }).join('');
    return d;
  }
  function syncLog() {
    var p = g.p, L = $('#log'), tmp = L.querySelector('.tmp'); if (tmp) tmp.remove();
    for (var i = L.querySelectorAll('.yr').length; i < p.log.length; i++) L.appendChild(yearCard(p.log[i].a, p.log[i].l));
    if (p.phase === 'mid' && p.cur.length) L.appendChild(yearCard(p.age, p.cur, true));
    L.scrollTop = L.scrollHeight;
  }
  function pbClass(v) { return v >= 0.6 ? 'hi' : v >= 0.3 ? 'mid' : 'lo'; }
  // 난이도 보정 표시: "쉬움 +12%p"
  function dtag(o) { var d = g && g.p.fl.diff, x; if (!d || o.base == null || o.prob == null) return ''; x = U.pct(o.prob) - U.pct(o.base); return x ? '<small class="dtag ' + (d > 0 ? 'easy' : 'hard') + '">' + D.DIFF[d].tag + ' ' + (x > 0 ? '+' : '−') + Math.abs(x) + '%p</small>' : ''; }
  function optHtml(o) {
    var pb = o.prob != null ? '<span class="pb ' + pbClass(o.prob) + '">' + dtag(o) + (o.prob < 0.01 ? '1% 미만' : U.pct(o.prob) + '%') + '</span>' : '';
    var chips = o.stats && o.stats.length && !o.dis ? '<div class="chips">' + o.stats.map(function (s) { return '<i>' + T.STAT[s] + '</i>'; }).join('') + '</div>' : '';
    return '<button class="opt' + (o.dis ? ' dis' : '') + (o.face ? ' hasface' : '') + '" data-k="' + esc(o.key) + '"' + (o.dis ? ' disabled' : '') + '>' + (o.face ? '<span class="face">' + o.face + '</span>' : '') + '<div class="ob"><div class="ol"><span class="lab">' + esc(o.label) + '</span>' + pb + '</div>' +
      (o.dis ? '<div class="od">' + esc(o.dis) + '</div>' : o.desc ? '<div class="od">' + esc(o.desc) + '</div>' : '') + chips + '</div></button>';
  }
  function showDec(v) {
    var el = $('#dec'), h = '<div class="dec-h"><span>' + v.icon + '</span>' + esc(v.title) + '</div><p class="dec-d">' + (v.face ? '<span class="dface">' + v.face + '</span>' : '') + esc(v.desc) + '</p>';
    if (v.grouped) ['현재', '취업', '시험', '진학', '내 일', '쉼'].forEach(function (gname) { var os = v.opts.filter(function (o) { return o.grp === gname; }); if (os.length) h += '<div class="grp">' + gname + '</div>' + os.map(optHtml).join(''); });
    else h += v.opts.map(optHtml).join('');
    el.innerHTML = h; el.hidden = false; el.scrollTop = 0; $('#side').classList.add('lock'); $('#side').classList.remove('open'); $('#actions').hidden = true; $('#actions').style.display = 'none';
    [].forEach.call(el.querySelectorAll('.opt:not(.dis)'), function (b) { b.onclick = function () { choose(b.dataset.k); }; });
  }
  function hideDec() { $('#side').classList.remove('lock'); $('#dec').hidden = true; $('#dec').innerHTML = ''; $('#actions').hidden = false; $('#actions').style.display = ''; }
  function step() {
    if (busy || !g || g.over) return;
    if (g.p.phase === 'mid' && Sim.view(g.p, g.w)) return pump();
    var r = Sim.advance(g); if (r !== 'q') Snd.sfx('year'); if (r === 'year' || r === 'closed') skip = false;
    if (g.over) { setAuto(false); save(); syncLog(); renderStatus(); setTimeout(showEnding, 900); return; }
    if (r === 'year' && S.rep && g.rep && g.rep.a === g.p.age - 1 && !(auto && S.autoPick)) { clearTimeout(autoT); save(); syncLog(); renderStatus(); busy = true; return showReport(g.rep, function () { busy = false; pump(); }); }
    pump();
  }
  /* ---------- 연말 결산 화면 ---------- */
  function dlt(v, unit) { return '<span class="' + (v < 0 ? 'dn' : 'up') + '">' + (v >= 0 ? '▲ ' : '▼ ') + (unit != null ? Math.abs(v) + unit : won(Math.abs(v))) + '</span>'; }
  function pctS(x) { return '<span class="' + (x < 0 ? 'dn' : 'up') + '">' + (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + '%</span>'; }
  function repSpark(h, a) {
    var W = 520, Hh = 120, n = h.length; if (n < 2) return '';
    var mx = Math.max.apply(null, h.concat([0])), mn = Math.min.apply(null, h.concat([0])), sp = (mx - mn) || 1, bw = (W - 30) / n, y = function (v) { return 12 + (Hh - 40) * (1 - (v - mn) / sp); }, y0 = y(0), s = '<svg class="rep-sp" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="최근 순자산 추이">';
    h.forEach(function (v, i) {
      var x = 15 + bw * i + bw * 0.15, yy = y(v), last = i === n - 1;
      s += '<rect class="' + (last ? 'now' : '') + (v < 0 ? ' neg' : '') + '" x="' + x.toFixed(1) + '" y="' + Math.min(yy, y0).toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + Math.max(1.5, Math.abs(y0 - yy)).toFixed(1) + '" rx="3" style="animation-delay:' + (i * 0.05) + 's"/>';
      if (i === 0 || last || (n - 1 - i) % 3 === 0) s += '<text x="' + (x + bw * 0.35).toFixed(1) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + (a - (n - 1 - i)) + '세</text>';
    });
    return s + '<line x1="10" x2="' + (W - 10) + '" y1="' + y0.toFixed(1) + '" y2="' + y0.toFixed(1) + '"/></svg>';
  }
  function showReport(R, cb) {
    var fx = $('#fx'), d = R.nw1 - R.nw0, A = R.as, done = false;
    var parts = [['🏠 집·보증금', A.home, '#c58b4e'], ['🏢 투자 부동산', A.inv, '#8a6fb0'], ['💵 현금', A.cash, '#4f9d7a'], ['📈 주식', A.stock, '#c9574f'], ['🪙 코인', A.coin, '#d9a93a'], ['🚗 자동차', A.car, '#5b8fc7']].filter(function (x) { return x[1] >= 1; });
    var tot = parts.reduce(function (s, x) { return s + x[1]; }, 0);
    function kv(k, v) { return '<div><span>' + k + '</span><b>' + v + '</b></div>'; }
    var h = '<div class="fx-card rep"><div class="rep-h"><small>한 해가 저물었습니다</small><b>' + R.a + '세 결산</b><span>' + esc(R.job) + '</span></div>' +
      '<div class="rep-nw"><small>순자산</small><div><i>' + won(R.nw0) + '</i> → <b class="' + (R.nw1 < 0 ? 'neg' : '') + '">' + won(R.nw1) + '</b></div><div class="rep-d">' + dlt(d) + ' · 또래 ' + R.rank.n + '명 중 ' + R.rank.rank + '위 (상위 ' + R.rank.pct + '%)</div></div>' +
      '<div class="rep-sec">최근 순자산 추이</div>' + repSpark(R.hist, R.a) +
      '<div class="rep-sec">자산 구성' + (tot ? ' · 합계 ' + won(tot) : '') + '</div>' + (tot ? '<div class="rep-bar">' + parts.map(function (x) { return '<i style="width:' + (x[1] / tot * 100).toFixed(1) + '%;background:' + x[2] + '"></i>'; }).join('') + '</div><div class="rep-lg">' + parts.map(function (x) { return '<span><i style="background:' + x[2] + '"></i>' + x[0] + ' <b>' + won(x[1]) + '</b> <em>' + Math.round(x[1] / tot * 100) + '%</em></span>'; }).join('') + '</div>' : '<p class="fine">가진 자산이 없습니다.</p>') +
      (A.debt >= 1 ? '<div class="rep-debt">💳 부채 <b>' + won(A.debt) + '</b>' + (tot ? ' · 자산의 ' + Math.round(A.debt / tot * 100) + '%' : '') + '</div>' : '') +
      '<div class="rep-sec">올해의 살림</div><div class="rep-grid">' + kv('내 소득(세전, 연)', won(R.inc)) + (R.hh !== R.inc ? kv('가구 소득(연)', won(R.hh)) : '') + kv(R.save >= 0 ? '쓰고 남긴 돈' : '모자란 돈', '<span class="' + (R.save < 0 ? 'dn' : '') + '">' + won(Math.abs(R.save)) + '</span>') + kv('투자 손익', dlt(R.gain)) + (R.rent ? kv('임대 수입(월)', won(R.rent)) : '') + kv('행복', R.h0 + ' → ' + R.h1 + ' ' + (R.h1 !== R.h0 ? dlt(R.h1 - R.h0, '') : '')) + kv('건강', R.hp0 + ' → ' + R.hp1 + ' ' + (R.hp1 !== R.hp0 ? dlt(R.hp1 - R.hp0, '') : '')) + '</div>' +
      '<div class="rep-sec">올해의 시황' + (R.mk.k ? ' · ' + R.mk.k : '') + '</div><div class="rep-grid">' + kv('증시', pctS(R.mk.stock)) + kv(R.mk.reg + ' 집값', pctS(R.mk.house)) + kv('코인', pctS(R.mk.coin)) + kv('대출 금리', '연 ' + (R.mk.rate * 100).toFixed(1) + '%') + '</div>' +
      (R.fc ? '<p class="fine">증권가의 내년 전망은 ' + esc(R.fc) + '입니다. 전망은 열 번에 세 번쯤 틀립니다.</p>' : '') +
      '<button class="btn primary" id="rep-go" style="width:100%;margin-top:14px">' + (R.a + 1) + '세 맞이하기 ▶</button></div>';
    fx.innerHTML = h; fx.hidden = false; Snd.sfx('year');
    function go() { if (done) return; done = true; fx.hidden = true; fx.innerHTML = ''; cb(); }
    var b = $('#rep-go'); b.onclick = go; b.focus();
    // 자동 진행 중이어도 결산은 버튼을 눌러야 넘어간다. 누르면 자동 진행이 이어진다
  }
  function pump() {
    var p = g.p, v = Sim.view(p, g.w);
    while (v && auto && S.autoPick) { Sim.choose(p, g.w, Sim.auto(p, v).key); v = Sim.view(p, g.w); }
    if (v) { clearTimeout(autoT); syncLog(); renderStatus(); showDec(v); save(); return; }     // 자동 진행은 끄지 않는다. 고르고 나면 이어서 흐른다
    hideDec(); if (!Sim.isQ(g) && p.phase === 'mid') Sim.closeYear(g);     // 유년기는 1년 단위, 성인기는 분기마다 멈춘다
    save(); syncLog(); renderStatus();
    if (g.over) { setAuto(false); setTimeout(showEnding, 900); return; }
    clearTimeout(autoT); if (auto || skip) autoT = setTimeout(step, auto && S.autoPick ? 90 : skip ? 110 : (SPD[S.spd] || SPD.norm)[Sim.isQ(g) ? 0 : 1]);
  }
  function choose(key) {
    if (busy) return; busy = true;
    var v = Sim.view(g.p, g.w), o = null; if (v) v.opts.forEach(function (x) { if (x.key === key) o = x; });
    var mt = S.mini && !S.skip && Sim.miniType ? Sim.miniType(v, o) : null;
    function fin(b) { var res = Sim.choose(g.p, g.w, key, b); hideDec(); $('#actions').style.display = 'none'; syncLog(); renderStatus(); showFx(res, function () { busy = false; pump(); }); }
    if (!mt) return fin(0);
    hideDec(); $('#actions').style.display = 'none'; playMini(mt, o, fin);
  }
  /* ---------- 미니게임: 잘하면 성공 확률이 최대 +10%p ---------- */
  function playMini(type, o, cb) {
    var fx = $('#fx'), done = false, raf = 0, tmr = 0, stop = null;
    function finish(b) {
      if (done) return; done = true; cancelAnimationFrame(raf); clearInterval(tmr); document.removeEventListener('keydown', onKey, true);
      var m = $('#mg-msg'); if (m) { m.textContent = b > 0 ? '성공 확률 +' + Math.round(b * 100) + '%p!' : '보너스 없음'; m.className = 'mg-msg ' + (b > 0 ? 'ok' : 'no'); }
      Snd.sfx(b > 0 ? 'ok' : 'click'); setTimeout(function () { fx.hidden = true; fx.innerHTML = ''; cb(b); }, 800);
    }
    function onKey(e) { if ((e.key === ' ' || e.key === 'Enter') && stop) { e.preventDefault(); e.stopPropagation(); stop(); } }
    var head = '<div class="fx-card mg"><div class="ic">🎯</div><div class="what">' + esc(o.label) + ' · 지금 성공 확률 ' + U.pct(o.prob) + '%</div><h3>' + (type === 'seq' ? '집중력 — 1부터 9까지 순서대로 누르세요' : '타이밍 — 바늘이 가운데 왔을 때 멈추세요') + '</h3><p class="fine">잘할수록 성공 확률이 오릅니다(최대 +10%p). 못해도 깎이지는 않습니다.</p>';
    var tail = '<div id="mg-msg" class="mg-msg"></div><button class="btn small ghost" id="mg-skip">건너뛰기 (보너스 없음)</button></div>';
    if (type === 'timing') {
      fx.innerHTML = head + '<div class="mg-bar"><span class="z3"></span><span class="z2"></span><span class="z1"></span><i id="mg-pin"></i></div><button class="btn primary" id="mg-stop" style="width:100%">멈춰!</button>' + tail;
      var t0 = performance.now(), per = 1000 + Math.random() * 500, pos = 0, pin = $('#mg-pin');
      var loop = function (now) { var x = ((now - t0) % per) / per; pos = x < 0.5 ? x * 200 : (1 - x) * 200; pin.style.left = pos + '%'; if (!done) raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      stop = function () { var d = Math.abs(pos - 50); finish(d <= 4 ? 0.1 : d <= 10 ? 0.07 : d <= 18 ? 0.04 : d <= 28 ? 0.02 : 0); };
      $('#mg-stop').onclick = stop;
    } else {
      var nums = [1, 2, 3, 4, 5, 6, 7, 8, 9], i, j, x, next = 1, LIM = 9000, st = performance.now();
      for (i = 8; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); x = nums[i]; nums[i] = nums[j]; nums[j] = x; }
      fx.innerHTML = head + '<div class="mg-time"><i id="mg-t"></i></div><div class="mg-grid">' + nums.map(function (n) { return '<button data-n="' + n + '">' + n + '</button>'; }).join('') + '</div>' + tail;
      [].forEach.call(fx.querySelectorAll('.mg-grid button'), function (b) {
        b.onclick = function () {
          if (done) return;
          if (+b.dataset.n !== next) { b.classList.add('bad'); setTimeout(function () { b.classList.remove('bad'); }, 250); st -= 600; return; }
          b.classList.add('hit'); b.disabled = true; Snd.sfx('click'); next++;
          if (next > 9) { var el = performance.now() - st; finish(el <= 4200 ? 0.1 : el <= 5800 ? 0.07 : el <= 7500 ? 0.04 : 0.02); }
        };
      });
      tmr = setInterval(function () { var el = performance.now() - st, bar = $('#mg-t'); if (bar) bar.style.width = Math.max(0, 100 - el / LIM * 100) + '%'; if (el >= LIM) finish(next > 7 ? 0.02 : 0); }, 50);
    }
    $('#mg-skip').onclick = function () { finish(0); };
    document.addEventListener('keydown', onKey, true); fx.hidden = false;
  }
  function setAuto(on) { auto = on; clearTimeout(autoT); $('#btn-auto').classList.toggle('on', on); $('#btn-auto').textContent = on ? '멈춤 ⏸' : '자동 ⏩'; }
  $('#btn-next').onclick = function () { Snd.unlock(); setAuto(false); skip = false; step(); };
  $('#btn-year').onclick = function () { Snd.unlock(); setAuto(false); skip = true; step(); };
  $('#btn-auto').onclick = function () { Snd.unlock(); skip = false; setAuto(!auto); if (auto) step(); };

  /* ---------- 오른쪽 패널: 자유 행동·투자 ---------- */
  function chg(v) { return '<span class="chg ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '▲' : '▼') + Math.abs(v * 100).toFixed(1) + '%</span>'; }
  function dots(n, m) { var s = '', i; for (i = 0; i < m; i++) s += i < n ? '●' : '○'; return s; }
  function renderSide() {
    var el = $('#side-body'), p = g.p;
    if (!Sim.isQ(g) || p.phase !== 'mid') {
      $('#side-t').textContent = '행동·투자';
      el.innerHTML = '<p class="fine">열아홉 살부터는 한 달씩 시간이 흐릅니다. 달마다 행동력이 하나씩 쌓이고(최대 ' + D.QTR.apMax + '), 자유 행동(소개팅, 부업, 운동, 이직, 집·차 알아보기…)에 씁니다. 주식·코인·부동산·대출도 직접 굴릴 수 있습니다.</p>'; return;
    }
    $('#side-t').textContent = p.age + '세 ' + g.mon + '월';
    var h = '<div class="q-top"><span>행동력 <small>매달 +' + D.QTR.ap + '</small></span><span class="ap">' + dots(g.ap, D.QTR.apMax) + '</span></div>' +
      '<div class="tabs"><button data-tab="act"' + (tab === 'act' ? ' class="on"' : '') + '>자유 행동</button><button data-tab="inv"' + (tab === 'inv' ? ' class="on"' : '') + '>투자·부동산</button></div>';
    if (tab === 'act') {
      var list = Sim.actList(g);
      Sim.ACT_CATS.forEach(function (c) {
        var os = list.filter(function (a) { return a.cat === c; }); if (!os.length) return;
        h += '<div class="side-sec">' + c + '</div>' + os.map(function (a) {
          var pb = a.prob != null && !a.dis ? ' <span class="pb ' + pbClass(a.prob) + '">' + U.pct(a.prob) + '%</span>' + dtag(a) : '';
          return '<button class="act' + (a.dis ? ' dis' : '') + '" data-a="' + a.key + '"' + (a.dis ? ' disabled' : '') + '><span class="ic">' + a.icon + '</span><span class="lab">' + esc(a.label) + pb + '</span><span class="cost">' + (a.cost ? won(a.cost) : '') + '</span><span class="od">' + esc(a.dis || a.desc) + '</span></button>';
        }).join('');
      });
    } else {
      var dca = p.fl.dca || {}, dsum = 0; Object.keys(dca).forEach(function (x) { dsum += dca[x]; });
      var hold = Sim.holdings(p), m = g.mkt || {}, cap = Sim.creditCap(p, g.w), rate = Sim.loanRate(g.w, p), keys = Object.keys(D.ASSETS).concat(['coin']);
      h += '<div class="inv-sum"><div class="kv"><span>현금(예금)</span><b>' + won(p.cash) + '</b></div><div class="kv"><span>투자 자산</span><b>' + won(p.stock + p.coin) + '</b></div><div class="kv"><span>대출 (연 ' + (rate * 100).toFixed(1) + '%)</span><b>' + won(p.debt) + '</b></div></div>' +
        '<div class="side-sec">거래 단위</div><div class="seg mini">' + [0.1, 0.25, 0.5, 1].map(function (u) { return '<button data-u="' + u + '"' + (u === unit ? ' class="on"' : '') + '>' + (u === 1 ? '전부' : u * 100 + '%') + '</button>'; }).join('') + '</div>' +
        '<p class="fine">매수는 가진 현금의, 매도는 보유분의 이 비율만큼 거래합니다. 시세는 분기 말(3·6·9·12월)에 움직이고, ▲▼는 지난 분기 등락입니다. <b>월 적립</b>을 정해 두면 달이 바뀔 때마다 그 금액만큼 자동으로 삽니다' + (dsum ? ' (지금 합계 월 ' + won(dsum) + ')' : '') + '.</p>';
      keys.forEach(function (k) {
        var A = k === 'coin' ? { name: '코인', desc: '두 배도, 반의 반도 됩니다' } : D.ASSETS[k], amt = k === 'coin' ? p.coin : hold[k];
        h += '<div class="asset"><div class="nm"><b>' + A.name + '</b>' + (m[k] != null ? chg(m[k]) : '') + '<small>' + A.desc + '</small></div><div class="hold">' + won(amt) + '</div>' +
          '<div class="bs"><label class="dca' + (dca[k] ? ' on' : '') + '">월 적립 <select data-dca="' + k + '">' + Sim.DCA_STEPS.concat(dca[k] && Sim.DCA_STEPS.indexOf(dca[k]) < 0 ? [dca[k]] : []).map(function (v) { return '<option value="' + v + '"' + ((dca[k] || 0) === v ? ' selected' : '') + '>' + (v ? won(v) : '안 함') + '</option>'; }).join('') + '</select></label><button class="mb buy" data-b="' + k + '"' + (p.cash * unit < 1 ? ' disabled' : '') + '>매수 ' + won(p.cash * unit) + '</button><button class="mb sell" data-s="' + k + '"' + (amt < 1 ? ' disabled' : '') + '>매도 ' + won(amt * unit) + '</button></div></div>';
      });
      // 부동산: 갭투자와 수익형 건물을 바로 사고판다
      var gl = Sim.gapList(g), mk = Sim.reMarket(g), rentNet = Math.round(Sim.rentInc(p) * (1 - D.BLD_COST));
      h += '<div class="side-sec">부동산</div>';
      if (p.home.type === 'own') h += '<div class="asset"><div class="nm"><b>내 집</b><small>' + Sim.homeLabel(p) + ' · 이사와 갈아타기는 자유 행동의 "집 알아보기"</small></div><div class="hold">' + won(p.home.value) + '</div></div>';
      else if (p.home.deposit) h += '<div class="asset"><div class="nm"><b>보증금</b><small>' + Sim.homeLabel(p) + '</small></div><div class="hold">' + won(p.home.deposit) + '</div></div>';
      var GL = Sim.gaps(p), nOwn = GL.length + (p.bld || []).length;
      if (nOwn) h += '<p class="fine"><b>보유 중</b> — 갭투자 ' + GL.length + '채(순지분 ' + won(Sim.gapEq(p)) + '), 수익형 건물 ' + (p.bld || []).length + '채(' + won(Sim.bldVal(p)) + ')</p>';
      GL.forEach(function (x, i) { h += '<div class="asset own"><div class="nm"><b>🏘️ ' + D.REG[x.region].name + (x.kind === 'villa' ? ' 빌라·소형' : ' 아파트') + '</b><small>갭투자 · 매수가 ' + won(x.buy) + ' · 세입자 보증금 ' + won(x.dep) + ' · 평가 손익 ' + (x.value >= x.buy ? '+' : '−') + won(Math.abs(x.value - x.buy)) + '</small></div><div class="hold">' + won(x.value) + '</div><div class="bs"><button class="mb sell" data-gap="sell:' + i + '">매도</button></div></div>'; });
      {
        h += '<p class="fine"><b>갭투자 매물</b> — 전세를 끼고 집을 삽니다(' + D.GAP_MAX + '채까지, 같은 지역도 여러 채 가능). 필요한 내 돈은 매매가에서 세입자 보증금을 뺀 금액입니다. 서울일수록 비싸지만 잘 오르고, 지방은 내 돈이 적게 들지만 잘 오르지 않습니다. 집값이 내리면 역전세가 납니다.</p>';
        gl.forEach(function (x) { h += '<div class="asset gapr' + (x.dis ? ' off' : '') + '"><div class="nm"><b>' + x.name + '</b><small>매매가 ' + won(x.price) + ' · 전세가율 ' + U.pct(x.jr) + '% · 평소 상승률 연 ' + (x.g * 100).toFixed(1) + '%' + (x.dis ? ' · <em>' + x.dis + '</em>' : '') + '</small></div><div class="hold">내 돈 ' + won(x.eq) + '</div><div class="bs"><button class="mb buy" data-gap="' + x.reg + ':' + x.kind + '"' + (x.dis ? ' disabled' : '') + '>매수</button></div></div>'; });
      }
      (p.bld || []).forEach(function (b, i) { h += '<div class="asset own"><div class="nm"><b>🏢 ' + D.BLD[b.k].name + '</b><small>매입가 ' + won(b.buy) + ' · 월 임대료 ' + won(b.value * D.BLD[b.k].yield / 12 * (1 - D.BLD_COST)) + '</small></div><div class="hold">' + won(b.value) + '</div><div class="bs"><button class="mb sell" data-sb="' + i + '">매도</button></div></div>'; });
      if (rentNet) h += '<p class="fine">임대 수입 합계 월 ' + won(rentNet) + ' (세금·관리비 제외)</p>';
      mk.forEach(function (x) { h += '<div class="asset"><div class="nm"><b>' + x.name + ' 매입</b><small>월 임대료 ' + won(x.rent) + (x.loan && !x.dis ? ' · 대출 ' + won(x.loan) : '') + (x.dis ? ' · <em>' + x.dis + '</em>' : '') + '</small></div><div class="hold">' + won(x.price) + '</div><div class="bs"><button class="mb buy" data-bb="' + x.k + '"' + (x.dis ? ' disabled' : '') + '>매입</button></div></div>'; });
      var rp = Math.min(p.cash, p.debt) * unit;
      h += '<div class="side-sec">대출</div><div class="bs" style="display:flex;gap:6px;flex-wrap:wrap"><button class="mb" data-loan="1"' + (cap * unit < 100 ? ' disabled' : '') + '>신용대출 받기 ' + won(Math.round(cap * unit / 100) * 100) + '</button><button class="mb" data-loan="-1"' + (rp < 1 ? ' disabled' : '') + '>갚기 ' + won(rp) + '</button></div>' +
        '<p class="fine">신용대출 한도 ' + won(cap) + ' · 빚으로 투자할 수도 있지만, 이자는 매달 나갑니다.</p>' +
        '<label class="set-chk" style="font-size:13.5px"><input type="checkbox" id="i-rep"' + (p.fl.noRepay ? '' : ' checked') + '> 연말에 여윳돈으로 대출 자동 상환</label>' +
        '<div class="side-sec">연말 자동 운용</div><div class="seg mini">' + [['manual', '직접 운용'], ['save', '예·적금'], ['stock', '주식 적립'], ['aggr', '공격 투자']].map(function (x) { return '<button data-pol="' + x[0] + '"' + (p.inv === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
        '<p class="fine">' + ({ manual: '연말에 아무것도 건드리지 않습니다. 사고파는 것은 모두 내 몫입니다.', save: '연말마다 투자 자산을 모두 팔아 예금으로 옮깁니다.', stock: '연말마다 여윳돈의 70%를 주식으로 맞춥니다.', aggr: '연말마다 여윳돈의 60%를 주식, 20%를 코인으로 맞춥니다.' })[p.inv] + '</p>';
    }
    el.innerHTML = h;
    function on(sel, fn) { [].forEach.call(el.querySelectorAll(sel), function (b) { b.onclick = function () { fn(b.dataset); }; }); }
    function after() { save(); syncLog(); renderStatus(); }
    on('[data-tab]', function (d) { tab = d.tab; renderSide(); });
    on('[data-a]', function (d) { doAct(d.a); });
    on('[data-u]', function (d) { unit = +d.u; renderSide(); });
    on('[data-b]', function (d) { if (Sim.trade(g, d.b, g.p.cash * unit)) { Snd.sfx('click'); after(); } });
    on('[data-s]', function (d) { var amt = d.s === 'coin' ? g.p.coin : Sim.holdings(g.p)[d.s]; if (Sim.trade(g, d.s, -amt * unit)) { Snd.sfx('click'); after(); } });
    on('[data-loan]', function (d) { var ok = +d.loan > 0 ? Sim.borrow(g, Sim.creditCap(g.p, g.w) * unit) : Sim.repay(g, Math.min(g.p.cash, g.p.debt) * unit); if (ok) { Snd.sfx('click'); after(); } });
    on('[data-pol]', function (d) { g.p.inv = d.pol; after(); });
    [].forEach.call(el.querySelectorAll('[data-dca]'), function (s) { s.onchange = function () { Sim.setDca(g, s.dataset.dca, +s.value); Snd.sfx('click'); toast(+s.value ? '매달 ' + won(+s.value) + '씩 자동으로 삽니다' : '월 적립을 껐습니다'); after(); }; });
    on('[data-gap]', function (d) { if (d.gap.indexOf('sell') !== 0) { var k = d.gap.split(':'), x = Sim.gapList(g).filter(function (m) { return m.reg === k[0] && m.kind === k[1]; })[0]; if (!x || x.dis || !confirm(x.name + '(' + won(x.price) + ')를 전세 끼고 삽니다. 내 돈 ' + won(x.eq) + '이 들어갑니다. 계속할까요?')) return; if (Sim.buyGap(g, k[0], k[1])) { Snd.sfx('house'); after(); } } else { var gi2 = +d.gap.split(':')[1], gx = Sim.gaps(g.p)[gi2]; if (gx && confirm(D.REG[gx.region].name + (gx.kind === 'villa' ? ' 빌라·소형' : ' 아파트') + '를 지금 시세(' + won(gx.value) + ')에 팝니다. 계속할까요?') && Sim.sellGapNow(g, gi2)) { Snd.sfx('click'); after(); } } });
    on('[data-bb]', function (d) { var x = Sim.reMarket(g).filter(function (m) { return m.k === d.bb; })[0]; if (!x || x.dis || !confirm(x.name + '을(를) ' + won(x.price) + '에 매입합니다.' + (x.loan ? ' 대출 ' + won(x.loan) + '을 받습니다.' : '') + ' 계속할까요?')) return; if (Sim.buyBld(g, d.bb)) { Snd.sfx('house'); after(); } });
    on('[data-sb]', function (d) { var b = g.p.bld[+d.sb]; if (b && confirm(D.BLD[b.k].name + '을(를) ' + won(b.value) + '에 팝니다. 계속할까요?') && Sim.sellBld(g, +d.sb)) { Snd.sfx('click'); after(); } });
    var cb = el.querySelector('#i-rep'); if (cb) cb.onchange = function () { g.p.fl.noRepay = cb.checked ? 0 : 1; save(); };
  }
  function doAct(key) {
    if (busy || !g || g.over) return; Snd.unlock(); skip = false;     // 자동 진행은 유지한다
    var res = Sim.act(g, key); if (!res) return;
    if (res.none) { toast('지금은 고를 수 있는 선택지가 없습니다'); return; }
    if (res.queued) { Snd.sfx('click'); return pump(); }
    busy = true; save(); syncLog(); renderStatus();
    showFx(res, function () { busy = false; pump(); });
  }
  $('#btn-side').onclick = function () { Snd.unlock(); setAuto(false); skip = false; $('#side').classList.toggle('open'); };
  $('#side-x').onclick = function () { $('#side').classList.remove('open'); };

  /* ---------- 판정 연출 ---------- */
  var CONF = { wedding: ['💐', '🎉', '💍', '🤍'], house: ['🏠', '🔑', '✨'], baby: ['🍼', '⭐', '🧸'], pass: ['🎉', '✨', '🌸'] };
  function confetti(card, kind) { var set = CONF[kind]; if (!set) return; for (var i = 0; i < 14; i++) { var c = document.createElement('span'); c.className = 'confetti'; c.textContent = set[i % set.length]; c.style.left = (5 + Math.random() * 90) + '%'; c.style.animationDelay = (Math.random() * 0.5) + 's'; card.appendChild(c); } }
  function showFx(res, cb) {
    if (!res || res.quiet) return cb();
    var ok = res.ok, hasRoll = res.roll != null;
    if (S.skip) { Snd.sfx(ok === true ? 'ok' : ok === false ? 'fail' : 'click'); return cb(); }
    var fx = $('#fx'), pct = Math.max(1, U.pct(res.prob || 0)), shown = hasRoll ? (ok ? Math.min(res.roll, pct) : Math.max(res.roll, Math.min(100, pct + 1))) : 0;
    fx.innerHTML = '<div class="fx-card"><div class="ic">' + (res.icon || '🎲') + '</div><div class="what">' + esc(res.dec) + ' — ' + esc(res.label) + '</div>' +
      (hasRoll ? '<div class="fx-num spin" id="fx-num">--</div><div class="fx-need">성공 확률 ' + pct + '%' + (res.boost ? ' (미니게임 +' + Math.round(res.boost * 100) + '%p 포함)' : '') + ' · 주사위(1~100)가 ' + pct + ' 이하면 성공</div>' : '') +
      '<div id="fx-res" hidden><div class="stamp ' + (ok === true ? 'ok' : ok === false ? 'no' : 'nt') + '">' + esc(res.title || '') + '</div><p class="fx-text">' + esc(res.text || '') + '</p><button class="btn primary" id="fx-go" style="width:100%">계속</button></div></div>';
    fx.hidden = false;
    function reveal() {
      var card = fx.firstChild; $('#fx-res').hidden = false;
      if (res.fx === 'wedding' || res.fx === 'house' || res.fx === 'baby' || res.fx === 'box') { Snd.sfx(res.fx); confetti(card, res.fx); }
      else { Snd.sfx(ok === true ? 'ok' : ok === false ? 'fail' : 'click'); if (ok === true) confetti(card, 'pass'); }
      var go = $('#fx-go'); go.focus(); go.onclick = function () { fx.hidden = true; fx.innerHTML = ''; cb(); };
    }
    if (!hasRoll) return reveal();
    Snd.sfx('dice'); var n = $('#fx-num'), sp = setInterval(function () { n.textContent = 1 + Math.floor(Math.random() * 100); }, 55);
    setTimeout(function () { clearInterval(sp); n.classList.remove('spin'); n.textContent = shown; n.style.color = ok ? 'var(--good)' : 'var(--bad)'; reveal(); }, 900);
  }

  /* ---------- 모달: 친구들·그래프·설정 ---------- */
  function modal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
  $('#modal-x').onclick = closeModal; $('#modal').onclick = function (e) { if (e.target.id === 'modal') closeModal(); };
  function peerFamily(q) { if (q.age < 19) return '부모님과 거주'; return (q.spouse ? '기혼' : q.widowed ? '사별' : q.divorces ? '이혼' : '미혼') + (q.kids.length ? ' · 자녀 ' + q.kids.length : '') + ' · ' + Sim.homeLabel(q); }
  function rankBox(label, r) { return '<div>' + label + '<b>상위 ' + r.pct + '%</b>' + r.n + '명 중 ' + r.rank + '위</div>'; }
  function reunionHtml(final) {
    var p = g.p, r = Sim.ranks(g, final), rows = [p].concat(g.peers).sort(function (x, y) { return Sim.netWorth(y) - Sim.netWorth(x); });
    var h = '<h2>친구들</h2><div class="ranks">' + rankBox(final ? '생애 최고 소득' : '가구 소득', r.inc) + rankBox('순자산', r.nw) + rankBox('행복도', r.happy) + '</div>' +
      '<p class="fine">같은 해에 태어난 ' + (g.peers.length + 1) + '명' + (final ? '' : ' 중 생존 ' + r.nw.n + '명 기준') + '. 순자산 순으로 정렬했습니다.</p><div class="tw"><table class="peers"><tr><th>이름</th><th>직업</th><th>월소득</th><th>순자산</th><th>가족·주거</th></tr>';
    rows.forEach(function (q) {
      var dead = q.dead != null;
      h += '<tr class="' + (q === p ? 'me' : dead ? 'dead' : '') + '"><td>' + esc(q.name) + (q === p ? ' (나)' : '') + (q.rel ? '<small>' + q.rel + '</small>' : '') + '</td><td>' + esc(dead ? q.dead + '세에 별세' : Sim.occLabel(q)) + '</td><td class="n">' + (dead ? '—' : won(Sim.myInc(q))) + '</td><td class="n">' + mny(Sim.netWorth(q)) + '</td><td>' + (dead ? '—' : peerFamily(q)) + '</td></tr>';
    });
    return h + '</table></div>';
  }
  $('#btn-reunion').onclick = function () { Snd.sfx('click'); setAuto(false); modal(reunionHtml(false)); };
  function graphSvg(p) {
    var W = 640, Hh = 250, L = 46, Rr = 12, Tt = 12, B = 26, n = p.gN.length, i;
    if (n < 2) return '<p class="fine">아직 그릴 기록이 없습니다.</p>';
    var mx = Math.max.apply(null, p.gN.concat([1000])), mn = Math.min.apply(null, p.gN.concat([0])), x = function (a) { return L + (W - L - Rr) * a / 100; }, yN = function (v) { return Tt + (Hh - Tt - B) * (1 - (v - mn) / (mx - mn)); }, yH = function (v) { return Tt + (Hh - Tt - B) * (1 - v / 100); };
    var dN = '', dH = ''; for (i = 0; i < n; i++) { dN += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yN(p.gN[i]).toFixed(1); dH += (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yH(p.gH[i]).toFixed(1); }
    var s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="순자산과 행복도 그래프">';
    for (i = 0; i <= 100; i += 20) s += '<line x1="' + x(i) + '" y1="' + Tt + '" x2="' + x(i) + '" y2="' + (Hh - B) + '" stroke="var(--line)"/><text x="' + x(i) + '" y="' + (Hh - 8) + '" font-size="11" text-anchor="middle" fill="var(--mute)">' + i + '세</text>';
    s += '<line x1="' + L + '" y1="' + yN(0) + '" x2="' + (W - Rr) + '" y2="' + yN(0) + '" stroke="var(--mute)" stroke-dasharray="3 3"/>';
    s += '<text x="' + (L - 4) + '" y="' + (Tt + 10) + '" font-size="11" text-anchor="end" fill="var(--mute)">' + (mx / 10000).toFixed(mx < 100000 ? 1 : 0) + '억</text><text x="' + (L - 4) + '" y="' + (yN(0) + 4) + '" font-size="11" text-anchor="end" fill="var(--mute)">0</text>';
    s += '<path d="' + dH + '" fill="none" stroke="var(--gold)" stroke-width="2" opacity=".85"/><path d="' + dN + '" fill="none" stroke="var(--accent)" stroke-width="2.5"/>';
    return s + '</svg><div class="legend"><span><i style="background:var(--accent)"></i>순자산 (최고 ' + won(mx) + ')</span><span><i style="background:var(--gold)"></i>행복도 (0~100)</span></div>';
  }
  $('#btn-graph').onclick = function () { Snd.sfx('click'); setAuto(false); modal('<h2>인생 그래프</h2>' + graphSvg(g.p)); };
  $('#btn-set').onclick = function () {
    Snd.sfx('click'); setAuto(false);
    modal('<h2>설정</h2>' +
      '<div class="set-row"><span>배경음악</span><input type="range" id="s-mv" min="0" max="1" step="0.05" value="' + S.mv + '"><label><input type="checkbox" id="s-mm"' + (S.mm ? ' checked' : '') + '> 끄기</label></div>' +
      '<div class="set-row"><span>효과음</span><input type="range" id="s-sv" min="0" max="1" step="0.05" value="' + S.sv + '"><label><input type="checkbox" id="s-sm"' + (S.sm ? ' checked' : '') + '> 끄기</label></div>' +
      '<div class="set-row" style="grid-template-columns:80px 1fr"><span>자동 속도</span><div class="seg mini" style="margin:0">' + [['slow', '느리게'], ['norm', '보통'], ['fast', '빠르게']].map(function (x) { return '<button data-spd="' + x[0] + '"' + (S.spd === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="set-chk"><input type="checkbox" id="s-rep"' + (S.rep ? ' checked' : '') + '> 해가 바뀔 때 연말 결산 화면 보기</label>' +
      '<label class="set-chk"><input type="checkbox" id="s-mini"' + (S.mini ? ' checked' : '') + '> 미니게임: 중요한 판정 앞에서 성공 확률을 올릴 기회</label>' +
      '<label class="set-chk"><input type="checkbox" id="s-skip"' + (S.skip ? ' checked' : '') + '> 주사위·결과 연출 건너뛰기</label>' +
      '<label class="set-chk"><input type="checkbox" id="s-ap"' + (S.autoPick ? ' checked' : '') + '> 테스트 모드: 자동 진행 중 선택지도 자동으로 고르기</label>' +
      '<p class="fine">지금 흐르는 곡 「' + Snd.moodName() + '」 · 음악은 인생 단계(영아·유년·청소년·수험·청년·직장·중년·노년·황혼)에 따라 바뀝니다.</p>' +
      '<p class="fine">난이도 ' + D.DIFF[g.p.fl.diff || 0].name + ' · 시드 ' + esc(Sim.code(g)) + ' · 진행 상황은 달마다 자동 저장됩니다.</p>' +
      '<div class="end-btns"><button class="btn" id="s-title">타이틀로</button><button class="btn" id="s-close">닫기</button></div>');
    $('#s-mv').oninput = function () { S.mv = +this.value; Snd.set('mv', S.mv); saveSettings(); };
    $('#s-sv').oninput = function () { S.sv = +this.value; Snd.set('sv', S.sv); saveSettings(); Snd.sfx('click'); };
    $('#s-mm').onchange = function () { S.mm = this.checked; Snd.set('mm', S.mm); saveSettings(); };
    $('#s-sm').onchange = function () { S.sm = this.checked; Snd.set('sm', S.sm); saveSettings(); };
    $('#s-skip').onchange = function () { S.skip = this.checked; saveSettings(); };
    $('#s-mini').onchange = function () { S.mini = this.checked; saveSettings(); };
    $('#s-rep').onchange = function () { S.rep = this.checked; saveSettings(); };
    [].forEach.call(document.querySelectorAll('[data-spd]'), function (b) { b.onclick = function () { S.spd = b.dataset.spd; saveSettings(); [].forEach.call(document.querySelectorAll('[data-spd]'), function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#s-ap').onchange = function () { S.autoPick = this.checked; saveSettings(); };
    $('#s-title').onclick = function () { closeModal(); save(); initTitle(); };
    $('#s-close').onclick = closeModal;
  };

  /* ---------- 엔딩 ---------- */
  function shareText(s) {
    var p = g.p, C = D.CLASS[s.cls];
    return ['[출발선] ' + s.name + '의 100년', '칭호: ' + s.title, '집안: ' + C.name + ' ' + C.nick + ' · ' + D.REG[p.fam.region].name + ' 출생',
      '최종 순자산 ' + won(s.nw) + ' (또래 상위 ' + s.ranks.nw.pct + '%)', '평균 행복도 ' + s.avgHappy + ' / 100 (마지막 해 기준 또래 상위 ' + s.ranks.happy.pct + '%)',
      '직업: ' + (s.jobs.length ? s.jobs.map(function (j) { return j.t; }).join(' → ') : '없음'), '가족: ' + s.family, '시드: ' + s.code].join('\n');
  }
  function copyText(t) {
    function fb() { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } ta.remove(); toast(ok ? '결과를 복사했습니다' : '복사에 실패했습니다'); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('결과를 복사했습니다'); }, fb); else fb();
  }
  function wrap(c, text, x, y, maxW, lh, maxLines) {
    var line = '', n = 0;
    for (var i = 0; i < text.length; i++) { var t = line + text[i]; if (c.measureText(t).width > maxW && line) { n++; if (maxLines && n >= maxLines) { c.fillText(line.slice(0, -1) + '…', x, y); return y + lh; } c.fillText(line, x, y); y += lh; line = text[i]; } else line = t; }
    c.fillText(line, x, y); return y + lh;
  }
  function saveImage(s) {
    var p = g.p, cv = document.createElement('canvas'), c = cv.getContext('2d'), W = 1080, Hh = 1350, F = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif', y, i;
    cv.width = W; cv.height = Hh; c.fillStyle = '#f4f0e8'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#f1e6d3'; c.fillRect(0, 0, W, 300);
    c.textAlign = 'center'; c.fillStyle = '#77726a'; c.font = '34px ' + F; c.fillText('출발선 — 대한민국에서 100년', W / 2, 90);
    c.fillStyle = '#2a2927'; c.font = 'bold 58px ' + F; y = wrap(c, '「' + s.title + '」', W / 2, 180, 940, 74, 2);
    c.font = '36px ' + F; c.fillStyle = '#77726a'; c.fillText(s.name + ' · ' + D.CLASS[s.cls].name + ' ' + D.CLASS[s.cls].nick + ' 출신', W / 2, 360);
    c.textAlign = 'left'; y = 450;
    [['최종 순자산', won(s.nw) + '  (또래 상위 ' + s.ranks.nw.pct + '%)'], ['평균 행복도', s.avgHappy + ' / 100'], ['가족', s.family], ['마지막 거처', s.home]].forEach(function (r) {
      c.font = '30px ' + F; c.fillStyle = '#77726a'; c.fillText(r[0], 80, y); c.font = 'bold 36px ' + F; c.fillStyle = '#2a2927'; c.fillText(r[1], 300, y); y += 66;
    });
    c.font = '30px ' + F; c.fillStyle = '#77726a'; c.fillText('직업 이력', 80, y); c.fillStyle = '#2a2927'; c.font = '32px ' + F;
    y = wrap(c, s.jobs.length ? s.jobs.map(function (j) { return j.t; }).join(' → ') : '없음', 300, y, 700, 46, 3) + 30;
    var gx = 80, gy = y, gw = 920, gh = 1220 - y, mx = Math.max.apply(null, p.gN.concat([1000])), mn = Math.min.apply(null, p.gN.concat([0]));
    c.strokeStyle = '#e2dccf'; c.lineWidth = 2; c.strokeRect(gx, gy, gw, gh);
    [[p.gH, '#a9812c', function (v) { return v / 100; }], [p.gN, '#3d6b6b', function (v) { return (v - mn) / (mx - mn); }]].forEach(function (d) {
      c.beginPath(); c.strokeStyle = d[1]; c.lineWidth = 5; for (i = 0; i < d[0].length; i++) { var px = gx + gw * i / 100, py = gy + gh * (1 - d[2](d[0][i])); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke();
    });
    c.font = '24px ' + F; c.fillStyle = '#3d6b6b'; c.fillText('━ 순자산', gx + 16, gy + 36); c.fillStyle = '#a9812c'; c.fillText('━ 행복도', gx + 150, gy + 36);
    c.fillStyle = '#77726a'; c.fillText('0세', gx, gy + gh + 34); c.textAlign = 'right'; c.fillText('100세', gx + gw, gy + gh + 34);
    c.textAlign = 'center'; c.font = '28px ' + F; c.fillText('시드 ' + s.code, W / 2, Hh - 40);
    var a = document.createElement('a'); a.download = '출발선_' + s.code + '.png'; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); toast('이미지를 저장했습니다');
  }
  function showEnding() {
    var p = g.p, s = Sim.summary(g), C = D.CLASS[s.cls];
    document.body.dataset.stage = 'senior'; Snd.setMood('elder'); Snd.sfx('end');
    var kids = s.kids.length ? s.kids.map(function (k) { return esc(k.name) + '(' + (k.job || (k.tier && k.tier !== 'hs' ? D.UNIV[k.tier].name + ' 졸' : '—')) + ')'; }).join(', ') : '없음';
    $('#end-body').innerHTML =
      '<h1>백 번째 생일. 100년의 기록</h1><div class="end-title">「' + esc(s.title) + '」</div><div class="end-name">' + esc(s.name) + ' · ' + C.name + ' ' + C.nick + ' · ' + D.REG[p.fam.region].name + ' 출생' + (s.diff ? ' · ' + D.DIFF[s.diff].name : '') + '</div>' +
      '<div class="ranks">' + rankBox('순자산', s.ranks.nw) + rankBox('생애 최고 소득', s.ranks.inc) + rankBox('행복도', s.ranks.happy) + '</div>' +
      '<div class="end-sec"><h3>최종 자산</h3><div class="kv"><span>순자산</span><b>' + mny(s.nw) + '</b></div><div class="kv"><span>현금</span><b>' + won(s.cash) + '</b></div><div class="kv"><span>주식·코인</span><b>' + won(s.stock) + '</b></div><div class="kv"><span>부동산</span><b>' + won(s.re) + '</b></div><div class="kv"><span>부채</span><b>' + won(s.debt) + '</b></div><div class="kv"><span>생애 최고 순자산</span><b>' + won(s.maxNW) + '</b></div><div class="kv"><span>생애 최고 월소득</span><b>' + won(s.maxInc) + '</b></div></div>' +
      '<div class="end-sec"><h3>삶</h3><div class="kv"><span>평균 행복도</span><b>' + s.avgHappy + ' / 100</b></div><div class="kv"><span>가족</span><b>' + s.family + '</b></div><div class="kv"><span>자녀</span><b>' + kids + '</b></div><div class="kv"><span>마지막 거처</span><b>' + s.home + '</b></div><div class="kv"><span>함께 100세를 맞은 친구</span><b>' + s.alive + '명 / ' + g.peers.length + '명</b></div></div>' +
      '<div class="end-sec"><h3>직업 이력</h3><ul class="tl">' + (s.jobs.length ? s.jobs.map(function (j) { return '<li><span>' + j.a + '세</span>' + esc(j.t) + '</li>'; }).join('') : '<li><span>—</span>직업 없이 살았습니다</li>') + '</ul></div>' +
      '<div class="end-sec"><h3>인생 그래프</h3>' + graphSvg(p) + '</div>' +
      '<div class="end-sec"><h3>연표</h3><ul class="tl">' + s.timeline.map(function (m) { return '<li><span>' + m.a + '세</span>' + esc(m.t) + '</li>'; }).join('') + '</ul></div>' +
      '<p class="fine" style="text-align:center">시드 ' + esc(s.code) + ' — 주소 뒤에 ?seed=' + esc(s.code) + ' 를 붙여 열면 같은 출발선에서 다시 살아 볼 수 있습니다.</p>' +
      '<div class="end-btns"><button class="btn" id="e-copy">결과 텍스트 복사</button><button class="btn" id="e-img">결과 이미지 저장</button><button class="btn" id="e-peers">친구들 보기</button><button class="btn" id="e-log">살아온 기록 보기</button></div>' +
      '<button class="btn primary big" id="e-new" style="width:100%">새 인생 시작</button>';
    show('end'); $('#scr-end').scrollTop = 0;
    $('#e-copy').onclick = function () { copyText(shareText(s)); }; $('#e-img').onclick = function () { saveImage(s); };
    $('#e-peers').onclick = function () { modal(reunionHtml(true)); };
    $('#e-log').onclick = function () { modal('<h2>살아온 기록</h2>' + p.log.map(function (y) { return yearCard(y.a, y.l).outerHTML; }).join('')); };
    $('#e-new').onclick = function () { if (!confirm('이 인생의 기록을 지우고 새로 시작할까요?')) return; try { localStorage.removeItem(KEY); } catch (e) { } g = null; initTitle(); };
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return; if (/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName) && document.activeElement.id !== 'btn-next') return;
    if (!$('#scr-game').classList.contains('on') || !$('#modal').hidden || !$('#fx').hidden || !$('#dec').hidden) return;
    e.preventDefault(); setAuto(false); step();
  });
  window.BN = { state: function () { return g; }, settings: S };   // 디버그·검증용
  initTitle();
})();
