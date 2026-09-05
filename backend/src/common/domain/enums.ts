export enum SourceType {
  API = 'API',
  CRAWLER = 'CRAWLER',
  DATABASE = 'DATABASE',
  MQTT = 'MQTT',
}

export enum SourceStatus {
  REGISTERED = 'REGISTERED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

// state of a collection run. PARTIAL = complete with non fatal errors
export enum RunStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export enum CollectionErrorKind {
  FETCH = 'FETCH',
  TIMEOUT = 'TIMEOUT',
  PARSE = 'PARSE',
  MALFORMED_ROW = 'MALFORMED_ROW',
  CONNECTION = 'CONNECTION',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN',
}

export enum CanonicalStatus {
  ACCEPTED = 'ACCEPTED',
}
export enum BatchState {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
}

export enum ManagementEventType {
  ACKNOWLEDGE = 'ACKNOWLEDGE',
  BLOCK = 'BLOCK',
  RESUME = 'RESUME',
  NOTE = 'NOTE',
}
