const API_URL = 'http://localhost:3000/api';

// Shopping Cart
let cart = [];
let appliedVoucher = null; // { code, stallId, discountAmount } — only valid for a single-stall cart

// Favorites
let favorites = [];

let reviewedOrderIds = new Set();
let selectedReviewRating = 0;

const authToken = localStorage.getItem('authToken');
let currentUserId = Number(localStorage.getItem('userId'));
if (!authToken || !currentUserId) {
    window.location.href = '/auth/login.html';
}

// The logged-in customer's own name/phone, used to fill in their checkout details
let currentUserProfile = null;

let selectedPaymentMethod = 'cash';

let currentHawkerId = 1;
let currentStallId = 1;
let favoriteFilter = 'all'; // 'all', 'menu', 'stall', 'hawker'
let currentBrowseView = null; // 'hawkers' | 'stalls' | 'menu' — tracks what's on screen in #browseContent

function showStatus(message, type) {
    type = type || 'success';
    const container = document.getElementById('statusMessages');
    const div = document.createElement('div');
    div.className = 'status ' + type;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(function() { div.remove(); }, 5000);
}

function updateCartBadge() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;

    const fab = document.getElementById('cartFab');
    const fabCount = document.getElementById('cartFabCount');
    if (fab && fabCount) {
        fabCount.textContent = count;
        fab.classList.toggle('cart-fab-active', count > 0);
    }
}

function cartStallIds() {
    return [...new Set(cart.map(item => item.stall_id))];
}

function clearVoucher() {
    appliedVoucher = null;
    const input = document.getElementById('voucherCodeInput');
    if (input) input.value = '';
    const message = document.getElementById('voucherMessage');
    if (message) {
        message.textContent = '';
        message.className = 'voucher-message';
    }
}

function updateCartTotal() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const stallIds = cartStallIds();
    const voucherStillApplies = appliedVoucher && stallIds.length === 1 && stallIds[0] === appliedVoucher.stallId;
    if (appliedVoucher && !voucherStillApplies) clearVoucher();

    const discount = voucherStillApplies ? appliedVoucher.discountAmount : 0;
    const total = Math.max(0, subtotal - discount);

    const discountRow = document.getElementById('cartDiscountRow');
    if (discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('cartDiscount').textContent = '-$' + discount.toFixed(2);
    } else {
        discountRow.style.display = 'none';
    }

    document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);
}

async function applyVoucherCode() {
    const input = document.getElementById('voucherCodeInput');
    const message = document.getElementById('voucherMessage');
    const code = input.value.trim();

    if (!code) {
        message.textContent = 'Enter a voucher code.';
        message.className = 'voucher-message invalid';
        return;
    }

    const stallIds = cartStallIds();
    if (stallIds.length !== 1) {
        message.textContent = 'Vouchers can only be applied when your cart has items from a single stall.';
        message.className = 'voucher-message invalid';
        return;
    }

    const stallId = stallIds[0];
    const orderAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
        const response = await fetch(API_URL + '/vouchers/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, stall_id: stallId, order_amount: orderAmount })
        });
        const data = await response.json();

        if (data.valid) {
            appliedVoucher = { code: code.toUpperCase(), stallId, discountAmount: data.data.discount_amount };
            message.textContent = data.message + ' You saved $' + data.data.discount_amount.toFixed(2) + '.';
            message.className = 'voucher-message valid';
        } else {
            appliedVoucher = null;
            message.textContent = data.message || 'This voucher is not valid.';
            message.className = 'voucher-message invalid';
        }
        updateCartTotal();
    } catch (error) {
        appliedVoucher = null;
        message.textContent = 'Could not validate this voucher right now.';
        message.className = 'voucher-message invalid';
    }
}

function renderCart() {
    const cartBody = document.getElementById('cartBody');
    const cartFooter = document.getElementById('cartFooter');
    const voucherBox = document.getElementById('voucherBox');

    if (cart.length === 0) {
        cartBody.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        cartFooter.style.display = 'none';
        voucherBox.style.display = 'none';
        clearVoucher();
        updateCartBadge();
        return;
    }

    voucherBox.style.display = 'block';

    // Group items by stall
    const stallGroups = {};
    cart.forEach(item => {
        const key = item.stall_id;
        if (!stallGroups[key]) {
            stallGroups[key] = {
                stall_id: item.stall_id,
                stall_name: item.stall_name,
                items: []
            };
        }
        stallGroups[key].items.push(item);
    });

    let html = '';
    let globalIndex = 0;

    for (const [stallId, group] of Object.entries(stallGroups)) {
        html += '<div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">';
        html += '  <div style="font-weight: bold; color: #2c3e50; margin-bottom: 8px;">Stall: ' + group.stall_name + '</div>';

        group.items.forEach((item) => {
            html += '<div class="cart-item">';
            const wasDiscounted = item.original_price && item.original_price > item.price;
            html += '  <div class="cart-item-info">';
            html += '    <div class="cart-item-name">' + item.item_name + '</div>';
            html += '    <div class="cart-item-price">' +
                (wasDiscounted ? '<span class="price-original">$' + item.original_price.toFixed(2) + '</span>' : '') +
                '$' + item.price.toFixed(2) + ' each</div>';
            html += '  </div>';
            html += '  <div class="cart-item-actions">';
            html += '    <button onclick="updateCartQuantity(' + globalIndex + ', -1)">-</button>';
            html += '    <span class="cart-item-quantity">' + item.quantity + '</span>';
            html += '    <button onclick="updateCartQuantity(' + globalIndex + ', 1)">+</button>';
            html += '    <span class="cart-item-subtotal">$' + (item.price * item.quantity).toFixed(2) + '</span>';
            html += '    <button onclick="removeFromCart(' + globalIndex + ')" class="danger" style="padding: 3px 8px; font-size: 12px;">×</button>';
            html += '  </div>';
            html += '</div>';
            globalIndex++;
        });

        // Show subtotal for this stall
        const stallTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        html += '  <div style="text-align: right; font-weight: bold; color: #2c3e50; margin-top: 5px;">Stall Total: $' + stallTotal.toFixed(2) + '</div>';
        html += '</div>';
    }

    cartBody.innerHTML = html;
    cartFooter.style.display = 'block';
    updateCartTotal();
    updateCartBadge();
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.method === method);
    });
}

function toggleCart() {
    const container = document.getElementById('cartContainer');
    const overlay = document.getElementById('cartOverlay');
    container.classList.toggle('open');
    overlay.classList.toggle('show');
}

function addToCart(menuItem, quantity, silent) {
    console.log('Adding to cart - menuItem:', menuItem);  // Debug

    quantity = parseInt(quantity) || 1;

    if (!menuItem.is_available) {
        showStatus('This item is currently unavailable', 'error');
        return;
    }

    // Validate that hawker_id exists
    if (!menuItem.hawker_id) {
        console.error('Missing hawker_id for menu item:', menuItem);
        showStatus('Error: Missing hawker information for this item', 'error');
        return;
    }

    const existingItem = cart.find(item => item.menu_id === menuItem.menu_id);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            menu_id: menuItem.menu_id,
            item_name: menuItem.item_name,
            price: parseFloat(menuItem.price),
            original_price: menuItem.original_price ? parseFloat(menuItem.original_price) : null,
            quantity: quantity,
            stall_id: menuItem.stall_id,
            hawker_id: parseInt(menuItem.hawker_id),
            stall_name: menuItem.stall_name || 'Stall'
        });
    }

    console.log('Current cart:', cart);  // Debug
    renderCart();
    if (!silent) {
        showStatus('Added ' + menuItem.item_name + ' to cart', 'success');
    }
}

function updateCartQuantity(index, delta) {
    if (index < 0 || index >= cart.length) return;

    cart[index].quantity += delta;

    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }

    renderCart();
}

