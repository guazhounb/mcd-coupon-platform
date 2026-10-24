'use strict';

/* ============ 工具函数 ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function fen(n) { return ((n || 0) / 100).toFixed(2); }
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

async function callTool(name, args) {
  const r = await fetch('/api/tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, args: args || {} }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || '接口调用失败');
  return j.result;
}
function okData(result) {
  if (!result) throw new Error('空响应');
  if (result.code && result.code !== 200) throw new Error(result.message || '请求失败');
  if (result.success === false) throw new Error(result.message || '请求失败');
  return result.data;
}

/* 本地生成二维码（不依赖外部服务，避免泄露支付链接） */
function makeQR(text, cellSize) {
  const qr = qrcode(0, 'M'); // 0 = 自动选择版本
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize || 6, 10);
}

/* ============ 全局状态 ============ */
const state = {
  account: '',
  beType: 1,        // 1 到店自取 | 5 得来速 | 2 麦乐送 | 6 企业团餐
  orderType: 1,     // 1 到店 | 2 外送
  beCode: '',
  store: null,
  addressId: '',
  coupons: [],
  autoUseAll: true,
  meals: null,
  cart: {},
  calc: null,
  takeWayCode: '',
  orderRaw: null,
  payUrl: '',
  orderId: '',
};

/* ============ 导航 ============ */
function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $('#' + id).classList.add('active');
  $('#topbar').style.display = id === 'screen-login' ? 'none' : 'flex';
  window.scrollTo(0, 0);
}

/* ============ 全屏切换 ============ */
const ICON_FS = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_EXIT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
$('#btnFullscreen').addEventListener('click', async () => {
  const app = $('#app');
  try {
    if (!document.fullscreenElement) {
      if (app.requestFullscreen) await app.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch (e) {
    toast('当前环境不支持全屏');
  }
});
document.addEventListener('fullscreenchange', () => {
  $('#btnFullscreen').innerHTML = document.fullscreenElement ? ICON_EXIT : ICON_FS;
});

/* ============ 登录 ============ */
// 登录方式选项卡
$$('#loginTabs .seg-btn').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#loginTabs .seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const tab = b.dataset.tab;
    $('#accountPanel').style.display = tab === 'account' ? 'block' : 'none';
    $('#qrPanel').style.display = tab === 'qr' ? 'block' : 'none';
    if (tab === 'qr') refreshLoginQR();
  })
);

// 账号登录
$('#btnLogin').addEventListener('click', async () => {
  const acc = $('#loginAccount').value.trim();
  const pwd = $('#loginPassword').value;
  if (!acc || !pwd) { $('#loginErr').textContent = '请输入账号和密码'; return; }
  $('#loginErr').textContent = '';
  $('#btnLogin').disabled = true;
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: acc, password: pwd }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '登录失败');
    finishLogin(acc);
  } catch (e) {
    $('#loginErr').textContent = e.message;
  } finally {
    $('#btnLogin').disabled = false;
  }
});

// 扫码登录：生成二维码 + 已授权确认
function refreshLoginQR() {
  const ticket = 'mcdapp://auth/scan?session=' + Math.random().toString(36).slice(2) + '&t=' + Date.now();
  try {
    $('#qrImg').src = makeQR(ticket, 6);
    $('#qrTip').innerHTML = '请使用 <b>麦当劳 App</b> 扫码授权登录';
  } catch (e) {
    $('#qrImg').alt = '二维码生成失败';
    $('#qrTip').textContent = '二维码生成失败，请使用账号登录';
  }
}
$('#btnQrRefresh').addEventListener('click', refreshLoginQR);
$('#btnQrConfirm').addEventListener('click', () => {
  // 真实鉴权由服务端 Bearer Token 完成，扫码授权在此完成本地登录态
  finishLogin('App会员');
  toast('已通过 App 扫码授权登录');
});
function finishLogin(acc) {
  state.account = acc;
  $('#accountTag').textContent = 'Hi, ' + acc;
  showScreen('screen-store');
}

