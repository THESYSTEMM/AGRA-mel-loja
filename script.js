const menuBtn = document.getElementById('menuBtn');
const navMenu = document.getElementById('navMenu');
const cartTrigger = document.getElementById('cartTrigger');
const cartCount = document.getElementById('cartCount');
const cartDrawer = document.getElementById('cartDrawer');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartItemsTotal = document.getElementById('cartItemsTotal');
const cartTotal = document.getElementById('cartTotal');
const clearCart = document.getElementById('clearCart');
const toast = document.getElementById('toast');

menuBtn?.addEventListener('click', () => {
  const open = navMenu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});

navMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  });
});

document.getElementById('year').textContent = new Date().getFullYear();

/*
  CATÁLOGO AGRA — ETAPA 3
  Os preços continuam como null porque os valores oficiais ainda não foram informados.
  Quando você tiver os preços, basta trocar por números, por exemplo: price: 29.90
*/
let products = [
  {
    id: 'mel-500',
    name: 'Mel AGRA 500g',
    weight: '500g',
    category: 'individual',
    tag: 'Tamanho favorito',
    badge: 'Mais vendido',
    stock: 'Disponível',
    stockQty: 100,
    featured: true,
    price: null,
    description: 'Embalagem prática para o dia a dia, com excelente equilíbrio entre quantidade e praticidade.',
    image: 'assets/mel-agra-500g-catalogo.jpg'
  },
  {
    id: 'mel-1kg',
    name: 'Mel AGRA 1kg',
    weight: '1kg',
    category: 'individual',
    tag: 'Para a família',
    badge: 'Maior tamanho',
    stock: 'Disponível',
    stockQty: 100,
    price: null,
    description: 'Nossa maior embalagem, ideal para consumo frequente, receitas e para compartilhar em família.',
    image: 'assets/mel-agra-1kg-catalogo.jpg'
  }
];

const productsGrid = document.getElementById('productsGrid');
const catalogCount = document.getElementById('catalogCount');
const filterGroup = document.getElementById('filterGroup');
const productSearch = document.getElementById('productSearch');
const productModal = document.getElementById('productModal');
const modalClose = document.getElementById('modalClose');
const modalAddToCart = document.getElementById('modalAddToCart');

let activeFilter = 'todos';
let searchTerm = '';
let activeModalProductId = null;
let toastTimer = null;

const CART_KEY = 'agra_cart_v1';
let cart = loadCart();

