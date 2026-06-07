// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
const API = '';  // kosong = relative URL ke server Express

// Cek session, redirect ke login kalau belum login
fetch('/api/auth/me').then(r => {
  if (r.status === 401) window.location.href = '/login.html';
});

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let currentPage = 'dashboard';
let currentCategory = 'Semua';
let searchTimeout = null;
let currentImageUrl = null;
let isUploading = false;
let editingProductId = null;
let currentDetailId = null;

// ═══════════════════════════════════════
// NAVIGASI HALAMAN
// ═══════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-page="${name}"]`)?.classList.add('active');

  currentPage = name;

  if (name === 'dashboard') loadDashboard();
  else if (name === 'products') loadProducts();
  else if (name === 'stock') loadStockHistory();
  else if (name === 'settings') loadSettings();
}

// Nav bottom click
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showPage(item.dataset.page));
});

// Tombol kembali dari detail
document.getElementById('back-from-detail').addEventListener('click', () => {
  showPage('products');
});

// ═══════════════════════════════════════
// TOAST NOTIFIKASI
// ═══════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ═══════════════════════════════════════
// HELPER: FORMAT
// ═══════════════════════════════════════
function formatRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function stockBadge(stock, min) {
  if (stock === 0) return `<span class="stock-badge empty">Habis</span>`;
  if (stock <= min) return `<span class="stock-badge low">${stock} unit</span>`;
  return `<span class="stock-badge ok">${stock} unit</span>`;
}

function thumbHtml(url, size = 40) {
  if (url) return `<img src="${url}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;" />`;
  return `<div style="width:${size}px;height:${size}px;background:var(--surface2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:${size/2.5}px;">💡</div>`;
}

// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/dashboard`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const d = json.data;

    // Stat cards
    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-card yellow">
        <div class="stat-label">Total Produk</div>
        <div class="stat-value">${d.totalProducts}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Nilai Inventory</div>
        <div class="stat-value" style="font-size:16px">${formatRp(d.totalValue)}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Stok Menipis</div>
        <div class="stat-value">${d.lowStockCount}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">Stok Habis</div>
        <div class="stat-value">${d.outOfStock}</div>
      </div>
    `;

    // Low stock
    const lsEl = document.getElementById('low-stock-list');
    if (d.lowStock.length === 0) {
      lsEl.innerHTML = `<div class="empty-state"><div class="icon">✅</div><p>Semua stok aman</p></div>`;
    } else {
      lsEl.innerHTML = d.lowStock.map(p => `
        <div class="alert-item" onclick="openDetail('${p.id}')">
          ${thumbHtml(p.image_url, 40)}
          <div>
            <div class="alert-name">${p.name}</div>
            <div class="alert-stock">Sisa ${p.stock} unit • Min ${p.min_stock}</div>
          </div>
          <span class="stock-badge ${p.stock === 0 ? 'empty' : 'low'}" style="margin-left:auto">
            ${p.stock === 0 ? 'Habis' : 'Menipis'}
          </span>
        </div>
      `).join('');
    }

    // Recent transactions
    const txEl = document.getElementById('recent-tx-list');
    if (d.recentTransactions.length === 0) {
      txEl.innerHTML = `<div class="empty-state"><p>Belum ada transaksi</p></div>`;
    } else {
      txEl.innerHTML = d.recentTransactions.map(tx => `
        <div class="tx-item">
          <div class="tx-icon ${tx.type}">${tx.type === 'in' ? '▲' : '▼'}</div>
          <div class="tx-info">
            <div class="tx-name">${tx.products?.name || '-'}</div>
            <div class="tx-note">${tx.note || (tx.type === 'in' ? 'Stok masuk' : 'Stok keluar')} • ${timeAgo(tx.created_at)}</div>
          </div>
          <div class="tx-qty ${tx.type}">${tx.type === 'in' ? '+' : '-'}${tx.quantity}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast('Gagal memuat dashboard: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════
// PRODUK
// ═══════════════════════════════════════
async function loadProducts(search = '', category = currentCategory) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = `
    <div class="skeleton" style="height:200px;border-radius:12px"></div>
    <div class="skeleton" style="height:200px;border-radius:12px"></div>
    <div class="skeleton" style="height:200px;border-radius:12px"></div>
    <div class="skeleton" style="height:200px;border-radius:12px"></div>
  `;

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'Semua') params.set('category', category);

    const res = await fetch(`${API}/api/products?${params}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const products = json.data;
    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1">
          <div class="empty-state"><div class="icon">📦</div><p>Belum ada produk</p></div>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="product-card" onclick="openDetail('${p.id}')">
        <div class="product-img">
          ${p.image_url
            ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy" />`
            : '💡'}
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-brand">${p.brand || p.category || '-'}</div>
          <div class="product-footer">
            ${stockBadge(p.stock, p.min_stock)}
            <div class="product-price">${p.price ? formatRp(p.price) : '-'}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state"><p>Gagal memuat: ${err.message}</p></div></div>`;
  }
}

