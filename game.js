const G = (() => {

  // ── أرقام عربية شرقية ──
  const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

  // ── حالة اللعبة ──
  let teams      = [];       // أسماء الفرق
  let scores     = [];       // نقاط الفرق
  let teamCount  = 2;        // عدد الفرق
  let hasAI      = false;    // هل الخصم AI؟
  let aiAccuracy = 0.75;     // دقة AI

  let questions  = [];       // الأسئلة المختارة للجلسة
  let qIndex     = 0;        // رقم السؤال الحالي
  let TOTAL      = 10;       // عدد الأسئلة لكل فريق
  let timer      = null;
  let timeLeft   = 30;
  let timerMax   = 30;
  let answered   = false;
  let isSteal    = false;
  let current    = 0;        // الفريق الحالي

  // ── جولة الحسم ──
  let isTiebreaker     = false;
  let tiebreakerTeams  = [];  // الفرق المتعادلة
  let tiebreakerIdx    = 0;   // الفريق الحالي داخل الحسم
  let tiebreakerWinner = -1;

  // ── المادة والصف والمستوى ──
  let selectedSubj  = null;
  let selectedGrade = null;
  let selectedLevel = null;

  // ── قائمة الأسئلة المستخدمة ──
  let usedQuestionIds = new Set();

  const $ = id => document.getElementById(id);
  const TEAM_COLORS = ['--t1','--t2','--t3','--t4','--t5'];
  const TEAM_EMOJIS = ['🔵','🟠','🟢','🟣','🩷'];

  // ─────────────────────────────────────────────
  // تهيئة الواجهة
  // ─────────────────────────────────────────────
  function init() {
    // أزرار عدد الفرق
    document.querySelectorAll('[data-tc]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tc]').forEach(b => b.classList.remove('sel-tc'));
        btn.classList.add('sel-tc');
        teamCount = parseInt(btn.getAttribute('data-tc'));
        buildTeamInputs(teamCount);
      });
    });

    // بناء الحقول مبدئياً (٢ فرق)
    buildTeamInputs(2);

    // أزرار المادة
    document.querySelectorAll('.subj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        selectedSubj = btn.getAttribute('data-s');
      });
    });

    // أزرار الصف
    document.querySelectorAll('[data-g]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-g]').forEach(b => b.classList.remove('sel-grade'));
        btn.classList.add('sel-grade');
        selectedGrade = parseInt(btn.getAttribute('data-g'));
      });
    });

    // أزرار المستوى
    document.querySelectorAll('[data-l]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-l]').forEach(b => {
          b.classList.remove('sel-easy','sel-medium','sel-hard');
        });
        const lv = btn.getAttribute('data-l');
        btn.classList.add('sel-' + lv);
        selectedLevel = lv;
      });
    });

    // أزرار عدد الأسئلة
    document.querySelectorAll('[data-q]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-q]').forEach(b => b.classList.remove('sel-qcount'));
        btn.classList.add('sel-qcount');
        TOTAL = parseInt(btn.getAttribute('data-q'));
      });
    });
    // الافتراضي ٥
    const defQ = document.querySelector('[data-q="5"]');
    if (defQ) { TOTAL = 5; defQ.classList.add('sel-qcount'); }

    $('btn-start').addEventListener('click', startGame);
  }

  // ─────────────────────────────────────────────
  // بناء حقول أسماء الفرق
  // ─────────────────────────────────────────────
  const DEFAULT_NAMES = ['الأبطال','النجوم','العباقرة','المبدعون','الفائزون'];
  const COLORS_HEX = ['#4facfe','#f7971e','#00cec9','#a29bfe','#fd79a8'];

  function buildTeamInputs(count) {
    const grid = $('team-inputs-grid');
    grid.className = 'team-inputs-grid cols-' + count;
    grid.innerHTML = '';

    if (count === 1) {
      // اللاعب + AI
      const inp = document.createElement('input');
      inp.className = 'team-input';
      inp.id = 'inp-t0';
      inp.type = 'text';
      inp.maxLength = 20;
      inp.placeholder = '🔵 ' + DEFAULT_NAMES[0];
      inp.style.borderColor = COLORS_HEX[0];
      grid.appendChild(inp);

      const ai = document.createElement('input');
      ai.className = 'team-input ai-field';
      ai.id = 'inp-t1';
      ai.type = 'text';
      ai.value = 'عقل الأرقم 🤖';
      ai.readOnly = true;
      ai.style.borderColor = COLORS_HEX[1];
      grid.appendChild(ai);
    } else {
      for (let i = 0; i < count; i++) {
        const inp = document.createElement('input');
        inp.className = 'team-input';
        inp.id = 'inp-t' + i;
        inp.type = 'text';
        inp.maxLength = 20;
        inp.placeholder = TEAM_EMOJIS[i] + ' ' + DEFAULT_NAMES[i];
        inp.style.borderColor = COLORS_HEX[i];
        grid.appendChild(inp);
      }
    }
  }

  // ─────────────────────────────────────────────
  // خلط الإجابات في كل سؤال (التعديل ٥)
  // ─────────────────────────────────────────────
  function shuffleQuestionChoices(question) {
    const choicesWithFlag = question.c.map((choice, index) => ({
      text: choice,
      isCorrect: index === question.a
    }));
    for (let i = choicesWithFlag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choicesWithFlag[i], choicesWithFlag[j]] = [choicesWithFlag[j], choicesWithFlag[i]];
    }
    return {
      ...question,
      c: choicesWithFlag.map(c => c.text),
      a: choicesWithFlag.findIndex(c => c.isCorrect)
    };
  }

  // ─────────────────────────────────────────────
  // توزيع الأسئلة حسب المواد
  // ─────────────────────────────────────────────
  function buildQuestionPool(subj, grade, level, total) {
    const allSubjects = ['math','arabic','english','science','social','islamic'];

    // إذا اختار مادة محددة
    if (subj) {
      const pool = (ALL_QUESTIONS[subj] || []).filter(q =>
        q.grade === grade && q.level === level && !usedQuestionIds.has(qId(q, subj))
      );
      return shuffle([...pool]).slice(0, total);
    }

    // توزيع على المواد
    const perSubject = getDistribution(total);
    let result = [];

    allSubjects.forEach((s, i) => {
      const need = perSubject[i] || 0;
      if (need === 0) return;
      const pool = (ALL_QUESTIONS[s] || []).filter(q =>
        q.grade === grade && q.level === level && !usedQuestionIds.has(qId(q, s))
      );
      result = result.concat(shuffle([...pool]).slice(0, need));
    });

    return shuffle(result);
  }

  function qId(q, subj) {
    return subj + '|' + q.q.slice(0, 20);
  }

  // توزيع الأسئلة حسب العدد
  function getDistribution(total) {
    const s = 6; // عدد المواد
    if (total === 5)  return [1, 1, 1, 1, 1, 0];   // ٥ مواد عشوائية
    if (total === 7)  return [1, 1, 1, 1, 1, 1, 1].slice(0, s).map((v,i) => i < 6 ? 1 : 0).concat([1]).slice(0,s);
    if (total === 10) return [2, 2, 2, 2, 1, 1];    // ١٠ = ٢ لكل مادة
    if (total === 15) return [3, 3, 2, 2, 3, 2];    // ١٥ = ٢-٣ لكل مادة
    // افتراضي
    const base = Math.floor(total / s);
    const extra = total % s;
    return Array.from({length: s}, (_, i) => base + (i < extra ? 1 : 0));
  }

  // ─────────────────────────────────────────────
  // بدء اللعبة
  // ─────────────────────────────────────────────
  function startGame() {
    // قراءة الأسماء
    teams = [];
    const realCount = teamCount === 1 ? 2 : teamCount;
    hasAI = teamCount === 1;

    for (let i = 0; i < realCount; i++) {
      const inp = $('inp-t' + i);
      if (!inp) { teams.push(DEFAULT_NAMES[i]); continue; }
      if (inp.readOnly) { teams.push(inp.value); continue; }
      teams.push(inp.value.trim() || DEFAULT_NAMES[i]);
    }

    // قراءة الصف والمستوى
    const gradeBtn = document.querySelector('[data-g].sel-grade');
    const levelSel = document.querySelector('[data-l].sel-easy, [data-l].sel-medium, [data-l].sel-hard');

    if (!gradeBtn) { alert('اختر الصف أولاً!'); return; }
    if (!levelSel) { alert('اختر المستوى أولاً!'); return; }

    selectedGrade = parseInt(gradeBtn.getAttribute('data-g'));
    selectedLevel = levelSel.getAttribute('data-l');

    // دقة AI
    aiAccuracy = selectedLevel === 'easy' ? 0.60 : selectedLevel === 'medium' ? 0.75 : 0.85;

    // بناء الأسئلة
    usedQuestionIds.clear();
    const pool = buildQuestionPool(selectedSubj, selectedGrade, selectedLevel, TOTAL * realCount);

    if (pool.length === 0) {
      alert('لا توجد أسئلة لهذا الاختيار. جرّب صفاً أو مستوى آخر.');
      return;
    }

    questions = pool.slice(0, Math.min(TOTAL * realCount, pool.length));
    pool.forEach((q, i) => usedQuestionIds.add(qId(q, selectedSubj || 'mix' + i)));

    qIndex   = 0;
    scores   = Array(realCount).fill(0);
    current  = 0;
    isSteal  = false;
    isTiebreaker   = false;
    tiebreakerTeams = [];

    buildGameUI(realCount);
    showScreen('game');
    loadQuestion();
  }

  // ─────────────────────────────────────────────
  // بناء واجهة اللعب حسب عدد الفرق
  // ─────────────────────────────────────────────
  function buildGameUI(count) {
    const bar2   = $('score-bar-2');
    const barM   = $('score-bar-multi');
    const rope   = $('rope-wrap');

    if (count === 2) {
      bar2.style.display = 'flex';
      barM.style.display = 'none';
      rope.style.display = 'flex';
      // أسماء
      $('t1-name-lbl').textContent = teams[0];
      $('t2-name-lbl').textContent = teams[1];
      $('t1-pts').textContent = toAr(0);
      $('t2-pts').textContent = toAr(0);
      $('rope-t1-label').textContent = teams[0];
      $('rope-t2-label').textContent = teams[1];
      updateRope();
    } else {
      bar2.style.display = 'none';
      rope.style.display = 'none';
      barM.style.display = 'flex';
      barM.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const varName = getComputedStyle(document.documentElement).getPropertyValue(TEAM_COLORS[i]).trim();
        const card = document.createElement('div');
        card.className = 'ts-card';
        card.id = 'ts-card-' + i;
        card.style.borderColor = COLORS_HEX[i];
        card.innerHTML = `<div class="ts-name">${TEAM_EMOJIS[i]} ${teams[i]}</div>
                          <div class="ts-pts" id="ts-pts-${i}" style="color:${COLORS_HEX[i]}">${toAr(0)}</div>`;
        barM.appendChild(card);
      }
    }
  }

  // ─────────────────────────────────────────────
  // تحميل سؤال
  // ─────────────────────────────────────────────
  function loadQuestion() {
    const totalQ = isTiebreaker ? tiebreakerTeams.length * 2 : questions.length;
    if (!isTiebreaker && qIndex >= questions.length) {
      checkTiebreaker();
      return;
    }

    answered  = false;
    isSteal   = false;

    let q;
    if (isTiebreaker) {
      // سؤال جديد لجولة الحسم
      const pool = buildQuestionPool(selectedSubj, selectedGrade, selectedLevel, 4);
      q = pool.length > 0 ? pool[0] : questions[0];
    } else {
      q = questions[qIndex];
    }

    // خلط الإجابات (التعديل ٥)
    q = shuffleQuestionChoices(q);

    // حفظ السؤال المعدّل على المؤشر الحالي
    if (!isTiebreaker) questions[qIndex] = q;

    const total  = isTiebreaker ? '?' : toAr(questions.length);
    const cur    = isTiebreaker ? '?' : toAr(qIndex + 1);
    const pct    = isTiebreaker ? 0 : ((qIndex) / questions.length) * 100;

    $('progress-fill').style.width = pct + '%';
    $('progress-label').textContent = `السؤال ${cur} من ${total}`;
    $('q-counter').textContent = `${cur} / ${total}`;
    $('q-text').textContent = q.q;
    $('steal-banner').style.display   = 'none';
    $('tiebreaker-badge').style.display = isTiebreaker ? 'block' : 'none';
    $('ai-thinking').style.display = 'none';

    const letters = ['أ','ب','ج','د'];
    for (let i = 0; i < 4; i++) {
      const btn = $('ch' + i);
      btn.className = 'ch-btn';
      btn.disabled  = false;
      $('ct' + i).textContent = q.c[i];
      btn.querySelector('.ch-letter').textContent = letters[i];
    }

    updateTurnBar();
    timerMax = isSteal ? 15 : 30;
    startTimer(timerMax);

    // إذا دور AI
    if (hasAI && current === 1) {
      disableAllChoices();
      $('ai-thinking').style.display = 'block';
      const delay = 1000 + Math.random() * 1000;
      setTimeout(() => doAiAnswer(q), delay);
    }
  }

  // ─────────────────────────────────────────────
  // AI يجيب
  // ─────────────────────────────────────────────
  function doAiAnswer(q) {
    if (answered) return;
    $('ai-thinking').style.display = 'none';
    enableAllChoices();

    const correct = q.a;
    if (Math.random() < aiAccuracy) {
      pick(correct);
    } else {
      const wrong = [0,1,2,3].filter(i => i !== correct);
      pick(wrong[Math.floor(Math.random() * wrong.length)]);
    }
  }

  function disableAllChoices() {
    document.querySelectorAll('.ch-btn').forEach(b => b.disabled = true);
  }
  function enableAllChoices() {
    document.querySelectorAll('.ch-btn').forEach(b => b.disabled = false);
  }

  // ─────────────────────────────────────────────
  // شريط الدور
  // ─────────────────────────────────────────────
  function updateTurnBar() {
    const bar  = $('turn-bar');
    const name = teams[current];
    const cls  = 't' + (current + 1);
    bar.className = 'turn-bar ' + cls;
    bar.textContent = `دور ${name} ${TEAM_EMOJIS[current]}`;

    // إبراز بطاقة الفريق
    document.querySelectorAll('.ts-card').forEach((c, i) => {
      c.classList.toggle('active-team', i === current);
    });

    // شريط الفريق الثاني في وضع ٢ فريق
    if (teams.length === 2) {
      const ts1 = $('t1-name-lbl') ? $('t1-name-lbl').parentElement : null;
      const ts2 = $('t2-name-lbl') ? $('t2-name-lbl').parentElement : null;
      if (ts1) ts1.style.opacity = current === 0 ? '1' : '0.45';
      if (ts2) ts2.style.opacity = current === 1 ? '1' : '0.45';
    }
  }

  // ─────────────────────────────────────────────
  // المؤقت
  // ─────────────────────────────────────────────
  function startTimer(seconds = 30) {
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
      timeLeft > Math.ceil(timerMax * .5)  ? '#00b09b' :
      timeLeft > Math.ceil(timerMax * .23) ? '#fdcb6e' : '#d63031';
  }

  function onTimeOut() {
    if (answered) return;
    answered = true;
    revealCorrect();
    if (!isSteal) {
      activateSteal();
    } else {
      setTimeout(nextQuestion, 1800);
    }
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
      updateScoreDisplay();
      showFeedback('✅');
      if (isTiebreaker) {
        tiebreakerWinner = current;
        setTimeout(endGame, 1500);
      } else {
        setTimeout(nextQuestion, 1500);
      }
    } else {
      $('ch' + idx).classList.add('wrong');
      revealCorrect();
      showFeedback('❌');
      if (isTiebreaker) {
        // أخطأ في الحسم — السؤال التالي لباقي المتنافسين
        setTimeout(() => nextTiebreakerTurn(), 1800);
      } else if (!isSteal) {
        activateSteal();
      } else {
        setTimeout(nextQuestion, 1800);
      }
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
    current  = current === 0 ? 1 : 0;

    // للفرق ٣+: الفريق التالي يستطيع الاختطاف
    if (teams.length > 2) {
      current = (current + 1) % teams.length;
    }

    updateTurnBar();
    const banner = $('steal-banner');
    banner.textContent = `⚡ فرصة الاختطاف — ${teams[current]}!`;
    banner.style.display = 'block';

    document.querySelectorAll('.ch-btn').forEach(btn => {
      if (!btn.classList.contains('wrong')) btn.disabled = false;
    });

    startTimer(15);

    if (hasAI && current === 1) {
      disableAllChoices();
      $('ai-thinking').style.display = 'block';
      const q = questions[qIndex];
      setTimeout(() => doAiAnswer(q), 1000 + Math.random() * 800);
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

  // ─────────────────────────────────────────────
  // حبل الشد
  // ─────────────────────────────────────────────
  function updateRope() {
    const total = scores[0] + scores[1];
    const pct   = total === 0 ? 50 : Math.round((scores[0] / total) * 100);
    $('rope-seg1').style.width = pct + '%';
    $('rope-seg2').style.width = (100 - pct) + '%';
    $('rope-knot').style.left  = pct + '%';
  }

  // ─────────────────────────────────────────────
  // جولة الحسم (Tiebreaker)
  // ─────────────────────────────────────────────
  function checkTiebreaker() {
    const max = Math.max(...scores);
    tiebreakerTeams = scores.map((s, i) => ({ i, s }))
                            .filter(t => t.s === max)
                            .map(t => t.i);

    if (tiebreakerTeams.length > 1) {
      isTiebreaker = true;
      tiebreakerIdx = 0;
      current = tiebreakerTeams[0];
      // سؤال حسم جديد
      const pool = buildTiebreakerPool();
      if (pool.length === 0) { endGame(); return; }
      questions = [shuffleQuestionChoices(pool[0])];
      qIndex = 0;
      $('tiebreaker-badge').style.display = 'block';
      $('tiebreaker-badge').textContent =
        `⚡ جولة فاصلة: ${tiebreakerTeams.map(i => teams[i]).join(' vs ')}`;
      loadTiebreakerRound();
    } else {
      endGame();
    }
  }

  function buildTiebreakerPool() {
    const pool = (selectedSubj ? [selectedSubj] : Object.keys(ALL_QUESTIONS))
      .flatMap(s => (ALL_QUESTIONS[s] || []).filter(q =>
        q.grade === selectedGrade && q.level === selectedLevel
      ));
    return shuffle([...pool]);
  }

  function loadTiebreakerRound() {
    if (tiebreakerIdx >= tiebreakerTeams.length) {
      tiebreakerIdx = 0;
    }
    current = tiebreakerTeams[tiebreakerIdx];
    loadQuestion();
  }

  function nextTiebreakerTurn() {
    tiebreakerIdx++;
    if (tiebreakerIdx >= tiebreakerTeams.length) {
      // لم يجب أحد — سؤال جديد
      tiebreakerIdx = 0;
      const pool = buildTiebreakerPool();
      if (pool.length === 0) { endGame(); return; }
      questions = [shuffleQuestionChoices(pool[0])];
    }
    loadTiebreakerRound();
  }

  // ─────────────────────────────────────────────
  // نهاية اللعبة
  // ─────────────────────────────────────────────
  function endGame() {
    clearInterval(timer);
    showScreen('result');

    const fs = $('final-scores');
    fs.innerHTML = '';

    scores.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'fs-item';
      item.innerHTML = `<div class="fs-name">${TEAM_EMOJIS[i]} ${teams[i]}</div>
                        <div class="fs-num" style="color:${COLORS_HEX[i]}">${toAr(s)}</div>`;
      fs.appendChild(item);
      if (i < scores.length - 1) {
        const sep = document.createElement('div');
        sep.style.cssText = 'display:flex;align-items:center;font-size:1.8rem;';
        sep.textContent = '⚔️';
        fs.appendChild(sep);
      }
    });

    let winnerIdx = -1;
    if (isTiebreaker && tiebreakerWinner >= 0) {
      winnerIdx = tiebreakerWinner;
    } else {
      const max = Math.max(...scores);
      const ties = scores.filter(s => s === max);
      if (ties.length === 1) winnerIdx = scores.indexOf(max);
    }

    let msg;
    if (winnerIdx >= 0) {
      msg = `🏆 فاز ${teams[winnerIdx]}!`;
      spawnConfetti();
    } else {
      msg = '🤝 تعادل! كلا الفريقين رائع!';
    }
    $('winner-txt').textContent = msg;
  }

  // ─────────────────────────────────────────────
  // إعادة الضبط
  // ─────────────────────────────────────────────
  function reset() {
    clearInterval(timer);
    $('confetti-wrap').innerHTML = '';
    isTiebreaker = false;
    tiebreakerTeams = [];
    tiebreakerWinner = -1;
    usedQuestionIds.clear();
    showScreen('setup');
  }

  // ─────────────────────────────────────────────
  // الشاشات
  // ─────────────────────────────────────────────
  function showScreen(name) {
    ['scr-setup','scr-game','scr-result'].forEach(id => {
      $(id).classList.remove('active');
    });
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
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.className = 'cf';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = (2 + Math.random() * 3) + 's';
      el.style.animationDelay    = (Math.random() * 1.5) + 's';
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(el);
    }
  }

  // ─────────────────────────────────────────────
  // خلط Fisher-Yates
  // ─────────────────────────────────────────────
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─────────────────────────────────────────────
  // تشغيل
  // ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return { pick, reset, startGame };
})();