function normalize(text = '') {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatPrice(price) {
  if (typeof price !== 'number') return 'Preço a definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(item => products.some(product => product.id === item.id))
      .map(item => ({ id: item.id, quantity: Math.max(1, Number(item.quantity) || 1) }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // O carrinho continua funcionando na sessão mesmo se o navegador bloquear o armazenamento local.
  }
}

function getFilteredProducts() {
  return products.filter(product => {
    const categoryMatch = activeFilter === 'todos' || product.category === activeFilter;
    const searchable = normalize(`${product.name} ${product.weight} ${product.tag} ${product.description}`);
    const searchMatch = !searchTerm || searchable.includes(normalize(searchTerm));
    return categoryMatch && searchMatch;
  });
}

function productStockLabel(product) {
  if (typeof product.stockQty === 'number') return product.stockQty > 0 ? `Em estoque (${product.stockQty})` : 'Esgotado';
  return product.stock || 'Disponível';
}

function productCanBuy(product) {
  return typeof product.stockQty !== 'number' || product.stockQty > 0;
}

function productCard(product) {
  const canBuy = productCanBuy(product);
  return `
    <article class="product-card ${product.featured ? 'featured' : ''}">
      ${product.badge ? `<div class="badge">${product.badge}</div>` : ''}
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}">
        <span class="product-weight">${product.weight}</span>
      </div>
      <div class="product-content">
        <span class="tag">${product.tag}</span>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <span class="stock-pill ${canBuy ? '' : 'out-of-stock'}">${productStockLabel(product)}</span>
        <div class="product-bottom product-bottom-stacked">
          <strong class="price-placeholder">${formatPrice(product.price)}</strong>
          <div class="product-actions">
            <button type="button" class="detail-btn" data-detail-id="${product.id}">Ver detalhes</button>
            <button type="button" class="small-btn add-cart-btn" data-add-id="${product.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Adicionar' : 'Esgotado'}</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderProducts() {
  const filtered = getFilteredProducts();
  catalogCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`;

  if (!filtered.length) {
    productsGrid.innerHTML = `
      <div class="empty-state">
        <strong>Nenhum produto encontrado.</strong><br>
        Tente outro termo ou selecione outro filtro.
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filtered.map(productCard).join('');
}

function openProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  activeModalProductId = product.id;
  document.getElementById('modalTitle').textContent = product.name;
  document.getElementById('modalKicker').textContent = product.tag;
  document.getElementById('modalDescription').textContent = product.description;
  document.getElementById('modalWeight').textContent = product.weight;
  document.getElementById('modalStock').textContent = productStockLabel(product);
  modalAddToCart.disabled = !productCanBuy(product);
  modalAddToCart.textContent = productCanBuy(product) ? 'Adicionar ao carrinho' : 'Produto esgotado';
  document.getElementById('modalPrice').textContent = formatPrice(product.price);
  productModal.querySelector('.modal-product-image img').src = product.image;
  productModal.querySelector('.modal-product-image img').alt = product.name;

  productModal.hidden = false;
  document.body.classList.add('modal-open');
  modalClose.focus();
}

function closeProduct() {
  productModal.hidden = true;
  activeModalProductId = null;
  if (!cartDrawer.classList.contains('open')) document.body.classList.remove('modal-open');
}

function addToCart(productId, quantity = 1) {
  const product = products.find(item => item.id === productId);
  if (!product) return;
  if (!productCanBuy(product)) { showToast('Este produto está esgotado.'); return; }

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    const maxQty = typeof product.stockQty === 'number' ? product.stockQty : 99;
    existing.quantity = Math.min(maxQty, existing.quantity + quantity);
  } else {
    const maxQty = typeof product.stockQty === 'number' ? product.stockQty : 99;
    cart.push({ id: productId, quantity: Math.min(maxQty, quantity) });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} adicionado ao carrinho.`);
}

function setQuantity(productId, quantity) {
  const item = cart.find(entry => entry.id === productId);
  if (!item) return;

  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const product = products.find(entry => entry.id === productId);
  const maxQty = product && typeof product.stockQty === 'number' ? Math.max(1, product.stockQty) : 99;
  item.quantity = Math.min(maxQty, quantity);
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  renderCart();
}

function totalQuantity() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function renderCart() {
  const itemCount = totalQuantity();
  cartCount.textContent = itemCount;
  cartCount.classList.toggle('has-items', itemCount > 0);
  cartItemsTotal.textContent = itemCount;

  if (!cart.length) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🍯</div>
        <h3>Seu carrinho está vazio</h3>
        <p>Escolha entre o mel AGRA de 500 g e 1 kg para começar seu pedido.</p>
        <button type="button" class="btn btn-primary" id="emptyShopBtn">Ver produtos</button>
      </div>
    `;
    cartTotal.textContent = 'A definir';
    clearCart.disabled = true;
    return;
  }

  clearCart.disabled = false;
  cartItems.innerHTML = cart.map(item => {
    const product = products.find(product => product.id === item.id);
    if (!product) return '';
    const lineTotal = typeof product.price === 'number' ? product.price * item.quantity : null;
    return `
      <article class="cart-item" data-cart-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <div class="cart-item-copy">
          <div class="cart-item-top">
            <div>
              <span>${product.weight}</span>
              <h3>${product.name}</h3>
            </div>
            <button class="remove-item" type="button" data-remove-id="${product.id}" aria-label="Remover ${product.name}">×</button>
          </div>
          <div class="cart-item-price">${formatPrice(lineTotal)}</div>
          <div class="quantity-control" aria-label="Quantidade de ${product.name}">
            <button type="button" data-decrease-id="${product.id}" aria-label="Diminuir quantidade">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-increase-id="${product.id}" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const allPriced = cart.every(item => {
    const product = products.find(product => product.id === item.id);
    return product && typeof product.price === 'number';
  });

  if (allPriced) {
    const total = cart.reduce((sum, item) => {
      const product = products.find(product => product.id === item.id);
      return sum + product.price * item.quantity;
    }, 0);
    cartTotal.textContent = formatPrice(total);
  } else {
    cartTotal.textContent = 'A definir';
  }
}

function openCart() {
  renderCart();
  cartBackdrop.hidden = false;
  requestAnimationFrame(() => {
    cartBackdrop.classList.add('visible');
    cartDrawer.classList.add('open');
  });
  cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  cartClose.focus();
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartBackdrop.classList.remove('visible');
  cartDrawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    cartBackdrop.hidden = true;
  }, 250);
  if (productModal.hidden) document.body.classList.remove('modal-open');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

filterGroup?.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;

  activeFilter = button.dataset.filter;
  filterGroup.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn === button));
  renderProducts();
});

