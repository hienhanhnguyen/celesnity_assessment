import type { DeliveryRecord } from './data.ts';

export const CRAWLER_PAGE_SIZE = 3;

export function totalDeliveryPages(count: number): number {
  return Math.max(1, Math.ceil(count / CRAWLER_PAGE_SIZE));
}

export function renderDeliveriesPage(
  all: readonly DeliveryRecord[],
  requestedPage: number,
): string {
  const totalPages = totalDeliveryPages(all.length);
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * CRAWLER_PAGE_SIZE;
  const rows = all.slice(start, start + CRAWLER_PAGE_SIZE);

  // After last page, link back to page 1
  const nextPage = page < totalPages ? page + 1 : 1;

  const body = rows.map(renderRow).join('\n');
  const prevLink =
    page > 1
      ? `<a class="prev" rel="prev" href="/suppliers/deliveries?page=${page - 1}">Previous</a>`
      : '';
  const nextLink = `<a class="next" rel="next" href="/suppliers/deliveries?page=${nextPage}">Next</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Supplier Deliveries — page ${page} of ${totalPages}</title>
</head>
<body>
  <h1>Supplier Deliveries</h1>
  <p class="pagination-info">Page <span class="page">${page}</span> of <span class="total-pages">${totalPages}</span></p>
  <table id="deliveries">
    <thead>
      <tr><th>Record</th><th>Batch</th><th>Line</th><th>Quantity</th><th>Received</th><th>Supplier</th></tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
  <nav class="pager">
    ${prevLink}
    ${nextLink}
  </nav>
</body>
</html>`;
}

function renderRow(r: DeliveryRecord): string {
  const batchCell = r.malformed || r.batchId === null ? '' : escapeHtml(r.batchId);
  const qtyCell = r.malformed || r.quantity === null ? 'N/A' : String(r.quantity);
  const rowClass = r.malformed ? 'delivery malformed' : 'delivery';
  return `      <tr class="${rowClass}" data-record-id="${escapeHtml(r.recordId)}">
        <td class="record-id">${escapeHtml(r.recordId)}</td>
        <td class="batch-id">${batchCell}</td>
        <td class="line-id">${escapeHtml(r.lineId)}</td>
        <td class="quantity">${qtyCell}</td>
        <td class="received-at">${escapeHtml(r.eventTime)}</td>
        <td class="supplier">${escapeHtml(r.supplier)}</td>
      </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
