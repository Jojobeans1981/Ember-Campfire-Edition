import type { UfliProgress } from '../../domain/types';

import { deriveXp } from '../../domain/services';

export class XpDerivationService {
  public derive(ufliProgress: UfliProgress): number {
    return deriveXp(ufliProgress);
  }
}
