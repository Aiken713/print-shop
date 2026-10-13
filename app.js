const C = window.CONFIG;
const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
emailjs.init({ publicKey: C.EMAILJS_PUBLIC_KEY });

const $ = id => document.getElementById(id);
const money = n => '$' + Number(n).toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sendMail = (to, subject, message) =>
  emailjs.send(C.EMAILJS_SERVICE_ID, C.EMAILJS_TEMPLATE_ID, { to_email: to, subject, message });

const colorList = p => (p.colors || '').split(',').map(c => c.trim()).filter(Boolean);
let products = [];
let activeProduct = null;

// ---------- Shop ----------
const imagesOf = p => (p.images && p.images.length ? p.images : (p.image_url ? [p.image_url] : []));
const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
let reviews = [], detailItems = [];
const ratingHtml = id => {
  const r = reviews.filter(x => x.product_id === id);
  if (!r.length) return '<span class="rating dim">No reviews yet</span>';
  const avg = r.reduce((t, x) => t + x.rating, 0) / r.length;
  return `<span class="rating"><span class="stars">${stars(avg)}</span> ${avg.toFixed(1)} (${r.length})</span>`;
};

async function loadProducts() {
  const [pr, rv] = await Promise.all([
    db.from('products').select('*').order('created_at', { ascending: false }),
    db.from('reviews').select('*').order('created_at', { ascending: false })
  ]);
  products = pr.data || []; reviews = rv.data || [];
  $('grid').innerHTML = products.length
    ? products.map((p, i) => `
      <article class="card" data-open="${p.id}" tabindex="0" role="button" style="--i:${i}">
        <div class="thumb"><img src="${esc(imagesOf(p)[0])}" alt="${esc(p.name)}" loading="lazy">${p.model_url ? '<span class="badge3d">3D</span>' : ''}</div>
        <div class="body">
          <h3>${esc(p.name)}</h3>
          ${ratingHtml(p.id)}
          <span class="price">${money(p.price)}</span>
        </div>
      </article>`).join('')
    : '<p class="empty">No prints yet. Check back soon.</p>';
}

function showItem(i) {
  const it = detailItems[i], st = $('stage');
  if (window.dispose3D) window.dispose3D();
  document.querySelectorAll('#thumbs button').forEach((b, j) => b.classList.toggle('on', j === i));
  if (!it) { st.innerHTML = ''; return; }
  if (it.type === 'img') st.innerHTML = `<img src="${esc(it.url)}" alt="">`;
  else if (window.show3D) window.show3D(st, it.url);
  else st.innerHTML = '<div class="loading">3D viewer could not load.</div>';
}

function openProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  activeProduct = p;
  const cl = colorList(p);
  $('dName').textContent = p.name;
  $('dRating').innerHTML = ratingHtml(p.id);
  $('dDesc').textContent = p.description || '';
  $('dColors').textContent = cl.length ? 'Colors: ' + cl.join(', ') : '';
  $('dPrice').textContent = money(p.price);
  const mine = reviews.filter(x => x.product_id === p.id);
  $('dReviews').innerHTML = mine.length ? mine.map(x => `
    <div class="item"><span><span class="stars">${stars(x.rating)}</span> <strong>${esc(x.reviewer_name)}</strong> <span class="tag">Verified buyer</span></span>
    ${x.body ? `<span class="meta note">${esc(x.body)}</span>` : ''}</div>`).join('') : '<p class="dim">No reviews yet.</p>';
  detailItems = imagesOf(p).map(u => ({ type: 'img', url: u }));
  if (p.model_url) detailItems.push({ type: '3d', url: p.model_url });
  $('thumbs').innerHTML = detailItems.length > 1 ? detailItems.map((it, i) => it.type === 'img'
    ? `<button type="button" data-t="${i}" aria-label="Photo ${i + 1}"><img src="${esc(it.url)}" alt=""></button>`
    : `<button type="button" data-t="${i}" aria-label="3D view">3D</button>`).join('') : '';
  showItem(0);
  $('prodDialog').showModal();
}

