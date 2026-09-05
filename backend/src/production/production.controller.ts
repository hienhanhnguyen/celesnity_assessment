import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BatchState } from '../common/domain/enums';
import { ProductionService } from './production.service';
import type {
  BatchDetail,
  BatchSummary,
  ConfigView,
  LineView,
} from './production.types';

export class BatchListQuery {
  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsEnum(BatchState)
  state?: BatchState;
}

@Controller()
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('config')
  getConfig(): ConfigView {
    return this.production.getConfig();
  }

  @Get('lines')
  getLines(): Promise<LineView[]> {
    return this.production.getLines();
  }

  @Get('lines/:id')
  getLine(@Param('id') id: string): Promise<LineView> {
    return this.production.getLine(id);
  }

  @Get('batches')
  getBatches(@Query() query: BatchListQuery): Promise<BatchSummary[]> {
    return this.production.getBatches({ lineId: query.lineId, state: query.state });
  }

  @Get('batches/:id')
  getBatch(@Param('id') id: string): Promise<BatchDetail> {
    return this.production.getBatch(id);
  }
}
