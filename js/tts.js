// TTS engine
//   cmn/yue     → browser SpeechSynthesis (zh-CN / zh-HK)
//   jpn/kor/vie → browser SpeechSynthesis with readings from grid
//   hak         → hkilang VITS2 API, espeak sprite as offline fallback
//   wuu/nan/etc → browser SpeechSynthesis zh-CN (best-effort)
var TTS = (function() {
  var ctx = null;
  var cache = {};       // "lang/pron" → AudioBuffer
  var currentSpk = null;

  // Languages with pre-generated espeak sprites (now only used as hak fallback)
  var BARES = ["hak"];

  // Languages that speak grid readings instead of raw Chinese text
  var NATIVE = ["jpn_on", "jpn_kun", "kor", "vie"];

  // Browser SpeechSynthesis language mapping
  var VOICE = { cmn:"zh-CN", yue:"zh-HK", hak:"zh-CN",
    wuu_sh:"zh-CN", wuu_sz:"zh-CN", nan:"zh-CN", cdo:"zh-CN",
    teo:"zh-CN", ltc:"zh-CN", och:"zh-CN",
    jpn_on:"ja-JP", jpn_kun:"ja-JP", kor:"ko-KR", vie:"vi-VN" };

  // hkilang VITS2 TTS API (Hakka)
  var HAK_API = "https://Chaak2.pythonanywhere.com/TTS/hakka/{syllables}?voice=male&speed=1";

  // Convert GD/Hagfa Pinyim 入声 finals to hkilang format (-b/-d/-g → -p/-t/-k)
  function toHkilang(syl) {
    return syl.replace(/([^n])([bgd])(\d)$/g, function(_, prev, coda, tone) {
      return prev + {b:"p", d:"t", g:"k"}[coda] + tone;
    });
  }

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  // Resume AudioContext — returns Promise, must be called while user gesture is active
  function resumeCtx() {
    var c = getCtx();
    if (c.state === "suspended") return c.resume().then(function() { return c; });
    return Promise.resolve(c);
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

  // ── Collect pronunciations from grid row ──
  function collectProns(row) {
    var cells = row.querySelectorAll(".char-cell:not(.punct)");
    var prons = [];
    for (var i = 0; i < cells.length; i++) {
      var p = (cells[i].dataset.pron || "").replace(/\*$/, "").trim();
      prons.push(p || null);
    }
    return prons;
  }

  // ── Pre-generated espeak sprite playback (hak fallback) ──
  function speakSprites(langId, row, spkEl) {
    stop();
    currentSpk = spkEl;
    spkEl.classList.add("playing");

    var acReady = resumeCtx();
    var prons = collectProns(row);

    Promise.all(prons.map(function(p) { return p ? getBuf(langId, p) : null; }))
      .then(function(bufs) {
        if (currentSpk !== spkEl) return;
        return acReady.then(function(ac) {
          var t = ac.currentTime + 0.05;
          for (var i = 0; i < bufs.length; i++) {
            if (!bufs[i]) continue;
            var src = ac.createBufferSource();
            src.buffer = bufs[i];
            src.connect(ac.destination);
            src.start(t);
            t += bufs[i].duration + 0.04;
          }
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
        });
      })
      .catch(function() {
        spkEl.classList.remove("playing");
        currentSpk = null;
      });
  }

  // ── hkilang VITS2 API playback (Hakka primary) ──
  function speakHakkaAPI(row, spkEl) {
    stop();
    currentSpk = spkEl;
    spkEl.classList.add("playing");

    // Eagerly resume AudioContext while user gesture is still active (Chrome policy)
    var acReady = resumeCtx();

    var prons = collectProns(row);
    var syllables = prons.filter(function(p) { return p; }).map(toHkilang).join(" ");
    if (!syllables) { spkEl.classList.remove("playing"); currentSpk = null; return; }

    var url = HAK_API.replace("{syllables}", encodeURIComponent(syllables));

    fetch(url)
      .then(function(resp) {
        if (!resp.ok) throw new Error("API error " + resp.status);
        return resp.arrayBuffer();
      })
      .then(function(buf) { return acReady.then(function(ac) { return ac.decodeAudioData(buf); }); })
      .then(function(audioBuf) {
        if (currentSpk !== spkEl) return;
        var ac = getCtx();
        var src = ac.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ac.destination);
        src.start();
        src.onended = function() {
          spkEl.classList.remove("playing");
          currentSpk = null;
        };
      })
      .catch(function() {
        // API failed — fall back to espeak sprites
        if (typeof TTS_AUDIO !== "undefined" && TTS_AUDIO["hak"]) {
          speakSprites("hak", row, spkEl);
        } else {
          spkEl.classList.remove("playing");
          currentSpk = null;
        }
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
      if (ctx) { ctx.close(); ctx = null; cache = {}; }
      document.querySelectorAll(".spk.playing").forEach(function(el) { el.classList.remove("playing"); });
      currentSpk = null;
    }
  }

  function speak(langId, text, row, spkEl) {
    if (currentSpk === spkEl) { stop(); return; }

    // hak → hkilang VITS2 API (with espeak sprite fallback in catch)
    if (langId === "hak") {
      speakHakkaAPI(row, spkEl);
      return;
    }

    // Other sprite languages (currently none, reserved for future)
    if (BARES.indexOf(langId) !== -1 && typeof TTS_AUDIO !== "undefined" && TTS_AUDIO[langId]) {
      speakSprites(langId, row, spkEl);
      return;
    }

    // jpn_on/kor/vie → speak actual readings instead of Chinese text
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

  return { speak: speak, stop: stop };
})();
