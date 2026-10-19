/* ==========================================================================
   生産管理 3級 — Core UI application
   Vanilla JS, no build step. Questions: data/questions.json or demo file.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- Constants ---------- */
  const CHAPTERS = [
    { no: "01", jp: "品質管理", vn: "Quản lý chất lượng" },
    { no: "02", jp: "原価管理", vn: "Quản lý chi phí" },
    { no: "03", jp: "納期管理", vn: "Quản lý thời hạn giao hàng" },
    { no: "04", jp: "安全衛生", vn: "An toàn & vệ sinh lao động" },
    { no: "05", jp: "環境管理", vn: "Quản lý môi trường" },
    { no: "06", jp: "作業管理", vn: "Quản lý công việc" },
    { no: "07", jp: "工程管理", vn: "Quản lý công đoạn" },
    { no: "08", jp: "設備管理", vn: "Quản lý thiết bị" },
    { no: "09", jp: "資材・在庫管理", vn: "Quản lý vật tư & tồn kho" },
    { no: "10", jp: "運搬・物流管理", vn: "Quản lý vận chuyển & logistics" }
  ];

  const STORE = "pm3.state.v1";
  const STORE_DATA = "pm3.questions.v1";
  const STORE_DECK = "pm3.deckstate.v1."; // + id bộ đề
  const CUSTOM_DECK = "__custom__"; // bộ đề do người dùng tự nhập
  let clearArmed = false; // "Xoá hết" needs a second click
  let clearTimer = 0;
  const BOM = "\uFEFF"; // Excel needs this to read Vietnamese/Japanese correctly

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  const esc = (v) =>
    String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const pad2 = (n) => String(n).padStart(2, "0");

  /* ---------- State ---------- */
  const state = {
    questions: [],
    chapters: CHAPTERS.slice(),
    byId: new Map(),
    view: "dashboard",
    session: null,
    progress: {},
    bookmarks: [],
    vocab: [],
    vocabQuery: "",
    settings: { theme: "light", translation: true, furigana: false },
    source: "demo", // "demo" | "builtin" | "custom"
    filter: "all",
    deckId: null,
    legacy: null,
    pendingDeck: null,
    authTab: "login"
  };

  /* ---------- Storage ---------- */
  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };
  const writeJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage full / private mode — ignore */
    }
  };

  /**
   * Tiến độ / câu đã lưu / phiên đang làm dở gắn với id câu của TỪNG bộ đề nên
   * được lưu riêng theo bộ đề (pm3.deckstate.v1.<id>). Riêng sổ từ vựng và cài
   * đặt hiển thị thì dùng chung cho mọi bộ đề (pm3.state.v1).
   */
  function loadDeckState(id) {
    const saved = readJSON(STORE_DECK + id, null);
    if (saved && typeof saved === "object") {
      state.progress = saved.progress && typeof saved.progress === "object" ? saved.progress : {};
      state.bookmarks = Array.isArray(saved.bookmarks) ? saved.bookmarks : [];
      state.session = saved.session || null;
    } else {
      state.progress = {};
      state.bookmarks = [];
      state.session = null;
    }
    if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
  }

  function saveDeckState() {
    if (!state.deckId) return;
    writeJSON(STORE_DECK + state.deckId, {
      progress: state.progress,
      bookmarks: state.bookmarks,
      session: state.session
    });
  }

  function loadState() {
    const saved = readJSON(STORE, null);
    // Giữ dữ liệu của phiên bản cũ (một bộ đề duy nhất) để chuyển tiến độ sang
    // bộ đề mặc định ở lần mở đầu tiên, thay vì làm người dùng mất tiến độ.
    state.legacy = saved && typeof saved === "object" ? saved : null;
    if (saved && typeof saved === "object") {
      state.vocab = Array.isArray(saved.vocab) ? saved.vocab : [];
      state.settings = Object.assign({ theme: "light", translation: true, furigana: false }, saved.settings || {});
    }
    if (!Array.isArray(state.vocab)) state.vocab = [];
  }

  function saveState() {
    saveDeckState();
    if (typeof scheduleCloudPush === "function") scheduleCloudPush();
    // Giữ nguyên các khoá của bản cũ (nếu còn) để không bao giờ làm mất tiến độ.
    const prev = readJSON(STORE, null) || {};
    writeJSON(STORE, {
      vocab: state.vocab,
      settings: state.settings,
      progress: prev.progress,
      bookmarks: prev.bookmarks,
      session: prev.session
    });
  }

  /** Chuyển tiến độ của bản cũ sang bộ đề mặc định (chỉ khi bộ đề chưa có dữ liệu). */
  function migrateLegacyState(deckId) {
    if (!deckId || !state.legacy) return;
    if (readJSON(STORE_DECK + deckId, null)) return;
    const legacy = state.legacy;
    const progress = legacy.progress && typeof legacy.progress === "object" ? legacy.progress : null;
    const bookmarks = Array.isArray(legacy.bookmarks) ? legacy.bookmarks : null;
    if (!progress && !bookmarks) return;
    writeJSON(STORE_DECK + deckId, {
      progress: progress || {},
      bookmarks: bookmarks || [],
      session: null
    });
  }

  /* ---------- Theme & translation ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    state.settings.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1512" : "#18332b");
    saveState();
  }

  function applyTranslation(on) {
    document.body.classList.toggle("hide-vn", !on);
    const btn = $("#translation-toggle");
    if (btn) btn.setAttribute("aria-pressed", String(on));
    state.settings.translation = on;
    saveState();
  }

  function applyFurigana(on, rerender) {
    document.body.classList.toggle("hide-furigana", !on);
    const btn = $("#furigana-toggle");
    if (btn) btn.setAttribute("aria-pressed", String(on));
    state.settings.furigana = on;
    saveState();
    if (rerender && state.questions.length) render(true);
  }

  const KANJI_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]/;

  /**
   * Split "漢字[かんじ]" notation into ordered parts:
   *   { text: "…" }                      — runs shown verbatim
   *   { base: "漢字", reading: "かんじ" } — annotated words
   *
   * The notation usually has no delimiter before the word ("…の調達[ちょうたつ]…"),
   * so leading kana are emitted as separate text parts instead of being folded
   * into the annotated word.
   */
  function parseFurigana(text) {
    const src = String(text || "");
    const parts = [];
    const re = /([^\s\[\]]+)\[([^\]\s]+)\]/g;
    let last = 0;
    let m;
    while ((m = re.exec(src))) {
      const surface = Array.from(m[1]);
      let lead = 0;
      while (lead < surface.length && !KANJI_RE.test(surface[lead])) lead++;
      if (lead === surface.length) continue; // kana-only annotation: nothing to show
      if (m.index > last) parts.push({ text: src.slice(last, m.index) });
      if (lead) parts.push({ text: surface.slice(0, lead).join("") });
      parts.push({ base: surface.slice(lead).join(""), reading: m[2].trim() });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ text: src.slice(last) });
    return parts.filter((x) => x.text || x.base);
  }

  function rubyHtml(base, reading) {
    return "<ruby>" + esc(base) + "<rt>" + esc(reading) + "</rt></ruby>";
  }

  function plainOf(parts) {
    return parts.map((x) => (x.base != null ? x.base : x.text)).join("");
  }

  /**
   * Render Japanese text with optional <ruby> furigana (format: 漢字[かんじ]).
   *
   * The annotation string mirrors the sentence, so it is rendered directly and
   * the reading is placed once over its whole word. Splitting a reading across
   * single characters (量[り]産[ょうさん]) would invent an alignment that is
   * wrong in almost every case. If the annotation does not match the sentence
   * exactly, the plain sentence is shown instead.
   * Everything is escaped; raw HTML from the data is never trusted.
   */
  function jpWithFurigana(base, furigana) {
    const baseText = String(base || "");
    if (!state.settings.furigana) return esc(baseText);
    const parts = parseFurigana(furigana);
    if (!parts.length) return esc(baseText);

    const same = plainOf(parts).replace(/\s/g, "") === baseText.replace(/\s/g, "");
    if (!same) {
      // Annotation covers a different sentence — fall back to exact rendering.
      return baseText.trim()
        ? esc(baseText)
        : parts.map((x) => (x.base != null ? rubyHtml(x.base, x.reading) : esc(x.text))).join("");
    }

    return parts
      .map((x) => (x.base != null ? rubyHtml(x.base, x.reading) : esc(x.text)))
      .join("");
  }

  /* ---------- Chapter helpers ---------- */
  function resolveChapter(raw) {
    const s = String(raw || "").trim();
    if (!s) return CHAPTERS[0];

    const m = s.match(/^(\d{1,2})\s*[.．、]\s*(.*)$/);
    if (m) {
      const n = Number(m[1]);
      const hit = CHAPTERS.find((c) => Number(c.no) === n);
      if (hit) return hit;
    }
    const compact = s.replace(/\s+/g, "");
    const direct = CHAPTERS.find(
      (c) => compact === c.jp || compact.includes(c.jp) || c.jp.includes(compact)
    );
    if (direct) return direct;

    const num = s.match(/^(\d{1,2})/);
    if (num) {
      const hit = CHAPTERS.find((c) => Number(c.no) === Number(num[1]));
      if (hit) return hit;
    }
    return { no: "--", jp: s || "未分類", vn: "Chưa phân loại" };
  }

  function chapterKey(q) {
    return resolveChapter(q.chapter).no;
  }

  function chapterMeta(key) {
    return CHAPTERS.find((c) => c.no === key) || { no: key, jp: "その他", vn: "Khác" };
  }

  function refreshChapters() {
    const known = CHAPTERS.map((c) => ({ ...c }));
    const extra = new Map();
    state.questions.forEach((q) => {
      const c = resolveChapter(q.chapter);
      if (c.no === "--") extra.set(c.jp, c);
    });
    state.chapters = known.concat(Array.from(extra.values()));
  }

  function questionsOf(chapterNo) {
    return state.questions.filter((q) => chapterKey(q) === chapterNo);
  }

  /* ---------- Progress helpers ---------- */
  function progressOf(id) {
    return state.progress[id] || null;
  }

  function stats() {
    const total = state.questions.length;
    const attempted = state.questions.filter((q) => progressOf(q.id)).length;
    const mastered = state.questions.filter((q) => (progressOf(q.id) || {}).correct > 0).length;
    let attempts = 0;
    let correct = 0;
    Object.values(state.progress).forEach((p) => {
      attempts += p.attempts || 0;
      correct += p.correct || 0;
    });
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
    const wrong = state.questions.filter((q) => {
      const p = progressOf(q.id);
      return p && p.lastCorrect === false;
    }).length;
    return { total, attempted, mastered, accuracy, attempts, correct, wrong };
  }

  function chapterStats(no) {
    const list = questionsOf(no);
    const done = list.filter((q) => progressOf(q.id)).length;
    const right = list.filter((q) => (progressOf(q.id) || {}).correct > 0).length;
    return { total: list.length, done, right, pct: pct(right, list.length) };
  }

  /* ---------- Data loading & validation ---------- */
  const KEYS = ["ア", "イ", "ウ", "エ"];

  function validateQuestions(raw) {
    if (!Array.isArray(raw)) return { ok: false, error: "Dữ liệu phải là một mảng [...] các câu hỏi." };
    if (!raw.length) return { ok: false, error: "Mảng dữ liệu rỗng." };

    const out = [];
    const problems = [];
    const seen = new Set();

    raw.forEach((item, i) => {
      const at = i + 1;
      if (!item || typeof item !== "object") {
        problems.push(`Câu #${at}: không phải đối tượng hợp lệ.`);
        return;
      }
      const id = String(item.id == null ? "" : item.id).trim();
      if (!id) problems.push(`Câu #${at}: thiếu "id".`);

      const question = item.question || {};
      if (!question.japanese && !question.vietnamese) {
        problems.push(`Câu #${at}: thiếu nội dung "question".`);
      }

      const options = Array.isArray(item.options) ? item.options : [];
      if (options.length < 2) problems.push(`Câu #${at}: cần ít nhất 2 đáp án.`);

      const correct = String(item.correct_answer == null ? "" : item.correct_answer).trim();
      const optKeys = options.map((o) => String((o || {}).key || "").trim());
      if (!correct) problems.push(`Câu #${at}: thiếu "correct_answer".`);
      else if (optKeys.length && !optKeys.includes(correct)) {
        problems.push(`Câu #${at}: "correct_answer" (${correct}) không khớp đáp án nào.`);
      }

      if (id && seen.has(id)) problems.push(`Câu #${at}: "id" bị trùng (${id}).`);
      seen.add(id);

      out.push({
        id: id || String(at).padStart(2, "0"),
        chapter: String(item.chapter || "").trim(),
        question: {
          japanese: String(question.japanese || "").trim(),
          vietnamese: String(question.vietnamese || "").trim(),
          furigana: String(question.furigana || "").trim()
        },
        options: options.map((o) => ({
          key: String((o || {}).key || "").trim(),
          japanese: String((o || {}).japanese || "").trim(),
          vietnamese: String((o || {}).vietnamese || "").trim(),
          furigana: String((o || {}).furigana || "").trim()
        })),
        correct_answer: correct,
        explanation: {
          correct_reason: String((item.explanation || {}).correct_reason || "").trim(),
          incorrect_reasons: Object.assign({}, (item.explanation || {}).incorrect_reasons || {})
        },
        key_knowledge: Array.isArray(item.key_knowledge) ? item.key_knowledge.map(String) : [],
        exam_traps: Array.isArray(item.exam_traps) ? item.exam_traps.map(String) : [],
        vocabulary: (Array.isArray(item.vocabulary) ? item.vocabulary : [])
          .map((v) => {
            const reading = String((v || {}).reading || "").trim();
            const meaning = String((v || {}).meaning || "").trim();
            const word = String((v || {}).word || "").trim();
            let w = word || reading;
            if (!w && meaning) w = "「" + meaning + "」";
            return { word: w, reading, meaning };
          })
          .filter((v) => v.word && (v.meaning || v.reading))
      });
    });

    if (!out.length) {
      return { ok: false, error: "Không đọc được câu hỏi hợp lệ nào." + (problems.length ? " " + problems[0] : "") };
    }
    return { ok: true, questions: out, warnings: problems };
  }

  /* ---------- Thư viện bộ đề & tài khoản ---------- */
  function decks() {
    return window.PM3Decks || null;
  }

  /** Module thành viên (mã kích hoạt cấp qua Zalo). */
  function memberApi() {
    return window.PM3Member || null;
  }

  function memberInfo() {
    const m = memberApi();
    return m ? m.info() : null;
  }

  function activeDeckName() {
    const custom = readJSON(STORE_DATA, null);
    if (state.deckId === CUSTOM_DECK && custom) return "Bộ đề riêng";
    const item = decks() && decks().entry(state.deckId);
    return item ? item.name : "";
  }

  /** Nạp một bộ đề và đặt nó làm bộ đề đang dùng (kèm trạng thái riêng). */
  async function loadAndAdopt(deckId, raw) {
    const v = validateQuestions(raw);
    if (!v.ok) throw new Error(v.error);
    state.deckId = deckId;
    migrateLegacyState(deckId);
    loadDeckState(deckId);
    const item = decks() && decks().entry(deckId);
    state.source = deckId === CUSTOM_DECK ? "custom" : item ? "builtin" : "demo";
    state.questions = v.questions;
    state.byId = new Map(v.questions.map((q) => [q.id, q]));
    refreshChapters();
    updateDataSourceLabel();

    // Khôi phục phiên làm dở của CHÍNH bộ đề này (nếu có và còn hợp lệ).
    const restored = state.session;
    if (restored && Array.isArray(restored.ids) && restored.ids.length) {
      restored.ids = restored.ids.filter((id) => state.byId.has(id));
      if (!restored.ids.length || !state.byId.has(restored.ids[restored.index])) state.session = null;
    }
    state.view = state.session ? "practice" : "dashboard";
    render();
  }

  /** Mở một bộ đề theo id (kiểm tra quyền thành viên trước). */
  async function openDeck(id) {
    if (!decks()) return;
    const item = decks().entry(id);
    if (!item) return;
    if (!decks().isUnlocked(item)) {
      state.pendingDeck = id;
      openMember();
      toast("warn", "Bộ đề này dành cho thành viên. Hãy kích hoạt mã để mở khoá.");
      return;
    }
    try {
      toast("info", "Đang mở " + item.name + "…");
      const raw = await decks().load(id);
      await loadAndAdopt(id, raw);
      toast("ok", "Đã mở bộ đề: " + item.name);
    } catch (e) {
      toast("warn", "Không mở được bộ đề: " + e.message);
    }
  }

  async function loadQuestions() {
    const d = decks();
    if (d) {
      // 1) Bộ đề riêng do người dùng nhập trước đó.
      const custom = readJSON(STORE_DATA, null);
      if (custom) {
        const v = validateQuestions(custom);
        if (v.ok) {
          state.deckId = CUSTOM_DECK;
          state.source = "custom";
          migrateLegacyState(CUSTOM_DECK);
          loadDeckState(CUSTOM_DECK);
          return v.questions;
        }
      }
      // 2) Bộ đề mặc định = bộ MIỄN PHÍ đầu tiên trong thư viện.
      const first = d.freeFirst();
      if (first) {
        try {
          const raw = await d.load(first.id);
          const v = validateQuestions(raw);
          if (v.ok) {
            state.deckId = first.id;
            state.source = "builtin";
            migrateLegacyState(first.id);
            loadDeckState(first.id);
            return v.questions;
          }
        } catch (e) {
          /* rơi xuống các phương án dự phòng */
        }
      }
    }

    // 3) Bộ dữ liệu gộp cũ (data/questions-data.js).
    if (typeof window !== "undefined" && Array.isArray(window.QUESTIONS_DATA)) {
      const v = validateQuestions(window.QUESTIONS_DATA);
      if (v.ok) {
        state.deckId = state.deckId || "builtin";
        state.source = "builtin";
        migrateLegacyState(state.deckId);
        loadDeckState(state.deckId);
        return v.questions;
      }
    }
    // 4) Bộ câu hỏi mẫu.
    if (typeof window !== "undefined" && Array.isArray(window.DEMO_QUESTIONS)) {
      const v = validateQuestions(window.DEMO_QUESTIONS);
      if (v.ok) {
        state.deckId = state.deckId || "demo";
        state.source = "demo";
        migrateLegacyState(state.deckId);
        loadDeckState(state.deckId);
        return v.questions;
      }
    }
    return [];
  }

  /* ---------- Sessions ---------- */
  function newSession(idList, mode, label) {
    return {
      ids: idList.slice(),
      index: 0,
      answers: {},
      checked: {},
      mode,
      label: label || "",
      startedAt: Date.now()
    };
  }

  function startSession(mode, chapterNo) {
    let ids = [];
    let label = "";
    if (mode === "chapter") {
      ids = questionsOf(chapterNo).map((q) => q.id);
      label = chapterMeta(chapterNo).jp;
    } else if (mode === "review") {
      ids = state.questions
        .filter((q) => {
          const p = progressOf(q.id);
          return p && p.lastCorrect === false;
        })
        .map((q) => q.id);
      label = "Câu làm sai";
    } else if (mode === "bookmarks") {
      ids = state.bookmarks.filter((id) => state.byId.has(id));
      label = "Câu đã lưu";
    } else if (mode === "wrong") {
      ids = (state.filter === "wrong" ? state.session.ids : []).slice();
      label = "Câu làm sai trong lượt";
    } else {
      ids = state.questions.map((q) => q.id);
      label = "Toàn bộ";
    }

    if (!ids.length) {
      toast("warn", mode === "bookmarks" ? "Chưa có câu nào được lưu." : "Không có câu hỏi phù hợp.");
      return;
    }
    state.session = newSession(ids, mode === "chapter" ? "chapter" : mode, label);
    state.session.chapter = chapterNo || null;
    state.view = "practice";
    saveState();
    render();
  }

  function currentQuestion() {
    const s = state.session;
    if (!s) return null;
    return state.byId.get(s.ids[s.index]) || null;
  }

  function recordAnswer(q, key, isCorrect, firstTry) {
    const p = progressOf(q.id) || { attempts: 0, correct: 0, lastCorrect: null, firstTryCorrect: null };
    p.attempts += 1;
    if (isCorrect) p.correct += 1;
    p.lastCorrect = isCorrect;
    p.lastAnswer = key;
    p.seenAt = Date.now();
    if (firstTry && p.firstTryCorrect === null) p.firstTryCorrect = isCorrect;
    if (isCorrect && p.firstTryCorrect === null) p.firstTryCorrect = true;
    if (isCorrect && p.firstTryCorrect === false && !p.recovered) p.recovered = true;
    state.progress[q.id] = p;
    saveState();
    syncCounters();
    updateSidebarProgress();
  }

  /* ---------- Bookmarks ---------- */
  function isBookmarked(id) {
    return state.bookmarks.includes(id);
  }
  function toggleBookmark(id) {
    const i = state.bookmarks.indexOf(id);
    if (i >= 0) {
      state.bookmarks.splice(i, 1);
      toast("info", "Đã bỏ lưu câu hỏi.");
    } else {
      state.bookmarks.push(id);
      toast("ok", "Đã lưu câu hỏi để ôn lại.");
    }
    saveState();
    syncCounters();
    render();
  }

  /* ---------- Saved vocabulary ---------- */
  /** Stable key so the same word is never saved twice. */
  function vocabKey(word) {
    return String(word || "").trim();
  }

  function isVocabSaved(word) {
    const k = vocabKey(word);
    return state.vocab.some((v) => v.word === k);
  }

  function toggleVocab(word, entry) {
    const k = vocabKey(word);
    if (!k) return;
    const i = state.vocab.findIndex((v) => v.word === k);
    if (i >= 0) {
      state.vocab.splice(i, 1);
      toast("info", `Đã bỏ "${k}" khỏi sổ từ vựng.`);
    } else {
      const e = entry || {};
      state.vocab.push({
        word: k,
        reading: String(e.reading || "").trim(),
        meaning: String(e.meaning || "").trim(),
        source: String(e.source || "").trim(),
        jp: String(e.jp || "").trim(),
        vn: String(e.vn || "").trim(),
        savedAt: Date.now()
      });
      toast("ok", `Đã lưu "${k}" vào sổ từ vựng.`);
    }
    saveState();
    syncCounters();
    render(true);
  }

  function removeVocab(word) {
    const k = vocabKey(word);
    state.vocab = state.vocab.filter((v) => v.word !== k);
    saveState();
    syncCounters();
    render();
  }

  /** Vietnamese text is unaccented before comparison so "chi phí" ~ "chi phi". */
  function foldVn(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();
  }

  /**
   * Filter the notebook. Word / reading / meaning are searched first; the source
   * sentence is only used when the main fields have no hit, so a word query does
   * not return every card that shares the same source sentence.
   */
  function vocabMatches(list, query) {
    const needle = foldVn(query);
    if (!needle) return list;
    const inFields = list.filter(
      (v) => foldVn(v.word).includes(needle) || foldVn(v.reading).includes(needle) || foldVn(v.meaning).includes(needle)
    );
    if (inFields.length) return inFields;
    return list.filter((v) => foldVn(v.jp).includes(needle) || foldVn(v.vn).includes(needle));
  }

  function vocabCsv() {
    const head = ["Từ", "Cách đọc", "Nghĩa", "Câu tiếng Nhật", "Câu dịch", "Nguồn"];
    const cell = (x) => '"' + String(x || "").replace(/"/g, '""') + '"';
    const rows = state.vocab.map((v) =>
      [v.word, v.reading, v.meaning, v.jp, v.vn, v.source].map(cell).join(",")
    );
    return [head.map(cell).join(","), ...rows].join("\r\n");
  }

  /**
   * One vocabulary card: Japanese word (wraps), reading, Vietnamese meaning,
   * and a save icon that puts the word into the vocabulary notebook.
   */
  function vocabCard(word, reading, meaning, source, opts = {}) {
    const saved = isVocabSaved(word);
    const remove = opts.onRemove
      ? `<button class="icon-button vocab-remove" type="button" data-vocab-remove="${esc(word)}" aria-label="Xoá khỏi sổ từ vựng" title="Xoá khỏi sổ">${icon("trash")}</button>`
      : "";
    const jp = String(opts.jp || "");
    const vn = String(opts.vn || "");
    // In the feedback panel every word shares the same question sentence, so the
    // context block is only rendered in the notebook (opts.showContext === false hides it).
    const context =
      (jp || vn) && opts.showContext !== false
        ? `<div class="vocab-context">
             ${jp ? `<p class="ctx-jp">${esc(jp)}</p>` : ""}
             ${vn ? `<p class="ctx-vn">${esc(vn)}</p>` : ""}
           </div>`
        : "";
    return `
      <div class="vocab-card${saved ? " is-saved" : ""}">
        <div class="vocab-main">
          <div class="w">${esc(word)}</div>
          <div class="r">${esc(reading)}</div>
          <div class="m">${esc(meaning)}</div>
          ${opts.meta ? `<div class="src">${esc(opts.meta)}</div>` : ""}
          ${context}
        </div>
        <div class="vocab-actions">
          ${remove}
          ${opts.onRemove ? "" : `<button class="icon-button vocab-save${saved ? " is-on" : ""}" type="button"
            data-vocab-save="${esc(word)}" data-vocab-reading="${esc(reading)}"
            data-vocab-meaning="${esc(meaning)}" data-vocab-source="${esc(source || "")}"
            data-vocab-jp="${esc(jp)}" data-vocab-vn="${esc(vn)}"
            aria-pressed="${saved}" aria-label="${saved ? "Bỏ lưu từ vựng" : "Lưu vào sổ từ vựng"}"
            title="${saved ? "Bỏ lưu từ vựng" : "Lưu vào sổ từ vựng"}">${icon("bookmark")}</button>`}
        </div>
      </div>`;
  }

  /* ---------- Toasts ---------- */
  function toast(kind, message) {
    const region = $("#toast-region");
    if (!region) return;
    const name = kind === "ok" ? "check" : kind === "warn" ? "alert" : kind === "info" ? "info" : "alert";
    const el = document.createElement("div");
    el.className = `toast ${kind === "info" ? "ok" : kind}`;
    el.innerHTML = `${icon(name)}<span>${esc(message)}</span>`;
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-out");
      setTimeout(() => el.remove(), 320);
    }, 3400);
  }

  /* ---------- Sidebar & counters ---------- */
  function syncCounters() {
    const wrongCount = state.questions.filter((q) => {
      const p = progressOf(q.id);
      return p && p.lastCorrect === false;
    }).length;
    const rc = $("#review-count");
    const bc = $("#bookmark-count");
    if (rc) rc.textContent = wrongCount;
    if (bc) bc.textContent = state.bookmarks.length;
    const vc = $("#vocab-count");
    if (vc) vc.textContent = state.vocab.length;
  }

  function updateSidebarProgress() {
    const s = stats();
    const text = $("#sidebar-progress-text");
    const bar = $("#sidebar-progress-bar");
    const value = pct(s.mastered, s.total);
    if (text) text.textContent = value + "%";
    if (bar) bar.style.width = value + "%";
  }

  function renderChapterNav() {
    const nav = $("#chapter-nav");
    if (!nav) return;
    nav.innerHTML = state.chapters
      .map((c) => {
        const st = chapterStats(c.no);
        const active =
          state.view === "practice" && state.session && state.session.chapter === c.no;
        return `
          <button class="chapter-nav-item${active ? " is-active" : ""}" type="button" data-chapter="${esc(c.no)}">
            <span class="chapter-index">${esc(c.no)}</span>
            <span class="chapter-nav-name">${esc(c.jp)}<small>${esc(c.vn)}</small></span>
            <span class="chapter-nav-count">${st.right}/${st.total}</span>
          </button>`;
      })
      .join("");
  }

  /* ---------- Views: dashboard ---------- */
  /** Dải nhỏ giới thiệu bộ đề đang dùng + lối vào thư viện. */
  function deckStrip() {
    const d = decks();
    const items = d ? d.list() : [];
    if (!items.length) return "";
    const free = items.filter((x) => x.free).length;
    const lockedNow = items.filter((x) => !d.isUnlocked(x)).length;
    const current = activeDeckName();
    const m = memberInfo();
    const memberLine = m
      ? `${lockedNow ? " · " + lockedNow + " bộ đã mở khoá" : " · tất cả đã mở khoá"}`
      : lockedNow
      ? ` · ${lockedNow} bộ cần mã kích hoạt`
      : "";
    return `
      <div class="deck-strip">
        <div class="deck-strip-icon">${icon("library")}</div>
        <div class="deck-strip-copy">
          <strong>Thư viện: ${items.length} bộ đề</strong>
          <small>${free} miễn phí${memberLine}${current ? ` · đang dùng: ${esc(current)}` : ""}</small>
        </div>
        ${m ? "" : `<button class="soft-button" type="button" data-open-member>${icon("key")}Kích hoạt mã</button>`}
        <button class="soft-button" type="button" data-view="library">${icon("arrow")}Mở thư viện</button>
      </div>`;
  }

  function renderDashboard() {
    const s = stats();
    const overall = pct(s.mastered, s.total);

    const hero = `
      <section class="dash-hero">
        <div class="dash-hero-copy">
          <span class="eyebrow">ビジネスキャリア検定 · 生産管理オペレーション</span>
          <h1>Luyện thi <em>生産管理 3級</em></h1>
          <p>Ôn tập theo 10 chương của đề thi, chấm điểm ngay và xem giải thích chi tiết cho từng phương án, kèm bẫy thường gặp và từ vựng tiếng Nhật.</p>
          <div class="dash-hero-actions">
            <button class="primary-button" type="button" data-start-mode="all" ${s.total ? "" : "disabled"}>
              ${icon("target")}Bắt đầu luyện tập
            </button>
            <button class="ghost-button" type="button" data-start-mode="review">${icon("refresh")}Ôn câu làm sai</button>
            <button class="ghost-button" type="button" data-view="library">${icon("library")}Thư viện bộ đề</button>
            <button class="ghost-button" type="button" data-open-import>${icon("upload")}Nhập bộ đề</button>
          </div>
        </div>
        <div class="dash-ring">
          <div class="ring" style="--pct:${overall}">
            <div class="ring-inner"><strong>${overall}%</strong><span>Hoàn thành</span></div>
          </div>
          <p class="dash-ring-note">${s.mastered}/${s.total} câu đã trả lời đúng ít nhất một lần</p>
        </div>
      </section>`;

    const cards = [
      { name: "layers", label: "Tổng số câu", value: s.total, note: `${state.chapters.length} chương` },
      { name: "check", label: "Đã làm", value: s.attempted, note: `${pct(s.attempted, s.total)}% bộ đề` },
      { name: "target", label: "Độ chính xác", value: s.accuracy + "%", note: `${s.correct || 0} câu đúng` },
      { name: "alert", label: "Cần ôn lại", value: s.wrong, note: "Câu làm sai ở lượt gần nhất" }
    ];
    const statGrid = `
      <div class="stat-grid">
        ${cards
          .map(
            (c) => `
          <div class="stat-card">
            <div class="stat-top">${icon(c.name)}<span>${esc(c.label)}</span></div>
            <strong>${esc(c.value)}</strong>
            <small>${esc(c.note)}</small>
          </div>`
          )
          .join("")}
      </div>`;

    const chapterCards = state.chapters
      .map((c) => {
        const st = chapterStats(c.no);
        const has = st.total > 0;
        const score = st.total ? st.pct : 0;
        const cls = !has ? "" : score >= 80 ? "is-good" : score >= 50 ? "is-mid" : "is-low";
        return `
          <button class="chapter-card" type="button" data-chapter="${esc(c.no)}" ${has ? "" : "disabled"}>
            <div class="chapter-card-top">
              <span class="chapter-badge">${esc(c.no)}</span>
              <div>
                <h3>${esc(c.jp)}</h3>
                <div class="chapter-vn">${esc(c.vn)}</div>
              </div>
            </div>
            <div class="chapter-meta">
              <span>${st.total} câu hỏi</span>
              <span class="chapter-score ${cls}">${has ? score + "%" : "—"}</span>
            </div>
            <div class="chapter-card-bar"><span style="width:${has ? score : 0}%"></span></div>
            <div class="chapter-card-foot">
              <span class="chapter-meta">Đúng ${st.right}/${st.total}</span>
              <span class="go">${has ? "Luyện ngay" : "Chưa có câu"} ${icon("arrow")}</span>
            </div>
          </button>`;
      })
      .join("");

    return `
      ${hero}
      ${statGrid}
      ${deckStrip()}
      <div class="section-head">
        <div><h2>Chương học</h2><p>Chọn một chương để luyện tập có trọng tâm.</p></div>
        <div class="head-actions">
          <button class="chip" type="button" data-start-mode="all">${icon("grid")}Toàn bộ ${s.total} câu</button>
        </div>
      </div>
      <div class="chapter-grid">${chapterCards}</div>`;
  }

  /* ---------- Views: deck library ---------- */
  /** Quét lại thư mục Drive và vẽ lại thư viện. */
  async function refreshDriveLibrary() {
    const c = window.PM3Cloud;
    if (!c || !c.canUseDriveRead || !c.canUseDriveRead()) {
      toast("warn", "Chưa cấu hình Google Drive trong assets/js/cloud-config.js.");
      return;
    }
    toast("info", "Đang quét thư mục Drive…");
    const n = await window.PM3Decks.refreshDrive();
    render();
    toast(n ? "ok" : "warn", n ? "Đã tìm thấy " + n + " bộ đề trên Drive." : "Không tìm thấy file JSON nào trên Drive (kiểm tra quyền chia sẻ thư mục).");
  }

  function renderLibrary() {
    const d = decks();
    const items = d ? d.list() : [];
    const member = memberInfo();

    const head = `
      <div class="section-head">
        <div>
          <h1>Thư viện bộ đề</h1>
          <p>Chọn một bộ đề để luyện. Bộ <strong>miễn phí</strong> mở cho mọi người; các bộ còn lại cần <strong>mã kích hoạt thành viên</strong>.</p>
        </div>
        <div class="head-actions">
          <button class="chip" type="button" data-refresh-drive>${icon("cloud")}Đồng bộ Drive</button>
          <button class="chip" type="button" data-open-import>${icon("upload")}Nhập JSON riêng</button>
        </div>
      </div>`;

    const memberShown = member
      ? `<div class="deck-account-note is-member">${icon("check")} Thành viên <strong>${esc(member.name || "đã kích hoạt")}</strong> — còn <strong>${memberApi().daysLeft()} ngày</strong>. Toàn bộ bộ đề thành viên đã được mở khoá.</div>`
      : `<div class="deck-account-note">${icon("lock")} Bạn đang xem với tư cách khách. Hãy <button class="auth-link" type="button" data-open-member>kích hoạt mã thành viên</button> — liên hệ Zalo <a class="auth-link" href="${memberApi() ? memberApi().ZALO_URL : "#"}" target="_blank" rel="noopener">${memberApi() ? memberApi().ZALO_DISPLAY : ""}</a> để đăng ký.</div>`;

    if (!items.length) {
      return (
        head +
        memberShown +
        `<div class="empty-note">${icon("library")} Chưa có bộ đề nào trong thư mục <code>de/</code>.<br>
         Hãy thêm file JSON rồi chạy <code>node tools/build-de.mjs</code> để cập nhật thư viện.</div>`
      );
    }

    const cards = items
      .map((item) => {
        const unlocked = d.isUnlocked(item);
        const isCurrent = item.id === state.deckId;
        const badge = item.free
          ? `<span class="deck-badge is-free">${icon("check")}Miễn phí</span>`
          : unlocked
          ? `<span class="deck-badge is-unlocked">${icon("key")}Đã mở khoá</span>`
          : `<span class="deck-badge is-locked">${icon("lock")}Thành viên</span>`;
        const action = item.free || unlocked
          ? `<span class="deck-open">Mở bộ đề ${icon("arrow")}</span>`
          : `<span class="deck-lock-note">${icon("lock")}Kích hoạt mã để mở</span>`;
        return `
          <button class="deck-card${item.free ? " is-free" : ""}${isCurrent ? " is-active" : ""}"
            type="button" data-deck="${esc(item.id)}">
            <div class="deck-card-top">
              <span class="deck-icon">${icon(item.free || unlocked ? "library" : "lock")}</span>
              ${badge}
            </div>
            <div>
              <div class="deck-title">${esc(item.name)}</div>
              <div class="deck-id">${esc(item.id)}</div>
            </div>
            <div class="deck-meta">
              ${item.source === "drive"
                ? `<span class="deck-src">${icon("cloud")}Google Drive</span>`
                : `<span class="deck-src">${icon("layers")}Cục bộ</span>`}
              ${item.count ? `<span><b>${item.count}</b> câu hỏi</span>` : `<span>Nhấn để tải</span>`}
              ${item.count ? `<span><b>${Object.keys(item.chapters || {}).length}</b> chương</span>` : ""}
              ${isCurrent ? `<span class="deck-current">${icon("check")}Đang dùng</span>` : ""}
            </div>
            <div class="deck-foot">${action}</div>
          </button>`;
      })
      .join("");

    return head + memberShown + `<div class="library-grid">${cards}</div>`;
  }

  /* ---------- Auth (đăng nhập / đăng ký) ---------- */
  function showAuthError(box, message) {
    const el = $("#" + box);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = icon("alert") + " " + esc(message);
  }

  function setAuthTab(tab) {
    state.authTab = tab === "register" ? "register" : "login";
    $$("[data-auth-tab]").forEach((b) => {
      const active = b.dataset.authTab === state.authTab;
      if (b.classList.contains("auth-tab")) {
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      }
    });
    const loginForm = $("#login-form");
    const registerForm = $("#register-form");
    if (loginForm) loginForm.hidden = state.authTab !== "login";
    if (registerForm) registerForm.hidden = state.authTab !== "register";
    const title = $("#auth-title");
    const eyebrow = $("#auth-eyebrow");
    if (title) title.textContent = state.authTab === "register" ? "Đăng ký thành viên" : "Đăng nhập";
    if (eyebrow) eyebrow.textContent = state.authTab === "register" ? "Tạo tài khoản mới" : "Thành viên";
    showAuthError("login-error", "");
    showAuthError("register-error", "");
    updateAuthModeUI();
  }

  /** Hiện/ẩn nút Google và đổi nhãn theo chế độ cloud/cục bộ. */
  function updateAuthModeUI() {
    const cloudOn = !!(window.PM3Account && window.PM3Account.isCloud && window.PM3Account.isCloud());
    const online = !!(window.PM3Account && window.PM3Account.isOnline && window.PM3Account.isOnline());
    const g = $("#google-login-btn");
    const divider = $("#auth-divider");
    if (g) g.hidden = state.authTab !== "login" || !online;
    if (divider) divider.hidden = state.authTab !== "login" || !online;

    // Chế độ CHỈ-GOOGLE (direct, không Firebase): ẩn form email và tab Đăng ký.
    // Chế độ cục bộ / Firebase thì vẫn hiện đầy đủ.
    const directOnly = online && !cloudOn;
    const tabs = $(".auth-tabs");
    if (tabs) tabs.hidden = directOnly;
    const loginForm = $("#login-form");
    if (loginForm) loginForm.hidden = directOnly || state.authTab !== "login";
    const registerFormEl = $("#register-form");
    if (registerFormEl) registerFormEl.hidden = directOnly || state.authTab !== "register";
    const registerTab = $('.auth-tab[data-auth-tab="register"]');
    if (registerTab) registerTab.hidden = directOnly;
    if (directOnly) state.authTab = "login";

    const emailNote = $("#email-required-note");
    if (emailNote) emailNote.hidden = !cloudOn;
    const loginInput = $("#login-username");
    if (loginInput) {
      loginInput.placeholder = cloudOn ? "email@example.com" : "ví dụ: kero";
      loginInput.type = cloudOn ? "email" : "text";
    }
    // Hiện địa chỉ đang mở — đây chính là "domain" mà Firebase phải cho phép.
    const originEl = $("#auth-origin");
    if (originEl) {
      const proto = (typeof location !== "undefined" && location.protocol) || "";
      const host = (typeof location !== "undefined" && location.host) || "";
      if (proto === "file:") {
        originEl.innerHTML = icon("alert") + " Đang mở bằng <code>file://</code> — Google/Firebase không hoạt động. Hãy chạy <code>npx --yes serve . -l 8778</code> rồi mở <code>http://localhost:8778</code>.";
        originEl.hidden = false;
      } else if (online) {
        originEl.innerHTML = icon("info") + " Domain đang dùng: <code>" + esc(host) + "</code>";
        originEl.hidden = false;
      } else {
        originEl.hidden = true;
      }
    }

    const note = $("#auth-note-text");
    if (note) {
      if (cloudOn) {
        note.textContent = "Đăng nhập do Firebase (Google) quản lý. Tiến độ học được lưu trên Google Drive của chính bạn.";
      } else if (online) {
        note.textContent = "Đăng nhập bằng Google. Tiến độ học được lưu trên Google Drive của chính bạn — không lưu trên máy chủ nào.";
      } else {
        note.textContent = "Chưa cấu hình đăng nhập Google: tài khoản được lưu trên chính máy này để mở khoá bộ đề thành viên.";
      }
    }
  }

  async function openAuth(tab) {
    if (window.PM3Cloud && !window.PM3Cloud.ready) {
      try { await window.PM3Cloud.init(); } catch (e) { /* bỏ qua */ }
    }
    // Chế độ chỉ-Google: luôn mở tab đăng nhập.
    if (window.PM3Account && window.PM3Account.isDirect && window.PM3Account.isDirect()) tab = "login";
    setAuthTab(tab || "login");
    openModal($("#auth-modal"));
    if (state.authTab === "register") {
      const el = $("#register-username");
      if (el) el.focus();
    }
  }

  function syncAccountUI() {
    const m = memberInfo();
    setAuthScopeNote();
    const btn = $("#account-button");
    if (btn) {
      btn.setAttribute("class", "account-button" + (m ? " is-member" : ""));
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute(
        "title",
        m ? "Thành viên" + (m.name ? " " + m.name : "") + " — còn " + memberApi().daysLeft() + " ngày" : "Kích hoạt mã thành viên"
      );
    }
    const status = $("#account-status");
    const name = $("#account-name");
    if (status) status.textContent = m ? "Thành viên" : "Khách";
    if (name) name.textContent = m ? m.name || "Đã kích hoạt" : "Kích hoạt mã";
  }

  /* ---------- Thành viên: mã kích hoạt (Zalo) ---------- */
  function showMemberError(message) {
    const el = $("#member-error");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = icon("alert") + " " + esc(message);
  }

  /** Vẽ lại trạng thái thành viên trong hộp thoại. */
  function renderMemberStatus() {
    const box = $("#member-status");
    if (!box) return;
    const m = memberInfo();
    if (m) {
      const d = new Date(m.expiresAt);
      const dd = pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
      box.className = "member-status is-active";
      box.innerHTML = `
        <div class="member-status-icon">${icon("check")}</div>
        <div class="member-status-copy">
          <strong>${esc(m.name || "Thành viên")}</strong>
          <small>Còn ${memberApi().daysLeft()} ngày · hết hạn ${dd}</small>
        </div>
        <button class="text-button is-danger" type="button" data-member-deactivate>${icon("logout")}Huỷ</button>`;
      const form = $("#member-form");
      if (form) form.hidden = true;
      const contact = $(".member-contact");
      if (contact) contact.hidden = true;
    } else {
      box.className = "member-status";
      box.innerHTML = `${icon("lock")} Chưa kích hoạt — bộ đề thành viên vẫn bị khoá.`;
      const form = $("#member-form");
      if (form) form.hidden = false;
      const contact = $(".member-contact");
      if (contact) contact.hidden = false;
    }
    setAuthScopeNote();
  }

  /** Điền sẵn tin nhắn Zalo + liên kết. */
  function syncMemberModal() {
    const m = memberApi();
    if (!m) return;
    const zalo = $("#member-zalo");
    if (zalo) zalo.href = m.ZALO_URL;
    const pend = state.pendingDeck && decks() ? decks().entry(state.pendingDeck) : null;
    const zaloText = $("#member-zalo-text");
    if (zaloText) zaloText.textContent = "Nhắn Zalo " + m.ZALO_DISPLAY;
    // Gợi ý nội dung tin nhắn nếu trình duyệt hỗ trợ web share; nếu không thì
    // người dùng chỉ cần bấm vào liên kết Zalo là đủ.
    const cloud = $("#member-cloud-link");
    if (cloud) {
      let html = "";
      if (pend) html += icon("info") + " Bạn đang cần mở bộ đề <strong>" + esc(pend.name) + "</strong>.";
      if (html) {
        cloud.innerHTML = html;
        cloud.hidden = false;
      } else {
        cloud.hidden = true;
      }
    }
  }

  async function submitMemberCode(e) {
    e.preventDefault();
    const m = memberApi();
    if (!m) return;
    const btn = $("#member-form button[type=submit]");
    const input = $("#member-code");
    showMemberError("");
    if (btn) btn.disabled = true;
    let res;
    try {
      res = await m.activate(input ? input.value : "");
    } finally {
      if (btn) btn.disabled = false;
    }
    if (!res.ok) {
      showMemberError(res.error);
      return;
    }
    if (input) input.value = "";
    renderMemberStatus();
    syncAccountUI();
    toast("ok", "Kích hoạt thành công. Đã mở khoá bộ đề thành viên!");
    const pending = state.pendingDeck;
    state.pendingDeck = null;
    if (pending) {
      closeModal($("#member-modal"));
      openDeck(pending);
    } else if (state.view === "library" || state.view === "dashboard") {
      render();
    }
  }

  async function deactivateMember() {
    const m = memberApi();
    if (!m) return;
    m.deactivate();
    renderMemberStatus();
    syncAccountUI();
    // Nếu đang mở bộ đề thành viên thì quay về bộ miễn phí.
    const it = decks() && decks().entry(state.deckId);
    if (it && !decks().isUnlocked(it)) {
      const free = decks().freeFirst();
      if (free) await openDeck(free.id);
    } else {
      render();
    }
    toast("info", "Đã huỷ kích hoạt thành viên trên thiết bị này.");
  }

  function openMember() {
    showMemberError("");
    renderMemberStatus();
    syncMemberModal();
    openModal($("#member-modal"));
    const m = memberInfo();
    if (!m) {
      const el = $("#member-code");
      if (el) el.focus();
    }
  }

  /** Gợi ý tin nhắn Zalo (dùng khi bấm nút). */
  async function contactZalo() {
    const m = memberApi();
    if (!m) return;
    const pend = state.pendingDeck && decks() ? decks().entry(state.pendingDeck) : null;
    const text = m.contactMessage(pend ? pend.name : "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast("ok", "Đã sao chép lời nhắn — dán vào Zalo để gửi.");
      }
    } catch (e) {
      /* trình duyệt không cho phép clipboard */
    }
  }


  /** Kéo dữ liệu học từ Drive (nếu đang ở chế độ cloud và đã đăng nhập). */
  async function syncFromCloud() {
    const c = window.PM3Cloud;
    if (!c || c.mode !== "cloud" || !c.user) return;
    try {
      const remote = await c.pullProgress();
      if (!remote || !remote.decks || !state.deckId) return;
      const local = readJSON(STORE_DECK + state.deckId, null);
      if (local) return; // máy đã có dữ liệu -> không ghi đè
      const saved = remote.decks[state.deckId];
      if (!saved) return;
      writeJSON(STORE_DECK + state.deckId, saved);
      loadDeckState(state.deckId);
      render();
      toast("ok", "Đã tải tiến độ học từ Google Drive.");
    } catch (e) {
      /* Drive lỗi thì giữ dữ liệu cục bộ */
    }
  }

  /** Đẩy toàn bộ dữ liệu học lên Drive (gộp nhiều lần lưu trong 1.5 giây). */
  let cloudPushTimer = 0;
  function scheduleCloudPush() {
    const c = window.PM3Cloud;
    if (!c || c.mode !== "cloud" || !c.user || !state.deckId) return;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(async () => {
      try {
        const decksData = {};
        Object.keys(localStorage)
          .filter((k) => k.indexOf(STORE_DECK) === 0)
          .forEach((k) => { decksData[k.slice(STORE_DECK.length)] = readJSON(k, null); });
        await c.pushProgress({ version: 1, updatedAt: Date.now(), decks: decksData, vocab: state.vocab });
      } catch (e) {
        /* im lặng: đồng bộ Drive là tuỳ chọn */
      }
    }, 1500);
  }


  /* ---------- Đăng nhập = ĐỒNG BỘ TIẾN ĐỘ (không mở khoá đề) ---------- */
  async function afterLogin() {
    syncAccountUI();
    setAuthScopeNote();

    // Mở tiếp bộ đề đang chờ (nếu bộ đó vốn đã được phép mở).
    const pending = state.pendingDeck;
    state.pendingDeck = null;
    if (pending && decks()) {
      const it = decks().entry(pending);
      if (it && decks().isUnlocked(it)) openDeck(pending);
      else render();
    } else {
      render();
    }

    // Phần Drive chạy nền: lỗi hay bị từ chối đều không ảnh hưởng việc học.
    const c = window.PM3Cloud;
    if (!c || !c.user) return;
    const isGoogle = (c.user.provider || "").indexOf("google") >= 0;
    if (isGoogle && c.mode === "cloud" && c.ensureDriveAccess) {
      try {
        const ok = await c.ensureDriveAccess(true);
        if (!ok) toast("warn", "Chưa cấp quyền Google Drive — tiến độ chỉ lưu trên máy này.");
      } catch (e) {
        /* người dùng từ chối quyền -> vẫn dùng cục bộ */
      }
    }
    await syncFromCloud();
  }

  /** Cập nhật dòng trạng thái đồng bộ trong hộp thoại thành viên. */
  function setAuthScopeNote() {
    const box = $("#member-sync");
    if (!box) return;
    const user = window.PM3Account ? window.PM3Account.user() : null;
    const btn = $("#member-sync-btn");
    if (user) {
      box.querySelector("span").innerHTML =
        icon("cloud") + " Đã đăng nhập <strong>" + esc(user.name) + "</strong> — tiến độ được đồng bộ.";
      if (btn) btn.hidden = true;
    } else {
      box.querySelector("span").innerHTML =
        icon("cloud") + "Muốn đồng bộ tiến độ giữa các thiết bị?";
      if (btn) {
        btn.hidden = false;
        btn.textContent = "Đăng nhập Google";
      }
    }
  }

  async function submitGoogleLogin() {
    if (!window.PM3Account || !window.PM3Account.loginWithGoogle) return;
    const btn = $("#google-login-btn");
    if (btn) btn.disabled = true;
    let res;
    try {
      res = await window.PM3Account.loginWithGoogle();
    } finally {
      if (btn) btn.disabled = false;
    }
    if (!res.ok) {
      showAuthError("login-error", res.error);
      return;
    }
    closeModal($("#auth-modal"));
    toast("ok", "Đã đăng nhập. Tiến độ học sẽ được đồng bộ.");
    await afterLogin();
  }

  async function submitLogin(e) {
    e.preventDefault();
    if (!window.PM3Account) return;
    const btn = $("#login-form button[type=submit]");
    if (btn) btn.disabled = true;
    let res;
    try {
      res = await window.PM3Account.login({
        username: ($("#login-username") || {}).value,
        password: ($("#login-password") || {}).value
      });
    } finally {
      if (btn) btn.disabled = false;
    }
    if (!res.ok) {
      showAuthError("login-error", res.error);
      return;
    }
    closeModal($("#auth-modal"));
    toast("ok", "Đăng nhập thành công. Tiến độ học sẽ được đồng bộ.");
    await afterLogin();
  }

  async function submitRegister(e) {
    e.preventDefault();
    if (!window.PM3Account) return;
    const btn = $("#register-form button[type=submit]");
    if (btn) btn.disabled = true;
    let res;
    try {
      res = await window.PM3Account.register({
        username: ($("#register-username") || {}).value,
        email: ($("#register-email") || {}).value,
        password: ($("#register-password") || {}).value,
        password2: ($("#register-password2") || {}).value
      });
    } finally {
      if (btn) btn.disabled = false;
    }
    if (!res.ok) {
      showAuthError("register-error", res.error);
      return;
    }
    closeModal($("#auth-modal"));
    toast("ok", "Tạo tài khoản thành công. Dùng tài khoản này để đồng bộ tiến độ.");
    await afterLogin();
  }

  /* ---------- Views: practice ---------- */
  function renderPractice() {
    const session = state.session;
    if (!session || !session.ids.length) return renderDashboard();

    const q = currentQuestion();
    if (!q) return renderDashboard();

    const total = session.ids.length;
    const answered = session.ids.filter((id) => session.checked[id]).length;
    const correctCount = session.ids.filter((id) => session.checked[id] === true).length;
    const progress = pct(answered, total);

    const idList = session.ids;
    const filterChips = `
      <div class="chip-row">
        <button class="chip is-active" type="button" data-jump-list="all">Tất cả ${total}</button>
        <button class="chip is-danger" type="button" data-jump-list="wrong">
          ${icon("alert")}Chỉ câu sai <span class="chip-count" data-wrong-in-session>0</span>
        </button>
      </div>`;

    const head = `
      <div class="practice-head">
        <h1>${esc(session.label || "Luyện tập")}</h1>
        ${filterChips}
      </div>
      <div class="exam-progress">
        <div class="progress-track"><span style="width:${progress}%"></span></div>
        <div class="exam-progress-meta">
          <span>Đã làm <b data-answered>${answered}</b>/${total}</span>
          <span>Đúng <b data-correct>${correctCount}</b></span>
          <button class="chip" type="button" data-open-palette>${icon("grid")}Bảng câu hỏi</button>
        </div>
      </div>`;

    const card = renderQuestionCard(q, session);
    return head + card;
  }

  function renderQuestionCard(q, session) {
    const chosen = session.answers[q.id] || null;
    const isChecked = session.checked[q.id] !== undefined;
    const wasCorrect = session.checked[q.id] === true;
    const meta = resolveChapter(q.chapter);
    const isLast = session.index === session.ids.length - 1;
    const bookmarked = isBookmarked(q.id);

    const options = q.options
      .map((o) => {
        const isCorrect = o.key === q.correct_answer;
        const isChosen = chosen === o.key;
        let cls = "option";
        if (isChecked) {
          if (isCorrect) cls += " is-correct";
          else if (isChosen) cls += " is-wrong";
          else cls += " is-dimmed";
        } else if (isChosen) cls += " is-selected";

        let mark = "";
        if (isChecked) {
          if (isCorrect) mark = `<span class="option-mark ok">${icon("check")}</span>`;
          else if (isChosen) mark = `<span class="option-mark no">${icon("x")}</span>`;
        }
        return `
          <button class="${cls}" type="button" data-option="${esc(o.key)}" ${isChecked ? "disabled" : ""}
            aria-pressed="${isChosen}">
            <span class="option-key">${esc(o.key)}</span>
            <span class="option-body">
              <span class="jp">${jpWithFurigana(o.japanese, o.furigana)}</span>
              ${o.vietnamese ? `<span class="vn">${esc(o.vietnamese)}</span>` : ""}
            </span>
            ${mark}
          </button>`;
      })
      .join("");

    const feedback = isChecked ? renderFeedback(q, chosen, wasCorrect) : "";

    return `
      <article class="question-card" data-qid="${esc(q.id)}">
        <div class="q-top">
          <span class="q-number">${icon("target")}Câu ${esc(q.id)} · ${session.index + 1}/${session.ids.length}</span>
          <span class="q-tag q-tag--jp">${esc(meta.jp)}</span>
          <span class="q-spacer"></span>
          <span class="q-tools">
            <button class="icon-button${bookmarked ? " is-on" : ""}" type="button" data-bookmark="${esc(q.id)}"
              aria-label="Lưu câu hỏi" title="Lưu câu hỏi">${icon("bookmark")}</button>
          </span>
        </div>

        <div class="q-prompt">
          <p class="jp">${jpWithFurigana(q.question.japanese, q.question.furigana)}</p>
          ${q.question.vietnamese ? `<p class="vn">${esc(q.question.vietnamese)}</p>` : ""}
        </div>

        <div class="option-list" role="group" aria-label="Các phương án">${options}</div>

        <div class="q-actions">
          <button class="soft-button" type="button" data-nav="prev" ${session.index === 0 ? "disabled" : ""}>
            ${icon("left")}Câu trước
          </button>
          <button class="primary-button" type="button" data-check ${!chosen || isChecked ? "disabled" : ""}>
            ${icon("check")}${isChecked ? "Đã trả lời" : "Kiểm tra đáp án"}
          </button>
          <span class="spacer"></span>
          <span class="q-hint">Phím 1–4 chọn đáp án · Enter để kiểm tra</span>
          <button class="ghost-button" type="button" data-nav="next">
            ${isLast ? "Xem kết quả" : "Câu tiếp"}${icon("right")}
          </button>
        </div>
        ${feedback}
      </article>`;
  }

  /* ---------- Views: feedback ---------- */
  function renderFeedback(q, chosen, ok) {
    const reasons = q.explanation.incorrect_reasons || {};
    const reasonRows = q.options
      .map((o) => {
        const isCorrect = o.key === q.correct_answer;
        const text = isCorrect ? q.explanation.correct_reason : reasons[o.key];
        if (!text) return "";
        return `
          <div class="reason-row${isCorrect ? " is-correct" : ""}">
            <span class="reason-key">${esc(o.key)}</span>
            <p>${esc(text)}</p>
          </div>`;
      })
      .join("");

    const knowledge = q.key_knowledge.length
      ? `
        <section class="explain-block">
          <header>${icon("spark")}Kiến thức cốt lõi</header>
          <div class="body tag-list">
            ${q.key_knowledge.map((k) => `<div class="tag-item knowledge">${icon("info")}<span>${esc(k)}</span></div>`).join("")}
          </div>
        </section>`
      : "";

    const traps = q.exam_traps.length
      ? `
        <section class="explain-block">
          <header>${icon("alert")}Bẫy thường gặp trong đề</header>
          <div class="body tag-list">
            ${q.exam_traps.map((k) => `<div class="tag-item trap">${icon("alert")}<span>${esc(k)}</span></div>`).join("")}
          </div>
        </section>`
      : "";

    const vocab = q.vocabulary.length
      ? `
        <section class="explain-block">
          <header>${icon("lang")}Từ vựng<span class="vocab-count">${q.vocabulary.length} từ</span></header>
          <div class="body vocab-grid is-full">
            ${q.vocabulary
              .map((v) => {
                const reading = v.reading && v.reading !== v.word ? v.reading : "";
                return vocabCard(v.word, reading, v.meaning, q.id, {
                  jp: q.question.japanese,
                  vn: q.question.vietnamese,
                  showContext: false
                });
              })
              .join("")}
          </div>
        </section>`
      : "";

    return `
      <div class="feedback">
        <div class="result-banner ${ok ? "is-correct" : "is-wrong"}">
          <span class="badge-icon">${icon(ok ? "check" : "x")}</span>
          <div>
            <strong>${ok ? "Chính xác!" : "Chưa đúng — đáp án đúng là " + esc(q.correct_answer)}</strong>
            <small>${ok ? "Bạn đã chọn đúng đáp án." : "Bạn chọn " + esc(chosen || "—") + ". Hãy đọc kỹ phần giải thích bên dưới."}</small>
          </div>
        </div>
        <div class="explain-grid">
          <section class="explain-block is-correct">
            <header>${icon("check")}Vì sao đáp án đúng</header>
            <div class="body reason-list">${reasonRows}</div>
          </section>
          ${knowledge}
          ${traps}
          ${vocab}
        </div>
      </div>`;
  }

  /* ---------- Views: vocabulary notebook ---------- */
  function renderVocab() {
    const all = state.vocab;
    const query = state.vocabQuery || "";
    clearArmed = false;
    const list = vocabMatches(all, query);

    const head = `
      <div class="section-head vocab-head">
        <div>
          <h1>Sổ từ vựng</h1>
          <p>Những từ bạn đã lưu khi làm bài, gom lại một chỗ để ôn nhanh.</p>
        </div>
        <div class="head-actions">
          <button class="chip" type="button" data-vocab-export>${icon("upload")}Xuất CSV</button>
          <button class="chip is-danger" type="button" data-vocab-clear>${icon("trash")}Xoá hết</button>
        </div>
      </div>`;

    if (!all.length) {
      return (
        head +
        `<div class="empty-note">${icon("note")} Chưa có từ vựng nào được lưu.<br>
        Khi làm bài, bấm biểu tượng <strong>dấu trang</strong> ở mỗi thẻ từ vựng để lưu vào đây.</div>`
      );
    }

    const search = `
      <div class="vocab-toolbar">
        <div class="vocab-search">
          ${icon("target")}
          <input type="search" id="vocab-search" value="${esc(query)}"
            placeholder="Tìm theo từ, cách đọc hoặc nghĩa…" autocomplete="off" />
        </div>
        <span class="vocab-total">${list.length}/${all.length} từ</span>
      </div>`;

    const grid = list.length
      ? `<div class="vocab-grid is-notebook">${list
          .map((v) => vocabCard(v.word, v.reading, v.meaning, v.source, { onRemove: true, jp: v.jp, vn: v.vn }))
          .join("")}</div>`
      : `<div class="empty-note">Không tìm thấy từ nào khớp "<strong>${esc(query)}</strong>".</div>`;

    return head + search + grid;
  }

  /* ---------- Views: results ---------- */
  function renderResults() {
    const session = state.session;
    if (!session) return renderDashboard();

    const total = session.ids.length;
    const answeredIds = session.ids.filter((id) => session.checked[id] !== undefined);
    const correctIds = session.ids.filter((id) => session.checked[id] === true);
    const wrongIds = session.ids.filter((id) => session.checked[id] === false);
    const score = pct(correctIds.length, total);
    const answered = answeredIds.length;

    let grade = "Hãy tiếp tục ôn luyện";
    let gradeNote = "Đọc lại phần giải thích và từ vựng của các câu sai để nắm chắc khái niệm.";
    let color = "var(--red)";
    if (score >= 90) {
      grade = "Xuất sắc";
      gradeNote = "Bạn đã nắm rất vững phần này. Hãy thử chuyển sang chương khác hoặc luyện toàn bộ đề.";
      color = "var(--green)";
    } else if (score >= 70) {
      grade = "Đạt yêu cầu";
      gradeNote = "Nền tảng tốt. Tập trung ôn các câu làm sai để đạt mức 90% trở lên.";
      color = "var(--amber)";
    } else if (score >= 50) {
      grade = "Cần ôn thêm";
      gradeNote = "Ôn lại kiến thức cốt lõi của các chương yếu và luyện lại nhóm câu làm sai.";
      color = "var(--amber)";
    }


    const byChapter = new Map();
    session.ids.forEach((id) => {
      const q = state.byId.get(id);
      if (!q) return;
      const key = chapterKey(q);
      if (!byChapter.has(key)) byChapter.set(key, { total: 0, correct: 0, done: 0 });
      const row = byChapter.get(key);
      row.total += 1;
      if (session.checked[id] !== undefined) row.done += 1;
      if (session.checked[id] === true) row.correct += 1;
    });

    const breakdown = Array.from(byChapter.entries())
      .map(([key, row]) => {
        const meta = chapterMeta(key);
        const p = pct(row.correct, row.total);
        return `
          <div class="breakdown-row">
            <div class="name">${esc(meta.jp)}<small>${esc(meta.vn)}</small></div>
            <div class="progress-track"><span style="width:${p}%;background:${p >= 70 ? "var(--green)" : p >= 50 ? "var(--amber)" : "var(--red)"}"></span></div>
            <span class="val">${row.correct}/${row.total} · ${p}%</span>
          </div>`;
      })
      .join("");

    const wrongChips = wrongIds.length
      ? `
        <div class="section-head" style="margin-top:26px">
          <div><h2>Câu làm sai</h2><p>Bấm vào số câu để xem lại lời giải.</p></div>
          <div class="head-actions">
            <button class="chip is-danger" type="button" data-retry-wrong>${icon("refresh")}Luyện lại ${wrongIds.length} câu sai</button>
          </div>
        </div>
        <div class="wrong-strip">
          ${wrongIds
            .map((id) => {
              const q = state.byId.get(id);
              const meta = resolveChapter(q.chapter);
              return `<button class="wrong-chip" type="button" data-review-wrong="${esc(id)}"><b>Câu ${esc(id)}</b><span>${esc(meta.jp)}</span></button>`;
            })
            .join("")}
        </div>`
      : `<div class="empty-note" style="margin-top:22px">${icon("check")} Không có câu nào làm sai trong lượt này. Tuyệt vời!</div>`;

    return `
      <section class="result-hero">
        <div>
          <span class="eyebrow">Kết quả lượt luyện</span>
          <h1>${esc(grade)}</h1>
          <p>${esc(gradeNote)}</p>
          <div class="dash-hero-actions" style="margin-top:16px">
            <button class="primary-button" type="button" data-retry-same>${icon("refresh")}Làm lại lượt này</button>
            <button class="ghost-button" type="button" data-start-mode="all">${icon("book")}Luyện toàn bộ</button>
            <button class="ghost-button" type="button" data-view="dashboard">${icon("home")}Tổng quan</button>
          </div>
        </div>
        <div class="result-ring" style="--pct:${score};--ring-color:${color}">
          <div class="ring-inner"><strong>${score}%</strong><span>Điểm</span></div>
        </div>
      </section>

      <div class="result-metrics">
        <div class="metric"><span>Số câu đúng</span><strong>${correctIds.length}</strong><small>trên ${total} câu</small></div>
        <div class="metric"><span>Đã làm</span><strong>${answered}/${total}</strong><small>${total - answered} câu chưa trả lời</small></div>
        <div class="metric"><span>Câu làm sai</span><strong>${wrongIds.length}</strong><small>đã lưu cho lần ôn sau</small></div>
        <div class="metric"><span>Thời gian</span><strong>${esc(formatDuration(Math.round((Date.now() - (session.startedAt || Date.now())) / 1000)))}</strong><small>từ lúc bắt đầu</small></div>
      </div>

      <div class="section-head">
        <div><h2>Kết quả theo chương</h2><p>Chương nào cần ưu tiên ôn lại.</p></div>
      </div>
      <div class="chapter-breakdown">${breakdown || '<div class="empty-note">Chưa có dữ liệu.</div>'}</div>
      ${wrongChips}`;
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}g ${pad2(m % 60)}p`;
    }
    return `${m}p ${pad2(s)}s`;
  }

  /* ---------- Main render ---------- */
  function render(keepScroll = false) {
    const main = $("#main-content");
    if (!main) return;
    const y = window.scrollY;

    let html = "";
    if (state.view === "practice" && state.session && state.session.ids.length) {
      html = renderPractice();
    } else if (state.view === "vocab") {
      html = renderVocab();
    } else if (state.view === "library") {
      html = renderLibrary();
    } else if (state.view === "results") {
      html = renderResults();
    } else {
      html = renderDashboard();
    }

    main.innerHTML = html;

    const titleMap = {
      dashboard: ["Study desk", "Tổng quan"],
      library: ["Deck library", "Thư viện bộ đề"],
      vocab: ["Vocabulary", "Sổ từ vựng"],
      practice: ["Practice mode", state.session ? state.session.label || "Luyện tập" : "Luyện tập"],
      results: ["Review", "Kết quả lượt luyện"]
    };
    const t = titleMap[state.view] || titleMap.dashboard;
    const kicker = $("#page-kicker");
    const title = $("#page-title");
    if (kicker) kicker.textContent = t[0];
    if (title) title.textContent = t[1];
    syncAccountUI();

    $$(".nav-item").forEach((b) => {
      const v = b.dataset.view;
      const m = b.dataset.startMode;
      const sess = state.session;
      const active =
        (v && v === state.view) ||
        (m === "all" && state.view === "practice" && sess && sess.mode === "all") ||
        (m === "review" && state.view === "practice" && sess && sess.mode === "review") ||
        (m === "bookmarks" && state.view === "practice" && sess && sess.mode === "bookmarks");
      b.classList.toggle("is-active", !!active);
    });

    renderChapterNav();
    syncCounters();
    updateSidebarProgress();
    if (state.view === "practice") updateSessionCounters();
    if (state.view === "vocab") {
      const box = $("#vocab-search");
      if (box && state.vocabQuery) {
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    }
    if (keepScroll) window.scrollTo(0, y);
  }

  function updateSessionCounters() {
    const s = state.session;
    if (!s) return;
    const answered = s.ids.filter((id) => s.checked[id] !== undefined).length;
    const correct = s.ids.filter((id) => s.checked[id] === true).length;
    const wrong = s.ids.filter((id) => s.checked[id] === false).length;
    const a = $("[data-answered]");
    const c = $("[data-correct]");
    const w = $("[data-wrong-in-session]");
    if (a) a.textContent = answered;
    if (c) c.textContent = correct;
    if (w) w.textContent = wrong;
    const bar = $(".exam-progress .progress-track > span");
    if (bar) bar.style.width = pct(answered, s.ids.length) + "%";
  }

  /* ---------- Practice interactions ---------- */
  function chooseOption(key) {
    const s = state.session;
    if (!s) return;
    const q = currentQuestion();
    if (!q) return;
    if (s.checked[q.id] !== undefined) return;
    s.answers[q.id] = key;
    saveState();
    render(true);
  }

  function checkAnswer() {
    const s = state.session;
    if (!s) return;
    const q = currentQuestion();
    if (!q) return;
    const chosen = s.answers[q.id];
    if (!chosen) {
      toast("warn", "Hãy chọn một đáp án trước.");
      return;
    }
    if (s.checked[q.id] !== undefined) return;
    const ok = chosen === q.correct_answer;
    const firstTry = true;
    s.checked[q.id] = ok;
    recordAnswer(q, chosen, ok, firstTry);
    saveState();
    render(true);
    const card = $(".question-card");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goNext() {
    const s = state.session;
    if (!s) return;
    const q = currentQuestion();
    if (q && s.checked[q.id] === undefined) {
      toast("warn", "Hãy kiểm tra đáp án của câu này trước khi sang câu tiếp.");
      return;
    }
    if (s.index >= s.ids.length - 1) {
      state.view = "results";
      render();
      return;
    }
    s.index += 1;
    saveState();
    render();
  }

  function goPrev() {
    const s = state.session;
    if (!s) return;
    if (s.index === 0) return;
    s.index -= 1;
    saveState();
    render();
  }

  function jumpTo(index) {
    const s = state.session;
    if (!s || index < 0 || index >= s.ids.length) return;
    s.index = index;
    saveState();
    closeModal($("#palette-modal"));
    render();
  }

  /* ---------- Palette ---------- */
  function openPalette() {
    const s = state.session;
    if (!s) return;
    const grid = $("#palette-grid");
    if (grid) {
      grid.innerHTML = s.ids
        .map((id, i) => {
          const st = s.checked[id];
          let cls = "palette-cell";
          if (st === true) cls += " is-correct";
          else if (st === false) cls += " is-wrong";
          if (i === s.index) cls += " is-current";
          return `<button class="${cls}" type="button" data-jump="${i}">${esc(id)}</button>`;
        })
        .join("");
    }
    openModal($("#palette-modal"));
  }

  /* ---------- Modals ---------- */
  let lastFocused = null;

  function openModal(el) {
    if (!el) return;
    lastFocused = document.activeElement;
    el.hidden = false;
    const focusable = el.querySelector("button, [href], input, [tabindex]:not([tabindex='-1'])");
    if (focusable) focusable.focus();
  }

  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function closeAllModals() {
    $$(".modal-backdrop").forEach((el) => (el.hidden = true));
  }

  /* ---------- Import / reset data ---------- */
  function showImportError(message) {
    const box = $("#import-error");
    if (!box) return;
    if (!message) {
      box.hidden = true;
      box.textContent = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = `${icon("alert")} ${esc(message)}`;
  }

  function adoptQuestions(questions, { source }) {
    state.questions = questions;
    state.source = source || "custom";
    state.byId = new Map(questions.map((q) => [q.id, q]));
    refreshChapters();

    // San phẳng dữ liệu về đúng bộ id đang có.
    const newIds = new Set(questions.map((q) => q.id));
    state.bookmarks = state.bookmarks.filter((id) => newIds.has(id));
    const filteredProgress = {};
    Object.keys(state.progress).forEach((id) => {
      if (newIds.has(id)) filteredProgress[id] = state.progress[id];
    });
    state.progress = filteredProgress;
    state.session = null;
    state.filter = "all";
    saveState();
    updateDataSourceLabel();
  }

  function updateDataSourceLabel() {
    const label = $("#data-source-label");
    if (!label) return;
    const prefix =
      state.source === "custom" ? "Bộ đề riêng" : state.source === "builtin" ? "Bộ đề thật" : "Dữ liệu mẫu";
    const name = activeDeckName();
    label.textContent = name ? `${name} · ${state.questions.length} câu` : `${prefix} · ${state.questions.length} câu`;
  }

  async function handleFile(file) {
    if (!file) return;
    showImportError("");
    if (file.size > 10 * 1024 * 1024) {
      showImportError("File quá lớn (giới hạn 10 MB).");
      return;
    }
    let text = "";
    try {
      text = await file.text();
    } catch (e) {
      showImportError("Không đọc được file.");
      return;
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      showImportError("File không phải JSON hợp lệ. Hãy kiểm tra dấu ngoặc và dấu phẩy.");
      return;
    }
    const result = validateQuestions(json);
    if (!result.ok) {
      showImportError(result.error);
      return;
    }
    writeJSON(STORE_DATA, result.questions);
    if (state.deckId !== CUSTOM_DECK) loadDeckState(CUSTOM_DECK);
    state.deckId = CUSTOM_DECK;
    state.source = "custom";
    adoptQuestions(result.questions, { source: "custom" });
    closeAllModals();
    state.view = "dashboard";
    render();
    if (result.warnings && result.warnings.length) {
      toast("warn", `Đã nhập ${result.questions.length} câu. ${result.warnings.length} cảnh báo nhỏ (xem câu ${result.questions[0].id}).`);
    } else {
      toast("ok", `Đã nhập thành công ${result.questions.length} câu hỏi.`);
    }
  }

  /** Download the notebook as CSV (UTF-8 BOM so Excel reads Vietnamese). */
  function exportVocabCsv() {
    if (!state.vocab.length) {
      toast("warn", "Sổ từ vựng đang trống.");
      return;
    }
    const blob = new Blob([BOM + vocabCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "so-tu-vung.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("ok", `Đã xuất ${state.vocab.length} từ ra file CSV.`);
  }

  async function resetToSample() {
    try {
      localStorage.removeItem(STORE_DATA);
    } catch (e) {
      /* ignore */
    }
    closeAllModals();
    // Quay về bộ đề miễn phí đầu tiên trong thư viện (nếu có).
    const d = decks();
    const first = d && d.freeFirst();
    if (first) {
      try {
        const raw = await d.load(first.id);
        state.source = "builtin";
        await loadAndAdopt(first.id, raw);
        toast("ok", "Đã khôi phục bộ đề mặc định: " + first.name);
        return;
      } catch (e) {
        /* rơi xuống dự phòng */
      }
    }
    const bundled = Array.isArray(window.QUESTIONS_DATA) && window.QUESTIONS_DATA.length ? window.QUESTIONS_DATA : window.DEMO_QUESTIONS || [];
    const v = validateQuestions(bundled);
    if (!v.ok) {
      showImportError("Không tìm thấy dữ liệu mẫu.");
      return;
    }
    state.deckId = state.deckId || "builtin";
    loadDeckState(state.deckId);
    adoptQuestions(v.questions, { source: Array.isArray(window.QUESTIONS_DATA) && window.QUESTIONS_DATA.length ? "builtin" : "demo" });
    state.view = "dashboard";
    render();
    toast("ok", "Đã khôi phục dữ liệu mẫu.");
  }

  /* ---------- Sidebar (mobile) ---------- */
  function setSidebar(open) {
    const sidebar = $("#sidebar");
    const scrim = $("#sidebar-scrim");
    const toggle = $("#menu-toggle");
    if (sidebar) sidebar.classList.toggle("is-open", open);
    if (scrim) scrim.classList.toggle("is-visible", open);
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
  }

  /* ---------- Events ---------- */
  function wireEvents() {
    document.addEventListener("click", (e) => {
      const el = (sel) => e.target.closest(sel);

      const startBtn = el("[data-start-mode]");
      if (startBtn) {
        const mode = startBtn.dataset.startMode;
        setSidebar(false);
        startSession(mode === "review" || mode === "bookmarks" ? mode : "all");
        return;
      }

      const chapterBtn = el("[data-chapter]");
      if (chapterBtn) {
        setSidebar(false);
        startSession("chapter", chapterBtn.dataset.chapter);
        return;
      }

      const viewBtn = el("[data-view]");
      if (viewBtn) {
        setSidebar(false);
        state.view = viewBtn.dataset.view;
        render();
        return;
      }

      const optionBtn = el("[data-option]");
      if (optionBtn) {
        chooseOption(optionBtn.dataset.option);
        return;
      }

      if (el("[data-check]")) {
        checkAnswer();
        return;
      }

      const nav = el("[data-nav]");
      if (nav) {
        if (nav.dataset.nav === "next") goNext();
        else goPrev();
        return;
      }

      const bm = el("[data-bookmark]");
      if (bm) {
        toggleBookmark(bm.dataset.bookmark);
        return;
      }

      const saveVocab = el("[data-vocab-save]");
      if (saveVocab) {
        toggleVocab(saveVocab.dataset.vocabSave, {
          reading: saveVocab.dataset.vocabReading,
          meaning: saveVocab.dataset.vocabMeaning,
          source: saveVocab.dataset.vocabSource,
          jp: saveVocab.dataset.vocabJp,
          vn: saveVocab.dataset.vocabVn
        });
        return;
      }

      const delVocab = el("[data-vocab-remove]");
      if (delVocab) {
        removeVocab(delVocab.dataset.vocabRemove);
        return;
      }

      if (el("[data-vocab-export]")) {
        exportVocabCsv();
        return;
      }

      const clearBtn = el("[data-vocab-clear]");
      if (clearBtn) {
        if (!state.vocab.length) return;
        // First click only arms the button; a second click within 4s clears.
        if (!clearArmed) {
          clearArmed = true;
          clearBtn.classList.add("is-armed");
          clearBtn.innerHTML = icon("trash") + "Bấm lần nữa để xoá";
          clearTimeout(clearTimer);
          clearTimer = setTimeout(() => {
            clearArmed = false;
            // Only repaint if the learner is still looking at the notebook.
            if (state.view === "vocab") {
              render(true);
            } else {
              const btn = $("[data-vocab-clear]");
              if (btn) btn.classList.remove("is-armed");
            }
          }, 4000);
          return;
        }
        clearArmed = false;
        clearTimeout(clearTimer);
        state.vocab = [];
        saveState();
        syncCounters();
        render();
        toast("info", "Đã xoá toàn bộ sổ từ vựng.");
        return;
      }

      if (el("[data-open-import]")) {
        showImportError("");
        openModal($("#import-modal"));
        return;
      }

      if (el("[data-close-modal]")) {
        closeModal(e.target.closest(".modal-backdrop"));
        return;
      }

      if (el("[data-open-palette]")) {
        openPalette();
        return;
      }

      const jump = el("[data-jump]");
      if (jump) {
        jumpTo(Number(jump.dataset.jump));
        return;
      }

      if (el("[data-retry-wrong]")) {
        const ids = state.session.ids.filter((id) => state.session.checked[id] === false);
        if (!ids.length) return;
        state.session = newSession(ids, "wrong", "Câu làm sai");
        state.view = "practice";
        saveState();
        render();
        return;
      }

      if (el("[data-retry-same]")) {
        const ids = state.session.ids.slice();
        const label = state.session.label;
        state.session = newSession(ids, state.session.mode, label);
        state.session.chapter = null;
        state.view = "practice";
        saveState();
        render();
        toast("info", "Bắt đầu lại lượt luyện. Đáp án đã được xoá.");
        return;
      }

      const reviewWrong = el("[data-review-wrong]");
      if (reviewWrong) {
        const ids = state.session.ids.filter((id) => state.session.checked[id] === false);
        state.session = newSession(ids, "wrong", "Câu làm sai");
        state.view = "practice";
        state.session.index = Math.max(0, ids.indexOf(reviewWrong.dataset.reviewWrong));
        saveState();
        render();
        return;
      }

      const jumpList = el("[data-jump-list]");
      if (jumpList) {
        state.filter = jumpList.dataset.jumpList;
        $$("[data-jump-list]").forEach((b) => b.classList.toggle("is-active", b === jumpList));
        if (state.filter === "wrong") {
          const idx = state.session.ids.findIndex((id) => state.session.checked[id] === false);
          if (idx >= 0) jumpTo(idx);
          else toast("warn", "Chưa có câu nào làm sai.");
        }
        return;
      }

      if (el("#reset-sample-data")) {
        resetToSample();
        return;
      }

      const deckBtn = el("[data-deck]");
      if (deckBtn) {
        openDeck(deckBtn.dataset.deck);
        return;
      }

      if (el("[data-refresh-drive]")) {
        refreshDriveLibrary();
        return;
      }

      if (el("[data-open-member]")) {
        setSidebar(false);
        openMember();
        return;
      }

      if (el("[data-open-member-tab]")) {
        closeModal($("#auth-modal"));
        openMember();
        return;
      }

      if (el("[data-open-auth]")) {
        closeModal($("#member-modal"));
        openAuth((el("[data-open-auth]") || {}).dataset.openAuth || "login");
        return;
      }

      if (el("[data-member-deactivate]")) {
        deactivateMember();
        return;
      }

      const authTab = el("[data-auth-tab]");
      if (authTab) {
        setAuthTab(authTab.dataset.authTab);
        return;
      }

      if (el("#account-button")) {
        // Nút trên thanh trên cùng luôn mở hộp thoại thành viên
        // (kích hoạt mã + trạng thái + lối đồng bộ tiến độ).
        openMember();
        return;
      }

      const peek = el("[data-peek]");
      if (peek) {
        const input = document.getElementById(peek.dataset.peek);
        if (input) input.type = input.type === "password" ? "text" : "password";
        return;
      }
    });

    const memberForm = $("#member-form");
    if (memberForm) memberForm.addEventListener("submit", submitMemberCode);
    const zaloBtn = $("#member-zalo");
    if (zaloBtn) zaloBtn.addEventListener("click", contactZalo);

    const loginForm = $("#login-form");
    if (loginForm) loginForm.addEventListener("submit", submitLogin);
    const registerForm = $("#register-form");
    if (registerForm) registerForm.addEventListener("submit", submitRegister);
    const googleBtn = $("#google-login-btn");
    if (googleBtn) googleBtn.addEventListener("click", submitGoogleLogin);

    const themeToggle = $("#theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      });
    }

    const furiganaToggle = $("#furigana-toggle");
    if (furiganaToggle) {
      furiganaToggle.addEventListener("click", () => {
        applyFurigana(!(furiganaToggle.getAttribute("aria-pressed") === "true"), true);
      });
    }

    const translationToggle = $("#translation-toggle");
    if (translationToggle) {
      translationToggle.addEventListener("click", () => {
        applyTranslation(!(translationToggle.getAttribute("aria-pressed") === "true"));
      });
    }

    const menuToggle = $("#menu-toggle");
    if (menuToggle) menuToggle.addEventListener("click", () => setSidebar(!$("#sidebar").classList.contains("is-open")));
    const scrim = $("#sidebar-scrim");
    if (scrim) scrim.addEventListener("click", () => setSidebar(false));

    // File input + drag & drop
    const input = $("#json-file-input");
    if (input) {
      input.addEventListener("change", () => {
        if (input.files && input.files[0]) handleFile(input.files[0]);
        input.value = "";
      });
    }
    const dropZone = $("#drop-zone");
    if (dropZone) {
      ["dragenter", "dragover"].forEach((ev) =>
        dropZone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropZone.classList.add("is-drag");
        })
      );
      ["dragleave", "drop"].forEach((ev) =>
        dropZone.addEventListener(ev, (e) => {
          e.preventDefault();
          dropZone.classList.remove("is-drag");
        })
      );
      dropZone.addEventListener("drop", (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
      });
    }

    // Vocabulary search — update in place so the input keeps focus
    document.addEventListener("input", (e) => {
      if (!e.target || e.target.id !== "vocab-search") return;
      state.vocabQuery = e.target.value;
      const grid = $(".main-content .vocab-grid, .main-content .empty-note");
      const list = vocabMatches(state.vocab, state.vocabQuery);
      const total = $(".vocab-total");
      if (total) total.textContent = `${list.length}/${state.vocab.length} từ`;
      if (!grid) return;
      if (list.length) {
        if (grid.classList.contains("vocab-grid")) {
          grid.innerHTML = list
            .map((v) => vocabCard(v.word, v.reading, v.meaning, v.source, { onRemove: true, jp: v.jp, vn: v.vn }))
            .join("");
        } else {
          render(true);
        }
      } else {
        render(true);
      }
    });

    // Close a modal when clicking its backdrop
    $$(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("mousedown", (e) => {
        if (e.target === backdrop) closeModal(backdrop);
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
      if (e.key === "Escape") {
        closeAllModals();
        setSidebar(false);
        return;
      }
      if (typing) return;
      if (e.key === "t" || e.key === "T") {
        applyTranslation(!(state.settings.translation === true));
        return;
      }
      if (e.key === "f" || e.key === "F") {
        applyFurigana(!(state.settings.furigana === true), true);
        return;
      }
      if (state.view !== "practice" || !state.session) return;
      const s = state.session;
      const q = currentQuestion();
      if (!q) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        const opt = q.options[Number(e.key) - 1];
        if (opt) chooseOption(opt.key);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (s.checked[q.id] !== undefined) goNext();
        else checkAnswer();
        return;
      }
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    });
  }

  /* ---------- Boot ---------- */
  let booted = false;

  async function boot() {
    if (booted) return;
    booted = true;
    loadState();
    applyTheme(state.settings.theme === "dark" ? "dark" : "light");
    applyTranslation(state.settings.translation !== false);
    applyFurigana(state.settings.furigana === true);

    // 1) Khởi tạo Firebase (nếu đã cấu hình) TRƯỚC khi nạp đề, để biết
    //    người dùng đã đăng nhập hay chưa (ảnh hưởng tới bộ đề được mở).
    if (window.PM3Cloud) {
      try {
        await window.PM3Cloud.init();
      } catch (e) {
        /* mất mạng / cấu hình sai -> chạy tiếp ở chế độ cục bộ */
      }
    }

    // 2) Bổ sung bộ đề từ Google Drive (nếu có cấu hình) — lỗi thì bỏ qua.
    if (window.PM3Decks && window.PM3Decks.refreshDrive) {
      try {
        const n = await window.PM3Decks.refreshDrive();
        if (n) console.info("[PM3] Đã tìm thấy " + n + " bộ đề trên Google Drive.");
      } catch (e) {
        /* im lặng */
      }
    }

    // 3) Trạng thái THÀNH VIÊN (mã kích hoạt) quyết định bộ đề nào được mở.
    if (window.PM3Member) {
      window.PM3Member.onChange(() => {
        syncAccountUI();
        if (state.view === "library" || state.view === "dashboard") render();
      });
    }

    const questions = await loadQuestions();
    if (!questions.length) {
      $("#main-content").innerHTML = `
        <div class="empty-note">
          <strong>Không tải được bộ câu hỏi.</strong><br>
          Hãy đặt file <code>data/questions.json</code> hoặc dùng nút “Nhập JSON”.
        </div>`;
      return;
    }

    state.questions = questions;
    state.byId = new Map(questions.map((q) => [q.id, q]));
    refreshChapters();
    updateDataSourceLabel();
    wireEvents();

    if (state.session && Array.isArray(state.session.ids) && state.session.ids.length) {
      state.session.ids = state.session.ids.filter((id) => state.byId.has(id));
      if (state.session.ids.length) {
        state.view = "practice";
      } else {
        state.session = null;
      }
    }

    syncAccountUI();
    render();

    // Nếu Firebase đã khôi phục phiên đăng nhập, kéo tiến độ học từ Drive.
    if (window.PM3Cloud && window.PM3Cloud.user) {
      await syncFromCloud();
      render();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