function removeFromCart(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    if (!confirm('Clear all items from cart?')) return;
    cart = [];
    renderCart();
    showStatus('Cart cleared', 'info');
}

async function checkout() {
    if (cart.length === 0) {
        showStatus('Your cart is empty', 'error');
        return;
    }

    // Validate all cart items have hawker_id
    const missingHawker = cart.some(item => !item.hawker_id);
    if (missingHawker) {
        showStatus('Error: Some items in your cart are missing hawker information. Please re-add them.', 'error');
        console.error('Cart items missing hawker_id:', cart.filter(item => !item.hawker_id));
        return;
    }

    if (!currentUserProfile) await fetchUserProfile();

    const customerName = (currentUserProfile && currentUserProfile.username) || localStorage.getItem('username');
    if (!customerName) {
        showStatus('Could not load your account details. Please log in again.', 'error');
        return;
    }

    const customerPhone = (currentUserProfile && currentUserProfile.phone) || null;

    const paymentMethod = selectedPaymentMethod;

    // Group items by stall
    const stallGroups = {};
    cart.forEach(item => {
        const key = item.stall_id;
        if (!stallGroups[key]) {
            stallGroups[key] = {
                stall_id: item.stall_id,
                hawker_id: item.hawker_id,
                items: []
            };
        }
        stallGroups[key].items.push(item);
    });

    // Validate each group has hawker_id
    for (const [stallId, group] of Object.entries(stallGroups)) {
        if (!group.hawker_id) {
            showStatus(`Error: Stall ${stallId} has no hawker information`, 'error');
            return;
        }
    }

    // A voucher only travels with the checkout if it still matches a single-stall cart
    const stallIds = cartStallIds();
    const voucherToApply = appliedVoucher && stallIds.length === 1 && stallIds[0] === appliedVoucher.stallId
        ? appliedVoucher
        : null;

    let confirmationMessage = 'Confirm order for ' + customerName +
        (customerPhone ? ' (' + customerPhone + ')' : '') + ':\n\n';
    let totalAll = 0;

    for (const [stallId, group] of Object.entries(stallGroups)) {
        const stallName = group.items[0].stall_name || 'Stall';
        confirmationMessage += 'Stall: ' + stallName + '\n';
        group.items.forEach(item => {
            confirmationMessage += '  - ' + item.item_name + ' x' + item.quantity + ' = $' + (item.price * item.quantity).toFixed(2) + '\n';
        });
        const stallTotal = group.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        confirmationMessage += '  Stall Total: $' + stallTotal.toFixed(2) + '\n\n';
        totalAll += stallTotal;
    }
    if (voucherToApply) {
        confirmationMessage += 'Voucher ' + voucherToApply.code + ': -$' + voucherToApply.discountAmount.toFixed(2) + '\n';
        totalAll = Math.max(0, totalAll - voucherToApply.discountAmount);
    }
    confirmationMessage += 'Total: $' + totalAll.toFixed(2) + '\n\n';
    confirmationMessage += 'Proceed with order?';

    if (!confirm(confirmationMessage)) {
        return;
    }

    let successCount = 0;
    let errorMessages = [];

    // Create separate orders for each stall
    for (const [stallId, group] of Object.entries(stallGroups)) {
        const orderData = {
            stall_id: parseInt(stallId),
            hawker_id: group.hawker_id,
            customer_id: currentUserId,
            customer_name: customerName,
            customer_phone: customerPhone,
            payment_method: paymentMethod,
            special_instructions: '',
            voucher_code: (voucherToApply && voucherToApply.stallId === group.stall_id) ? voucherToApply.code : undefined,
            items: group.items.map(item => ({
                menu_id: item.menu_id,
                quantity: item.quantity
            }))
        };

        try {
            const response = await fetch(API_URL + '/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            const data = await response.json();

            if (data.success) {
                successCount++;
                showStatus('Order for ' + group.items[0].stall_name + ' placed successfully! Order #' + data.data.order_id, 'success');
            } else {
                errorMessages.push('Failed for ' + group.items[0].stall_name + ': ' + data.message);
            }
        } catch (error) {
            errorMessages.push('Failed for ' + group.items[0].stall_name + ': ' + error.message);
        }
    }

    // Clear cart if all orders were successful
    if (successCount > 0) {
        cart = [];
        clearVoucher();
        selectPaymentMethod('cash');
        renderCart();
        toggleCart();
        setTimeout(fetchOrders, 1500);
    }

    if (errorMessages.length > 0) {
        showStatus('Some orders failed: ' + errorMessages.join(' | '), 'error');
    } else if (successCount > 0) {
        showStatus(successCount + ' order(s) placed successfully!', 'success');
    }
}

// ==================== HAWKER / STALL DISPLAY WITH FAVORITE BUTTONS ====================

function formatHawkerDataWithFavorites(hawkers) {
    if (!hawkers || hawkers.length === 0) {
        return 'No hawker centres found.';
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    hawkers.forEach(h => {
        const hawkerId = h.hawker_id;
        const isFavorited = favorites.some(f => f.hawker_id === hawkerId && f.stall_id === null && f.menu_id === null);
        const favButtonText = isFavorited ? '❤️' : '🤍';
        const favButtonClass = isFavorited ? 'favorited' : 'unfavorited';

        html += '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center;">';
        html += '    <h4 style="margin: 0; color: #2c3e50;">' + (h.name || 'N/A') + '</h4>';
        html += '    <button class="favorite-btn ' + favButtonClass + '" onclick="toggleHawkerFavorite(' + hawkerId + ', this)" style="font-size: 20px; padding: 5px 12px;">' + favButtonText + '</button>';
        html += '  </div>';
        html += '  <div style="margin-top: 8px; font-size: 14px; color: #555;">';
        html += '    <div><strong>Address:</strong> ' + (h.address || 'N/A') + '</div>';
        html += '    <div><strong>Postal Code:</strong> ' + (h.postal_code || 'N/A') + '</div>';
        html += '    <div><strong>Operating Hours:</strong> ' + (h.operating_hours || 'N/A') + '</div>';
        html += '    <div><strong>Stalls:</strong> ' + (h.stalls ? h.stalls.length : 0) + '</div>';
        html += '  </div>';
        html += '  <div style="margin-top: 8px;">';
        html += '    <button onclick="viewHawker(' + hawkerId + ')" class="info" style="padding: 4px 12px; font-size: 12px;">View Details</button>';
        html += '    <button onclick="fetchStallsByHawker(' + hawkerId + ')" class="info" style="padding: 4px 12px; font-size: 12px;">View Stalls</button>';
        html += '  </div>';
        html += '</div>';
    });

    html += '</div>';
    return html;
}

function formatStallDataWithFavorites(stalls) {
    if (!stalls || stalls.length === 0) {
        return 'No stalls found.';
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

    stalls.forEach(s => {
        const hawkerId = s.hawker_id;
        const stallId = s.stall_id;
        const isFavorited = favorites.some(f => f.hawker_id === hawkerId && f.stall_id === stallId && f.menu_id === null);
        const favButtonText = isFavorited ? '❤️' : '🤍';
        const favButtonClass = isFavorited ? 'favorited' : 'unfavorited';

        html += '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">';
        html += '  <div style="display: flex; justify-content: space-between; align-items: center;">';
        html += '    <h4 style="margin: 0; color: #2c3e50;">' + (s.stall_name || 'N/A') + '</h4>';
        html += '    <button class="favorite-btn ' + favButtonClass + '" onclick="toggleStallFavorite(' + hawkerId + ', ' + stallId + ', this)" style="font-size: 20px; padding: 5px 12px;">' + favButtonText + '</button>';
        html += '  </div>';
        html += '  <div style="margin-top: 8px; font-size: 14px; color: #555;">';
        html += '    <div><strong>Stall Number:</strong> ' + (s.stall_number || 'N/A') + '</div>';
        html += '    <div><strong>Hawker Centre:</strong> ' + (s.hawker_name || 'N/A') + '</div>';
        html += '    <div><strong>Cuisine Type:</strong> ' + (s.cuisine_type || 'N/A') + '</div>';
        html += '    <div><strong>Description:</strong> ' + (s.description || 'No description') + '</div>';
        html += '    <div><strong>Contact:</strong> ' + (s.contact_number || 'N/A') + '</div>';
        html += '    <div><strong>Menu Items:</strong> ' + (s.menu_items ? s.menu_items.length : 0) + '</div>';
        html += '  </div>';
        html += '  <div style="margin-top: 8px;">';
        html += '    <button onclick="viewStall(' + hawkerId + ', ' + stallId + ')" class="info" style="padding: 4px 12px; font-size: 12px;">View Details</button>';
        html += '    <button onclick="fetchMenu(' + stallId + ')" class="info" style="padding: 4px 12px; font-size: 12px;">View Menu</button>';
        html += '  </div>';
        html += '</div>';
    });

    html += '</div>';
    return html;
}

function formatMenuAsCardsWithFavorites(menu) {
    if (!menu || menu.length === 0) {
        return '<div class="no-orders">No menu items found for this stall.</div>';
    }

    const categories = {};
    menu.forEach(item => {
        const category = item.category || 'General';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(item);
    });

    let html = '';
    const stallName = menu[0]?.stall_name || 'Stall';
    if (menu[0]) {
        currentHawkerId = menu[0].hawker_id || currentHawkerId;
        currentStallId = menu[0].stall_id || currentStallId;
    }
    html += '<h4 style="margin: 10px 0; color: #2c3e50;">Menu from: ' + stallName + '</h4>';

    for (const [category, items] of Object.entries(categories)) {
        html += '<h4 style="margin: 15px 0 10px; color: #2c3e50;">' + category + '</h4>';
        html += '<div class="menu-grid">';
        items.forEach(item => {
            const availabilityClass = item.is_available ? '' : 'unavailable';
            const availabilityText = item.is_available ? 'Available' : 'Unavailable';
            const hawkerId = item.hawker_id || currentHawkerId;
            const isFavorited = favorites.some(f =>
                f.hawker_id === hawkerId &&
                f.stall_id === item.stall_id &&
                f.menu_id === item.menu_id
            );
            const favButtonText = isFavorited ? '❤️' : '🤍';
            const favButtonClass = isFavorited ? 'favorited' : 'unfavorited';

            const itemDiscounted = item.original_price && item.original_price > item.price;
            html += '<div class="menu-item-card">';
            html += '  <div class="menu-item-name">' + (item.item_name || 'Unnamed') + '</div>';
            html += '  <div class="menu-item-price">' + (itemDiscounted
                ? '<span class="price-original">$' + Number(item.original_price).toFixed(2) + '</span>' +
                  '<span class="price-discounted">$' + Number(item.price).toFixed(2) + '</span>' +
                  '<span class="discount-badge">' + item.discount_percent + '% OFF</span>'
                : '$' + (item.price || '0.00')) + '</div>';
            if (item.description) {
                html += '  <div class="menu-item-desc">' + item.description + '</div>';
            }
            html += '  <div class="menu-item-status ' + availabilityClass + '">' + availabilityText + '</div>';
            html += '  <div class="menu-item-actions">';
            if (item.is_available) {
                html += '    <button class="add-to-cart" onclick="addToCart({menu_id: ' + item.menu_id + ', item_name: \'' + item.item_name.replace(/'/g, "\\'") + '\', price: ' + item.price + ', original_price: ' + (item.original_price || 'null') + ', is_available: ' + item.is_available + ', stall_id: ' + item.stall_id + ', hawker_id: ' + hawkerId + ', stall_name: \'' + stallName.replace(/'/g, "\\'") + '\'})">Add to Cart</button>';
            }
            html += '    <button class="favorite-btn ' + favButtonClass + '" onclick="handleFavoriteToggle(' + hawkerId + ', ' + item.stall_id + ', ' + item.menu_id + ', this)">' + favButtonText + '</button>';
            html += '  </div>';
            html += '</div>';
        });
        html += '</div>';
    }
    return html;
}

function getStatusBadgeClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'preparing': 'status-preparing',
        'ready': 'status-ready',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
}

function getReviewActionHtml(order) {
    if (order.order_status !== 'completed') return '';
    if (reviewedOrderIds.has(order.order_id)) {
        return '<button class="btn-view" disabled style="background-color:#95a5a6;cursor:default;">★ Reviewed</button>';
    }
    const stallName = (order.stall_name || 'this stall').replace(/'/g, "\\'");
    return '<button class="btn-view" style="background-color:#f39c12;" onclick="openReviewModal(' + order.order_id + ', \'' + stallName + '\')">★ Rate & Review</button>';
}

function openModal(order) {
    const modal = document.getElementById('orderModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalOrderTitle');

    modalTitle.textContent = 'Order #' + order.order_id + ' Details';

    const statusClass = getStatusBadgeClass(order.order_status);

    let html = '';
    html += '<div class="modal-order-details">';
    html += '  <div class="modal-order-detail"><span class="label">Customer:</span> <span class="value">' + (order.customer_name || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Phone:</span> <span class="value">' + (order.customer_phone || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Stall:</span> <span class="value">' + (order.stall_name || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Hawker Centre:</span> <span class="value">' + (order.hawker_name || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Order Date:</span> <span class="value">' + (order.order_date ? new Date(order.order_date).toLocaleString() : 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Payment Method:</span> <span class="value">' + (order.payment_method || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Payment Status:</span> <span class="value">' + (order.payment_status || 'N/A') + '</span></div>';
    html += '  <div class="modal-order-detail"><span class="label">Status:</span> <span class="modal-status-badge ' + statusClass + '">' + (order.order_status || 'N/A') + '</span></div>';
    html += '</div>';

    if (order.special_instructions) {
        html += '<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;"><strong>Special Instructions:</strong> ' + order.special_instructions + '</div>';
    }

    if (order.items && order.items.length > 0) {
        html += '<div class="modal-order-items">';
        html += '  <h4 style="margin-top: 0; color: #2c3e50;">Order Items</h4>';
        order.items.forEach(item => {
            html += '  <div class="modal-order-item">';
            html += '    <span>' + (item.item_name || 'Unnamed') + ' x' + (item.quantity || 1) + '</span>';
            html += '    <span>$' + (item.subtotal || '0.00') + '</span>';
            html += '  </div>';
            if (item.special_requests) {
                html += '  <div style="font-size: 12px; color: #666; padding-left: 10px; margin-bottom: 5px;">Special: ' + item.special_requests + '</div>';
            }
        });
        html += '  <div class="modal-order-total">Total: $' + (order.total_amount || '0.00') + '</div>';
        html += '</div>';
    }

    html += '<div class="modal-actions">';
    html += '  <button class="btn-update" onclick="reorder(' + order.order_id + ');">Re-order</button>';
    html += '  <button class="btn-update" onclick="updateOrderStatusWithPrompt(' + order.order_id + '); closeModal();">Update Status</button>';
    html += '  ' + getReviewActionHtml(order);
    html += '  <button class="btn-view" onclick="deleteOrder(' + order.order_id + '); closeModal();" style="background-color: #dc3545;">Delete Order</button>';
    html += '  <button onclick="closeModal()" style="background-color: #6c757d;">Close</button>';
    html += '</div>';

    modalBody.innerHTML = html;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('orderModal');
    if (event.target === modal) {
        closeModal();
    }
    const reviewModal = document.getElementById('reviewModal');
    if (event.target === reviewModal) {
        closeReviewModal();
    }
}

function openReviewModal(orderId, stallName) {
    document.getElementById('reviewOrderId').value = orderId;
    document.getElementById('reviewModalTitle').textContent = 'Rate & Review — ' + stallName;
    document.getElementById('reviewComment').value = '';
    selectedReviewRating = 0;
    updateReviewStarDisplay();
    document.getElementById('reviewModal').style.display = 'block';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

function updateReviewStarDisplay() {
    document.querySelectorAll('#reviewStarRating .star').forEach(star => {
        star.classList.toggle('selected', Number(star.dataset.value) <= selectedReviewRating);
    });
}

async function submitReview() {
    const orderId = Number(document.getElementById('reviewOrderId').value);
    const comment = document.getElementById('reviewComment').value.trim();

    if (!selectedReviewRating) {
        showStatus('Please pick a star rating before submitting', 'error');
        return;
    }

    try {
        const response = await fetch(API_URL + '/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: orderId,
                customer_id: currentUserId,
                rating: selectedReviewRating,
                comment: comment || null
            })
        });
        const data = await response.json();

        if (data.success) {
            reviewedOrderIds.add(orderId);
            closeReviewModal();
            showStatus('Thanks for your review!', 'success');
            fetchOrders();
        } else {
            showStatus(data.message || 'Failed to submit review', 'error');
        }
    } catch (error) {
        showStatus('Error submitting review: ' + error.message, 'error');
    }
}

function renderOrdersAsCards(orders) {
    const container = document.getElementById('ordersOutput');

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="no-orders">No orders found.</div>';
        return;
    }

    // Sort orders by date (newest first)
    const sortedOrders = [...orders].sort((a, b) => {
        const dateA = a.order_date ? new Date(a.order_date) : new Date(0);
        const dateB = b.order_date ? new Date(b.order_date) : new Date(0);
        return dateB - dateA;
    });

    let html = '<div class="order-container">';

    sortedOrders.forEach(order => {
        const orderId = order.order_id;
        const statusClass = getStatusBadgeClass(order.order_status);

        html += '<div class="order-card">';
        html += '  <div class="order-header">';
        html += '    <span class="order-id">Order #' + orderId + '</span>';
        html += '    <span class="order-status-badge ' + statusClass + '">' + (order.order_status || 'N/A') + '</span>';
        html += '  </div>';

        html += '  <div class="order-details">';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Customer:</span> <span>' + (order.customer_name || 'N/A') + '</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Phone:</span> <span>' + (order.customer_phone || 'N/A') + '</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Stall:</span> <span>' + (order.stall_name || 'N/A') + '</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Hawker Centre:</span> <span>' + (order.hawker_name || 'N/A') + '</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Order Date:</span> <span>' + (order.order_date ? new Date(order.order_date).toLocaleString() : 'N/A') + '</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Payment:</span> <span>' + (order.payment_method || 'N/A') + ' (' + (order.payment_status || 'N/A') + ')</span></div>';
        html += '    <div class="order-detail-item"><span class="order-detail-label">Total Amount:</span> <span>$' + (order.total_amount || '0.00') + '</span></div>';
        html += '  </div>';

        if (order.items && order.items.length > 0) {
            html += '  <div class="order-items">';
            html += '    <strong>Order Items:</strong>';
            order.items.forEach(item => {
                html += '    <div class="order-item">';
                html += '      <span>' + (item.item_name || 'Unnamed') + ' x' + (item.quantity || 1) + '</span>';
                html += '      <span>$' + (item.subtotal || '0.00') + '</span>';
                html += '    </div>';
                if (item.special_requests) {
                    html += '    <div style="font-size: 12px; color: #666; padding-left: 10px;">Special: ' + item.special_requests + '</div>';
                }
            });
            html += '  </div>';
        }

        if (order.special_instructions) {
            html += '  <div style="font-size: 12px; color: #666; margin: 5px 0;"><strong>Special Instructions:</strong> ' + order.special_instructions + '</div>';
        }

        html += '  <div class="order-actions">';
        html += '    <button class="btn-update" onclick="reorder(' + orderId + ')">Re-order</button>';
        html += '    <button class="btn-update" onclick="updateOrderStatusWithPrompt(' + orderId + ')">Update Status</button>';
        html += '    ' + getReviewActionHtml(order);
        html += '    <button class="btn-view" onclick="viewOrderDetails(' + orderId + ')">View Details</button>';
        html += '  </div>';
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderOrderAsCard(order) {
    const container = document.getElementById('ordersOutput');

    if (!order) {
        container.innerHTML = '<div class="no-orders">Order not found.</div>';
        return;
    }

    const orderId = order.order_id;
    const statusClass = getStatusBadgeClass(order.order_status);

    let html = '<div class="order-container">';
    html += '<div class="order-card">';
    html += '  <div class="order-header">';
    html += '    <span class="order-id">Order #' + orderId + '</span>';
    html += '    <span class="order-status-badge ' + statusClass + '">' + (order.order_status || 'N/A') + '</span>';
    html += '  </div>';

    html += '  <div class="order-details">';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Customer:</span> <span>' + (order.customer_name || 'N/A') + '</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Phone:</span> <span>' + (order.customer_phone || 'N/A') + '</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Stall:</span> <span>' + (order.stall_name || 'N/A') + '</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Hawker Centre:</span> <span>' + (order.hawker_name || 'N/A') + '</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Order Date:</span> <span>' + (order.order_date ? new Date(order.order_date).toLocaleString() : 'N/A') + '</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Payment:</span> <span>' + (order.payment_method || 'N/A') + ' (' + (order.payment_status || 'N/A') + ')</span></div>';
    html += '    <div class="order-detail-item"><span class="order-detail-label">Total Amount:</span> <span>$' + (order.total_amount || '0.00') + '</span></div>';
    html += '  </div>';

    if (order.items && order.items.length > 0) {
        html += '  <div class="order-items">';
        html += '    <strong>Order Items:</strong>';
        order.items.forEach(item => {
            html += '    <div class="order-item">';
            html += '      <span>' + (item.item_name || 'Unnamed') + ' x' + (item.quantity || 1) + '</span>';
            html += '      <span>$' + (item.subtotal || '0.00') + '</span>';
            html += '    </div>';
            if (item.special_requests) {
                html += '    <div style="font-size: 12px; color: #666; padding-left: 10px;">Special: ' + item.special_requests + '</div>';
            }
        });
        html += '  </div>';
    }

    if (order.special_instructions) {
        html += '  <div style="font-size: 12px; color: #666; margin: 5px 0;"><strong>Special Instructions:</strong> ' + order.special_instructions + '</div>';
    }

    html += '  <div class="order-actions">';
    html += '    <button class="btn-update" onclick="reorder(' + orderId + ')">Re-order</button>';
    html += '    <button class="btn-update" onclick="updateOrderStatusWithPrompt(' + orderId + ')">Update Status</button>';
    html += '    ' + getReviewActionHtml(order);
    html += '    <button class="btn-view" onclick="viewOrderDetails(' + orderId + ')">View Details</button>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
}

async function reorder(orderId) {
    try {
        const response = await fetch(API_URL + '/orders/' + orderId);
        const data = await response.json();

        if (!data.success || !data.data) {
            showStatus('Could not load that order', 'error');
            return;
        }

        const order = data.data;
        const items = order.items || [];
        if (items.length === 0) {
            showStatus('That order has no items to re-order', 'info');
            return;
        }

        const stallResponse = await fetch(API_URL + '/stalls/' + order.stall_id);
        const stallData = await stallResponse.json();
        if (!stallData.success || !stallData.data) {
            showStatus('Could not load the stall for that order', 'error');
            return;
        }

        const stall = stallData.data;
        const menuItems = stall.menu_items || [];

        let addedCount = 0;
        const skipped = [];

        items.forEach(item => {
            const menuItem = menuItems.find(m => m.menu_id === item.menu_id);
            if (!menuItem || !menuItem.is_available) {
                skipped.push(item.item_name);
                return;
            }

            addToCart({
                menu_id: menuItem.menu_id,
                item_name: menuItem.item_name,
                price: menuItem.price,
                original_price: menuItem.original_price,
                is_available: menuItem.is_available,
                stall_id: stall.stall_id,
                hawker_id: stall.hawker_id,
                stall_name: stall.stall_name
            }, item.quantity, true);
            addedCount++;
        });

        if (addedCount > 0) {
            showStatus('Added ' + addedCount + ' item(s) from your previous order to the cart', 'success');
        }
        if (skipped.length > 0) {
            showStatus('No longer available: ' + skipped.join(', '), 'error');
        }
    } catch (error) {
        showStatus('Error re-ordering: ' + error.message, 'error');
    }
}

async function viewOrderDetails(orderId) {
    try {
        const response = await fetch(API_URL + '/orders/' + orderId);
        const data = await response.json();

        if (data.success && data.data) {
            openModal(data.data);
        } else {
            showStatus('Order not found', 'error');
        }
    } catch (error) {
        showStatus('Error fetching order details: ' + error.message, 'error');
    }
}

function renderOutput(elementId, responseData) {
    if (elementId === 'favoritesOutput') {
        renderFavorites(favoriteFilter);
        return;
    }

    if (elementId === 'ordersOutput') {
        if (!responseData) {
            renderOrdersAsCards([]);
            return;
        }

        if (responseData.success !== undefined && !responseData.success) {
            document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + (responseData.message || 'Unknown error') + '</div>';
            return;
        }

        let data = responseData.data;
        if (data === undefined) {
            data = responseData;
        }

        if (Array.isArray(data)) {
            renderOrdersAsCards(data);
        } else if (data && data.order_id !== undefined) {
            renderOrderAsCard(data);
        } else {
            console.warn('Unexpected orders response:', responseData);
            renderOrdersAsCards([]);
        }
        return;
    }

    if (elementId === 'menuOutput') {
        if (!responseData) {
            document.getElementById('menuOutput').innerHTML = '<div class="no-orders">No data available</div>';
            return;
        }

        if (responseData.success !== undefined && !responseData.success) {
            document.getElementById('menuOutput').innerHTML = '<div class="no-orders">Error: ' + (responseData.message || 'Unknown error') + '</div>';
            return;
        }

        let data = responseData.data;
        if (data === undefined) {
            data = responseData;
        }

        document.getElementById('menuOutput').innerHTML = formatMenuAsCardsWithFavorites(data);
        return;
    }

    if (elementId === 'hawkersOutput') {
        if (!responseData) {
            document.getElementById('hawkersOutput').innerHTML = 'No data available';
            return;
        }

        if (responseData.success !== undefined && !responseData.success) {
            document.getElementById('hawkersOutput').innerHTML = 'Error: ' + (responseData.message || 'Unknown error');
            return;
        }

        let data = responseData.data;
        if (data === undefined) {
            data = responseData;
        }

        document.getElementById('hawkersOutput').innerHTML = formatHawkerDataWithFavorites(data);
        return;
    }

    if (elementId === 'stallsOutput') {
        if (!responseData) {
            document.getElementById('stallsOutput').innerHTML = 'No data available';
            return;
        }

        if (responseData.success !== undefined && !responseData.success) {
            document.getElementById('stallsOutput').innerHTML = 'Error: ' + (responseData.message || 'Unknown error');
            return;
        }

        let data = responseData.data;
        if (data === undefined) {
            data = responseData;
        }

        document.getElementById('stallsOutput').innerHTML = formatStallDataWithFavorites(data);
        return;
    }

    // For other outputs, use text format
    const el = document.getElementById(elementId);

    if (!responseData) {
        el.textContent = 'No data available';
        return;
    }

    let formattedText = '';

    if (responseData.success !== undefined && !responseData.success) {
        formattedText = 'Error: ' + (responseData.message || 'Unknown error');
        el.textContent = formattedText;
        return;
    }

    let data = responseData.data;
    if (data === undefined) {
        data = responseData;
    }

    if (data && data.success !== undefined && !data.success) {
        formattedText = 'Error: ' + (data.message || 'Unknown error');
        el.textContent = formattedText;
        return;
    }

    formattedText = JSON.stringify(data, null, 2);
    el.textContent = formattedText;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
}

function renderBreadcrumb(parts) {
    const el = document.getElementById('browseBreadcrumb');
    el.innerHTML = parts.map((p, i) =>
        i === parts.length - 1 ? escapeHtml(p.label) : '<a data-crumb="' + i + '">' + escapeHtml(p.label) + '</a>'
    ).join(' &rsaquo; ');

    parts.forEach((p, i) => {
        if (i === parts.length - 1) return;
        const link = el.querySelector('[data-crumb="' + i + '"]');
        if (link) link.addEventListener('click', p.onClick);
    });
}

// Level 1: all hawker centres
async function fetchHawkers() {
    const content = document.getElementById('browseContent');
    try {
        await fetchUserFavorites();
        const response = await fetch(API_URL + '/hawkers');
        const data = await response.json();

        if (!data.success) throw new Error(data.message || 'Failed to load hawker centres.');

        currentBrowseView = 'hawkers';
        renderBreadcrumb([{ label: 'Hawker Centres' }]);

        const hawkers = data.data || [];
        if (hawkers.length === 0) {
            content.innerHTML = '<div class="no-orders">No hawker centres found.</div>';
            return;
        }

        content.innerHTML = '<div class="hawker-grid">' + hawkers.map(h => {
            const isFavorited = favorites.some(f => f.hawker_id === h.hawker_id && f.stall_id === null && f.menu_id === null);
            return (
            '<div class="hawker-card" data-hawker-id="' + h.hawker_id + '" data-search-text="' + escapeHtml((h.name + ' ' + h.address).toLowerCase()) + '">' +
            '  <div class="card-header-row">' +
            '    <div class="hawker-card-name">' + escapeHtml(h.name) + '</div>' +
            '    <button class="favorite-btn ' + (isFavorited ? 'favorited' : 'unfavorited') + '" data-fav-hawker="' + h.hawker_id + '" title="' + (isFavorited ? 'Unfavorite' : 'Favorite') + ' this hawker centre">' + (isFavorited ? '❤️' : '🤍') + '</button>' +
            '  </div>' +
            '  <div class="hawker-card-sub">' + escapeHtml(h.address) + '</div>' +
            '  <div class="hawker-card-sub">' + (h.stalls ? h.stalls.length : 0) + ' stall' + ((h.stalls && h.stalls.length === 1) ? '' : 's') + '</div>' +
            '</div>'
            );
        }).join('') + '</div>';

        content.querySelectorAll('.hawker-card').forEach(card => {
            card.addEventListener('click', () => fetchStallsByHawker(Number(card.dataset.hawkerId)));
        });
        content.querySelectorAll('[data-fav-hawker]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFavoriteToggle(Number(btn.dataset.favHawker), null, null, btn);
            });
        });

        showStatus('Loaded ' + hawkers.length + ' hawker centres');
    } catch (error) {
        showStatus('Error fetching hawker centres: ' + error.message, 'error');
        content.innerHTML = '<div class="no-orders">Error: ' + escapeHtml(error.message) + '</div>';
    }
}

async function fetchStalls() {
    try {
        await fetchUserFavorites();
        const response = await fetch(API_URL + '/stalls');
        const data = await response.json();
        if (data.success && data.data) {
            showStatus('Loaded ' + data.data.length + ' stalls');
        }
    } catch (error) {
        showStatus('Error fetching stalls: ' + error.message, 'error');
    }
}

// Level 2: stalls inside one hawker centre
async function fetchStallsByHawker(hawkerId) {
    const content = document.getElementById('browseContent');
    try {
        await fetchUserFavorites();
        const [hawkerRes, stallsRes] = await Promise.all([
            fetch(API_URL + '/hawkers/' + hawkerId),
            fetch(API_URL + '/stalls?hawker_id=' + hawkerId)
        ]);
        const hawkerData = await hawkerRes.json();
        const stallsData = await stallsRes.json();

        if (!stallsData.success) throw new Error(stallsData.message || 'Failed to load stalls.');

        const hawkerName = hawkerData.success && hawkerData.data ? hawkerData.data.name : ('Hawker Centre #' + hawkerId);

        currentBrowseView = 'stalls';
        currentHawkerId = hawkerId;
        renderBreadcrumb([
            { label: 'Hawker Centres', onClick: fetchHawkers },
            { label: hawkerName }
        ]);

        const stalls = stallsData.data || [];
        if (stalls.length === 0) {
            content.innerHTML = '<div class="no-orders">No stalls yet at this hawker centre.</div>';
            return;
        }

        content.innerHTML = '<div class="stall-grid">' + stalls.map(s => {
            const isFavorited = favorites.some(f => f.hawker_id === hawkerId && f.stall_id === s.stall_id && f.menu_id === null);
            return (
            '<div class="stall-card" data-stall-id="' + s.stall_id + '" data-search-text="' + escapeHtml((s.stall_name + ' ' + (s.cuisine_type || '')).toLowerCase()) + '">' +
            (s.image_url
              ? '<img src="' + escapeHtml(s.image_url) + '" alt="" onerror="this.style.display=\'none\'">'
              : '<div class="stall-card-photo-placeholder" aria-hidden="true"></div>') +
            '  <div class="card-header-row">' +
            '    <div class="stall-card-name">' + escapeHtml(s.stall_name) + '</div>' +
            '    <button class="favorite-btn ' + (isFavorited ? 'favorited' : 'unfavorited') + '" data-fav-stall="' + s.stall_id + '" title="' + (isFavorited ? 'Unfavorite' : 'Favorite') + ' this stall">' + (isFavorited ? '❤️' : '🤍') + '</button>' +
            '  </div>' +
            (s.nea_grade ? '<span class="nea-grade-badge" title="NEA hygiene inspection grade">Grade ' + escapeHtml(s.nea_grade) + '</span>' : '') +
            (s.cuisine_type ? '<div class="stall-card-tags"><span class="cuisine-tag">' + escapeHtml(s.cuisine_type) + '</span></div>' : '') +
            '</div>'
            );
        }).join('') + '</div>';

        content.querySelectorAll('.stall-card').forEach(card => {
            card.addEventListener('click', () => fetchMenu(Number(card.dataset.stallId)));
        });
        content.querySelectorAll('[data-fav-stall]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFavoriteToggle(hawkerId, Number(btn.dataset.favStall), null, btn);
            });
        });

        showStatus('Loaded ' + stalls.length + ' stalls for ' + hawkerName);
    } catch (error) {
        showStatus('Error fetching stalls: ' + error.message, 'error');
        content.innerHTML = '<div class="no-orders">Error: ' + escapeHtml(error.message) + '</div>';
    }
}

// Level 3: menu items for one stall, with Add to Cart
async function fetchMenu(stallId) {
    const content = document.getElementById('browseContent');
    try {
        await fetchUserFavorites();

        const stallRes = await fetch(API_URL + '/stalls/' + stallId);
        const stallData = await stallRes.json();
        if (!stallData.success) throw new Error(stallData.message || 'Failed to load this stall.');

        const stall = stallData.data;

        currentBrowseView = 'menu';
        currentHawkerId = stall.hawker_id;
        currentStallId = stallId;
        renderBreadcrumb([
            { label: 'Hawker Centres', onClick: fetchHawkers },
            { label: stall.hawker_name || 'Hawker Centre', onClick: () => fetchStallsByHawker(stall.hawker_id) },
            { label: stall.stall_name }
        ]);

        const menuItems = stall.menu_items || [];

        const heroHtml =
            '<div class="stall-hero">' +
            (stall.image_url
              ? '<img class="stall-hero-photo" src="' + escapeHtml(stall.image_url) + '" alt="" onerror="this.style.display=\'none\'">'
              : '<div class="stall-hero-photo stall-hero-photo-placeholder" aria-hidden="true"></div>') +
            '  <div class="stall-hero-info">' +
            '    <div class="stall-hero-name">' + escapeHtml(stall.stall_name) + '</div>' +
            (stall.hawker_name ? '<div class="stall-hero-sub">@ ' + escapeHtml(stall.hawker_name) + '</div>' : '') +
            (stall.nea_grade ? '<span class="nea-grade-badge" title="NEA hygiene inspection grade">Grade ' + escapeHtml(stall.nea_grade) + '</span>' : '') +
            (stall.cuisine_type ? '<span class="cuisine-tag">' + escapeHtml(stall.cuisine_type) + '</span>' : '') +
            (stall.description ? '<div class="stall-hero-desc">' + escapeHtml(stall.description) + '</div>' : '') +
            '  </div>' +
            '</div>';

        if (menuItems.length === 0) {
            content.innerHTML = heroHtml + '<div class="no-orders">No menu items yet for this stall.</div>';
            return;
        }

        content.innerHTML = heroHtml + '<div class="menu-grid">' + menuItems.map(m => {
            const isDiscounted = m.original_price && m.original_price > m.price;
            const priceHtml = isDiscounted
                ? '<span class="price-original">$' + Number(m.original_price).toFixed(2) + '</span>' +
                  '<span class="price-discounted">$' + Number(m.price).toFixed(2) + '</span>' +
                  '<span class="discount-badge">' + m.discount_percent + '% OFF</span>'
                : '$' + Number(m.price).toFixed(2);
            const isFavorited = favorites.some(f => f.hawker_id === stall.hawker_id && f.stall_id === stall.stall_id && f.menu_id === m.menu_id);
            return (
            '<div class="menu-item-card">' +
            '  <div class="card-header-row">' +
            '    <div class="menu-item-name">' + escapeHtml(m.item_name) + '</div>' +
            '    <button class="favorite-btn ' + (isFavorited ? 'favorited' : 'unfavorited') + '" data-fav-menu="' + m.menu_id + '" title="' + (isFavorited ? 'Unfavorite' : 'Favorite') + ' this item">' + (isFavorited ? '❤️' : '🤍') + '</button>' +
            '  </div>' +
            '  <div class="menu-item-price">' + priceHtml + '</div>' +
            (m.category ? '<div class="menu-item-desc">' + escapeHtml(m.category) + '</div>' : '') +
            '  <div class="menu-item-status ' + (m.is_available ? '' : 'unavailable') + '">' + (m.is_available ? 'Available' : 'Unavailable') + '</div>' +
            '  <div class="menu-item-actions">' +
            '    <button data-menu-id="' + m.menu_id + '" ' + (m.is_available ? '' : 'disabled') + '>Add to Cart</button>' +
            '  </div>' +
            '</div>'
            );
        }).join('') + '</div>';

        content.querySelectorAll('.menu-item-actions button').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = menuItems.find(m => String(m.menu_id) === btn.dataset.menuId);
                if (!item) return;
                addToCart({
                    ...item,
                    stall_id: stall.stall_id,
                    hawker_id: stall.hawker_id,
                    stall_name: stall.stall_name
                });
            });
        });
        content.querySelectorAll('[data-fav-menu]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFavoriteToggle(stall.hawker_id, stall.stall_id, Number(btn.dataset.favMenu), btn);
            });
        });

        showStatus('Loaded ' + menuItems.length + ' menu items for ' + stall.stall_name);
    } catch (error) {
        showStatus('Error fetching menu: ' + error.message, 'error');
        content.innerHTML = '<div class="no-orders">Error: ' + escapeHtml(error.message) + '</div>';
    }
}

