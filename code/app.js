/* ============================================================
   学习通 · 答题页（纯前端 Demo，无后端）
   ------------------------------------------------------------
   流程：设置页（题数 / 总分 / 时长）→ 答题页 → 交卷结果页
   - 题目全部为本地 mock，按题量循环取用
   - 选项选中逻辑与样式见 quizPage.jpg：整卡点击、只变颜色
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. Mock 题库
  // ----------------------------------------------------------
  const POOL = [
    {
      text: 'The manager requested that all employees ______ the safety training before the end of the month.',
      options: ['complete', 'completes', 'completed', 'completing'],
      answer: 0
    },
    {
      // quizPage.jpg 中的那道题
      text: 'The new library ______ on the site of the former parking lot last year.',
      options: ['was built', 'built', 'was collapsed', 'collapsed'],
      answer: 0
    },
    {
      // questions.jpg 原题
      text: 'This study was conducted to test the ______ that exposure to urban air pollution contributes to the development of chronic lung diseases.',
      options: ['hypothesis', 'provokes', 'transmit', 'yield'],
      answer: 0
    },
    {
      text: "Ms. Chen's proposal was ______ received by the board of directors.",
      options: ['positive', 'positively', 'positivity', 'positiveness'],
      answer: 1
    },
    {
      text: 'If the shipment ______ by Friday, we will have to postpone the product launch.',
      options: ['does not arrive', 'will not arrive', 'has not arrived', 'did not arrive'],
      answer: 0
    },
    {
      text: 'The revised policy applies to ______ employees working in overseas branches.',
      options: ['all', 'every', 'each', 'much'],
      answer: 0
    },
    {
      text: 'Please make sure that all equipment is ______ before you leave the laboratory.',
      options: ['turn off', 'turned off', 'turning off', 'to turn off'],
      answer: 1
    },
    {
      text: 'Our sales for the third quarter were ______ higher than we had expected.',
      options: ['significance', 'significant', 'significantly', 'signify'],
      answer: 2
    },
    {
      text: 'The company is looking for a candidate ______ has experience in supply chain management.',
      options: ['who', 'whom', 'which', 'whose'],
      answer: 0
    },
    {
      text: 'All visitors are required to ______ at the reception desk upon arrival.',
      options: ['sign in', 'sign up', 'sign off', 'sign out'],
      answer: 0
    },
    {
      text: 'The report must be submitted ______ 5 p.m. on Friday.',
      options: ['until', 'by', 'since', 'for'],
      answer: 1
    },
    {
      text: 'Despite the heavy rain, the outdoor event ______ as scheduled.',
      options: ['went ahead', 'went off', 'went over', 'went through'],
      answer: 0
    }
  ];

  const KEYS = ['A', 'B', 'C', 'D'];

  // 设置页默认值
  const DEFAULTS = { count: 50, score: 50.0, minutes: 60 };
  const LIMITS = {
    count: [1, 100],
    score: [1, 1000],
    minutes: [1, 300]
  };

  // ----------------------------------------------------------
  // 2. 状态
  // ----------------------------------------------------------
  const state = {
    userName: '',                   // 考生姓名
    userId: '',                     // 学号
    total: DEFAULTS.count,          // 题量
    totalScore: DEFAULTS.score,     // 总分
    minutes: DEFAULTS.minutes,      // 考试时长（分钟）
    questions: [],
    index: 0,                       // 0-based
    answers: new Map(),             // questionNo → optionIndex
    seconds: DEFAULTS.minutes * 60, // 剩余秒数
    startedAt: null,                // 开考时间（领取时间）
    submittedAt: null,              // 交卷时间
    running: false,                 // 是否在答题中
    finished: false                 // 是否已交卷
  };

  // ----------------------------------------------------------
  // 3. DOM
  // ----------------------------------------------------------
  const $ = function (id) { return document.getElementById(id); };

  const el = {
    timer: $('timer'),
    counter: $('counter'),
    fill: $('progressFill'),
    sectionTitle: $('sectionTitle'),
    progress: document.querySelector('.ib-progress'),
    stem: $('stem'),
    options: $('options'),
    prev: $('btnPrev'),
    next: $('btnNext'),
    back: $('btnBack'),
    content: $('content'),
    sheetMask: $('sheetMask'),
    sheetGrid: $('sheetGrid'),
    sheetClose: $('sheetClose'),
    cardEntry: $('btnAnswerCard'),
    toast: $('toast'),

    // 设置页
    viewSetup: $('viewSetup'),
    setupNow: $('setupNow'),
    setupBack: $('btnSetupBack'),
    inpName: $('inpName'),
    inpId: $('inpId'),
    inpCount: $('inpCount'),
    inpScore: $('inpScore'),
    inpTime: $('inpTime'),
    btnStart: $('btnStart'),

    // 答题页 / 结果页
    navTitle: $('navTitle'),
    watermark: document.querySelector('.watermark'),
    viewQuiz: $('viewQuiz'),
    viewFinish: $('viewFinish'),
    finishCard: $('finishCard'),
    finishNow: $('finishNow'),
    finishBack: $('btnFinishBack'),
    feedback: $('btnFeedback'),

    // 全屏守卫
    fullscreenLock: $('fullscreenLock'),
    restoreFullscreen: $('btnRestoreFullscreen')
  };

  // ----------------------------------------------------------
  // 4. 工具
  // ----------------------------------------------------------
  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function requestFullscreen() {
    const target = document.documentElement;
    const request = target.requestFullscreen || target.webkitRequestFullscreen;
    if (!request) return Promise.reject(new Error('fullscreen-not-supported'));
    try {
      const result = request.call(target);
      return result && typeof result.then === 'function' ? result : Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!fullscreenElement() || !exit) return Promise.resolve();
    try {
      const result = exit.call(document);
      return result && typeof result.then === 'function' ? result : Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function syncFullscreenLock() {
    const mustLock = state.running && el.viewQuiz && !el.viewQuiz.hidden && !fullscreenElement();
    el.fullscreenLock.hidden = !mustLock;
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmtDate(d, withSeconds) {
    const ymd = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    return withSeconds ? ymd + ' ' + hm + ':' + pad2(d.getSeconds()) : ymd + ' ' + hm;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function xmlEsc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // 水印按考生信息动态生成（同一张平铺片，只换文字）
  function renderWatermark(name, id) {
    const one = name || '';
    const two = id || '';
    if (!one && !two) {
      el.watermark.style.backgroundImage = 'none';
      return;
    }
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="242" height="236.33" viewBox="0 0 242 236.33">' +
        '<g transform="translate(85.2 75.9) rotate(-21.5)" fill="#000000" fill-opacity="0.068" ' +
          'font-family="Helvetica,Arial,sans-serif" font-size="18" text-anchor="middle">' +
          '<text y="-5.75">' + xmlEsc(one) + '</text>' +
          '<text y="17.75">' + xmlEsc(two) + '</text>' +
        '</g>' +
      '</svg>';
    el.watermark.style.backgroundImage =
      'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  // 按题量循环取题，每题分值 = 总分 / 题数
  function buildQuestions(count, totalScore) {
    const per = (totalScore / count).toFixed(1);
    return Array.from({ length: count }, function (_, i) {
      const src = POOL[i % POOL.length];
      return {
        no: i + 1,
        score: per,
        text: src.text,
        options: src.options.slice(),
        answer: src.answer
      };
    });
  }

  // ----------------------------------------------------------
  // 5. 答题页渲染
  // ----------------------------------------------------------
  function render() {
    const q = state.questions[state.index];
    if (!q) return;

    el.counter.textContent = (state.index + 1) + '/' + state.total;
    el.progress.setAttribute('aria-valuenow', String(state.index + 1));
    el.fill.style.width = (((state.index + 1) / state.total) * 100).toFixed(2) + '%';

    el.sectionTitle.textContent =
      '单选题 （共' + state.total + '题，' + state.totalScore.toFixed(1) + '分）';

    // 题干：「the ______」绑成一行；下划线换成固定宽度 .blank
    const stemText = escapeHtml(q.text)
      .replace(/ (\S+) _{3,}/g, ' <span class="nw">$1&nbsp;<span class="blank"></span></span>')
      .replace(/_{3,}/g, '<span class="blank"></span>');
    el.stem.innerHTML =
      '<span class="stem__head">' +
        '<span class="stem__no">' + q.no + '.</span>' +
        '<span class="stem__score">（' + q.score + '分）</span>' +
      '</span> ' +
      stemText;

    const selected = state.answers.get(q.no);
    el.options.innerHTML = q.options.map(function (text, i) {
      const isSel = selected === i;
      return (
        '<li>' +
          '<button type="button" class="option' + (isSel ? ' is-selected' : '') + '"' +
            ' role="radio" aria-checked="' + (isSel ? 'true' : 'false') + '"' +
            ' data-index="' + i + '">' +
            '<span class="option__key">' + KEYS[i] + '</span>' +
            '<span class="option__text">' + escapeHtml(text) + '</span>' +
          '</button>' +
        '</li>'
      );
    }).join('');

    el.prev.disabled = state.index === 0;
    el.next.textContent = state.index === state.total - 1 ? '交卷' : '下一题';

    el.content.scrollTop = 0;
  }

  // ----------------------------------------------------------
  // 6. 答题交互
  // ----------------------------------------------------------
  el.options.addEventListener('click', function (e) {
    const btn = e.target.closest('.option');
    if (!btn) return;

    const q = state.questions[state.index];
    const pick = Number(btn.dataset.index);
    const current = state.answers.get(q.no);

    if (current === pick) {
      state.answers.delete(q.no);
    } else {
      state.answers.set(q.no, pick);
    }
    render();
  });

  function goTo(index) {
    if (index < 0 || index >= state.total) return;
    state.index = index;
    render();
  }

  el.prev.addEventListener('click', function () { goTo(state.index - 1); });
  el.next.addEventListener('click', function () {
    if (state.index === state.total - 1) {
      submit();
    } else {
      goTo(state.index + 1);
    }
  });

  el.back.addEventListener('click', function () {
    showToast('返回（Demo 中仅提示）');
  });

  document.addEventListener('keydown', function (e) {
    if (el.viewQuiz.hidden) return;
    if (e.key === 'ArrowLeft') { goTo(state.index - 1); }
    if (e.key === 'ArrowRight') { goTo(state.index + 1); }
    if (e.key === 'Escape') { closeSheet(); }
  });

  // ----------------------------------------------------------
  // 7. 答题卡面板
  // ----------------------------------------------------------
  function openSheet() {
    renderSheet();
    el.sheetMask.hidden = false;
  }
  function closeSheet() {
    el.sheetMask.hidden = true;
  }
  function renderSheet() {
    el.sheetGrid.innerHTML = state.questions.map(function (q, i) {
      const done = state.answers.has(q.no);
      const now = i === state.index;
      const cls = 'sheet__cell' + (now ? ' is-now' : done ? ' is-done' : '');
      return '<button type="button" class="' + cls + '" data-goto="' + i + '">' + q.no + '</button>';
    }).join('');
  }

  el.cardEntry.addEventListener('click', openSheet);
  el.sheetClose.addEventListener('click', closeSheet);
  el.sheetMask.addEventListener('click', function (e) {
    if (e.target === el.sheetMask) closeSheet();
  });
  el.sheetGrid.addEventListener('click', function (e) {
    const cell = e.target.closest('[data-goto]');
    if (!cell) return;
    goTo(Number(cell.dataset.goto));
    closeSheet();
  });

  // ----------------------------------------------------------
  // 8. 设置页
  // ----------------------------------------------------------
  function readSetup() {
    const name = el.inpName.value.trim();
    const id = el.inpId.value.trim();
    if (!name || !id) {
      showToast('请填写姓名和学号');
      (name ? el.inpId : el.inpName).focus();
      return null;
    }

    const count = clamp(parseInt(el.inpCount.value, 10) || DEFAULTS.count, LIMITS.count[0], LIMITS.count[1]);
    let score = parseFloat(el.inpScore.value);
    if (!isFinite(score)) score = DEFAULTS.score;
    score = Math.round(clamp(score, LIMITS.score[0], LIMITS.score[1]) * 10) / 10;
    const minutes = clamp(parseInt(el.inpTime.value, 10) || DEFAULTS.minutes, LIMITS.minutes[0], LIMITS.minutes[1]);

    // 回写规范化后的值
    el.inpCount.value = String(count);
    el.inpScore.value = score.toFixed(1);
    el.inpTime.value = String(minutes);

    return { name: name, id: id, count: count, score: score, minutes: minutes };
  }

  function startExam(cfg) {
    state.userName = cfg.name;
    state.userId = cfg.id;
    state.total = cfg.count;
    state.totalScore = cfg.score;
    state.minutes = cfg.minutes;
    state.questions = buildQuestions(cfg.count, cfg.score);
    state.index = 0;
    state.answers.clear();
    state.seconds = cfg.minutes * 60;
    state.startedAt = new Date();
    state.submittedAt = null;
    state.running = true;
    state.finished = false;

    el.navTitle.textContent = cfg.name + ' (' + cfg.id + ')';
    renderWatermark(cfg.name, cfg.id);

    el.viewSetup.hidden = true;
    el.viewFinish.hidden = true;
    el.viewQuiz.hidden = false;

    renderTimer();
    render();
    if (window.__examCam) window.__examCam.start();
  }

  el.btnStart.addEventListener('click', async function () {
    const cfg = readSetup();
    if (!cfg) return;

    try {
      if (!fullscreenElement()) await requestFullscreen();
      startExam(cfg);
      syncFullscreenLock();
    } catch (err) {
      showToast('请允许全屏后再开始答题');
    }
  });

  el.restoreFullscreen.addEventListener('click', async function () {
    try {
      await requestFullscreen();
      syncFullscreenLock();
    } catch (err) {
      showToast('浏览器未允许进入全屏');
    }
  });

  document.addEventListener('fullscreenchange', syncFullscreenLock);
  document.addEventListener('webkitfullscreenchange', syncFullscreenLock);

  // 输入姓名 / 学号时，水印实时跟着变
  function syncWatermark() {
    renderWatermark(el.inpName.value.trim(), el.inpId.value.trim());
  }
  el.inpName.addEventListener('input', syncWatermark);
  el.inpId.addEventListener('input', syncWatermark);

  el.setupBack.addEventListener('click', function () {
    showToast('返回（Demo 中仅提示）');
  });

  function updateSetupClock() {
    el.setupNow.textContent = fmtDate(new Date(), true);
  }

  // ----------------------------------------------------------
  // 9. 交卷 / 结果页
  // ----------------------------------------------------------
  function submit() {
    if (state.finished || !state.running) return;
    state.submittedAt = new Date();
    state.finished = true;
    state.running = false;
    closeSheet();
    if (window.__examCam) window.__examCam.stop();
    renderFinish();
    el.viewQuiz.hidden = true;
    el.viewFinish.hidden = false;
  }

  function renderFinish() {
    const used = Math.max(1, Math.round((state.submittedAt - state.startedAt) / 60000));
    const rows = [
      ['姓名', state.userName],
      ['学号', state.userId],
      ['领取时间', fmtDate(state.startedAt, false)],
      ['提交时间', fmtDate(state.submittedAt, false)],
      ['考试用时', used + ' 分钟'],
      ['提交方式', '学生交卷']
    ];
    el.finishCard.innerHTML = rows.map(function (r) {
      return '<div class="fcard__row">' +
               '<span class="fcard__k">' + r[0] + '：</span>' +
               '<span class="fcard__v">' + r[1] + '</span>' +
             '</div>';
    }).join('');
    tickFinishClock();
  }

  function tickFinishClock() {
    el.finishNow.textContent = fmtDate(new Date(), true);
  }

  // 结果页返回 → 回到设置页，可以重新配置再开考
  function backToSetup() {
    state.running = false;
    state.finished = false;
    el.viewFinish.hidden = true;
    el.viewQuiz.hidden = true;
    el.viewSetup.hidden = false;
    if (window.__examCam) window.__examCam.stop();
    el.fullscreenLock.hidden = true;
    exitFullscreen().catch(function () {});
    updateSetupClock();
    renderWatermark('', '');
  }

  el.finishBack.addEventListener('click', backToSetup);
  el.feedback.addEventListener('click', function () {
    showToast('反馈（Demo 中仅提示）');
  });

  // ----------------------------------------------------------
  // 10. 计时器
  // ----------------------------------------------------------
  function renderTimer() {
    const m = Math.floor(state.seconds / 60);
    const s = state.seconds % 60;
    el.timer.textContent = pad2(m) + "' " + pad2(s) + '"';
  }

  setInterval(function () {
    if (!el.viewSetup.hidden) { updateSetupClock(); return; }
    if (state.finished) { tickFinishClock(); return; }
    if (!state.running) return;
    if (state.seconds > 0) {
      state.seconds -= 1;
      renderTimer();
      if (state.seconds === 0) submit();     // 时间到自动交卷
    }
  }, 1000);

  // ----------------------------------------------------------
  // 11. Toast
  // ----------------------------------------------------------
  let toastTimer = null;
  function showToast(text) {
    el.toast.textContent = text;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1800);
  }

  // ----------------------------------------------------------
  // 12. 启动
  // ----------------------------------------------------------
  updateSetupClock();
  renderWatermark('', '');

  // 桌面端：窗口不够高时等比缩放手机外框
  (function fitFrame() {
    const phone = document.querySelector('.phone');
    function update() {
      if (window.innerWidth <= 520) { phone.style.transform = ''; return; }
      const s = Math.min(1, (window.innerHeight - 40) / 917, (window.innerWidth - 40) / 420);
      phone.style.transform = s < 1 ? 'scale(' + s.toFixed(4) + ')' : '';
    }
    update();
    window.addEventListener('resize', update);
  })();
})();


/* ============================================================
   前置摄像头小窗（右上角，可拖动）
   ============================================================ */