$('grid').addEventListener('click', e => { const c = e.target.closest('[data-open]'); if (c) openProduct(c.dataset.open); });
$('grid').addEventListener('keydown', e => {
  const c = e.target.closest('[data-open]');
  if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(c.dataset.open); }
});
$('thumbs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) showItem(+b.dataset.t); });
$('prodDialog').addEventListener('close', () => { if (window.dispose3D) window.dispose3D(); });
$('dRequest').addEventListener('click', () => { $('prodDialog').close(); openRequest(activeProduct); });

function openRequest(p) {
  activeProduct = p;
  $('reqTitle').textContent = p.name;
  const colors = colorList(p);
  $('colorWrap').hidden = !colors.length;
  $('cColor').required = colors.length > 0;
  $('cColor').innerHTML = '<option value="">Choose a color</option>' + colors.map(c => `<option>${esc(c)}</option>`).join('');
  $('cNotes').value = '';
  $('reqMsg').textContent = '';
  $('reqBtn').disabled = false;
  $('reqDialog').showModal();
}

$('reqForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('reqBtn'), msg = $('reqMsg');
  btn.disabled = true; msg.textContent = 'Sending…';
  const name = $('cName').value.trim(), email = $('cEmail').value.trim();
  const pay = document.querySelector('input[name="pay"]:checked').value;
  const color = $('cColor').value || null, notes = $('cNotes').value.trim() || null;
  const { error } = await db.from('requests').insert({
    product_id: activeProduct.id, product_name: activeProduct.name,
    customer_name: name, customer_email: email, payment_method: pay, color, notes
  });
  if (error) { msg.textContent = 'Could not send. Please try again.'; btn.disabled = false; return; }
  try {
    await sendMail(C.OWNER_EMAIL, `New print request: ${activeProduct.name}`,
      `Product: ${activeProduct.name}\nName: ${name}\nEmail: ${email}\nPayment: ${pay === 'cash' ? 'Cash, in person' : 'Online'}\nColor: ${color || 'n/a'}\nNotes: ${notes || 'none'}\n\nOpen the creator page to approve or decline.`);
  } catch (_) { /* request is still saved and shows on the creator page */ }
  msg.textContent = 'Request sent. You will get an email once I review it.';
  $('reqForm').reset();
});

document.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) e.target.closest('dialog').close();
});

// ---------- Suggest a model ----------
$('suggestBtn').addEventListener('click', () => {
  $('shopView').hidden = true; $('suggestView').hidden = false;
  $('sMsg').textContent = ''; window.scrollTo(0, 0);
});
$('suggestBack').addEventListener('click', showShop);

$('suggestForm').addEventListener('submit', async e => {
  e.preventDefault();
  if ($('sWebsite').value) return; // spam trap
  const btn = $('sBtn'), msg = $('sMsg');
  btn.disabled = true; msg.textContent = 'Sending…';
  const s = {
    title: $('sTitle').value.trim(),
    link: $('sLink').value.trim() || null,
    details: $('sDetails').value.trim() || null,
    name: $('sName').value.trim() || null,
    email: $('sEmail').value.trim() || null
  };
  const { error } = await db.from('suggestions').insert(s);
  btn.disabled = false;
  if (error) { msg.textContent = /limit/i.test(error.message) ? 'You can send 2 suggestions per day. Please try again tomorrow.' : 'Could not send. Please try again.'; return; }
  try {
    await sendMail(C.OWNER_EMAIL, `Model suggestion: ${s.title}`,
      `Suggestion: ${s.title}\nLink: ${s.link || 'none'}\nDetails: ${s.details || 'none'}\nFrom: ${s.name || 'anonymous'}${s.email ? ' (' + s.email + ')' : ''}\n\nOpen the creator page to see all suggestions.`);
  } catch (_) { /* suggestion is still saved and shows on the creator page */ }
  msg.textContent = 'Thanks! Your suggestion was sent.';
  $('suggestForm').reset();
});

// ---------- Creator login ----------
$('creatorBtn').addEventListener('click', async () => {
  const { data } = await db.auth.getSession();
  if (data.session) return showCreator();
  $('codeMsg').textContent = ''; $('code').value = '';
  $('codeDialog').showModal();
});

$('codeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({ email: C.OWNER_EMAIL, password: $('code').value });
  if (error) { $('codeMsg').textContent = 'Could not log in: ' + error.message; return; }
  $('codeDialog').close();
  showCreator();
});

function showShop() {
  $('creatorView').hidden = true; $('suggestView').hidden = true; $('shopView').hidden = false;
  loadProducts();
}
async function showCreator() {
  $('shopView').hidden = true; $('creatorView').hidden = false;
  window.scrollTo(0, 0);
  await loadProducts();
  renderMyProducts(); renderMyReviews(); loadRequests(); loadSuggestions();
}
$('viewShop').addEventListener('click', showShop);
$('logout').addEventListener('click', async () => { await db.auth.signOut(); showShop(); });