// Search
document.getElementById('search-input').addEventListener('input', function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadProducts(this.value, currentCategory), 400);
});

// Filter chips
document.querySelectorAll('#filter-chips .chip').forEach(chip => {
  chip.addEventListener('click', function () {
    document.querySelectorAll('#filter-chips .chip').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    currentCategory = this.dataset.cat;
    loadProducts(document.getElementById('search-input').value, currentCategory);
  });
});

// ═══════════════════════════════════════
// DETAIL PRODUK
// ═══════════════════════════════════════
async function openDetail(id) {
  currentDetailId = id;

  // Sembunyikan nav & fab, tampilkan detail
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('btn-add-product')?.style.setProperty('display', 'none');

  const el = document.getElementById('detail-content');
  el.innerHTML = `<div class="skeleton" style="height:200px;border-radius:12px;margin-bottom:16px"></div>
    <div class="skeleton" style="height:24px;margin-bottom:8px;border-radius:6px"></div>
    <div class="skeleton" style="height:16px;border-radius:6px"></div>`;

  try {
    const res = await fetch(`${API}/api/products/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const p = json.data;

    el.innerHTML = `
      <div class="detail-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" />` : '💡'}
      </div>
      <div class="detail-name">${p.name}</div>
      <div class="detail-brand">${p.brand || ''} ${p.category ? `• ${p.category}` : ''}</div>

      <div class="detail-attrs">
        <div class="attr-item">
          <div class="attr-label">Stok</div>
          <div class="attr-value" style="color:${p.stock===0?'var(--danger)':p.stock<=p.min_stock?'var(--accent2)':'var(--success)'}">${p.stock} unit</div>
        </div>
        <div class="attr-item">
          <div class="attr-label">Harga</div>
          <div class="attr-value" style="color:var(--accent)">${p.price ? formatRp(p.price) : '-'}</div>
        </div>
        <div class="attr-item">
          <div class="attr-label">Wattage</div>
          <div class="attr-value">${p.wattage ? p.wattage + 'W' : '-'}</div>
        </div>
        <div class="attr-item">
          <div class="attr-label">Min. Stok</div>
          <div class="attr-value">${p.min_stock}</div>
        </div>
      </div>

      ${p.description ? `<div class="card" style="margin-bottom:16px;font-size:13px;color:var(--text-muted);line-height:1.6">${p.description}</div>` : ''}

      <div class="stock-actions">
        <button class="btn btn-success btn-full" onclick="openStockModal('${p.id}','${p.name}','in')">▲ Stok Masuk</button>
        <button class="btn btn-danger btn-full" onclick="openStockModal('${p.id}','${p.name}','out')">▼ Stok Keluar</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-outline btn-full" onclick="openEditProduct('${p.id}')">✏️ Edit</button>
        <button class="btn btn-outline btn-full" style="color:var(--danger);border-color:var(--danger)" onclick="deleteProduct('${p.id}')">🗑️ Hapus</button>
      </div>

      <div class="section-title">Riwayat Transaksi</div>
      <div class="card" id="detail-tx-list">
        <div class="skeleton" style="height:40px;border-radius:6px"></div>
      </div>
    `;

    loadDetailTransactions(id);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Gagal memuat: ${err.message}</p></div>`;
  }
}

async function loadDetailTransactions(productId) {
  try {
    const res = await fetch(`${API}/api/stock?product_id=${productId}&limit=20`);
    const json = await res.json();
    const el = document.getElementById('detail-tx-list');
    if (!json.data || json.data.length === 0) {
      el.innerHTML = `<div class="empty-state" style="padding:16px"><p>Belum ada transaksi</p></div>`;
      return;
    }
    el.innerHTML = json.data.map(tx => `
      <div class="tx-item">
        <div class="tx-icon ${tx.type}">${tx.type === 'in' ? '▲' : '▼'}</div>
        <div class="tx-info">
          <div class="tx-note">${tx.note || (tx.type === 'in' ? 'Stok masuk' : 'Stok keluar')}</div>
          <div class="tx-note">${timeAgo(tx.created_at)}</div>
        </div>
        <div class="tx-qty ${tx.type}">${tx.type === 'in' ? '+' : '-'}${tx.quantity}</div>
      </div>
    `).join('');
  } catch (_) {}
}

// Override back button agar fab muncul lagi
document.getElementById('back-from-detail').addEventListener('click', () => {
  document.getElementById('btn-add-product')?.style.removeProperty('display');
  showPage('products');
});

// ═══════════════════════════════════════
// MODAL: TAMBAH / EDIT PRODUK
// ═══════════════════════════════════════
function openAddProduct() {
  editingProductId = null;
  currentImageUrl = null;
  document.getElementById('modal-product-title').textContent = 'Tambah Produk';
  document.getElementById('btn-save-text').textContent = 'Simpan';

  // Reset form
  ['f-name','f-brand','f-wattage','f-price','f-stock','f-min-stock','f-description'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-category').value = '';
  document.getElementById('f-image-url').value = '';
  document.getElementById('f-edit-id').value = '';
  resetImagePreview();

  document.getElementById('modal-product').classList.add('open');
}

async function openEditProduct(id) {
  try {
    const res = await fetch(`${API}/api/products/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    const p = json.data;

    editingProductId = id;
    currentImageUrl = p.image_url || null;

    document.getElementById('modal-product-title').textContent = 'Edit Produk';
    document.getElementById('btn-save-text').textContent = 'Perbarui';
    document.getElementById('f-name').value = p.name || '';
    document.getElementById('f-brand').value = p.brand || '';
    document.getElementById('f-category').value = p.category || '';
    document.getElementById('f-wattage').value = p.wattage || '';
    document.getElementById('f-price').value = p.price || '';
    document.getElementById('f-stock').value = p.stock || '';
    document.getElementById('f-min-stock').value = p.min_stock || 5;
    document.getElementById('f-description').value = p.description || '';
    document.getElementById('f-image-url').value = p.image_url || '';
    document.getElementById('f-edit-id').value = id;

    if (p.image_url) {
      const preview = document.getElementById('img-preview');
      preview.src = p.image_url;
      preview.style.display = 'block';
      document.getElementById('img-upload-placeholder').style.display = 'none';
    } else {
      resetImagePreview();
    }

    document.getElementById('modal-product').classList.add('open');
  } catch (err) {
    showToast('Gagal memuat data produk', 'error');
  }
}

function closeProductModal() {
  document.getElementById('modal-product').classList.remove('open');
}

document.getElementById('btn-cancel-product').addEventListener('click', closeProductModal);
document.getElementById('modal-product').addEventListener('click', function (e) {
  if (e.target === this) closeProductModal();
});

document.getElementById('btn-add-product').addEventListener('click', openAddProduct);

// ─── Upload gambar ───
document.getElementById('img-file-input').addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('File terlalu besar, maksimal 5MB', 'error');
    return;
  }

  // Preview lokal dulu
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('img-preview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('img-upload-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Upload ke server
  isUploading = true;
  document.getElementById('btn-save-product').disabled = true;
  document.getElementById('btn-save-text').textContent = 'Mengupload...';

  try {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API}/api/upload/image`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    currentImageUrl = json.url;
    document.getElementById('f-image-url').value = json.url;
    showToast('Foto berhasil diupload');
  } catch (err) {
    showToast('Gagal upload foto: ' + err.message, 'error');
    resetImagePreview();
  } finally {
    isUploading = false;
    document.getElementById('btn-save-product').disabled = false;
    document.getElementById('btn-save-text').textContent = editingProductId ? 'Perbarui' : 'Simpan';
  }
});

function resetImagePreview() {
  const preview = document.getElementById('img-preview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('img-upload-placeholder').style.display = 'block';
  document.getElementById('img-file-input').value = '';
}

// ─── Simpan produk ───
document.getElementById('btn-save-product').addEventListener('click', async () => {
  if (isUploading) { showToast('Tunggu upload foto selesai...', 'error'); return; }

  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('Nama produk wajib diisi', 'error'); return; }

  const payload = {
    name,
    brand: document.getElementById('f-brand').value.trim(),
    category: document.getElementById('f-category').value,
    wattage: document.getElementById('f-wattage').value || null,
    price: document.getElementById('f-price').value || 0,
    stock: document.getElementById('f-stock').value || 0,
    min_stock: document.getElementById('f-min-stock').value || 5,
    description: document.getElementById('f-description').value.trim(),
    image_url: document.getElementById('f-image-url').value || null,
  };

  try {
    document.getElementById('btn-save-product').disabled = true;
    document.getElementById('btn-save-text').textContent = 'Menyimpan...';

    const isEdit = !!editingProductId;
    const url = isEdit ? `${API}/api/products/${editingProductId}` : `${API}/api/products`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeProductModal();
    showToast(json.message);
    loadProducts(document.getElementById('search-input').value, currentCategory);
  } catch (err) {
    showToast('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    document.getElementById('btn-save-product').disabled = false;
    document.getElementById('btn-save-text').textContent = editingProductId ? 'Perbarui' : 'Simpan';
  }
});

// ─── Hapus produk ───
async function deleteProduct(id) {
  if (!confirm('Yakin ingin menghapus produk ini?')) return;
  try {
    const res = await fetch(`${API}/api/products/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    showToast('Produk berhasil dihapus');
    document.getElementById('btn-add-product')?.style.removeProperty('display');
    showPage('products');
  } catch (err) {
    showToast('Gagal hapus: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════
// MODAL: TRANSAKSI STOK
// ═══════════════════════════════════════
function openStockModal(productId, productName, defaultType = 'in') {
  document.getElementById('modal-stock-title').textContent = productName;
  document.getElementById('s-product-id').value = productId;
  document.getElementById('s-quantity').value = '';
  document.getElementById('s-note').value = '';
  setStockType(defaultType);
  document.getElementById('modal-stock').classList.add('open');
}

function setStockType(type) {
  document.getElementById('s-type').value = type;
  const btnIn = document.getElementById('btn-type-in');
  const btnOut = document.getElementById('btn-type-out');
  if (type === 'in') {
    btnIn.className = 'btn btn-success btn-full';
    btnOut.className = 'btn btn-outline btn-full';
  } else {
    btnIn.className = 'btn btn-outline btn-full';
    btnOut.className = 'btn btn-danger btn-full';
  }
}

function closeStockModal() {
  document.getElementById('modal-stock').classList.remove('open');
}

document.getElementById('btn-cancel-stock').addEventListener('click', closeStockModal);
document.getElementById('modal-stock').addEventListener('click', function (e) {
  if (e.target === this) closeStockModal();
});

document.getElementById('btn-save-stock').addEventListener('click', async () => {
  const product_id = document.getElementById('s-product-id').value;
  const type = document.getElementById('s-type').value;
  const quantity = parseInt(document.getElementById('s-quantity').value);
  const note = document.getElementById('s-note').value.trim();

  if (!quantity || quantity <= 0) {
    showToast('Jumlah harus lebih dari 0', 'error');
    return;
  }

  try {
    document.getElementById('btn-save-stock').disabled = true;

    const res = await fetch(`${API}/api/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id, type, quantity, note })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    closeStockModal();
    showToast(json.message);

    // Refresh halaman yang sedang aktif
    if (currentDetailId) openDetail(currentDetailId);
    else loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    document.getElementById('btn-save-stock').disabled = false;
  }
});

// ═══════════════════════════════════════
// RIWAYAT STOK (halaman stock)
// ═══════════════════════════════════════
async function loadStockHistory() {
  const el = document.getElementById('stock-tx-list');
  el.innerHTML = `
    <div class="skeleton" style="height:44px;margin-bottom:8px;border-radius:6px"></div>
    <div class="skeleton" style="height:44px;margin-bottom:8px;border-radius:6px"></div>
    <div class="skeleton" style="height:44px;border-radius:6px"></div>
  `;

  try {
    const res = await fetch(`${API}/api/stock?limit=50`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    if (json.data.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Belum ada transaksi stok</p></div>`;
      return;
    }

    el.innerHTML = json.data.map(tx => `
      <div class="tx-item">
        <div class="tx-icon ${tx.type}">${tx.type === 'in' ? '▲' : '▼'}</div>
        <div class="tx-info">
          <div class="tx-name">${tx.products?.name || '-'}</div>
          <div class="tx-note">${tx.note || (tx.type === 'in' ? 'Stok masuk' : 'Stok keluar')} • ${timeAgo(tx.created_at)}</div>
        </div>
        <div class="tx-qty ${tx.type}">${tx.type === 'in' ? '+' : '-'}${tx.quantity}</div>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Gagal memuat: ${err.message}</p></div>`;
  }
}

// ═══════════════════════════════════════
// SETTINGS & AUTH
// ═══════════════════════════════════════
async function loadSettings() {
  try {
    const res = await fetch('/api/auth/me');
    const json = await res.json();
    if (json.success) {
      document.getElementById('current-username').textContent = json.username;
    }
  } catch {}
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

document.getElementById('btn-save-credentials')?.addEventListener('click', async () => {
  const newUsername = document.getElementById('new-username').value.trim();
  const newPassword = document.getElementById('new-password').value;
  const currentPassword = document.getElementById('current-password').value;

  if (!currentPassword) {
    showToast('Password saat ini wajib diisi', 'error');
    return;
  }
  if (!newUsername && !newPassword) {
    showToast('Isi username baru atau password baru', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUsername, newPassword, currentPassword })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    showToast(json.message);
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('current-password').value = '';
    loadSettings();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Panggil loadSettings saat page settings dibuka
// (tambahkan di fungsi showPage, di bagian if-else)
// else if (name === 'settings') loadSettings();

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
loadDashboard();
