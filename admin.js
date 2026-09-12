const db = window.AgraDB;
const loginCard = document.getElementById('loginCard');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const setupWarning = document.getElementById('setupWarning');
const connectionPill = document.getElementById('connectionPill');
const logoutBtn = document.getElementById('logoutBtn');
const adminProducts = document.getElementById('adminProducts');
const adminOrders = document.getElementById('adminOrders');
const seedBtn = document.getElementById('seedBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newProductBtn = document.getElementById('newProductBtn');
const productCreateModal = document.getElementById('productCreateModal');
const newProductForm = document.getElementById('newProductForm');
const newProductError = document.getElementById('newProductError');
const toast = document.getElementById('adminToast');
let toastTimer;
let cachedProducts = [];
let cachedOrders = [];
let newProductImageData = '';
const pendingProductImages = new Map();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function money(value) {
  if (typeof value !== 'number') return 'A definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function dateText(timestamp) {
  const date = timestamp?.toDate?.() || (timestamp ? new Date(timestamp) : null);
  if (!date || Number.isNaN(date.getTime())) return 'Agora há pouco';
  return date.toLocaleString('pt-BR');
}

function escapeHTML(value = '') {
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function parseBRL(value) {
  let clean = String(value || '').trim().replace(/[^0-9,.-]/g, '');
  if (!clean) return null;
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('O arquivo selecionado não é uma imagem válida.'));
    image.src = src;
  });
}

async function optimizeProductImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('A imagem original deve ter no máximo 12 MB.');
  }

  const original = await readFileAsDataURL(file);
  const image = await loadImage(original);
  const targetChars = 450000; // ~330 KB binários após Base64, com margem para o documento do Firestore.
  const maxSides = [900, 800, 700, 600, 520];
  const qualities = [0.82, 0.72, 0.62, 0.52];

  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const data = canvas.toDataURL('image/webp', quality);
      if (data.startsWith('data:image/webp') && data.length <= targetChars) return data;
    }
  }
  throw new Error('Não consegui reduzir esta foto o suficiente. Tente outra imagem ou recorte-a antes de enviar.');
}

function renderMetrics() {
  document.getElementById('metricProducts').textContent = cachedProducts.filter(p => p.active).length;
  document.getElementById('metricStock').textContent = cachedProducts.reduce((sum, p) => sum + (Number(p.stockQty) || 0), 0);
  document.getElementById('metricOrders').textContent = cachedOrders.length;
  document.getElementById('metricNewOrders').textContent = cachedOrders.filter(o => o.status === 'novo').length;
}

function renderProducts() {
  pendingProductImages.clear();
  if (!cachedProducts.length) {
    adminProducts.innerHTML = '<div class="empty-admin">Nenhum produto no Firestore. Use “Criar/atualizar produtos iniciais”.</div>';
    return;
  }
  adminProducts.innerHTML = cachedProducts.map(p => `
    <article class="product-editor" data-product-id="${escapeHTML(p.id)}">
      <div class="product-editor-head">
        <img data-image-preview src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}">
        <div><h3>${escapeHTML(p.name)}</h3><span>ID: ${escapeHTML(p.id)}</span></div>
      </div>
      <div class="product-image-tools">
        <label class="file-picker">Trocar foto<input type="file" accept="image/jpeg,image/png,image/webp" data-image-file hidden></label>
        <button class="secondary-btn" type="button" data-reset-image>Usar logo</button>
        <span class="product-image-note" data-image-note>Selecione uma foto e depois clique em “Salvar produto”.</span>
      </div>
      <div class="editor-grid">
        <label>Nome<input data-field="name" value="${escapeHTML(p.name)}"></label>
        <label>Peso<input data-field="weight" value="${escapeHTML(p.weight)}"></label>
        <label>Preço (R$)<input data-field="price" inputmode="decimal" placeholder="Ex.: 24,90" value="${typeof p.price === 'number' ? p.price.toFixed(2).replace('.', ',') : ''}"></label>
        <label>Estoque<input data-field="stockQty" type="number" min="0" step="1" value="${Number(p.stockQty) || 0}"></label>
        <label>Ordem<input data-field="sortOrder" type="number" min="0" value="${Number(p.sortOrder) || 0}"></label>
        <label>Etiqueta<input data-field="tag" value="${escapeHTML(p.tag)}"></label>
      </div>
      <label class="full-field">Descrição<textarea data-field="description">${escapeHTML(p.description)}</textarea></label>
      <div class="switch-line">
        <label><input data-field="active" type="checkbox" ${p.active ? 'checked' : ''}> Produto ativo</label>
        <label><input data-field="featured" type="checkbox" ${p.featured ? 'checked' : ''}> Destaque</label>
      </div>
      <div class="product-editor-actions">
        <button class="danger-btn" type="button" data-delete-product="${escapeHTML(p.id)}">Excluir</button>
        <button class="primary-btn product-save" type="button" data-save-product="${escapeHTML(p.id)}">Salvar produto</button>
      </div>
    </article>
  `).join('');
}

