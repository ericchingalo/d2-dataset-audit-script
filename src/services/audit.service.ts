import lodash from 'lodash';
import {
  IAuditService,
  AuditOptions,
  AuditResult,
} from '../interfaces/audit-service.interface.js';
import { IDhis2ApiClient, Dhis2ClientConfig } from '../interfaces/dhis2-client.interface.js';
import { IReportExporter } from '../interfaces/report-exporter.interface.js';
import { Dhis2ApiClient } from './dhis2-api.js';
import { ExcelExporter } from './excel-exporter.js';
import { mergeAuditData } from './audit-merger.js';
import { MergedAuditRow } from '../types/dhis2.js';
import { formatPrefixedOutputPath } from '../utils/path-resolver.js';

export type Dhis2ClientFactory = (config: Dhis2ClientConfig) => IDhis2ApiClient;

export class AuditService implements IAuditService {
  private clientFactory: Dhis2ClientFactory;
  private exporter: IReportExporter;

  constructor(
    clientFactory?: Dhis2ClientFactory,
    exporter?: IReportExporter
  ) {
    this.clientFactory =
      clientFactory || ((config: Dhis2ClientConfig) => new Dhis2ApiClient(config));
    this.exporter = exporter || new ExcelExporter();
  }

  async execute(options: AuditOptions): Promise<AuditResult> {
    const level = options.level ?? 4;
    const finalOutputPath = formatPrefixedOutputPath(
      options.output,
      options.parentOrgUnit,
      options.periods
    );

    const client = this.clientFactory({
      baseUrl: options.baseUrl,
      username: options.username,
      password: options.password,
      patToken: options.patToken,
    });

    console.log("--- DHIS2 Dataset Audit Generator ---");
    console.log(`Base URL:       ${options.baseUrl}`);
    console.log(`Parent OrgUnit: ${options.parentOrgUnit}`);
    console.log(`OrgUnit Level:  ${level}`);
    console.log(`DataSet ID:     ${options.dataSet}`);
    console.log(`Periods:        ${options.periods.join(", ")}`);
    console.log(`Output File:    ${finalOutputPath}\n`);

    // Step 0: Validate OrgUnit Level
    console.log(`Validating organisation unit level ${level} in DHIS2...`);
    const isValidLevel = await client.validateOrgUnitLevel(level);
    if (!isValidLevel) {
      const errorMsg = `Error: Organisation unit level ${level} does not exist in DHIS2. Terminating process.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    console.log(`Level ${level} verified.\n`);

    // Step 1: Fetch OrgUnits at requested level
    console.log(`Fetching level ${level} organisation units...`);
    const orgUnits = await client.getOrgUnitsByLevel(options.parentOrgUnit, level);
    console.log(`Found ${orgUnits.length} organisation unit(s).\n`);

    if (orgUnits.length === 0) {
      console.warn("No organisation units found matching the criteria.");
    }

    // Step 2: Fetch DataSet Metadata
    console.log(`Fetching dataset metadata for ID: ${options.dataSet}...`);
    const dataSetMeta = await client.getDataSetMeta(options.dataSet);
    const dataElementMap: Record<string, string> = {};
    if (dataSetMeta.dataSetElements) {
      for (const dse of dataSetMeta.dataSetElements) {
        if (dse.dataElement) {
          dataElementMap[dse.dataElement.id] = dse.dataElement.name;
        }
      }
    }
    console.log(
      `Loaded ${Object.keys(dataElementMap).length} data element(s) from dataset form.\n`
    );

    // Step 3: Fetch Category Option Combos
    console.log("Fetching disaggregation (Category Option Combo) names...");
    const cocMap = await client.getCategoryOptionCombos();
    console.log(
      `Loaded ${Object.keys(cocMap).length} category option combo(s).\n`
    );

    // Step 4: Fetch audit data per org unit and period
    const orgUnitDataMap = new Map<string, MergedAuditRow[]>();
    let totalAuditRows = 0;

    for (const orgUnit of orgUnits) {
      console.log(`Processing org unit: ${orgUnit.name} (${orgUnit.id})...`);
      let allOrgUnitRows: MergedAuditRow[] = [];

      for (const period of options.periods) {
        const [dataValuesResp, audits] = await Promise.all([
          client.getDataValueSets(orgUnit.id, period, options.dataSet),
          client.getDataValueAudits(orgUnit.id, period, options.dataSet),
        ]);

        const dataValues = dataValuesResp.dataValues || [];
        const mergedRows = mergeAuditData(
          dataValues,
          audits,
          dataElementMap,
          cocMap,
          orgUnit
        );

        allOrgUnitRows.push(...mergedRows);
      }

      if (allOrgUnitRows.length > 0) {
        // Sort rows by period (descending), then data element name, then disaggregation
        allOrgUnitRows = lodash.orderBy(
          allOrgUnitRows,
          ["period", "dataElementName", "disaggregationName"],
          ["desc", "asc", "asc"]
        );

        orgUnitDataMap.set(orgUnit.name, allOrgUnitRows);
        totalAuditRows += allOrgUnitRows.length;
        console.log(
          `  -> ${allOrgUnitRows.length} modified audit record(s) merged for ${orgUnit.name}`
        );
      } else {
        console.log(`  -> No modified data values found for ${orgUnit.name}`);
      }
    }

    console.log(`\nGenerating Excel report at: ${finalOutputPath}...`);
    await this.exporter.exportReport(orgUnitDataMap, finalOutputPath);

    console.log(`\nSuccess! Excel report created successfully.`);
    console.log(`Total org unit sheets created: ${orgUnitDataMap.size}`);
    console.log(`Total audited rows exported:   ${totalAuditRows}`);

    return {
      districtCount: orgUnitDataMap.size,
      totalAuditRows,
      outputPath: finalOutputPath,
    };
  }
}
