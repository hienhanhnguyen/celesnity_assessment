import { Test } from '@nestjs/testing';
import { SourceType } from '../common/domain/enums';
import { ApiCollector } from './api.collector';
import { CrawlerCollector } from './crawler.collector';
import { DatabaseCollector } from './database.collector';
import { CollectorRegistry } from './collector.registry';
import { CollectorsModule } from './collectors.module';

describe('CollectorsModule (DI wiring)', () => {
  it('boots the module and resolves the registry with every collector', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CollectorsModule],
    }).compile();

    const registry = moduleRef.get(CollectorRegistry);

    expect(registry.get(SourceType.API)).toBeInstanceOf(ApiCollector);
    expect(registry.get(SourceType.CRAWLER)).toBeInstanceOf(CrawlerCollector);
    expect(registry.get(SourceType.DATABASE)).toBeInstanceOf(DatabaseCollector);

    expect(registry.supportedTypes().sort()).toEqual(
      [SourceType.API, SourceType.CRAWLER, SourceType.DATABASE].sort(),
    );
    expect(registry.has(SourceType.API)).toBe(true);

    await moduleRef.close();
  });

  it('throws for a source type with no registered collector', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CollectorsModule],
    }).compile();

    const registry = moduleRef.get(CollectorRegistry);
    expect(() => registry.get('SFTP' as SourceType)).toThrow(/No collector registered/);

    await moduleRef.close();
  });
});
