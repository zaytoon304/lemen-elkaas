const G = (() => {

  // ── أرقام عربية شرقية ──
  const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

  // ── ثوابت المواد ──
  const SUBJECTS = ['math','arabic','english','science','social','islamic'];
  const SUBJ_META = {
    math:    { name:'الرياضيات',       icon:'🔢', cls:'sb-math',    seg:'seg-math' },
    arabic:  { name:'اللغة العربية',    icon:'📖', cls:'sb-arabic',  seg:'seg-arabic' },
    english: { name:'اللغة الإنجليزية', icon:'🔤', cls:'sb-english', seg:'seg-english' },
    science: { name:'العلوم',           icon:'🔬', cls:'sb-science', seg:'seg-science' },
    social:  { name:'الاجتماعيات',      icon:'🌍', cls:'sb-social',  seg:'seg-social' },
    islamic: { name:'التربية الإسلامية',icon:'🕌', cls:'sb-islamic', seg:'seg-islamic' },
  };

  // ── ألوان وأسماء الفرق ──
  const TEAM_COLORS_HEX = ['#4facfe','#f7971e','#00cec9','#a29bfe','#fd79a8'];
  const TEAM_EMOJIS     = ['🔵','🟠','🟢','🟣','🩷'];
  const DEFAULT_NAMES   = ['الأبطال','النجوم','العباقرة','المبدعون','الفائزون'];

  // ── حالة اللعبة ──
  let mode       = 'single';   // 'single' | 'tournament'
  let teams      = [];
  let scores     = [];
  let teamCount  = 2;
  let hasAI      = false;
  let aiAccuracy = 0.75;

  let questions  = [];
  let qIndex     = 0;
  let TOTAL      = 5;
  let timer      = null;
  let timeLeft   = 30;
  let timerMax   = 30;
  let answered   = false;
  let isSteal    = false;
  let current    = 0;

  // ── تتبع المواد (tournament) ──
  let subjectScores  = [];  // [teamIdx][subjKey] = نقاط
  let currentSubjKey = '';  // المادة الحالية عند بدء السؤال

  // ── الحسم ──
  let isTiebreaker    = false;
  let tiebreakerTeams = [];
  let tiebreakerIdx   = 0;
  let tiebreakerWinner = -1;
  let tiebreakerPool   = [];

  // ── الاختيارات المحفوظة ──
  let selectedSubj  = null;
  let selectedGrade = null;
  let selectedLevel = null;

  const $ = id => document.getElementById(id);

  // ─────────────────────────────────────────────
  // تهيئة الواجهة
  // ─────────────────────────────────────────────
  function init() {
    buildTeamInputs(2);

    document.querySelectorAll('[data-tc]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('tc-disabled')) return;
        document.querySelectorAll('[data-tc]').forEach(b => b.classList.remove('sel-tc'));
        btn.classList.add('sel-tc');
        teamCount = parseInt(btn.getAttribute('data-tc'));
        buildTeamInputs(teamCount);
      });
    });

    document.querySelectorAll('.subj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        selectedSubj = btn.getAttribute('data-s');
      });
    });

    document.querySelectorAll('[data-g]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-g]').forEach(b => b.classList.remove('sel-grade'));
        btn.classList.add('sel-grade');
        selectedGrade = parseInt(btn.getAttribute('data-g'));
      });
    });

    document.querySelectorAll('[data-l]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-l]').forEach(b => b.classList.remove('sel-easy','sel-medium','sel-hard'));
        const lv = btn.getAttribute('data-l');
        btn.classList.add('sel-' + lv);
        selectedLevel = lv;
      });
    });

    document.querySelectorAll('[data-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-q]').forEach(b => b.classList.remove('sel-qcount'));
        btn.classList.add('sel-qcount');
        TOTAL = parseInt(btn.getAttribute('data-q'));
      });
    });

    $('btn-start').addEventListener('click', startGame);
  }

  // ─────────────────────────────────────────────
  // تغيير الوضع
  // ─────────────────────────────────────────────
  function setMode(m) {
    mode = m;
    const isTourney = m === 'tournament';

    $('mode-btn-single').className     = 'mode-btn' + (isTourney ? '' : ' sel-single');
    $('mode-btn-tournament').className = 'mode-btn' + (isTourney ? ' sel-tournament' : '');

    // إخفاء/إظهار أقسام المادة وعدد الأسئلة
    $('single-only-subj').style.display   = isTourney ? 'none' : '';
    $('single-only-qcount').style.display = isTourney ? 'none' : '';
    $('tourney-info-badge').style.display  = isTourney ? 'block' : 'none';

    // زر ١ فريق: معطّل في البطولة
    const tc1 = $('tc-btn-1');
    if (isTourney) {
      tc1.classList.add('tc-disabled');
      // إذا كان مختاراً، انتقل إلى ٢
      if (teamCount === 1) {
        teamCount = 2;
        document.querySelectorAll('[data-tc]').forEach(b => b.classList.remove('sel-tc'));
        document.querySelector('[data-tc="2"]').classList.add('sel-tc');
        buildTeamInputs(2);
      }
    } else {
      tc1.classList.remove('tc-disabled');
    }
  }

  // ─────────────────────────────────────────────
  // بناء حقول أسماء الفرق
  // ─────────────────────────────────────────────
  function buildTeamInputs(count) {
    const grid = $('team-inputs-grid');
    grid.className = 'team-inputs-grid cols-' + (count === 1 ? '2' : count);
    grid.innerHTML = '';

    const realCount = count === 1 ? 2 : count;
    for (let i = 0; i < realCount; i++) {
      const isAI = (count === 1 && i === 1);
      const inp = document.createElement('input');
      inp.className = 'team-input' + (isAI ? ' ai-field' : '');
      inp.id        = 'inp-t' + i;
      inp.type      = 'text';
      inp.maxLength = 20;
      if (isAI) {
        inp.value    = 'عقل الأرقم 🤖';
        inp.readOnly = true;
      } else {
        inp.placeholder = TEAM_EMOJIS[i] + ' ' + DEFAULT_NAMES[i];
      }
      inp.style.borderColor = TEAM_COLORS_HEX[i];
      grid.appendChild(inp);
    }
  }

  // ─────────────────────────────────────────────
  // خلط الإجابات (التعديل ٥)
  // ─────────────────────────────────────────────
  function shuffleChoices(q) {
    const tagged = q.c.map((text, i) => ({ text, isCorrect: i === q.a }));
    for (let i = tagged.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
    }
    return { ...q, c: tagged.map(t => t.text), a: tagged.findIndex(t => t.isCorrect) };
  }

  // ─────────────────────────────────────────────
  // Fisher-Yates
  // ─────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─────────────────────────────────────────────
  // بناء أسئلة Single Mode
  // ─────────────────────────────────────────────
  function buildSinglePool(subj, grade, level, total) {
    const allSubjs = Object.keys(ALL_QUESTIONS);
    const pool = [];

    if (subj) {
      // مادة محددة
      pool.push(...(ALL_QUESTIONS[subj] || []).filter(q => q.grade === grade && q.level === level));
      return shuffle([...pool]).slice(0, total);
    }

    // توزيع على كل المواد
    const dist = getDistribution(total);
    allSubjs.forEach((s, i) => {
      const need = dist[i] || 0;
      if (!need) return;
      const src = shuffle(
        (ALL_QUESTIONS[s] || []).filter(q => q.grade === grade && q.level === level)
      ).slice(0, need);
      pool.push(...src.map(q => ({ ...q, _subj: s })));
    });
    return shuffle(pool);
  }

  function getDistribution(total) {
    if (total === 5)  return [1,1,1,1,1,0];
    if (total === 7)  return [2,1,1,1,1,1];
    if (total === 10) return [2,2,2,2,1,1];
    if (total === 15) return [3,3,2,2,3,2];
    const base = Math.floor(total / 6);
    const extra = total % 6;
    return Array.from({length:6}, (_, i) => base + (i < extra ? 1 : 0));
  }

  // ─────────────────────────────────────────────
  // بناء أسئلة البطولة الكبرى
  // ─────────────────────────────────────────────
  function buildTournamentPool(grade, level, N) {
    // لكل مادة: N×2 أسئلة فريدة مقسّمة على الفرق
    // الترتيب في المصفوفة: team0_r1, team1_r1, ..., teamN-1_r1, team0_r2, team1_r2, ...
    const result = new Array(N * 12);

    SUBJECTS.forEach((subj, si) => {
      const pool = shuffle(
        (ALL_QUESTIONS[subj] || []).filter(q => q.grade === grade && q.level === level)
      );
      const needed = N * 2;
      for (let qi = 0; qi < needed; qi++) {
        const r = Math.floor(qi / N);  // جولة (0 أو 1)
        const t = qi % N;              // الفريق
        const q = pool[qi] || pool[qi % pool.length] || pool[0];
        result[si * N * 2 + r * N + t] = { ...q, _subj: subj };
      }
    });

    return result;
  }

  // المادة الحالية في البطولة
  function getCurrentSubj(idx, N) {
    return SUBJECTS[Math.floor(idx / (N * 2))];
  }

  // ─────────────────────────────────────────────
  // بدء اللعبة
  // ─────────────────────────────────────────────
  function startGame() {
    const gradeBtn = document.querySelector('[data-g].sel-grade');
    const levelSel = document.querySelector('[data-l].sel-easy,[data-l].sel-medium,[data-l].sel-hard');

    if (!gradeBtn) { alert('اختر الصف أولاً!'); return; }
    if (!levelSel) { alert('اختر المستوى أولاً!'); return; }
    if (mode === 'single' && !selectedSubj) { alert('اختر المادة أولاً!'); return; }

    selectedGrade = parseInt(gradeBtn.getAttribute('data-g'));
    selectedLevel = levelSel.getAttribute('data-l');
    aiAccuracy = selectedLevel === 'easy' ? 0.60 : selectedLevel === 'medium' ? 0.75 : 0.85;

    // أسماء الفرق
    hasAI = (mode === 'single' && teamCount === 1);
    const realCount = teamCount === 1 ? 2 : teamCount;
    teams = [];
    for (let i = 0; i < realCount; i++) {
      const inp = $('inp-t' + i);
      teams.push(inp && inp.readOnly ? inp.value : (inp && inp.value.trim()) || DEFAULT_NAMES[i]);
    }

    // بناء الأسئلة
    if (mode === 'tournament') {
      questions = buildTournamentPool(selectedGrade, selectedLevel, realCount);
      TOTAL = 12;
      // تهيئة نقاط المواد
      subjectScores = teams.map(() => {
        const obj = {};
        SUBJECTS.forEach(s => { obj[s] = 0; });
        return obj;
      });
      // بناء شريط التقدم
      buildTourneyProgressBar(realCount);
    } else {
      questions = buildSinglePool(selectedSubj, selectedGrade, selectedLevel, TOTAL * realCount);
      if (questions.length === 0) {
        alert('لا توجد أسئلة لهذا الاختيار. جرّب صفاً أو مستوى آخر.');
        return;
      }
      questions = questions.slice(0, TOTAL * realCount);
    }

    scores  = Array(realCount).fill(0);
    current = 0;
    qIndex  = 0;
    isSteal = false;
    isTiebreaker    = false;
    tiebreakerTeams = [];
    tiebreakerWinner = -1;
    tiebreakerPool   = [];

    buildGameUI(realCount);
    showScreen('game');
    loadQuestion();
  }

  // ─────────────────────────────────────────────
  // بناء شريط تقدم البطولة (٦ أجزاء)
  // ─────────────────────────────────────────────
  function buildTourneyProgressBar(N) {
    const container = $('prog-segments');
    container.innerHTML = '';
    SUBJECTS.forEach(subj => {
      const seg = document.createElement('div');
      seg.className = 'prog-seg';
      seg.id = 'seg-' + subj;
      const fill = document.createElement('div');
      fill.className = 'prog-seg-fill ' + SUBJ_META[subj].seg;
      fill.id = 'seg-fill-' + subj;
      seg.appendChild(fill);
      container.appendChild(seg);
    });
  }

  // تحديث شريط التقدم في البطولة
  function updateTourneyProgress(N) {
    const subjIdx = Math.floor(qIndex / (N * 2));
    const withinSubj = qIndex % (N * 2);

    SUBJECTS.forEach((subj, si) => {
      const fill = $('seg-fill-' + subj);
      const seg  = $('seg-' + subj);
      if (!fill || !seg) return;
      if (si < subjIdx) {
        fill.style.width = '100%';
        seg.classList.add('seg-done');
      } else if (si === subjIdx) {
        fill.style.width = (withinSubj / (N * 2) * 100) + '%';
        seg.classList.remove('seg-done');
      } else {
        fill.style.width = '0%';
        seg.classList.remove('seg-done');
      }
    });

    const meta = SUBJ_META[SUBJECTS[Math.min(subjIdx, 5)]];
    $('tourney-prog-label').textContent =
      `${meta.icon} ${meta.name} — السؤال ${toAr(withinSubj + 1)} من ${toAr(N * 2)}`;
  }

  // ─────────────────────────────────────────────
  // بناء واجهة اللعب
  // ─────────────────────────────────────────────
  function buildGameUI(count) {
    const bar2 = $('score-bar-2');
    const barM = $('score-bar-multi');
    const sp   = $('single-progress');
    const tp   = $('tourney-progress');
    const sbw  = $('subject-badge-wrap');

    // تقدم
    sp.style.display = (mode === 'tournament') ? 'none' : 'block';
    tp.style.display = (mode === 'tournament') ? 'block' : 'none';
    sbw.style.display = (mode === 'tournament') ? 'block' : 'none';

    if (count === 2) {
      bar2.style.display = 'flex';
      barM.style.display = 'none';
      $('t1-name-lbl').textContent = teams[0];
      $('t2-name-lbl').textContent = teams[1];
      $('t1-pts').textContent = toAr(0);
      $('t2-pts').textContent = toAr(0);
      $('rope-t1-label').textContent = teams[0];
      $('rope-t2-label').textContent = teams[1];
      updateRope();
    } else {
      bar2.style.display = 'none';
      barM.style.display = 'flex';
      barM.innerHTML = '';
      teams.forEach((name, i) => {
        const card = document.createElement('div');
        card.className = 'ts-card';
        card.id = 'ts-card-' + i;
        card.style.borderColor = TEAM_COLORS_HEX[i];
        card.innerHTML = `<div class="ts-name">${TEAM_EMOJIS[i]} ${name}</div>
                          <div class="ts-pts" id="ts-pts-${i}" style="color:${TEAM_COLORS_HEX[i]}">${toAr(0)}</div>`;
        barM.appendChild(card);
      });
    }
  }

  // ─────────────────────────────────────────────
  // تحميل سؤال
  // ─────────────────────────────────────────────
  function loadQuestion() {
    if (!isTiebreaker && qIndex >= questions.length) {
      checkTiebreaker();
      return;
    }

    answered = false;
    isSteal  = false;

    let q;
    if (isTiebreaker) {
      if (tiebreakerPool.length === 0) {
        tiebreakerPool = buildTiebreakerPool();
        if (tiebreakerPool.length === 0) { endGame(); return; }
      }
      q = tiebreakerPool.shift();
    } else {
      q = questions[qIndex];
    }

    // حفظ مفتاح المادة الحالية
    currentSubjKey = q._subj || (mode === 'tournament' ? getCurrentSubj(qIndex, teams.length) : (selectedSubj || ''));

    // خلط الإجابات
    q = shuffleChoices(q);
    if (!isTiebreaker) questions[qIndex] = q;

    // ── واجهة السؤال ──
    $('q-text').textContent = q.q;
    $('steal-banner').style.display  = 'none';
    $('ai-thinking').style.display   = 'none';

    const letters = ['أ','ب','ج','د'];
    for (let i = 0; i < 4; i++) {
      const btn = $('ch' + i);
      btn.className = 'ch-btn';
      btn.disabled  = false;
      $('ct' + i).textContent = q.c[i];
      btn.querySelector('.ch-letter').textContent = letters[i];
    }

    // تحديث التقدم
    if (mode === 'tournament' && !isTiebreaker) {
      const N = teams.length;
      updateTourneyProgress(N);
      updateSubjectBadge(q._subj || getCurrentSubj(qIndex, N), qIndex, N);
    } else if (mode === 'single') {
      const total = toAr(questions.length);
      const cur   = toAr(qIndex + 1);
      const pct   = (qIndex / questions.length) * 100;
      $('progress-fill').style.width = pct + '%';
      $('progress-label').textContent = `السؤال ${cur} من ${total}`;
      $('q-counter').textContent = `${cur} / ${total}`;
    }

    if (isTiebreaker) {
      $('steal-banner').textContent = '⚡ جولة حسم — التعادل!';
      $('steal-banner').style.background = 'linear-gradient(135deg,#6c5ce7,#a29bfe)';
      $('steal-banner').style.color = '#fff';
      $('steal-banner').style.display = 'block';
    }

    updateTurnBar();
    timerMax = 30;
    startTimer(30);

    // دور AI
    if (hasAI && current === 1) {
      document.querySelectorAll('.ch-btn').forEach(b => b.disabled = true);
      $('ai-thinking').style.display = 'block';
      const delay = 1000 + Math.random() * 1000;
      const captured = q;
      setTimeout(() => doAiAnswer(captured), delay);
    }
  }

  // ─────────────────────────────────────────────
  // شارة المادة
  // ─────────────────────────────────────────────
  function updateSubjectBadge(subj, idx, N) {
    const meta = SUBJ_META[subj] || SUBJ_META['math'];
    const badge = $('subject-badge');
    badge.className = 'subject-badge ' + meta.cls;
    $('sb-icon').textContent = meta.icon;
    $('sb-name').textContent = meta.name;

    const withinSubj = (idx % (N * 2)) + 1;
    $('subj-q-counter').textContent =
      `السؤال ${toAr(withinSubj)} من ${toAr(N * 2)} في ${meta.name}`;
  }

  // ─────────────────────────────────────────────
  // AI يجيب
  // ─────────────────────────────────────────────
  function doAiAnswer(q) {
    if (answered) return;
    $('ai-thinking').style.display = 'none';
    document.querySelectorAll('.ch-btn').forEach(b => b.disabled = false);
    const correct = q.a;
    if (Math.random() < aiAccuracy) {
      pick(correct);
    } else {
      const wrong = [0,1,2,3].filter(i => i !== correct);
      pick(wrong[Math.floor(Math.random() * wrong.length)]);
    }
  }

  // ─────────────────────────────────────────────
  // شريط الدور
  // ─────────────────────────────────────────────
  function updateTurnBar() {
    const bar = $('turn-bar');
    bar.className = 'turn-bar t' + (current + 1);
    bar.textContent = `دور ${teams[current]} ${TEAM_EMOJIS[current]}`;

    document.querySelectorAll('.ts-card').forEach((c, i) => {
      c.classList.toggle('active-team', i === current);
    });

    if (teams.length === 2) {
      const p = $('t1-name-lbl').parentElement;
      const q2 = $('t2-name-lbl').parentElement;
      p.style.opacity  = current === 0 ? '1' : '0.45';
      q2.style.opacity = current === 1 ? '1' : '0.45';
    }
  }

  // ─────────────────────────────────────────────
  // المؤقت
  // ─────────────────────────────────────────────
  function startTimer(seconds) {
    clearInterval(timer);
    timeLeft = seconds;
    timerMax = seconds;
    renderTimer();
    timer = setInterval(() => {
      timeLeft--;
      renderTimer();
      if (timeLeft <= 0) { clearInterval(timer); onTimeOut(); }
    }, 1000);
  }

  function renderTimer() {
    $('timer-num').textContent = toAr(timeLeft);
    const pct = (timeLeft / timerMax) * 100;
    $('timer-fill').style.width = pct + '%';
    $('timer-fill').style.backgroundColor =
      timeLeft > timerMax * .5  ? '#00b09b' :
      timeLeft > timerMax * .23 ? '#fdcb6e' : '#d63031';
  }

  function onTimeOut() {
    if (answered) return;
    answered = true;
    revealCorrect();
    if (!isSteal) activateSteal();
    else setTimeout(nextQuestion, 1800);
  }

  // ─────────────────────────────────────────────
  // اختيار إجابة
  // ─────────────────────────────────────────────
  function pick(idx) {
    if (answered) return;
    answered = true;
    clearInterval(timer);
    $('ai-thinking').style.display = 'none';

    const q       = isTiebreaker ? questions[0] : questions[qIndex];
    const correct = q.a;
    document.querySelectorAll('.ch-btn').forEach(b => b.disabled = true);

    if (idx === correct) {
      $('ch' + idx).classList.add('correct');
      scores[current]++;
      // تتبع نقاط المادة في البطولة
      if (mode === 'tournament' && subjectScores[current]) {
        subjectScores[current][currentSubjKey] = (subjectScores[current][currentSubjKey] || 0) + 1;
      }
      updateScoreDisplay();
      showFeedback('✅');
      if (isTiebreaker) { tiebreakerWinner = current; setTimeout(endGame, 1500); }
      else setTimeout(nextQuestion, 1500);
    } else {
      $('ch' + idx).classList.add('wrong');
      revealCorrect();
      showFeedback('❌');
      if (isTiebreaker) setTimeout(nextTiebreakerTurn, 1800);
      else if (!isSteal) activateSteal();
      else setTimeout(nextQuestion, 1800);
    }
  }

  function revealCorrect() {
    const q = isTiebreaker ? questions[0] : questions[qIndex];
    $('ch' + q.a).classList.add('reveal');
  }

  // ─────────────────────────────────────────────
  // الاختطاف
  // ─────────────────────────────────────────────
  function activateSteal() {
    isSteal  = true;
    answered = false;
    current  = (current + 1) % teams.length;
    updateTurnBar();

    const banner = $('steal-banner');
    banner.style.background = 'linear-gradient(135deg,#f7971e,#ffd200)';
    banner.style.color = '#1a1a1a';
    banner.textContent = `⚡ فرصة الاختطاف — ${teams[current]}!`;
    banner.style.display = 'block';

    document.querySelectorAll('.ch-btn').forEach(btn => {
      if (!btn.classList.contains('wrong')) btn.disabled = false;
    });

    startTimer(15);

    if (hasAI && current === 1) {
      document.querySelectorAll('.ch-btn').forEach(b => b.disabled = true);
      $('ai-thinking').style.display = 'block';
      const captured = questions[qIndex];
      setTimeout(() => doAiAnswer(captured), 1000 + Math.random() * 800);
    }
  }

  // ─────────────────────────────────────────────
  // السؤال التالي
  // ─────────────────────────────────────────────
  function nextQuestion() {
    qIndex++;
    current = qIndex % teams.length;
    if (qIndex >= questions.length) { checkTiebreaker(); return; }
    loadQuestion();
  }

  // ─────────────────────────────────────────────
  // تحديث النتائج
  // ─────────────────────────────────────────────
  function updateScoreDisplay() {
    if (teams.length === 2) {
      $('t1-pts').textContent = toAr(scores[0]);
      $('t2-pts').textContent = toAr(scores[1]);
      updateRope();
    } else {
      scores.forEach((s, i) => {
        const el = $('ts-pts-' + i);
        if (el) el.textContent = toAr(s);
      });
    }
  }

  function updateRope() {
    const total = scores[0] + scores[1];
    const pct   = total === 0 ? 50 : Math.round((scores[0] / total) * 100);
    $('rope-seg1').style.width = pct + '%';
    $('rope-seg2').style.width = (100 - pct) + '%';
    $('rope-knot').style.left  = pct + '%';
  }

  // ─────────────────────────────────────────────
  // جولة الحسم
  // ─────────────────────────────────────────────
  function checkTiebreaker() {
    const max = Math.max(...scores);
    tiebreakerTeams = scores.map((s, i) => i).filter(i => scores[i] === max);

    if (tiebreakerTeams.length > 1) {
      isTiebreaker = true;
      tiebreakerIdx = 0;
      tiebreakerPool = buildTiebreakerPool();
      current = tiebreakerTeams[0];
      questions = [];
      qIndex = 0;
      loadTiebreakerRound();
    } else {
      endGame();
    }
  }

  function buildTiebreakerPool() {
    const allQ = [];
    const subjsToUse = mode === 'tournament' ? SUBJECTS : (selectedSubj ? [selectedSubj] : SUBJECTS);
    subjsToUse.forEach(s => {
      allQ.push(...(ALL_QUESTIONS[s] || []).filter(q => q.grade === selectedGrade && q.level === selectedLevel));
    });
    return shuffle([...allQ]).map(q => shuffleChoices(q));
  }

  function loadTiebreakerRound() {
    if (tiebreakerPool.length === 0) { endGame(); return; }
    const q = tiebreakerPool.shift();
    questions = [q];
    isTiebreaker = true;
    current = tiebreakerTeams[tiebreakerIdx % tiebreakerTeams.length];
    loadQuestion();
  }

  function nextTiebreakerTurn() {
    tiebreakerIdx++;
    if (tiebreakerIdx >= tiebreakerTeams.length) {
      tiebreakerIdx = 0;
    }
    loadTiebreakerRound();
  }

  // ─────────────────────────────────────────────
  // نهاية اللعبة
  // ─────────────────────────────────────────────
  function endGame() {
    clearInterval(timer);
    showScreen('result');

    // نتائج الفرق
    const fs = $('final-scores');
    fs.innerHTML = '';
    scores.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'fs-item';
      item.innerHTML = `<div class="fs-name">${TEAM_EMOJIS[i]} ${teams[i]}</div>
                        <div class="fs-num" style="color:${TEAM_COLORS_HEX[i]}">${toAr(s)}</div>`;
      fs.appendChild(item);
      if (i < scores.length - 1) {
        const sep = document.createElement('div');
        sep.style.cssText = 'display:flex;align-items:center;font-size:1.8rem;';
        sep.textContent = '⚔️';
        fs.appendChild(sep);
      }
    });

    // الفائز
    let winnerIdx = -1;
    if (isTiebreaker && tiebreakerWinner >= 0) {
      winnerIdx = tiebreakerWinner;
    } else {
      const max = Math.max(...scores);
      const ties = scores.filter(s => s === max);
      if (ties.length === 1) winnerIdx = scores.indexOf(max);
    }

    if (winnerIdx >= 0) {
      $('winner-txt').textContent = `🏆 فاز ${teams[winnerIdx]}!`;
      spawnConfetti();
    } else {
      $('winner-txt').textContent = '🤝 تعادل! كلا الفريقين رائع!';
    }

    // جدول البطولة التفصيلي
    const tr = $('tourney-results');
    if (mode === 'tournament') {
      tr.style.display = 'block';
      renderTournamentTable(winnerIdx);
    } else {
      tr.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────
  // جدول البطولة
  // ─────────────────────────────────────────────
  function renderTournamentTable(winnerIdx) {
    const N = teams.length;
    const tbl = $('subj-table');
    tbl.innerHTML = '';

    // رأس الجدول
    const thead = document.createElement('thead');
    const hrow  = document.createElement('tr');
    const th0   = document.createElement('th');
    th0.textContent = 'الفريق';
    hrow.appendChild(th0);
    SUBJECTS.forEach(s => {
      const th = document.createElement('th');
      th.textContent = SUBJ_META[s].icon + ' ' + SUBJ_META[s].name;
      hrow.appendChild(th);
    });
    const thTotal = document.createElement('th');
    thTotal.textContent = '📊 المجموع';
    hrow.appendChild(thTotal);
    thead.appendChild(hrow);
    tbl.appendChild(thead);

    // حساب الفائز في كل مادة
    const subjWinners = {};
    SUBJECTS.forEach(s => {
      const maxScore = Math.max(...teams.map((_, i) => subjectScores[i][s] || 0));
      subjWinners[s] = teams.map((_, i) => subjectScores[i][s] || 0).reduce((best, v, i) => {
        if (v === maxScore && v > 0) return best.concat(i);
        return best;
      }, []);
    });

    // صفوف الفرق
    const tbody = document.createElement('tbody');
    teams.forEach((name, ti) => {
      const row = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.textContent = TEAM_EMOJIS[ti] + ' ' + name;
      if (ti === winnerIdx) nameTd.style.color = 'var(--gold-light)';
      row.appendChild(nameTd);

      SUBJECTS.forEach(s => {
        const td = document.createElement('td');
        const val = subjectScores[ti][s] || 0;
        const isChamp = subjWinners[s].includes(ti) && subjWinners[s].length === 1;
        td.textContent = toAr(val) + '/٢';
        td.className = val === 2 ? 'score-full' : val === 1 ? 'score-partial' : 'score-zero';
        if (isChamp) td.classList.add('champ-cell');
        row.appendChild(td);
      });

      const totalTd = document.createElement('td');
      totalTd.textContent = toAr(scores[ti]);
      totalTd.style.fontWeight = '900';
      totalTd.style.color = TEAM_COLORS_HEX[ti];
      row.appendChild(totalTd);

      tbody.appendChild(row);
    });
    tbl.appendChild(tbody);

    // شارات "الأقوى في"
    const wrap = $('strongest-badges');
    wrap.innerHTML = '';
    SUBJECTS.forEach(s => {
      const winners = subjWinners[s];
      if (winners.length === 0) return;
      const badge = document.createElement('div');
      badge.className = 'strongest-badge';
      const winNames = winners.map(i => teams[i]).join(' & ');
      badge.innerHTML = `<span>${SUBJ_META[s].icon} ${SUBJ_META[s].name}</span>
                         <span class="sb-label">الأقوى:</span>
                         <strong>${winNames}</strong>`;
      wrap.appendChild(badge);
    });
  }

  // ─────────────────────────────────────────────
  // إعادة الضبط
  // ─────────────────────────────────────────────
  function reset() {
    clearInterval(timer);
    $('confetti-wrap').innerHTML = '';
    isTiebreaker    = false;
    tiebreakerTeams = [];
    tiebreakerWinner = -1;
    tiebreakerPool   = [];
    subjectScores    = [];
    showScreen('setup');
  }

  // ─────────────────────────────────────────────
  // الشاشات
  // ─────────────────────────────────────────────
  function showScreen(name) {
    ['scr-setup','scr-game','scr-result'].forEach(id => $(id).classList.remove('active'));
    $('scr-' + name).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ─────────────────────────────────────────────
  // تأثير التغذية الراجعة
  // ─────────────────────────────────────────────
  function showFeedback(emoji) {
    const el = $('feedback');
    el.textContent = emoji;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1000);
  }

  // ─────────────────────────────────────────────
  // كونفيتي
  // ─────────────────────────────────────────────
  function spawnConfetti() {
    const colors = ['#ffd700','#4facfe','#f7971e','#00b09b','#fd79a8','#a29bfe'];
    const container = $('confetti-wrap');
    container.innerHTML = '';
    for (let i = 0; i < 90; i++) {
      const el = document.createElement('div');
      el.className = 'cf';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = (2 + Math.random() * 3) + 's';
      el.style.animationDelay    = (Math.random() * 1.5) + 's';
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(el);
    }
  }

  // ─────────────────────────────────────────────
  // تشغيل
  // ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { pick, reset, startGame, setMode };
})();
