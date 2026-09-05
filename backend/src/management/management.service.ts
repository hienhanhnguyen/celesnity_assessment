import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ManagementEventType } from '../common/domain/enums';
import { AppConfigService } from '../config/app-config.service';
import { ProductionService } from '../production/production.service';
import type { BatchDetail } from '../production/production.types';
import { MANAGEMENT_STORE, type ManagementStore } from './management.types';

@Injectable()
export class ManagementService {
  constructor(
    @Inject(MANAGEMENT_STORE) private readonly store: ManagementStore,
    private readonly config: AppConfigService,
    private readonly production: ProductionService,
  ) {}

  acknowledge(batchId: string, note: string | null): Promise<BatchDetail> {
    return this.record(batchId, ManagementEventType.ACKNOWLEDGE, note);
  }

  block(batchId: string, note: string | null): Promise<BatchDetail> {
    return this.record(batchId, ManagementEventType.BLOCK, note);
  }

  resume(batchId: string, note: string | null): Promise<BatchDetail> {
    return this.record(batchId, ManagementEventType.RESUME, note);
  }

  note(batchId: string, note: string): Promise<BatchDetail> {
    return this.record(batchId, ManagementEventType.NOTE, note);
  }

  private async record(batchId: string, type: ManagementEventType, note: string | null): Promise<BatchDetail> {
    if (!(await this.store.batchExists(batchId))) {
      throw new NotFoundException(`Unknown batch: ${batchId}`);
    }
    const domain = this.config.domain;
    await this.store.append({
      batchId,
      type,
      organizationId: domain.seedOrgId,
      actor: domain.seedActor,
      note,
    });
    return this.production.getBatch(batchId);
  }
}
