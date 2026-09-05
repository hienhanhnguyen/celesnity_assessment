import { Module } from '@nestjs/common';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';
import { TypeOrmObservationsStore } from './observations.store';
import { OBSERVATIONS_STORE } from './observations.types';

@Module({
  controllers: [ObservationsController],
  providers: [ObservationsService, { provide: OBSERVATIONS_STORE, useClass: TypeOrmObservationsStore }],
  exports: [ObservationsService],
})
export class ObservationsModule {}
