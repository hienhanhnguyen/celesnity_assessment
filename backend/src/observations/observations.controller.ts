import { Controller, Get, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import { ObservationsService } from './observations.service';
import type { NormalizedRecordView } from './observations.types';

export class ObservationsQuery {
  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsEnum(Station)
  station?: Station;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;
}

@Controller('observations')
export class ObservationsController {
  constructor(private readonly observations: ObservationsService) {}

  @Get()
  list(@Query() query: ObservationsQuery): Promise<NormalizedRecordView[]> {
    return this.observations.list({
      batchId: query.batchId,
      station: query.station,
      lineId: query.lineId,
      sourceType: query.sourceType,
    });
  }
}