productSearch?.addEventListener('input', event => {
  searchTerm = event.target.value.trim();
  renderProducts();
});

productsGrid?.addEventListener('click', event => {
  const detailButton = event.target.closest('[data-detail-id]');
  const addButton = event.target.closest('[data-add-id]');

  if (detailButton) openProduct(detailButton.dataset.detailId);
  if (addButton) addToCart(addButton.dataset.addId);
});

modalAddToCart?.addEventListener('click', () => {
  if (!activeModalProductId) return;
  addToCart(activeModalProductId);
  closeProduct();
  openCart();
});

modalClose?.addEventListener('click', closeProduct);
productModal?.addEventListener('click', event => {
  if (event.target === productModal) closeProduct();
});

cartTrigger?.addEventListener('click', openCart);
cartClose?.addEventListener('click', closeCart);
cartBackdrop?.addEventListener('click', closeCart);

cartItems?.addEventListener('click', event => {
  const removeButton = event.target.closest('[data-remove-id]');
  const decreaseButton = event.target.closest('[data-decrease-id]');
  const increaseButton = event.target.closest('[data-increase-id]');
  const emptyShopBtn = event.target.closest('#emptyShopBtn');

  if (removeButton) removeFromCart(removeButton.dataset.removeId);
  if (decreaseButton) {
    const item = cart.find(entry => entry.id === decreaseButton.dataset.decreaseId);
    if (item) setQuantity(item.id, item.quantity - 1);
  }
  if (increaseButton) {
    const item = cart.find(entry => entry.id === increaseButton.dataset.increaseId);
    if (item) setQuantity(item.id, item.quantity + 1);
  }
  if (emptyShopBtn) {
    closeCart();
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
  }
});

clearCart?.addEventListener('click', () => {
  if (!cart.length) return;
  cart = [];
  saveCart();
  renderCart();
  showToast('Carrinho limpo.');
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!productModal.hidden) closeProduct();
  else if (cartDrawer.classList.contains('open')) closeCart();
});

renderProducts();
renderCart();

async function syncProductsFromFirebase() {
  if (!window.AgraDB?.configured) return;
  try {
    const remoteProducts = await window.AgraDB.loadProducts();
    if (Array.isArray(remoteProducts)) {
      products = remoteProducts;
      cart = cart
        .filter(item => products.some(product => product.id === item.id))
        .map(item => {
          const product = products.find(p => p.id === item.id);
          const maxQty = typeof product?.stockQty === 'number' ? Math.max(0, product.stockQty) : 99;
          return { ...item, quantity: Math.min(item.quantity, maxQty) };
        })
        .filter(item => item.quantity > 0);
      saveCart();
      renderProducts();
      renderCart();
    }
  } catch (error) {
    console.warn('Catálogo online indisponível; usando catálogo local.', error);
  }
}

