import type { Clock } from './Clock';

export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }
}
