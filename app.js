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
async function loadProducts() {
  const { data } = await db.from('products').select('*').order('created_at', { ascending: false });
  products = data || [];
  $('grid').innerHTML = products.length
    ? products.map(p => `
      <article class="card">
        <img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">
        <div class="body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          ${colorList(p).length ? `<span class="colors">Colors: ${esc(colorList(p).join(', '))}</span>` : ''}
          <span class="price">${money(p.price)}</span>
          <button class="btn solid" data-request="${p.id}">Request this print</button>
        </div>
      </article>`).join('')
    : '<p class="empty">No prints yet. Check back soon.</p>';
}

$('grid').addEventListener('click', e => {
  const id = e.target.dataset.request;
  if (!id) return;
  activeProduct = products.find(p => p.id === id);
  $('reqTitle').textContent = activeProduct.name;
  const colors = colorList(activeProduct);
  $('colorWrap').hidden = !colors.length;
  $('cColor').required = colors.length > 0;
  $('cColor').innerHTML = '<option value="">Choose a color</option>' + colors.map(c => `<option>${esc(c)}</option>`).join('');
  $('cNotes').value = '';
  $('reqMsg').textContent = '';
  $('reqBtn').disabled = false;
  $('reqDialog').showModal();
});

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
  if (error) { msg.textContent = 'Could not send. Please try again.'; return; }
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
  renderMyProducts(); loadRequests(); loadSuggestions();
}
$('viewShop').addEventListener('click', showShop);
$('logout').addEventListener('click', async () => { await db.auth.signOut(); showShop(); });

// ---------- Creator: add / delete products ----------
$('addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('addBtn'), msg = $('addMsg');
  btn.disabled = true; msg.textContent = 'Uploading…';
  const file = $('pImg').files[0];
  const path = `${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`;
  const up = await db.storage.from('product-images').upload(path, file);
  if (up.error) { msg.textContent = 'Image upload failed: ' + up.error.message; btn.disabled = false; return; }
  const image_url = db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  const { error } = await db.from('products').insert({
    name: $('pName').value.trim(), description: $('pDesc').value.trim(),
    price: $('pPrice').value, image_url,
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
      <img src="${esc(p.image_url)}" alt="">
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
  return '';
}

$('requests').addEventListener('click', async e => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const r = requests.find(x => x.id === id);
  const price = products.find(p => p.id === r.product_id)?.price;
  e.target.disabled = true;
  const status = { approve: 'approved', decline: 'declined', paid: 'paid', printing: 'printing' }[act];
  const { error } = await db.from('requests').update({ status }).eq('id', id);
  if (error) { alert('Could not update: ' + error.message); e.target.disabled = false; return; }

  const hi = `Hi ${r.customer_name},\n\n`;
  const cash = r.payment_method === 'cash';
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

loadProducts();
