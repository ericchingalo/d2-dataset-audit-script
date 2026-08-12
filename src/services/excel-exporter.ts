import ExcelJS from 'exceljs';
import { IReportExporter } from '../interfaces/report-exporter.interface.js';
import { MergedAuditRow } from '../types/dhis2.js';

/**
 * Sanitize sheet name to adhere to Excel's 31-character limit, invalid character restrictions,
 * and uniqueness within the workbook.
 */
export function sanitizeSheetName(rawName: string, existingNames: Set<string>): string {
  // Remove invalid characters \ / ? * : [ ]
  let cleaned = rawName.replace(/[\\/?*:[\]]/g, ' ').trim();
  if (!cleaned) {
    cleaned = 'Sheet';
  }

  // Max length is 31 chars. Reserve space for suffix if needed
  let nameCandidate = cleaned.substring(0, 31);
  let counter = 1;

  while (existingNames.has(nameCandidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxBaseLen = 31 - suffix.length;
    nameCandidate = `${cleaned.substring(0, maxBaseLen)}${suffix}`;
    counter++;
  }

  existingNames.add(nameCandidate.toLowerCase());
  return nameCandidate;
}

export class ExcelExporter implements IReportExporter {
  async exportReport(
    districtDataMap: Map<string, MergedAuditRow[]>,
    outputPath: string
  ): Promise<void> {
    await generateExcelReport(districtDataMap, outputPath);
  }
}

export async function generateExcelReport(
  districtDataMap: Map<string, MergedAuditRow[]>,
  outputPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DHIS2 Dataset Audit Tool';
  workbook.lastModifiedBy = 'DHIS2 Dataset Audit Tool';
  workbook.created = new Date();

  const existingSheetNames = new Set<string>();

  // If map is empty, create a dummy empty sheet
  if (districtDataMap.size === 0) {
    const sheet = workbook.addWorksheet('No Data');
    sheet.addRow(['No modified data values found for the specified parameters.']);
  } else {
    for (const [districtName, rows] of districtDataMap.entries()) {
      const sheetName = sanitizeSheetName(districtName, existingSheetNames);
      const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      // Calculate maximum history depth for this district
      let maxHistoryDepth = 0;
      for (const row of rows) {
        if (row.history && row.history.length > maxHistoryDepth) {
          maxHistoryDepth = row.history.length;
        }
      }

      // Build Header Columns
      const headers = [
        'Data Element',
        'Disaggregation',
        'Period',
        'Current Value',
        'Modified By',
        'Last Updated',
      ];

      for (let i = 1; i <= maxHistoryDepth; i++) {
        headers.push(`Previous Value ${i}`, `Edited By (Prev ${i})`, `Date (Prev ${i})`);
      }

      const headerRow = worksheet.addRow(headers);

      // Header Row Styling
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '1F4E78' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D9D9D9' } },
          left: { style: 'thin', color: { argb: 'D9D9D9' } },
          bottom: { style: 'medium', color: { argb: '1F4E78' } },
          right: { style: 'thin', color: { argb: 'D9D9D9' } },
        };
      });
      headerRow.height = 28;

      // Populate Data Rows
      for (const row of rows) {
        const rowValues: (string | number)[] = [
          row.dataElementName,
          row.disaggregationName,
          row.period,
          row.currentValue,
          row.modifiedBy,
          row.lastUpdated,
        ];

        // Add history columns
        for (let i = 0; i < maxHistoryDepth; i++) {
          const historyEntry = row.history[i];
          if (historyEntry) {
            rowValues.push(historyEntry.value, historyEntry.editedBy, historyEntry.created);
          } else {
            rowValues.push('', '', '');
          }
        }

        const dataRow = worksheet.addRow(rowValues);
        dataRow.height = 20;

        dataRow.eachCell((cell) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'F0F0F0' } },
            left: { style: 'thin', color: { argb: 'F0F0F0' } },
            bottom: { style: 'thin', color: { argb: 'F0F0F0' } },
            right: { style: 'thin', color: { argb: 'F0F0F0' } },
          };
        });
      }

      // Auto-fit Column Widths
      worksheet.columns.forEach((column) => {
        let maxLen = 12;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const val = cell.value ? cell.value.toString() : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        column.width = Math.min(maxLen + 4, 50);
      });
    }
  }

  await workbook.xlsx.writeFile(outputPath);
}