(function initCamera() {
  'use strict';

  var cam = document.getElementById('cam');
  var video = document.getElementById('camVideo');
  var tip = document.getElementById('camTip');
  var app = document.getElementById('app');
  if (!cam || !video || !app) return;

  var CAM_W = 96;     // 与 CSS 中的宽高保持一致（竖向 3:4）
  var CAM_H = 128;
  var MARGIN = 4;
  var TOP_MIN = 52;   // 不拖进顶部状态栏留白
  var stream = null;
  var starting = false;

  /* ---------- 摄像头 ---------- */
  function setTip(html) {
    tip.innerHTML = html;
    tip.hidden = false;
    cam.classList.add('is-off');
  }

  function setOn() {
    tip.hidden = true;
    cam.classList.remove('is-off');
  }

  function start() {
    if (starting || stream) return;
    starting = true;
    cam.hidden = false;
    setTip('正在开启…');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setTip('当前环境不支持<br><span style="opacity:.72">需 HTTPS 或 localhost</span>');
      starting = false;
      return;
    }

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }
    }).then(function (s) {
      stream = s;
      video.srcObject = s;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      setOn();
    }).catch(function (err) {
      var name = (err && err.name) || '';
      var msg = '无法开启摄像头<br><span style="opacity:.72">点击重试</span>';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        msg = '摄像头权限被拒绝<br><span style="opacity:.72">点击重试</span>';
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        msg = '未找到前置摄像头';
      } else if (name === 'NotReadableError') {
        msg = '摄像头被占用<br><span style="opacity:.72">点击重试</span>';
      }
      setTip(msg);
    }).then(function () {
      starting = false;
    });
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } });
      stream = null;
    }
    video.srcObject = null;
    cam.hidden = true;
  }

  window.__examCam = { start: start, stop: stop };

  /* ---------- 拖动 ---------- */
  var drag = null;
  var moved = false;

  function appBox() {
    var r = app.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, top: r.top };
  }

  function place(x, y) {
    var r = appBox();
    var maxX = r.w - CAM_W - MARGIN;
    var maxY = r.h - CAM_H - MARGIN;
    cam.style.left = Math.max(MARGIN, Math.min(maxX, x)) + 'px';
    cam.style.top = Math.max(TOP_MIN, Math.min(maxY, y)) + 'px';
    cam.style.right = 'auto';
  }

  cam.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var box = cam.getBoundingClientRect();
    var r = appBox();
    drag = {
      id: e.pointerId,
      dx: e.clientX - box.left,
      dy: e.clientY - box.top,
      x: box.left - r.left,
      y: box.top - r.top
    };
    moved = false;
    cam.classList.add('is-dragging');
    try { cam.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });

  cam.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var r = appBox();
    var nx = e.clientX - r.left - drag.dx;
    var ny = e.clientY - r.top - drag.dy;
    if (Math.abs(nx - drag.x) > 3 || Math.abs(ny - drag.y) > 3) moved = true;
    place(nx, ny);
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    drag = null;
    cam.classList.remove('is-dragging');
    if (!moved && !stream) start();     // 轻点 = 重试
  }
  cam.addEventListener('pointerup', endDrag);
  cam.addEventListener('pointercancel', endDrag);

  cam.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!stream) start();
    }
  });

  window.addEventListener('resize', function () {
    var box = cam.getBoundingClientRect();
    var r = appBox();
    place(box.left - r.left, box.top - r.top);
  });
})();
