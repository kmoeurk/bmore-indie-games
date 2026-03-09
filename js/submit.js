// BMore Indie Games — Submission Form JS
// Uploads images to Supabase Storage, inserts row into submissions table.

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
  if (!file.type.startsWith('image/')) { showFieldError(zoneId, 'Please upload an image file.'); return; }
  if (file.size > 5 * 1024 * 1024)    { showFieldError(zoneId, 'File too large — max 5MB.');    return; }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById(previewId).innerHTML = `
      <img src="${e.target.result}" alt="Cover preview"
        style="width:100%;height:100%;object-fit:cover;border-radius:8px;max-height:200px;">
      <div style="margin-top:8px;font-size:0.78rem;color:var(--gray-400);">
        ${file.name} · ${(file.size / 1024).toFixed(0)} KB
        <button type="button" onclick="clearUpload('${input.id}','${previewId}','${zoneId}')"
          style="margin-left:8px;color:var(--danger);background:none;font-size:0.78rem;cursor:pointer;">Remove</button>
      </div>`;
  };
  reader.readAsDataURL(file);
  document.getElementById(zoneId).style.border = '2px dashed var(--purple-600)';
}

function previewUploads(input, previewId, zoneId) {
  const files      = Array.from(input.files).slice(0, 5);
  const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
  if (!validFiles.length) { showFieldError(zoneId, 'No valid images — must be image files under 5MB each.'); return; }
  Promise.all(validFiles.map(readFile)).then(results => {
    document.getElementById(previewId).innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${results.map((src, i) => `<img src="${src}" alt="Screenshot ${i+1}" style="width:80px;height:52px;object-fit:cover;border-radius:6px;">`).join('')}
      </div>
      <div style="margin-top:8px;font-size:0.78rem;color:var(--gray-400);">
        ${validFiles.length} screenshot${validFiles.length > 1 ? 's' : ''} selected
        <button type="button" onclick="clearUpload('${input.id}','${previewId}','${zoneId}')"
          style="margin-left:8px;color:var(--danger);background:none;font-size:0.78rem;cursor:pointer;">Remove all</button>
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
  document.getElementById(zoneId).style.border = '';
  document.getElementById(previewId).innerHTML = inputId === 'cover-input'
    ? '<div class="upload-icon">🖼</div><div class="upload-text">Click or drag to upload cover art</div><div class="upload-hint">Recommended: 600×800px · JPG or PNG · Max 5MB</div>'
    : '<div class="upload-icon">📷</div><div class="upload-text">Click or drag to upload screenshots</div><div class="upload-hint">16:9 recommended · JPG or PNG · Max 5MB each</div>';
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
  try {
    const dt = new DataTransfer();
    Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
    input.files = dt.files;
  } catch (_) { /* older browsers */ }
  if (inputId === 'cover-input') previewUpload(input, previewId, zoneId);
  else previewUploads(input, previewId, zoneId);
}

// ── Upload to Supabase Storage ───────────────────────────────
async function uploadFile(file, folder) {
  const ext      = file.name.split('.').pop().toLowerCase();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await db.storage
    .from('game-images')
    .upload(filename, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: urlData } = db.storage.from('game-images').getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ── Validation ──────────────────────────────────────────────
function showFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.15)';
  const existing = el.parentElement.querySelector('.field-error');
  if (existing) existing.remove();
  const err = document.createElement('span');
  err.className = 'form-hint field-error';
  err.style.color = 'var(--danger)';
  err.textContent = msg;
  el.parentElement.appendChild(err);
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; err.remove(); }, 4000);
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('.form-input,.form-select,.form-textarea').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
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
    if (!el || !el.value.trim()) { showFieldError(id, msg); if (valid) el?.focus(); valid = false; }
  }

  if (!document.querySelector('input[name="genre"]:checked')) {
    valid = false;
    const hint = document.createElement('span');
    hint.className = 'form-hint field-error'; hint.style.color = 'var(--danger)';
    hint.textContent = 'Select at least one genre';
    document.querySelector('input[name="genre"]')?.closest('.form-group')?.appendChild(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  if (!document.querySelector('input[name="platform"]:checked')) {
    valid = false;
    const hint = document.createElement('span');
    hint.className = 'form-hint field-error'; hint.style.color = 'var(--danger)';
    hint.textContent = 'Select at least one platform';
    document.querySelector('input[name="platform"]')?.closest('.form-group')?.appendChild(hint);
    setTimeout(() => hint.remove(), 4000);
  }

  const email = document.getElementById('contact-email');
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    showFieldError('contact-email', 'Enter a valid email address'); valid = false;
  }

  if (!document.getElementById('players').value) {
    showFieldError('players', 'Select number of players'); valid = false;
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
  btn.textContent = '⏳ Uploading images…';
  btn.disabled    = true;

  try {
    // 1. Upload cover image to Supabase Storage
    const coverFile = document.getElementById('cover-input').files[0];
    if (!coverFile) throw new Error('Cover image is required.');
    const coverUrl = await uploadFile(coverFile, 'covers');

    // 2. Upload screenshots (optional, up to 5)
    btn.textContent = '⏳ Uploading screenshots…';
    const screenshotFiles = Array.from(document.getElementById('screenshots-input').files || []).slice(0, 5);
    const screenshotUrls  = [];
    for (const file of screenshotFiles) {
      try { screenshotUrls.push(await uploadFile(file, 'screenshots')); }
      catch (err) { console.warn('Screenshot upload skipped:', err.message); }
    }

    btn.textContent = '⏳ Submitting…';

    // 3. Build submission row
    const genres    = [...document.querySelectorAll('input[name="genre"]:checked')].map(i => i.value);
    const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(i => i.value);
    const tags      = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean);
    const location  = document.getElementById('dev-location').value.trim();
    const locParts  = location.split(',');

    let releaseDate = null;
    const rdVal = document.getElementById('release-date').value;
    if (rdVal) { try { releaseDate = new Date(rdVal).toISOString().split('T')[0]; } catch { releaseDate = null; } }

    const socialLinks = {};
    const tw = document.getElementById('twitter').value.trim();
    const dc = document.getElementById('discord').value.trim();
    if (tw) socialLinks.twitter = tw;
    if (dc) socialLinks.discord = dc;

    const row = {
      title:             document.getElementById('game-title').value.trim(),
      description_short: document.getElementById('short-desc').value.trim(),
      description_long:  document.getElementById('long-desc').value.trim(),
      genre:             genres,
      platform:          platforms,
      price:             document.getElementById('price').value || '0',
      release_status:    document.getElementById('release-status').value,
      release_date:      releaseDate,
      cover_image_url:   coverUrl,
      screenshots:       screenshotUrls,
      website_url:       document.getElementById('website').value.trim(),
      developer_name:    document.getElementById('dev-name').value.trim() || null,
      city:              locParts[0]?.trim() || null,
      state:             locParts[1]?.trim() || null,
      social_links:      socialLinks,
      tags,
      num_players:       document.getElementById('players').value || null,
      contact_name:      document.getElementById('contact-name').value.trim(),
      contact_email:     document.getElementById('contact-email').value.trim(),
      status:            'pending',
    };

    // 4. Insert into Supabase submissions table
    const { error } = await db.from('submissions').insert(row);
    if (error) throw new Error(error.message);

    // 5. Success
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 5000);

    document.getElementById('submit-form').reset();
    clearUpload('cover-input',       'cover-preview',       'cover-zone');
    clearUpload('screenshots-input', 'screenshots-preview', 'screenshots-zone');
    counter.textContent = '0 / 120';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Submit error:', err);
    // Show a top-level error banner
    let banner = document.getElementById('submit-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'submit-error-banner';
      banner.style.cssText = 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px 20px;margin-bottom:24px;color:#f87171;font-size:0.875rem;';
      document.querySelector('.submit-actions').before(banner);
    }
    banner.textContent = `Submission failed: ${err.message}. Please try again.`;
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    btn.textContent = 'Submit Game →';
    btn.disabled    = false;
  }
}