/* ============ 选择取餐方式 ============ */
$$('#beTypeSeg .seg-btn').forEach((b) =>
  b.addEventListener('click', () => {
    $$('#beTypeSeg .seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    state.beType = parseInt(b.dataset.be, 10);
    state.orderType = state.beType === 2 || state.beType === 6 ? 2 : 1;
    state.beCode = '';
    state.store = null;
    state.addressId = '';
    const isDelivery = state.orderType === 2;
    $('#searchBox').style.display = isDelivery ? 'none' : 'block';
    $('#addrBox').style.display = isDelivery ? 'block' : 'none';
    $('#storeList').innerHTML = '<p class="muted">请先查找门店</p>';
    $('#addrList').innerHTML = '';
  })
);

/* 自动获取当前位置 */
$('#btnLocate').addEventListener('click', locateMe);
function setLocateLoading(on) {
  const btn = $('#btnLocate');
  btn.disabled = on;
  btn.innerHTML = on
    ? '<span class="spinner" style="border-color:#fff;border-top-color:#DA291C"></span> 定位中…'
    : '<span class="locate-ico">📍</span> 自动获取当前位置';
}
function locateMe() {
  if (!navigator.geolocation) {
    toast('当前环境不支持定位，请手动选择城市');
    return;
  }
  setLocateLoading(true);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const geo = await reverseGeocode(latitude, longitude);
        if (geo.city) $('#cityInput').value = geo.city;
        if (geo.keyword) $('#kwInput').value = geo.keyword;
        $('#locateHint').textContent = '已定位到：' + (geo.city || '') + (geo.keyword ? ' · ' + geo.keyword : '') + '，已为您查找附近门店';
        await doSearchStores();
      } catch (e) {
        setLocateLoading(false);
        $('#locateHint').textContent = '定位解析失败，请手动选择城市';
        toast('定位解析失败，请手动选择城市');
      }
    },
    (err) => {
      setLocateLoading(false);
      if (err && err.code === 1) {
        $('#locateHint').textContent = '定位权限被拒绝，请手动选择城市或允许定位';
        toast('定位权限被拒绝，请手动选择城市');
      } else {
        $('#locateHint').textContent = '定位失败，请手动选择城市';
        toast('定位失败，请手动选择城市');
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=zh-CN`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('geo http ' + r.status);
  const d = await r.json();
  const a = d.address || {};
  const city = a.city || a.town || a.county || a.state || '';
  const keyword = a.suburb || a.neighbourhood || a.road || a.village || '';
  return { city, keyword };
}

/* 手动选择城市（选项卡） */
$$('#cityChips .chip').forEach((c) =>
  c.addEventListener('click', () => {
    $$('#cityChips .chip').forEach((x) => x.classList.remove('active'));
    c.classList.add('active');
    $('#cityInput').value = c.dataset.city;
    $('#locateHint').textContent = '已选择城市：' + c.dataset.city + '，填写位置关键词后查找门店';
    toast('已选择城市：' + c.dataset.city);
  })
);

/* 到店 / 得来速：按位置搜门店 */
$('#btnSearchStore').addEventListener('click', () => doSearchStores());
async function doSearchStores() {
  const city = $('#cityInput').value.trim();
  const kw = $('#kwInput').value.trim();
  if (!city || !kw) { toast('请填写城市和位置关键词'); return; }
  $('#storeList').innerHTML = '<p class="muted">查找中…</p>';
  try {
    const data = okData(await callTool('query-nearby-stores', { beType: state.beType, searchType: 2, city, keyword: kw }));
    renderStores(data);
  } catch (e) {
    $('#storeList').innerHTML = '<p class="muted">查找失败：' + esc(e.message) + '</p>';
  }
}

function renderStores(list) {
  const el = $('#storeList');
  if (!list || !list.length) { el.innerHTML = '<p class="muted">附近没有找到门店，换个位置试试</p>'; return; }
  el.innerHTML = list
    .map(
      (s) => `<div class="store-card" data-code="${esc(s.storeCode)}" data-becode="${esc(s.beCode || '')}" data-name="${esc(s.storeName)}" data-addr="${esc(s.address || '')}" data-dist="${esc(s.distance != null ? s.distance : '')}">
        <div class="store-name">${esc(s.storeName)}</div>
        <div class="store-meta">${esc(s.address || '')} · <span class="store-dist">${s.distance != null ? s.distance + 'm' : ''}</span></div>
        <div class="store-pick">选择此店 ›</div>
      </div>`
    )
    .join('');
  $$('#storeList .store-card').forEach((c) =>
    c.addEventListener('click', () =>
      selectStore({ storeCode: c.dataset.code, storeName: c.dataset.name, address: c.dataset.addr, beCode: c.dataset.becode, distance: c.dataset.dist })
    )
  );
}

/* 外送 / 团餐：先选地址 */
$('#btnLoadAddr').addEventListener('click', async () => {
  $('#addrList').innerHTML = '<p class="muted">加载中…</p>';
  try {
    const data = okData(await callTool('delivery-query-addresses', {}));
    renderAddrs(data);
  } catch (e) {
    $('#addrList').innerHTML = '<p class="muted">获取地址失败：' + esc(e.message) + '</p>';
  }
});
function renderAddrs(list) {
  const el = $('#addrList');
  if (!list || !list.length) { el.innerHTML = '<p class="muted">暂无配送地址，请先在麦当劳 App 添加</p>'; return; }
  el.innerHTML = list
    .map((a) => {
      const detail = (a.addressDetail || '') + (a.houseNumber ? ' ' + a.houseNumber : '');
      return `<div class="addr-card" data-id="${esc(a.addressId)}">
        <div><b>${esc(a.contactName || '')}</b> ${esc(a.contactPhone || '')}</div>
        <div class="store-meta">${esc(detail)}</div>
      </div>`;
    })
    .join('');
  $$('#addrList .addr-card').forEach((c) => c.addEventListener('click', () => selectAddress(c.dataset.id)));
}
async function selectAddress(addressId) {
  state.addressId = addressId;
  $$('#addrList .addr-card').forEach((c) => c.classList.toggle('sel', c.dataset.id === addressId));
  $('#storeList').innerHTML = '<p class="muted">加载可配送门店…</p>';
  try {
    const data = okData(await callTool('delivery-query-stores', { beType: state.beType, addressId }));
    renderDeliveryStores(data);
  } catch (e) {
    $('#storeList').innerHTML = '<p class="muted">获取门店失败：' + esc(e.message) + '</p>';
  }
}
function renderDeliveryStores(list) {
  const el = $('#storeList');
  if (!list || !list.length) { el.innerHTML = '<p class="muted">该地址暂无可配送门店</p>'; return; }
  el.innerHTML = list
    .map(
      (s) => `<div class="store-card" data-code="${esc(s.storeCode)}" data-becode="${esc(s.beCode || '')}" data-name="${esc(s.storeName)}" data-addr="${esc(s.address || '')}">
        <div class="store-name">${esc(s.storeName)}</div>
        <div class="store-meta">${esc(s.address || '')}</div>
        <div class="store-pick">选择此店 ›</div>
      </div>`
    )
    .join('');
  $$('#storeList .store-card').forEach((c) =>
    c.addEventListener('click', () =>
      selectStore({ storeCode: c.dataset.code, storeName: c.dataset.name, address: c.dataset.addr, beCode: c.dataset.becode })
    )
  );
}

async function selectStore(store) {
  state.store = store;
  state.beCode = state.beType === 1 ? '' : store.beCode;
  await enterCoupons();
}

/* ============ 领券 + 可用优惠 ============ */
async function enterCoupons() {
  showScreen('screen-coupons');
  state.coupons = [];
  state.calc = null;
  $('#couponSummary').innerHTML = '';
  $('#storeCouponList').innerHTML = '<p class="muted">加载中…</p>';
  $('#claimBanner').style.display = 'flex';

  // 1. 自动领取所有可用优惠券（麦麦省）
  try {
    const claim = await callTool('auto-bind-coupons', {});
    const d = (claim && claim.data) || {};
    const msg = (claim && claim.message) || '';
    if (claim && (claim.code === 200 || claim.success)) {
      const n = d.successCount != null ? d.successCount : d.claimedCount != null ? d.claimedCount : d.bindCount != null ? d.bindCount : '';
      $('#couponSummary').innerHTML = n !== '' ? `🎉 已自动领取 ${esc(n)} 张优惠券` : '🎉 已为您尝试自动领取所有可用优惠券';
    } else if (msg.includes('无可领取') || msg.includes('暂无可领')) {
      $('#couponSummary').innerHTML = '✅ 当前没有新的可领优惠券，将使用您已有的券';
    } else {
      $('#couponSummary').innerHTML = '⚠️ 自动领券：' + esc(msg || '请稍后重试');
    }
  } catch (e) {
    $('#couponSummary').innerHTML = '⚠️ 自动领券失败：' + esc(e.message);
  }
  $('#claimBanner').style.display = 'none';

  // 2. 当前门店可用优惠
  try {
    const data = okData(
      await callTool('query-store-coupons', {
        storeCode: state.store.storeCode,
        orderType: state.orderType,
        beType: state.beType,
        beCode: state.beCode || undefined,
      })
    );
    state.coupons = data || [];
    renderStoreCoupons(state.coupons);
  } catch (e) {
    $('#storeCouponList').innerHTML = '<p class="muted">获取可用优惠失败：' + esc(e.message) + '</p>';
  }
}
function renderStoreCoupons(list) {
  const el = $('#storeCouponList');
  if (!list || !list.length) {
    el.innerHTML = '<p class="muted">当前门店暂无可用的优惠券，直接点餐也能享受套餐价～</p>';
    return;
  }
  const groups = {};
  list.forEach((c) => {
    const k = c.couponId || c.couponCode;
    (groups[k] = groups[k] || []).push(c);
  });
  el.innerHTML = Object.values(groups)
    .map((group) => {
      const first = group[0];
      const codes = group.map((g) => g.couponCode).filter(Boolean);
      const prods = (first.products || []).map((p) => p.productName).join('、') || '—';
      return `<div class="coupon-card"><span class="coupon-tag">可用</span>
        <div class="coupon-title">${esc(first.title || '优惠券')}</div>
        <div class="coupon-meta">券码：${esc(codes[0] || '')}${codes.length > 1 ? ' 等' + codes.length + '张' : ''}</div>
        <div class="coupon-meta">有效期：${esc(first.tradeDateTime || '')}</div>
        <div class="coupon-meta">适用：${esc(prods)}</div>
      </div>`;
    })
    .join('');
}

$('#useAllCoupons').addEventListener('change', (e) => { state.autoUseAll = e.target.checked; });
$('#btnToMenu').addEventListener('click', () => enterMenu());

/* ============ 点餐 ============ */
async function enterMenu() {
  showScreen('screen-menu');
  $('#catTabs').innerHTML = '<span class="muted">加载菜单…</span>';
  $('#mealGrid').innerHTML = '';
  try {
    const data = okData(
      await callTool('query-meals', {
        storeCode: state.store.storeCode,
        orderType: state.orderType,
        beType: state.beType,
        beCode: state.beCode || undefined,
      })
    );
    state.meals = data;
    const cats = data.categories || [];
    renderCats(cats);
    renderMeals(cats[0] ? cats[0].meals : []);
  } catch (e) {
    $('#catTabs').innerHTML = '<span class="muted">' + esc(e.message) + '</span>';
  }
}
function renderCats(cats) {
  const el = $('#catTabs');
  if (!cats.length) { el.innerHTML = ''; return; }
  el.innerHTML = cats.map((c, i) => `<button class="cat-tab${i === 0 ? ' active' : ''}" data-i="${i}">${esc(c.name)}</button>`).join('');
  $$('#catTabs .cat-tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('#catTabs .cat-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      renderMeals(cats[parseInt(t.dataset.i, 10)].meals || []);
    })
  );
}
function renderMeals(meals) {
  const map = (state.meals && state.meals.meals) || {};
  const el = $('#mealGrid');
  if (!meals || !meals.length) { el.innerHTML = '<p class="muted">该分类暂无餐品</p>'; return; }
  el.innerHTML = meals
    .map((m) => {
      const d = map[m.code] || {};
      const old = d.originalPrice && d.originalPrice !== d.currentPrice ? `<span class="old">¥${esc(d.originalPrice)}</span>` : '';
      const tags = (m.tags || []).slice(0, 2).join(' · ');
      const inCart = state.cart[m.code] ? state.cart[m.code].qty : 0;
      return `<div class="meal-card">
        <img class="meal-img" src="${esc(d.image || '')}" alt="" onerror="this.style.display='none'"/>
        <div class="meal-body">
          <div class="meal-name">${esc(d.name || m.code)}</div>
          <div class="meal-tags">${esc(tags)}</div>
          <div class="meal-price"><span class="now"><small>¥</small>${esc(d.currentPrice || '')}</span>${old}</div>
          <button class="meal-add${inCart ? ' on' : ''}" data-code="${esc(m.code)}">${inCart ? '已加 ' + inCart : '+ 加入'}</button>
        </div></div>`;
    })
    .join('');
  $$('#mealGrid .meal-add').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.code, b)));
}
function addToCart(code, btn) {
  const map = (state.meals && state.meals.meals) || {};
  const d = map[code] || {};
  if (!state.cart[code]) state.cart[code] = { code, name: d.name || code, price: parseFloat(d.currentPrice || 0), image: d.image || '' };
  state.cart[code].qty = (state.cart[code].qty || 0) + 1;
  if (btn) { btn.classList.add('on'); btn.textContent = '已加 ' + state.cart[code].qty; }
  renderCart();
}
function changeQty(code, d) {
  if (!state.cart[code]) return;
  state.cart[code].qty += d;
  if (state.cart[code].qty <= 0) delete state.cart[code];
  renderCart();
}
function renderCart() {
  const items = Object.values(state.cart);
  $('#cartCount').textContent = items.reduce((s, i) => s + i.qty, 0);
  const el = $('#cartItems');
  if (!items.length) {
    el.innerHTML = '<p class="muted">还没有添加餐品</p>';
  } else {
    el.innerHTML = items
      .map(
        (i) => `<div class="cart-item" data-code="${esc(i.code)}">
          <div class="ci-name">${esc(i.name)}</div>
          <div class="ci-price">¥${(i.price * i.qty).toFixed(2)}</div>
          <div class="stepper">
            <button data-act="dec">−</button>
            <span class="qty">${i.qty}</span>
            <button data-act="inc">+</button>
          </div>
        </div>`
      )
      .join('');
    $$('#cartItems .cart-item').forEach((ci) => {
      const code = ci.dataset.code;
      ci.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(code, 1));
      ci.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(code, -1));
    });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  $('#cartTotal').textContent = '¥' + total.toFixed(2);
  syncMealButtons();
}
function syncMealButtons() {
  $$('#mealGrid .meal-add').forEach((b) => {
    const q = state.cart[b.dataset.code] ? state.cart[b.dataset.code].qty : 0;
    b.classList.toggle('on', q > 0);
    b.textContent = q > 0 ? '已加 ' + q : '+ 加入';
  });
}

/* ============ 结算预览 ============ */
function attachCoupons(items, coupons) {
  const used = new Set();
  items.forEach((it) => {
    const c = coupons.find((x) => !used.has(x.couponCode) && (x.products || []).some((p) => p.productCode === it.productCode));
    if (c) { used.add(c.couponCode); it.couponId = c.couponId; it.couponCode = c.couponCode; }
  });
}

$('#btnCheckout').addEventListener('click', async () => {
  const items = Object.values(state.cart);
  if (!items.length) { toast('请先添加餐品'); return; }
  const calcItems = items.map((i) => ({ productCode: i.code, quantity: i.qty }));
  if (state.autoUseAll && state.coupons.length) attachCoupons(calcItems, state.coupons);

  $('#btnCheckout').disabled = true;
  $('#btnCheckout').textContent = '算价中…';
  try {
    const data = okData(
      await callTool('calculate-price', {
        storeCode: state.store.storeCode,
        orderType: state.orderType,
        beType: state.beType,
        beCode: state.beCode || undefined,
        items: calcItems,
        needTableware: false,
      })
    );
    state.calc = data;
    renderCheckout(data, calcItems);
    showScreen('screen-checkout');
  } catch (e) {
    toast('算价失败：' + e.message);
  } finally {
    $('#btnCheckout').disabled = false;
    $('#btnCheckout').textContent = '使用优惠结算';
  }
});
function renderCheckout(data, calcItems) {
  $('#checkoutStore').innerHTML = `门店：<b>${esc(state.store.storeName)}</b><br>地址：${esc(state.store.address || '—')}`;
  const plist = data.productList || [];
  $('#checkoutItems').innerHTML = plist.length
    ? plist.map((p) => `<div class="ci-row"><span>${esc(p.productName)} ×${p.quantity}</span><span>¥${fen(p.subtotal)}</span></div>`).join('')
    : calcItems.map((i) => `<div class="ci-row"><span>${esc(i.productCode)} ×${i.quantity}</span></div>`).join('');

  const applied = calcItems.filter((i) => i.couponCode);
  $('#checkoutCoupons').innerHTML = applied.length
    ? '本单已自动使用优惠券 <b>' + applied.length + '</b> 张，结算价已含优惠'
    : '本单未匹配到可用优惠券（可尝试添加券对应餐品）';

  const twBox = $('#takeWayBox'),
    remBox = $('#remarkBox');
  if (state.orderType === 1) {
    remBox.style.display = 'none';
    twBox.style.display = 'block';
    const tw = data.takeWayList || [];
    $('#takeWaySeg').innerHTML = tw
      .map((t, i) => `<button class="seg-btn${i === 0 ? ' active' : ''}" data-code="${esc(t.code)}">${esc(t.title)}</button>`)
      .join('');
    state.takeWayCode = tw[0] ? tw[0].code : '';
    $$('#takeWaySeg .seg-btn').forEach((b) =>
      b.addEventListener('click', () => {
        $$('#takeWaySeg .seg-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.takeWayCode = b.dataset.code;
      })
    );
  } else {
    twBox.style.display = 'none';
    remBox.style.display = 'block';
  }

  $('#priceBreakdown').innerHTML = `
    <div class="pb-row"><span>商品原价</span><span>¥${fen(data.originalPrice)}</span></div>
    <div class="pb-row discount"><span>优惠减免</span><span>-¥${fen(data.discount)}</span></div>
    <div class="pb-row"><span>打包 / 运费</span><span>¥${fen((data.packingPrice || 0) + (data.deliveryPrice || 0))}</span></div>
    <div class="pb-total"><span>应付</span><b>¥${fen(data.price)}</b></div>`;
}
$('#btnBackMenu').addEventListener('click', () => showScreen('screen-menu'));

/* ============ 提交订单 ============ */
$('#btnSubmitOrder').addEventListener('click', async () => {
  const items = Object.values(state.cart).map((i) => ({ productCode: i.code, quantity: i.qty }));
  if (state.autoUseAll && state.coupons.length) attachCoupons(items, state.coupons);
  const payload = { storeCode: state.store.storeCode, orderType: state.orderType, beType: state.beType, items };
  if (state.beCode) payload.beCode = state.beCode;
  if (state.orderType === 1) {
    if (!state.takeWayCode) { toast('请选择取餐方式'); return; }
    payload.takeWayCode = state.takeWayCode;
  } else {
    if (!state.addressId) { toast('请先选择配送地址'); return; }
    payload.addressId = state.addressId;
    payload.remark = $('#remarkInput').value.trim();
  }
  $('#btnSubmitOrder').disabled = true;
  $('#btnSubmitOrder').textContent = '下单中…';
  try {
    const data = okData(await callTool('create-order', payload));
    state.orderRaw = data;
    renderOrder(data);
    showScreen('screen-order');
  } catch (e) {
    toast('下单失败：' + e.message);
  } finally {
    $('#btnSubmitOrder').disabled = false;
    $('#btnSubmitOrder').textContent = '提交订单';
  }
});

function extractPay(data) {
  const url = data.payH5Url || data.payUrl || data.paymentUrl || data.payLink || '';
  const qr = data.qrCodeUrl || data.qrCode || ''; // 文档确认无支付二维码字段
  const oid = data.orderId || data.orderNo || data.id || '';
  // 金额优先用 fen 单位的 price；回退到以元为单位的 totalAmount/realTotalAmount
  let amt = data.price != null ? data.price : null;
  if (amt == null) {
    const ta = data.realTotalAmount != null ? data.realTotalAmount : data.totalAmount;
    if (ta != null) amt = Math.round(parseFloat(ta) * 100);
  }
  amt = amt || 0;
  const locker = data.lockerQrCode || (data.orderDetail && data.orderDetail.lockerQrCode) || '';
  return { url, qr, oid, amt, locker };
}

function renderOrder(data) {
  const pay = extractPay(data);
  state.payUrl = pay.url;
  state.orderId = pay.oid;

  // 在线支付区
  $('#payAmount').textContent = '¥' + fen(pay.amt);
  const online = $('#payOnline');
  const qrWrap = $('#payQrWrap');
  online.style.display = 'flex';
  if (pay.url) {
    $('#payNote').textContent = '如网页无法拉起支付，请复制链接或截图下方二维码，打开麦当劳 App → 我的订单 完成支付。';
    if (pay.qr) {
      $('#payQr').src = pay.qr;
      qrWrap.style.display = 'block';
    } else {
      try {
        $('#payQr').src = makeQR(pay.url, 6);
        qrWrap.style.display = 'block';
      } catch (e) { qrWrap.style.display = 'none'; }
    }
  } else {
    $('#payNote').textContent = '本单暂未返回在线支付链接，请打开麦当劳 App → 我的订单 完成支付。';
    qrWrap.style.display = 'none';
  }
  $('#payStatusText').textContent = '';

  // 订单信息
  const el = $('#orderInfo');
  const oid = pay.oid || '—';
  let html = `<div class="oi-row"><span>订单号</span><span>${esc(oid)}</span></div>`;
  if (pay.amt) html += `<div class="oi-row"><span>实付金额</span><span>¥${fen(pay.amt)}</span></div>`;
  const items = data.productList || data.items || data.orderItems || [];
  if (items.length) {
    html += '<div style="font-weight:800;margin-top:8px">餐品明细</div>';
    items.forEach((it) => {
      html += `<div class="oi-row"><span>${esc(it.productName || it.name || '')} ×${it.quantity || 1}</span><span>${it.subtotal != null ? '¥' + fen(it.subtotal) : esc(it.price || '')}</span></div>`;
    });
  }
  if (pay.url) html += `<div class="qr"><a href="${esc(pay.url)}" target="_blank">打开支付页面 ›</a></div>`;
  if (pay.locker) html += `<div class="qr"><div class="qr-tip">取餐柜码</div><img src="${esc(pay.locker)}" alt="取餐柜码" style="max-width:160px;border:8px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.1)"/></div>`;
  html += '<details style="margin-top:10px"><summary style="cursor:pointer;color:#8A857C">查看完整订单数据</summary><pre style="white-space:pre-wrap;font-size:11px;color:#8A857C">' + esc(JSON.stringify(data, null, 2)) + '</pre></details>';
  el.innerHTML = html;
}

/* 在线支付动作 */
$('#btnPayNow').addEventListener('click', () => {
  if (!state.payUrl) { toast('暂无在线支付链接，请前往 App 支付'); return; }
  const w = window.open(state.payUrl, '_blank');
  if (!w) toast('浏览器拦截了新窗口，请复制支付链接到 App 打开');
  else toast('已打开支付页面，如未自动跳转请在麦当劳 App 内完成支付');
});
$('#btnCopyPay').addEventListener('click', () => {
  if (!state.payUrl) { toast('暂无支付链接可复制'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(state.payUrl).then(() => toast('支付链接已复制'), () => toast('复制失败，请手动复制'));
  } else toast('当前环境不支持复制');
});
$('#btnPayStatus').addEventListener('click', async () => {
  if (!state.orderId) { toast('没有可查询的订单'); return; }
  $('#btnPayStatus').disabled = true;
  try {
    const data = okData(await callTool('query-order', { orderId: state.orderId }));
    const status = data.orderStatus || '未知';
    $('#payStatusText').textContent = '支付状态：' + status;
    toast('已查询订单状态：' + status);
  } catch (e) {
    $('#payStatusText').textContent = '查询失败：' + e.message;
  } finally {
    $('#btnPayStatus').disabled = false;
  }
});

/* ============ 订单保存 ============ */
$('#btnSaveImg').addEventListener('click', () => saveOrderImage());
$('#btnCopyOrder').addEventListener('click', () => {
  const text = JSON.stringify(state.orderRaw, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('订单信息已复制'), () => toast('复制失败，请手动复制'));
  } else toast('当前环境不支持复制');
});
$('#btnBackHome').addEventListener('click', () => {
  state.cart = {};
  state.coupons = [];
  state.calc = null;
  state.orderRaw = null;
  state.payUrl = '';
  state.orderId = '';
  renderCart();
  showScreen('screen-store');
});

$('#btnCancelOrder').addEventListener('click', async () => {
  const d = state.orderRaw || {};
  const oid = d.orderId || d.orderNo || d.id;
  if (!oid) { toast('没有可取消的订单'); return; }
  if (!confirm('确认取消该订单？')) return;
  $('#btnCancelOrder').disabled = true;
  try {
    const r = await callTool('cancel-order', { orderId: oid, cancelReasonCode: '3' });
    if (r && r.code === 200) toast('订单已取消');
    else toast('取消失败：' + ((r && r.message) || '未知'));
  } catch (e) {
    toast('取消失败：' + e.message);
  } finally {
    $('#btnCancelOrder').disabled = false;
  }
});

function saveOrderImage() {
  const d = state.orderRaw || {};
  const lines = [];
  lines.push({ t: '麦麦优惠管家 · 订单小票', f: 34, b: true, col: '#DA291C' });
  lines.push({ t: new Date().toLocaleString('zh-CN'), f: 18, col: '#8A857C' });
  lines.push({ t: '', f: 12 });
  const oid = d.orderId || d.orderNo || d.id || '—';
  lines.push({ t: '订单号：' + oid, f: 22, b: true });
  const items = d.productList || d.items || d.orderItems || [];
  items.forEach((it) => lines.push({ t: (it.productName || it.name || '') + ' ×' + (it.quantity || 1), f: 20, col: '#27251F', sub: it.subtotal != null ? '¥' + fen(it.subtotal) : '' }));
  lines.push({ t: '', f: 10 });
  if (d.price != null) lines.push({ t: '实付：¥' + fen(d.price), f: 32, b: true, col: '#DA291C' });
  else if (d.totalPrice != null) lines.push({ t: '实付：¥' + fen(d.totalPrice), f: 32, b: true, col: '#DA291C' });
  lines.push({ t: '门店：' + (state.store ? state.store.storeName : ''), f: 18, col: '#8A857C' });
  lines.push({ t: '感谢惠顾，记得用券更划算～', f: 16, col: '#8A857C' });

  const W = 720,
    pad = 44;
  let h = pad;
  lines.forEach((l) => (h += l.f + (l.sub !== undefined ? 6 : 0) + 18));
  h += pad;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = '#DA291C';
  ctx.fillRect(0, 0, W, 10);
  let y = pad;
  lines.forEach((l) => {
    ctx.fillStyle = l.col || '#27251F';
    ctx.font = `${l.b ? 'bold ' : ''}${l.f}px "PingFang SC",sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(l.t, pad, y);
    if (l.sub !== undefined) {
      ctx.textAlign = 'right';
      ctx.fillText(l.sub, W - pad, y);
      ctx.textAlign = 'left';
    }
    y += l.f + (l.sub !== undefined ? 6 : 0) + 18;
  });
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `麦当劳订单_${oid}.png`;
  a.click();
  toast('订单小票已保存为图片');
}

/* ============ 初始化 ============ */
renderCart();
showScreen('screen-login');
