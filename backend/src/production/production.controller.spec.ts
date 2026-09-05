import { BatchState } from '../common/domain/enums';
import { BatchListQuery, ProductionController } from './production.controller';
import type { ProductionService } from './production.service';

type ServiceMock = jest.Mocked<
  Pick<ProductionService, 'getConfig' | 'getLines' | 'getLine' | 'getBatches' | 'getBatch'>
>;

describe('ProductionController (delegation)', () => {
  let service: ServiceMock;
  let controller: ProductionController;

  beforeEach(() => {
    service = {
      getConfig: jest.fn(),
      getLines: jest.fn(),
      getLine: jest.fn(),
      getBatches: jest.fn(),
      getBatch: jest.fn(),
    };
    controller = new ProductionController(service as unknown as ProductionService);
  });

  it('GET /config returns the service config verbatim', () => {
    const cfg = { staleThresholdMinutes: 15 } as ReturnType<ProductionService['getConfig']>;
    service.getConfig.mockReturnValue(cfg);
    expect(controller.getConfig()).toBe(cfg);
  });

  it('GET /lines delegates', async () => {
    const lines = [] as Awaited<ReturnType<ProductionService['getLines']>>;
    service.getLines.mockResolvedValue(lines);
    await expect(controller.getLines()).resolves.toBe(lines);
  });

  it('GET /lines/:id passes the id param', async () => {
    const line = {} as Awaited<ReturnType<ProductionService['getLine']>>;
    service.getLine.mockResolvedValue(line);
    await expect(controller.getLine('LINE-A')).resolves.toBe(line);
    expect(service.getLine).toHaveBeenCalledWith('LINE-A');
  });

  it('GET /batches maps the query DTO to a filter', async () => {
    service.getBatches.mockResolvedValue([]);
    const query = Object.assign(new BatchListQuery(), { lineId: 'LINE-B', state: BatchState.IN_PROGRESS });
    await controller.getBatches(query);
    expect(service.getBatches).toHaveBeenCalledWith({ lineId: 'LINE-B', state: BatchState.IN_PROGRESS });
  });

  it('GET /batches with no filters passes undefined through', async () => {
    service.getBatches.mockResolvedValue([]);
    await controller.getBatches(new BatchListQuery());
    expect(service.getBatches).toHaveBeenCalledWith({ lineId: undefined, state: undefined });
  });

  it('GET /batches/:id passes the id param', async () => {
    const detail = {} as Awaited<ReturnType<ProductionService['getBatch']>>;
    service.getBatch.mockResolvedValue(detail);
    await expect(controller.getBatch('BATCH-0001')).resolves.toBe(detail);
    expect(service.getBatch).toHaveBeenCalledWith('BATCH-0001');
  });
});