async function fetchReviewedOrders() {
    try {
        const response = await fetch(API_URL + '/reviews/customer/' + currentUserId);
        const data = await response.json();
        if (data.success) {
            reviewedOrderIds = new Set(data.data.map(r => r.order_id));
        }
    } catch (error) {
        console.error('Error fetching reviewed orders:', error);
    }
}

async function fetchOrders() {
    try {
        const response = await fetch(API_URL + '/orders/user/' + currentUserId);
        const data = await response.json();
        renderOutput('ordersOutput', data);
        if (data.success && data.data && data.data.length > 0) {
            showStatus('Loaded ' + data.data.length + ' of your orders (sorted by date, newest first)');
        }
    } catch (error) {
        showStatus('Error fetching orders: ' + error.message, 'error');
        document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + error.message + '</div>';
    }
}

async function fetchOrderById(orderId) {
    try {
        const response = await fetch(API_URL + '/orders/' + orderId);
        const data = await response.json();
        renderOutput('ordersOutput', data);
        if (data.success) {
            showStatus('Order ' + orderId + ' loaded successfully');
        } else {
            showStatus('Order not found', 'error');
        }
    } catch (error) {
        showStatus('Error fetching order: ' + error.message, 'error');
        document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + error.message + '</div>';
    }
}

