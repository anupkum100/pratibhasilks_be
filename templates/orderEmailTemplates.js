const {
  escapeHtml,
  formatMoney,
  getCustomer,
  getOrderTotal,
  formatAddress,
  getPublicOrderUrl,
  buildItemsText,
} = require("../utils/orderNotificationUtils");

/*
 * ==========================================================================
 * Brand configuration
 * ==========================================================================
 */

const BRAND = {
  black: "#171411",
  blackSoft: "#181512",

  gold: "#D8B46A",
  goldLight: "#E3C37F",
  goldMuted: "#9A7B4F",
  goldDark: "#6B4F22",

  background: "#F8F3EC",
  cream: "#FCF9F5",
  creamDark: "#F4EEE7",
  white: "#FFFFFF",

  text: "#302A25",
  muted: "#71665C",
  mutedLight: "#948476",

  border: "#EDE4DA",
  borderStrong: "#D8C7B3",

  success: "#167A62",
  successBackground: "#ECFDF5",
  successBorder: "#A7F3D0",

  warningBackground: "#FFF9EA",
  warningBorder: "#F1DFC0",
};

/*
 * ==========================================================================
 * General helpers
 * ==========================================================================
 */

function getWebsiteBaseUrl() {
  return String(
    "https://www.pratibhasilks.com"
  ).replace(/\/$/, "");
}

function getWebsiteLinks() {
  const baseUrl = getWebsiteBaseUrl();

  return {
    home: baseUrl,

    collections:
      `${baseUrl}/products`,

    contact:
      `${baseUrl}/contact`,

    instagram:
      "https://www.instagram.com/pratibhasilkssarees/",

    whatsapp:
      "https://wa.me/919730880398",
  };
}

function getPaymentId(order) {
  return (
    order?.razorpayPaymentId ||
    order?.paymentId ||
    "Not available"
  );
}

function getPaymentStatus(order) {
  return order?.paymentStatus || "PAID";
}

function getOrderStatus(order) {
  return order?.orderStatus || "CONFIRMED";
}

