import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ManagementEventType } from '../../common/domain/enums';

@Index(['batchId', 'createdAt'])
@Entity('management_events')
export class ManagementEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  batchId!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: ManagementEventType;

  @Column({ type: 'varchar', length: 128 })
  organizationId!: string;

  @Column({ type: 'varchar', length: 128 })
  actor!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
