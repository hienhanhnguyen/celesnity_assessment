import { Batch } from './batch.entity';
import { CanonicalEvent } from './canonical-event.entity';
import { CollectionError } from './collection-error.entity';
import { CollectionRun } from './collection-run.entity';
import { ManagementEvent } from './management-event.entity';
import { Source } from './source.entity';
import { SourceObservation } from './source-observation.entity';
import { WorkOrder } from './work-order.entity';

export { Batch, CanonicalEvent, CollectionError, CollectionRun, ManagementEvent, Source, SourceObservation, WorkOrder };

export const entities = [
  Source,
  CollectionRun,
  CollectionError,
  SourceObservation,
  CanonicalEvent,
  WorkOrder,
  Batch,
  ManagementEvent,
];
