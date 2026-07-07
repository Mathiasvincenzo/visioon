// Admin app logic: Roster, Trend Radar, Week Planner, Oversikt.

if (sessionStorage.getItem('visioon_role') !== 'admin') {
  window.location.href = 'index.html';
}

renderLogo('.logo-mount');
document.getElementById('btnLogout').onclick = async () => {
  await sb.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'index.html';
};

// --- Tabs ---
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav.tabs button').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('tab-' + b.dataset.tab).classList.add('active');
  if (b.dataset.tab === 'oversikt') renderOverview();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// --- Roster ---
document.getElementById('btnAddModel').onclick = async () => {
  const name = document.getElementById('mName').value.trim();
  const username = document.getElementById('mEmail').value.trim();
  const password = document.getElementById('mPassword').value;
  if (!name) { alert('Navn er påkrevd'); return; }
  if (!username || !password) { alert('Brukernavn og passord er påkrevd for å opprette pålogging.'); return; }

  const btn = document.getElementById('btnAddModel');
  btn.disabled = true;
  btn.textContent = 'Lagrer...';
  try {
    await Store.addModel({
      username, password,
      display_name: name,
      niche: document.getElementById('mNiche').value.trim(),
      persona: document.getElementById('mPersona').value.trim(),
      platforms: document.getElementById('mPlatforms').value.trim() || 'IG, TikTok',
      comfort: document.getElementById('mComfort').value.trim(),
    });
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lagre modell';
  }
  ['mName', 'mNiche', 'mPersona', 'mPlatforms', 'mComfort', 'mEmail', 'mPassword'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('rosterFormWrap').removeAttribute('open');
  alert(`Modell opprettet! Gi ${name} disse påloggingsdetaljene:\n\nBrukernavn: ${username}\nPassord: ${password}`);
  await renderAll();
};

function modelStat(modelId) {
  const week = Store.getLatestPublishedWeekForModel(modelId);
  if (!week) return { done: 0, total: 0 };
  const tasks = Store.tasksForModelWeek(week.id, modelId);
  return { done: tasks.filter(t => t.status === 'postet').length, total: tasks.length };
}

function renderRoster() {
  const models = Store.listModels();
  const list = document.getElementById('rosterList');
  list.innerHTML = models.length ? models.map(m => {
    const stat = modelStat(m.id);
    return `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3 style="margin:0;">${esc(m.display_name)}</h3>
        <span class="pill ${m.active ? 'active-on' : 'active-off'}" style="cursor:pointer;" data-toggle-active="${m.id}">${m.active ? 'Aktiv' : 'Pauset'}</span>
      </div>
      <div class="row" style="margin:8px 0;">
        <span class="pill format">${esc(m.niche || 'ingen nisje satt')}</span>
        <span class="pill effort">${esc(m.platforms)}</span>
      </div>
      <div class="muted">${esc(m.persona || 'Ingen persona-notater ennå.')}</div>
      ${m.comfort ? `<div class="muted" style="margin-top:4px;"><b>Komfortabel med:</b> ${esc(m.comfort)}</div>` : ''}
      ${m.username ? `<div class="muted" style="margin-top:4px;">👤 ${esc(m.username)}</div>` : ''}
      <div class="muted" style="margin-top:8px;">${T.roster_stat_tasks(stat.done, stat.total)}</div>
      <div style="margin-top:10px;"><button class="btn small danger" data-remove-model="${m.id}">Fjern</button></div>
    </div>`;
  }).join('') : `<div class="empty card">${T.roster_empty}</div>`;

  list.querySelectorAll('[data-remove-model]').forEach(btn => btn.onclick = async () => {
    if (confirm('Fjerne denne modellen?')) { await Store.removeModel(btn.dataset.removeModel); await renderAll(); }
  });
  list.querySelectorAll('[data-toggle-active]').forEach(el => el.onclick = async () => {
    const m = Store.getModel(el.dataset.toggleActive);
    await Store.updateModel(m.id, { active: !m.active });
    await renderAll();
  });
}

// --- Trends ---
let trendFilter = 'all';
document.querySelectorAll('[data-filter]').forEach(btn => btn.onclick = () => {
  trendFilter = btn.dataset.filter;
  renderTrends();
});

document.getElementById('btnAddTrend').onclick = async () => {
  const name = document.getElementById('tName').value.trim();
  if (!name) { alert('Trendnavn er påkrevd'); return; }
  await Store.addTrend({
    name,
    format: document.getElementById('tFormat').value,
    effort: document.getElementById('tEffort').value,
    why: document.getElementById('tWhy').value.trim(),
  });
  document.getElementById('tName').value = '';
  document.getElementById('tWhy').value = '';
  await renderAll();
};

function renderTrends() {
  const trends = Store.listTrends();
  const shown = trends.filter(t => trendFilter === 'all' || t.status === trendFilter);
  const statusLabel = { ny: 'Ny', testes: 'Testes', bevist: 'Bevist' };
  document.getElementById('trendList').innerHTML = shown.length ? shown.map(t => `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3 style="margin:0;">${esc(t.name)}</h3>
        <span class="pill ${t.status}" style="cursor:pointer;" title="Klikk for å endre status" data-cycle-trend="${t.id}">${statusLabel[t.status]}</span>
      </div>
      <div class="row" style="margin:6px 0;">
        <span class="pill format">${esc(t.format)}</span>
        <span class="pill effort">${esc(t.effort)} innsats</span>
      </div>
      <div class="muted">${esc(t.why)}</div>
      ${t.adapt ? `<div class="muted" style="margin-top:6px;"><b>💡 Tilpasning:</b> ${esc(t.adapt)}</div>` : ''}
      <div style="margin-top:8px;"><button class="btn small danger" data-remove-trend="${t.id}">Fjern</button></div>
    </div>`).join('') : `<div class="empty card">${T.trend_empty}</div>`;

  document.getElementById('trendList').querySelectorAll('[data-cycle-trend]').forEach(el => el.onclick = async () => {
    await Store.cycleTrendStatus(el.dataset.cycleTrend);
    renderTrends();
  });
  document.getElementById('trendList').querySelectorAll('[data-remove-trend]').forEach(el => el.onclick = async () => {
    await Store.removeTrend(el.dataset.removeTrend);
    await renderAll();
  });

  const trendSelect = document.getElementById('pTrend');
  const cur = trendSelect.value;
  trendSelect.innerHTML = '<option value="">— ingen —</option>' + trends.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  trendSelect.value = cur;
}

// --- Week planner ---
const DAYS = T.planner_days;

document.getElementById('btnAddPoolTask').onclick = async () => {
  const title = document.getElementById('pTitle').value.trim();
  if (!title) { alert('Tittel er påkrevd'); return; }
  const draft = await Store.getDraftWeek();
  await Store.addPoolTask(draft.id, {
    title,
    format: document.getElementById('pFormat').value,
    effort: document.getElementById('pEffort').value,
    hook: document.getElementById('pHook').value.trim(),
    execution: document.getElementById('pExec').value.trim(),
    trend_id: document.getElementById('pTrend').value || null,
  });
  ['pTitle', 'pHook', 'pExec'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pTrend').value = '';
  await renderPlanner();
};

document.getElementById('btnPublish').onclick = async () => {
  const draft = await Store.getDraftWeek();
  const assigned = Store.tasksForWeek(draft.id).filter(t => t.model_id);
  if (!assigned.length) { alert('Legg minst én oppgave i uken før du publiserer.'); return; }
  await Store.publishWeek(draft.id);
  alert('Uken er publisert! Modellene ser nå oppgavene sine.');
  await renderPlanner();
};

document.getElementById('btnDuplicate').onclick = async () => {
  await Store.duplicateLastWeek();
  await renderPlanner();
};

function poolTaskChip(t) {
  return `<div class="task-chip" draggable="true" data-task-id="${t.id}">
    <span class="rm" data-remove-task="${t.id}">✕</span>
    <b>${esc(t.title)}</b><br>
    <span class="pill format">${esc(t.format)}</span> <span class="pill effort">${esc(t.effort)}</span>
  </div>`;
}

async function renderPlanner() {
  const draft = await Store.getDraftWeek();
  document.getElementById('focusText').value = draft.focus_text || '';
  document.getElementById('weekLabel').textContent = T.week_label(draft.iso_week);
  document.getElementById('weekStatus').textContent = 'Kladd (upublisert)';

  const models = Store.listModels().filter(m => m.active);
  const poolTasks = Store.tasksForWeek(draft.id).filter(t => !t.model_id);
  document.getElementById('pool').innerHTML = poolTasks.length
    ? poolTasks.map(poolTaskChip).join('')
    : `<div class="empty card" style="flex:1;">${T.planner_pool_empty}</div>`;

  const grid = document.getElementById('plannerGrid');
  let html = `<div></div>` + DAYS.map((d, i) => `<div class="head-cell">${d}<br>${addDays(draft.monday_date, i).slice(5)}</div>`).join('');
  models.forEach(m => {
    html += `<div class="model-cell">${esc(m.display_name)}</div>`;
    DAYS.forEach((d, i) => {
      const dayDate = addDays(draft.monday_date, i);
      const tasks = Store.tasksForWeek(draft.id).filter(t => t.model_id === m.id && t.deadline_date === dayDate);
      html += `<div class="slot" data-model-id="${m.id}" data-day-index="${i}">${tasks.map(poolTaskChip).join('')}</div>`;
    });
  });
  grid.innerHTML = models.length ? html : `<div class="empty card" style="grid-column: 1 / -1;">Legg til modeller i Roster-fanen først.</div>`;

  // drag events for chips
  grid.querySelectorAll('.task-chip, #pool .task-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', chip.dataset.taskId));
  });
  document.querySelectorAll('#pool .task-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', chip.dataset.taskId));
  });

  grid.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', async e => {
      e.preventDefault();
      slot.classList.remove('dragover');
      const taskId = e.dataTransfer.getData('text/plain');
      const dayDate = addDays(draft.monday_date, parseInt(slot.dataset.dayIndex, 10));
      await Store.assignTaskToSlot(taskId, slot.dataset.modelId, dayDate);
      await renderPlanner();
    });
  });

  const poolEl = document.getElementById('pool');
  poolEl.addEventListener('dragover', e => e.preventDefault());
  poolEl.addEventListener('drop', async e => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) { await Store.unassignTask(taskId); await renderPlanner(); }
  });

  document.querySelectorAll('[data-remove-task]').forEach(el => el.onclick = async (e) => {
    e.stopPropagation();
    await Store.removeTask(el.dataset.removeTask);
    await renderPlanner();
  });
}

