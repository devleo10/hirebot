import { getAllProfiles, saveProfiles, setActiveProfileId, getActiveProfileId, getAllAnswers, upsertAnswer } from '../shared/storage.js';

const app = document.getElementById('app');

async function init() {
  const [profiles, activeId, answers] = await Promise.all([
    getAllProfiles(),
    getActiveProfileId(),
    getAllAnswers()
  ]);
  render(profiles, activeId, answers, { q: '' });
}

function uuid() { return crypto.randomUUID(); }

function render(profiles, activeId, answers, state) {
  app.innerHTML = '';
  const header = document.createElement('header');
  header.innerHTML = `<h1>JobJinni</h1>`;
  app.appendChild(header);

  // Profiles section
  const profSec = document.createElement('div');
  profSec.className = 'section';
  profSec.innerHTML = `<h3 style="margin:0 0 6px;font-size:13px;">Profiles</h3>`;
  const list = document.createElement('ul');
  list.className = 'profile-list';
  profiles.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${p.label || p.fullName || p.email || 'Unnamed'}</span>`;
    const btn = document.createElement('button');
    btn.textContent = p.id === activeId ? 'Active' : 'Make Active';
    btn.className = p.id === activeId ? 'secondary' : 'primary';
    btn.onclick = async () => { await setActiveProfileId(p.id); init(); };
    li.appendChild(btn);
    list.appendChild(li);
  });
  profSec.appendChild(list);

  const addForm = document.createElement('div');
  addForm.innerHTML = `<div class="inline"><input type=text placeholder='Label (e.g. Frontend Dev)' id='jjNewLabel' /> <button class='primary' id='jjAddProf'>Add</button></div>`;
  profSec.appendChild(addForm);

  const fieldsBox = document.createElement('div');
  fieldsBox.className = 'small';
  fieldsBox.style.marginTop = '6px';
  fieldsBox.innerHTML = `<details><summary>Edit Active Profile Fields</summary>
    <div id='jjFieldEditor'></div>
  </details>`;
  profSec.appendChild(fieldsBox);

  app.appendChild(profSec);

  // Answers section
  const ansSec = document.createElement('div');
  ansSec.className = 'section';
  ansSec.innerHTML = `<h3 style="margin:0 0 6px;font-size:13px;">Saved Answers</h3>`;

  const searchBox = document.createElement('div');
  searchBox.className = 'search-box';
  searchBox.innerHTML = `<input type=text id='jjSearch' placeholder='Search question...' value='${state.q || ''}' />`;
  ansSec.appendChild(searchBox);

  const ansList = document.createElement('div');
  const entries = Object.entries(answers)
    .filter(([k,v]) => !state.q || k.includes(state.q.toLowerCase()))
    .sort((a,b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, 50);
  entries.forEach(([key, val]) => {
    const div = document.createElement('div');
    div.className = 'answer-item';
    div.innerHTML = `<h4>${val.rawQuestion || key}</h4><pre>${val.text.replace(/</g,'&lt;')}</pre>`;
    ansList.appendChild(div);
  });
  ansSec.appendChild(ansList);

  const ansForm = document.createElement('div');
  ansForm.style.marginTop = '8px';
  ansForm.innerHTML = `<textarea id='jjQ' placeholder='Question (paste exact or representative)'></textarea><textarea id='jjA' placeholder='Answer'></textarea><button class='primary' id='jjSaveAns'>Save / Update Answer</button>`;
  ansSec.appendChild(ansForm);
  app.appendChild(ansSec);

  // Wire events
  document.getElementById('jjAddProf').onclick = async () => {
    const label = document.getElementById('jjNewLabel').value.trim();
    if (!label) return;
    profiles.push({ id: uuid(), label });
    await saveProfiles(profiles);
    await setActiveProfileId(profiles[profiles.length-1].id);
    init();
  };
  document.getElementById('jjSearch').oninput = (e) => {
    state.q = e.target.value;
    render(profiles, activeId, answers, state);
  };
  document.getElementById('jjSaveAns').onclick = async () => {
    const q = document.getElementById('jjQ').value.trim();
    const a = document.getElementById('jjA').value.trim();
    if (!q || !a) return;
    await upsertAnswer(q, a, activeId);
    init();
  };

  renderFieldEditor(profiles.find(p => p.id === activeId), profiles);
}

function renderFieldEditor(activeProfile, allProfiles) {
  const root = document.getElementById('jjFieldEditor');
  if (!root) return;
  root.innerHTML = '';
  if (!activeProfile) { root.textContent = 'No active profile.'; return; }
  const fields = ['fullName','firstName','lastName','email','phone','college','github','portfolio','linkedin','skills','location'];
  fields.forEach(f => {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '4px';
    wrap.innerHTML = `<label style='display:block;font-size:11px;margin-bottom:2px;'>${f}</label><input data-field='${f}' type=text value='${activeProfile[f] || ''}' />`;
    root.appendChild(wrap);
  });
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Fields';
  saveBtn.className = 'primary';
  saveBtn.onclick = async () => {
    const inputs = root.querySelectorAll('input[data-field]');
    inputs.forEach(inp => { activeProfile[inp.dataset.field] = inp.value; });
    await saveProfiles(allProfiles);
    init();
  };
  root.appendChild(saveBtn);
}

init();
