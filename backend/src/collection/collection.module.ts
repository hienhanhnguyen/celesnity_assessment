import { Module } from '@nestjs/common';
import { CollectorsModule } from '../collectors/collectors.module';
import { CollectionService } from './collection.service';
import { TypeOrmCollectionStore } from './collection.store';
import { COLLECTION_STORE } from './collection.types';

@Module({
  imports: [CollectorsModule],
  providers: [CollectionService, { provide: COLLECTION_STORE, useClass: TypeOrmCollectionStore }],
  exports: [CollectionService],
})
export class CollectionModule {}
