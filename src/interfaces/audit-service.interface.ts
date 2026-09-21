export interface AuditOptions {
  parentOrgUnit: string | string[];
  dataSet: string;
  periods: string[];
  level?: number;
  output: string;
  baseUrl: string;
  username?: string;
  password?: string;
  patToken?: string;
}

export interface AuditResult {
  districtCount: number;
  totalAuditRows: number;
  outputPath: string;
}

export interface IAuditService {
  execute(options: AuditOptions): Promise<AuditResult>;
}
