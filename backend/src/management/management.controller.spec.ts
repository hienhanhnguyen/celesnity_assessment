import {
  ManagementActionDto,
  ManagementController,
  ManagementNoteDto,
} from './management.controller';
import type { ManagementService } from './management.service';
import type { BatchDetail } from '../production/production.types';

type ServiceMock = jest.Mocked<
  Pick<ManagementService, 'acknowledge' | 'block' | 'resume' | 'note'>
>;

const detail = {} as BatchDetail;

describe('ManagementController (delegation)', () => {
  let service: ServiceMock;
  let controller: ManagementController;

  beforeEach(() => {
    service = {
      acknowledge: jest.fn().mockResolvedValue(detail),
      block: jest.fn().mockResolvedValue(detail),
      resume: jest.fn().mockResolvedValue(detail),
      note: jest.fn().mockResolvedValue(detail),
    };
    controller = new ManagementController(service as unknown as ManagementService);
  });

  const action = (note?: string): ManagementActionDto => Object.assign(new ManagementActionDto(), { note });

  it('POST :id/acknowledge passes the id and note through', async () => {
    await expect(controller.acknowledge('BATCH-0001', action('seen'))).resolves.toBe(detail);
    expect(service.acknowledge).toHaveBeenCalledWith('BATCH-0001', 'seen');
  });

  it('POST :id/block coerces an absent note to null', async () => {
    await expect(controller.block('BATCH-0001', action())).resolves.toBe(detail);
    expect(service.block).toHaveBeenCalledWith('BATCH-0001', null);
  });

  it('POST :id/resume coerces an absent note to null', async () => {
    await controller.resume('BATCH-0001', action());
    expect(service.resume).toHaveBeenCalledWith('BATCH-0001', null);
  });

  it('POST :id/block forwards a provided note', async () => {
    await controller.block('BATCH-0001', action('jam'));
    expect(service.block).toHaveBeenCalledWith('BATCH-0001', 'jam');
  });

  it('POST :id/note forwards the required note verbatim', async () => {
    const dto = Object.assign(new ManagementNoteDto(), { note: 'call maintenance' });
    await expect(controller.note('BATCH-0001', dto)).resolves.toBe(detail);
    expect(service.note).toHaveBeenCalledWith('BATCH-0001', 'call maintenance');
  });
});
