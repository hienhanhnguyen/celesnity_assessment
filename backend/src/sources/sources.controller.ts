import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RunView } from '../collection/collection.types';
import type { DiscoverResult, TestResult } from '../collectors/collector.types';
import { SourceType } from '../common/domain/enums';
import { type RegisterSourceInput, SourcesService } from './sources.service';
import type { SourceView } from './sources.types';

const NAME_MAX = 128;
const SECRET_MAX = 4096;

export class RegisterSourceDto {
  @IsEnum(SourceType)
  type!: SourceType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_MAX)
  name!: string;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  selection?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(SECRET_MAX)
  secret?: string;
}

export class UpdateSelectionDto {
  @IsObject()
  selection!: Record<string, unknown>;
}

@Controller('sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Post()
  register(@Body() dto: RegisterSourceDto): Promise<SourceView> {
    const input: RegisterSourceInput = {
      type: dto.type,
      name: dto.name,
      config: dto.config,
      selection: dto.selection ?? null,
      secret: dto.secret ?? null,
    };
    return this.sources.register(input);
  }

  @Get()
  list(): Promise<SourceView[]> {
    return this.sources.list();
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<SourceView> {
    return this.sources.get(id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  test(@Param('id') id: string): Promise<TestResult> {
    return this.sources.test(id);
  }

  @Get(':id/discover')
  discover(@Param('id') id: string): Promise<DiscoverResult> {
    return this.sources.discover(id);
  }

  @Patch(':id/selection')
  updateSelection(@Param('id') id: string, @Body() dto: UpdateSelectionDto): Promise<SourceView> {
    return this.sources.updateSelection(id, dto.selection);
  }

  @Post(':id/collect')
  @HttpCode(HttpStatus.OK)
  collect(@Param('id') id: string): Promise<RunView> {
    return this.sources.collect(id);
  }
}
