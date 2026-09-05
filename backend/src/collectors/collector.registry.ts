import { Injectable } from '@nestjs/common';
import { SourceType } from '../common/domain/enums';
import { ApiCollector } from './api.collector';
import { CrawlerCollector } from './crawler.collector';
import { DatabaseCollector } from './database.collector';
import type { SourceCollector } from './collector.types';

@Injectable()
export class CollectorRegistry {
  private readonly byType = new Map<SourceType, SourceCollector>();

  constructor(api: ApiCollector, crawler: CrawlerCollector, database: DatabaseCollector) {
    for (const collector of [api, crawler, database]) {
      this.byType.set(collector.type, collector);
    }
  }

  get(type: SourceType): SourceCollector {
    const collector = this.byType.get(type);
    if (!collector) {
      throw new Error(`No collector registered for source type "${type}"`);
    }
    return collector;
  }

  has(type: SourceType): boolean {
    return this.byType.has(type);
  }

  supportedTypes(): SourceType[] {
    return [...this.byType.keys()];
  }
}
