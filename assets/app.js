// Model dashboard logic.

let MODEL_ID, model;

renderLogo('.logo-mount');
document.getElementById('btnLogout').onclick = async () => {
  await sb.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'index.html';
};

document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav.tabs button').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('tab-' + b.dataset.tab).classList.add('active');
  if (b.dataset.tab === 'historikk') renderHistory();
});

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return T.greeting_morning(model.display_name);
  if (h < 18) return T.greeting_afternoon(model.display_name);
  return T.greeting_evening(model.display_name);
}

const DAYS = T.planner_days;
function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return `${DAYS[idx]} ${dateStr.slice(5)}`;
}

const STATUS_ORDER = ['ny', 'planlagt', 'filmet', 'postet'];
const STATUS_LABEL = { ny: T.status_ny, planlagt: T.status_planlagt, filmet: T.status_filmet, postet: T.status_postet };

function currentWeek() {
  return Store.getLatestPublishedWeekForModel(MODEL_ID);
}

function renderDashboard() {
  document.getElementById('greeting').textContent = greetingText();
  document.getElementById('weekHeader').textContent = T.week_tasks_header;

  const week = currentWeek();
  const taskList = document.getElementById('taskList');
  const focusBanner = document.getElementById('focusBanner');

  if (!week) {
    document.getElementById('weekLabel').textContent = '';
    document.getElementById('progressLabel').textContent = '';
    document.getElementById('progressFill').style.width = '0%';
    focusBanner.style.display = 'none';
    taskList.innerHTML = `<div class="empty card">${T.empty_week}</div>`;
    return;
  }

  const tasks = Store.tasksForModelWeek(week.id, MODEL_ID).sort((a, b) => (a.deadline_date || '').localeCompare(b.deadline_date || ''));
  const done = tasks.filter(t => t.status === 'postet').length;

  document.getElementById('weekLabel').textContent = T.week_label(week.iso_week);
  document.getElementById('progressLabel').textContent = T.progress(done, tasks.length);
  document.getElementById('progressFill').style.width = tasks.length ? `${Math.round(done / tasks.length * 100)}%` : '0%';

  if (week.focus_text) {
    focusBanner.style.display = 'block';
    focusBanner.textContent = `📌 ${week.focus_text}`;
  } else {
    focusBanner.style.display = 'none';
  }

  taskList.innerHTML = tasks.length ? tasks.map(taskCardHtml).join('') : `<div class="empty card">${T.empty_week}</div>`;
  tasks.forEach(wireTaskCard);
}

function taskCardHtml(t) {
  const unread = Store.hasUnread(t.id, 'model');
  return `
  <div class="card task-card" data-task-id="${t.id}">
    <div class="head">
      <h3>${esc(t.title)}</h3>
      <span class="pill deadline">${dayLabel(t.deadline_date)}</span>
    </div>
    <div class="row">
      <span class="pill format">${esc(t.format)}</span>
      <span class="pill effort">${esc(t.effort)}</span>
    </div>
    ${t.hook ? `<div class="hook">🪝 ${esc(t.hook)}</div>` : ''}
    ${t.execution ? `<div class="exec">${esc(t.execution)}</div>` : ''}

    <div class="stepper" data-stepper="${t.id}">
      ${STATUS_ORDER.map(s => `<button data-status="${s}" class="${t.status === s ? 'current' : STATUS_ORDER.indexOf(t.status) > STATUS_ORDER.indexOf(s) ? 'done' : ''}">${STATUS_LABEL[s]}</button>`).join('')}
    </div>

    ${t.status === 'postet' ? `
      <div style="margin-top:8px;">
        <a href="${esc(t.posted_url)}" target="_blank" class="muted">🔗 ${esc(t.posted_url)}</a>
        ${t.proof_image_url ? `<div style="margin-top:6px;"><img src="${t.proof_image_url}" style="max-width:100%; border-radius:8px;"></div>` : ''}
      </div>` : ''}

    <div style="margin-top:10px;">
      <button class="btn ghost small" data-toggle-comments="${t.id}">
        ${T.task_comments_title} (${Store.listComments(t.id).length})${unread ? `<span class="badge-unread">•</span>` : ''}
      </button>
      <div class="comments" id="comments-${t.id}" style="display:none;"></div>
    </div>
  </div>`;
}

