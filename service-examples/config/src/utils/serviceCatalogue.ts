import { logger } from '@latcher/base';

// Stands in for a service catalogue API. Both calls are async, as a real lookup would be.
const decommissioned = new Set(['legacy-invoice-export']);

export const serviceCatalogue = {
  async isDecommissioned(functionName: string): Promise<boolean> {
    return decommissioned.has(functionName);
  },

  async register(functionName: string, description: string): Promise<void> {
    logger.info({ message: 'Registered in service catalogue', functionName, description });
  },
};
