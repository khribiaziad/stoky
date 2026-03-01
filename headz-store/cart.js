/**
 * cart.js — Headz cart drawer
 * Each page sets before this script:
 *   window.STOCKY_URL = 'https://your-backend.onrender.com'
 *   window.STOCKY_KEY = 'your_api_key'
 *   window.HEADZ_LANG = 'fr' (updated on lang change)
 */

// ── Lucide SVG icons (strokeWidth 1.75, same as Stocky) ──────────────────────
const IC = {
  x:       `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:    `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus:   `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash:   `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  cart:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  cartSm:  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  check:   `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  arrow:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  arrowL:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  tag:     `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  empty:   `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
};

// ── Bundle pricing ────────────────────────────────────────────────────────────
function calcBundle(qty) {
  if (qty <= 0) return { total: 0, save: 0, per: 0 };
  if (qty === 1) return { total: 99,      save: 0,       per: 99   };
  if (qty === 2) return { total: 123,     save: 75,      per: 61.5 };
  if (qty === 3) return { total: 159,     save: 138,     per: 53   };
  return           { total: qty * 50,  save: qty * 49, per: 50   };
}

// ── Translations ──────────────────────────────────────────────────────────────
const CART_T = {
  fr: {
    title: 'Mon panier', piece: 'article', pieces: 'articles',
    empty_title: 'Votre panier est vide', empty_sub: 'Parcourez la collection et ajoutez vos casquettes.',
    empty_cta: 'Voir la collection',
    saving: 'Réduction pack appliquée', total: 'Total',
    original: 'Prix sans remise',
    order_btn: 'Passer la commande', add_more: 'Continuer mes achats',
    form_title: 'Informations de livraison',
    form_name: 'Nom complet', form_phone: 'Téléphone', form_city: 'Ville',
    form_city_ph: '— Sélectionner votre ville', form_address: 'Adresse',
    form_notes: 'Notes (optionnel)', form_total: 'Total commande',
    bundle_discount: 'Réduction pack',
    confirm_btn: 'Confirmer la commande', back: 'Modifier la sélection',
    ok_title: 'Commande reçue !',
    ok_desc: 'Notre équipe vous contacte sur WhatsApp pour confirmer. Livraison sous 24–48h.',
    ok_back: 'Retour à la boutique',
    cod: 'Paiement à la livraison', delivery: 'Livraison 24–48h',
    toast: 'Ajouté au panier',
    err_name: 'Veuillez entrer votre nom complet',
    err_phone: 'Numéro invalide (min. 9 chiffres)',
    err_city: 'Veuillez sélectionner votre ville',
    err_address: 'Veuillez entrer votre adresse',
    err_server: 'Erreur de connexion. Commandez via WhatsApp.',
  },
  ar: {
    title: 'سلة الشراء', piece: 'قطعة', pieces: 'قطع',
    empty_title: 'سلتك فارغة', empty_sub: 'تصفح المجموعة وأضف قبعاتك.',
    empty_cta: 'اكتشف المجموعة',
    saving: 'خصم الحزمة مطبق', total: 'المجموع',
    original: 'السعر بدون خصم',
    order_btn: 'إتمام الطلب', add_more: 'مواصلة التسوق',
    form_title: 'معلومات التوصيل',
    form_name: 'الاسم الكامل', form_phone: 'رقم الهاتف', form_city: 'المدينة',
    form_city_ph: '— اختر مدينتك', form_address: 'العنوان',
    form_notes: 'ملاحظات (اختياري)', form_total: 'إجمالي الطلب',
    bundle_discount: 'خصم الحزمة',
    confirm_btn: 'تأكيد الطلب', back: 'تعديل الاختيار',
    ok_title: 'تم استلام طلبك !',
    ok_desc: 'سيتواصل معك فريقنا عبر واتساب لتأكيد الطلب. التوصيل خلال 24–48 ساعة.',
    ok_back: 'العودة للمتجر',
    cod: 'الدفع عند الاستلام', delivery: 'توصيل 24–48 ساعة',
    toast: 'أُضيف للسلة',
    err_name: 'يرجى إدخال اسمك الكامل',
    err_phone: 'رقم الهاتف غير صحيح',
    err_city: 'يرجى اختيار مدينتك',
    err_address: 'يرجى إدخال عنوانك',
    err_server: 'خطأ في الاتصال. اطلب عبر واتساب.',
  },
  en: {
    title: 'My cart', piece: 'item', pieces: 'items',
    empty_title: 'Your cart is empty', empty_sub: 'Browse the collection and add your caps.',
    empty_cta: 'View collection',
    saving: 'Bundle discount applied', total: 'Total',
    original: 'Price without discount',
    order_btn: 'Place order', add_more: 'Continue shopping',
    form_title: 'Delivery information',
    form_name: 'Full name', form_phone: 'Phone', form_city: 'City',
    form_city_ph: '— Select your city', form_address: 'Address',
    form_notes: 'Notes (optional)', form_total: 'Order total',
    bundle_discount: 'Bundle discount',
    confirm_btn: 'Confirm order', back: 'Edit selection',
    ok_title: 'Order received!',
    ok_desc: 'Our team will contact you on WhatsApp to confirm. Delivery in 24–48h.',
    ok_back: 'Back to shop',
    cod: 'Cash on delivery', delivery: 'Delivery 24–48h',
    toast: 'Added to cart',
    err_name: 'Please enter your full name',
    err_phone: 'Invalid number (min. 9 digits)',
    err_city: 'Please select your city',
    err_address: 'Please enter your address',
    err_server: 'Connection error. Please order via WhatsApp.',
  },
};

function ct(k) { const l = window.HEADZ_LANG || 'fr'; return (CART_T[l] || CART_T.fr)[k] || k; }

// ── Moroccan cities ───────────────────────────────────────────────────────────
const CART_CITIES = [
  "Casablanca","Rabat","Fès","Marrakech","Tanger","Meknès","Oujda","Kénitra",
  "Agadir","Tétouan","Safi","El Jadida","Khouribga","Mohammedia","Béni Mellal",
  "Nador","Laâyoune","Khémisset","Guelmim","Taza","Settat","Berkane","Larache",
  "Ksar El Kébir","Inzegan","Taourirt","Ouarzazate","Dakhla","Tiznit",
  "Essaouira","Errachidia","Chefchaouen","Ifrane","Zagora","Azrou",
];

// ── Cart state (localStorage) ─────────────────────────────────────────────────
const CART_KEY = 'headz_cart_v3';
function getCart()        { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } }
function saveCart(c)      { localStorage.setItem(CART_KEY, JSON.stringify(c)); _sync(); }
function cartTotalQty()   { return getCart().reduce((s, i) => s + i.qty, 0); }

// item: { productId, colorIdx, name, colorNames:{fr,ar,en}, colorHex, img, qty }
function addToCart(item) {
  const cart = getCart();
  const ex = cart.find(i => i.productId === item.productId && i.colorIdx === item.colorIdx);
  ex ? (ex.qty += item.qty) : cart.push(item);
  saveCart(cart);
  _toast();
}
function removeCartItem(pid, cidx) { saveCart(getCart().filter(i => !(i.productId === pid && i.colorIdx === cidx))); _renderItems(); }
function changeCartQty(pid, cidx, d) {
  const cart = getCart();
  const item = cart.find(i => i.productId === pid && i.colorIdx === cidx);
  if (!item) return;
  item.qty = Math.max(1, item.qty + d);
  saveCart(cart);
  _renderItems();
}

// ── Badge / FAB sync ──────────────────────────────────────────────────────────
function _sync() {
  const n = cartTotalQty();
  document.querySelectorAll('.hc-badge').forEach(el => { el.textContent = n; el.style.display = n > 0 ? 'flex' : 'none'; });
  const fab = document.getElementById('hc-fab');
  if (fab) { fab.style.opacity = n > 0 ? '1' : '0'; fab.style.pointerEvents = n > 0 ? 'all' : 'none'; }
  const fabN = document.getElementById('hc-fab-n');
  if (fabN) fabN.textContent = n;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function _toast() {
  const el = document.getElementById('hc-toast');
  if (!el) return;
  el.innerHTML = IC.cartSm + '<span>' + ct('toast') + '</span>';
  el.classList.add('show');
  _sync();
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Open / Close ──────────────────────────────────────────────────────────────
function openCart() {
  document.getElementById('hc-overlay').classList.add('open');
  document.getElementById('hc-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  _setState('items');
  _renderItems();
}
function closeCart() {
  document.getElementById('hc-overlay').classList.remove('open');
  document.getElementById('hc-drawer').classList.remove('open');
  document.body.style.overflow = '';
}
function _setState(s) {
  ['items','form','ok'].forEach(st => {
    document.getElementById('hc-s-' + st).style.display = st === s ? 'flex' : 'none';
  });
}

// ── Render items + footer ─────────────────────────────────────────────────────
function _renderItems() {
  const cart = getCart();
  const lang = window.HEADZ_LANG || 'fr';
  const list = document.getElementById('hc-list');
  const foot = document.getElementById('hc-foot');

  // Update header count
  const n = cartTotalQty();
  const hdr = document.getElementById('hc-hdr-count');
  if (hdr) hdr.textContent = n > 0 ? ' (' + n + ')' : '';

  if (!cart.length) {
    list.innerHTML = '<div class="hc-empty"><div class="hc-empty-ico">' + IC.empty + '</div>'
      + '<div class="hc-empty-t">' + ct('empty_title') + '</div>'
      + '<div class="hc-empty-s">' + ct('empty_sub') + '</div>'
      + '<a href="index.html" class="hc-empty-a" onclick="closeCart()">' + ct('empty_cta') + ' ' + IC.arrow + '</a>'
      + '</div>';
    foot.innerHTML = '';
    return;
  }

  const totalQty = n;
  const b = calcBundle(totalQty);
  const orig = totalQty * 99;

  list.innerHTML = cart.map(item => {
    const cname = (item.colorNames && item.colorNames[lang]) || item.colorNames?.fr || '';
    return '<div class="hc-item">'
      + '<img class="hc-item-img" src="' + item.img + '" alt="' + item.name + '" loading="lazy"/>'
      + '<div class="hc-item-body">'
      + '<div class="hc-item-name">' + item.name + '</div>'
      + (cname ? '<div class="hc-item-color"><span class="hc-dot" style="background:' + item.colorHex + '"></span>' + cname + '</div>' : '')
      + '<div class="hc-item-row">'
      + '<div class="hc-qty"><button class="hc-qbtn" onclick="changeCartQty(\'' + item.productId + '\',' + item.colorIdx + ',-1)">' + IC.minus + '</button>'
      + '<span class="hc-qval">' + item.qty + '</span>'
      + '<button class="hc-qbtn" onclick="changeCartQty(\'' + item.productId + '\',' + item.colorIdx + ',1)">' + IC.plus + '</button></div>'
      + '<span class="hc-item-price">' + (item.qty * 99) + ' MAD</span>'
      + '</div></div>'
      + '<button class="hc-del" onclick="removeCartItem(\'' + item.productId + '\',' + item.colorIdx + ')" title="Supprimer">' + IC.trash + '</button>'
      + '</div>';
  }).join('');

  let footHtml = '';
  if (b.save > 0) {
    footHtml += '<div class="hc-saving">'
      + '<span class="hc-saving-l">' + IC.tag + ' ' + ct('saving') + '</span>'
      + '<span class="hc-saving-r">−' + b.save + ' MAD</span>'
      + '</div>';
  }
  footHtml += '<div class="hc-total-row">'
    + '<span class="hc-total-lbl">' + ct('total') + '</span>'
    + '<div class="hc-total-right">'
    + (b.save > 0 ? '<span class="hc-orig">' + orig + ' MAD</span>' : '')
    + '<span class="hc-total-amt">' + b.total + ' MAD</span>'
    + '</div></div>'
    + '<button class="hc-order-btn" onclick="_goForm()">' + ct('order_btn') + ' ' + IC.arrow + '</button>'
    + '<button class="hc-more-btn" onclick="closeCart()">' + ct('add_more') + '</button>';
  foot.innerHTML = footHtml;
}

// ── Order form ────────────────────────────────────────────────────────────────
function _goForm() {
  _setState('form');
  const cart = getCart();
  const lang = window.HEADZ_LANG || 'fr';
  const b = calcBundle(cartTotalQty());
  const orig = cartTotalQty() * 99;

  // Summary
  let sum = cart.map(item => {
    const cn = (item.colorNames?.[lang]) || item.colorNames?.fr || '';
    return '<div class="hf-row"><span>' + item.name + (cn ? ' — ' + cn : '') + '</span><span>' + item.qty + ' × 99 MAD</span></div>';
  }).join('');
  if (b.save > 0) sum += '<div class="hf-row hf-save"><span>' + IC.tag + ' ' + ct('bundle_discount') + '</span><span>−' + b.save + ' MAD</span></div>';
  sum += '<div class="hf-row hf-total"><span>' + ct('form_total') + '</span><span>' + b.total + ' MAD</span></div>';
  sum += '<div class="hf-cod">' + ct('cod') + ' · ' + ct('delivery') + '</div>';
  document.getElementById('hf-sum').innerHTML = sum;

  // City options
  const sel = document.getElementById('hf-city');
  sel.innerHTML = '<option value="">' + ct('form_city_ph') + '</option>';
  CART_CITIES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });

  // Labels
  _ql('#hf-t-title').textContent    = ct('form_title');
  _ql('#hf-l-name').textContent     = ct('form_name');
  _ql('#hf-l-phone').textContent    = ct('form_phone');
  _ql('#hf-l-city').textContent     = ct('form_city');
  _ql('#hf-l-address').textContent  = ct('form_address');
  _ql('#hf-l-notes').textContent    = ct('form_notes');
  _ql('#hf-submit').textContent     = ct('confirm_btn');
  _ql('#hf-back').innerHTML         = IC.arrowL + ' ' + ct('back');
}

function _ql(s) { return document.querySelector(s); }

async function submitCartOrder() {
  const t = CART_T[window.HEADZ_LANG || 'fr'] || CART_T.fr;
  const btn = _ql('#hf-submit');
  const err = _ql('#hf-err');
  const name    = _ql('#hf-name').value.trim();
  const phone   = _ql('#hf-phone').value.trim().replace(/\s+/g,'');
  const city    = _ql('#hf-city').value;
  const address = _ql('#hf-address').value.trim();
  const notes   = _ql('#hf-notes').value.trim();

  err.style.display = 'none';
  if (!name)                                    return _ferr(t.err_name);
  if (phone.replace(/\D/g,'').length < 9)       return _ferr(t.err_phone);
  if (!city)                                    return _ferr(t.err_city);
  if (!address)                                 return _ferr(t.err_address);

  const lang = window.HEADZ_LANG || 'fr';
  const items = getCart().map(i => ({
    product_name: i.name + (i.colorNames?.en ? ' - ' + i.colorNames.en : ''),
    quantity: i.qty,
  }));

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch((window.STOCKY_URL||'') + '/api/leads/inbound?api_key=' + (window.STOCKY_KEY||''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, customer_phone: phone, customer_city: city, customer_address: address, notes: notes||undefined, items }),
    });
    if (!res.ok) { const d = await res.json().catch(()=>{}); throw new Error(d?.detail || res.status); }
    localStorage.removeItem(CART_KEY);
    _sync();
    _setState('ok');
    _ql('#hc-ok-t').textContent = t.ok_title;
    _ql('#hc-ok-d').textContent = t.ok_desc;
    _ql('#hc-ok-b').textContent = t.ok_back;
  } catch {
    _ferr(t.err_server);
    btn.disabled = false;
    btn.textContent = t.confirm_btn;
  }
}

function _ferr(m) { const el = _ql('#hf-err'); el.textContent = m; el.style.display = 'block'; }

// ── Inject styles ─────────────────────────────────────────────────────────────
document.head.insertAdjacentHTML('beforeend', `<style>
  /* Overlay */
  .hc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:500;opacity:0;pointer-events:none;transition:opacity .3s}
  .hc-overlay.open{opacity:1;pointer-events:all}
  /* Drawer */
  .hc-drawer{position:fixed;right:0;top:0;bottom:0;width:420px;max-width:100vw;background:#fff;z-index:501;transform:translateX(105%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;font-family:'Inter',sans-serif;box-shadow:-8px 0 40px rgba(0,0,0,0.12)}
  .hc-drawer.open{transform:translateX(0)}
  html[dir=rtl] .hc-drawer{right:auto;left:0;transform:translateX(-105%);box-shadow:8px 0 40px rgba(0,0,0,0.12)}
  html[dir=rtl] .hc-drawer.open{transform:translateX(0)}
  /* Header */
  .hc-hdr{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #eee;flex-shrink:0}
  .hc-hdr-t{font-size:15px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:8px}
  .hc-hdr-n{font-size:13px;color:#999;font-weight:400}
  .hc-hdr-close{background:none;border:none;cursor:pointer;color:#999;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background .2s}
  .hc-hdr-close:hover{background:#f5f5f5;color:#000}
  /* States */
  .hc-s-items{flex:1;overflow:hidden;flex-direction:column}
  .hc-s-form{flex:1;overflow-y:auto;flex-direction:column}
  .hc-s-ok{flex:1;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center;gap:12px}
  /* Item list */
  .hc-list{flex:1;overflow-y:auto;padding:0 20px}
  .hc-item{display:flex;align-items:flex-start;gap:12px;padding:16px 0;border-bottom:1px solid #f5f5f5}
  .hc-item-img{width:68px;height:68px;object-fit:cover;background:#f7f7f7;flex-shrink:0}
  .hc-item-body{flex:1;min-width:0}
  .hc-item-name{font-size:13px;font-weight:600;line-height:1.3;margin-bottom:3px}
  .hc-item-color{font-size:11px;color:#999;display:flex;align-items:center;gap:5px;margin-bottom:8px}
  .hc-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;border:1px solid rgba(0,0,0,0.1)}
  .hc-item-row{display:flex;align-items:center;justify-content:space-between}
  .hc-qty{display:flex;align-items:center;border:1px solid #e5e5e5}
  .hc-qbtn{width:28px;height:28px;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#555;transition:background .15s}
  .hc-qbtn:hover{background:#f5f5f5}
  .hc-qval{width:32px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5}
  .hc-item-price{font-size:13px;font-weight:700;color:#555}
  .hc-del{background:none;border:none;cursor:pointer;color:#ccc;padding:6px;flex-shrink:0;align-self:center;display:flex;transition:color .2s}
  .hc-del:hover{color:#333}
  /* Empty */
  .hc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:56px 24px;color:#aaa;text-align:center}
  .hc-empty-ico{color:#ddd;margin-bottom:4px}
  .hc-empty-t{font-size:15px;font-weight:600;color:#555}
  .hc-empty-s{font-size:13px;color:#aaa;max-width:220px;line-height:1.5}
  .hc-empty-a{display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:#0a0a0a;font-size:13px;font-weight:600;text-decoration:none;border-bottom:1px solid currentColor}
  /* Footer */
  .hc-foot{border-top:1px solid #eee;padding:16px 20px;flex-shrink:0}
  .hc-saving{background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;color:#15803d}
  .hc-saving-l{display:flex;align-items:center;gap:6px}
  .hc-saving-r{font-weight:700}
  .hc-total-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
  .hc-total-lbl{font-size:13px;color:#888}
  .hc-total-right{display:flex;align-items:baseline;gap:8px}
  .hc-orig{font-size:14px;color:#ccc;text-decoration:line-through}
  .hc-total-amt{font-size:28px;font-weight:800;letter-spacing:-1px;color:#0a0a0a}
  .hc-order-btn{width:100%;padding:15px;background:#0a0a0a;color:#fff;border:none;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'Inter',sans-serif;margin-bottom:10px;transition:opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
  .hc-order-btn:hover{opacity:.85}
  .hc-more-btn{width:100%;background:none;border:none;font-size:12px;color:#999;cursor:pointer;font-family:'Inter',sans-serif;padding:4px;transition:color .2s}
  .hc-more-btn:hover{color:#0a0a0a}
  /* Form */
  .hf-inner{padding:20px 20px 32px;flex:1}
  .hf-title{font-size:15px;font-weight:700;margin-bottom:16px}
  .hf-sum{background:#f7f7f7;padding:14px;margin-bottom:18px}
  .hf-row{display:flex;justify-content:space-between;font-size:12px;color:#555;margin-bottom:5px}
  .hf-save{color:#15803d;font-weight:600;display:flex;align-items:center;gap:6px}
  .hf-total{font-weight:700;font-size:14px;color:#0a0a0a;border-top:1px solid #e5e5e5;padding-top:8px;margin-top:4px}
  .hf-cod{font-size:10px;color:#aaa;margin-top:6px}
  .hf-field{margin-bottom:12px}
  .hf-label{display:block;font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999;margin-bottom:5px}
  .hf-input{width:100%;height:44px;padding:0 12px;border:1.5px solid #ddd;font-size:14px;font-family:'Inter',sans-serif;color:#0a0a0a;outline:none;transition:border-color .2s;-webkit-appearance:none;background:#fff;border-radius:0}
  .hf-input:focus{border-color:#0a0a0a}
  select.hf-input{cursor:pointer}
  textarea.hf-input{height:auto;min-height:58px;padding:10px 12px;resize:vertical}
  .hf-err{color:#dc2626;font-size:12px;margin-bottom:10px;display:none}
  .hf-submit{width:100%;padding:15px;background:#0a0a0a;color:#fff;border:none;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'Inter',sans-serif;transition:opacity .2s;margin-bottom:10px}
  .hf-submit:disabled{opacity:.4;cursor:not-allowed}
  .hf-submit:not(:disabled):hover{opacity:.85}
  .hf-back{width:100%;background:none;border:none;font-size:12px;color:#999;cursor:pointer;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px;transition:color .2s}
  .hf-back:hover{color:#0a0a0a}
  /* Success */
  .hc-ok-ico{color:#15803d}
  .hc-ok-t{font-size:20px;font-weight:800;letter-spacing:-.5px}
  .hc-ok-d{font-size:13px;color:#888;line-height:1.7;max-width:280px}
  .hc-ok-b{display:inline-block;margin-top:8px;padding:12px 24px;background:#0a0a0a;color:#fff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase}
  /* FAB */
  #hc-fab{position:fixed;bottom:24px;right:24px;background:#0a0a0a;color:#fff;border:none;padding:12px 18px;font-size:13px;font-weight:600;cursor:pointer;z-index:400;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);font-family:'Inter',sans-serif;opacity:0;pointer-events:none;transition:opacity .3s}
  #hc-fab:hover{opacity:.85!important}
  html[dir=rtl] #hc-fab{right:auto;left:24px}
  .hc-fab-n{background:#fff;color:#0a0a0a;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
  /* Badge on nav button */
  .hc-badge{background:#0a0a0a;color:#fff;width:17px;height:17px;border-radius:50%;font-size:9px;font-weight:800;display:none;align-items:center;justify-content:center}
  /* Toast */
  #hc-toast{position:fixed;top:74px;right:20px;background:#0a0a0a;color:#fff;padding:11px 16px;font-size:13px;font-weight:500;z-index:600;transform:translateY(-6px);opacity:0;transition:all .3s ease;pointer-events:none;font-family:'Inter',sans-serif;display:flex;align-items:center;gap:8px}
  #hc-toast.show{transform:translateY(0);opacity:1}
  html[dir=rtl] #hc-toast{right:auto;left:20px}
</style>`);

// ── Inject HTML ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="hc-overlay" id="hc-overlay" onclick="closeCart()"></div>
    <div class="hc-drawer" id="hc-drawer">
      <div class="hc-hdr">
        <div class="hc-hdr-t">${IC.cart}<span id="hc-hdr-tl">Mon panier</span><span class="hc-hdr-n" id="hc-hdr-count"></span></div>
        <button class="hc-hdr-close" onclick="closeCart()">${IC.x}</button>
      </div>

      <div class="hc-s-items" id="hc-s-items" style="display:flex">
        <div class="hc-list" id="hc-list"></div>
        <div class="hc-foot" id="hc-foot"></div>
      </div>

      <div class="hc-s-form" id="hc-s-form" style="display:none">
        <div class="hf-inner">
          <div class="hf-title" id="hf-t-title">Livraison</div>
          <div class="hf-sum" id="hf-sum"></div>
          <div class="hf-field"><label class="hf-label" id="hf-l-name">Nom</label><input class="hf-input" id="hf-name" type="text" autocomplete="name"/></div>
          <div class="hf-field"><label class="hf-label" id="hf-l-phone">Téléphone</label><input class="hf-input" id="hf-phone" type="tel" placeholder="06XXXXXXXX" autocomplete="tel"/></div>
          <div class="hf-field"><label class="hf-label" id="hf-l-city">Ville</label><select class="hf-input" id="hf-city"></select></div>
          <div class="hf-field"><label class="hf-label" id="hf-l-address">Adresse</label><input class="hf-input" id="hf-address" type="text" autocomplete="street-address"/></div>
          <div class="hf-field"><label class="hf-label" id="hf-l-notes">Notes</label><textarea class="hf-input" id="hf-notes" rows="2"></textarea></div>
          <div class="hf-err" id="hf-err"></div>
          <button class="hf-submit" id="hf-submit" onclick="submitCartOrder()">Confirmer</button>
          <button class="hf-back" id="hf-back" onclick="_setState('items');_renderItems()"></button>
        </div>
      </div>

      <div class="hc-s-ok" id="hc-s-ok" style="display:none">
        <div class="hc-ok-ico">${IC.check}</div>
        <div class="hc-ok-t" id="hc-ok-t"></div>
        <div class="hc-ok-d" id="hc-ok-d"></div>
        <a href="index.html" class="hc-ok-b" id="hc-ok-b" onclick="closeCart()"></a>
      </div>
    </div>

    <button id="hc-fab" onclick="openCart()">
      ${IC.cartSm} <span id="hc-fab-n">0</span>
    </button>
    <div id="hc-toast"></div>
  `);

  _sync();
});
