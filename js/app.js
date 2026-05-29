// GUI logic for HanziDialect
// Dependencies: DB (readings.js), ST (st_mapping.js), TTS (tts.js), TTS_AUDIO (tts_audio.js)

var LANGS = [
  { id: "cmn",    label: "普通话" },
  { id: "yue",    label: "粤语" },
  { id: "hak",    label: "客家话" },
  { id: "wuu_sh", label: "上海话" },
  { id: "wuu_sz", label: "苏州话" },
  { id: "nan",    label: "闽南语(泉漳)" },
  { id: "cdo",    label: "福州话" },
  { id: "teo",    label: "潮州话" },
  { id: "ltc",    label: "中古汉语" },
  { id: "och",    label: "上古汉语" },
  { id: "jpn_on", label: "日语音读" },
  { id: "jpn_kun",label: "日语训读" },
  { id: "kor",    label: "韩语" },
  { id: "vie",    label: "越南语" },
];
var LANG_MAP = {};
for (var i = 0; i < LANGS.length; i++) {
  LANG_MAP[LANGS[i].id] = LANGS[i];
}

var langStack = ["cmn", "yue"];

function getPron(data, langId) {
  if (!data) return "";
  var raw = data[langId];
  if (!raw) return "";
  return raw.split(",")[0].trim();
}

function mergePron(data, ch, langId) {
  var pron = getPron(data[ch], langId);
  if (pron) return pron;
  var varCh = ST && ST[ch];
  if (varCh && data[varCh]) {
    var vpron = getPron(data[varCh], langId);
    if (vpron) return vpron + "*";
  }
  return "";
}

function escHtml(s) {
  return s.replace(/[&<>]/g, function(c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];
  });
}

function escAttr(s) {
  return s.replace(/["&<>']/g, function(c) {
    return {'"':"&quot;","&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;"}[c];
  });
}

// ── Render ──
function render() {
  var text = document.getElementById("input").value;
  var main = document.getElementById("main");
  var chars = Array.from(text);

  if (!text.trim()) {
    main.innerHTML = '<div class="no-result">请输入汉字开始查询</div>';
    return;
  }
  if (!chars.some(function(ch) { return DB && DB[ch]; })) {
    main.innerHTML = '<div class="no-result">未找到读音数据</div>';
    return;
  }

  var html = "";
  for (var i = 0; i < langStack.length; i++) {
    var langId = langStack[i];
    html += '<div class="lang-row">';
    html += '<div class="label">' + (LANG_MAP[langId] ? LANG_MAP[langId].label : langId) + ' <span class="spk" data-lang="' + langId + '">&#9654;</span></div>';
    html += '<div class="char-grid">';
    for (var j = 0; j < chars.length; j++) {
      var ch = chars[j];
      var isPunct = /[，。、！？；：""''（）\-\—\s]/.test(ch);
      var pron = mergePron(DB, ch, langId);
      html += '<div class="char-cell' + (isPunct ? " punct" : "") + '" data-char="' + escAttr(ch) + '" data-pron="' + escAttr(pron) + '">';
      html += '<span class="hanzi">' + escHtml(ch) + '</span>';
      html += pron ? '<span class="pron">' + escHtml(pron) + '</span>' : "";
      html += '</div>';
    }
    html += '</div></div>';
  }

  main.innerHTML = html;

  // Hover sync
  var allCells = main.querySelectorAll(".char-cell");
  for (var k = 0; k < allCells.length; k++) {
    (function(cell) {
      cell.addEventListener("mouseenter", function() {
        var ch = cell.dataset.char;
        main.querySelectorAll('.char-cell[data-char="' + escAttr(ch) + '"]').forEach(function(c) { c.classList.add("highlight"); });
      });
      cell.addEventListener("mouseleave", function() {
        var ch = cell.dataset.char;
        main.querySelectorAll('.char-cell[data-char="' + escAttr(ch) + '"]').forEach(function(c) { c.classList.remove("highlight"); });
      });
    })(allCells[k]);
  }
}

// ── Sidebar ──
function initSidebar() {
  var srcSel = document.getElementById("srcLang");
  srcSel.innerHTML = LANGS.map(function(l) { return '<option value="' + l.id + '">' + l.label + '</option>'; }).join("");
  srcSel.value = langStack[0];
  srcSel.addEventListener("change", function() {
    var newSrc = srcSel.value;
    if (newSrc !== langStack[0]) {
      setSource(newSrc);
    }
  });
  rebuildLangList();
}

function setSource(newSrc) {
  var idx = langStack.indexOf(newSrc);
  if (idx > 0) langStack.splice(idx, 1);
  langStack.unshift(newSrc);
  document.getElementById("srcLang").value = newSrc;
  rebuildLangList();
  render();
}

function rebuildLangList() {
  var list = document.getElementById("langList");
  list.innerHTML = "";
  var srcId = langStack[0];
  var available = LANGS.filter(function(l) { return l.id !== srcId; });
  for (var i = 0; i < available.length; i++) {
    var lang = available[i];
    var div = document.createElement("div");
    var isOn = langStack.indexOf(lang.id) > 0;
    div.className = "lang-item" + (isOn ? " on" : "");
    div.innerHTML = '<span class="box">✓</span><span>' + lang.label + '</span>';
    div.addEventListener("click", (function(id) { return function() { toggleLang(id); }; })(lang.id));
    list.appendChild(div);
  }
}

function toggleLang(langId) {
  var idx = langStack.indexOf(langId);
  if (idx > 0) {
    langStack.splice(idx, 1);
  } else {
    langStack.push(langId);
  }
  rebuildLangList();
  render();
}

// ── Boot ──
document.getElementById("input").addEventListener("input", render);
document.getElementById("main").addEventListener("click", function(e) {
  var spk = e.target.closest(".spk");
  if (!spk) return;
  var row = spk.closest(".lang-row");
  if (!row) return;
  var langId = spk.dataset.lang;
  var text = document.getElementById("input").value.trim();
  TTS.speak(langId, text, row, spk);
});

initSidebar();
(function wait() {
  if (typeof DB !== "undefined") { render(); return; }
  setTimeout(wait, 50);
})();