document.getElementById('focusText').addEventListener('change', async () => {
  const draft = await Store.getDraftWeek();
  await Store.updateWeek(draft.id, { focus_text: document.getElementById('focusText').value.trim() });
});

// --- Overview ---
const STATUS_ORDER_SEVERITY = { overdue: 0, progress: 1, none: 2, ontrack: 3 };
const OVERVIEW_LABEL = { ontrack: 'På sporet', progress: 'Pågår', overdue: 'Henger etter', none: 'Ingen oppgaver' };

function modelWeekStatus(model, week) {
  if (!week) return { status: 'none', done: 0, total: 0, tasks: [] };
  const tasks = Store.tasksForModelWeek(week.id, model.id).sort((a, b) => (a.deadline_date || '').localeCompare(b.deadline_date || ''));
  if (!tasks.length) return { status: 'none', done: 0, total: 0, tasks };
  const done = tasks.filter(t => t.status === 'postet').length;
  let status;
  if (done === tasks.length) status = 'ontrack';
  else if (tasks.some(t => t.status !== 'postet' && t.deadline_date && t.deadline_date < todayISO())) status = 'overdue';
  else status = 'progress';
  return { status, done, total: tasks.length, tasks };
}

function renderOverview() {
  const models = Store.listModels().filter(m => m.active);
  const week = Store.getPublishedWeeksDesc()[0] || null;
  const allTasks = Store.listTasks();
  const unreadCount = allTasks.filter(t => Store.hasUnread(t.id, 'admin')).length;

  const weekTasks = week ? Store.tasksForWeek(week.id) : [];
  const weekDone = weekTasks.filter(t => t.status === 'postet').length;

  document.getElementById('overviewStats').innerHTML = `
    <div class="card stat"><div class="num">${models.length}</div><div class="lbl">Aktive modeller</div></div>
    <div class="card stat"><div class="num">${weekTasks.length}</div><div class="lbl">${week ? T.week_label(week.iso_week) : 'Ingen publisert uke'}</div></div>
    <div class="card stat"><div class="num">${weekDone}</div><div class="lbl">Fullført denne uken</div></div>
    <div class="card stat"><div class="num">${unreadCount}</div><div class="lbl">Uleste kommentarer</div></div>`;

  if (!models.length) {
    document.getElementById('overviewBoard').innerHTML = `<div class="empty card">Legg til modeller i Roster-fanen for å se en oversikt.</div>`;
    return;
  }
  if (!week) {
    document.getElementById('overviewBoard').innerHTML = `<div class="empty card">Ingen uke er publisert ennå — publiser en uke i Ukeplan-fanen for å se status per modell.</div>`;
    return;
  }

  const rows = models
    .map(m => ({ model: m, ...modelWeekStatus(m, week) }))
    .sort((a, b) => STATUS_ORDER_SEVERITY[a.status] - STATUS_ORDER_SEVERITY[b.status]);

  document.getElementById('overviewBoard').innerHTML = rows.map(r => {
    const unread = r.tasks.some(t => Store.hasUnread(t.id, 'admin'));
    return `
    <div class="card">
      <div class="overview-row" data-toggle-detail="${r.model.id}">
        <span class="name">${esc(r.model.display_name)}</span>
        <span class="pill status-${r.status}">${OVERVIEW_LABEL[r.status]}</span>
        <span class="muted">${r.done}/${r.total} oppgaver</span>
        ${unread ? `<span class="badge-unread">•</span>` : ''}
        <span class="spacer"></span>
        <span class="muted">▾</span>
      </div>
      <div class="overview-detail" id="overview-detail-${r.model.id}">
        ${r.tasks.length ? r.tasks.map(overviewTaskRowHtml).join('') : `<div class="muted">Ingen oppgaver denne uken.</div>`}
      </div>
    </div>`;
  }).join('');

  rows.forEach(r => {
    const row = document.querySelector(`[data-toggle-detail="${r.model.id}"]`);
    const detail = document.getElementById(`overview-detail-${r.model.id}`);
    row.onclick = async () => {
      const open = detail.classList.toggle('open');
      if (open) {
        const hadUnread = r.tasks.some(t => Store.hasUnread(t.id, 'admin'));
        for (const t of r.tasks) await Store.markRead(t.id, 'admin');
        renderOverviewComments(r.tasks);
        if (hadUnread) {
          const dot = row.querySelector('.badge-unread');
          if (dot) dot.remove();
          updateUnreadStat();
        }
      }
    };
    r.tasks.forEach(t => wireOverviewTaskComments(t.id));
  });
}

