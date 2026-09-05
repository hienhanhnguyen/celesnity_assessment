import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { TypeOrmManagementStore } from './management.store';
import { MANAGEMENT_STORE } from './management.types';

@Module({
  imports: [ProductionModule],
  controllers: [ManagementController],
  providers: [ManagementService, { provide: MANAGEMENT_STORE, useClass: TypeOrmManagementStore }],
  exports: [ManagementService],
})
export class ManagementModule {}
