// VISIOON data layer — backed by Supabase (see assets/supabase-client.js).
//
// Pattern: Store.init() fetches everything the current session is allowed to
// see (RLS-scoped) into an in-memory cache once at page load. All list*/get*
// reads are synchronous against that cache, so render functions in admin.js
// and app.js don't need to be async. All add*/update*/remove* writes are
// async: they write to Supabase first, then patch the cache from the real
// returned row (so generated UUIDs/timestamps are correct).

const _cache = { models: [], trends: [], weeks: [], tasks: [], comments: [] };

// Local-time date formatting — avoid Date#toISOString() here, it converts to
// UTC first and silently shifts the date by a day outside UTC+0.
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() { return toDateStr(new Date()); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

function isoWeekNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const SEED_TRENDS = [
  { name: 'YAP-format (uskriptet selfie-prat)', format: 'Reel', effort: 'Lav', status: 'ny',
    why: 'Rå selfie-video uten manus, minimal redigering, tekst + fet hook. Føles ekte — stort for personlig merkevarebygging.',
    adapt: 'Modellen snakker rett i kamera om dagen sin/meninger/bak kulissene. Tekst-hook som «ingen snakker om denne delen av å være skaper…»' },
  { name: '«Tørk kameraet»-transformasjon', format: 'Reel', effort: 'Lav', status: 'ny',
    why: 'Hånd sveiper over linsen; scenen forvandles. Et av de reneste reveal-formatene på Reels akkurat nå.',
    adapt: 'Før/etter: avslappet fit → glamfit, rotete rom → shoot-setup, treningstøy → nightout-look.' },
  { name: 'Skisse til antrekk', format: 'Reel', effort: 'Høy', status: 'ny',
    why: 'Håndtegnet animasjon lagt over video: hvert klesplagg tegnes på og blir til det ekte plagget. Veldig høy delingsrate.',
    adapt: 'Passer glam/fashion-nisjer. Krever redigeringstid — bruk til et flaggskip-innlegg, ikke daglig innhold.' },
  { name: 'Plan A, B, C…', format: 'Carousel', effort: 'Lav', status: 'ny',
    why: 'Serie av alternative livsveier merket Plan A/B/C. Relaterbart + kommentar-bait («hvilken plan er du?»).',
    adapt: '«Plan A: treningsjente. Plan B: gamer-kjæreste. Plan C: ditt problem nå.» Tilpass planene til hver persona.' },
  { name: 'Pixel-strekk-carousel', format: 'Carousel', effort: 'Middels', status: 'ny',
    why: 'Strekker en pikselskive fra et bilde til fargebølger. Slående visuelt for karuseller; sterk lagringsrate.',
    adapt: 'Bruk på de beste shoot-bildene. Fungerer spesielt godt for alt/artsy-nisjer.' },
  { name: 'Det ene eller det andre / blind rangering', format: 'Reel', effort: 'Lav', status: 'ny',
    why: 'Spillformater driver kommentarer og DM-delinger — metrikken IG nå vekter tyngst.',
    adapt: '«Ranger looken min», «det ene eller det andre: date night-utgave». Be seerne stemme i kommentarfeltet.' },
  { name: 'Storytime rett i kamera', format: 'Reel', effort: 'Lav', status: 'ny',
    why: 'Rask historiefortelling med sterk hook i de første 2 sekundene. Retention-monster hvis historien leverer.',
    adapt: 'Villeste DM jeg har fått, verste date-historie, hvordan jeg startet. Persona-stemmen betyr mer enn produksjon.' },
  { name: 'GRWM (gjør deg klar med meg)', format: 'Reel', effort: 'Lav', status: 'bevist',
    why: 'Tidløs. Naturlig visning av produkter/looks med voiceover; intim følelse bygger parasosial tilknytning.',
    adapt: 'GRWM til shoot, trening, date night. Voiceover-storytime dobler retention.' },
  { name: 'Trendlyd lip-sync / dans', format: 'Reel', effort: 'Lav', status: 'bevist',
    why: 'Å ri på trendlyd er fortsatt den billigste rekkevidden på begge plattformer. ↗-pilen på IG-lyd = trender nå.',
    adapt: 'Sjekk trendlyder på mandager; batch 3–4 i én økt mens lydene fortsatt er ferske.' },
  { name: 'Bildedump-carousel + voiceover', format: 'Carousel', effort: 'Lav', status: 'bevist',
    why: 'Avslappet «dump»-estetikk føles ekte; voiceover gjør det til en mini-vlogg. Høy lagring/deling.',
    adapt: 'Ukentlig oppsummeringsdump per modell: bak kulissene, mat, antrekk, trening. Lav innsats, holder feeden varm mellom store innlegg.' },
  { name: 'POV-skisse', format: 'Reel', effort: 'Middels', status: 'testes',
    why: 'POV-tekst + skuespill til trendlyd. Ekstremt delbart når scenarioet er nisjespesifikt.',
    adapt: '«POV: gamer-kjæresten din vinner igjen», «POV: treningscrushen snakker endelig til deg». Skriv 5 scenarioer per nisje.' },
];

function fail(error, context) {
  console.error(context, error);
  alert(`Noe gikk galt (${context}): ${error.message}`);
  throw error;
}

// Map DB row <-> app-facing comment shape (author_role -> author)
function mapComment(row) {
  return { ...row, author: row.author_role };
}

const Store = {
  async init() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;

    const [modelsRes, trendsRes, weeksRes, tasksRes, commentsRes] = await Promise.all([
      sb.from('profiles').select('*').eq('role', 'model'),
      sb.from('trends').select('*'),
      sb.from('weeks').select('*'),
      sb.from('tasks').select('*'),
      sb.from('task_comments').select('*'),
    ]);
    if (modelsRes.error) fail(modelsRes.error, 'laste modeller');
    if (trendsRes.error) fail(trendsRes.error, 'laste trender');
    if (weeksRes.error) fail(weeksRes.error, 'laste uker');
    if (tasksRes.error) fail(tasksRes.error, 'laste oppgaver');
    if (commentsRes.error) fail(commentsRes.error, 'laste kommentarer');

    _cache.models = modelsRes.data;
    _cache.trends = trendsRes.data;
    _cache.weeks = weeksRes.data;
    _cache.tasks = tasksRes.data;
    _cache.comments = commentsRes.data.map(mapComment);

    const { data: myProfile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (myProfile && myProfile.role === 'admin' && _cache.trends.length === 0) {
      const seeded = SEED_TRENDS.map(t => ({ ...t, adapt: t.adapt || '' }));
      const { data, error } = await sb.from('trends').insert(seeded).select();
      if (!error) _cache.trends = data;
    }
    return myProfile;
  },

  // --- Models (profiles where role = 'model') ---
  listModels() { return _cache.models; },
  getModel(id) { return this.listModels().find(m => m.id === id); },

  async addModel({ username, password, display_name, niche, persona, platforms, comfort }) {
    const email = usernameToEmail(username);
    const signupClient = createSignupClient();
    const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({ email, password });
    if (signUpError) fail(signUpError, 'opprette modell-konto');

    const { data, error } = await sb.from('profiles').insert({
      id: signUpData.user.id, role: 'model', display_name, niche, persona, platforms, comfort, email, username, active: true,
    }).select().single();
    if (error) fail(error, 'lagre modell-profil');
    _cache.models.push(data);
    return data;
  },
  async updateModel(id, patch) {
    const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'oppdatere modell');
    _cache.models = _cache.models.map(m => m.id === id ? data : m);
  },
  async removeModel(id) {
    const { error } = await sb.from('profiles').delete().eq('id', id);
    if (error) fail(error, 'fjerne modell');
    _cache.models = _cache.models.filter(m => m.id !== id);
  },

  // --- Trends ---
  listTrends() { return _cache.trends; },
  async addTrend(data) {
    const { data: row, error } = await sb.from('trends').insert({ status: 'ny', adapt: '', ...data }).select().single();
    if (error) fail(error, 'lagre trend');
    _cache.trends.unshift(row);
  },
  async cycleTrendStatus(id) {
    const order = ['ny', 'testes', 'bevist'];
    const t = this.listTrends().find(x => x.id === id);
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    const { data, error } = await sb.from('trends').update({ status: next }).eq('id', id).select().single();
    if (error) fail(error, 'endre trend-status');
    _cache.trends = _cache.trends.map(x => x.id === id ? data : x);
  },
  async removeTrend(id) {
    const { error } = await sb.from('trends').delete().eq('id', id);
    if (error) fail(error, 'fjerne trend');
    _cache.trends = _cache.trends.filter(t => t.id !== id);
  },

  // --- Weeks ---
  listWeeks() { return _cache.weeks; },
  async getDraftWeek() {
    let draft = this.listWeeks().find(w => !w.published);
    if (!draft) {
      const monday = mondayOf(todayISO());
      const { data, error } = await sb.from('weeks').insert({
        monday_date: monday, iso_week: isoWeekNumber(monday), year: new Date(monday).getFullYear(),
        focus_text: '', published: false,
      }).select().single();
      if (error) fail(error, 'opprette ny uke');
      _cache.weeks.push(data);
      draft = data;
    }
    return draft;
  },
  async updateWeek(id, patch) {
    const { data, error } = await sb.from('weeks').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'oppdatere uke');
    _cache.weeks = _cache.weeks.map(w => w.id === id ? data : w);
  },
  async publishWeek(id) { await this.updateWeek(id, { published: true }); },
  getPublishedWeeksDesc() {
    return this.listWeeks().filter(w => w.published).sort((a, b) => b.monday_date.localeCompare(a.monday_date));
  },
  getLatestPublishedWeekForModel(modelId) {
    const weeks = this.getPublishedWeeksDesc();
    return weeks.find(w => this.listTasks().some(t => t.week_id === w.id && t.model_id === modelId));
  },
  async duplicateLastWeek() {
    const weeks = [...this.listWeeks()].sort((a, b) => b.monday_date.localeCompare(a.monday_date));
    const last = weeks.find(w => w.published) || weeks[0];
    if (!last) return this.getDraftWeek();
    const draft = await this.getDraftWeek();
    const lastTasks = this.listTasks().filter(t => t.week_id === last.id);
    for (const t of lastTasks) {
      const dayOffset = t.deadline_date ? Math.round((new Date(t.deadline_date) - new Date(last.monday_date)) / 86400000) : null;
      await this.addPoolTask(draft.id, {
        model_id: t.model_id, trend_id: t.trend_id, title: t.title, hook: t.hook, execution: t.execution,
        format: t.format, effort: t.effort,
        deadline_date: dayOffset !== null ? addDays(draft.monday_date, dayOffset) : null,
      });
    }
    return draft;
  },

  // --- Tasks ---
  listTasks() { return _cache.tasks; },
  async addPoolTask(weekId, data) {
    const { data: row, error } = await sb.from('tasks').insert({
      week_id: weekId, model_id: null, trend_id: null, deadline_date: null, status: 'ny',
      posted_url: null, proof_image_url: null, sort_order: this.listTasks().length, ...data,
    }).select().single();
    if (error) fail(error, 'lagre oppgave');
    _cache.tasks.push(row);
    return row;
  },
  async updateTask(id, patch) {
    const { data, error } = await sb.from('tasks').update(patch).eq('id', id).select().single();
    if (error) fail(error, 'oppdatere oppgave');
    _cache.tasks = _cache.tasks.map(t => t.id === id ? data : t);
  },
  async removeTask(id) {
    const { error } = await sb.from('tasks').delete().eq('id', id);
    if (error) fail(error, 'fjerne oppgave');
    _cache.tasks = _cache.tasks.filter(t => t.id !== id);
  },
  async assignTaskToSlot(taskId, modelId, deadlineDate) {
    await this.updateTask(taskId, { model_id: modelId, deadline_date: deadlineDate });
  },
  async unassignTask(taskId) {
    await this.updateTask(taskId, { model_id: null, deadline_date: null });
  },
  tasksForWeek(weekId) { return this.listTasks().filter(t => t.week_id === weekId); },
  tasksForModelWeek(weekId, modelId) { return this.listTasks().filter(t => t.week_id === weekId && t.model_id === modelId); },

  // --- Comments ---
  listComments(taskId) { return _cache.comments.filter(c => c.task_id === taskId); },
  async addComment(taskId, author, body) {
    const { data, error } = await sb.from('task_comments').insert({
      task_id: taskId, author_role: author, body,
      read_by_admin: author === 'admin', read_by_model: author === 'model',
    }).select().single();
    if (error) fail(error, 'lagre kommentar');
    _cache.comments.push(mapComment(data));
  },
  async markRead(taskId, role) {
    const field = role === 'admin' ? 'read_by_admin' : 'read_by_model';
    const { data, error } = await sb.from('task_comments').update({ [field]: true }).eq('task_id', taskId).select();
    if (error) fail(error, 'merke kommentar som lest');
    const updated = data.map(mapComment);
    _cache.comments = _cache.comments.map(c => updated.find(u => u.id === c.id) || c);
  },
  hasUnread(taskId, role) {
    const field = role === 'admin' ? 'read_by_admin' : 'read_by_model';
    return this.listComments(taskId).some(c => !c[field]);
  },

  // --- AI Idea Engine ---
  async generateIdeas(model, batchType, extra) {
    const activeTrends = this.listTrends().filter(t => t.status !== 'utgatt');
    const { data, error } = await sb.functions.invoke('generate-ideas', {
      body: { model, trends: activeTrends, batchType, extra },
    });
    if (error) fail(error, 'generere idéer');
    if (data.error) fail(new Error(data.error), 'generere idéer');
    return data.ideas;
  },
};
