  /* ============================================================
     DATA — Gate definitions
     ============================================================ */
  const GATES = [
    { id:'A1', zone:'A', name:'Gate A1', wait:4,  cap:2100, queue:420,  status:'open'     },
    { id:'A2', zone:'A', name:'Gate A2', wait:18, cap:2100, queue:1760, status:'caution'  },
    { id:'B1', zone:'B', name:'Gate B1', wait:7,  cap:1800, queue:680,  status:'open'     },
    { id:'B2', zone:'B', name:'Gate B2', wait:5,  cap:1800, queue:410,  status:'open'     },
    { id:'C1', zone:'C', name:'Gate C1', wait:13, cap:2400, queue:1240, status:'caution'  },
    { id:'C2', zone:'C', name:'Gate C2', wait:22, cap:2400, queue:2050, status:'critical' },
    { id:'D1', zone:'D', name:'Gate D1', wait:19, cap:2100, queue:1952, status:'critical' },
    { id:'D2', zone:'D', name:'Gate D2', wait:6,  cap:1500, queue:520,  status:'open'     },
  ];

  const STATUS_ICONS = { open:'🟢', caution:'🟡', critical:'🔴' };
  const STATUS_LABELS = {
    EN: { open:'OPEN', caution:'CAUTION', critical:'HIGH LOAD' },
    ES: { open:'ABIERTO', caution:'PRECAUCIÓN', critical:'ALTA CARGA' },
    HI: { open:'खुला', caution:'सावधान', critical:'उच्च लोड' },
  };

  const I18N = {
    EN: { help:'🚨 I NEED HELP', confirm:'✓ CONFIRM', escalate:'? ESCALATE', confirmed:'Action Logged', confirmedSub:'Action has been recorded and transmitted to the Ops Console.', queue:'Queue', wait:'Wait', connected:'Connected · Last update: 1s ago', verb:'REDIRECT', text:'Fans → Gate B1 and B2', reason:'Gate D1 queue exceeding 95% capacity. Forecast: full in 4 min.', aiLabel:'AI-generated recommendation', source:'⚡ Operations AI', action:'Redirect → Gate B1 & B2', urgency:'⚠ HIGH' },
    ES: { help:'🚨 NECESITO AYUDA', confirm:'✓ CONFIRMAR', escalate:'? ESCALAR', confirmed:'Acción Registrada', confirmedSub:'La acción ha sido registrada y enviada a la Consola de Operaciones.', queue:'Fila', wait:'Espera', connected:'Conectado · Última actualización: hace 1s', verb:'REDIRIGIR', text:'Fans → Puerta B1 y B2', reason:'Cola de Puerta D1 supera el 95% de capacidad. Pronóstico: llena en 4 min.', aiLabel:'Recomendación generada por IA', source:'⚡ IA de Operaciones', action:'Redirigir → Puerta B1 y B2', urgency:'⚠ URGENTE' },
    HI: { help:'🚨 मुझे सहायता चाहिए', confirm:'✓ पुष्टि करें', escalate:'? एस्केलेट', confirmed:'कार्रवाई लॉग की', confirmedSub:'कार्रवाई ऑप्स कंसोल को रिकॉर्ड और प्रेषित की गई है।', queue:'कतार', wait:'प्रतीक्षा', connected:'कनेक्टेड · अंतिम अपडेट: 1 सेकंड पहले', verb:'पुनर्निर्देशित करें', text:'प्रशंसक → गेट B1 और B2', reason:'गेट D1 की कतार 95% क्षमता से अधिक है। अनुमान: 4 मिनट में पूर्ण।', aiLabel:'AI-जनित अनुशंसा', source:'⚡ ऑपरेशंस AI', action:'पुनर्निर्देशित करें → गेट B1 और B2', urgency:'⚠ उच्च' },
  };

  let currentLang = 'EN';
  let selectedGate = null;
  let replayRunning = false;
  let replayInterval = null;
  let replayPos = 0;
  let autoReturnTimer = null;

  /* ============================================================
     CLOCK
     ============================================================ */
  function updateClock() {
    const now = new Date();
    const t = now.toTimeString().slice(0,8);
    const el = document.getElementById('ops-clock');
    if (el) el.textContent = t;
    const incT = document.getElementById('inc-time-1');
    if (incT) incT.textContent = now.toTimeString().slice(0,5);
  }
  setInterval(() => requestAnimationFrame(updateClock), 1000);
  requestAnimationFrame(updateClock);

  /* ============================================================
     GATE LIST — render
     ============================================================ */
  function renderGateList() {
    const container = document.getElementById('gate-list-container');
    if (!container) return;
    container.innerHTML = '';
    GATES.forEach(g => {
      const div = document.createElement('div');
      div.className = `gate-card status-${g.status}${selectedGate === g.id ? ' selected' : ''}`;
      div.id = `gate-card-${g.id}`;
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', `${g.name}, ${g.status}, ${g.wait} minute wait`);
      div.setAttribute('tabindex', '0');
      const waitStr = String(g.wait).padStart(2, '0') + ':00';
      const trendText = g.status === 'critical' ? '↑ 42%' : (g.status === 'open' ? '↓ 2%' : '→ 0%');
      const trendClass = g.status === 'critical' ? 'up' : (g.status === 'open' ? 'down' : 'stable');
      const perc = Math.min(100, Math.round((g.wait / 30) * 100));
      div.innerHTML = `
        <div class="gate-card-header">
          <span class="gate-card-id">${g.name}</span>
          <span class="gate-trend ${trendClass}">${trendText}</span>
        </div>
        <div class="gate-card-meta">Zone ${g.zone} · ${g.queue.toLocaleString()} fans</div>
        <div class="gate-wait"><span id="wait-${g.id}">${waitStr}</span> <span class="unit">MIN</span></div>
        <div class="gate-progress-bg">
          <div class="gate-progress-fill" id="wait-prog-${g.id}" style="width: ${perc}%"></div>
        </div>`;
      div.onclick = () => selectGate(g.id);
      div.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') selectGate(g.id); };
      container.appendChild(div);
    });
  }

  function renderSidebar(id) {
    const container = document.getElementById('ops-sidebar-container');
    if (!container) return;
    if (!id) {
      container.innerHTML = `<div style="padding: 24px; color: #94a3b8; text-align: center; font-size: 12px; text-transform: uppercase;">Select a gate to view details</div>`;
      return;
    }
    const g = GATES.find(x => x.id === id);
    if (!g) return;
    
    const waitMins = String(g.wait).padStart(2, '0');
    const badgeHtml = g.status === 'critical' ? `<span class="ops-sidebar-badge critical">CRITICAL</span>` : (g.status === 'open' ? `<span class="ops-sidebar-badge open">NORMAL</span>` : `<span class="ops-sidebar-badge caution">CAUTION</span>`);
    const valClass = g.status === 'critical' ? 'ops-metric-val error' : 'ops-metric-val';
    
    container.innerHTML = `
      <div class="ops-sidebar-header">
        <h2 class="ops-sidebar-title">${g.name} DETAILS</h2>
        ${badgeHtml}
      </div>
      <div class="ops-sidebar-content">
        <div id="action-toast" class="action-toast"></div>
        <!-- Metrics Grid -->
        <div class="ops-metrics-grid">
          <div class="ops-metric-box">
            <div class="ops-metric-label">Wait Time</div>
            <div class="${valClass}">${waitMins}<span>m</span> 00<span>s</span></div>
          </div>
          <div class="ops-metric-box">
            <div class="ops-metric-label">Queue Count</div>
            <div class="${valClass}">${g.queue.toLocaleString()}</div>
          </div>
          <div class="ops-metric-box">
            <div class="ops-metric-label">Flow Rate</div>
            <div class="ops-metric-val">42<span>/min</span></div>
          </div>
          <div class="ops-metric-box">
            <div class="ops-metric-label">Systems</div>
            <div class="ops-metric-val" style="color:#00b8d4; font-size:14px;">● ACTIVE</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="ops-action-grid">
          <button class="ops-btn" onclick="quickAction('open')">Unlock Gate</button>
          <button class="ops-btn danger" onclick="quickAction('incident')">Emergency</button>
          <button class="ops-btn secondary" onclick="quickAction('staff')">Deploy Staff</button>
          <button class="ops-btn secondary" onclick="quickAction('nudge')">Push Nudge</button>
        </div>

        <!-- System Health -->
        <div>
          <div class="ops-health-header">
            <span class="ops-health-title">Operations Health</span>
          </div>
          <div class="ops-health-item">
            <div class="ops-health-row"><span class="label">Core Engine</span><span class="val">99.8%</span></div>
            <div class="gate-progress-bg" style="margin-top:0"><div class="gate-progress-fill" style="background:#00b8d4; width:99.8%"></div></div>
          </div>
          <div class="ops-health-item">
            <div class="ops-health-row"><span class="label">Crowd Prediction</span><span class="val amber">84.2%</span></div>
            <div class="gate-progress-bg" style="margin-top:0"><div class="gate-progress-fill" style="background:#f59e0b; width:84.2%"></div></div>
          </div>
          <div class="ops-health-item">
            <div class="ops-health-row"><span class="label">Network Latency</span><span class="val">12ms</span></div>
            <div class="gate-progress-bg" style="margin-top:0"><div class="gate-progress-fill" style="background:#00b8d4; width:12%"></div></div>
          </div>
        </div>

        <!-- Commissioner's Brief -->
        <div class="ops-brief">
          <div class="ops-brief-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b8d4" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            COMMISSIONER'S BRIEF
          </div>
          <div class="ops-brief-text">${g.name} hardware sync in progress. Expected throughput normalization prior to Match Half-Time.</div>
        </div>
      </div>
    `;
  }

  function selectGate(id) {
    selectedGate = id;
    renderGateList();
    renderSidebar(id);
    const g = GATES.find(x => x.id === id);
    showToast(`Gate ${id} selected — press 1–4 for quick actions`, false);
  }

  renderSidebar(selectedGate);

  renderGateList();

  /* ============================================================
     LIVE DATA SIMULATION
     ============================================================ */
  function fluctuate(val, min, max, delta) {
    const change = (Math.random() * delta * 2) - delta;
    return Math.min(max, Math.max(min, Math.round(val + change)));
  }

  function updateStatuses() {
    requestAnimationFrame(() => {
    GATES.forEach(g => {
      const prev = g.wait;
      g.wait = fluctuate(g.wait, 2, 28, 1.2);
      g.queue = fluctuate(g.queue, 100, g.cap, 40);
      // Recompute status
      if (g.wait <= 8) g.status = 'open';
      else if (g.wait <= 16) g.status = 'caution';
      else g.status = 'critical';
      // Update gate card if it exists
      const waitEl = document.getElementById(`wait-${g.id}`);
      if (waitEl) {
        waitEl.textContent = String(g.wait).padStart(2, '0') + ':00';
      }
      const waitProg = document.getElementById(`wait-prog-${g.id}`);
      if (waitProg) {
        const perc = Math.min(100, Math.round((g.wait / 30) * 100));
        waitProg.style.width = perc + '%';
      }
      if (g.wait !== prev) {
        const card = document.getElementById(`gate-card-${g.id}`);
        if (card) {
          card.className = `gate-card status-${g.status}${selectedGate===g.id?' selected':''}`;
          card.classList.add('flashing');
          setTimeout(() => card.classList.remove('flashing'), 600);
        }
      }
      // Update heatmap labels
      const hmEl = document.getElementById(`hm-wait-${g.id}`);
      const hmIdEl = document.getElementById(`hm-id-${g.id}`);
      if (hmEl) {
        hmEl.textContent = `${g.wait}m`;
      }
      let cFill, cText;
      if (g.status === 'open') { cFill = '#22c55e'; cText = '#15803d'; }
      else if (g.status === 'caution') { cFill = '#f59e0b'; cText = '#b45309'; }
      else { cFill = '#ef4444'; cText = '#b91c1c'; }

      if (hmEl) hmEl.setAttribute('fill', cText);
      if (hmIdEl) hmIdEl.setAttribute('fill', cText);

      const circle = document.querySelector(`#gate-marker-${g.id} circle`);
      if (circle) {
        circle.setAttribute('fill', cFill);
        circle.removeAttribute('stroke');
      }
    });
    // Update route wait time on fan screen 2
    const gC = GATES.find(x=>x.id==='C1');
    if (gC) {
      const el1 = document.getElementById('route-wait-val');
      const el2 = document.getElementById('route-queue-val');
      const el3 = document.getElementById('route-total-val');
      if (el1) el1.textContent = gC.wait + ' min';
      if (el2) el2.textContent = gC.wait + ' min';
      if (el3) el3.textContent = (gC.wait + 3) + ' min';
    }
    // Update health broadcast
    const hb = document.getElementById('h-broadcast');
    if (hb) {
      const t = (Math.random() * 1.8 + 0.3).toFixed(1);
      hb.textContent = `${t}s ago`;
    }
    // Fluctuate API latency
    const api = document.getElementById('h-api');
    const apiBar = document.getElementById('h-api-bar');
    if (api) {
      const ms = fluctuate(142, 90, 280, 15);
      api.textContent = `${ms}ms`;
      api.className = `health-val ${ms > 200 ? 'warn' : 'good'}`;
      if (apiBar) {
        apiBar.style.width = `${Math.min(100, ms / 3)}%`;
        apiBar.className = `health-fill ${ms > 200 ? 'warn' : 'good'}`;
      }
    }
    // Metric drift
    const nudgeEl = document.getElementById('m-nudges');
    if (nudgeEl && Math.random() < 0.3) {
      const v = parseInt(nudgeEl.textContent) + 1;
      nudgeEl.textContent = v;
    }
    });
  }

  setInterval(updateStatuses, 2800);

  /* ============================================================
     QUICK ACTIONS
     ============================================================ */
  const ACTION_MESSAGES = {
    open:     '🔓 Gate opened successfully',
    close:    '🔒 Gate closed',
    staff:    '📢 Staff alert sent',
    nudge:    '📍 Nudge campaign fired — 28 fans targeted',
    incident: '🚨 Incident mode activated',
  };

  function showToast(msg, isAction = true) {
    const toast = document.getElementById('action-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function quickAction(type) {
    const gate = selectedGate || 'A2';
    const msg = ACTION_MESSAGES[type] + (type !== 'incident' ? ` — ${gate}` : '');
    showToast(msg);
    if (type === 'open') {
      const g = GATES.find(x => x.id === gate);
      if (g) { g.wait = Math.max(3, g.wait - 4); g.status = 'open'; renderGateList(); }
    }
  }

  // Keyboard shortcuts 1–4
  document.addEventListener('keydown', e => {
    if (document.getElementById('app-ops').classList.contains('active')) {
      if (e.key === '1') quickAction('open');
      if (e.key === '2') quickAction('close');
      if (e.key === '3') quickAction('staff');
      if (e.key === '4') quickAction('nudge');
    }
  });

  /* ============================================================
     BASELINE REPLAY
     ============================================================ */
  const REPLAY_STEPS = [
    { t: 10, wo_q:'890', wo_w:'8 min', wo_i:'0', wo_t:'—',    wi_q:'890', wi_w:'8 min', wi_i:'0', wi_t:'—'       },
    { t: 25, wo_q:'1,240', wo_w:'12 min', wo_i:'0', wo_t:'—', wi_q:'1,050', wi_w:'9 min', wi_i:'0', wi_t:'—'     },
    { t: 42, wo_q:'1,820', wo_w:'16 min', wo_i:'1', wo_t:'—', wi_q:'1,200', wi_w:'10 min', wi_i:'0', wi_t:'—'    },
    { t: 58, wo_q:'2,340', wo_w:'18 min', wo_i:'2', wo_t:'—', wi_q:'1,480', wi_w:'11 min', wi_i:'0', wi_t:'—'    },
    { t: 72, wo_q:'2,340', wo_w:'18 min', wo_i:'2', wo_t:'54 min', wi_q:'1,680', wi_w:'11 min', wi_i:'0', wi_t:'42 min' },
    { t: 90, wo_q:'2,340', wo_w:'18 min', wo_i:'2', wo_t:'54 min', wi_q:'1,680', wi_w:'11 min', wi_i:'0', wi_t:'42 min' },
  ];

  function applyReplayStep(pct) {
    const pos = Math.round(pct * 90 / 100);
    let step = REPLAY_STEPS[0];
    for (const s of REPLAY_STEPS) { if (pos >= s.t) step = s; }
    document.getElementById('without-fill').style.width = (pct * 0.95) + '%';
    document.getElementById('with-fill').style.width = (pct * 0.75) + '%';
    document.getElementById('without-queue').textContent = step.wo_q;
    document.getElementById('without-wait').textContent = step.wo_w;
    document.getElementById('without-incidents').textContent = step.wo_i;
    document.getElementById('without-time').textContent = step.wo_t;
    document.getElementById('with-queue').textContent = step.wi_q;
    document.getElementById('with-wait').textContent = step.wi_w;
    document.getElementById('with-incidents').textContent = step.wi_i;
    document.getElementById('with-time').textContent = step.wi_t;
    const callout = document.getElementById('callout-box');
    if (callout) callout.style.display = pct >= 70 ? 'block' : 'none';
  }

  function toggleReplay() {
    const btn = document.getElementById('replay-btn');
    const scrubber = document.getElementById('replay-scrubber');
    if (replayRunning) {
      replayRunning = false;
      btn.textContent = '▶ Resume Replay';
      btn.classList.remove('playing');
    } else {
      if (replayPos >= 100) { replayPos = 0; scrubber.value = 0; }
      btn.textContent = '⏸ Pause';
      btn.classList.add('playing');
      scrubber.style.display = 'block';
      replayRunning = true;
      let lastTime = performance.now();
      function loop(now) {
        if (!replayRunning) return;
        const delta = now - lastTime;
        if (delta >= 120) {
          replayPos += 1.1;
          if (replayPos >= 100) { 
            replayPos = 100; 
            replayRunning = false; 
            btn.textContent = '↺ Replay Again'; 
            btn.classList.remove('playing'); 
          }
          scrubber.value = replayPos;
          applyReplayStep(replayPos);
          lastTime = now;
        }
        if (replayRunning) requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
  }

  function scrubReplay(val) {
    replayPos = parseFloat(val);
    requestAnimationFrame(() => applyReplayStep(replayPos));
  }

  /* ============================================================
     AUTHENTICATION & ROUTING
     ============================================================ */
  function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('username').value.toLowerCase();
    const pass = document.getElementById('password').value;
    const err = document.getElementById('login-error');
    
    if (pass !== 'password') {
      err.textContent = 'Invalid credentials. Use password "password".';
      return;
    }
    
    let targetApp = '';
    let roleLabel = '';
    
    if (user.includes('ops')) {
      targetApp = 'ops';
      roleLabel = 'Role: Operations';
    } else if (user.includes('fan')) {
      targetApp = 'fan';
      roleLabel = 'Role: Fan';
    } else if (user.includes('staff')) {
      targetApp = 'staff';
      roleLabel = 'Role: Staff';
    } else {
      err.textContent = 'User not recognized. Try "ops", "fan", or "staff".';
      return;
    }
    
    err.textContent = '';
    document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`app-${targetApp}`).classList.add('active');
    
    // Show top nav elements when logged in
    document.getElementById('auth-nav').style.display = 'flex';
    document.getElementById('nav-user-role').textContent = roleLabel;
  }

  function logout() {
    document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('app-login').classList.add('active');
    document.getElementById('auth-nav').style.display = 'none';
    document.getElementById('login-form').reset();
  }

  /* ============================================================
     FAN FLOW — navigation
     ============================================================ */
  let currentFanScreen = 1;

  function goFanScreen(n) {
    // Deactivate all screens
    for (let i = 1; i <= 4; i++) {
      const s = document.getElementById(`fan-s${i}`);
      if (s) s.classList.remove('factive', 'exit-left');
    }
    // Activate target
    const target = document.getElementById(`fan-s${n}`);
    if (target) {
      setTimeout(() => target.classList.add('factive'), 30);
    }
    currentFanScreen = n;
    // Update right-panel steps
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`fs-${i}`);
      if (step) step.classList.toggle('factive', i === n);
      const stepNum = step && step.querySelector('.step-num');
      if (stepNum) stepNum.style.background = i <= n ? '' : '';
    }
  }

  /* ============================================================
     FEEDBACK
     ============================================================ */
  function selectThumb(which) {
    document.getElementById('thumb-up').classList.toggle('tactive', which === 'up');
    document.getElementById('thumb-down').classList.toggle('tactive', which === 'down');
    document.getElementById('thumb-up').setAttribute('aria-pressed', which === 'up');
    document.getElementById('thumb-down').setAttribute('aria-pressed', which === 'down');
  }

  function submitFeedback() {
    const wait = document.getElementById('wait-slider').value;
    const routeClear = document.getElementById('thumb-up').classList.contains('tactive');
    // Would POST to /api/feedback in production
    alert(`✅ Feedback submitted!\nActual wait: ${wait} min\nRoute clear: ${routeClear ? 'Yes' : 'No'}\n\nThank you — this improves future forecasts!`);
    goFanScreen(1);
  }

  /* ============================================================
     STAFF APP — navigation & i18n
     ============================================================ */
  function goStaffScreen(n) {
    for (let i = 1; i <= 3; i++) {
      const s = document.getElementById(`staff-s${i}`);
      if (s) s.classList.remove('sactive');
      const step = document.getElementById(`ss-${i}`);
      if (step) step.classList.toggle('sactive', i === n);
    }
    const target = document.getElementById(`staff-s${n}`);
    if (target) {
      setTimeout(() => target.classList.add('sactive'), 20);
    }
    if (n === 3) startAutoReturn();
  }

  function switchLang(lang) {
    currentLang = lang;
    ['en','es','hi'].forEach(l => {
      const btn = document.getElementById(`lang-${l}`);
      if (btn) {
        btn.classList.toggle('lactive', l.toUpperCase() === lang);
        btn.setAttribute('aria-pressed', l.toUpperCase() === lang);
      }
    });
    applyI18n(lang);
  }

  function applyI18n(lang) {
    const t = I18N[lang];
    if (!t) return;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    const g = GATES.find(x => x.id === 'D1');
    const statusKey = g ? g.status : 'critical';
    set('staff-status-word', STATUS_LABELS[lang][statusKey]);
    set('staff-help-text', t.help.replace('🚨 ',''));
    document.getElementById('staff-help-btn').firstChild.textContent = '🚨 ';
    set('staff-queue-key', t.queue);
    set('staff-wait-key', t.wait);
    set('staff-conn-label', t.connected);
    set('inst-verb', t.verb);
    set('inst-text', t.text);
    set('inst-reason', t.reason);
    set('inst-ai-label', t.aiLabel);
    set('inst-source', t.source);
    set('inst-urgency', t.urgency);
    set('staff-confirm-text', t.confirm);
    set('staff-escalate-text', t.escalate);
    set('confirmed-title', t.confirmed);
    set('confirmed-sub', t.confirmedSub);
    set('receipt-action', t.action);
    const rtime = document.getElementById('receipt-time');
    if (rtime) rtime.textContent = new Date().toTimeString().slice(0,8);
    const itime = document.getElementById('inst-time');
    if (itime) itime.textContent = new Date().toTimeString().slice(0,8);
  }

  /* ============================================================
     STAFF AUTO-RETURN
     ============================================================ */
  let autoReturnRaf = null;
  function startAutoReturn() {
    cancelAnimationFrame(autoReturnRaf);
    const fill = document.getElementById('auto-return-fill');
    const label = document.getElementById('auto-return-label');
    const start = performance.now();
    const duration = 5000;
    function tick(now) {
      const elapsed = now - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      if (fill) fill.style.width = pct + '%';
      const remaining = Math.max(0, Math.ceil((duration - Math.max(0, elapsed)) / 1000));
      if (label) label.textContent = `Auto-returning in ${remaining} second${remaining !== 1 ? 's' : ''}…`;
      if (pct >= 100) {
        goStaffScreen(1);
        applyI18n(currentLang);
      } else {
        autoReturnRaf = requestAnimationFrame(tick);
      }
    }
    autoReturnRaf = requestAnimationFrame(tick);
  }

  /* ============================================================
     STAFF LIVE UPDATE SIMULATION
     ============================================================ */
  setInterval(() => {
    requestAnimationFrame(() => {
      const g = GATES.find(x => x.id === 'D1');
      if (!g) return;
      const qEl = document.getElementById('staff-queue-val');
      const wEl = document.getElementById('staff-wait-val');
      if (qEl) qEl.textContent = g.queue.toLocaleString();
      if (wEl) wEl.textContent = g.wait + ' min';
      // Status circle
      const circle = document.getElementById('staff-status-circle');
      const emoji = document.getElementById('staff-status-emoji');
      const word = document.getElementById('staff-status-word');
      if (circle && emoji && word) {
        circle.className = `status-circle s-${g.status === 'open' ? 'open' : g.status === 'caution' ? 'caution' : 'critical'}`;
        emoji.textContent = STATUS_ICONS[g.status];
        word.textContent = STATUS_LABELS[currentLang][g.status];
      }
    });
  }, 3000);

  /* initial i18n apply */
  applyI18n('EN');