async function createSampleOrder() {
    const orderData = {
        stall_id: 1,
        hawker_id: 1,
        customer_id: currentUserId,
        customer_name: 'Test Customer',
        customer_phone: '91234567',
        payment_method: 'cash',
        special_instructions: 'Extra chili sauce',
        items: [
            { menu_id: 1, quantity: 2 },
            { menu_id: 2, quantity: 1 }
        ]
    };

    try {
        const response = await fetch(API_URL + '/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        const data = await response.json();
        renderOutput('ordersOutput', data);
        if (data.success) {
            showStatus('Order created successfully!');
            setTimeout(fetchOrders, 1000);
        } else {
            showStatus('Error creating order: ' + data.message, 'error');
        }
    } catch (error) {
        showStatus('Error creating order: ' + error.message, 'error');
        document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + error.message + '</div>';
    }
}

async function updateOrderStatusWithPrompt(orderId) {
    const statusOptions = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    const statusList = statusOptions.map((s, i) => (i + 1) + '. ' + s).join('\n');
    const choice = prompt(
        'Select new status for Order #' + orderId + ':\n\n' +
        statusList + '\n\n' +
        'Enter the number (1-5):'
    );

    if (choice === null) {
        return;
    }

    const index = parseInt(choice) - 1;
    if (isNaN(index) || index < 0 || index >= statusOptions.length) {
        showStatus('Invalid selection. Please enter a number between 1 and 5.', 'error');
        return;
    }

    const newStatus = statusOptions[index];
    await updateOrderStatus(orderId, newStatus);
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(API_URL + '/orders/' + orderId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_status: status })
        });
        const data = await response.json();
        renderOutput('ordersOutput', data);
        if (data.success) {
            showStatus('Order ' + orderId + ' status updated to ' + status);
            setTimeout(fetchOrders, 500);
        } else {
            showStatus('Error updating order: ' + data.message, 'error');
        }
    } catch (error) {
        showStatus('Error updating order: ' + error.message, 'error');
        document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + error.message + '</div>';
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete Order #' + orderId + '?\n(Only cancelled orders can be deleted)')) {
        return;
    }
    try {
        const response = await fetch(API_URL + '/orders/' + orderId, {
            method: 'DELETE'
        });
        const data = await response.json();
        renderOutput('ordersOutput', data);
        if (data.success) {
            showStatus('Order ' + orderId + ' deleted successfully');
            setTimeout(fetchOrders, 500);
        } else {
            showStatus('Error deleting order: ' + data.message, 'error');
        }
    } catch (error) {
        showStatus('Error deleting order: ' + error.message, 'error');
        document.getElementById('ordersOutput').innerHTML = '<div class="no-orders">Error: ' + error.message + '</div>';
    }
}

