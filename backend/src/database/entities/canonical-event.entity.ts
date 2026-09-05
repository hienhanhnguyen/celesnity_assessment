import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CanonicalStatus, SourceType } from '../../common/domain/enums';
import { Station } from '../../common/domain/station';
import { SourceObservation } from './source-observation.entity';

@Index(['batchId', 'station'], { unique: true })
@Entity('canonical_events')
export class CanonicalEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  batchId!: string;

  @Column({ type: 'varchar', length: 16 })
  station!: Station;

  @Column({ type: 'uuid' })
  winningObservationId!: string;

  @ManyToOne(() => SourceObservation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'winning_observation_id' })
  winningObservation!: SourceObservation;

  @Column({ type: 'varchar', length: 16, default: CanonicalStatus.ACCEPTED })
  status!: CanonicalStatus;

  @Column({ type: 'varchar', length: 16 })
  sourceType!: SourceType;

  @Column({ type: 'int', nullable: true })
  quantity!: number | null;

  @Column({ type: 'timestamptz' })
  eventTime!: Date;

  @Column({ type: 'jsonb', default: [] })
  supersededObservationIds!: string[];

  @Column({ type: 'jsonb', default: [] })
  conflictFlags!: string[];

  @Column({ type: 'boolean', default: false })
  late!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  computedAt!: Date;
}