function updateUnreadStat() {
  const unreadCount = Store.listTasks().filter(t => Store.hasUnread(t.id, 'admin')).length;
  const statEl = document.querySelector('#overviewStats .stat:last-child .num');
  if (statEl) statEl.textContent = unreadCount;
}

function overviewTaskRowHtml(t) {
  return `
    <div class="overview-task-row">
      <span class="title">${esc(t.title)}</span>
      <span class="pill format">${esc(t.format)}</span>
      <span class="pill deadline">${t.deadline_date || ''}</span>
      <span class="muted">Status: ${STATUS_LABEL_ADMIN[t.status]}</span>
      ${t.status === 'postet' && t.posted_url ? `<a href="${esc(t.posted_url)}" target="_blank" class="muted">🔗 innlegg</a>` : ''}
      <button class="btn ghost small" data-toggle-overview-comments="${t.id}">Kommentarer (${Store.listComments(t.id).length})</button>
      <div class="comments" id="overview-comments-${t.id}" style="display:none; width:100%;"></div>
    </div>`;
}

const STATUS_LABEL_ADMIN = { ny: 'Ny', planlagt: 'Planlagt', filmet: 'Filmet', postet: 'Postet' };

function wireOverviewTaskComments(taskId) {
  const btn = document.querySelector(`[data-toggle-overview-comments="${taskId}"]`);
  if (!btn) return;
  btn.onclick = async (e) => {
    e.stopPropagation();
    const panel = document.getElementById(`overview-comments-${taskId}`);
    const open = panel.style.display !== 'none';
    if (open) { panel.style.display = 'none'; return; }
    await Store.markRead(taskId, 'admin');
    renderOverviewCommentThread(taskId);
    panel.style.display = 'block';
  };
}

