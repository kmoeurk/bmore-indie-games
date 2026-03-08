// BMore Indie Games — Submission Form JS

// ── Hamburger ──────────────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

// ── Character Counter ───────────────────────────────────────
const shortDesc = document.getElementById('short-desc');
const counter   = document.getElementById('short-desc-count');

shortDesc.addEventListener('input', () => {
  const len = shortDesc.value.length;
  counter.textContent = `${len} / 120`;
  counter.style.color = len > 100 ? (len >= 120 ? 'var(--danger)' : 'var(--warning)') : 'var(--gray-500)';
});

// ── File Upload Preview ─────────────────────────────────────
function previewUpload(input, previewId, zoneId) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showFieldError(zoneId, 'Please upload an image file.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showFieldError(zoneId, 'File too large — max 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(previewId);
    preview.innerHTML = `
      <img src="${e.target.result}" alt="Cover preview"
        style="width:100%; height:100%; object-fit:cover; border-radius:8px; max-height:200px;">
      <div style="margin-top:8px; font-size:0.78rem; color: var(--gray-400);">
        ${file.name} · ${(file.size / 1024).toFixed(0)} KB
        <button type="button" onclick="clearUpload('${input.id}','${previewId}','${zoneId}')"
          style="margin-left:8px; color: var(--danger); background:none; font-size:0.78rem; cursor:pointer;">Remove</button>
      </div>`;
  };
  reader.readAsDataURL(file);
  document.getElementById(zoneId).style.border = '2px dashed var(--purple-600)';
}

function previewUploads(input, previewId, zoneId) {
  const files = Array.from(input.files).slice(0, 5);
  if (!files.length) return;

  const preview = document.getElementById(previewId);
  const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);

  if (validFiles.length === 0) {
    showFieldError(zoneId, 'No valid images — must be image files under 5MB each.');
    return;
  }

  Promise.all(validFiles.map(f => readFile(f))).then(results => {
    preview.innerHTML = `
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${results.map((src, i) => `
          <img src="${src}" alt="Screenshot ${i+1}"
            style="width:80px; height:52px; object-fit:cover; border-radius:6px;">`).join('')}
      </div>
      <div style="margin-top:8px; font-size:0.78rem; color: var(--gray-400);">
        ${validFiles.length} screenshot${validFiles.length > 1 ? 's' : ''} selected
        <button type="button" onclick="clearUpload('${input.id}','${previewId}','${zoneId}')"
          style="margin-left:8px; color: var(--danger); background:none; font-size:0.78rem; cursor:pointer;">Remove all</button>
      </div>`;
  });
  document.getElementById(zoneId).style.border = '2px dashed var(--purple-600)';
}

function readFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function clearUpload(inputId, previewId, zoneId) {
  document.getElementById(inputId).value = '';
  const zone = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  zone.style.border = '';
  // Reset to default content
  if (inputId === 'cover-input') {
    preview.innerHTML = `
      <div class="upload-icon">🖼</div>
      <div class="upload-text">Click or drag to upload cover art</div>
      <div class="upload-hint">Recommended: 600×800px · JPG or PNG · Max 5MB</div>`;
  } else {
    preview.innerHTML = `
      <div class="upload-icon">📷</div>
      <div class="upload-text">Click or drag to upload screenshots</div>
      <div class="upload-hint">16:9 recommended · JPG or PNG · Max 5MB each</div>`;
  }
}

// ── Drag & Drop ─────────────────────────────────────────────
function handleDragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.add('drag-over');
}

function handleDragLeave(e, zoneId) {
  document.getElementById(zoneId).classList.remove('drag-over');
}

function handleDrop(e, inputId, zoneId, previewId) {
  e.preventDefault();
  document.getElementById(zoneId).classList.remove('drag-over');
  const input = document.getElementById(inputId);
  input.files = e.dataTransfer.files;
  if (inputId === 'cover-input') previewUpload(input, previewId, zoneId);
  else previewUploads(input, previewId, zoneId);
}

// ── Validation ──────────────────────────────────────────────
function showFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  const existing = el.parentElement.querySelector('.field-error');
  if (existing) existing.remove();
  const err = document.createElement('span');
  err.className = 'form-hint field-error';
  err.style.color = 'var(--danger)';
  err.textContent = msg;
  el.parentElement.appendChild(err);
  setTimeout(() => { el.style.borderColor = ''; err.remove(); }, 4000);
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
    el.style.borderColor = '';
  });
}

