import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RunStatus } from '../../common/domain/enums';
import { Source } from './source.entity';

// One execution of collecting from a source
@Entity('collection_runs')
export class CollectionRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sourceId!: string;

  @ManyToOne(() => Source, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: Source;

  @Column({ type: 'varchar', length: 16, default: RunStatus.PENDING })
  status!: RunStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'int', default: 0 })
  fetched!: number;

  @Column({ type: 'int', default: 0 })
  normalized!: number;

  @Column({ type: 'int', default: 0 })
  duplicates!: number;

  @Column({ type: 'int', default: 0 })
  malformed!: number;

  @Column({ type: 'int', default: 0 })
  errors!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  trigger!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