syncProductsFromFirebase();

/* =========================================================
   ETAPA 6 — CHECKOUT + FRETE + PAGAMENTO DEMONSTRATIVO
   ========================================================= */
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutBackdrop = document.getElementById('checkoutBackdrop');
const checkoutClose = document.getElementById('checkoutClose');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutLayout = checkoutBackdrop?.querySelector('.checkout-layout');
const checkoutProgress = checkoutBackdrop?.querySelector('.checkout-progress');
const checkoutSuccess = document.getElementById('checkoutSuccess');
const orderConfirmed = document.getElementById('orderConfirmed');
const orderNumber = document.getElementById('orderNumber');
const checkoutReview = document.getElementById('checkoutReview');
const checkoutSummaryItems = document.getElementById('checkoutSummaryItems');
const checkoutSummaryQuantity = document.getElementById('checkoutSummaryQuantity');
const checkoutSummaryTotal = document.getElementById('checkoutSummaryTotal');
const checkoutSummaryPayment = document.getElementById('checkoutSummaryPayment');
const backToCheckout = document.getElementById('backToCheckout');
const confirmOrderTest = document.getElementById('confirmOrderTest');
const finishCheckoutTest = document.getElementById('finishCheckoutTest');
const cepInput = document.getElementById('customerCep');
const cepStatus = document.getElementById('cepStatus');
const shippingOptions = document.getElementById('shippingOptions');
const shippingPlaceholder = document.getElementById('shippingPlaceholder');
const shippingError = document.getElementById('shippingError');
const checkoutSummaryShipping = document.getElementById('checkoutSummaryShipping');
const paymentOptions = document.getElementById('paymentOptions');
const paymentError = document.getElementById('paymentError');

let selectedShipping = null;
let currentShippingQuotes = [];
let selectedPayment = null;
let pendingOrderData = null;

const LAST_ORDER_KEY = 'agra_last_order_v1';
const PAYMENT_LABELS = {
  pix: 'PIX',
  card: 'Cartão de crédito'
};

const BRAZIL_STATES = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]);

