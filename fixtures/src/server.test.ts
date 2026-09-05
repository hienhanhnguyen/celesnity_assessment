import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from './app.ts';

let server: Server;
let base = '';

async function listen(): Promise<{ srv: Server; url: string }> {
  const srv = createApp().listen(0);
  await new Promise<void>((resolve) => srv.once('listening', () => resolve()));
  const { port } = srv.address() as AddressInfo;
  return { srv, url: `http://127.0.0.1:${port}` };
}

before(async () => {
  const started = await listen();
  server = started.srv;
  base = started.url;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function getJson(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(base + path);
  return { status: res.status, body: (await res.json()) as any };
}
async function getText(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(base + path);
  return { status: res.status, text: await res.text() };
}

describe('Application API — pagination envelope', () => {
  it('paginates work orders across pages', async () => {
    const p1 = await getJson('/api/work-orders?page=1&pageSize=3');
    assert.equal(p1.status, 200);
    assert.deepEqual(
      {
        page: p1.body.page,
        pageSize: p1.body.pageSize,
        total: p1.body.total,
        totalPages: p1.body.totalPages,
      },
      { page: 1, pageSize: 3, total: 5, totalPages: 2 },
    );
    assert.equal(p1.body.data.length, 3);

    const p2 = await getJson('/api/work-orders?page=2&pageSize=3');
    assert.equal(p2.body.data.length, 2);
    assert.equal(p2.body.data[0].workOrderId, 'WO-1004');
  });

  it('maps every batch to a work order and line, and filters', async () => {
    const all = await getJson('/api/batches?pageSize=100');
    assert.equal(all.body.total, 8);
    for (const b of all.body.data) {
      assert.match(b.workOrderId, /^WO-\d{4}$/);
      assert.match(b.lineId, /^LINE-[AB]$/);
    }
    const filtered = await getJson('/api/batches?workOrderId=WO-1001');
    assert.equal(filtered.body.total, 2);
  });

  it('serves the corroborating RECEIVING records', async () => {
    const r = await getJson('/api/receiving?pageSize=100');
    assert.equal(r.body.total, 2);
    assert.equal(r.body.data[0].station, 'RECEIVING');
  });
});

describe('Application API — deterministic transient failure', () => {
  it('fails the first dispatch attempt with 503, then succeeds on retry', async () => {
    const { srv, url } = await listen();
    const target = `${url}/api/dispatch?page=1`;

    const first = await fetch(target);
    assert.equal(first.status, 503, 'first attempt must be a transient 503');

    const second = await fetch(target);
    assert.equal(second.status, 200, 'retry must succeed');
    const body = (await second.json()) as any;
    assert.equal(body.total, 1);
    assert.equal(body.data[0].batchId, 'BATCH-0001');
    assert.equal(body.data[0].quantity, 100);
    assert.equal(body.data[0].station, 'DISPATCH');

    await new Promise<void>((resolve) => srv.close(() => resolve()));
  });
});

describe('Supplier crawler — HTML pages', () => {
  it('page 1 lists rows with data-record-id and links to the next page', async () => {
    const { status, text } = await getText('/suppliers/deliveries?page=1');
    assert.equal(status, 200);
    assert.match(text, /data-record-id="DLV-0001"/);
    assert.match(text, /class="next" rel="next" href="\/suppliers\/deliveries\?page=2"/);
  });

  it('page 2 contains the malformed row (blank batch, non-numeric quantity)', async () => {
    const { text } = await getText('/suppliers/deliveries?page=2');
    assert.match(text, /data-record-id="DLV-0099"/);
    assert.match(text, /class="delivery malformed"/);
    assert.match(text, /<td class="batch-id"><\/td>/);
  });

  it('the last page loops its next-link back to page 1 (loop-guard bait)', async () => {
    const { text } = await getText('/suppliers/deliveries?page=3');
    assert.match(text, /Page <span class="page">3<\/span> of <span class="total-pages">3<\/span>/);
    assert.match(text, /class="next" rel="next" href="\/suppliers\/deliveries\?page=1"/);
  });
});