// ---------- Creator: add / delete products ----------
$('addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('addBtn'), msg = $('addMsg');
  btn.disabled = true; msg.textContent = 'Uploading…';
  const upload = async (file, folder) => {
    const path = `${folder}${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${file.name.replace(/[^\w.]/g, '_')}`;
    const up = await db.storage.from('product-images').upload(path, file);
    if (up.error) throw up.error;
    return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  };
  const urls = []; let model_url = null;
  try {
    const files = [...$('pImg').files];
    for (let i = 0; i < files.length; i++) { msg.textContent = `Uploading photo ${i + 1} of ${files.length}…`; urls.push(await upload(files[i], '')); }
    const mf = $('pModel').files[0];
    if (mf) { msg.textContent = 'Uploading 3D model…'; model_url = await upload(mf, 'models/'); }
  } catch (err) { msg.textContent = 'Upload failed: ' + err.message; btn.disabled = false; return; }
  const { error } = await db.from('products').insert({
    name: $('pName').value.trim(), description: $('pDesc').value.trim(),
    price: $('pPrice').value, image_url: urls[0], images: urls, model_url,
    colors: $('pColors').value.split(',').map(c => c.trim()).filter(Boolean).join(', ') || null
  });
  btn.disabled = false;
  if (error) { msg.textContent = 'Could not save: ' + error.message; return; }
  msg.textContent = 'Product added.';
  $('addForm').reset();
  await loadProducts(); renderMyProducts();
});

function renderMyProducts() {
  $('myProducts').innerHTML = products.length ? products.map(p => `
    <div class="item product">
      <img src="${esc(imagesOf(p)[0])}" alt="">
      <div class="info"><strong>${esc(p.name)}</strong><br>${money(p.price)}${p.colors ? ' · ' + esc(p.colors) : ''}</div>
      <button class="btn outline small" data-del="${p.id}">Delete</button>
    </div>`).join('') : '<p>No products yet.</p>';
}
$('myProducts').addEventListener('click', async e => {
  const id = e.target.dataset.del;
  if (!id || !confirm('Delete this product?')) return;
  await db.from('products').delete().eq('id', id);
  await loadProducts(); renderMyProducts();
});

// ---------- Creator: requests ----------
let requests = [];
async function loadRequests() {
  const { data } = await db.from('requests').select('*').order('created_at', { ascending: false });
  requests = data || [];
  $('requests').innerHTML = requests.length ? requests.map(r => `
    <div class="item">
      <span class="tag ${r.status === 'declined' ? 'declined' : ''}">${esc(r.status)}${r.payment_method === 'cash' ? ' · cash' : ''}</span>
      <strong>${esc(r.product_name)}</strong>
      <span class="meta">${esc(r.customer_name)} · ${esc(r.customer_email)}<br>${new Date(r.created_at).toLocaleString()}</span>
      ${r.color ? `<span class="meta"><strong>Color:</strong> ${esc(r.color)}</span>` : ''}
      ${r.notes ? `<span class="meta note"><strong>Notes:</strong> ${esc(r.notes)}</span>` : ''}
      <div class="actions">${actions(r)}</div>
    </div>`).join('') : '<p>No requests yet.</p>';
}
function actions(r) {
  const b = (a, label, cls) => `<button class="btn ${cls} small" data-act="${a}" data-id="${r.id}">${label}</button>`;
  if (r.status === 'pending') return b('approve', 'Yes', 'solid') + b('decline', 'No', 'outline');
  if (r.status === 'approved') return r.payment_method === 'cash' ? b('printing', 'Start print', 'solid') : b('paid', 'Mark paid', 'solid');
  if (r.status === 'paid' || r.status === 'printing') return b('done', 'Mark delivered', 'solid');
  return '';
}

$('requests').addEventListener('click', async e => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const r = requests.find(x => x.id === id);
  const price = products.find(p => p.id === r.product_id)?.price;
  e.target.disabled = true;
  const status = { approve: 'approved', decline: 'declined', paid: 'paid', printing: 'printing', done: 'done' }[act];
  const { error } = await db.from('requests').update({ status }).eq('id', id);
  if (error) { alert('Could not update: ' + error.message); e.target.disabled = false; return; }

  const hi = `Hi ${r.customer_name},\n\n`;
  const cash = r.payment_method === 'cash';
  const base = C.SITE_URL || (location.origin + location.pathname.replace(/index\.html$/, ''));
  const reviewUrl = `${base}${base.endsWith('/') ? '' : '/'}?review=${r.review_token}`;
  const priceLine = price != null ? `Price: ${money(price)}\n` : '';
  const extra = (r.color ? `Color: ${r.color}\n` : '') + (r.notes ? `Your notes: ${r.notes}\n` : '');
  const mail = {
    approve: [`Your request for ${r.product_name} is approved`,
      cash
        ? `${hi}Good news, I can print "${r.product_name}" for you.\n${priceLine}${extra}You chose to pay with cash. ${C.CASH_NOTE}`
        : `${hi}Good news, I can print "${r.product_name}" for you.\n${priceLine}${extra}Please send payment here: ${C.PAYMENT_LINK}\n\nI'll start printing as soon as I receive it.`],
    printing: [`Your ${r.product_name} is printing`,
      `${hi}I'm starting your print of "${r.product_name}" now. Remember to bring cash when you pick it up.`],
    decline: [`About your request for ${r.product_name}`,
      `${hi}Thanks for your interest in "${r.product_name}". Unfortunately I can't take this request right now.`],
    done: [`Your ${r.product_name} is ready`,
      `${hi}Your print of "${r.product_name}" is done. I hope you love it!\n\nIf you have a minute, I'd really appreciate a review (1-5 stars). Only buyers can leave one, and this link is just for you:\n${reviewUrl}\n\nThank you!`],
    paid: [`Payment received for ${r.product_name}`,
      `${hi}I got your payment for "${r.product_name}". I'm starting your print now.`]
  }[act];
  try { await sendMail(r.customer_email, mail[0], mail[1]); }
  catch (_) { alert('Status saved, but the email to the customer failed to send.'); }
  loadRequests();
});

