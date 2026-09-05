import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import {
  buildSeedSources,
  SEED_BATCHES,
  SEED_MANAGEMENT_EVENTS,
  SEED_WORK_ORDERS,
} from './seed.catalog';
import { SEED_STORE, type SeedStore } from './seed.types';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @Inject(SEED_STORE) private readonly store: SeedStore,
    private readonly config: AppConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    await this.store.upsertWorkOrders(SEED_WORK_ORDERS);
    await this.store.upsertBatches(SEED_BATCHES);
    await this.seedSources();
    await this.seedManagementEvents();
    this.logger.log(
      `Seed complete: ${SEED_WORK_ORDERS.length} work orders, ${SEED_BATCHES.length} batches, ` +
        `pre-registered API + crawler sources`,
    );
  }

  private async seedSources(): Promise<void> {
    const { appApiBaseUrl, supplierCrawlerBaseUrl } = this.config.sources;
    const sources = buildSeedSources(appApiBaseUrl, supplierCrawlerBaseUrl);

    for (const source of sources) {
      if (await this.store.sourceExists(source.name)) continue;
      await this.store.insertSource(source);
      this.logger.log(`Pre-registered ${source.type} source "${source.name}"`);
    }
  }

  private async seedManagementEvents(): Promise<void> {
    const { seedOrgId, seedActor } = this.config.domain;
    for (const event of SEED_MANAGEMENT_EVENTS) {
      if (await this.store.managementEventExists(event.batchId, event.type)) continue;
      await this.store.insertManagementEvent({
        batchId: event.batchId,
        type: event.type,
        organizationId: seedOrgId,
        actor: seedActor,
        note: event.note,
      });
      this.logger.log(`Seeded ${event.type} on ${event.batchId}`);
    }
  }
}
