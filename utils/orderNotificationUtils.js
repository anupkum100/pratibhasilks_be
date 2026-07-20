function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}

function getCustomer(order) {
    return order.customer || order.buyer || {};
}

function getItemName(item) {
    return item.name || item.productName || item.title || "Saree";
}

function getItemPrice(item) {
    return Number(
        item.sellingPrice ??
        item.soldPrice ??
        item.offerPrice ??
        item.price ??
        item.listedPrice ??
        0
    );
}

function getOrderTotal(order) {
    return Number(
        order.totalAmount ??
        order.totalSoldPrice ??
        order.grandTotal ??
        order.subtotal ??
        0
    );
}

function formatAddress(address = {}) {
    return [
        address.fullName,
        address.addressLine1,
        address.addressLine2,
        address.landmark,
        address.city,
        address.state,
        address.pincode,
    ]
        .filter(Boolean)
        .join(", ");
}

function getPublicOrderUrl(order) {
    const baseUrl = String("https://www.pratibhasilks.com"
    ).replace(/\/$/, "");

    if (!order.orderNumber || !order.publicAccessToken) {
        return null;
    }

    return `${baseUrl}/order-success/${encodeURIComponent(
        order.orderNumber
    )}?token=${encodeURIComponent(order.publicAccessToken)}`;
}

function buildItemsText(order) {
    return (order.items || [])
        .map((item, index) => {
            const quantity = Number(item.quantity || 1);
            const name = getItemName(item);
            const sku = item.sku ? ` | SKU: ${item.sku}` : "";
            const amount = formatMoney(getItemPrice(item) * quantity);

            return `${index + 1}. ${name}${sku} | Qty: ${quantity} | ${amount}`;
        })
        .join("\n");
}

function buildItemsHtml(order) {
    return (order.items || [])
        .map((item) => {
            const quantity = Number(item.quantity || 1);
            const itemPrice = getItemPrice(item);

            return `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #ece7e1;">
              <strong>${escapeHtml(getItemName(item))}</strong>
              ${item.sku
                    ? `<div style="font-size:12px;color:#746b63;">SKU: ${escapeHtml(
                        item.sku
                    )}</div>`
                    : ""
                }
            </td>
  
            <td style="padding:12px;border-bottom:1px solid #ece7e1;text-align:center;">
              ${quantity}
            </td>
  
            <td style="padding:12px;border-bottom:1px solid #ece7e1;text-align:right;">
              ${escapeHtml(formatMoney(itemPrice * quantity))}
            </td>
          </tr>
        `;
        })
        .join("");
}

module.exports = {
    escapeHtml,
    formatMoney,
    getCustomer,
    getOrderTotal,
    formatAddress,
    getPublicOrderUrl,
    buildItemsText,
    buildItemsHtml,
};