function getOrderDate(order) {
  const dateValue =
    order?.paidAt ||
    order?.createdAt ||
    order?.updatedAt;

  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatStatus(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function getItemPrice(item) {
  return Number(
    item?.sellingPrice ??
    item?.soldPrice ??
    item?.offerPrice ??
    item?.price ??
    item?.listedPrice ??
    0
  );
}

function getOrderSubtotal(order) {
  return Number(
    order?.subtotal ??
    order?.totalSoldPrice ??
    order?.totalListedPrice ??
    getOrderTotal(order)
  );
}

function getShippingAmount(order) {
  return Number(
    order?.shippingAmount ??
    order?.shippingCharge ??
    0
  );
}

function getDiscountAmount(order) {
  return Number(
    order?.discountAmount ??
    order?.discount ??
    0
  );
}

function getCustomerPhone(order) {
  const customer = getCustomer(order);

  return (
    customer?.phone ||
    order?.shippingAddress?.phone ||
    ""
  );
}

function getCustomerWhatsAppUrl(order) {
  const phone = String(getCustomerPhone(order))
    .replace(/\D/g, "")
    .replace(/^91/, "");

  if (!phone) {
    return "";
  }

  const message = encodeURIComponent(
    `Hello, this is Pratibha Silks regarding your order ${order.orderNumber}.`
  );

  return `https://wa.me/91${phone}?text=${message}`;
}

/*
 * ==========================================================================
 * Reusable visual components
 * ==========================================================================
 */

function navigationLink({
  href,
  label,
}) {
  return `
      <a
        href="${escapeHtml(href)}"
        style="
          color:${BRAND.goldMuted};
          text-decoration:none;
          font-size:11px;
          font-weight:700;
          letter-spacing:1.2px;
        "
      >
        ${escapeHtml(label)}
      </a>
    `;
}

function footerLink({
  href,
  label,
}) {
  return `
      <a
        href="${escapeHtml(href)}"
        style="
          color:${BRAND.goldLight};
          text-decoration:none;
          font-size:12px;
          font-weight:700;
          margin:0 8px;
        "
      >
        ${escapeHtml(label)}
      </a>
    `;
}

function sectionHeading({
  eyebrow,
  title,
  subtitle = "",
}) {
  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="margin-top:30px;"
      >
        <tr>
          <td
            style="
              padding-bottom:12px;
              border-bottom:1px solid ${BRAND.border};
            "
          >
            ${eyebrow
      ? `
                  <p
                    style="
                      margin:0 0 5px;
                      color:${BRAND.goldMuted};
                      font-size:10px;
                      font-weight:700;
                      letter-spacing:1.8px;
                      text-transform:uppercase;
                    "
                  >
                    ${escapeHtml(eyebrow)}
                  </p>
                `
      : ""
    }
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-family:Georgia,'Times New Roman',serif;
                font-size:21px;
                line-height:1.35;
                font-weight:400;
              "
            >
              ${escapeHtml(title)}
            </p>
  
            ${subtitle
      ? `
                  <p
                    style="
                      margin:6px 0 0;
                      color:${BRAND.muted};
                      font-size:12px;
                      line-height:1.6;
                    "
                  >
                    ${escapeHtml(subtitle)}
                  </p>
                `
      : ""
    }
          </td>
        </tr>
      </table>
    `;
}

function primaryButton({
  href,
  label,
}) {
  if (!href) {
    return "";
  }

  return `
      <table
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
        align="center"
        style="margin-top:28px;"
      >
        <tr>
          <td
            align="center"
            bgcolor="${BRAND.blackSoft}"
            style="
              border-radius:999px;
              box-shadow:0 10px 24px rgba(23,20,17,0.14);
            "
          >
            <a
              href="${escapeHtml(href)}"
              style="
                display:inline-block;
                padding:15px 30px;
                border-radius:999px;
                color:${BRAND.white};
                text-decoration:none;
                font-size:12px;
                line-height:1;
                font-weight:700;
                letter-spacing:0.7px;
              "
            >
              ${escapeHtml(label)}
            </a>
          </td>
        </tr>
      </table>
    `;
}

function secondaryButton({
  href,
  label,
}) {
  if (!href) {
    return "";
  }

  return `
      <table
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
        align="center"
        style="margin-top:12px;"
      >
        <tr>
          <td
            align="center"
            style="
              border:1px solid ${BRAND.borderStrong};
              border-radius:999px;
            "
          >
            <a
              href="${escapeHtml(href)}"
              style="
                display:inline-block;
                padding:13px 26px;
                border-radius:999px;
                color:${BRAND.text};
                text-decoration:none;
                font-size:12px;
                line-height:1;
                font-weight:700;
                letter-spacing:0.4px;
              "
            >
              ${escapeHtml(label)}
            </a>
          </td>
        </tr>
      </table>
    `;
}

function statusBadge({
  label,
}) {
  return `
      <span
        style="
          display:inline-block;
          margin:3px 4px;
          padding:7px 13px;
          background:${BRAND.successBackground};
          border:1px solid ${BRAND.successBorder};
          border-radius:999px;
          color:${BRAND.success};
          font-size:10px;
          line-height:1;
          font-weight:700;
          letter-spacing:0.7px;
          text-transform:uppercase;
        "
      >
        ●&nbsp; ${escapeHtml(label)}
      </span>
    `;
}

/*
 * ==========================================================================
 * Main email shell
 * ==========================================================================
 */

function emailLayout({
  preheader,
  heroTitle,
  heroDescription,
  content,
}) {
  const links = getWebsiteLinks();

  return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
  
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
  
          <meta
            name="color-scheme"
            content="light"
          />
  
          <meta
            name="supported-color-schemes"
            content="light"
          />
  
          <title>Pratibha Silks</title>
        </head>
  
        <body
          style="
            margin:0;
            padding:0;
            background:${BRAND.background};
            font-family:Arial,Helvetica,sans-serif;
            color:${BRAND.text};
            -webkit-text-size-adjust:100%;
          "
        >
          <div
            style="
              display:none;
              max-height:0;
              overflow:hidden;
              opacity:0;
              color:transparent;
              line-height:1px;
            "
          >
            ${escapeHtml(preheader || "")}
          </div>
  
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:100%;
              background:${BRAND.background};
            "
          >
            <tr>
              <td
                align="center"
                style="padding:30px 12px;"
              >
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    width:100%;
                    max-width:680px;
                    background:${BRAND.white};
                    border:1px solid rgba(48,42,37,0.06);
                    border-radius:24px;
                    overflow:hidden;
                    box-shadow:0 25px 80px rgba(38,27,18,0.12);
                  "
                >
                  <!-- Hero -->
                  <tr>
                    <td
                      align="center"
                      style="
                        padding:44px 28px 40px;
                        background:${BRAND.black};
                        background-image:
                          radial-gradient(
                            circle at top,
                            rgba(216,180,106,0.18),
                            transparent 48%
                          );
                      "
                    >
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        align="center"
                      >
                        <tr>
                          <td
                            align="center"
                            valign="middle"
                            style="
                              width:66px;
                              height:66px;
                              border:1px solid rgba(216,180,106,0.45);
                              border-radius:50%;
                              background:rgba(216,180,106,0.10);
                            "
                          >
                            <div
                              style="
                                color:${BRAND.goldLight};
                                font-size:34px;
                                line-height:66px;
                                font-weight:400;
                              "
                            >
                              ✓
                            </div>
                          </td>
                        </tr>
                      </table>
  
                      <p
                        style="
                          margin:22px 0 0;
                          color:${BRAND.gold};
                          font-size:10px;
                          font-weight:700;
                          letter-spacing:4px;
                          text-transform:uppercase;
                        "
                      >
                        ✣ &nbsp; PRATIBHA SILKS &nbsp; ✣
                      </p>
  
                      <h1
                        style="
                          margin:18px 0 0;
                          color:${BRAND.white};
                          font-family:Georgia,'Times New Roman',serif;
                          font-size:38px;
                          line-height:1.2;
                          font-weight:400;
                        "
                      >
                        ${escapeHtml(heroTitle)}
                      </h1>
  
                      <p
                        style="
                          margin:14px auto 0;
                          max-width:520px;
                          color:rgba(255,255,255,0.68);
                          font-size:13px;
                          line-height:1.75;
                        "
                      >
                        ${escapeHtml(heroDescription)}
                      </p>
                    </td>
                  </tr>
  
                  <!-- Navigation -->
                  <tr>
                    <td
                      align="center"
                      style="
                        padding:14px 16px;
                        background:${BRAND.cream};
                        border-bottom:1px solid ${BRAND.border};
                      "
                    >
                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td style="padding:4px 11px;">
                            ${navigationLink({
    href: links.home,
    label: "HOME",
  })}
                          </td>
  
                          <td
                            style="
                              color:${BRAND.borderStrong};
                              font-size:12px;
                            "
                          >
                            •
                          </td>
  
                          <td style="padding:4px 11px;">
                            ${navigationLink({
    href: links.collections,
    label: "COLLECTIONS",
  })}
                          </td>
  
                          <td
                            style="
                              color:${BRAND.borderStrong};
                              font-size:12px;
                            "
                          >
                            •
                          </td>
  
                          <td style="padding:4px 11px;">
                            ${navigationLink({
    href: links.contact,
    label: "CONTACT",
  })}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
  
                  <!-- Main content -->
                  <tr>
                    <td
                      style="
                        padding:34px 30px 30px;
                        background:${BRAND.white};
                      "
                    >
                      ${content}
                    </td>
                  </tr>
  
                  <!-- Brand values -->
                  <tr>
                    <td
                      style="
                        padding:24px 24px;
                        background:${BRAND.cream};
                        border-top:1px solid ${BRAND.border};
                      "
                    >
                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                      >
                        <tr>
                          <td
                            align="center"
                            valign="top"
                            width="33%"
                            style="
                              padding:8px 10px;
                              color:${BRAND.text};
                              font-size:11px;
                              line-height:1.6;
                            "
                          >
                            <strong
                              style="
                                color:${BRAND.goldMuted};
                                font-size:12px;
                              "
                            >
                              Handpicked
                            </strong>
  
                            <br />
  
                            Thoughtfully curated
                          </td>
  
                          <td
                            align="center"
                            valign="top"
                            width="34%"
                            style="
                              padding:8px 10px;
                              border-left:1px solid ${BRAND.border};
                              border-right:1px solid ${BRAND.border};
                              color:${BRAND.text};
                              font-size:11px;
                              line-height:1.6;
                            "
                          >
                            <strong
                              style="
                                color:${BRAND.goldMuted};
                                font-size:12px;
                              "
                            >
                              Authentic
                            </strong>
  
                            <br />
  
                            Heritage-inspired drapes
                          </td>
  
                          <td
                            align="center"
                            valign="top"
                            width="33%"
                            style="
                              padding:8px 10px;
                              color:${BRAND.text};
                              font-size:11px;
                              line-height:1.6;
                            "
                          >
                            <strong
                              style="
                                color:${BRAND.goldMuted};
                                font-size:12px;
                              "
                            >
                              Personal
                            </strong>
  
                            <br />
  
                            Customer-first service
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
  
                  <!-- Footer -->
                  <tr>
                    <td
                      align="center"
                      style="
                        padding:30px 24px;
                        background:${BRAND.black};
                      "
                    >
                      <p
                        style="
                          margin:0 0 8px;
                          color:${BRAND.gold};
                          font-size:10px;
                          font-weight:700;
                          letter-spacing:3px;
                          text-transform:uppercase;
                        "
                      >
                        PRATIBHA SILKS
                      </p>
  
                      <p
                        style="
                          margin:0 0 18px;
                          color:${BRAND.white};
                          font-family:Georgia,'Times New Roman',serif;
                          font-size:19px;
                        "
                      >
                        Handpicked Heritage Drapes
                      </p>
  
                      <p style="margin:0 0 18px;">
                        ${footerLink({
    href: links.collections,
    label: "Shop Sarees",
  })}
  
                        <span
                          style="
                            color:rgba(255,255,255,0.25);
                          "
                        >
                          •
                        </span>
  
                        ${footerLink({
    href: links.instagram,
    label: "Instagram",
  })}
  
                        <span
                          style="
                            color:rgba(255,255,255,0.25);
                          "
                        >
                          •
                        </span>
  
                        ${footerLink({
    href: links.whatsapp,
    label: "WhatsApp",
  })}
                      </p>
  
                      <p
                        style="
                          margin:0;
                          color:rgba(255,255,255,0.50);
                          font-size:10px;
                          line-height:1.7;
                        "
                      >
                        This is an automated transactional email
                        from Pratibha Silks.
  
                        <br />
  
                        Replies are monitored by our customer care
                        team.
                      </p>
  
                      <p
                        style="
                          margin:12px 0 0;
                          color:rgba(255,255,255,0.38);
                          font-size:10px;
                        "
                      >
                        © ${new Date().getFullYear()} Pratibha Silks.
                        All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
}

/*
 * ==========================================================================
 * Order meta information
 * ==========================================================================
 */

function orderMetaCard(order) {
  const orderDate = getOrderDate(order);
  const paymentMethod =
    order?.paymentMethod || "ONLINE";

  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:26px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:16px;
        "
      >
        <tr>
          <td
            width="50%"
            valign="top"
            style="
              padding:17px 16px;
              border-bottom:1px solid ${BRAND.border};
              border-right:1px solid ${BRAND.border};
            "
          >
            <p
              style="
                margin:0 0 7px;
                color:${BRAND.goldMuted};
                font-size:9px;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
              "
            >
              Order number
            </p>
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-size:14px;
                font-weight:700;
                word-break:break-word;
              "
            >
              ${escapeHtml(order.orderNumber)}
            </p>
          </td>
  
          <td
            width="50%"
            valign="top"
            style="
              padding:17px 16px;
              border-bottom:1px solid ${BRAND.border};
            "
          >
            <p
              style="
                margin:0 0 7px;
                color:${BRAND.goldMuted};
                font-size:9px;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
              "
            >
              Order date
            </p>
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-size:13px;
                line-height:1.5;
                font-weight:600;
              "
            >
              ${escapeHtml(orderDate || "Not available")}
            </p>
          </td>
        </tr>
  
        <tr>
          <td
            width="50%"
            valign="top"
            style="
              padding:17px 16px;
              border-right:1px solid ${BRAND.border};
            "
          >
            <p
              style="
                margin:0 0 7px;
                color:${BRAND.goldMuted};
                font-size:9px;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
              "
            >
              Payment method
            </p>
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-size:13px;
                font-weight:700;
              "
            >
              ${escapeHtml(formatStatus(paymentMethod))}
            </p>
          </td>
  
          <td
            width="50%"
            valign="top"
            style="padding:17px 16px;"
          >
            <p
              style="
                margin:0 0 7px;
                color:${BRAND.goldMuted};
                font-size:9px;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
              "
            >
              Order total
            </p>
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-family:Georgia,'Times New Roman',serif;
                font-size:21px;
                font-weight:700;
              "
            >
              ${escapeHtml(
    formatMoney(getOrderTotal(order))
  )}
            </p>
          </td>
        </tr>
      </table>
    `;
}

/*
 * ==========================================================================
 * Order items
 * ==========================================================================
 */

function orderItemsTable(order) {
  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const rows = items
    .map((item) => {
      const quantity = Number(item?.quantity || 1);
      const itemPrice = getItemPrice(item);
      const lineTotal = itemPrice * quantity;
      const imageUrl = `https://res.cloudinary.com/dkiauapz4/image/upload/f_auto,q_auto/${item.mainImageId}`

      return `
          <tr>
            <td
              valign="top"
              style="
                width:74px;
                padding:17px 10px 17px 0;
                border-bottom:1px solid ${BRAND.border};
              "
            >
              ${imageUrl
          ? `
                    <img
                      src="${escapeHtml(imageUrl)}"
                      width="64"
                      height="82"
                      alt="${escapeHtml(
            item?.name || "Pratibha Silks Saree"
          )}"
                      style="
                        display:block;
                        width:64px;
                        height:82px;
                        object-fit:cover;
                        border-radius:12px;
                        border:1px solid ${BRAND.border};
                        background:${BRAND.creamDark};
                      "
                    />
                  `
          : `
                    <table
                      role="presentation"
                      width="64"
                      height="82"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:64px;
                        height:82px;
                        background:${BRAND.creamDark};
                        border:1px solid ${BRAND.border};
                        border-radius:12px;
                      "
                    >
                      <tr>
                        <td
                          align="center"
                          valign="middle"
                          style="
                            color:${BRAND.goldMuted};
                            font-family:Georgia,'Times New Roman',serif;
                            font-size:11px;
                          "
                        >
                          Saree
                        </td>
                      </tr>
                    </table>
                  `
        }
            </td>
  
            <td
              valign="top"
              style="
                padding:17px 10px;
                border-bottom:1px solid ${BRAND.border};
              "
            >
              <p
                style="
                  margin:0 0 6px;
                  color:${BRAND.text};
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:17px;
                  line-height:1.4;
                  font-weight:600;
                "
              >
                ${escapeHtml(
          item?.name || "Pratibha Silks Saree"
        )}
              </p>
  
              ${item?.sku
          ? `
                    <p
                      style="
                        margin:0;
                        color:${BRAND.mutedLight};
                        font-size:10px;
                        letter-spacing:0.7px;
                        text-transform:uppercase;
                      "
                    >
                      SKU: ${escapeHtml(item.sku)}
                    </p>
                  `
          : ""
        }
  
              <p
                style="
                  margin:9px 0 0;
                  color:${BRAND.muted};
                  font-size:12px;
                "
              >
                Quantity: ${quantity}
              </p>
            </td>
  
            <td
              valign="top"
              align="right"
              style="
                padding:17px 0 17px 10px;
                border-bottom:1px solid ${BRAND.border};
                white-space:nowrap;
              "
            >
              <p
                style="
                  margin:0;
                  color:${BRAND.text};
                  font-size:14px;
                  font-weight:700;
                "
              >
                ${escapeHtml(formatMoney(lineTotal))}
              </p>
            </td>
          </tr>
        `;
    })
    .join("");

  return `
      ${sectionHeading({
    eyebrow: "Order summary",
    title:
      items.length > 1
        ? "Your selected sarees"
        : "Your selected saree",
    subtitle:
      "A summary of the handcrafted pieces included in your order.",
  })}
  
      ${rows
      ? `
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              <tbody>
                ${rows}
              </tbody>
            </table>
          `
      : `
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                margin-top:16px;
                background:${BRAND.cream};
                border:1px solid ${BRAND.border};
                border-radius:14px;
              "
            >
              <tr>
                <td
                  style="
                    padding:20px;
                    color:${BRAND.muted};
                    font-size:13px;
                    line-height:1.7;
                  "
                >
                  Product details will be available in your
                  online order summary.
                </td>
              </tr>
            </table>
          `
    }
    `;
}

