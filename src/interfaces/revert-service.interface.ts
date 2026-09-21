import { DataValueImportSummary } from '../types/dhis2.js';

export interface RevertOptions {
  parentOrgUnit?: string | string[];
  dataSet?: string;
  periods?: string[];
  output?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  patToken?: string;
  dryRun?: boolean;
  lastUpdated?: string;
  level?: number;
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
