import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Station } from '../../common/domain/station';
import { CollectionRun } from './collection-run.entity';
import { Source } from './source.entity';

@Index(['batchId', 'station'])
@Index(['sourceId', 'runId', 'sourceRecordId', 'station'], { unique: true })
@Entity('source_observations')
export class SourceObservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sourceId!: string;

  @ManyToOne(() => Source, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: Source;

  @Index()
  @Column({ type: 'uuid' })
  runId!: string;

  @ManyToOne(() => CollectionRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: CollectionRun;

  @Column({ type: 'varchar', length: 128 })
  sourceRecordId!: string;

  @Column({ type: 'varchar', length: 16 })
  station!: Station;

  @Column({ type: 'varchar', length: 64 })
  batchId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  workOrderId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lineId!: string | null;

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eventType!: string | null;

  @Column({ type: 'timestamptz' })
  eventTime!: Date;

  @Column({ type: 'jsonb' })
  rawPayload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  ingestedAt!: Date;
}
