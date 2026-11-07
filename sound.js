/* Âm thanh tổng hợp bằng Web Audio – không cần file mp3.
   window.SND.unlock() phải gọi trong một lần chạm của người dùng. */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master, sfxBus, musicBus, noiseBuf, on = true, musicTimer = null, nextNote = 0, step = 0;
  try { var v = localStorage.getItem('yep-sound'); if (v === '0') on = false; } catch (e) {}

  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 1 : 0; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(comp);
    // tiếng vang nhẹ cho nhạc
    var dl = ctx.createDelay(); dl.delayTime.value = 0.28; var fb = ctx.createGain(); fb.gain.value = 0.28;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    musicBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function t() { return ctx.currentTime; }
  function env(g, at, peak, a, dcy) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + dcy); }
  function tone(freq, at, dur, type, peak, bus, glideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    env(g, at, peak, 0.006, dur); o.connect(g); g.connect(bus || sfxBus); o.start(at); o.stop(at + dur + 0.05);
  }
  function bell(freq, at, peak, bus) { tone(freq, at, 1.4, 'sine', peak, bus); tone(freq * 2.01, at, 0.7, 'sine', peak * 0.28, bus); tone(freq * 3.98, at, 0.25, 'sine', peak * 0.08, bus); }
  function noise(at, dur, peak, type, f1, f2, q) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f1, at); if (f2) f.frequency.exponentialRampToValueAtTime(f2, at + dur);
    var g = ctx.createGain(); env(g, at, peak, Math.min(0.04, dur / 3), dur); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(at); s.stop(at + dur + 0.05);
  }
  function ok() { return ctx && on && ctx.state === 'running'; }

  var SFX = {
    open: function () { if (!ok()) return; var n = t();
      noise(n, 0.5, 0.5, 'bandpass', 900, 3800, 0.7);           // giấy sột soạt
      noise(n + 0.12, 0.35, 0.25, 'highpass', 3000, 6000);
      [659.3, 784, 987.8, 1318.5, 1568].forEach(function (f, i) { bell(f, n + 0.45 + i * 0.09, 0.16); }); },
    whoosh: function () { if (!ok()) return; noise(t(), 0.42, 0.22, 'bandpass', 380, 2600, 1.2); },
    tap: function () { if (!ok()) return; tone(1500, t(), 0.05, 'sine', 0.18, null, 700); },
    pop: function () { if (!ok()) return; var n = t(); noise(n, 0.12, 0.6, 'highpass', 1800); tone(520, n, 0.18, 'triangle', 0.25, null, 140);
      for (var i = 0; i < 6; i++) noise(n + 0.08 + Math.random() * 0.35, 0.04, 0.12, 'highpass', 5000); },
    sparkle: function () { if (!ok()) return; var n = t(); [1568, 2093, 2637, 3136].forEach(function (f, i) { bell(f, n + i * 0.06, 0.09); }); },
    boom: function () { if (!ok()) return; var n = t(); tone(110, n, 0.7, 'sine', 0.35, null, 38); noise(n, 0.5, 0.35, 'lowpass', 900, 120);
      for (var i = 0; i < 14; i++) noise(n + 0.15 + Math.random() * 0.9, 0.03, 0.08 + Math.random() * 0.06, 'highpass', 4000 + Math.random() * 3000); },
    flip: function () { if (!ok()) return; noise(t(), 0.05, 0.12, 'bandpass', 2400, null, 3); }
  };

  // Nhạc hộp nhạc: C – Am – F – G, 84 bpm, móc nối 8 nốt/hợp âm
  var chords = [[261.6, 329.6, 392, 523.3], [220, 261.6, 329.6, 440], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]];
  var pat = [0, 1, 2, 3, 2, 1, 3, 2], sp = 60 / 84 / 2;
  function sched() {
    while (nextNote < t() + 0.25) {
      var c = chords[Math.floor(step / 8) % 4], f = c[pat[step % 8]] * 2;
      bell(f, nextNote, 0.06, musicBus);
      if (step % 8 === 0) { tone(c[0] / 2, nextNote, sp * 7.5, 'triangle', 0.05, musicBus); }
      nextNote += sp; step++;
    }
  }
  function musicStart() { if (!ctx || musicTimer) return; nextNote = t() + 0.1; musicTimer = setInterval(sched, 60);
    musicBus.gain.cancelScheduledValues(t()); musicBus.gain.setTargetAtTime(0.9, t(), 1.2); }
  function musicStop() { if (!musicTimer) return; clearInterval(musicTimer); musicTimer = null; if (ctx) musicBus.gain.setTargetAtTime(0, t(), 0.2); }

  document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });

  window.SND = {
    supported: !!AC,
    isOn: function () { return on; },
    unlock: function () { init(); if (ctx && ctx.state !== 'running') ctx.resume(); if (on) musicStart(); },
    set: function (v) { on = v; try { localStorage.setItem('yep-sound', v ? '1' : '0'); } catch (e) {}
      init(); if (!ctx) return; if (v) { ctx.resume(); master.gain.setTargetAtTime(1, t(), 0.05); musicStart(); } else { master.gain.setTargetAtTime(0, t(), 0.05); musicStop(); } },
    play: function (name) { try { SFX[name] && SFX[name](); } catch (e) {} }
  };
})();
