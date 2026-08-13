export interface OrganisationUnit {
  id: string;
  name: string;
  path?: string;
}

export interface CategoryOptionCombo {
  id: string;
  name: string;
}

export interface DataElement {
  id: string;
  name: string;
  categoryCombo?: {
    categoryOptionCombos?: CategoryOptionCombo[];
  };
}

export interface DataSetElement {
  dataElement: DataElement;
}

export interface DataSetMeta {
  id?: string;
  name: string;
  dataSetElements: DataSetElement[];
}

export interface DataValueAudit {
  created: string;
  modifiedBy: string;
  auditType: "UPDATE" | "CREATE" | "DELETE";
  value: string;
  period: string | { id: string };
  organisationUnit: string | { id: string };
  attributeOptionCombo: string | { id: string };
  categoryOptionCombo: string | { id: string };
  dataElement: string | { id: string };
}

export interface DataValue {
  dataElement: string;
  period: string;
  orgUnit: string;
  categoryOptionCombo?: string;
  attributeOptionCombo?: string;
  value: string;
  storedBy?: string;
  created?: string;
  lastUpdated?: string;
  comment?: string | null;
  followup?: boolean;
}

export interface DataValueSetResponse {
  dataSet?: string;
  completeDate?: string;
  period?: string;
  orgUnit?: string;
  dataValues?: DataValue[];
}

export interface HistoryEntry {
  value: string;
  editedBy: string;
  created: string;
}

export interface ImportCount {
  imported: number;
  updated: number;
  ignored: number;
  deleted: number;
}

export interface DataValueImportSummary {
  httpStatusCode: string;
  httpStatus: string;
  status?: string;
  response: {
    status: "SUCCESS" | "WARNING" | "ERROR";
    description?: string;
    importCount?: ImportCount;
    conflicts?: Array<{ object?: string; value?: string }>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface MergedAuditRow {
  dataElementId: string;
  dataElementName: string;
  categoryOptionComboId: string;
  disaggregationName: string;
  period: string;
  orgUnitId: string;
  orgUnitName: string;
  currentValue: string;
  modifiedBy: string;
  lastUpdated: string;
  history: HistoryEntry[];
  attributeOptionComboId?: string;
}
