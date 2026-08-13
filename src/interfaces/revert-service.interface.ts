import { DataValueImportSummary } from '../types/dhis2.js';

export interface RevertOptions {
  parentOrgUnit?: string;
  dataSet?: string;
  periods?: string[];
  output?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  patToken?: string;
  dryRun?: boolean;
}

export interface RevertResult {
  totalReverted: number;
  orgUnitsProcessed: number;
  status: string;
  importSummary?: DataValueImportSummary;
}

export interface IRevertService {
  execute(options: RevertOptions): Promise<RevertResult>;
}
