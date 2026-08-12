import { MergedAuditRow } from '../types/dhis2.js';

export interface IReportExporter {
  exportReport(
    districtDataMap: Map<string, MergedAuditRow[]>,
    outputPath: string
  ): Promise<void>;
}