// ==================== FAVORITE FUNCTIONS ====================

async function toggleFavorite(hawkerId, stallId, menuId = null) {
    try {
        const response = await fetch(API_URL + '/favorites/user/' + currentUserId + '/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hawker_id: hawkerId,
                stall_id: stallId,
                menu_id: menuId
            })
        });
        const data = await response.json();

        if (data.success) {
            showStatus(data.message, 'success');
            // Refresh favorites list
            await fetchUserFavorites();
            return data.data;
        } else {
            showStatus('Error toggling favorite: ' + data.message, 'error');
            return null;
        }
    } catch (error) {
        showStatus('Error toggling favorite: ' + error.message, 'error');
        return null;
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(API_URL + '/customers/' + currentUserId);
        const data = await response.json();
        currentUserProfile = data.success ? data.data : null;
    } catch (error) {
        currentUserProfile = null;
    }
    return currentUserProfile;
}

async function fetchUserFavorites() {
    try {
        const response = await fetch(API_URL + '/favorites/user/' + currentUserId);
        const data = await response.json();

        if (data.success) {
            favorites = data.data || [];
            return favorites;
        } else {
            showStatus('Error fetching favorites: ' + data.message, 'error');
            favorites = [];
            return [];
        }
    } catch (error) {
        showStatus('Error fetching favorites: ' + error.message, 'error');
        favorites = [];
        return [];
    }
}