function validate() {
  clearErrors();
  let valid = true;

  const required = [
    { id: 'game-title',     msg: 'Game title is required' },
    { id: 'short-desc',     msg: 'Short description is required' },
    { id: 'long-desc',      msg: 'Full description is required' },
    { id: 'release-status', msg: 'Release status is required' },
    { id: 'website',        msg: 'Website URL is required' },
    { id: 'contact-name',   msg: 'Your name is required' },
    { id: 'contact-email',  msg: 'Email address is required' },
  ];

  for (const { id, msg } of required) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      showFieldError(id, msg);
      if (valid) el?.focus();
      valid = false;
    }
  }

  // Genre check
  if (!document.querySelector('input[name="genre"]:checked')) {
    valid = false;
    const firstGenre = document.querySelector('input[name="genre"]');
    const hint = document.createElement('span');
    hint.className = 'form-hint field-error';
    hint.style.color = 'var(--danger)';
    hint.textContent = 'Select at least one genre';
    firstGenre?.parentElement?.parentElement?.parentElement?.appendChild(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  // Platform check
  if (!document.querySelector('input[name="platform"]:checked')) {
    valid = false;
    const firstPlatform = document.querySelector('input[name="platform"]');
    const hint = document.createElement('span');
    hint.className = 'form-hint field-error';
    hint.style.color = 'var(--danger)';
    hint.textContent = 'Select at least one platform';
    firstPlatform?.parentElement?.parentElement?.parentElement?.appendChild(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  // Email format
  const email = document.getElementById('contact-email');
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    showFieldError('contact-email', 'Enter a valid email address');
    valid = false;
  }

  // Players
  if (!document.getElementById('players').value) {
    showFieldError('players', 'Select number of players');
    valid = false;
  }

  return valid;
}

// ── Form Submit ─────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) {
    document.querySelector('.field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  // Collect form data
  const genres    = [...document.querySelectorAll('input[name="genre"]:checked')].map(i => i.value);
  const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(i => i.value);
  const tags      = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean);

  const submission = {
    id:              Date.now(),
    submittedAt:     new Date().toISOString(),
    title:           document.getElementById('game-title').value.trim(),
    shortDescription:document.getElementById('short-desc').value.trim(),
    description:     document.getElementById('long-desc').value.trim(),
    genres,
    platforms,
    releaseStatus:   document.getElementById('release-status').value,
    releaseDate:     document.getElementById('release-date').value,
    price:           parseFloat(document.getElementById('price').value) || 0,
    players:         parseInt(document.getElementById('players').value) || 1,
    website:         document.getElementById('website').value.trim(),
    developer:       document.getElementById('dev-name').value.trim(),
    location:        document.getElementById('dev-location').value.trim(),
    twitter:         document.getElementById('twitter').value.trim(),
    discord:         document.getElementById('discord').value.trim(),
    tags,
    contactName:     document.getElementById('contact-name').value.trim(),
    contactEmail:    document.getElementById('contact-email').value.trim(),
    status:          'pending',
  };

  // Simulate async submission (replace with real API call)
  await new Promise(r => setTimeout(r, 1200));

  // Save to localStorage as fallback
  const saved = JSON.parse(localStorage.getItem('bmoreindie_submissions') || '[]');
  saved.push(submission);
  localStorage.setItem('bmoreinde_submissions', JSON.stringify(saved));

  // Show toast
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);

  // Reset form
  document.getElementById('submit-form').reset();
  clearUpload('cover-input', 'cover-preview', 'cover-zone');
  clearUpload('screenshots-input', 'screenshots-preview', 'screenshots-zone');
  counter.textContent = '0 / 120';

  btn.textContent = 'Submit Game →';
  btn.disabled = false;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.style.boxShadow  = '0 0 0 3px rgba(239,68,68,0.15)';
  const existing = el.parentElement.querySelector('.field-error');
  if (existing) existing.remove();
  const err = document.createElement('span');
  err.className = 'form-hint field-error';
  err.style.color = 'var(--danger)';
  err.textContent = msg;
  el.parentElement.appendChild(err);
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
    err.remove();
  }, 4000);
}