// ---------- Creator: suggestions ----------
async function loadSuggestions() {
  const { data } = await db.from('suggestions').select('*').order('created_at', { ascending: false });
  const list = data || [];
  $('suggestions').innerHTML = list.length ? list.map(s => `
    <div class="item">
      <strong>${esc(s.title)}</strong>
      ${s.link ? (/^https?:\/\//i.test(s.link)
        ? `<a class="meta" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer">${esc(s.link)}</a>`
        : `<span class="meta">${esc(s.link)}</span>`) : ''}
      ${s.details ? `<span class="meta note">${esc(s.details)}</span>` : ''}
      <span class="meta">${esc(s.name || 'Anonymous')}${s.email ? ' · ' + esc(s.email) : ''}<br>${new Date(s.created_at).toLocaleString()}</span>
      <div class="actions"><button class="btn outline small" data-sdel="${s.id}">Delete</button></div>
    </div>`).join('') : '<p>No suggestions yet.</p>';
}
$('suggestions').addEventListener('click', async e => {
  const id = e.target.dataset.sdel;
  if (!id || !confirm('Delete this suggestion?')) return;
  await db.from('suggestions').delete().eq('id', id);
  loadSuggestions();
});

// ---------- Reviews (verified buyers, via the link in the delivery email) ----------
let rating = 0;
const reviewToken = new URLSearchParams(location.search).get('review');
for (let i = 1; i <= 5; i++) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = '☆'; b.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''}`);
  b.addEventListener('click', () => { rating = i; [...$('starPick').children].forEach((c, j) => { c.textContent = j < i ? '★' : '☆'; }); });
  $('starPick').appendChild(b);
}
async function openReview() {
  const show = (title, hint, form) => { $('revTitle').textContent = title; $('revHint').textContent = hint; $('revFields').hidden = !form; $('revDialog').showModal(); };
  const { data, error } = await db.rpc('review_info', { p_token: reviewToken });
  const info = data && data[0];
  if (error || !info) return show('Review link', "Sorry, this review link isn't valid.", false);
  if (info.already_reviewed) return show('Thanks!', "You've already reviewed this print.", false);
  if (!info.eligible) return show('Almost there', 'You can review once your print has been delivered.', false);
  $('rName').value = (info.customer_name || '').split(' ')[0];
  show(`Review: ${info.product_name}`, 'Verified purchase. How did your print turn out?', true);
}
$('revForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('rMsg');
  if (!rating) { msg.textContent = 'Please choose a star rating.'; return; }
  $('rBtn').disabled = true; msg.textContent = 'Posting…';
  const { data, error } = await db.rpc('submit_review', { p_token: reviewToken, p_name: $('rName').value.trim(), p_rating: rating, p_body: $('rBody').value.trim() });
  $('rBtn').disabled = false;
  if (error || data !== 'ok') { msg.textContent = data === 'already' ? "You've already reviewed this print." : 'Could not post your review.'; return; }
  history.replaceState(null, '', location.pathname);
  $('revFields').hidden = true; $('revHint').textContent = 'Thank you! Your review is posted.'; msg.textContent = '';
  loadProducts();
});
if (reviewToken) openReview();

// ---------- Creator: manage reviews ----------
function renderMyReviews() {
  $('myReviews').innerHTML = reviews.length ? reviews.map(x => `
    <div class="item">
      <span><span class="stars">${stars(x.rating)}</span> <strong>${esc(x.reviewer_name)}</strong></span>
      <span class="meta">${esc((products.find(p => p.id === x.product_id) || {}).name || 'Deleted product')}</span>
      ${x.body ? `<span class="meta note">${esc(x.body)}</span>` : ''}
      <div class="actions"><button class="btn outline small" data-rdel="${x.id}">Delete</button></div>
    </div>`).join('') : '<p>No reviews yet.</p>';
}
$('myReviews').addEventListener('click', async e => {
  const id = e.target.dataset.rdel;
  if (!id || !confirm('Delete this review?')) return;
  const { error } = await db.from('reviews').delete().eq('id', id);
  if (error) { alert('Could not delete: ' + error.message); return; }
  await loadProducts(); renderMyReviews();
});

loadProducts();
