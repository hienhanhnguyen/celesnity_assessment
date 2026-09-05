import { Module } from '@nestjs/common';
import { CollectionModule } from './collection/collection.module';
import { CollectorsModule } from './collectors/collectors.module';
import { CommonModule } from './common/common.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ManagementModule } from './management/management.module';
import { NormalizationModule } from './normalization/normalization.module';
import { ObservationsModule } from './observations/observations.module';
import { ProductionModule } from './production/production.module';
import { SeedModule } from './seed/seed.module';
import { SourcesModule } from './sources/sources.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    DatabaseModule,
    CollectorsModule,
    CollectionModule,
    NormalizationModule,
    ProductionModule,
    ManagementModule,
    SourcesModule,
    ObservationsModule,
    SeedModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
