function pad2(n) {
  return String(n).padStart(2, '0');
}

function startSakuraRain() {
  const canvas = document.getElementById('sakuraCanvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const colors = [
    'rgba(255, 95, 162, 0.95)',
    'rgba(255, 155, 208, 0.95)',
    'rgba(255, 193, 223, 0.92)',
    'rgba(255, 210, 235, 0.90)'
  ];

  const petals = [];
  let w = 0;
  let h = 0;
  let raf = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createPetal() {
    const size = rand(6, 14);
    const x = rand(0, w);
    const y = rand(-h, 0);
    const vy = rand(0.6, 2.2);
    const vx = rand(-0.6, 0.6);
    return {
      x,
      y,
      vx,
      vy,
      size,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.03, 0.03),
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: rand(0.55, 0.95)
    };
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    // Petal shape: two ellipses + slight highlight.
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;

    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = p.opacity * 0.85;
    ctx.beginPath();
    ctx.ellipse(p.size * 0.22, -p.size * 0.05, p.size * 0.25, p.size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outline (soft) for a more “fine” look.
    ctx.globalAlpha = p.opacity * 0.35;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function tick() {
    raf = window.requestAnimationFrame(tick);

    // Clear with a tiny alpha to keep a gentle trail.
    ctx.clearRect(0, 0, w, h);

    // Draw petals
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      if (p.y - p.size > h) {
        // respawn at top with a new random x
        petals[i] = createPetal();
        continue;
      }

      drawPetal(p);
    }
  }

  resize();

  const count = Math.min(110, Math.max(60, Math.floor((w * h) / 22000)));
  petals.length = 0;
  for (let i = 0; i < count; i++) petals.push(createPetal());

  window.addEventListener('resize', () => {
    resize();
  });

  tick();
}

function toDatetimeLocalValue(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value == null ? '' : String(value);
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function getJson(url) {
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

let pollHandle = null;

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

function setStep(step) {
  const s1 = document.getElementById('step1');
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  if (!s1 || !s2 || !s3) return;

  const show = (el, on) => {
    if (on) el.classList.remove('hidden');
    else el.classList.add('hidden');
  };

  show(s1, step === 1);
  show(s2, step === 2);
  show(s3, step === 3);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateStep1() {
  const toEmail = document.getElementById('toEmail');
  const v = (toEmail?.value || '').trim();
  if (!v) return '请输入未来收信邮箱';
  if (!isValidEmail(v)) return '邮箱格式不正确';
  return null;
}

function validateStep2() {
  const receivedAtLocal = document.getElementById('receivedAtLocal');
  const v = receivedAtLocal?.value || '';
  if (!v) return '请选择收到信的时间';
  // datetime-local 基本格式校验
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return '时间格式不正确';
  return null;
}

function validateStep3() {
  const content = document.getElementById('content');
  const v = (content?.value || '').trim();
  if (!v) return '请输入信件内容';
  if (v.length > 4000) return '信件内容过长（最多 4000 字）';
  return null;
}

async function startOrRefreshPolling(letterId) {
  async function refreshOnce() {
    const data = await getJson(`/api/letters/${encodeURIComponent(letterId)}`);
    setText('letterId', data.id);
    setText('letterStatus', data.status);
    setText('scheduledAtUtc', data.scheduled_at_utc || '-');
    setText('lastError', data.last_error || '-');

    if (data.status !== 'scheduled' && data.status !== 'sending') {
      stopPolling();
    }
  }

  await refreshOnce().catch((err) => {
    setText('lastError', err.message);
  });

  stopPolling();
  pollHandle = setInterval(() => {
    refreshOnce().catch(() => {});
  }, 5000);
}

async function main() {
  const toEmail = document.getElementById('toEmail');
  const receivedAtLocal = document.getElementById('receivedAtLocal');
  const content = document.getElementById('content');
  const charCount = document.getElementById('charCount');
  const submitBtn = document.getElementById('submitBtn');
  const nextBtn1 = document.getElementById('nextBtn1');
  const nextBtn2 = document.getElementById('nextBtn2');
  const backBtn2 = document.getElementById('backBtn2');
  const backBtn3 = document.getElementById('backBtn3');
  const refreshBtn = document.getElementById('refreshBtn');
  const formError = document.getElementById('formError');

  const statusCard = document.getElementById('statusCard');
  function showStatusCard() {
    statusCard.classList.remove('hidden');
  }

  function showFormError(msg) {
    if (!formError) return;
    if (msg) {
      formError.textContent = msg;
      formError.classList.remove('hidden');
    } else {
      formError.textContent = '';
      formError.classList.add('hidden');
    }
  }

  // Step mode UI
  setStep(1);
  showFormError(null);

  // Default to "now + 1 minute"
  const dt = new Date(Date.now() + 60 * 1000);
  receivedAtLocal.value = toDatetimeLocalValue(dt);

  function updateCharCount() {
    const v = content.value || '';
    if (charCount) charCount.textContent = `${v.length} / 4000`;
  }

  updateCharCount();
  content.addEventListener('input', updateCharCount);

  function setButtonBusy(btn, on, text) {
    if (!btn) return;
    btn.disabled = !!on;
    if (text) btn.textContent = text;
  }

  nextBtn1?.addEventListener('click', () => {
    const err = validateStep1();
    if (err) {
      showFormError(err);
      return;
    }
    stopPolling();
    showFormError(null);
    setStep(2);
  });

  backBtn2?.addEventListener('click', () => {
    stopPolling();
    setStep(1);
  });

  nextBtn2?.addEventListener('click', () => {
    const err = validateStep2();
    if (err) {
      showFormError(err);
      return;
    }
    stopPolling();
    showFormError(null);
    setStep(3);
  });

  backBtn3?.addEventListener('click', () => {
    stopPolling();
    setStep(2);
  });

  submitBtn.addEventListener('click', async () => {
    const err = validateStep3();
    if (err) {
      showFormError(err);
      return;
    }
    showFormError(null);

    try {
      setButtonBusy(submitBtn, true, '提交中...');

      const payload = {
        toEmail: (toEmail.value || '').trim(),
        receivedAtLocal: receivedAtLocal.value,
        content: content.value
      };

      const created = await postJson('/api/letters', payload);
      showStatusCard();

      setText('letterId', created.id);
      setText('letterStatus', created.status || 'scheduled');
      setText('scheduledAtUtc', '-');
      setText('lastError', '-');

      await startOrRefreshPolling(created.id);
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      showStatusCard();
      setText('lastError', msg);
    } finally {
      setButtonBusy(submitBtn, false, '提交并安排发送');
    }
  });

  refreshBtn.addEventListener('click', async () => {
    const id = document.getElementById('letterId')?.textContent?.trim();
    if (!id) return;
    await startOrRefreshPolling(id);
  });
}

main().catch((err) => {
  console.error(err);
});

// Start background animation without affecting form logic.
startSakuraRain();

