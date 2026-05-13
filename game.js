const G = (() => {
  // ── حالة اللعبة ──
  let teams     = ['الفريق الأول', 'الفريق الثاني'];
  let scores    = [0, 0];
  let current   = 0;       // الفريق الحالي (0 أو 1)
  let questions = [];      // الأسئلة المختارة للجلسة
  let qIndex    = 0;       // رقم السؤال الحالي
  let TOTAL     = 10;      // عدد الأسئلة لكل مسابقة
  let timer     = null;    // مؤقت الوقت
  let timeLeft  = 30;
  let answered  = false;
  let isSteal   = false;   // هل نحن في وضع الاختطاف؟

  // ── مرجع عناصر DOM ──
  const $  = id => document.getElementById(id);
  const setupScr  = () => $('scr-setup');
  const gameScr   = () => $('scr-game');
  const resultScr = () => $('scr-result');

  // ─────────────────────────────────────────────
  // الإعداد
  // ─────────────────────────────────────────────
  function init() {
    // أزرار المادة
    document.querySelectorAll('.subj-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
      });
    });

    // أزرار الصف
    document.querySelectorAll('[data-g]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-g]').forEach(b => b.classList.remove('sel-grade'));
        btn.classList.add('sel-grade');
      });
    });

    // أزرار المستوى
    document.querySelectorAll('[data-l]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-l]').forEach(b => {
          b.classList.remove('sel-easy', 'sel-medium', 'sel-hard');
        });
        const lv = btn.getAttribute('data-l');
        btn.classList.add('sel-' + lv);
      });
    });

    $('btn-start').addEventListener('click', startGame);
  }

  // ─────────────────────────────────────────────
  // بدء اللعبة
  // ─────────────────────────────────────────────
  function startGame() {
    const t1 = $('inp-t1').value.trim() || 'الفريق الأول';
    const t2 = $('inp-t2').value.trim() || 'الفريق الثاني';
    const subjBtn  = document.querySelector('.subj-btn.sel');
    const gradeBtn = document.querySelector('[data-g].sel-grade');
    const levelBtn = document.querySelector('[data-l]');
    const selLevel = document.querySelector('[data-l].sel-easy, [data-l].sel-medium, [data-l].sel-hard');

    if (!subjBtn)  { alert('اختر مادة أولاً!'); return; }
    if (!gradeBtn) { alert('اختر الصف أولاً!'); return; }
    if (!selLevel) { alert('اختر المستوى أولاً!'); return; }

    const subj  = subjBtn.getAttribute('data-s');
    const grade = parseInt(gradeBtn.getAttribute('data-g'));
    const level = selLevel.getAttribute('data-l');

    // فلترة الأسئلة
    const pool = (ALL_QUESTIONS[subj] || []).filter(q =>
      q.grade === grade && q.level === level
    );

    if (pool.length === 0) {
      alert('لا توجد أسئلة لهذا الاختيار. جرّب صفاً أو مستوى آخر.');
      return;
    }

    // خلط وأخذ 10 (أو أقل إذا لم يوجد)
    questions = shuffle([...pool]).slice(0, TOTAL);
    qIndex    = 0;
    scores    = [0, 0];
    current   = 0;
    teams     = [t1, t2];

    // تحديث أسماء الفرق
    $('t1-name-lbl').textContent = t1;
    $('t2-name-lbl').textContent = t2;
    $('t1-pts').textContent = '0';
    $('t2-pts').textContent = '0';
    $('fs1-name').textContent = t1;
    $('fs2-name').textContent = t2;

    showScreen('game');
    loadQuestion();
  }

  // ─────────────────────────────────────────────
  // تحميل سؤال
  // ─────────────────────────────────────────────
  function loadQuestion() {
    if (qIndex >= questions.length) { endGame(); return; }

    answered  = false;
    isSteal   = false;
    const q   = questions[qIndex];

    $('q-counter').innerHTML  = `سؤال<br>${qIndex + 1} / ${questions.length}`;
    $('q-text').textContent   = q.q;
    $('steal-banner').style.display = 'none';

    const letters = ['أ','ب','ج','د'];
    for (let i = 0; i < 4; i++) {
      const btn = $('ch' + i);
      btn.className = 'ch-btn';
      btn.disabled  = false;
      $('ct' + i).textContent = q.c[i];
      btn.querySelector('.ch-letter').textContent = letters[i];
    }

    updateTurnBar();
    startTimer();
  }

  // ─────────────────────────────────────────────
  // شريط الدور
  // ─────────────────────────────────────────────
  function updateTurnBar() {
    const bar  = $('turn-bar');
    const name = teams[current];
    if (current === 0) {
      bar.className = 'turn-bar t1';
      bar.textContent = `دور ${name} 🔵`;
    } else {
      bar.className = 'turn-bar t2';
      bar.textContent = `دور ${name} 🟠`;
    }
    const ts1 = $('t1-name-lbl').parentElement;
    const ts2 = $('t2-name-lbl').parentElement;
    ts1.style.opacity = current === 0 ? '1' : '0.45';
    ts2.style.opacity = current === 1 ? '1' : '0.45';
  }

  // ─────────────────────────────────────────────
  // المؤقت
  // ─────────────────────────────────────────────
  function startTimer(seconds = 30) {
    clearInterval(timer);
    timeLeft = seconds;
    renderTimer();
    timer = setInterval(() => {
      timeLeft--;
      renderTimer();
      if (timeLeft <= 0) {
        clearInterval(timer);
        onTimeOut();
      }
    }, 1000);
  }

  function renderTimer() {
    $('timer-num').textContent  = timeLeft;
    const pct = (timeLeft / 30) * 100;
    $('timer-fill').style.width = pct + '%';
    // لون المؤقت
    if (timeLeft > 15) {
      $('timer-fill').style.backgroundColor = '#00b09b';
    } else if (timeLeft > 7) {
      $('timer-fill').style.backgroundColor = '#fdcb6e';
    } else {
      $('timer-fill').style.backgroundColor = '#d63031';
    }
  }

  function onTimeOut() {
    if (answered) return;
    answered = true;
    revealCorrect();
    if (!isSteal) {
      // فرصة الاختطاف
      activateSteal();
    } else {
      // انتهت الفرصة
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

    const q = questions[qIndex];
    const correct = q.a;
    const btns = document.querySelectorAll('.ch-btn');
    btns.forEach(b => b.disabled = true);

    if (idx === correct) {
      $('ch' + idx).classList.add('correct');
      scores[current]++;
      updateScoreDisplay();
      showFeedback('✅');
      setTimeout(nextQuestion, 1500);
    } else {
      $('ch' + idx).classList.add('wrong');
      revealCorrect();
      showFeedback('❌');
      if (!isSteal) {
        activateSteal();
      } else {
        setTimeout(nextQuestion, 1800);
      }
    }
  }

  function revealCorrect() {
    const correct = questions[qIndex].a;
    $('ch' + correct).classList.add('reveal');
  }

  // ─────────────────────────────────────────────
  // الاختطاف
  // ─────────────────────────────────────────────
  function activateSteal() {
    isSteal = true;
    answered = false;
    current  = current === 0 ? 1 : 0;
    updateTurnBar();

    const banner = $('steal-banner');
    banner.textContent = `⚡ فرصة الاختطاف — ${teams[current]}!`;
    banner.style.display = 'block';

    // أعِد تفعيل أزرار الإجابة (ما عدا الخاطئة)
    document.querySelectorAll('.ch-btn').forEach((btn, i) => {
      if (!btn.classList.contains('wrong')) {
        btn.disabled = false;
      }
    });

    startTimer(15);
  }

  // ─────────────────────────────────────────────
  // السؤال التالي
  // ─────────────────────────────────────────────
  function nextQuestion() {
    qIndex++;
    // بدّل الدور للسؤال التالي (الدور الأصلي)
    current = qIndex % 2;
    loadQuestion();
  }

  // ─────────────────────────────────────────────
  // تحديث النتائج
  // ─────────────────────────────────────────────
  function updateScoreDisplay() {
    $('t1-pts').textContent = scores[0];
    $('t2-pts').textContent = scores[1];
  }

  // ─────────────────────────────────────────────
  // تأثير التغذية الراجعة
  // ─────────────────────────────────────────────
  function showFeedback(emoji) {
    const el = $('feedback');
    el.textContent = emoji;
    el.classList.remove('show');
    void el.offsetWidth; // force reflow
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1000);
  }

  // ─────────────────────────────────────────────
  // نهاية اللعبة
  // ─────────────────────────────────────────────
  function endGame() {
    clearInterval(timer);
    showScreen('result');

    $('fs1').textContent = scores[0];
    $('fs2').textContent = scores[1];

    let msg;
    if (scores[0] > scores[1]) {
      msg = `🏆 فاز ${teams[0]}!`;
      spawnConfetti();
    } else if (scores[1] > scores[0]) {
      msg = `🏆 فاز ${teams[1]}!`;
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
    showScreen('setup');
  }

  // ─────────────────────────────────────────────
  // الشاشات
  // ─────────────────────────────────────────────
  function showScreen(name) {
    ['scr-setup','scr-game','scr-result'].forEach(id => {
      $( id).classList.remove('active');
    });
    $('scr-' + name).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ─────────────────────────────────────────────
  // كونفيتي احتفالي
  // ─────────────────────────────────────────────
  function spawnConfetti() {
    const colors = ['#ffd700','#4facfe','#f7971e','#00b09b','#fd79a8','#a29bfe'];
    const container = $('confetti-wrap');
    container.innerHTML = '';
    for (let i = 0; i < 60; i++) {
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
  // خلط عشوائي (Fisher-Yates)
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

  // واجهة عامة
  return { pick, reset, startGame };
})();
