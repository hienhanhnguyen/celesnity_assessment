import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { BatchState, ManagementEventType, RunStatus, SourceType } from '../../src/common/domain/enums';
import { STATION_ORDER } from '../../src/common/domain/station';
import { createE2EApp, type E2ERuntime } from './harness';

const RO_PASSWORD = 'factory_readonly_pw_change_me';

describe('Celesnity API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let runtime: E2ERuntime;
  const req = () => request(http);

  let apiSourceId = '';
  let crawlerSourceId = '';
  let dbSourceId = '';
  let seedOrg = '';
  let seedActor = '';
  let seededBlockId = '';
  let seededBlockCreatedAt = '';
  let mgmtBaseline = 0;

  beforeAll(async () => {
    const created = await createE2EApp();
    app = created.app;
    runtime = created.runtime;
    http = app.getHttpServer();
  }, 90_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/health reports the database up', async () => {
    const res = await req().get('/api/health').expect(200);
    expect(res.body.database).toBe('up');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/config exposes threshold, station order, and seeded identity', async () => {
    const res = await req().get('/api/config').expect(200);
    expect(res.body.staleThresholdMinutes).toBe(15);
    expect(res.body.stations).toEqual([...STATION_ORDER]);
    expect(typeof res.body.seed.organizationId).toBe('string');
    expect(typeof res.body.seed.actor).toBe('string');
    seedOrg = res.body.seed.organizationId;
    seedActor = res.body.seed.actor;
  });

  it('GET /api/sources lists the two seeded, secret-free sources', async () => {
    const res = await req().get('/api/sources').expect(200);
    const sources = res.body as Array<Record<string, any>>;
    expect(sources.length).toBeGreaterThanOrEqual(2);

    const apiSource = sources.find((s) => s.type === SourceType.API);
    const crawlerSource = sources.find((s) => s.type === SourceType.CRAWLER);
    expect(apiSource).toBeDefined();
    expect(crawlerSource).toBeDefined();
    expect(apiSource!.hasSecret).toBe(false);
    expect(crawlerSource!.hasSecret).toBe(false);
    for (const s of sources) expect(s).not.toHaveProperty('secret');

    apiSourceId = apiSource!.id;
    crawlerSourceId = crawlerSource!.id;
  });

  it('POST /api/sources registers a DATABASE source with a masked secret, never echoing it', async () => {
    const res = await req()
      .post('/api/sources')
      .send({
        type: SourceType.DATABASE,
        name: 'Factory Production DB',
        config: {
          host: runtime.factory.host,
          port: runtime.factory.port,
          database: runtime.factory.database,
          user: runtime.factory.user,
        },
        selection: { table: 'production_events' },
        secret: RO_PASSWORD,
      })
      .expect(201);

    expect(res.body.type).toBe(SourceType.DATABASE);
    expect(res.body.hasSecret).toBe(true);
    expect(res.body).not.toHaveProperty('secret');
    expect(JSON.stringify(res.body)).not.toContain(RO_PASSWORD);
    dbSourceId = res.body.id;
  });

  it('POST /api/sources/:id/test connects with the stored read-only credentials', async () => {
    const res = await req().post(`/api/sources/${dbSourceId}/test`).expect(200);
    expect(res.body.ok).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(RO_PASSWORD);
  });

  it('GET /api/sources/:id/discover lists the factory tables', async () => {
    const res = await req().get(`/api/sources/${dbSourceId}/discover`).expect(200);
    const names = (res.body.entities as Array<{ name: string }>).map((e) => e.name);
    expect(names).toContain('production_events');
  });

  it('PATCH /api/sources/:id/selection sets the table to collect', async () => {
    const res = await req()
      .patch(`/api/sources/${dbSourceId}/selection`)
      .send({ selection: { table: 'production_events' } })
      .expect(200);
    expect(res.body.selection.table).toBe('production_events');
  });


  it('POST /api/sources/:apiId/collect succeeds despite the transient 503 (retry works)', async () => {
    const res = await req().post(`/api/sources/${apiSourceId}/collect`).expect(200);
    expect([RunStatus.SUCCESS, RunStatus.PARTIAL]).toContain(res.body.status);
    expect(res.body.sourceId).toBe(apiSourceId);
    expect(res.body.fetched).toBeGreaterThan(0);
    expect(res.body.finishedAt).not.toBeNull();
  });

  it('POST /api/sources/:crawlerId/collect stays PARTIAL on the malformed row (never fully fails)', async () => {
    const res = await req().post(`/api/sources/${crawlerSourceId}/collect`).expect(200);
    expect(res.body.status).toBe(RunStatus.PARTIAL);
    expect(res.body.fetched).toBeGreaterThan(0);
    expect(res.body.errors).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/sources/:dbId/collect ingests the factory production events', async () => {
    const res = await req().post(`/api/sources/${dbSourceId}/collect`).expect(200);
    expect([RunStatus.SUCCESS, RunStatus.PARTIAL]).toContain(res.body.status);
    expect(res.body.fetched).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain(RO_PASSWORD);
  });

  it('GET /api/lines returns both lines with a full six-station board', async () => {
    const res = await req().get('/api/lines').expect(200);
    const lines = res.body as Array<Record<string, any>>;
    const ids = lines.map((l) => l.lineId);
    expect(ids).toContain('LINE-A');
    expect(ids).toContain('LINE-B');
    for (const line of lines) {
      expect(line.stations.map((s: { station: string }) => s.station)).toEqual([...STATION_ORDER]);
      expect(typeof line.batchCount).toBe('number');
    }
  });

  it('GET /api/lines/:id returns one board and 404s the unknown', async () => {
    const res = await req().get('/api/lines/LINE-A').expect(200);
    expect(res.body.lineId).toBe('LINE-A');
    expect(res.body.stations).toHaveLength(6);
    await req().get('/api/lines/LINE-DOES-NOT-EXIST').expect(404);
  });

  it('GET /api/batches lists every batch and honors the lineId / state filters', async () => {
    const all = await req().get('/api/batches').expect(200);
    const summaries = all.body as Array<Record<string, any>>;
    expect(summaries.length).toBeGreaterThanOrEqual(8);
    expect(summaries.map((b) => b.batchId)).toContain('BATCH-0007');

    const lineB = await req().get('/api/batches').query({ lineId: 'LINE-B' }).expect(200);
    expect((lineB.body as Array<Record<string, any>>).every((b) => b.lineId === 'LINE-B')).toBe(true);
    expect((lineB.body as Array<Record<string, any>>).map((b) => b.batchId)).toContain('BATCH-0007');

    const blocked = await req().get('/api/batches').query({ state: BatchState.BLOCKED }).expect(200);
    expect((blocked.body as Array<Record<string, any>>).every((b) => b.state === BatchState.BLOCKED)).toBe(true);
    expect((blocked.body as Array<Record<string, any>>).map((b) => b.batchId)).toContain('BATCH-0007');

    await req().get('/api/batches').query({ state: 'NONSENSE' }).expect(400);
  });

  it('GET /api/batches/BATCH-0007 carries the seeded BLOCK with org/actor and is BLOCKED', async () => {
    const res = await req().get('/api/batches/BATCH-0007').expect(200);
    expect(res.body.batchId).toBe('BATCH-0007');
    expect(res.body.lineId).toBe('LINE-B');
    expect(Array.isArray(res.body.timeline)).toBe(true);
    expect(Array.isArray(res.body.managementEvents)).toBe(true);

    const block = (res.body.managementEvents as Array<Record<string, any>>).find(
      (m) => m.type === ManagementEventType.BLOCK,
    );
    expect(block).toBeDefined();
    expect(block!.organizationId).toBe(seedOrg);
    expect(block!.actor).toBe(seedActor);
    expect(typeof block!.note).toBe('string');
    expect(res.body.state).toBe(BatchState.BLOCKED);

    seededBlockId = block!.id;
    seededBlockCreatedAt = block!.createdAt;
    mgmtBaseline = (res.body.managementEvents as unknown[]).length;
  });

  it('canonical timelines retain provenance, a late event, and a superseded duplicate', async () => {
    const list = await req().get('/api/batches').expect(200);
    const details: Array<Record<string, any>> = [];
    for (const b of list.body as Array<{ batchId: string }>) {
      const detail = await req().get(`/api/batches/${b.batchId}`).expect(200);
      details.push(detail.body);
    }
    const entries = details.flatMap((d) => d.timeline as Array<Record<string, any>>);
    expect(entries.length).toBeGreaterThan(0);

    expect(
      entries.every(
        (e) =>
          e.provenance &&
          typeof e.provenance.observationId === 'string' &&
          e.provenance.observationId.length > 0 &&
          typeof e.provenance.sourceId === 'string' &&
          e.provenance.sourceId.length > 0 &&
          typeof e.provenance.runId === 'string' &&
          e.provenance.runId.length > 0 &&
          typeof e.provenance.sourceRecordId === 'string' &&
          e.provenance.sourceRecordId.length > 0,
      ),
    ).toBe(true);

    expect(entries.some((e) => e.late === true)).toBe(true);

    expect(
      entries.some(
        (e) => Array.isArray(e.provenance.supersededObservationIds) && e.provenance.supersededObservationIds.length > 0,
      ),
    ).toBe(true);
  });

  it('management actions append-only, recompute state, and carry seeded org/actor/timestamp', async () => {
    const resume = await req().post('/api/batches/BATCH-0007/resume').send({ note: 'e2e resume' }).expect(200);
    expect(resume.body.state).not.toBe(BatchState.BLOCKED);
    const afterResume = resume.body.managementEvents as Array<Record<string, any>>;
    expect(afterResume).toHaveLength(mgmtBaseline + 1);
    const resumeEvent = afterResume[afterResume.length - 1];
    expect(resumeEvent.type).toBe(ManagementEventType.RESUME);
    expect(resumeEvent.note).toBe('e2e resume');
    expect(resumeEvent.organizationId).toBe(seedOrg);
    expect(resumeEvent.actor).toBe(seedActor);
    expect(typeof resumeEvent.createdAt).toBe('string');

    const block = await req().post('/api/batches/BATCH-0007/block').send({ note: 'e2e block' }).expect(200);
    expect(block.body.state).toBe(BatchState.BLOCKED);
    expect(block.body.managementEvents).toHaveLength(mgmtBaseline + 2);

    const ack = await req().post('/api/batches/BATCH-0007/acknowledge').send({}).expect(200);
    expect(ack.body.managementEvents).toHaveLength(mgmtBaseline + 3);
    expect((ack.body.managementEvents as Array<Record<string, any>>).at(-1)!.type).toBe(
      ManagementEventType.ACKNOWLEDGE,
    );

    const note = await req().post('/api/batches/BATCH-0007/note').send({ note: 'e2e note' }).expect(200);
    expect(note.body.managementEvents).toHaveLength(mgmtBaseline + 4);
    expect((note.body.managementEvents as Array<Record<string, any>>).at(-1)!.type).toBe(ManagementEventType.NOTE);

    await req().post('/api/batches/BATCH-0007/note').send({}).expect(400);

    const final = await req().get('/api/batches/BATCH-0007').expect(200);
    const events = final.body.managementEvents as Array<Record<string, any>>;
    expect(events).toHaveLength(mgmtBaseline + 4);
    const original = events.find((e) => e.id === seededBlockId);
    expect(original).toBeDefined();
    expect(original!.type).toBe(ManagementEventType.BLOCK);
    expect(original!.createdAt).toBe(seededBlockCreatedAt);
    for (const e of events) {
      expect(e.organizationId).toBe(seedOrg);
      expect(e.actor).toBe(seedActor);
      expect(typeof e.createdAt).toBe('string');
    }
  });

  it('no source endpoint ever leaks the stored secret', async () => {
    const list = await req().get('/api/sources').expect(200);
    expect(JSON.stringify(list.body)).not.toContain(RO_PASSWORD);
    for (const s of list.body as Array<Record<string, any>>) expect(s).not.toHaveProperty('secret');

    const one = await req().get(`/api/sources/${dbSourceId}`).expect(200);
    expect(one.body.hasSecret).toBe(true);
    expect(one.body).not.toHaveProperty('secret');
    expect(JSON.stringify(one.body)).not.toContain(RO_PASSWORD);
  });
});