function digits(value = '') {
  return String(value).replace(/\D/g, '');
}

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function maskCpf(value) {
  const raw = digits(value).slice(0, 11);
  return raw
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value) {
  const raw = digits(value).slice(0, 11);
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCep(value) {
  const raw = digits(value).slice(0, 8);
  return raw.replace(/(\d{5})(\d)/, '$1-$2');
}

function isValidCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function shippingZoneForState(uf) {
  const state = String(uf || '').trim().toUpperCase();
  if (!BRAZIL_STATES.has(state)) return null;
  if (state === 'SP') return 'sp';
  if (['RJ','MG','ES','PR','SC','RS'].includes(state)) return 'sudesteSul';
  if (['DF','GO','MT','MS'].includes(state)) return 'centroOeste';
  if (['BA','SE','AL','PE','PB','RN','CE','PI','MA'].includes(state)) return 'nordeste';
  return 'norte';
}

function calculateShippingQuotes(uf) {
  const zone = shippingZoneForState(uf);
  if (!zone) return [];

  const table = {
    sp: { standard: [14.90, '2 a 4 dias úteis'], express: [24.90, '1 a 2 dias úteis'] },
    sudesteSul: { standard: [19.90, '3 a 6 dias úteis'], express: [31.90, '2 a 3 dias úteis'] },
    centroOeste: { standard: [24.90, '5 a 8 dias úteis'], express: [39.90, '3 a 5 dias úteis'] },
    nordeste: { standard: [29.90, '6 a 10 dias úteis'], express: [46.90, '4 a 6 dias úteis'] },
    norte: { standard: [34.90, '8 a 12 dias úteis'], express: [54.90, '5 a 8 dias úteis'] }
  }[zone];

  return [
    { id: 'standard', name: 'Entrega padrão', price: table.standard[0], eta: table.standard[1], description: 'Opção econômica para receber seu pedido.' },
    { id: 'express', name: 'Entrega expressa', price: table.express[0], eta: table.express[1], description: 'Prazo reduzido para quem precisa receber mais rápido.' }
  ];
}

function resetShipping(message = 'Preencha o endereço acima para calcular as opções de entrega.') {
  selectedShipping = null;
  currentShippingQuotes = [];
  if (shippingOptions) {
    shippingOptions.hidden = true;
    shippingOptions.innerHTML = '';
  }
  if (shippingPlaceholder) {
    shippingPlaceholder.hidden = false;
    shippingPlaceholder.querySelector('strong').textContent = 'Informe seu CEP';
    shippingPlaceholder.querySelector('p').textContent = message;
  }
  if (shippingError) shippingError.textContent = '';
  renderCheckoutSummary();
}

function renderShippingOptions(uf) {
  currentShippingQuotes = calculateShippingQuotes(uf);
  selectedShipping = null;
  if (!currentShippingQuotes.length) {
    resetShipping('Informe uma UF válida para calcular as opções de entrega.');
    return;
  }

  shippingPlaceholder.hidden = true;
  shippingOptions.hidden = false;
  shippingOptions.innerHTML = currentShippingQuotes.map(option => `
    <label class="shipping-option">
      <input type="radio" name="shippingMethod" value="${option.id}">
      <span class="shipping-radio"></span>
      <span class="shipping-copy">
        <strong>${option.name}</strong>
        <small>${option.description}</small>
        <em>${option.eta}</em>
      </span>
      <span class="shipping-price">${formatPrice(option.price)}</span>
    </label>
  `).join('');
  if (shippingError) shippingError.textContent = '';
  renderCheckoutSummary();
}

function checkoutTotalValue() {
  const allPriced = cart.length && cart.every(item => {
    const product = products.find(entry => entry.id === item.id);
    return product && typeof product.price === 'number';
  });
  if (!allPriced) return null;
  return cart.reduce((sum, item) => {
    const product = products.find(entry => entry.id === item.id);
    return sum + (product.price * item.quantity);
  }, 0);
}

function grandTotalValue() {
  const productsTotal = checkoutTotalValue();
  if (productsTotal === null || !selectedShipping) return null;
  return productsTotal + selectedShipping.price;
}

function renderCheckoutSummary() {
  if (!checkoutSummaryItems) return;
  checkoutSummaryItems.innerHTML = cart.map(item => {
    const product = products.find(entry => entry.id === item.id);
    if (!product) return '';
    const lineTotal = typeof product.price === 'number' ? product.price * item.quantity : null;
    return `
      <div class="checkout-summary-item">
        <img src="${product.image}" alt="${product.name}">
        <div><strong>${product.name}</strong><span>${item.quantity} × ${product.weight}</span></div>
        <em>${formatPrice(lineTotal)}</em>
      </div>
    `;
  }).join('');

  const quantity = totalQuantity();
  checkoutSummaryQuantity.textContent = `${quantity} ${quantity === 1 ? 'item' : 'itens'}`;
  if (checkoutSummaryShipping) {
    checkoutSummaryShipping.textContent = selectedShipping
      ? `${selectedShipping.name} • ${formatPrice(selectedShipping.price)}`
      : (currentShippingQuotes.length ? 'Escolha uma opção' : 'Informe o CEP');
  }
  if (checkoutSummaryPayment) {
    checkoutSummaryPayment.textContent = selectedPayment ? PAYMENT_LABELS[selectedPayment] : 'Escolha uma opção';
  }
  const total = grandTotalValue();
  checkoutSummaryTotal.textContent = total === null ? 'A definir' : formatPrice(total);
}

function resetCheckoutStage() {
  if (checkoutLayout) checkoutLayout.hidden = false;
  if (checkoutProgress) checkoutProgress.hidden = false;
  if (checkoutSuccess) checkoutSuccess.hidden = true;
  if (orderConfirmed) orderConfirmed.hidden = true;
}

function openCheckout() {
  if (!cart.length) {
    showToast('Adicione pelo menos um produto ao carrinho.');
    return;
  }
  closeCart();
  pendingOrderData = null;
  resetCheckoutStage();
  renderCheckoutSummary();
  const currentState = document.getElementById('customerState')?.value.trim().toUpperCase();
  if (currentState && BRAZIL_STATES.has(currentState)) renderShippingOptions(currentState);
  else resetShipping();
  checkoutBackdrop.hidden = false;
  document.body.classList.add('modal-open');
  setTimeout(() => document.getElementById('customerName')?.focus(), 40);
}

function closeCheckout() {
  checkoutBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

function setFieldError(input, message = '') {
  const field = input?.closest('.field');
  if (!field) return;
  field.classList.toggle('has-error', Boolean(message));
  const error = field.querySelector('.field-error');
  if (error) error.textContent = message;
}

function validateCheckout() {
  let valid = true;
  const requiredInputs = [...checkoutForm.querySelectorAll('input[required]')];
  requiredInputs.forEach(input => {
    setFieldError(input, '');
    if (!input.value.trim()) {
      setFieldError(input, 'Preencha este campo.');
      valid = false;
    }
  });

  const name = document.getElementById('customerName');
  const cpf = document.getElementById('customerCpf');
  const phone = document.getElementById('customerPhone');
  const email = document.getElementById('customerEmail');
  const cep = document.getElementById('customerCep');
  const state = document.getElementById('customerState');

  if (name.value.trim() && name.value.trim().split(/\s+/).length < 2) {
    setFieldError(name, 'Informe nome e sobrenome.'); valid = false;
  }
  if (cpf.value && !isValidCpf(cpf.value)) {
    setFieldError(cpf, 'CPF inválido.'); valid = false;
  }
  if (phone.value && digits(phone.value).length < 10) {
    setFieldError(phone, 'Telefone inválido.'); valid = false;
  }
  if (email.value && !email.validity.valid) {
    setFieldError(email, 'E-mail inválido.'); valid = false;
  }
  if (cep.value && digits(cep.value).length !== 8) {
    setFieldError(cep, 'CEP inválido.'); valid = false;
  }
  if (state.value && !BRAZIL_STATES.has(state.value.trim().toUpperCase())) {
    setFieldError(state, 'Informe uma UF válida.'); valid = false;
  }

  if (!selectedShipping) {
    if (shippingError) shippingError.textContent = 'Escolha uma opção de entrega.';
    valid = false;
  } else if (shippingError) {
    shippingError.textContent = '';
  }

  if (!selectedPayment) {
    if (paymentError) paymentError.textContent = 'Escolha PIX ou cartão de crédito.';
    valid = false;
  } else if (paymentError) {
    paymentError.textContent = '';
  }

  if (!valid) {
    checkoutForm.querySelector('.has-error input')?.focus();
    showToast('Confira os campos e as opções destacadas.');
  }
  return valid;
}

async function lookupCep() {
  const cep = digits(cepInput.value);
  if (cep.length !== 8) return;
  cepStatus.textContent = 'Buscando…';
  cepStatus.className = 'cep-status';
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) throw new Error('Falha na consulta');
    const data = await response.json();
    if (data.erro) throw new Error('CEP não encontrado');

    document.getElementById('customerStreet').value = data.logradouro || '';
    document.getElementById('customerDistrict').value = data.bairro || '';
    document.getElementById('customerCity').value = data.localidade || '';
    document.getElementById('customerState').value = (data.uf || '').toUpperCase();
    renderShippingOptions(data.uf || '');
    cepStatus.textContent = 'Encontrado';
    cepStatus.className = 'cep-status ok';
    setFieldError(cepInput, '');
    document.getElementById('customerNumber')?.focus();
  } catch (error) {
    cepStatus.textContent = 'Preencha manualmente';
    cepStatus.className = 'cep-status error';
    resetShipping('Não foi possível identificar o CEP. Preencha o endereço e a UF manualmente.');
  }
}

