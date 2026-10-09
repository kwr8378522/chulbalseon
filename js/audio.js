/* audio.js — Web Audio API로 직접 합성하는 배경음악과 효과음 (외부 음원 없음)
 * 브라우저 자동재생 제한 때문에 첫 클릭(Snd.unlock) 이후에 재생을 시작합니다. */
var Snd = (function () {
  'use strict';
  var ctx = null, mg, sg, lp, timer = null, step = 0, nextT = 0, mood = 'title', cur = 'title';
  var st = { mv: 0.5, sv: 0.6, mm: false, sm: false };
  // 한 마디 = 8분음표 8개, 4마디 반복. chords: 마디별 화음(MIDI), mel: 32스텝 선율(0은 쉼)
  var MOODS = {
    title: { name: '출발선', bpm: 108, lead: 'triangle', leadVol: 0.15, pad: 0.06, kick: [0, 4], snare: [2, 6], hat: 1, stab: 1, cut: 3400,   // 타이틀: 달려 나가는 장조
      chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      mel: [79, 0, 84, 0, 88, 0, 84, 86, 83, 0, 79, 0, 86, 0, 83, 0, 81, 0, 84, 0, 88, 0, 91, 0, 89, 0, 88, 0, 84, 0, 86, 88] },
    baby: { name: '자장가', bpm: 66, lead: 'sine', leadVol: 0.17, pad: 0.03, kick: [], hat: 0, cut: 4200, long: 1,   // 영아기: 오르골 자장가
      chords: [[60, 64, 67], [65, 69, 72], [60, 64, 67], [55, 59, 62]],
      mel: [88, 0, 84, 0, 79, 0, 84, 0, 89, 0, 84, 0, 81, 0, 84, 0, 88, 0, 84, 0, 79, 0, 76, 0, 79, 0, 83, 0, 86, 0, 84, 0] },
    teen: { name: '교복의 계절', bpm: 104, lead: 'triangle', leadVol: 0.12, pad: 0.05, kick: [0, 3, 4], snare: [2, 6], hat: 1, cut: 2600,   // 청소년기: 풋풋한 밴드풍
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      mel: [76, 0, 76, 79, 0, 76, 0, 72, 77, 0, 77, 81, 0, 77, 0, 72, 76, 0, 79, 0, 84, 0, 79, 0, 74, 0, 79, 0, 83, 0, 81, 79] },
    mid: { name: '퇴근길', bpm: 72, lead: 'triangle', leadVol: 0.1, pad: 0.07, kick: [0], snare: [4], hat: 2, swing: 0.045, cut: 1400,   // 중년기: 느린 재즈풍
      chords: [[50, 53, 57, 60], [43, 50, 53, 59], [48, 52, 55, 59], [45, 52, 55, 60]],
      mel: [0, 0, 69, 0, 0, 72, 0, 0, 71, 0, 0, 0, 67, 0, 0, 0, 0, 0, 67, 0, 0, 71, 0, 0, 69, 0, 0, 0, 64, 0, 0, 0] },
    late: { name: '오래된 사진첩', bpm: 46, lead: 'sine', leadVol: 0.13, pad: 0.09, kick: [], hat: 0, cut: 1000, long: 1,   // 황혼: 아주 느리고 성긴 선율
      chords: [[48, 55, 60, 64], [41, 48, 53, 57], [43, 50, 55, 59], [48, 52, 55, 60]],
      mel: [0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 67, 0, 0, 0] },
    child: { name: '놀이터', bpm: 96, lead: 'triangle', leadVol: 0.16, pad: 0.05, kick: [0, 4], hat: 2, cut: 3200,   // 유년기: 밝은 장조
      chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      mel: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 79, 0, 83, 0, 79, 0, 72, 0, 76, 0, 81, 0, 76, 0, 77, 0, 81, 0, 84, 0, 81, 79] },
    exam: { name: 'D-100', bpm: 112, lead: 'square', leadVol: 0.07, pad: 0.04, kick: [0, 3, 6], hat: 1, bass: 1, cut: 1900,   // 수험생: 단조, 쫓기는 8분음표
      chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
      mel: [69, 0, 0, 72, 0, 71, 0, 0, 69, 0, 0, 72, 0, 77, 0, 76, 74, 0, 0, 77, 0, 76, 0, 0, 76, 0, 0, 80, 0, 83, 0, 0] },
    youth: { name: '자취방 로파이', bpm: 78, lead: 'triangle', leadVol: 0.13, pad: 0.06, kick: [0, 5], snare: [4], hat: 2, swing: 0.035, cut: 1700,   // 청년기: 로파이
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      mel: [0, 0, 76, 0, 72, 0, 0, 69, 0, 0, 74, 0, 71, 0, 67, 0, 0, 0, 72, 0, 69, 0, 0, 65, 0, 0, 71, 0, 67, 0, 64, 0] },
    work: { name: '출근 2호선', bpm: 90, lead: 'triangle', leadVol: 0.11, pad: 0.05, kick: [0, 4], snare: [2, 6], hat: 1, stab: 1, cut: 1500,   // 직장: 같은 동기의 기계적 반복
      chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]],
      mel: [74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0, 72, 0, 69, 0, 67, 0] },
    elder: { name: '아침 산책', bpm: 58, lead: 'sine', leadVol: 0.15, pad: 0.085, kick: [], hat: 0, cut: 1300, long: 1,   // 노년: 느리고 따뜻한 패드
      chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 57, 60], [43, 50, 55, 59]],
      mel: [0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 0, 0, 71, 0, 0, 0, 67, 0] }
  };
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function tone(dest, type, f, t, dur, vol, atk) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (atk || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  var noiseBuf = null;
  function noise(dest, t, dur, vol, freq, q) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(t) { var o = tone(lp, 'sine', 120, t, 0.22, 0.32, 0.004); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    while (nextT < ctx.currentTime + 0.25) {
      var s = step % 32, inBar = s % 8, bar = Math.floor(s / 8);
      if (inBar === 0 && cur !== mood) { cur = mood; lp.frequency.setTargetAtTime(MOODS[cur].cut, nextT, 0.4); }
      var M = MOODS[cur], spb = 60 / M.bpm / 2, t = nextT + (M.swing && inBar % 2 ? M.swing : 0), ch = M.chords[bar], i;
      if (inBar === 0) for (i = 0; i < ch.length; i++) tone(lp, 'sine', hz(ch[i]), t, spb * (M.long ? 9 : 7.5), M.pad, M.long ? 0.6 : 0.05);
      if (M.stab && (inBar === 3 || inBar === 6)) for (i = 0; i < ch.length; i++) tone(lp, 'triangle', hz(ch[i] + 12), t, spb * 0.9, 0.025);
      if (M.bass) tone(lp, 'triangle', hz(ch[0] - 12), t, spb * 0.9, inBar % 2 ? 0.07 : 0.11);
      else if (inBar === 0 || (inBar === 5 && !M.long)) tone(lp, 'sine', hz(ch[0] - 12), t, spb * 3, 0.13, 0.02);
      if (M.mel[s]) tone(lp, M.lead, hz(M.mel[s]), t, spb * (M.long ? 5 : 1.8), M.leadVol, M.long ? 0.08 : 0.01);
      if (M.kick.indexOf(inBar) >= 0) kick(t);
      if (M.snare && M.snare.indexOf(inBar) >= 0) noise(lp, t, 0.14, 0.11, 1800, 0.7);
      if (M.hat && inBar % M.hat === 0) noise(mg, t, 0.04, 0.02, 7000, 1.5);
      nextT += spb; step++;
    }
  }
  function apply() { if (!ctx) return; mg.gain.setTargetAtTime(st.mm ? 0 : st.mv * 0.9, ctx.currentTime, 0.05); sg.gain.setTargetAtTime(st.sm ? 0 : st.sv, ctx.currentTime, 0.02); }
  var SFX = {
    click: function (t) { tone(sg, 'sine', 720, t, 0.07, 0.12, 0.003); },
    year: function (t) { tone(sg, 'triangle', 523, t, 0.12, 0.08); tone(sg, 'triangle', 659, t + 0.05, 0.14, 0.06); },
    dice: function (t) { for (var i = 0; i < 7; i++) noise(sg, t + i * 0.09 + Math.random() * 0.03, 0.05, 0.25, 1400 + Math.random() * 1800, 3); },
    ok: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(sg, 'triangle', f, t + i * 0.09, 0.3, 0.16); }); },
    fail: function (t) { var o = tone(sg, 'sawtooth', 311, t, 0.5, 0.09, 0.02); o.frequency.exponentialRampToValueAtTime(140, t + 0.45); tone(sg, 'sine', 185, t + 0.12, 0.5, 0.1); },
    wedding: function (t) { [784, 988, 1175, 1568, 1175, 1568].forEach(function (f, i) { tone(sg, 'sine', f, t + i * 0.13, 0.6, 0.12); }); },
    house: function (t) { tone(sg, 'sine', 659, t, 0.5, 0.16); tone(sg, 'sine', 523, t + 0.28, 0.8, 0.16); },
    baby: function (t) { [880, 1047, 880, 1319].forEach(function (f, i) { tone(sg, 'sine', f, t + i * 0.12, 0.25, 0.1); }); },
    box: function (t) { noise(sg, t, 0.2, 0.2, 300, 1); tone(sg, 'sine', 196, t + 0.05, 0.5, 0.1); },
    end: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(sg, 'sine', f, t + i * 0.22, 1.6, 0.1, 0.05); }); }
  };
  return {
    state: st,
    unlock: function () {
      try {
        if (!ctx) {
          var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
          ctx = new AC(); mg = ctx.createGain(); sg = ctx.createGain(); lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = MOODS[cur].cut; lp.Q.value = 0.6;
          lp.connect(mg); mg.connect(ctx.destination); sg.connect(ctx.destination); apply();
          nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 90);
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
    },
    setMood: function (m) { if (MOODS[m]) mood = m; },
    moodName: function () { return MOODS[mood].name; },
    set: function (k, v) { st[k] = v; apply(); },
    sfx: function (name) { if (!ctx || ctx.state !== 'running' || st.sm || !SFX[name]) return; try { SFX[name](ctx.currentTime + 0.01); } catch (e) { } },
    ready: function () { return !!ctx; }
  };
})();
