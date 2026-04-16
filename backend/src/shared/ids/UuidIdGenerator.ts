import type { IdGenerator } from './IdGenerator';

export class UuidIdGenerator implements IdGenerator {
  public generate(): string {
    return crypto.randomUUID();
  }
}