function generateOrderNumber() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  let suffix = '';
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(3);
    window.crypto.getRandomValues(bytes);
    suffix = Array.from(bytes, b => (b % 36).toString(36)).join('').toUpperCase();
  } else {
    suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  return `AGRA-${date}-${suffix}`;
}

checkoutForm?.addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.id === 'customerCpf') input.value = maskCpf(input.value);
  if (input.id === 'customerPhone') input.value = maskPhone(input.value);
  if (input.id === 'customerCep') input.value = maskCep(input.value);
  if (input.id === 'customerState') {
    input.value = input.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2);
    if (input.value.length === 2 && BRAZIL_STATES.has(input.value)) renderShippingOptions(input.value);
    else if (input.value.length < 2) resetShipping('Informe uma UF válida para calcular as opções de entrega.');
  }
  if (input.value.trim()) setFieldError(input, '');
});

cepInput?.addEventListener('blur', lookupCep);
cepInput?.addEventListener('input', () => {
  if (digits(cepInput.value).length === 8) lookupCep();
  else {
    cepStatus.textContent = '';
    cepStatus.className = 'cep-status';
    resetShipping();
  }
});

shippingOptions?.addEventListener('change', event => {
  const input = event.target.closest('input[name="shippingMethod"]');
  if (!input) return;
  selectedShipping = currentShippingQuotes.find(option => option.id === input.value) || null;
  shippingOptions.querySelectorAll('.shipping-option').forEach(label => {
    label.classList.toggle('selected', label.contains(input) && input.checked);
  });
  if (shippingError) shippingError.textContent = '';
  renderCheckoutSummary();
});