async function checkFavorited(hawkerId, stallId = null, menuId = null) {
    try {
        let url = API_URL + '/favorites/user/' + currentUserId + '/check?hawker_id=' + hawkerId;
        if (stallId) {
            url += '&stall_id=' + stallId;
        }
        if (menuId) {
            url += '&menu_id=' + menuId;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            return data.data.is_favorited;
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function getFavoriteCounts(hawkerId, stallId = null, menuId = null) {
    try {
        let url = API_URL + '/favorites/counts/' + hawkerId;
        if (stallId) {
            url += '?stall_id=' + stallId;
            if (menuId) {
                url += '&menu_id=' + menuId;
            }
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            return data.data.favorite_count;
        }
        return 0;
    } catch (error) {
        return 0;
    }
}

// Render favorites as cards, optionally filtered by 'hawker' | 'stall' | 'menu' | 'all'
function renderFavorites(filter) {
    filter = filter || 'all';
    const container = document.getElementById('favoritesOutput');

    let filteredFavorites = favorites;
    if (filter === 'menu') {
        filteredFavorites = favorites.filter(f => f.menu_id !== null);
    } else if (filter === 'stall') {
        filteredFavorites = favorites.filter(f => f.menu_id === null && f.stall_id !== null);
    } else if (filter === 'hawker') {
        filteredFavorites = favorites.filter(f => f.stall_id === null && f.menu_id === null);
    }

    if (!filteredFavorites || filteredFavorites.length === 0) {
        let message = 'No favorites found.';
        if (filter === 'menu') message = 'No favorite menu items found.';
        else if (filter === 'stall') message = 'No favorite stalls found.';
        else if (filter === 'hawker') message = 'No favorite hawker centres found.';
        container.innerHTML = '<div class="no-orders">' + message + '</div>';
        return;
    }

    let html = '<div class="favorites-container">';
    html += '<div style="margin-bottom: 10px; font-size: 14px; color: #666;">Showing ' + filteredFavorites.length + ' favorite(s)</div>';

    filteredFavorites.forEach(fav => {
        let typeLabel = 'Hawker Centre';
        if (fav.menu_id !== null) {
            typeLabel = 'Menu Item';
        } else if (fav.stall_id !== null) {
            typeLabel = 'Stall';
        }

        html += '<div class="favorite-card">';
        html += '  <div class="favorite-header">';
        html += '    <span class="favorite-type">' + typeLabel + '</span>';
        html += '    <button class="btn-remove-favorite" onclick="removeFavorite(' + fav.favorite_id + ', ' + fav.hawker_id + ', ' + (fav.stall_id !== null ? fav.stall_id : 'null') + ', ' + (fav.menu_id !== null ? fav.menu_id : 'null') + ')">Remove</button>';
        html += '  </div>';
        html += '  <div class="favorite-details">';
        html += '    <div><strong>Hawker:</strong> ' + (fav.hawker_name || 'N/A') + '</div>';
        if (fav.stall_id !== null) {
            html += '    <div><strong>Stall:</strong> ' + (fav.stall_name || 'N/A') + '</div>';
        }
        if (fav.menu_id !== null) {
            html += '    <div><strong>Menu Item:</strong> ' + (fav.menu_item_name || 'N/A') + '</div>';
            html += '    <div><strong>Price:</strong> $' + (fav.menu_item_price || '0.00') + '</div>';
            html += '    <div><strong>Available:</strong> ' + (fav.menu_item_available ? 'Yes' : 'No') + '</div>';
        }
        html += '    <div><strong>Added:</strong> ' + (fav.created_at ? new Date(fav.created_at).toLocaleString() : 'N/A') + '</div>';
        html += '  </div>';
        html += '  <div class="favorite-actions">';
        if (fav.menu_id !== null) {
            html += '    <button class="btn-view" onclick="fetchMenu(' + fav.stall_id + ')">View Menu</button>';
        }
        if (fav.stall_id !== null) {
            html += '    <button class="btn-update" onclick="viewStall(' + fav.hawker_id + ', ' + fav.stall_id + ')">View Stall</button>';
        }
        html += '    <button class="btn-update" onclick="viewHawker(' + fav.hawker_id + ')">View Hawker Centre</button>';
        html += '  </div>';
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

async function removeFavorite(favoriteId, hawkerId, stallId, menuId) {
    if (!confirm('Remove this item from favorites?')) {
        return;
    }

    try {
        // Use the toggle endpoint to remove
        const response = await fetch(API_URL + '/favorites/user/' + currentUserId + '/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hawker_id: hawkerId,
                stall_id: stallId,
                menu_id: menuId
            })
        });
        const data = await response.json();

        if (data.success) {
            showStatus('Removed from favorites', 'success');
            await fetchUserFavorites();
            renderFavorites(favoriteFilter);
            refreshDisplayedContent();
        } else {
            showStatus('Error removing favorite: ' + data.message, 'error');
        }
    } catch (error) {
        showStatus('Error removing favorite: ' + error.message, 'error');
    }
}

async function handleFavoriteToggle(hawkerId, stallId, menuId, buttonElement) {
    const result = await toggleFavorite(hawkerId, stallId, menuId);
    if (result) {
        if (result.favorited) {
            buttonElement.textContent = '❤️';
            buttonElement.className = 'favorite-btn favorited';
        } else {
            buttonElement.textContent = '🤍';
            buttonElement.className = 'favorite-btn unfavorited';
        }
        refreshDisplayedContent();
    }
}

function toggleHawkerFavorite(hawkerId, buttonElement) {
    handleFavoriteToggle(hawkerId, null, null, buttonElement);
}

function toggleStallFavorite(hawkerId, stallId, buttonElement) {
    handleFavoriteToggle(hawkerId, stallId, null, buttonElement);
}

function refreshDisplayedContent() {
    if (currentBrowseView === 'stalls') {
        fetchStallsByHawker(currentHawkerId);
    } else if (currentBrowseView === 'menu') {
        fetchMenu(currentStallId);
    } else if (currentBrowseView === 'hawkers') {
        fetchHawkers();
    }

    renderFavorites(favoriteFilter);
}

async function viewStall(hawkerId, stallId) {
    try {
        const response = await fetch(API_URL + '/stalls/' + stallId + '?hawker_id=' + hawkerId);
        const data = await response.json();

        if (data.success && data.data) {
            const stall = data.data;
            let output = '========================================\n';
            output += 'Stall Details\n';
            output += '----------------------------------------\n';
            output += 'Name: ' + (stall.stall_name || 'N/A') + '\n';
            output += 'Stall Number: ' + (stall.stall_number || 'N/A') + '\n';
            output += 'Hawker Centre: ' + (stall.hawker_name || 'N/A') + '\n';
            output += 'Cuisine Type: ' + (stall.cuisine_type || 'N/A') + '\n';
            output += 'Description: ' + (stall.description || 'No description') + '\n';
            output += 'Contact: ' + (stall.contact_number || 'N/A') + '\n';

            if (stall.menu_items && stall.menu_items.length > 0) {
                output += '\nMenu Items:\n';
                stall.menu_items.forEach(menu => {
                    output += '  - ' + (menu.item_name || 'Unnamed') +
                             ' ($' + (menu.price || '0.00') + ')' +
                             (menu.is_available ? ' [Available]' : ' [Unavailable]') + '\n';
                    if (menu.description) {
                        output += '    ' + menu.description + '\n';
                    }
                });
            }

            document.getElementById('stallsOutput').textContent = output;
            showStatus('Displaying stall: ' + stall.stall_name, 'success');
        }
    } catch (error) {
        showStatus('Error viewing stall: ' + error.message, 'error');
    }
}

async function viewHawker(hawkerId) {
    try {
        const response = await fetch(API_URL + '/hawkers/' + hawkerId);
        const data = await response.json();

        if (data.success && data.data) {
            const hawker = data.data;
            let output = '========================================\n';
            output += 'Hawker Centre Details\n';
            output += '----------------------------------------\n';
            output += 'Name: ' + (hawker.name || 'N/A') + '\n';
            output += 'Address: ' + (hawker.address || 'N/A') + '\n';
            output += 'Postal Code: ' + (hawker.postal_code || 'N/A') + '\n';
            output += 'Operating Hours: ' + (hawker.operating_hours || 'N/A') + '\n';

            if (hawker.stalls && hawker.stalls.length > 0) {
                output += '\nStalls:\n';
                hawker.stalls.forEach(stall => {
                    output += '  - ' + (stall.stall_name || 'Unnamed') +
                             ' (' + (stall.cuisine_type || 'N/A') + ')' +
                             (stall.is_active ? ' [Active]' : ' [Inactive]') + '\n';
                });
            }

            document.getElementById('hawkersOutput').textContent = output;
            showStatus('Displaying hawker centre: ' + hawker.name, 'success');
        }
    } catch (error) {
        showStatus('Error viewing hawker centre: ' + error.message, 'error');
    }
}

// Load data when page loads
window.onload = function() {
    // Loaded up front so checkout already knows the customer's name and phone
    fetchUserProfile();

    document.querySelectorAll('#reviewStarRating .star').forEach(star => {
        star.addEventListener('click', () => {
            selectedReviewRating = Number(star.dataset.value);
            updateReviewStarDisplay();
        });
    });

    fetchUserFavorites().then(() => {
        fetchHawkers();
        fetchReviewedOrders().then(fetchOrders);
        renderCart();
        renderFavorites('all');
        showStatus('Welcome! ' + favorites.length + ' favorites loaded', 'success');
    }).catch(error => {
        console.error('Error loading favorites:', error);
        fetchHawkers();
        fetchReviewedOrders().then(fetchOrders);
        renderCart();
    });
};