function renderOverviewCommentThread(taskId) {
  const panel = document.getElementById(`overview-comments-${taskId}`);
  const comments = Store.listComments(taskId);
  panel.innerHTML = `
    ${comments.map(c => `
      <div class="comment">
        <span class="author">${c.author === 'admin' ? 'Deg' : 'Modell'}</span><br>
        ${esc(c.body)}
      </div>`).join('')}
    <div class="row" style="margin-top:8px;">
      <input type="text" placeholder="Skriv en kommentar..." id="overviewCommentInput-${taskId}" style="flex:1;" onclick="event.stopPropagation()">
      <button class="btn small" data-send-overview-comment="${taskId}">Send</button>
    </div>`;
  panel.querySelector(`[data-send-overview-comment="${taskId}"]`).onclick = async (e) => {
    e.stopPropagation();
    const input = document.getElementById(`overviewCommentInput-${taskId}`);
    const body = input.value.trim();
    if (!body) return;
    await Store.addComment(taskId, 'admin', body);
    input.value = '';
    renderOverviewCommentThread(taskId);
  };
}

function renderOverviewComments(tasks) {
  tasks.forEach(t => {
    const panel = document.getElementById(`overview-comments-${t.id}`);
    if (panel && panel.style.display !== 'none') renderOverviewCommentThread(t.id);
  });
}

