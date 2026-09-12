(function () {
  'use strict';

  const config = window.AGRA_FIREBASE_CONFIG || {};
  const isPlaceholder = value => !value || String(value).includes('COLE_AQUI');
  const configured = Boolean(config.projectId) && !Object.values(config).some(isPlaceholder);

  const fallback = {
    configured: false,
    ready: Promise.resolve(false),
    async loadProducts() { return null; },
    async createOrder() { throw new Error('Firebase ainda não configurado.'); },
    async adminSignIn() { throw new Error('Firebase ainda não configurado.'); },
    async adminSignOut() {},
    async currentAdmin() { return null; },
    onAuthStateChanged(callback) { callback(null); return () => {}; },
    async listAdminProducts() { return []; },
    async saveProduct() { throw new Error('Firebase ainda não configurado.'); },
    async deleteProduct() { throw new Error('Firebase ainda não configurado.'); },
    async seedProducts() { throw new Error('Firebase ainda não configurado.'); },
    async listOrders() { return []; },
    async updateOrderStatus() { throw new Error('Firebase ainda não configurado.'); }
  };

  if (!configured || !window.firebase) {
    window.AgraDB = fallback;
    window.dispatchEvent(new CustomEvent('agra:firebase-ready', { detail: { configured: false } }));
    return;
  }

  let app;
  try {
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
  } catch (error) {
    console.error('Falha ao inicializar Firebase:', error);
    window.AgraDB = fallback;
    window.dispatchEvent(new CustomEvent('agra:firebase-ready', { detail: { configured: false, error } }));
    return;
  }

  const auth = app.auth();
  const db = app.firestore();

  async function ensureShopUser() {
    if (auth.currentUser) return auth.currentUser;
    const credential = await auth.signInAnonymously();
    return credential.user;
  }

  function normalizeProduct(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || '',
      weight: data.weight || '',
      category: data.category || 'individual',
      tag: data.tag || '',
      badge: data.badge || '',
      stockQty: Number.isFinite(Number(data.stockQty)) ? Number(data.stockQty) : 0,
      featured: Boolean(data.featured),
      active: data.active !== false,
      price: typeof data.price === 'number' ? data.price : null,
      description: data.description || '',
      image: data.image || 'assets/logo-agra.png',
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 999
    };
  }

  async function loadProducts() {
    const snap = await db.collection('products').get();
    return snap.docs
      .map(normalizeProduct)
      .filter(p => p.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async function createOrder(order) {
    const user = await ensureShopUser();
    const orderNumber = String(order.orderNumber || '').trim();
    if (!orderNumber) throw new Error('Número do pedido inválido.');

    const requestedItems = (order.items || []).slice(0, 30).map(item => ({
      productId: String(item.productId || '').trim().slice(0, 80),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)))
    }));
    if (!requestedItems.length || requestedItems.some(item => !item.productId)) {
      throw new Error('O carrinho possui um item inválido. Atualize a loja e tente novamente.');
    }

    // Agrupa itens iguais para validar o estoque corretamente mesmo se o pedido
    // tiver sido manipulado fora da interface normal da loja.
    const quantities = new Map();
    requestedItems.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity));

    const orderRef = db.collection('orders').doc(orderNumber);
    const productRefs = [...quantities.keys()].map(id => db.collection('products').doc(id));

    await db.runTransaction(async transaction => {
      const existingOrder = await transaction.get(orderRef);
      if (existingOrder.exists) throw new Error('Este número de pedido já existe. Tente novamente.');

      const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
      const liveProducts = new Map();

      productSnaps.forEach(snap => {
        if (!snap.exists) throw new Error('Um produto do carrinho não está mais disponível. Atualize a página.');
        const data = snap.data();
        const requestedQty = quantities.get(snap.id) || 0;
        const stockQty = Math.max(0, Math.floor(Number(data.stockQty) || 0));
        if (data.active === false) throw new Error(`${data.name || 'Um produto'} não está disponível no momento.`);
        if (stockQty < requestedQty) {
          throw new Error(`Estoque insuficiente para ${data.name || snap.id}. Disponível: ${stockQty}.`);
        }
        liveProducts.set(snap.id, {
          id: snap.id,
          name: String(data.name || snap.id).slice(0, 140),
          weight: String(data.weight || '').slice(0, 40),
          price: typeof data.price === 'number' ? data.price : null
        });
      });

      const items = requestedItems.map(item => {
        const product = liveProducts.get(item.productId);
        return {
          productId: item.productId,
          name: product.name,
          weight: product.weight,
          quantity: item.quantity,
          unitPrice: product.price
        };
      });

      const allPriced = items.every(item => typeof item.unitPrice === 'number');
      const subtotal = allPriced
        ? items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
        : null;
      const shippingPrice = Math.max(0, Number(order.shipping?.price || 0));
      const total = typeof subtotal === 'number' ? subtotal + shippingPrice : null;

      const payload = {
        orderNumber,
        customerUid: user.uid,
        customer: {
          name: String(order.customer?.name || '').slice(0, 120),
          email: String(order.customer?.email || '').slice(0, 160),
          phone: String(order.customer?.phone || '').slice(0, 40)
        },
        delivery: {
          address: String(order.delivery?.address || '').slice(0, 420)
        },
        items,
        shipping: {
          id: String(order.shipping?.id || '').slice(0, 40),
          name: String(order.shipping?.name || '').slice(0, 80),
          price: shippingPrice,
          eta: String(order.shipping?.eta || '').slice(0, 80)
        },
        paymentMethod: order.paymentMethod === 'card' ? 'card' : 'pix',
        paymentStatus: 'pending',
        status: 'novo',
        subtotal,
        total,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(orderRef, payload);
    });

    return orderRef.id;
  }

  async function isAdminUser(user) {
    if (!user || user.isAnonymous) return false;
    try {
      const snap = await db.collection('admins').doc(user.uid).get();
      return snap.exists && snap.data()?.active !== false;
    } catch (error) {
      console.warn('Não foi possível validar o administrador:', error);
      return false;
    }
  }

  async function currentAdmin() {
    const user = auth.currentUser;
    return (await isAdminUser(user)) ? user : null;
  }

  async function adminSignIn(email, password) {
    if (auth.currentUser?.isAnonymous) await auth.signOut();
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const allowed = await isAdminUser(credential.user);
    if (!allowed) {
      await auth.signOut();
      throw new Error('Este usuário não possui permissão de administrador.');
    }
    return credential.user;
  }

  async function adminSignOut() {
    await auth.signOut();
  }

  function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(async user => {
      if (!user || user.isAnonymous) return callback(null);
      callback((await isAdminUser(user)) ? user : null);
    });
  }

  async function listAdminProducts() {
    const snap = await db.collection('products').get();
    return snap.docs.map(normalizeProduct).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async function saveProduct(product) {
    const admin = await currentAdmin();
    if (!admin) throw new Error('Sessão administrativa inválida.');
    if (!product.id) throw new Error('Produto sem identificador.');

    const price = product.price === '' || product.price == null ? null : Number(product.price);
    const imageValue = String(product.image || 'assets/logo-agra.png').trim();
    if (imageValue.startsWith('data:image/') && imageValue.length > 520000) {
      throw new Error('A foto ficou grande demais para o modo gratuito. Selecione outra imagem ou uma foto com menor resolução.');
    }
    if (!imageValue.startsWith('data:image/') && imageValue.length > 1200) {
      throw new Error('Endereço de imagem inválido.');
    }
    const data = {
      name: String(product.name || '').trim().slice(0, 140),
      weight: String(product.weight || '').trim().slice(0, 40),
      category: String(product.category || 'individual').slice(0, 60),
      tag: String(product.tag || '').trim().slice(0, 100),
      badge: String(product.badge || '').trim().slice(0, 100),
      description: String(product.description || '').trim().slice(0, 700),
      image: imageValue,
      price: Number.isFinite(price) ? Math.max(0, price) : null,
      stockQty: Math.max(0, Math.floor(Number(product.stockQty) || 0)),
      active: Boolean(product.active),
      featured: Boolean(product.featured),
      sortOrder: Math.max(0, Math.floor(Number(product.sortOrder) || 0)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = db.collection('products').doc(product.id);
    const existing = await ref.get();
    if (!existing.exists) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(data, { merge: true });
  }

  async function deleteProduct(productId) {
    const admin = await currentAdmin();
    if (!admin) throw new Error('Sessão administrativa inválida.');
    const id = String(productId || '').trim();
    if (!id) throw new Error('Produto inválido.');
    await db.collection('products').doc(id).delete();
  }

  async function seedProducts() {
    const admin = await currentAdmin();
    if (!admin) throw new Error('Sessão administrativa inválida.');

    const seed = [
      {
        id: 'mel-500', name: 'Mel AGRA 500g', weight: '500g', category: 'individual',
        tag: 'Tamanho favorito', badge: 'Mais vendido', featured: true, active: true,
        price: null, stockQty: 0, sortOrder: 10,
        description: 'Embalagem prática para o dia a dia, com excelente equilíbrio entre quantidade e praticidade.',
        image: 'assets/mel-agra-500g-catalogo.jpg'
      },
      {
        id: 'mel-1kg', name: 'Mel AGRA 1kg', weight: '1kg', category: 'individual',
        tag: 'Para a família', badge: 'Maior tamanho', featured: false, active: true,
        price: null, stockQty: 0, sortOrder: 20,
        description: 'Nossa maior embalagem, ideal para consumo frequente, receitas e para compartilhar em família.',
        image: 'assets/mel-agra-1kg-catalogo.jpg'
      }
    ];

    const batch = db.batch();
    seed.forEach(item => {
      const { id, ...data } = item;
      batch.set(db.collection('products').doc(id), {
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  async function listOrders() {
    const admin = await currentAdmin();
    if (!admin) throw new Error('Sessão administrativa inválida.');
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function updateOrderStatus(orderId, status) {
    const admin = await currentAdmin();
    if (!admin) throw new Error('Sessão administrativa inválida.');

    const allowed = new Set(['novo', 'confirmado', 'separando', 'enviado', 'entregue', 'cancelado']);
    if (!allowed.has(status)) throw new Error('Status inválido.');

    const orderRef = db.collection('orders').doc(String(orderId || '').trim());
    const stockStatuses = new Set(['confirmado', 'separando', 'enviado', 'entregue']);
    const shouldHoldStock = stockStatuses.has(status);

    await db.runTransaction(async transaction => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) throw new Error('Pedido não encontrado.');

      const order = orderSnap.data();
      const stockAdjusted = order.stockAdjusted === true;
      const needsStockChange = stockAdjusted !== shouldHoldStock;

      if (needsStockChange) {
        const quantities = new Map();
        (Array.isArray(order.items) ? order.items : []).forEach(item => {
          const id = String(item.productId || '').trim();
          const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
          if (id) quantities.set(id, (quantities.get(id) || 0) + qty);
        });
        if (!quantities.size) throw new Error('O pedido não possui produtos válidos para movimentar o estoque.');

        const refs = [...quantities.keys()].map(id => db.collection('products').doc(id));
        const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));

        snaps.forEach(snap => {
          if (!snap.exists) throw new Error(`O produto ${snap.id} foi excluído e o estoque não pode ser ajustado automaticamente.`);
          const data = snap.data();
          const currentStock = Math.max(0, Math.floor(Number(data.stockQty) || 0));
          const qty = quantities.get(snap.id) || 0;
          if (shouldHoldStock && currentStock < qty) {
            throw new Error(`Estoque insuficiente para ${data.name || snap.id}. Disponível: ${currentStock}; pedido: ${qty}.`);
          }
        });

        snaps.forEach(snap => {
          const data = snap.data();
          const currentStock = Math.max(0, Math.floor(Number(data.stockQty) || 0));
          const qty = quantities.get(snap.id) || 0;
          transaction.update(snap.ref, {
            stockQty: shouldHoldStock ? currentStock - qty : currentStock + qty,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      }

      const orderUpdate = {
        status,
        stockAdjusted: shouldHoldStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (needsStockChange && shouldHoldStock) {
        orderUpdate.stockAdjustedAt = firebase.firestore.FieldValue.serverTimestamp();
        orderUpdate.stockReleasedAt = firebase.firestore.FieldValue.delete();
      } else if (needsStockChange && !shouldHoldStock) {
        orderUpdate.stockReleasedAt = firebase.firestore.FieldValue.serverTimestamp();
        orderUpdate.stockAdjustedAt = firebase.firestore.FieldValue.delete();
      }

      transaction.update(orderRef, orderUpdate);
    });
  }

  window.AgraDB = {
    configured: true,
    ready: Promise.resolve(true),
    loadProducts,
    createOrder,
    adminSignIn,
    adminSignOut,
    currentAdmin,
    onAuthStateChanged,
    listAdminProducts,
    saveProduct,
    deleteProduct,
    seedProducts,
    listOrders,
    updateOrderStatus
  };

  window.dispatchEvent(new CustomEvent('agra:firebase-ready', { detail: { configured: true } }));
})();