/*
 * ==========================================================================
 * Payment summary
 * ==========================================================================
 */

function orderTotals(order) {
  const subtotal = getOrderSubtotal(order);
  const shipping = getShippingAmount(order);
  const discount = getDiscountAmount(order);

  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:24px;
          background:${BRAND.blackSoft};
          border-radius:18px;
          box-shadow:0 14px 30px rgba(23,20,17,0.15);
        "
      >
        <tr>
          <td style="padding:23px 22px;">
            <p
              style="
                margin:0 0 20px;
                color:${BRAND.white};
                font-family:Georgia,'Times New Roman',serif;
                font-size:21px;
                font-weight:400;
              "
            >
              Payment summary
            </p>
  
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              <tr>
                <td
                  style="
                    padding:7px 0;
                    color:rgba(255,255,255,0.68);
                    font-size:13px;
                  "
                >
                  Subtotal
                </td>
  
                <td
                  align="right"
                  style="
                    padding:7px 0;
                    color:rgba(255,255,255,0.75);
                    font-size:13px;
                  "
                >
                  ${escapeHtml(formatMoney(subtotal))}
                </td>
              </tr>
  
              ${discount > 0
      ? `
                    <tr>
                      <td
                        style="
                          padding:7px 0;
                          color:#86EFAC;
                          font-size:13px;
                        "
                      >
                        Discount
                      </td>
  
                      <td
                        align="right"
                        style="
                          padding:7px 0;
                          color:#86EFAC;
                          font-size:13px;
                        "
                      >
                        -${escapeHtml(
        formatMoney(discount)
      )}
                      </td>
                    </tr>
                  `
      : ""
    }
  
              <tr>
                <td
                  style="
                    padding:7px 0 16px;
                    color:rgba(255,255,255,0.68);
                    font-size:13px;
                  "
                >
                  Shipping
                </td>
  
                <td
                  align="right"
                  style="
                    padding:7px 0 16px;
                    color:rgba(255,255,255,0.75);
                    font-size:13px;
                  "
                >
                  ${escapeHtml(
      shipping > 0
        ? formatMoney(shipping)
        : "Free"
    )}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:17px 0 3px;
                    border-top:1px solid rgba(255,255,255,0.15);
                    color:${BRAND.white};
                    font-size:14px;
                    font-weight:700;
                  "
                >
                  Total paid
                </td>
  
                <td
                  align="right"
                  style="
                    padding:17px 0 3px;
                    border-top:1px solid rgba(255,255,255,0.15);
                    color:${BRAND.goldLight};
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:26px;
                  "
                >
                  ${escapeHtml(
      formatMoney(getOrderTotal(order))
    )}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
}

