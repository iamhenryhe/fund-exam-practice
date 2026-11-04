(function () {
  "use strict";

  const meta = window.FUND_META;
  const STORAGE_KEY = "fundlab-study-state-v2";
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const subjectById = Object.fromEntries(meta.subjects.map((subject) => [subject.id, subject]));
  const questionCache = new Map();
  const state = loadState();
  const current = {
    subjectId: null,
    questions: [],
    index: 0,
    filters: { chapter: "all", type: "all" },
    order: "sequential",
    wrongOnly: false
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    homeView: $("home-view"),
    practiceView: $("practice-view"),
    wrongView: $("wrong-view"),
    toast: $("toast")
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        selected: saved.selected && typeof saved.selected === "object" ? saved.selected : {},
        submitted: saved.submitted && typeof saved.submitted === "object" ? saved.submitted : {},
        correct: saved.correct && typeof saved.correct === "object" ? saved.correct : {},
        wrong: Array.isArray(saved.wrong) ? saved.wrong : [],
        favorites: Array.isArray(saved.favorites) ? saved.favorites : [],
        theme: saved.theme === "dark" ? "dark" : "light"
      };
    } catch (error) {
      return { selected: {}, submitted: {}, correct: {}, wrong: [], favorites: [], theme: "light" };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderHomeStats();
    renderPracticeProgress();
    updateWrongCounts();
    updateProgressChip();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function richText(value) {
    return escapeHtml(value).replace(/\n/g, "<br />");
  }

  function typeLabel(type) {
    return { single: "单选题", multi: "多选题", tf: "判断题" }[type] || "选择题";
  }

  function showView(view) {
    [els.homeView, els.practiceView, els.wrongView].forEach((node) => node.classList.remove("active"));
    view.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function getSubjectIdFromQuestionId(id) {
    return String(id || "").split("-")[0];
  }

  function getSubjectQuestions(subjectId) {
    return questionCache.get(subjectId) || [];
  }

  async function loadQuestions(subjectId) {
    if (questionCache.has(subjectId)) return questionCache.get(subjectId);
    const subject = subjectById[subjectId];
    if (!subject) throw new Error("找不到科目配置");
    const response = await fetch(subject.dataFile, { cache: "no-cache" });
    if (!response.ok) throw new Error(`题库加载失败（HTTP ${response.status}）`);
    const questions = await response.json();
    questionCache.set(subjectId, questions);
    return questions;
  }

  function renderHome() {
    $("question-total-label").textContent = `${meta.subjects.reduce((sum, item) => sum + item.count, 0).toLocaleString()} 道历史题库（去重）`;
    $("subject-grid").innerHTML = meta.subjects.map((subject) => `
      <button class="subject-card" type="button" data-subject="${subject.id}">
        <span class="subject-icon ${subject.theme}">${subject.icon}</span>
        <span>
          <span class="section-kicker">${escapeHtml(subject.shortName)}</span>
          <h3>${escapeHtml(subject.name)}</h3>
          <p>${escapeHtml(subject.description)}</p>
          <span class="subject-meta">${subject.count.toLocaleString()} 道去重题目 · 点击进入</span>
        </span>
        <span class="subject-arrow">→</span>
      </button>
    `).join("");
    renderHomeStats();
    updateWrongCounts();
    updateProgressChip();
    updateCountdown();
  }

  function submittedIds() {
    return Object.keys(state.submitted).filter((id) => state.submitted[id]);
  }

  function renderHomeStats() {
    const answered = submittedIds();
    const correct = answered.filter((id) => state.correct[id]).length;
    $("stat-answered").textContent = answered.length.toLocaleString();
    $("stat-accuracy").textContent = answered.length ? `${Math.round((correct / answered.length) * 100)}%` : "0%";
    $("stat-wrong").textContent = state.wrong.length.toLocaleString();
    $("subject-progress-list").innerHTML = meta.subjects.map((subject) => {
      const attempted = answered.filter((id) => id.startsWith(`${subject.id}-`)).length;
      const percent = subject.count ? Math.round((attempted / subject.count) * 100) : 0;
      return `<div class="subject-progress-line"><span>${escapeHtml(subject.shortName)}</span><span class="bar"><i style="width:${Math.min(percent, 100)}%"></i></span><b>${percent}%</b></div>`;
    }).join("");
  }

  function updateWrongCounts() {
    $("wrong-count-badge").textContent = state.wrong.length;
    $("practice-wrong-count").textContent = current.subjectId
      ? state.wrong.filter((id) => id.startsWith(`${current.subjectId}-`)).length
      : state.wrong.length;
  }

  function updateProgressChip() {
    const total = meta.subjects.reduce((sum, subject) => sum + subject.count, 0);
    const percentage = total ? Math.round((submittedIds().length / total) * 100) : 0;
    $("progress-chip-value").textContent = `${Math.min(percentage, 100)}%`;
  }

  function updateCountdown() {
    const now = new Date();
    const exam = new Date(meta.examDate);
    const days = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86400000));
    $("days-left").textContent = days.toLocaleString();
    const start = new Date("2026-01-01T00:00:00+08:00").getTime();
    const ratio = Math.max(0, Math.min(100, ((now.getTime() - start) / (exam.getTime() - start)) * 100));
    $("countdown-progress").style.width = `${ratio}%`;
  }

  function setTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark", state.theme === "dark");
    $("theme-toggle").textContent = state.theme === "dark" ? "☼" : "◐";
    saveState();
  }

  function firstUnansweredIndex(questions) {
    const index = questions.findIndex((question) => !state.submitted[question.id]);
    return index >= 0 ? index : 0;
  }

  function buildQuestionList() {
    let questions = getSubjectQuestions(current.subjectId).filter((question) => {
      const chapterOk = current.filters.chapter === "all" || question.chapter === current.filters.chapter;
      const typeOk = current.filters.type === "all" || question.type === current.filters.type;
      const wrongOk = !current.wrongOnly || state.wrong.includes(question.id);
      return chapterOk && typeOk && wrongOk;
    });
    if (current.order === "random") {
      questions = [...questions];
      for (let i = questions.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
    }
    return questions;
  }

  function populateFilters(questions) {
    const chapters = [...new Set(questions.map((question) => question.chapter).filter(Boolean))];
    $("chapter-filter").innerHTML = `<option value="all">全部章节</option>${chapters.map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`).join("")}`;
    $("chapter-filter").value = current.filters.chapter;
    $("type-filter").value = current.filters.type;
  }

  async function openPractice(subjectId, options = {}) {
    const subject = subjectById[subjectId];
    if (!subject) return;
    current.subjectId = subjectId;
    current.filters = { chapter: "all", type: "all" };
    current.order = "sequential";
    current.wrongOnly = Boolean(options.wrongOnly);
    $("practice-subject-pill").textContent = subject.shortName;
    $("practice-title").textContent = subject.name;
    $("toggle-order").textContent = "↝ 顺序";
    showView(els.practiceView);
    $("question-card").innerHTML = `<div class="empty-state"><strong>正在加载题库…</strong><span>第一次进入该科目会稍微慢一点。</span></div>`;
    try {
      const questions = await loadQuestions(subjectId);
      populateFilters(questions);
      current.questions = buildQuestionList();
      current.index = options.startId ? Math.max(0, current.questions.findIndex((q) => q.id === options.startId)) : firstUnansweredIndex(current.questions);
      if (current.index < 0) current.index = 0;
      renderPractice();
    } catch (error) {
      $("question-card").innerHTML = `<div class="empty-state"><strong>题库没有加载成功</strong><span>${escapeHtml(error.message)}。请确认网站通过 GitHub Pages 或本地 HTTP 服务打开，不要直接双击 HTML 文件。</span></div>`;
      toast("题库加载失败，请稍后重试");
    }
  }

  function renderPractice() {
    renderPracticeProgress();
    renderQuestionNav();
    renderQuestionCard();
    updateWrongCounts();
  }

  function renderPracticeProgress() {
    if (!current.subjectId) return;
    const total = current.questions.length;
    const currentNumber = total ? Math.min(current.index + 1, total) : 0;
    const completed = current.questions.filter((question) => state.submitted[question.id]).length;
    const percentage = total ? Math.round((completed / total) * 100) : 0;
    $("practice-progress-text").textContent = `${currentNumber} / ${total}`;
    $("mini-ring").style.background = `conic-gradient(var(--blue) ${percentage * 3.6}deg, #e9f1f4 0deg)`;
    $("mini-ring").querySelector("span").textContent = `${percentage}%`;
    $("practice-progress-line").style.width = `${percentage}%`;
  }

  function renderQuestionNav() {
    const nav = $("question-nav");
    nav.innerHTML = current.questions.map((question, index) => {
      const classes = ["nav-num"];
      if (index === current.index) classes.push("current");
      if (state.submitted[question.id]) classes.push("answered");
      if (state.wrong.includes(question.id)) classes.push("wrong");
      return `<button class="${classes.join(" ")}" type="button" data-index="${index}">${index + 1}</button>`;
    }).join("");
  }

  function answerText(question) {
    return question.answer.map((index) => `${LETTERS[index] || "?"}. ${question.options[index] || ""}`).join("；");
  }

  function renderQuestionCard() {
    const card = $("question-card");
    const question = current.questions[current.index];
    if (!question) {
      card.innerHTML = `<div class="empty-state"><strong>${current.wrongOnly ? "错题本还是空的" : "这个筛选条件下暂无题目"}</strong><span>${current.wrongOnly ? "答错题目后，它们会自动出现在这里。" : "换一个章节或题型试试。"}</span></div>`;
      return;
    }
    const selected = Array.isArray(state.selected[question.id]) ? state.selected[question.id] : [];
    const submitted = Boolean(state.submitted[question.id]);
    const correct = Boolean(state.correct[question.id]);
    const favorite = state.favorites.includes(question.id);
    const optionHtml = question.options.map((option, index) => {
      const isSelected = selected.includes(index);
      const isAnswer = question.answer.includes(index);
      const classes = ["option"];
      if (isSelected && !submitted) classes.push("selected");
      if (submitted && isAnswer) classes.push("correct");
      if (submitted && isSelected && !isAnswer) classes.push("incorrect");
      return `<button class="${classes.join(" ")}" type="button" data-option="${index}" ${submitted ? "disabled" : ""}><span class="option-letter">${LETTERS[index] || index + 1}</span><span>${richText(option)}</span></button>`;
    }).join("");
    const feedback = submitted ? `
      <div class="feedback ${correct ? "correct" : "incorrect"}">
        <strong>${correct ? "回答正确" : "需要再看一遍"}</strong>
        <p>${richText(question.explanation)}</p>
        <div class="answer-line">正确答案：${richText(answerText(question))}</div>
      </div>
    ` : "";
    const sourceYear = question.year ? `${question.year} · ` : "";
    card.innerHTML = `
      <div class="question-meta">
        <div class="question-meta-left"><span class="meta-chapter">${escapeHtml(question.chapter)}</span><span>${escapeHtml(question.topic || "综合")}</span></div>
        <button class="star-btn ${favorite ? "active" : ""}" type="button" id="favorite-question" aria-label="收藏题目">★</button>
      </div>
      <div class="question-source">${escapeHtml(sourceYear + question.sourceType)} · ${escapeHtml(question.source || "公开题库")}</div>
      <div class="question-type-label">${typeLabel(question.type)} · ${question.type === "multi" ? "可多选" : "请选择一个答案"}</div>
      <div class="question-text">${richText(question.prompt)}</div>
      <div class="question-hint">选完答案后点击“提交答案”，系统会立即标出正确选项并显示解析。</div>
      <div class="options">${optionHtml}</div>
      ${feedback}
      <div class="question-actions">
        <button class="action-btn" type="button" id="prev-question" ${current.index === 0 ? "disabled" : ""}>← 上一题</button>
        <div class="action-group">
          ${submitted ? `<button class="action-btn" type="button" id="retry-question">重新作答</button>` : ""}
          ${submitted ? `<button class="action-btn primary" type="button" id="next-question">下一题 →</button>` : `<button class="action-btn primary" type="button" id="submit-question">提交答案</button>`}
        </div>
      </div>
    `;
  }

  function setSelectedOption(index) {
    const question = current.questions[current.index];
    if (!question || state.submitted[question.id]) return;
    const selected = Array.isArray(state.selected[question.id]) ? [...state.selected[question.id]] : [];
    if (question.type === "multi") {
      const existing = selected.indexOf(index);
      if (existing >= 0) selected.splice(existing, 1);
      else selected.push(index);
    } else {
      selected.splice(0, selected.length, index);
    }
    state.selected[question.id] = selected.sort((a, b) => a - b);
    saveState();
    renderQuestionCard();
  }

  function sameAnswer(left, right) {
    return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
  }

  function submitQuestion() {
    const question = current.questions[current.index];
    if (!question) return;
    const selected = Array.isArray(state.selected[question.id]) ? state.selected[question.id] : [];
    if (!selected.length) {
      toast("先选择一个答案");
      return;
    }
    const correct = sameAnswer(selected, question.answer);
    state.submitted[question.id] = true;
    state.correct[question.id] = correct;
    if (correct) state.wrong = state.wrong.filter((id) => id !== question.id);
    else if (!state.wrong.includes(question.id)) state.wrong.push(question.id);
    saveState();
    renderPractice();
  }

  function retryQuestion() {
    const question = current.questions[current.index];
    if (!question) return;
    delete state.submitted[question.id];
    delete state.correct[question.id];
    state.selected[question.id] = [];
    state.wrong = state.wrong.filter((id) => id !== question.id);
    saveState();
    renderPractice();
  }

  function moveQuestion(delta) {
    const next = current.index + delta;
    if (next < 0 || next >= current.questions.length) {
      toast(delta > 0 ? "已经是最后一题了" : "已经是第一题了");
      return;
    }
    current.index = next;
    renderPractice();
  }

  async function openWrongView() {
    showView(els.wrongView);
    const list = $("wrong-list");
    if (!state.wrong.length) {
      list.innerHTML = `<div class="empty-state"><strong>错题本还是空的</strong><span>做题后答错的题目会自动出现在这里。</span></div>`;
      return;
    }
    list.innerHTML = `<div class="empty-state"><strong>正在整理错题…</strong><span>第一次打开会加载两个科目的题库。</span></div>`;
    try {
      await Promise.all(meta.subjects.map((subject) => loadQuestions(subject.id)));
      const questions = meta.subjects.flatMap((subject) => getSubjectQuestions(subject.id)).filter((question) => state.wrong.includes(question.id));
      list.innerHTML = questions.length ? questions.map((question, index) => `
        <article class="wrong-item">
          <span class="wrong-num">${index + 1}</span>
          <div><h3>${richText(question.prompt)}</h3><p>正确答案：${richText(answerText(question))}</p><p class="source-line">${escapeHtml(subjectById[question.subject].shortName)} · ${escapeHtml(question.chapter)} · ${escapeHtml(question.source || "公开题库")}</p></div>
          <button class="review-btn" type="button" data-review-id="${question.id}" data-review-subject="${question.subject}">重新练习</button>
        </article>
      `).join("") : `<div class="empty-state"><strong>没有找到对应题目</strong><span>可能是题库更新后本地错题记录过期了。</span></div>`;
    } catch (error) {
      list.innerHTML = `<div class="empty-state"><strong>错题加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    }
  }

  function applyFilters() {
    current.filters.chapter = $("chapter-filter").value;
    current.filters.type = $("type-filter").value;
    current.questions = buildQuestionList();
    current.index = firstUnansweredIndex(current.questions);
    renderPractice();
    toast(`已筛选 ${current.questions.length} 道题`);
  }

  function bindEvents() {
    $("brand-home").addEventListener("click", () => showView(els.homeView));
    $("practice-home").addEventListener("click", () => showView(els.homeView));
    $("wrong-home").addEventListener("click", () => showView(els.homeView));
    $("quick-subject-1").addEventListener("click", () => openPractice("fund1"));
    $("quick-subject-2").addEventListener("click", () => openPractice("fund2"));
    $("open-wrong").addEventListener("click", openWrongView);
    $("progress-chip").addEventListener("click", openWrongView);
    $("open-practice-wrong").addEventListener("click", () => openPractice(current.subjectId, { wrongOnly: true }));
    $("theme-toggle").addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
    $("reset-progress").addEventListener("click", () => {
      if (!window.confirm("确定要清空本地答题、错题和收藏记录吗？")) return;
      state.selected = {};
      state.submitted = {};
      state.correct = {};
      state.wrong = [];
      state.favorites = [];
      saveState();
      renderHome();
      toast("本地进度已清空");
    });
    $("clear-wrong").addEventListener("click", () => {
      if (!state.wrong.length) return;
      if (!window.confirm("确定清空错题本吗？已作答记录会保留。")) return;
      state.wrong = [];
      saveState();
      openWrongView();
      toast("错题本已清空");
    });
    $("practice-filters").addEventListener("click", () => $("filter-bar").classList.toggle("open"));
    $("apply-filter").addEventListener("click", applyFilters);
    $("toggle-order").addEventListener("click", () => {
      current.order = current.order === "sequential" ? "random" : "sequential";
      $("toggle-order").textContent = current.order === "random" ? "↝ 随机" : "↝ 顺序";
      current.questions = buildQuestionList();
      current.index = 0;
      renderPractice();
    });
    $("subject-grid").addEventListener("click", (event) => {
      const card = event.target.closest("[data-subject]");
      if (card) openPractice(card.dataset.subject);
    });
    $("question-nav").addEventListener("click", (event) => {
      const button = event.target.closest("[data-index]");
      if (!button) return;
      current.index = Number(button.dataset.index);
      renderPractice();
    });
    $("question-card").addEventListener("click", (event) => {
      const option = event.target.closest("[data-option]");
      if (option) setSelectedOption(Number(option.dataset.option));
      if (event.target.closest("#submit-question")) submitQuestion();
      if (event.target.closest("#retry-question")) retryQuestion();
      if (event.target.closest("#prev-question")) moveQuestion(-1);
      if (event.target.closest("#next-question")) moveQuestion(1);
      if (event.target.closest("#favorite-question")) {
        const question = current.questions[current.index];
        if (!question) return;
        if (state.favorites.includes(question.id)) state.favorites = state.favorites.filter((id) => id !== question.id);
        else state.favorites.push(question.id);
        saveState();
        renderQuestionCard();
      }
    });
    $("wrong-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-id]");
      if (button) openPractice(button.dataset.reviewSubject, { wrongOnly: true, startId: button.dataset.reviewId });
    });
  }

  setTheme(state.theme);
  renderHome();
  bindEvents();
  window.setInterval(updateCountdown, 60000);
})();
