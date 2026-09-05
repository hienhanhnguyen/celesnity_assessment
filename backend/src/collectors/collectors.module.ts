import { Module } from '@nestjs/common';
import { ApiCollector } from './api.collector';
import { CrawlerCollector } from './crawler.collector';
import { DatabaseCollector } from './database.collector';
import { CollectorRegistry } from './collector.registry';

@Module({
  providers: [
    { provide: ApiCollector, useFactory: () => new ApiCollector() },
    { provide: CrawlerCollector, useFactory: () => new CrawlerCollector() },
    { provide: DatabaseCollector, useFactory: () => new DatabaseCollector() },
    CollectorRegistry,
  ],
  exports: [CollectorRegistry, ApiCollector, CrawlerCollector, DatabaseCollector],
})
export class CollectorsModule {}
