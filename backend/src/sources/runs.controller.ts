import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { RunView } from '../collection/collection.types';
import { RunsService } from './runs.service';

export class RunListQuery {
  @IsOptional()
  @IsString()
  sourceId?: string;
}

@Controller('collection-runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get()
  list(@Query() query: RunListQuery): Promise<RunView[]> {
    return this.runs.list(query.sourceId ?? null);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<RunView> {
    return this.runs.get(id);
  }
}