function wireTaskCard(t) {
  const card = document.querySelector(`[data-task-id="${t.id}"]`);

  card.querySelectorAll(`[data-stepper="${t.id}"] button`).forEach(btn => {
    btn.onclick = async () => {
      const newStatus = btn.dataset.status;
      if (newStatus === 'postet') {
        const url = prompt(T.mark_posted_prompt, t.posted_url || 'https://');
        if (!url) return;
        await Store.updateTask(t.id, { status: 'postet', posted_url: url });
        renderDashboard();
        return;
      }
      await Store.updateTask(t.id, { status: newStatus });
      renderDashboard();
    };
  });

  const toggleBtn = card.querySelector(`[data-toggle-comments="${t.id}"]`);
  const panel = card.querySelector(`#comments-${t.id}`);
  toggleBtn.onclick = async () => {
    const open = panel.style.display !== 'none';
    if (open) { panel.style.display = 'none'; return; }
    await Store.markRead(t.id, 'model');
    renderComments(t.id);
    panel.style.display = 'block';
  };
}

function renderComments(taskId) {
  const panel = document.getElementById(`comments-${taskId}`);
  const comments = Store.listComments(taskId);
  panel.innerHTML = `
    ${comments.map(c => `
      <div class="comment">
        <span class="author">${c.author === 'admin' ? 'Admin' : 'Deg'}</span><br>
        ${esc(c.body)}
      </div>`).join('')}
    <div class="row" style="margin-top:8px;">
      <input type="text" placeholder="${T.task_comment_placeholder}" id="commentInput-${taskId}" style="flex:1;">
      <button class="btn small" data-send-comment="${taskId}">${T.task_comment_send}</button>
    </div>`;
  panel.querySelector(`[data-send-comment="${taskId}"]`).onclick = async () => {
    const input = document.getElementById(`commentInput-${taskId}`);
    const body = input.value.trim();
    if (!body) return;
    await Store.addComment(taskId, 'model', body);
    input.value = '';
    renderComments(taskId);
  };
}

// --- Historikk ---
function renderHistory() {
  const weeks = Store.getPublishedWeeksDesc().filter(w => Store.tasksForModelWeek(w.id, MODEL_ID).length > 0);
  const historyList = document.getElementById('historyList');
  const streakBox = document.getElementById('streakBox');

  let streak = 0;
  for (const w of weeks) {
    const tasks = Store.tasksForModelWeek(w.id, MODEL_ID);
    const pct = tasks.length ? tasks.filter(t => t.status === 'postet').length / tasks.length : 0;
    if (pct === 1) streak++; else break;
  }
  streakBox.innerHTML = streak > 0 ? `<span class="streak">${T.streak(streak)}</span>` : '';

  historyList.innerHTML = weeks.length ? weeks.map(w => {
    const tasks = Store.tasksForModelWeek(w.id, MODEL_ID);
    const done = tasks.filter(t => t.status === 'postet');
    const pct = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
    return `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <b>${T.week_label(w.iso_week)}</b>
        <span class="pill ${pct === 100 ? 'active-on' : 'effort'}">${T.history_completion(pct)}</span>
      </div>
      ${done.length ? `<div style="margin-top:8px;">${done.map(t => `<div class="muted">🔗 <a href="${esc(t.posted_url)}" target="_blank">${esc(t.title)}</a></div>`).join('')}</div>` : `<div class="muted" style="margin-top:8px;">Ingen innlegg postet denne uken.</div>`}
    </div>`;
  }).join('') : `<div class="empty card">${T.history_empty}</div>`;
}

(async () => {
  if (sessionStorage.getItem('visioon_role') !== 'model') {
    window.location.href = 'index.html';
    return;
  }
  MODEL_ID = sessionStorage.getItem('visioon_model_id');
  await Store.init();
  model = Store.getModel(MODEL_ID);
  if (!model) {
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }
  renderDashboard();
})();