/*
 * ==========================================================================
 * Customer and delivery information
 * ==========================================================================
 */

function customerDetailsCard(order) {
  const customer = getCustomer(order);

  const customerName =
    customer?.name ||
    customer?.fullName ||
    order?.shippingAddress?.fullName ||
    "Not available";

  const phone =
    customer?.phone ||
    order?.shippingAddress?.phone ||
    "Not available";

  const email =
    customer?.email ||
    "Not available";

  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.white};
          border:1px solid ${BRAND.border};
          border-radius:16px;
        "
      >
        <tr>
          <td style="padding:20px;">
            <p
              style="
                margin:0 0 17px;
                color:${BRAND.text};
                font-family:Georgia,'Times New Roman',serif;
                font-size:20px;
              "
            >
              Customer details
            </p>
  
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              <tr>
                <td
                  style="
                    padding:7px 0;
                    color:${BRAND.goldMuted};
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:1.4px;
                    text-transform:uppercase;
                  "
                >
                  Full name
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:0 0 13px;
                    color:${BRAND.text};
                    font-size:13px;
                    font-weight:600;
                  "
                >
                  ${escapeHtml(customerName)}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:7px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.goldMuted};
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:1.4px;
                    text-transform:uppercase;
                  "
                >
                  Phone
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:0 0 13px;
                    color:${BRAND.text};
                    font-size:13px;
                    font-weight:600;
                  "
                >
                  ${escapeHtml(phone)}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:7px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.goldMuted};
                    font-size:9px;
                    font-weight:700;
                    letter-spacing:1.4px;
                    text-transform:uppercase;
                  "
                >
                  Email
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:0;
                    color:${BRAND.text};
                    font-size:13px;
                    font-weight:600;
                    word-break:break-word;
                  "
                >
                  ${escapeHtml(email)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
}

