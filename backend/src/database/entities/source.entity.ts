import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SourceStatus, SourceType } from '../../common/domain/enums';

@Entity('sources')
export class Source {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: SourceType;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  name!: string;

  // Non secret connection info
  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  selection!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: SourceStatus.REGISTERED })
  status!: SourceStatus;

  @Column({ type: 'boolean', default: false })
  hasSecret!: boolean;

  @Exclude()
  @Column({ type: 'text', nullable: true, select: false })
  secretCiphertext!: string | null;

  @Exclude()
  @Column({ type: 'text', nullable: true, select: false })
  secretIv!: string | null;

  @Exclude()
  @Column({ type: 'text', nullable: true, select: false })
  secretAuthTag!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastTestedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
