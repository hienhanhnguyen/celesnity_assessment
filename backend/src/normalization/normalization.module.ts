import { Module } from '@nestjs/common';
import { NormalizationService } from './normalization.service';
import { TypeOrmNormalizationStore } from './normalization.store';
import { NORMALIZATION_STORE } from './normalization.types';

@Module({
  providers: [NormalizationService, { provide: NORMALIZATION_STORE, useClass: TypeOrmNormalizationStore }],
  exports: [NormalizationService],
})
export class NormalizationModule {}
