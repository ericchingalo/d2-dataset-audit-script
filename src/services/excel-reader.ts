import ExcelJS from 'exceljs';

export interface ParsedAuditRow {
  orgUnitName: string;
  dataElementName: string;
  disaggregationName: string;
  period: string;
  currentValue: string;
  previousValue: string;
}

export async function readAuditReportExcel(filePath: string): Promise<ParsedAuditRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const results: ParsedAuditRow[] = [];

  workbook.eachSheet((worksheet) => {
    // Ignore dummy sheets like "No Data"
    if (worksheet.name.toLowerCase() === 'no data') {
      return;
    }

    const orgUnitName = worksheet.name;
    const headerRow = worksheet.getRow(1);

    let dataElementColIndex = -1;
    let disaggregationColIndex = -1;
    let periodColIndex = -1;
    let currentValueColIndex = -1;
    let previousValue1ColIndex = -1;

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.value ? String(cell.value).trim().toLowerCase() : '';
      if (headerText === 'data element') dataElementColIndex = colNumber;
      if (headerText === 'disaggregation') disaggregationColIndex = colNumber;
      if (headerText === 'period') periodColIndex = colNumber;
      if (headerText === 'current value') currentValueColIndex = colNumber;
      if (headerText === 'previous value 1') previousValue1ColIndex = colNumber;
    });

    if (
      dataElementColIndex === -1 ||
      disaggregationColIndex === -1 ||
      periodColIndex === -1 ||
      previousValue1ColIndex === -1
    ) {
      // Header missing expected columns
      return;
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const dataElementName = row.getCell(dataElementColIndex).value
        ? String(row.getCell(dataElementColIndex).value).trim()
        : '';
      const disaggregationName = row.getCell(disaggregationColIndex).value
        ? String(row.getCell(disaggregationColIndex).value).trim()
        : '';
      const period = row.getCell(periodColIndex).value
        ? String(row.getCell(periodColIndex).value).trim()
        : '';
      const currentValue = row.getCell(currentValueColIndex).value
        ? String(row.getCell(currentValueColIndex).value).trim()
        : '';
      const previousValueRaw = row.getCell(previousValue1ColIndex).value;

      const previousValue =
        previousValueRaw !== null && previousValueRaw !== undefined
          ? String(previousValueRaw).trim()
          : '';

      if (dataElementName && period && previousValue !== '') {
        results.push({
          orgUnitName,
          dataElementName,
          disaggregationName,
          period,
          currentValue,
          previousValue,
        });
      }
    });
  });

  return results;
}