paymentOptions?.addEventListener('change', event => {
  const input = event.target.closest('input[name="paymentMethod"]');
  if (!input) return;
  selectedPayment = input.value in PAYMENT_LABELS ? input.value : null;
  paymentOptions.querySelectorAll('.payment-option').forEach(label => {
    label.classList.toggle('selected', label.contains(input) && input.checked);
  });
  if (paymentError) paymentError.textContent = '';
  renderCheckoutSummary();
});

checkoutForm?.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateCheckout()) return;

  const data = new FormData(checkoutForm);
  const total = grandTotalValue();
  const address = `${data.get('street')}, ${data.get('number')}${data.get('complement') ? ` - ${data.get('complement')}` : ''} - ${data.get('district')}, ${data.get('city')}/${data.get('state')} - CEP ${data.get('cep')}`;

  pendingOrderData = {
    name: data.get('name'),
    email: data.get('email'),
    phone: data.get('phone'),
    address,
    payment: selectedPayment,
    shipping: { ...selectedShipping },
    subtotal: checkoutTotalValue(),
    total,
    items: cart.map(item => {
      const product = products.find(p => p.id === item.id);
      return {
        productId: item.id,
        name: product?.name || item.id,
        weight: product?.weight || '',
        quantity: item.quantity,
        unitPrice: typeof product?.price === 'number' ? product.price : null
      };
    })
  };

  checkoutReview.innerHTML = `
    <strong>${escapeHTML(data.get('name'))}</strong><br>
    ${escapeHTML(data.get('email'))} • ${escapeHTML(data.get('phone'))}<br>
    ${escapeHTML(address)}<br><br>
    <strong>Entrega:</strong> ${escapeHTML(selectedShipping.name)} — ${formatPrice(selectedShipping.price)} • ${escapeHTML(selectedShipping.eta)}<br>
    <strong>Pagamento:</strong> ${escapeHTML(PAYMENT_LABELS[selectedPayment])}<br>
    <strong>${totalQuantity()} ${totalQuantity() === 1 ? 'item' : 'itens'}</strong> no pedido • <strong>Total ${total === null ? 'a definir' : formatPrice(total)}</strong>
  `;

  checkoutLayout.hidden = true;
  checkoutProgress.hidden = true;
  checkoutSuccess.hidden = false;
  orderConfirmed.hidden = true;
  checkoutBackdrop.scrollTo({ top: 0, behavior: 'smooth' });
});