function addressCard(order) {
  return `
      ${sectionHeading({
    eyebrow: "Shipping information",
    title: "Delivery address",
    subtitle:
      "Your order will be prepared for dispatch to the address below.",
  })}
  
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:16px;
        "
      >
        <tr>
          <td style="padding:20px;">
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-size:13px;
                line-height:1.8;
              "
            >
              ${escapeHtml(
    formatAddress(order?.shippingAddress)
  )}
            </p>
          </td>
        </tr>
      </table>
    `;
}

function paymentReferenceCard(order) {
  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:14px;
        "
      >
        <tr>
          <td style="padding:17px 19px;">
            <p
              style="
                margin:0 0 7px;
                color:${BRAND.goldMuted};
                font-size:9px;
                font-weight:700;
                letter-spacing:1.5px;
                text-transform:uppercase;
              "
            >
              Payment reference
            </p>
  
            <p
              style="
                margin:0;
                color:${BRAND.text};
                font-family:monospace;
                font-size:11px;
                line-height:1.6;
                word-break:break-all;
              "
            >
              ${escapeHtml(getPaymentId(order))}
            </p>
          </td>
        </tr>
      </table>
    `;
}

/*
 * ==========================================================================
 * Next steps
 * ==========================================================================
 */

function timelineStep({
  number,
  title,
  description,
  active = false,
  isLast = false,
}) {
  return `
      <tr>
        <td
          valign="top"
          width="44"
          style="
            position:relative;
            padding:0 12px 22px 0;
          "
        >
          <table
            role="presentation"
            width="34"
            height="34"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              width:34px;
              height:34px;
              background:${active
      ? BRAND.goldMuted
      : BRAND.white
    };
              border:1px solid ${active
      ? BRAND.goldMuted
      : BRAND.borderStrong
    };
              border-radius:50%;
            "
          >
            <tr>
              <td
                align="center"
                valign="middle"
                style="
                  color:${active
      ? BRAND.white
      : BRAND.goldMuted
    };
                  font-size:12px;
                  font-weight:700;
                "
              >
                ${escapeHtml(String(number))}
              </td>
            </tr>
          </table>
  
          ${!isLast
      ? `
                <div
                  style="
                    width:1px;
                    height:28px;
                    margin:2px 0 0 16px;
                    background:${BRAND.borderStrong};
                  "
                ></div>
              `
      : ""
    }
        </td>
  
        <td
          valign="top"
          style="padding:1px 0 22px;"
        >
          <p
            style="
              margin:0;
              color:${BRAND.text};
              font-size:13px;
              font-weight:700;
            "
          >
            ${escapeHtml(title)}
          </p>
  
          <p
            style="
              margin:5px 0 0;
              color:${BRAND.muted};
              font-size:11px;
              line-height:1.65;
            "
          >
            ${escapeHtml(description)}
          </p>
        </td>
      </tr>
    `;
}

function nextStepsCard() {
  return `
      ${sectionHeading({
    eyebrow: "Order journey",
    title: "What happens next?",
    subtitle:
      "We will keep you informed as your order moves toward dispatch.",
  })}
  
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:16px;
        "
      >
        <tr>
          <td style="padding:21px 20px 4px;">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              ${timelineStep({
    number: 1,
    title: "Order confirmed",
    description:
      "Your order and payment details have been successfully recorded.",
    active: true,
  })}
  
              ${timelineStep({
    number: 2,
    title: "Quality check and packing",
    description:
      "Your saree will be inspected and packed carefully by our team.",
  })}
  
              ${timelineStep({
    number: 3,
    title: "Dispatch and tracking",
    description:
      "Tracking information will be shared once your order is dispatched.",
    isLast: true,
  })}
            </table>
          </td>
        </tr>
      </table>
    `;
}

/*
 * ==========================================================================
 * Buyer email
 * ==========================================================================
 */

function buildBuyerOrderEmail(order) {
  const customer = getCustomer(order);
  const orderUrl = getPublicOrderUrl(order);
  const links = getWebsiteLinks();

  const customerName =
    customer?.name ||
    customer?.fullName ||
    order?.shippingAddress?.fullName ||
    "Valued Customer";

  const html = emailLayout({
    preheader:
      `Your Pratibha Silks order ${order.orderNumber} ` +
      "has been confirmed.",

    heroTitle: "Your order is confirmed",

    heroDescription:
      "Thank you for shopping with us. Your saree has been " +
      "reserved and our team will prepare it carefully for dispatch.",

    content: `
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
        >
          <tr>
            <td align="center">
              <div>
                ${statusBadge({
      label: formatStatus(
        getOrderStatus(order)
      ),
    })}
  
                ${statusBadge({
      label: formatStatus(
        getPaymentStatus(order)
      ),
    })}
              </div>
  
              <p
                style="
                  margin:22px auto 0;
                  max-width:530px;
                  color:${BRAND.muted};
                  font-size:14px;
                  line-height:1.75;
                "
              >
                Namaste
                <strong style="color:${BRAND.text};">
                  ${escapeHtml(customerName)}
                </strong>,
  
                <br />
  
                Your payment has been received successfully.
                Please find your complete order summary below.
              </p>
            </td>
          </tr>
        </table>
  
        ${orderMetaCard(order)}
  
        ${orderItemsTable(order)}
  
        ${orderTotals(order)}
  
        ${customerDetailsCard(order)}
  
        ${addressCard(order)}
  
        ${paymentReferenceCard(order)}
  
        ${primaryButton({
      href: orderUrl,
      label: "VIEW ORDER DETAILS",
    })}
  
        ${nextStepsCard()}
  
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            margin-top:26px;
            background:${BRAND.warningBackground};
            border:1px solid ${BRAND.warningBorder};
            border-radius:15px;
          "
        >
          <tr>
            <td
              align="center"
              style="padding:20px 22px;"
            >
              <p
                style="
                  margin:0 0 7px;
                  color:${BRAND.goldDark};
                  font-family:Georgia,'Times New Roman',serif;
                  font-size:17px;
                "
              >
                Need assistance?
              </p>
  
              <p
                style="
                  margin:0;
                  color:${BRAND.muted};
                  font-size:12px;
                  line-height:1.7;
                "
              >
                Keep your order number handy when contacting
                our team regarding delivery or order updates.
              </p>
  
              ${secondaryButton({
      href: links.whatsapp,
      label: "CHAT WITH US ON WHATSAPP",
    })}
            </td>
          </tr>
        </table>
  
        <p
          style="
            margin:30px 0 0;
            color:${BRAND.text};
            font-family:Georgia,'Times New Roman',serif;
            font-size:15px;
            line-height:1.7;
            text-align:center;
            font-style:italic;
          "
        >
          We hope this saree becomes part of a beautiful
          memory.
        </p>
  
        <p
          style="
            margin:9px 0 0;
            color:${BRAND.goldMuted};
            font-size:12px;
            line-height:1.7;
            text-align:center;
            font-weight:700;
            letter-spacing:0.4px;
          "
        >
          With warmth,
          <br />
          Team Pratibha Silks
        </p>
      `,
  });

  const text = [
    "PRATIBHA SILKS",
    "Handpicked Heritage Drapes",
    "",
    `Namaste ${customerName},`,
    "",
    "Your payment has been received and your order is confirmed.",
    "",
    `Order number: ${order.orderNumber}`,
    `Order status: ${formatStatus(
      getOrderStatus(order)
    )}`,
    `Payment status: ${formatStatus(
      getPaymentStatus(order)
    )}`,
    `Payment method: ${formatStatus(
      order.paymentMethod || "ONLINE"
    )}`,
    getOrderDate(order)
      ? `Order date: ${getOrderDate(order)}`
      : "",
    `Payment reference: ${getPaymentId(order)}`,
    "",
    "ORDER ITEMS",
    buildItemsText(order),
    "",
    `Subtotal: ${formatMoney(
      getOrderSubtotal(order)
    )}`,
    getDiscountAmount(order) > 0
      ? `Discount: -${formatMoney(
        getDiscountAmount(order)
      )}`
      : "",
    `Shipping: ${getShippingAmount(order) > 0
      ? formatMoney(getShippingAmount(order))
      : "Free"
    }`,
    `Total paid: ${formatMoney(
      getOrderTotal(order)
    )}`,
    "",
    `Delivery address: ${formatAddress(
      order.shippingAddress
    )}`,
    "",
    orderUrl
      ? `View your order: ${orderUrl}`
      : "",
    `Explore our collections: ${links.collections}`,
    `Contact us: ${links.contact}`,
    `WhatsApp: ${links.whatsapp}`,
    `Instagram: ${links.instagram}`,
    "",
    "WHAT HAPPENS NEXT",
    "1. Order confirmed",
    "2. Quality check and packing",
    "3. Dispatch and tracking",
    "",
    "We will share another update when your order is shipped.",
    "",
    "With warmth,",
    "Team Pratibha Silks",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject:
      `Your Pratibha Silks order ` +
      `${order.orderNumber} is confirmed`,

    html,
    text,
  };
}

/*
 * ==========================================================================
 * Admin email components
 * ==========================================================================
 */

function adminCustomerCard(order) {
  const customer = getCustomer(order);

  const customerName =
    customer?.name ||
    customer?.fullName ||
    order?.shippingAddress?.fullName ||
    "Customer";

  const phone =
    customer?.phone ||
    order?.shippingAddress?.phone ||
    "Not available";

  const email =
    customer?.email ||
    "Not provided";

  return `
      ${sectionHeading({
    eyebrow: "Customer information",
    title: "Customer details",
    subtitle:
      "Contact and payment details for this order.",
  })}
  
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:16px;
        "
      >
        <tr>
          <td style="padding:20px;">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              <tr>
                <td
                  style="
                    padding:8px 0;
                    color:${BRAND.muted};
                    font-size:12px;
                  "
                >
                  Customer
                </td>
  
                <td
                  align="right"
                  style="
                    padding:8px 0;
                    color:${BRAND.text};
                    font-size:13px;
                    font-weight:700;
                  "
                >
                  ${escapeHtml(customerName)}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.muted};
                    font-size:12px;
                  "
                >
                  Phone
                </td>
  
                <td
                  align="right"
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.text};
                    font-size:13px;
                    font-weight:600;
                  "
                >
                  ${escapeHtml(phone)}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.muted};
                    font-size:12px;
                  "
                >
                  Email
                </td>
  
                <td
                  align="right"
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.text};
                    font-size:13px;
                    word-break:break-word;
                  "
                >
                  ${escapeHtml(email)}
                </td>
              </tr>
  
              <tr>
                <td
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.muted};
                    font-size:12px;
                  "
                >
                  Source
                </td>
  
                <td
                  align="right"
                  style="
                    padding:8px 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.text};
                    font-size:13px;
                  "
                >
                  ${escapeHtml(
    formatStatus(order?.source || "WEBSITE")
  )}
                </td>
              </tr>
  
              <tr>
                <td
                  valign="top"
                  style="
                    padding:8px 12px 0 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.muted};
                    font-size:12px;
                  "
                >
                  Payment reference
                </td>
  
                <td
                  align="right"
                  valign="top"
                  style="
                    padding:8px 0 0;
                    border-top:1px solid ${BRAND.border};
                    color:${BRAND.text};
                    font-family:monospace;
                    font-size:10px;
                    line-height:1.6;
                    word-break:break-all;
                  "
                >
                  ${escapeHtml(getPaymentId(order))}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
}

