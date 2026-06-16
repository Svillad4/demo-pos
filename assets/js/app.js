const STORAGE_KEY = 'gyozapos-pro-state';
let state = loadState();
let currentUser = null;
let currentEditingOrderId = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  bindBaseEvents();
  seedSession();
  renderAll();
});

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(GYOZA_DEMO_DATA));
  return structuredClone(GYOZA_DEMO_DATA);
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function seedSession() {
  const savedUser = localStorage.getItem('gyozapos-current-user');
  if (savedUser) { currentUser = JSON.parse(savedUser); closeLoginModal(); updateUserUI(); }
  else openLoginModal();
}

function bindBaseEvents() {
  document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  document.querySelectorAll('[data-view-link]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.viewLink)));
  document.getElementById('toggleSidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  // MEJORA UI: Confirmación antes de cerrar sesión
  document.getElementById('logoutBtn').addEventListener('click', () => {
    confirmAction('¿Desea cerrar sesión?', logout);
  });
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('closeOrderModal').addEventListener('click', closeOrderModal);
  document.getElementById('refreshKitchenBtn').addEventListener('click', renderKitchenBoard);
  document.getElementById('purchaseForm').addEventListener('submit', createPurchase);
  document.getElementById('newOrderBtn').addEventListener('click', createQuickOrder);
  document.getElementById('sendOrderToKitchenBtn').addEventListener('click', () => updateCurrentOrderStatus('en cocina'));
  document.getElementById('saveOrderDraftBtn').addEventListener('click', () => updateCurrentOrderStatus('abierto', true));
  document.getElementById('markOrderPaidBtn').addEventListener('click', markCurrentOrderPaid);
  document.getElementById('loginModal').addEventListener('click', (event) => { if (event.target.id === 'loginModal') showToast('Debes iniciar sesión para usar el sistema.'); });
  document.getElementById('orderModal').addEventListener('click', (event) => { if (event.target.id === 'orderModal') closeOrderModal(); });
}

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value.trim();
  const user = state.users.find(item => item.email.toLowerCase() === email && item.password === password);
  if (!user) return showToast('Credenciales incorrectas. Usa el usuario demo.');
  currentUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  localStorage.setItem('gyozapos-current-user', JSON.stringify(currentUser));
  closeLoginModal(); updateUserUI(); pushActivity('Inicio de sesión exitoso', `${currentUser.name} ingresó al panel del restaurante.`); renderAll(); showToast(`Bienvenido, ${currentUser.name}.`);
}
function logout() { currentUser = null; localStorage.removeItem('gyozapos-current-user'); openLoginModal(); updateUserUI(); showToast('Sesión cerrada.'); }
function openLoginModal() { document.getElementById('loginModal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('loginModal').classList.add('hidden'); }
function updateUserUI() {
  const userName = currentUser?.name || 'Invitado';
  const userRole = currentUser?.role || 'Sin sesión';
  const initials = userName.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase();
  document.getElementById('userName').textContent = userName;
  document.getElementById('userRole').textContent = userRole;
  document.getElementById('userInitials').textContent = initials || 'GP';
  document.getElementById('sessionBadge').textContent = currentUser ? `Sesión activa: ${userRole}` : 'Sistema local listo';
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === viewName));
  const view = document.getElementById(`${viewName}View`);
  if (view) view.classList.add('active');
  const titles = {
    dashboard: ['Resumen del negocio', 'Control general del restaurante en tiempo real.'],
    mesas: ['Gestión de mesas', 'Toma pedidos desde las mesas y coordina el servicio.'],
    cocina: ['Panel de cocina', 'Pedidos enviados por el salón para producción.'],
    compras: ['Compras e inventario', 'Control básico de abastecimiento y costos.'],
    ventas: ['Ventas y facturación', 'Pedidos pagados y análisis de rendimiento.'],
    catalogo: ['Catálogo del restaurante', 'Menú operativo para el flujo de pedidos.']
  };
  const [title, subtitle] = titles[viewName] || ['Sistema DemoPOS Pro', 'Panel de administración'];
  document.getElementById('viewTitle').textContent = title;
  document.getElementById('viewSubtitle').textContent = subtitle;
  document.getElementById('sidebar').classList.remove('open');
  if (viewName === 'cocina') renderKitchenBoard();
  if (viewName === 'mesas') renderTables();
  if (viewName === 'ventas') renderSales();
  if (viewName === 'compras') renderPurchases();
}

function renderAll() { renderStats(); renderActivity(); renderQuickInsights(); renderTables(); renderKitchenBoard(); renderPurchases(); renderSales(); renderMenuCatalog(); }
function renderStats() {
  const grid = document.getElementById('statsGrid');
  const salesTotal = getPaidOrders().reduce((sum, order) => sum + getOrderTotal(order), 0);
  const purchaseTotal = state.purchases.reduce((sum, purchase) => sum + purchase.qty * purchase.unitPrice, 0);
  const pendingKitchen = state.orders.filter(order => ['en cocina', 'listo'].includes(order.status)).length;
  const occupiedTables = state.tables.filter(table => ['ocupada', 'en espera', 'listo'].includes(normalizeTableStatus(table.status))).length;
  const stats = [
    { title: 'Ventas del día', value: formatCurrency(salesTotal), meta: 'Pedidos pagados y cerrados.' },
    { title: 'Compras registradas', value: formatCurrency(purchaseTotal), meta: 'Costos cargados en el sistema.' },
    { title: 'Mesas activas', value: occupiedTables, meta: 'Mesas con operación en curso.' },
    { title: 'Pedidos en cocina', value: pendingKitchen, meta: 'Pedidos que requieren atención del chef.' }
  ];
  grid.innerHTML = stats.map(stat => `<article class="stat-card"><h4>${stat.title}</h4><div class="stat-value">${stat.value}</div><div class="stat-meta">${stat.meta}</div></article>`).join('');
}
function renderActivity() {
  document.getElementById('activityFeed').innerHTML = state.activity.slice().reverse().slice(0, 6).map(item => `<article class="feed-item"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join('');
}
function renderQuickInsights() {
  const salesTotal = getPaidOrders().reduce((sum, order) => sum + getOrderTotal(order), 0);
  const purchaseTotal = state.purchases.reduce((sum, purchase) => sum + purchase.qty * purchase.unitPrice, 0);
  const profitEstimate = salesTotal - purchaseTotal;
  const averageTicket = getPaidOrders().length ? salesTotal / getPaidOrders().length : 0;
  const insights = [
    { title: 'Ticket promedio', detail: formatCurrency(averageTicket) },
    { title: 'Margen estimado simple', detail: formatCurrency(profitEstimate) },
    { title: 'Producto más vendido', detail: getTopSellingItem() || 'Aún no hay suficientes ventas' },
    { title: 'Mesero con más cierres', detail: getTopWaiter() || 'Sin datos suficientes' }
  ];
  document.getElementById('quickInsights').innerHTML = insights.map(item => `<article class="list-item"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join('');
}
function renderTables() {
  const grid = document.getElementById('mesasGrid');
  grid.innerHTML = state.tables.map(table => {
    const order = table.currentOrderId ? state.orders.find(item => item.id === table.currentOrderId) : null;
    const displayStatus = order ? order.status : normalizeTableStatus(table.status);
    return `<article class="mesa-card"><header><div><h4>${table.name}</h4><p>${table.seats} puestos • ${table.waiter}</p></div><span class="status-pill ${statusClass(displayStatus)}">${displayStatus}</span></header><div class="mesa-meta"><p><strong>Pedido actual:</strong> ${order ? '#' + order.id : 'Sin pedido'}</p><p><strong>Total actual:</strong> ${order ? formatCurrency(getOrderTotal(order)) : '$0'}</p></div><div class="action-row"><button class="btn btn-primary" onclick="openOrderForTable(${table.id})">Tomar pedido</button><button class="btn btn-secondary" onclick="viewKitchenFromTable(${table.id})">Ver flujo</button></div></article>`;
  }).join('');
}
function renderKitchenBoard() {
  const board = document.getElementById('kitchenBoard');
  const kitchenOrders = state.orders.filter(order => ['en cocina', 'listo'].includes(order.status));
  if (!kitchenOrders.length) return board.innerHTML = `<article class="card"><strong>Sin pedidos en cocina</strong><p>No hay órdenes activas para preparar en este momento.</p></article>`;
  board.innerHTML = kitchenOrders.map(order => `<article class="kitchen-ticket"><div class="card-header"><h4>${order.tableName} • Pedido #${order.id}</h4><span class="status-pill ${statusClass(order.status)}">${order.status}</span></div><p><strong>Mesero:</strong> ${order.waiter}</p><p><strong>Enviado:</strong> ${order.sentToKitchenAt || 'Pendiente'}</p><ul class="ticket-items">${order.items.map(item => `<li>${item.qty} × ${item.name}</li>`).join('')}</ul><div class="ticket-footer"><strong>${formatCurrency(getOrderTotal(order))}</strong><div class="action-row">${order.status !== 'listo' ? `<button class="btn btn-secondary" onclick="setKitchenStatus(${order.id}, 'listo')">Marcar listo</button>` : ''}<button class="btn btn-primary" onclick="openOrderById(${order.id})">Abrir pedido</button></div></div></article>`).join('');
}
function renderPurchases() {
  const tbody = document.getElementById('purchasesTableBody');
  const total = state.purchases.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  document.getElementById('purchaseTotalBadge').textContent = formatCurrency(total);
  const summary = [
    { title: 'Número de compras', detail: String(state.purchases.length) },
    { title: 'Mayor compra', detail: formatCurrency(Math.max(...state.purchases.map(item => item.qty * item.unitPrice))) },
    { title: 'Último proveedor', detail: state.purchases[0]?.supplier || 'Sin datos' }
  ];
  document.getElementById('purchaseSummary').innerHTML = summary.map(item => `<article class="list-item"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join('');
  tbody.innerHTML = state.purchases.slice().reverse().map(item => `<tr><td>${item.date}</td><td>${item.item}</td><td>${item.supplier}</td><td>${item.qty}</td><td>${formatCurrency(item.unitPrice)}</td><td>${formatCurrency(item.qty * item.unitPrice)}</td></tr>`).join('');
}
function renderSales() {
  const paidOrders = getPaidOrders();
  const tbody = document.getElementById('salesTableBody');
  const salesTotal = paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  document.getElementById('salesTotalBadge').textContent = formatCurrency(salesTotal);
  const summary = [
    { title: 'Órdenes facturadas', detail: String(paidOrders.length) },
    { title: 'Venta más alta', detail: formatCurrency(Math.max(0, ...paidOrders.map(order => getOrderTotal(order)))) },
    { title: 'Mesa más rentable', detail: getBestTable() || 'Sin datos suficientes' }
  ];
  document.getElementById('salesSummary').innerHTML = summary.map(item => `<article class="list-item"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join('');
  const purchaseTotal = state.purchases.reduce((sum, purchase) => sum + purchase.qty * purchase.unitPrice, 0);
  document.getElementById('tradeSummary').innerHTML = [
    { title: 'Total compras', detail: formatCurrency(purchaseTotal) },
    { title: 'Total ventas', detail: formatCurrency(salesTotal) },
    { title: 'Balance simple', detail: formatCurrency(salesTotal - purchaseTotal) }
  ].map(item => `<article class="list-item"><strong>${item.title}</strong><p>${item.detail}</p></article>`).join('');
  tbody.innerHTML = paidOrders.slice().reverse().map(order => `<tr><td>${order.paidAt || order.createdAt}</td><td>${order.tableName}</td><td>${order.waiter}</td><td>${order.items.map(item => `${item.qty}×${item.name}`).join(', ')}</td><td><span class="status-pill ${statusClass(order.status)}">${order.status}</span></td><td>${formatCurrency(getOrderTotal(order))}</td></tr>`).join('');
}
function renderMenuCatalog() {
  document.getElementById('menuGrid').innerHTML = state.menu.map(item => `<article class="menu-card"><span class="badge badge-info">${item.category}</span><h4>${item.name}</h4><p>${item.description}</p><div class="menu-price">${formatCurrency(item.price)}</div><p><strong>Preparación:</strong> ${item.prepTime}</p></article>`).join('');
}
function openOrderForTable(tableId) {
  const table = state.tables.find(item => item.id === tableId); if (!table) return;
  let order = table.currentOrderId ? state.orders.find(item => item.id === table.currentOrderId) : null;
  if (!order) {
    order = { id: generateId('order'), tableId: table.id, tableName: table.name, waiter: currentUser?.name || table.waiter, status: 'abierto', createdAt: nowText(), sentToKitchenAt: null, paidAt: null, items: [] };
    state.orders.push(order); table.currentOrderId = order.id; table.status = 'ocupada'; saveState();
  }
  currentEditingOrderId = order.id;
  document.getElementById('orderModalTitle').textContent = `${table.name} • Pedido #${order.id}`;
  document.getElementById('orderModal').classList.remove('hidden');
  renderOrderEditor();
}
function openOrderById(orderId) { const order = state.orders.find(item => item.id === orderId); if (order) openOrderForTable(order.tableId); }
function closeOrderModal() { currentEditingOrderId = null; document.getElementById('orderModal').classList.add('hidden'); }
function renderOrderEditor() {
  const order = state.orders.find(item => item.id === currentEditingOrderId); if (!order) return;
  document.getElementById('orderStatusBadge').textContent = order.status;
  document.getElementById('orderMenuList').innerHTML = state.menu.map(item => `<article class="selector-item"><div class="selector-row"><div class="selector-meta"><strong>${item.name}</strong><span>${item.category} • ${item.prepTime}</span></div><strong>${formatCurrency(item.price)}</strong></div><p>${item.description}</p><div class="action-row"><button class="btn btn-primary" onclick="addItemToCurrentOrder(${item.id})">Agregar</button></div></article>`).join('');
  const itemsWrap = document.getElementById('currentOrderItems');
  itemsWrap.innerHTML = !order.items.length
    ? `<article class="list-item"><strong>Aún no hay productos</strong><p>Agrega elementos del catálogo para construir el pedido.</p></article>`
    : order.items.map((item, index) => `<article class="selector-item"><div class="order-row"><div class="order-meta"><strong>${item.name}</strong><span>${item.qty} × ${formatCurrency(item.price)}</span></div><strong>${formatCurrency(item.qty * item.price)}</strong></div><div class="action-row"><button class="btn btn-secondary" onclick="changeQty(${index}, -1)">-1</button><button class="btn btn-secondary" onclick="changeQty(${index}, 1)">+1</button><button class="btn btn-danger" onclick="removeItemFromCurrentOrder(${index})">Quitar</button></div></article>`).join('');
  const subtotal = getOrderSubtotal(order), service = subtotal * 0.08, total = subtotal + service;
  document.getElementById('orderSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('orderService').textContent = formatCurrency(service);
  document.getElementById('orderTotal').textContent = formatCurrency(total);
}
function addItemToCurrentOrder(menuId) {
  const order = state.orders.find(item => item.id === currentEditingOrderId), menuItem = state.menu.find(item => item.id === menuId);
  if (!order || !menuItem) return;
  const existing = order.items.find(item => item.menuId === menuId);
  if (existing) existing.qty += 1; else order.items.push({ menuId: menuItem.id, name: menuItem.name, qty: 1, price: menuItem.price });
  saveState(); renderOrderEditor(); renderTables(); showToast(`${menuItem.name} agregado al pedido.`);
}
function changeQty(index, delta) {
  const order = state.orders.find(item => item.id === currentEditingOrderId); if (!order || !order.items[index]) return;
  order.items[index].qty += delta; if (order.items[index].qty <= 0) order.items.splice(index, 1);
  saveState(); renderOrderEditor(); renderTables();
}
function removeItemFromCurrentOrder(index) {
  const order = state.orders.find(item => item.id === currentEditingOrderId); if (!order) return;
  order.items.splice(index, 1); saveState(); renderOrderEditor(); renderTables(); showToast('Producto eliminado del pedido.');
}
function updateCurrentOrderStatus(status, silent = false) {
  const order = state.orders.find(item => item.id === currentEditingOrderId); if (!order) return;
  if (!order.items.length) return showToast('Agrega al menos un producto antes de continuar.');
  order.status = status; if (status === 'en cocina') order.sentToKitchenAt = nowText();
  syncTableWithOrder(order); saveState(); renderOrderEditor(); renderAll();
  if (!silent) { const message = status === 'en cocina' ? `Pedido #${order.id} enviado a cocina.` : `Pedido #${order.id} guardado como borrador.`; pushActivity('Pedido actualizado', message); showToast(message); }
}
function setKitchenStatus(orderId, status) {
  const order = state.orders.find(item => item.id === orderId); if (!order) return;
  order.status = status; syncTableWithOrder(order); saveState(); renderAll(); pushActivity('Cocina actualizada', `El pedido #${order.id} fue marcado como ${status}.`); showToast(`Pedido #${order.id} marcado como ${status}.`);
}
function markCurrentOrderPaid() {
  // MEJORA AGREGADA: Confirmación antes de cerrar la cuenta
  confirmAction(
    '¿Desea cerrar esta cuenta?',
    () => {
      const order = state.orders.find(item => item.id === currentEditingOrderId); if (!order) return;
      if (!order.items.length) return showToast('No puedes cerrar una cuenta vacía.');
      order.status = 'pagado'; order.paidAt = nowText();
      const table = state.tables.find(item => item.id === order.tableId);
      if (table) { table.status = 'pagado'; table.currentOrderId = null; }
      saveState(); pushActivity('Venta cerrada', `${order.tableName} fue facturada por ${formatCurrency(getOrderTotal(order))}.`); closeOrderModal(); renderAll(); showToast(`Pedido #${order.id} marcado como pagado.`);
    }
  );
}
function syncTableWithOrder(order) {
  const table = state.tables.find(item => item.id === order.tableId); if (!table) return;
  if (order.status === 'abierto') table.status = 'ocupada';
  if (order.status === 'en cocina') table.status = 'en espera';
  if (order.status === 'listo') table.status = 'listo';
  if (order.status === 'pagado') { table.status = 'pagado'; table.currentOrderId = null; } else table.currentOrderId = order.id;
}
function createPurchase(event) {
  event.preventDefault();
  const item = document.getElementById('purchaseItem').value.trim(), supplier = document.getElementById('purchaseSupplier').value.trim(), qty = Number(document.getElementById('purchaseQty').value), unitPrice = Number(document.getElementById('purchaseUnitPrice').value), note = document.getElementById('purchaseNote').value.trim();
  if (!item || !supplier || qty <= 0 || unitPrice < 0) return showToast('Completa correctamente el formulario de compra.');
  state.purchases.push({ id: generateId('purchase'), date: new Date().toISOString().slice(0, 10), item, supplier, qty, unitPrice, note });
  saveState(); event.target.reset(); document.getElementById('purchaseQty').value = 1; document.getElementById('purchaseUnitPrice').value = 0;
  renderPurchases(); renderStats(); renderQuickInsights(); pushActivity('Compra registrada', `${item} fue cargado por ${formatCurrency(qty * unitPrice)}.`); showToast('Compra registrada correctamente.');
}
function createQuickOrder() { const freeTable = state.tables.find(table => !table.currentOrderId); if (!freeTable) return showToast('No hay mesas libres en este momento.'); openOrderForTable(freeTable.id); }
function viewKitchenFromTable(tableId) { switchView('cocina'); const table = state.tables.find(item => item.id === tableId); if (table?.currentOrderId) { const ticket = [...document.querySelectorAll('.kitchen-ticket')].find(card => card.textContent.includes(`#${table.currentOrderId}`)); if (ticket) ticket.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
function pushActivity(title, detail) { state.activity.push({ id: Date.now(), title, detail }); if (state.activity.length > 12) state.activity = state.activity.slice(-12); saveState(); }
function getPaidOrders() { return state.orders.filter(order => order.status === 'pagado'); }
function getOrderSubtotal(order) { return order.items.reduce((sum, item) => sum + item.qty * item.price, 0); }
function getOrderTotal(order) { const subtotal = getOrderSubtotal(order); return subtotal + subtotal * 0.08; }
function getTopSellingItem() {
  const counter = {}; getPaidOrders().forEach(order => order.items.forEach(item => { counter[item.name] = (counter[item.name] || 0) + item.qty; }));
  const top = Object.entries(counter).sort((a,b) => b[1]-a[1])[0]; return top ? `${top[0]} (${top[1]} unidades)` : null;
}
function getTopWaiter() {
  const counter = {}; getPaidOrders().forEach(order => { counter[order.waiter] = (counter[order.waiter] || 0) + 1; });
  const top = Object.entries(counter).sort((a,b) => b[1]-a[1])[0]; return top ? `${top[0]} (${top[1]} cierres)` : null;
}
function getBestTable() {
  const tableTotals = {}; getPaidOrders().forEach(order => { tableTotals[order.tableName] = (tableTotals[order.tableName] || 0) + getOrderTotal(order); });
  const top = Object.entries(tableTotals).sort((a,b) => b[1]-a[1])[0]; return top ? `${top[0]} • ${formatCurrency(top[1])}` : null;
}
function normalizeTableStatus(status) { return String(status).toLowerCase(); }
function statusClass(status) {
  const normalized = normalizeTableStatus(status).replaceAll(' ', '-');
  if (normalized.includes('libre')) return 'status-libre';
  if (normalized.includes('ocupada')) return 'status-ocupada';
  if (normalized.includes('espera')) return 'status-espera';
  if (normalized.includes('listo')) return 'status-listo';
  if (normalized.includes('pagado')) return 'status-pagado';
  return 'status-ocupada';
}
function generateId(type) { const base = Date.now().toString().slice(-6); return type === 'order' ? Number('5' + base) : Number('9' + base); }
function nowText() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function formatCurrency(value) { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(value || 0); }
function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400); }

// MEJORA AGREGADA: Función de confirmación modal genérica
function confirmAction(message, onConfirm) {
  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmYesBtn = document.getElementById('confirmYesBtn');
  const confirmNoBtn = document.getElementById('confirmNoBtn');
  
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
  
  const handleConfirm = () => {
    confirmModal.classList.add('hidden');
    cleanupHandlers();
    onConfirm();
  };
  
  const handleCancel = () => {
    confirmModal.classList.add('hidden');
    cleanupHandlers();
  };
  
  const cleanupHandlers = () => {
    confirmYesBtn.removeEventListener('click', handleConfirm);
    confirmNoBtn.removeEventListener('click', handleCancel);
  };
  
  confirmYesBtn.addEventListener('click', handleConfirm);
  confirmNoBtn.addEventListener('click', handleCancel);
}

// MEJORA AGREGADA: Función para borrar historial de compras
function clearPurchasesHistory() {
  confirmAction(
    '¿Está seguro de eliminar el historial de compras?',
    () => {
      state.purchases = [];
      saveState();
      renderPurchases();
      renderStats();
      renderQuickInsights();
      pushActivity('Historial borrado', 'El historial de compras fue eliminado completamente.');
      showToast('Historial de compras eliminado.');
    }
  );
}
