/**
 * Formatting for the "new order" email.
 *
 * Kept free of any Deno or network API so it can be tested on its own — the
 * body of this email is the deliverable, and it is the part most likely to be
 * quietly wrong (a mis-divided price, a missing line, an unescaped apostrophe in
 * someone's note).
 */

export interface OrderLine {
  name_snapshot: string;
  quantity: number;
  unit_price_piastres: number;
  line_total_piastres: number;
}

export interface Order {
  order_number: string;
  status: string;
  fulfilment: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  notes: string | null;
  subtotal_piastres: number;
  total_piastres: number;
  created_at: string;
  order_items: OrderLine[];
}

/** Piastres to a pounds string. Whole pounds lose the ".00" — every price on
 *  this menu is a round number and the zeros are only noise. */
export const pounds = (piastres: number): string =>
  (piastres / 100).toLocaleString('en-US', {
    minimumFractionDigits: piastres % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

/**
 * Escape for HTML. Customer names and notes are free text typed by a stranger
 * and land in an email body; without this, a note containing `<b>` — or worse —
 * would be interpreted rather than read.
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Cairo time, because that is where the counter is. */
export const cairoTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Africa/Cairo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const subjectFor = (order: Order): string => {
  const kind = order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup';
  const count = order.order_items.reduce((sum, line) => sum + line.quantity, 0);
  return `${order.order_number} · ${kind} · E£ ${pounds(order.total_piastres)} · ${count} item${
    count === 1 ? '' : 's'
  }`;
};

/**
 * Plain text version. Not a courtesy — a phone showing a notification preview
 * renders this, and it is what gets read first behind a counter.
 */
export const textFor = (order: Order): string => {
  const lines = order.order_items
    .map(
      (line) =>
        `  ${line.quantity} x ${line.name_snapshot}` +
        `  —  E£ ${pounds(line.line_total_piastres)}`
    )
    .join('\n');

  return [
    `${order.order_number}`,
    `${order.fulfilment === 'delivery' ? 'DELIVERY' : 'PICKUP'} · ${cairoTime(order.created_at)}`,
    ``,
    `${order.customer_name} · ${order.customer_phone}`,
    order.fulfilment === 'delivery' && order.address ? `Address: ${order.address}` : null,
    order.notes ? `Note: ${order.notes}` : null,
    ``,
    lines,
    ``,
    `TOTAL  E£ ${pounds(order.total_piastres)}`,
  ]
    .filter((part) => part !== null)
    .join('\n');
};

/**
 * HTML version.
 *
 * Deliberately table-based with inline styles. Gmail strips <style> blocks in
 * some contexts and ignores flexbox and grid outright, so anything cleverer
 * arrives as a stack of unstyled text on exactly the client this is aimed at.
 */
export const htmlFor = (order: Order): string => {
  const isDelivery = order.fulfilment === 'delivery';
  const e = escapeHtml;

  const rows = order.order_items
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e6e4dd;font-size:15px;color:#14200f;">
            <strong style="color:#2a4326;">${line.quantity}×</strong>&nbsp; ${e(line.name_snapshot)}
            <div style="font-size:12px;color:#7b7f76;">E£ ${pounds(line.unit_price_piastres)} each</div>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e6e4dd;font-size:15px;color:#14200f;white-space:nowrap;">
            E£ ${pounds(line.line_total_piastres)}
          </td>
        </tr>`
    )
    .join('');

  const detail = (label: string, value: string) => `
        <tr>
          <td style="padding:3px 0;font-size:13px;color:#7b7f76;width:90px;">${label}</td>
          <td style="padding:3px 0;font-size:15px;color:#14200f;">${value}</td>
        </tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1efe9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1efe9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:#2a4326;padding:22px 24px;">
              <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d8a75e;">New order</div>
              <div style="font-size:26px;color:#f7f9f7;padding-top:4px;">${e(order.order_number)}</div>
              <div style="font-size:13px;color:#b9c4b2;padding-top:6px;">
                ${isDelivery ? 'Delivery' : 'Pickup'} · ${cairoTime(order.created_at)}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detail('Name', e(order.customer_name))}
                ${detail(
                  'Phone',
                  `<a href="tel:${e(order.customer_phone.replace(/[^\d+]/g, ''))}" style="color:#2a4326;">${e(
                    order.customer_phone
                  )}</a>`
                )}
                ${isDelivery && order.address ? detail('Address', e(order.address)) : ''}
                ${order.notes ? detail('Note', `<em>${e(order.notes)}</em>`) : ''}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px 26px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7b7f76;">Total</td>
                  <td align="right" style="font-size:24px;color:#2a4326;white-space:nowrap;">
                    E£ ${pounds(order.total_piastres)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#f1efe9;padding:14px 24px;font-size:12px;color:#7b7f76;">
              Paid at the counter. Update the status in the Solis dashboard and the
              customer sees it on their phone.
            </td>
          </tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};
