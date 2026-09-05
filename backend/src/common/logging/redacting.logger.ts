import { ConsoleLogger, Injectable } from '@nestjs/common';
import { redact } from './redaction';

@Injectable()
export class RedactingLogger extends ConsoleLogger {
  private scrubParams(params: unknown[]): unknown[] {
    return params.map((p) => redact(p));
  }

  override log(message: any, ...params: any[]): void {
    super.log(redact(message), ...this.scrubParams(params));
  }

  override error(message: any, ...params: any[]): void {
    super.error(redact(message), ...this.scrubParams(params));
  }

  override warn(message: any, ...params: any[]): void {
    super.warn(redact(message), ...this.scrubParams(params));
  }

  override debug(message: any, ...params: any[]): void {
    super.debug(redact(message), ...this.scrubParams(params));
  }

  override verbose(message: any, ...params: any[]): void {
    super.verbose(redact(message), ...this.scrubParams(params));
  }
}
