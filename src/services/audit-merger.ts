import {
  DataValue,
  DataValueAudit,
  MergedAuditRow,
  HistoryEntry,
  OrganisationUnit,
} from '../types/dhis2.js';

export function extractId(val: string | { id: string } | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.id || '';
}

export function mergeAuditData(
  dataValues: DataValue[],
  audits: DataValueAudit[],
  dataElementNames: Record<string, string>,
  cocNames: Record<string, string>,
  orgUnit: OrganisationUnit
): MergedAuditRow[] {
  // Map current data values by key: dataElement:categoryOptionCombo:period
  const currentValuesMap = new Map<string, DataValue>();
  for (const dv of dataValues) {
    const key = `${dv.dataElement}:${dv.categoryOptionCombo || 'default'}:${dv.period}`;
    currentValuesMap.set(key, dv);
  }

  // Filter audits for UPDATE audit types only
  const updateAudits = audits.filter((a) => a.auditType === 'UPDATE');

  // Group audits by cell key
  const auditGroups = new Map<string, DataValueAudit[]>();
  for (const audit of updateAudits) {
    const deId = extractId(audit.dataElement);
    const cocId = extractId(audit.categoryOptionCombo) || 'default';
    const period = extractId(audit.period);
    const key = `${deId}:${cocId}:${period}`;

    if (!auditGroups.has(key)) {
      auditGroups.set(key, []);
    }
    auditGroups.get(key)!.push(audit);
  }

  const resultRows: MergedAuditRow[] = [];

  // Build merged rows for keys that have update audit records
  for (const [key, cellAudits] of auditGroups.entries()) {
    const [deId, cocId, period] = key.split(':');
    const currentValueObj = currentValuesMap.get(key);

    // Sort audits descending by created date (newest first)
    const sortedAudits = [...cellAudits].sort((a, b) => {
      const timeA = new Date(a.created).getTime() || 0;
      const timeB = new Date(b.created).getTime() || 0;
      return timeB - timeA;
    });

    const deName = dataElementNames[deId] || deId;
    let cocName = cocNames[cocId] || cocId;
    if (cocName === 'default' || cocId === 'default') {
      cocName = 'default';
    }

    const currentValue = currentValueObj ? currentValueObj.value : '';
    const modifiedBy = currentValueObj?.storedBy || sortedAudits[0]?.modifiedBy || '';
    const lastUpdated = currentValueObj?.lastUpdated || sortedAudits[0]?.created || '';

    const history: HistoryEntry[] = sortedAudits.map((audit) => ({
      value: audit.value,
      editedBy: audit.modifiedBy,
      created: audit.created,
    }));

    resultRows.push({
      dataElementId: deId,
      dataElementName: deName,
      categoryOptionComboId: cocId,
      disaggregationName: cocName,
      period,
      orgUnitId: orgUnit.id,
      orgUnitName: orgUnit.name,
      currentValue,
      modifiedBy,
      lastUpdated,
      history,
    });
  }

  // Sort rows alphabetically by dataElementName, then period, then disaggregationName
  resultRows.sort((a, b) => {
    const deComp = a.dataElementName.localeCompare(b.dataElementName);
    if (deComp !== 0) return deComp;

    const peComp = a.period.localeCompare(b.period);
    if (peComp !== 0) return peComp;

    return a.disaggregationName.localeCompare(b.disaggregationName);
  });

  return resultRows;
}
