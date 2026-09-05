import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { TypeOrmSeedStore } from './seed.store';
import { SEED_STORE } from './seed.types';

@Module({
  providers: [SeedService, { provide: SEED_STORE, useClass: TypeOrmSeedStore }],
  exports: [SeedService],
})
export class SeedModule {}