function customerNotesCard(order) {
  if (!order?.customerNotes) {
    return "";
  }

  return `
      ${sectionHeading({
    eyebrow: "Order instructions",
    title: "Customer notes",
    subtitle:
      "Review these instructions before preparing the package.",
  })}
  
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:18px;
          background:${BRAND.warningBackground};
          border:1px solid ${BRAND.warningBorder};
          border-radius:14px;
        "
      >
        <tr>
          <td
            style="
              padding:18px 20px;
              color:${BRAND.text};
              font-size:13px;
              line-height:1.75;
            "
          >
            ${escapeHtml(order.customerNotes)}
          </td>
        </tr>
      </table>
    `;
}

function adminActionButtons(order) {
  const orderUrl = getPublicOrderUrl(order);
  const customerWhatsAppUrl =
    getCustomerWhatsAppUrl(order);

  if (!orderUrl && !customerWhatsAppUrl) {
    return "";
  }

  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="margin-top:28px;"
      >
        <tr>
          ${orderUrl
      ? `
                <td
                  align="center"
                  width="${customerWhatsAppUrl
        ? "50%"
        : "100%"
      }"
                  style="padding:5px;"
                >
                  <a
                    href="${escapeHtml(orderUrl)}"
                    style="
                      display:block;
                      padding:14px 15px;
                      background:${BRAND.blackSoft};
                      border:1px solid ${BRAND.blackSoft};
                      border-radius:999px;
                      color:${BRAND.white};
                      text-decoration:none;
                      font-size:11px;
                      font-weight:700;
                      letter-spacing:0.5px;
                    "
                  >
                    OPEN ORDER
                  </a>
                </td>
              `
      : ""
    }
  
          ${customerWhatsAppUrl
      ? `
                <td
                  align="center"
                  width="${orderUrl ? "50%" : "100%"}"
                  style="padding:5px;"
                >
                  <a
                    href="${escapeHtml(
        customerWhatsAppUrl
      )}"
                    style="
                      display:block;
                      padding:14px 15px;
                      background:${BRAND.white};
                      border:1px solid ${BRAND.borderStrong};
                      border-radius:999px;
                      color:${BRAND.text};
                      text-decoration:none;
                      font-size:11px;
                      font-weight:700;
                      letter-spacing:0.5px;
                    "
                  >
                    MESSAGE CUSTOMER
                  </a>
                </td>
              `
      : ""
    }
        </tr>
      </table>
    `;
}

function fulfilmentChecklist() {
  return `
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="
          margin-top:28px;
          background:${BRAND.cream};
          border:1px solid ${BRAND.border};
          border-radius:15px;
        "
      >
        <tr>
          <td style="padding:20px;">
            <p
              style="
                margin:0 0 14px;
                color:${BRAND.text};
                font-family:Georgia,'Times New Roman',serif;
                font-size:18px;
              "
            >
              Fulfilment checklist
            </p>
  
            <p
              style="
                margin:7px 0;
                color:${BRAND.muted};
                font-size:12px;
                line-height:1.6;
              "
            >
              □ Verify the selected saree and SKU
            </p>
  
            <p
              style="
                margin:7px 0;
                color:${BRAND.muted};
                font-size:12px;
                line-height:1.6;
              "
            >
              □ Complete quality inspection
            </p>
  
            <p
              style="
                margin:7px 0;
                color:${BRAND.muted};
                font-size:12px;
                line-height:1.6;
              "
            >
              □ Review delivery address and customer notes
            </p>
  
            <p
              style="
                margin:7px 0;
                color:${BRAND.muted};
                font-size:12px;
                line-height:1.6;
              "
            >
              □ Pack securely and update the order status
            </p>
  
            <p
              style="
                margin:7px 0 0;
                color:${BRAND.muted};
                font-size:12px;
                line-height:1.6;
              "
            >
              □ Add courier and tracking information after
              dispatch
            </p>
          </td>
        </tr>
      </table>
    `;
}

/*
 * ==========================================================================
 * Admin email
 * ==========================================================================
 */

function buildAdminOrderEmail(order) {
  const customer = getCustomer(order);
  const orderUrl = getPublicOrderUrl(order);

  const customerName =
    customer?.name ||
    customer?.fullName ||
    order?.shippingAddress?.fullName ||
    "Customer";

  const phone =
    customer?.phone ||
    order?.shippingAddress?.phone ||
    "Not available";

  const customerWhatsAppUrl =
    getCustomerWhatsAppUrl(order);

  const html = emailLayout({
    preheader:
      `New paid order ${order.orderNumber} received ` +
      `from ${customerName}.`,

    heroTitle: "New paid order received",

    heroDescription:
      `Order ${order.orderNumber} has been successfully ` +
      "paid and is ready for fulfilment.",

    content: `
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
        >
          <tr>
            <td align="center">
              <div>
                ${statusBadge({
      label: "Payment received",
    })}
  
                ${statusBadge({
      label: "Action required",
    })}
              </div>
  
              <p
                style="
                  margin:22px auto 0;
                  max-width:530px;
                  color:${BRAND.muted};
                  font-size:14px;
                  line-height:1.75;
                "
              >
                A new website order has been paid by
                <strong style="color:${BRAND.text};">
                  ${escapeHtml(customerName)}
                </strong>.
  
                Review the information below and begin
                fulfilment.
              </p>
            </td>
          </tr>
        </table>
  
        ${orderMetaCard(order)}
  
        ${adminCustomerCard(order)}
  
        ${orderItemsTable(order)}
  
        ${orderTotals(order)}
  
        ${addressCard(order)}
  
        ${customerNotesCard(order)}
  
        ${adminActionButtons(order)}
  
        ${fulfilmentChecklist()}
      `,
  });

  const text = [
    "PRATIBHA SILKS - NEW PAID ORDER",
    "",
    `Order: ${order.orderNumber}`,
    `Order status: ${formatStatus(
      getOrderStatus(order)
    )}`,
    `Payment status: ${formatStatus(
      getPaymentStatus(order)
    )}`,
    `Payment method: ${formatStatus(
      order.paymentMethod || "ONLINE"
    )}`,
    getOrderDate(order)
      ? `Order date: ${getOrderDate(order)}`
      : "",
    "",
    `Customer: ${customerName}`,
    `Phone: ${phone}`,
    `Email: ${customer?.email || "Not provided"}`,
    `Source: ${formatStatus(
      order?.source || "WEBSITE"
    )}`,
    `Payment ID: ${getPaymentId(order)}`,
    "",
    "ITEMS",
    buildItemsText(order),
    "",
    `Subtotal: ${formatMoney(
      getOrderSubtotal(order)
    )}`,
    getDiscountAmount(order) > 0
      ? `Discount: -${formatMoney(
        getDiscountAmount(order)
      )}`
      : "",
    `Shipping: ${getShippingAmount(order) > 0
      ? formatMoney(getShippingAmount(order))
      : "Free"
    }`,
    `Total paid: ${formatMoney(
      getOrderTotal(order)
    )}`,
    "",
    `Delivery address: ${formatAddress(
      order.shippingAddress
    )}`,
    order?.customerNotes
      ? `Customer notes: ${order.customerNotes}`
      : "",
    "",
    orderUrl
      ? `Open order: ${orderUrl}`
      : "",
    customerWhatsAppUrl
      ? `Message customer: ${customerWhatsAppUrl}`
      : "",
    "",
    "FULFILMENT CHECKLIST",
    "□ Verify the saree and SKU",
    "□ Complete quality inspection",
    "□ Review delivery details",
    "□ Pack securely",
    "□ Update order status",
    "□ Add tracking details after dispatch",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject:
      `New paid order ${order.orderNumber} · ` +
      `${formatMoney(getOrderTotal(order))}`,

    html,
    text,
  };
}

module.exports = {
  buildBuyerOrderEmail,
  buildAdminOrderEmail,
};