function renderOrders() {
  if (!cachedOrders.length) {
    adminOrders.innerHTML = '<div class="empty-admin">Nenhum pedido recebido ainda.</div>';
    return;
  }
  const statusOptions = ['novo','confirmado','separando','enviado','entregue','cancelado'];
  adminOrders.innerHTML = cachedOrders.map(o => {
    const items = Array.isArray(o.items) ? o.items.map(i => `${i.quantity}× ${escapeHTML(i.name || i.productId)}`).join('<br>') : '';
    const stockState = o.stockAdjusted === true
      ? '<span class="stock-state adjusted">Estoque baixado</span>'
      : o.status === 'cancelado'
        ? '<span class="stock-state released">Estoque liberado</span>'
        : '<span class="stock-state pending">Estoque baixa ao confirmar</span>';
    return `
      <article class="order-card" data-order-id="${escapeHTML(o.id)}">
        <div class="order-head">
          <div><h3>${escapeHTML(o.orderNumber || o.id)}</h3><p>${dateText(o.createdAt)} • ${escapeHTML(o.paymentMethod === 'card' ? 'Cartão' : 'PIX')}</p></div>
          <span class="order-total">${money(o.total)}</span>
        </div>
        <div class="order-grid">
          <div><strong>Cliente</strong><span>${escapeHTML(o.customer?.name || '')}<br>${escapeHTML(o.customer?.email || '')}<br>${escapeHTML(o.customer?.phone || '')}</span></div>
          <div><strong>Entrega</strong><span>${escapeHTML(o.delivery?.address || '')}<br>${escapeHTML(o.shipping?.name || '')} • ${money(o.shipping?.price)}</span></div>
          <div><strong>Itens</strong><span>${items}</span></div>
        </div>
        <div class="order-actions">
          <select class="order-status" data-order-status>
            ${statusOptions.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
          <button class="secondary-btn" type="button" data-save-status>Atualizar status</button>
          ${stockState}
        </div>
      </article>
    `;
  }).join('');
}

