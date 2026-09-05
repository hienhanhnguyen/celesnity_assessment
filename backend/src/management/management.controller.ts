import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ManagementService } from './management.service';
import type { BatchDetail } from '../production/production.types';

const NOTE_MAX = 2000;

export class ManagementActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  note?: string;
}

export class ManagementNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTE_MAX)
  note!: string;
}

@Controller('batches')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(@Param('id') id: string, @Body() dto: ManagementActionDto): Promise<BatchDetail> {
    return this.management.acknowledge(id, dto.note ?? null);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  block(@Param('id') id: string, @Body() dto: ManagementActionDto): Promise<BatchDetail> {
    return this.management.block(id, dto.note ?? null);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  resume(@Param('id') id: string, @Body() dto: ManagementActionDto): Promise<BatchDetail> {
    return this.management.resume(id, dto.note ?? null);
  }

  @Post(':id/note')
  @HttpCode(HttpStatus.OK)
  note(@Param('id') id: string, @Body() dto: ManagementNoteDto): Promise<BatchDetail> {
    return this.management.note(id, dto.note);
  }
}
