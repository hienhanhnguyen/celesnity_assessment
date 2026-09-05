import express, { type Express, type Request, type Response } from 'express';
import { loadDataset, type Dataset } from './data.ts';
import { parsePageParams, paginate } from './paginate.ts';
import { renderDeliveriesPage } from './crawler-html.ts';

export function createApp(dataset: Dataset = loadDataset()): Express {
  const app = express();
  app.disable('x-powered-by');

  const failedOnce = new Set<string>();

  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({ status: 'ok', service: 'fixtures', now: new Date().toISOString() });
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'celesnity-fixtures',
      applicationApi: ['/api/work-orders', '/api/batches', '/api/receiving', '/api/dispatch'],
      supplierCrawler: ['/suppliers/deliveries?page=1'],
      pagination: '{ data, page, pageSize, total, totalPages }',
    });
  });

  // Application API (JSON, paginated) 
  app.get('/api/work-orders', (req, res) => {
    sendPage(res, req, dataset.workOrders);
  });

  app.get('/api/batches', (req, res) => {
    let rows = dataset.batches;
    const { workOrderId, lineId } = req.query as Record<string, string | undefined>;
    if (workOrderId) rows = rows.filter((b) => b.workOrderId === workOrderId);
    if (lineId) rows = rows.filter((b) => b.lineId === lineId);
    sendPage(res, req, rows);
  });

  app.get('/api/receiving', (req, res) => {
    sendPage(res, req, dataset.receiving);
  });

  app.get('/api/dispatch', (req, res) => {
    const { page, pageSize } = parsePageParams(req.query as Record<string, unknown>);
    if (page === 1 && !failedOnce.has('dispatch:p1')) {
      failedOnce.add('dispatch:p1');
      res
        .status(503)
        .set('Retry-After', '0')
        .json({ error: 'transient upstream failure (deterministic; succeeds on retry)' });
      return;
    }
    res.json(paginate(dataset.dispatch, page, pageSize));
  });

  // Supplier crawler (HTML pages with next links)

  app.get('/suppliers/deliveries', (req, res) => {
    const { page } = parsePageParams(req.query as Record<string, unknown>);
    res.type('html').send(renderDeliveriesPage(dataset.deliveries, page));
  });

  // Fallback
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'not found', path: req.path });
  });

  return app;
}

function sendPage<T>(res: Response, req: Request, items: readonly T[]): void {
  const { page, pageSize } = parsePageParams(req.query as Record<string, unknown>);
  res.json(paginate(items, page, pageSize));
}