confirmOrderTest?.addEventListener('click', async () => {
  if (!pendingOrderData) return;
  const number = generateOrderNumber();
  const button = confirmOrderTest;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = window.AgraDB?.configured ? 'Registrando pedido…' : 'Criando pedido de teste…';

  try {
    if (window.AgraDB?.configured) {
      await window.AgraDB.createOrder({
        orderNumber: number,
        customer: {
          name: pendingOrderData.name,
          email: pendingOrderData.email,
          phone: pendingOrderData.phone
        },
        delivery: { address: pendingOrderData.address },
        items: pendingOrderData.items,
        shipping: pendingOrderData.shipping,
        paymentMethod: pendingOrderData.payment,
        subtotal: pendingOrderData.subtotal,
        total: pendingOrderData.total
      });
    }

    if (orderNumber) orderNumber.textContent = number;
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({
        orderNumber: number,
        createdAt: new Date().toISOString(),
        paymentMethod: pendingOrderData.payment,
        shippingMethod: pendingOrderData.shipping?.id || null,
        items: pendingOrderData.items,
        total: pendingOrderData.total,
        status: window.AgraDB?.configured ? 'novo' : 'test-payment-pending'
      }));
    } catch {}

    cart = [];
    saveCart();
    renderCart();
    renderCheckoutSummary();
    checkoutSuccess.hidden = true;
    orderConfirmed.hidden = false;
    const statusBox = orderConfirmed.querySelector('.order-status-box strong');
    if (statusBox) statusBox.textContent = window.AgraDB?.configured ? 'Pedido recebido • pagamento pendente' : 'Aguardando integração de pagamento';
    const confirmTitle = orderConfirmed.querySelector('h2');
    const confirmText = orderConfirmed.querySelector('p');
    if (confirmTitle) confirmTitle.textContent = window.AgraDB?.configured ? 'Pedido registrado com sucesso.' : 'Pedido de teste registrado.';
    if (confirmText) confirmText.textContent = window.AgraDB?.configured
      ? 'Seu pedido já aparece no painel administrativo da AGRA. Nenhuma cobrança real é feita nesta etapa.'
      : 'Use este fluxo para validar a experiência da loja antes de conectarmos o banco de dados e o gateway.';
    pendingOrderData = null;
    checkoutBackdrop.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error(error);
    const message = error?.message || 'Não foi possível registrar o pedido. Verifique o Firebase.';
    showToast(message);
    if (/estoque|disponível|produto/i.test(message)) {
      await syncProductsFromFirebase();
      renderCheckoutSummary();
    }
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

checkoutBtn?.addEventListener('click', openCheckout);
checkoutClose?.addEventListener('click', closeCheckout);
checkoutBackdrop?.addEventListener('click', event => {
  if (event.target === checkoutBackdrop) closeCheckout();
});
backToCheckout?.addEventListener('click', () => {
  checkoutSuccess.hidden = true;
  orderConfirmed.hidden = true;
  checkoutLayout.hidden = false;
  checkoutProgress.hidden = false;
});
finishCheckoutTest?.addEventListener('click', () => {
  closeCheckout();
  showToast(window.AgraDB?.configured ? 'Pedido registrado. Nenhuma cobrança foi realizada.' : 'Pedido de teste criado. Nenhuma cobrança foi realizada.');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && checkoutBackdrop && !checkoutBackdrop.hidden) closeCheckout();
});
