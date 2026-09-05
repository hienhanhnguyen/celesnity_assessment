import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CollectionErrorKind } from '../../common/domain/enums';
import { CollectionRun } from './collection-run.entity';

// Non fatal problem happen during a run 
@Entity('collection_errors')
export class CollectionError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  runId!: string;

  @ManyToOne(() => CollectionRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: CollectionRun;

  @Column({ type: 'varchar', length: 24 })
  kind!: CollectionErrorKind;

  @Column({ type: 'text' })
  message!: string;

  // Where it happened
  @Column({ type: 'jsonb', nullable: true })
  context!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