function slugifyProductId(name, weight) {
  const base = `${name || 'produto'}-${weight || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `produto-${Date.now()}`;
  let id = base;
  let suffix = 2;
  const ids = new Set(cachedProducts.map(p => p.id));
  while (ids.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function openNewProductModal() {
  newProductError.textContent = '';
  newProductForm.reset();
  newProductImageData = '';
  const preview = document.getElementById('newImagePreview');
  const status = document.getElementById('newImageStatus');
  if (preview) preview.src = 'assets/logo-agra.png';
  if (status) { status.textContent = 'Nenhuma foto selecionada.'; status.className = 'image-upload-status'; }
  document.getElementById('newStock').value = '0';
  document.getElementById('newSortOrder').value = String(
    Math.max(0, ...cachedProducts.map(p => Number(p.sortOrder) || 0)) + 10
  );
  document.getElementById('newActive').checked = true;
  productCreateModal.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => document.getElementById('newName')?.focus(), 0);
}

function closeNewProductModal() {
  productCreateModal.hidden = true;
  document.body.classList.remove('modal-open');
}

async function loadDashboard() {
  refreshBtn.disabled = true;
  try {
    [cachedProducts, cachedOrders] = await Promise.all([db.listAdminProducts(), db.listOrders()]);
    renderProducts();
    renderOrders();
    renderMetrics();
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Erro ao carregar dados.');
  } finally {
    refreshBtn.disabled = false;
  }
}

function showLogin() {
  loginCard.hidden = false;
  dashboard.hidden = true;
  logoutBtn.hidden = true;
}

async function showDashboard(user) {
  loginCard.hidden = true;
  dashboard.hidden = false;
  logoutBtn.hidden = false;
  document.getElementById('adminIdentity').textContent = user?.email ? `Conectado como ${user.email}` : 'Administrador conectado';
  await loadDashboard();
}

if (!db?.configured) {
  connectionPill.textContent = 'Firebase não configurado';
  connectionPill.classList.add('error');
  setupWarning.hidden = false;
  loginForm.querySelector('button').disabled = true;
} else {
  connectionPill.textContent = 'Firebase conectado';
  connectionPill.classList.add('ok');
  db.onAuthStateChanged(user => user ? showDashboard(user) : showLogin());
}

loginForm?.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.textContent = '';
  const button = loginForm.querySelector('button');
  button.disabled = true;
  try {
    const user = await db.adminSignIn(document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value);
    await showDashboard(user);
  } catch (error) {
    console.error(error);
    loginError.textContent = error.message || 'Não foi possível entrar.';
  } finally {
    button.disabled = false;
  }
});

logoutBtn?.addEventListener('click', async () => { await db.adminSignOut(); showLogin(); });
refreshBtn?.addEventListener('click', loadDashboard);
seedBtn?.addEventListener('click', async () => {
  seedBtn.disabled = true;
  try { await db.seedProducts(); showToast('Produtos iniciais criados/atualizados.'); await loadDashboard(); }
  catch (error) { showToast(error.message || 'Erro ao criar produtos.'); }
  finally { seedBtn.disabled = false; }
});

newProductBtn?.addEventListener('click', openNewProductModal);

document.getElementById('newImageFile')?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = document.getElementById('newImagePreview');
  const status = document.getElementById('newImageStatus');
  status.textContent = 'Otimizando foto…';
  status.className = 'image-upload-status';
  try {
    newProductImageData = await optimizeProductImage(file);
    preview.src = newProductImageData;
    status.textContent = `Foto pronta (${Math.round(newProductImageData.length * 0.75 / 1024)} KB aprox.).`;
    status.className = 'image-upload-status ok';
  } catch (error) {
    newProductImageData = '';
    preview.src = 'assets/logo-agra.png';
    status.textContent = error.message || 'Não foi possível preparar a foto.';
    status.className = 'image-upload-status error';
  } finally {
    event.target.value = '';
  }
});

document.getElementById('newImageReset')?.addEventListener('click', () => {
  newProductImageData = '';
  document.getElementById('newImagePreview').src = 'assets/logo-agra.png';
  const status = document.getElementById('newImageStatus');
  status.textContent = 'O logo da AGRA será usado.';
  status.className = 'image-upload-status';
});

productCreateModal?.addEventListener('click', event => {
  if (event.target.closest('[data-close-product-modal]')) closeNewProductModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && productCreateModal && !productCreateModal.hidden) closeNewProductModal();
});

newProductForm?.addEventListener('submit', async event => {
  event.preventDefault();
  newProductError.textContent = '';
  const name = document.getElementById('newName').value.trim();
  const weight = document.getElementById('newWeight').value.trim();
  if (!name || !weight) {
    newProductError.textContent = 'Informe pelo menos o nome e o peso do produto.';
    return;
  }
  const price = parseBRL(document.getElementById('newPrice').value);
  const product = {
    id: slugifyProductId(name, weight),
    name,
    weight,
    price,
    stockQty: Number(document.getElementById('newStock').value) || 0,
    sortOrder: Number(document.getElementById('newSortOrder').value) || 0,
    tag: document.getElementById('newTag').value.trim(),
    badge: document.getElementById('newBadge').value.trim(),
    description: document.getElementById('newDescription').value.trim(),
    image: newProductImageData || 'assets/logo-agra.png',
    category: document.getElementById('newCategory').value || 'individual',
    active: document.getElementById('newActive').checked,
    featured: document.getElementById('newFeatured').checked
  };
  const button = document.getElementById('createProductBtn');
  button.disabled = true;
  try {
    await db.saveProduct(product);
    closeNewProductModal();
    showToast(`Produto “${name}” criado.`);
    await loadDashboard();
  } catch (error) {
    console.error(error);
    newProductError.textContent = error.message || 'Erro ao criar produto.';
  } finally {
    button.disabled = false;
  }
});

adminProducts?.addEventListener('change', async event => {
  const input = event.target.closest('[data-image-file]');
  if (!input) return;
  const file = input.files?.[0];
  const card = input.closest('[data-product-id]');
  if (!file || !card) return;
  const id = card.dataset.productId;
  const preview = card.querySelector('[data-image-preview]');
  const note = card.querySelector('[data-image-note]');
  preview?.classList.add('processing');
  if (note) note.textContent = 'Otimizando foto…';
  try {
    const data = await optimizeProductImage(file);
    pendingProductImages.set(id, data);
    if (preview) preview.src = data;
    if (note) note.textContent = `Foto pronta (${Math.round(data.length * 0.75 / 1024)} KB aprox.). Clique em “Salvar produto”.`;
  } catch (error) {
    if (note) note.textContent = error.message || 'Não foi possível preparar a foto.';
    showToast(error.message || 'Erro ao preparar foto.');
  } finally {
    preview?.classList.remove('processing');
    input.value = '';
  }
});

adminProducts?.addEventListener('click', async event => {
  const resetImageBtn = event.target.closest('[data-reset-image]');
  if (resetImageBtn) {
    const card = resetImageBtn.closest('[data-product-id]');
    if (!card) return;
    pendingProductImages.set(card.dataset.productId, 'assets/logo-agra.png');
    const preview = card.querySelector('[data-image-preview]');
    const note = card.querySelector('[data-image-note]');
    if (preview) preview.src = 'assets/logo-agra.png';
    if (note) note.textContent = 'Logo selecionado. Clique em “Salvar produto”.';
    return;
  }
  const deleteBtn = event.target.closest('[data-delete-product]');
  if (deleteBtn) {
    const card = deleteBtn.closest('[data-product-id]');
    const product = cachedProducts.find(p => p.id === card?.dataset.productId);
    if (!product) return;
    if (!window.confirm(`Excluir “${product.name}”? Essa ação remove o produto do catálogo.`)) return;
    deleteBtn.disabled = true;
    try {
      await db.deleteProduct(product.id);
      showToast('Produto excluído.');
      await loadDashboard();
    } catch (error) {
      showToast(error.message || 'Erro ao excluir produto.');
    } finally {
      deleteBtn.disabled = false;
    }
    return;
  }

  const btn = event.target.closest('[data-save-product]');
  if (!btn) return;
  const card = btn.closest('[data-product-id]');
  const get = field => card.querySelector(`[data-field="${field}"]`);
  const product = {
    id: card.dataset.productId,
    name: get('name').value,
    weight: get('weight').value,
    price: parseBRL(get('price').value),
    stockQty: Number(get('stockQty').value) || 0,
    sortOrder: Number(get('sortOrder').value) || 0,
    tag: get('tag').value,
    description: get('description').value,
    image: pendingProductImages.get(card.dataset.productId) || cachedProducts.find(p => p.id === card.dataset.productId)?.image || 'assets/logo-agra.png',
    category: cachedProducts.find(p => p.id === card.dataset.productId)?.category || 'individual',
    badge: cachedProducts.find(p => p.id === card.dataset.productId)?.badge || '',
    active: get('active').checked,
    featured: get('featured').checked
  };
  btn.disabled = true;
  try { await db.saveProduct(product); showToast('Produto salvo.'); await loadDashboard(); }
  catch (error) { showToast(error.message || 'Erro ao salvar produto.'); }
  finally { btn.disabled = false; }
});

adminOrders?.addEventListener('click', async event => {
  const btn = event.target.closest('[data-save-status]');
  if (!btn) return;
  const card = btn.closest('[data-order-id]');
  const status = card.querySelector('[data-order-status]').value;
  btn.disabled = true;
  try { await db.updateOrderStatus(card.dataset.orderId, status); showToast('Status atualizado.'); await loadDashboard(); }
  catch (error) { showToast(error.message || 'Erro ao atualizar status.'); }
  finally { btn.disabled = false; }
});
