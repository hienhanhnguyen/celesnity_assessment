import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';

@Entity('batches')
export class Batch {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  batchId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  workOrderId!: string;

  @ManyToOne(() => WorkOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder!: WorkOrder;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  lineId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
