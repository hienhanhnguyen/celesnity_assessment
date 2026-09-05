import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { CollectorsModule } from '../collectors/collectors.module';
import { NormalizationModule } from '../normalization/normalization.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';
import { TypeOrmRunsStore, TypeOrmSourcesStore } from './sources.store';
import { RUNS_STORE, SOURCES_STORE } from './sources.types';

@Module({
  imports: [CollectorsModule, CollectionModule, NormalizationModule],
  controllers: [SourcesController, RunsController],
  providers: [
    SourcesService,
    RunsService,
    { provide: SOURCES_STORE, useClass: TypeOrmSourcesStore },
    { provide: RUNS_STORE, useClass: TypeOrmRunsStore },
  ],
  exports: [SourcesService],
})
export class SourcesModule {}
