import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { RedactingLogger } from './logging/redacting.logger';
import { CLOCK, SystemClock } from './time/clock';

@Global()
@Module({
  providers: [CryptoService, RedactingLogger, { provide: CLOCK, useClass: SystemClock }],
  exports: [CryptoService, RedactingLogger, CLOCK],
})
export class CommonModule {}
