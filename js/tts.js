// TTS engine — browser SpeechSynthesis for cmn/jpn/kor/vie,
// espeak-ng Opus sprite for yue/hak via Web Audio API.
var TTS = (function() {
  var ctx = null;
  var cache = {};       // "lang/pron" -> AudioBuffer
  var currentSpk = null;
  var BARES = ["yue", "hak"];  // languages with espeak audio sprites
  var NATIVE = ["jpn_on", "jpn_kun", "kor", "vie"];
  var VOICE = { cmn:"zh-CN", yue:"zh-CN", hak:"zh-CN",
    wuu_sh:"zh-CN", wuu_sz:"zh-CN", nan:"zh-CN", cdo:"zh-CN",
    teo:"zh-CN", ltc:"zh-CN", och:"zh-CN",
    jpn_on:"ja-JP", jpn_kun:"ja-JP", kor:"ko-KR", vie:"vi-VN" };

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function decodeOpus(b64) {
    var raw = atob(b64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return getCtx().decodeAudioData(bytes.buffer);
  }

  function getBuf(langId, pron) {
    var key = langId + "/" + pron;
    if (cache[key]) return Promise.resolve(cache[key]);
    var b64 = TTS_AUDIO && TTS_AUDIO[langId] && TTS_AUDIO[langId][pron];
    if (!b64) return Promise.resolve(null);
    return decodeOpus(b64).then(function(buf) {
      cache[key] = buf;
      return buf;
    });
  }

  // ── espeak sprite playback ──
  function speakSprites(langId, row, spkEl) {
    stop();
    currentSpk = spkEl;
    spkEl.classList.add("playing");

    var cells = row.querySelectorAll(".char-cell:not(.punct)");
    var prons = [];
    for (var i = 0; i < cells.length; i++) {
      var p = (cells[i].dataset.pron || "").replace(/\*$/, "").trim();
      prons.push(p || null);
    }

    Promise.all(prons.map(function(p) { return p ? getBuf(langId, p) : null; }))
      .then(function(bufs) {
        if (currentSpk !== spkEl) return; // cancelled mid-decode
        var ac = getCtx();
        var t = ac.currentTime + 0.05;
        for (var i = 0; i < bufs.length; i++) {
          if (!bufs[i]) continue;
          var src = ac.createBufferSource();
          src.buffer = bufs[i];
          src.connect(ac.destination);
          src.start(t);
          t += bufs[i].duration + 0.04;
        }
        // Track when all playback ends
        var endTime = t;
        var check = setInterval(function() {
          if (ac.currentTime >= endTime || currentSpk !== spkEl) {
            clearInterval(check);
            if (currentSpk === spkEl) {
              spkEl.classList.remove("playing");
              currentSpk = null;
            }
          }
        }, 100);
      })
      .catch(function() {
        spkEl.classList.remove("playing");
        currentSpk = null;
      });
  }

  // ── Browser SpeechSynthesis playback ──
  function speakNative(langId, text, spkEl) {
    stop();
    currentSpk = spkEl;
    spkEl.classList.add("playing");
    var u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE[langId] || "zh-CN";
    u.rate = 0.9;
    u.onend = u.onerror = function() {
      spkEl.classList.remove("playing");
      currentSpk = null;
    };
    window.speechSynthesis.speak(u);
  }

  function stop() {
    if (currentSpk) {
      window.speechSynthesis.cancel();
      // reset AudioContext to kill in-flight nodes
      if (ctx) { ctx.close(); ctx = null; cache = {}; }
      document.querySelectorAll(".spk.playing").forEach(function(el) { el.classList.remove("playing"); });
      currentSpk = null;
    }
  }

  function speak(langId, text, row, spkEl) {
    if (currentSpk === spkEl) { stop(); return; }
    if (BARES.indexOf(langId) !== -1 && typeof TTS_AUDIO !== "undefined" && TTS_AUDIO[langId]) {
      speakSprites(langId, row, spkEl);
    } else {
      // For jpn_on/kor/vie, speak actual readings from grid instead of Chinese text
      var speakText = text;
      if (NATIVE.indexOf(langId) !== -1) {
        var cells = row.querySelectorAll(".char-cell:not(.punct)");
        var parts = [];
        for (var i = 0; i < cells.length; i++) {
          var p = (cells[i].dataset.pron || "").replace(/\*$/, "").trim();
          if (p) parts.push(p);
        }
        if (parts.length > 0) speakText = parts.join(" ");
      }
      speakNative(langId, speakText, spkEl);
    }
  }

  return { speak: speak, stop: stop };
})();
