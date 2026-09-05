import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CollectionService } from '../collection/collection.service';
import type { RunView } from '../collection/collection.types';
import { CollectorRegistry } from '../collectors/collector.registry';
import type { DiscoverResult, SourceContext, TestResult } from '../collectors/collector.types';
import { CryptoService } from '../common/crypto/crypto.service';
import type { SourceType } from '../common/domain/enums';
import { redactString } from '../common/logging/redaction';
import { CLOCK, type Clock } from '../common/time/clock';
import { NormalizationService } from '../normalization/normalization.service';
import {
  SOURCES_STORE,
  type NewSource,
  type SourceContextData,
  type SourceView,
  type SourcesStore,
} from './sources.types';

export interface RegisterSourceInput {
  type: SourceType;
  name: string;
  config: Record<string, unknown>;
  selection: Record<string, unknown> | null;
  secret: string | null;
}

@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @Inject(SOURCES_STORE) private readonly store: SourcesStore,
    private readonly registry: CollectorRegistry,
    private readonly crypto: CryptoService,
    private readonly collection: CollectionService,
    private readonly normalization: NormalizationService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(input: RegisterSourceInput): Promise<SourceView> {
    if (!this.registry.has(input.type)) {
      throw new BadRequestException(`Unsupported source type: ${input.type}`);
    }
    if (await this.store.existsByName(input.name)) {
      throw new ConflictException(`A source named "${input.name}" already exists`);
    }

    const hasSecret = typeof input.secret === 'string' && input.secret.length > 0;
    const secret = hasSecret ? this.crypto.encrypt(input.secret as string) : null;

    const toCreate: NewSource = {
      type: input.type,
      name: input.name,
      config: input.config ?? {},
      selection: input.selection ?? null,
      hasSecret,
      secret,
    };
    const view = await this.store.create(toCreate);
    this.logger.log(`Registered ${view.type} source "${view.name}" (${view.id}), hasSecret=${view.hasSecret}`);
    return view;
  }

  list(): Promise<SourceView[]> {
    return this.store.listViews();
  }

  async get(id: string): Promise<SourceView> {
    const view = await this.store.loadView(id);
    if (!view) throw new NotFoundException(`Source "${id}" not found`);
    return view;
  }

  async test(id: string): Promise<TestResult> {
    const ctx = await this.contextFor(id);
    const collector = this.registry.get(ctx.type);
    let result: TestResult;
    try {
      result = await collector.test(this.toRuntimeContext(ctx));
    } catch (err) {
      result = { ok: false, message: redactString(messageOf(err)) };
    }
    await this.store.markTested(id, this.clock.now(), result.ok ? null : result.message);
    return result;
  }

  async discover(id: string): Promise<DiscoverResult> {
    const ctx = await this.contextFor(id);
    const collector = this.registry.get(ctx.type);
    return collector.discover(this.toRuntimeContext(ctx));
  }

  async updateSelection(id: string, selection: Record<string, unknown> | null): Promise<SourceView> {
    const updated = await this.store.updateSelection(id, selection);
    if (!updated) throw new NotFoundException(`Source "${id}" not found`);
    return updated;
  }

  async collect(id: string): Promise<RunView> {
    await this.get(id);
    const run = await this.collection.collect(id, 'manual');
    const summary = await this.normalization.normalize();
    this.logger.log(
      `Collect for source ${id} → run ${run.id} (${run.status}); ` +
        `normalized ${summary.canonicalEvents} canonical events`,
    );
    return run;
  }

  private async contextFor(id: string): Promise<SourceContextData> {
    const ctx = await this.store.loadContext(id);
    if (!ctx) throw new NotFoundException(`Source "${id}" not found`);
    return ctx;
  }

  private toRuntimeContext(ctx: SourceContextData): SourceContext {
    const secret = ctx.secret ? this.crypto.decrypt(ctx.secret) : null;
    return { config: ctx.config, selection: ctx.selection, secret };
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