// --- Idea Engine ---
function renderIdeaModelSelect() {
  const sel = document.getElementById('ideaModel');
  const cur = sel.value;
  const models = Store.listModels().filter(m => m.active);
  sel.innerHTML = models.length
    ? models.map(m => `<option value="${m.id}">${esc(m.display_name)} — ${esc(m.niche || 'ingen nisje')}</option>`).join('')
    : '<option value="">Ingen modeller ennå</option>';
  if (cur) sel.value = cur;
}

function ideaCardHtml(idea, i) {
  return `
  <div class="card">
    <label class="row" style="align-items:flex-start; cursor:pointer;">
      <input type="checkbox" class="idea-check" data-idea-index="${i}" checked style="width:auto; margin-top:4px;">
      <div style="flex:1;">
        <h3 style="margin:0 0 6px;">${esc(idea.title)}</h3>
        <div class="row" style="margin-bottom:6px;">
          <span class="pill format">${esc(idea.format)}</span>
          <span class="pill effort">${esc(idea.effort)}</span>
        </div>
        ${idea.hook ? `<div class="hook" style="background:#faf7f5; border-radius:8px; padding:8px 10px; font-size:13px; margin:6px 0;">🪝 ${esc(idea.hook)}</div>` : ''}
        ${idea.execution ? `<div class="muted">${esc(idea.execution)}</div>` : ''}
      </div>
    </label>
  </div>`;
}

let lastGeneratedIdeas = [];
let lastGeneratedModel = null;

document.getElementById('btnGenerateIdeas').onclick = async () => {
  const modelId = document.getElementById('ideaModel').value;
  const model = Store.getModel(modelId);
  const errEl = document.getElementById('ideaError');
  errEl.style.display = 'none';
  if (!model) { errEl.textContent = 'Legg til en modell i Roster-fanen først.'; errEl.style.display = 'block'; return; }

  const batchType = document.getElementById('ideaBatchType').value;
  const extra = document.getElementById('ideaExtra').value.trim();
  const btn = document.getElementById('btnGenerateIdeas');
  btn.disabled = true;
  btn.textContent = '⏳ Genererer...';
  document.getElementById('ideaResults').innerHTML = '';
  document.getElementById('ideaActions').style.display = 'none';

  try {
    lastGeneratedModel = model;
    lastGeneratedIdeas = await Store.generateIdeas(model, batchType, extra);
    document.getElementById('ideaResults').innerHTML = lastGeneratedIdeas.map(ideaCardHtml).join('');
    document.getElementById('ideaActions').style.display = lastGeneratedIdeas.length ? 'block' : 'none';
    document.getElementById('btnAddSelectedIdeas').textContent = `Legg valgte idéer i ${model.display_name}s ukeplan`;
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Generer idéer';
  }
};

document.getElementById('btnAddSelectedIdeas').onclick = async () => {
  const checked = Array.from(document.querySelectorAll('.idea-check:checked')).map(c => lastGeneratedIdeas[parseInt(c.dataset.ideaIndex, 10)]);
  if (!checked.length || !lastGeneratedModel) return;
  const btn = document.getElementById('btnAddSelectedIdeas');
  btn.disabled = true;
  btn.textContent = 'Legger til...';
  const draft = await Store.getDraftWeek();
  for (let i = 0; i < checked.length; i++) {
    const idea = checked[i];
    await Store.addPoolTask(draft.id, {
      title: idea.title, hook: idea.hook || '', execution: idea.execution || '',
      format: idea.format || 'Reel', effort: idea.effort || 'Lav',
      model_id: lastGeneratedModel.id,
      deadline_date: addDays(draft.monday_date, i % 7),
    });
  }
  btn.disabled = false;
  btn.textContent = `Legg valgte idéer i ${lastGeneratedModel.display_name}s ukeplan`;
  document.getElementById('ideaResults').innerHTML = '';
  document.getElementById('ideaActions').style.display = 'none';
  alert(`${checked.length} idé(er) lagt rett i ${lastGeneratedModel.display_name}s ukeplan. Husk å trykke Publiser uke i Ukeplan-fanen når du er klar.`);
  await renderPlanner();
};

async function renderAll() {
  renderRoster();
  renderTrends();
  renderIdeaModelSelect();
  await renderPlanner();
  renderOverview();
}

(async () => {
  await Store.init();
  await renderAll();
})();
