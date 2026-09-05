import type { RunView } from '../collection/collection.types';
import { SourceType } from '../common/domain/enums';
import { RunListQuery, RunsController } from './runs.controller';
import type { RunsService } from './runs.service';
import { RegisterSourceDto, SourcesController, UpdateSelectionDto } from './sources.controller';
import type { SourcesService } from './sources.service';
import type { SourceView } from './sources.types';

const sourceView = {} as SourceView;
const runView = {} as RunView;

describe('SourcesController (delegation)', () => {
  let service: jest.Mocked<
    Pick<SourcesService, 'register' | 'list' | 'get' | 'test' | 'discover' | 'updateSelection' | 'collect'>
  >;
  let controller: SourcesController;

  beforeEach(() => {
    service = {
      register: jest.fn().mockResolvedValue(sourceView),
      list: jest.fn().mockResolvedValue([sourceView]),
      get: jest.fn().mockResolvedValue(sourceView),
      test: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
      discover: jest.fn().mockResolvedValue({ entities: [] }),
      updateSelection: jest.fn().mockResolvedValue(sourceView),
      collect: jest.fn().mockResolvedValue(runView),
    };
    controller = new SourcesController(service as unknown as SourcesService);
  });

  it('POST /sources maps the DTO to an input, defaulting selection + secret to null', async () => {
    const dto = Object.assign(new RegisterSourceDto(), {
      type: SourceType.API,
      name: 'App API',
      config: { baseUrl: 'http://x' },
    });
    await expect(controller.register(dto)).resolves.toBe(sourceView);
    expect(service.register).toHaveBeenCalledWith({
      type: SourceType.API,
      name: 'App API',
      config: { baseUrl: 'http://x' },
      selection: null,
      secret: null,
    });
  });

  it('POST /sources forwards a provided selection + secret', async () => {
    const dto = Object.assign(new RegisterSourceDto(), {
      type: SourceType.DATABASE,
      name: 'Factory DB',
      config: { host: 'h' },
      selection: { table: 't' },
      secret: 'pw',
    });
    await controller.register(dto);
    expect(service.register).toHaveBeenCalledWith({
      type: SourceType.DATABASE,
      name: 'Factory DB',
      config: { host: 'h' },
      selection: { table: 't' },
      secret: 'pw',
    });
  });

  it('GET /sources and GET /sources/:id delegate', async () => {
    await expect(controller.list()).resolves.toEqual([sourceView]);
    await expect(controller.get('src-1')).resolves.toBe(sourceView);
    expect(service.get).toHaveBeenCalledWith('src-1');
  });

  it('POST /sources/:id/test and GET /sources/:id/discover delegate by id', async () => {
    await controller.test('src-1');
    await controller.discover('src-1');
    expect(service.test).toHaveBeenCalledWith('src-1');
    expect(service.discover).toHaveBeenCalledWith('src-1');
  });

  it('PATCH /sources/:id/selection passes the selection through', async () => {
    const dto = Object.assign(new UpdateSelectionDto(), { selection: { table: 't' } });
    await controller.updateSelection('src-1', dto);
    expect(service.updateSelection).toHaveBeenCalledWith('src-1', { table: 't' });
  });

  it('POST /sources/:id/collect delegates and returns the run', async () => {
    await expect(controller.collect('src-1')).resolves.toBe(runView);
    expect(service.collect).toHaveBeenCalledWith('src-1');
  });
});

describe('RunsController (delegation)', () => {
  let service: jest.Mocked<Pick<RunsService, 'list' | 'get'>>;
  let controller: RunsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue([runView]),
      get: jest.fn().mockResolvedValue(runView),
    };
    controller = new RunsController(service as unknown as RunsService);
  });

  it('GET /collection-runs coerces an absent sourceId to null', async () => {
    await controller.list(Object.assign(new RunListQuery(), {}));
    expect(service.list).toHaveBeenCalledWith(null);
  });

  it('GET /collection-runs?sourceId= forwards the filter', async () => {
    await controller.list(Object.assign(new RunListQuery(), { sourceId: 'src-1' }));
    expect(service.list).toHaveBeenCalledWith('src-1');
  });

  it('GET /collection-runs/:id delegates', async () => {
    await expect(controller.get('run-1')).resolves.toBe(runView);
    expect(service.get).toHaveBeenCalledWith('run-1');
  });
});
