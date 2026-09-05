import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { TypeOrmProductionStore } from './production.store';
import { PRODUCTION_STORE } from './production.types';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, { provide: PRODUCTION_STORE, useClass: TypeOrmProductionStore }],
  exports: [ProductionService],
})
export class ProductionModule {}
