import { IRevertService, RevertOptions } from '../interfaces/revert-service.interface.js';

export class RevertService implements IRevertService {
  async execute(options: RevertOptions): Promise<void> {
    console.log("--- DHIS2 Dataset Value Revert ---");
    if (options.baseUrl) {
      console.log(`Base URL:       ${options.baseUrl}`);
    }
    if (options.parentOrgUnit) {
      console.log(`Parent OrgUnit: ${options.parentOrgUnit}`);
    }
    if (options.dataSet) {
      console.log(`DataSet ID:     ${options.dataSet}`);
    }
    if (options.periods && options.periods.length > 0) {
      console.log(`Periods:        ${options.periods.join(", ")}`);
    }
    console.log("\n[Revert] Process initiated. Reverting dataset changes to previous values...\n");
  }
}
