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
    const client = this.clientFactory({
      baseUrl: options.baseUrl,
      username: options.username,
      password: options.password,
      patToken: options.patToken,
    });

    console.log("--- DHIS2 Dataset Audit Generator ---");
    console.log(`Base URL:       ${options.baseUrl}`);
    console.log(`Parent OrgUnit: ${options.parentOrgUnit}`);
    console.log(`DataSet ID:     ${options.dataSet}`);
    console.log(`Periods:        ${options.periods.join(", ")}`);
    console.log(`Output File:    ${options.output}\n`);

    // Step 1: Fetch Districts
    console.log("Fetching level 4 district organisation units...");
    const districts = await client.getDistricts(options.parentOrgUnit);
    console.log(`Found ${districts.length} district(s).\n`);

    if (districts.length === 0) {
      console.warn("No districts found matching the criteria.");
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

    // Step 4: Fetch audit data per district and period
    const districtDataMap = new Map<string, MergedAuditRow[]>();
    let totalAuditRows = 0;

    for (const district of districts) {
      console.log(`Processing district: ${district.name} (${district.id})...`);
      let allDistrictRows: MergedAuditRow[] = [];

      for (const period of options.periods) {
        const [dataValuesResp, audits] = await Promise.all([
          client.getDataValueSets(district.id, period, options.dataSet),
          client.getDataValueAudits(district.id, period, options.dataSet),
        ]);

        const dataValues = dataValuesResp.dataValues || [];
        const mergedRows = mergeAuditData(
          dataValues,
          audits,
          dataElementMap,
          cocMap,
          district
        );

        allDistrictRows.push(...mergedRows);
      }

      if (allDistrictRows.length > 0) {
        // Sort district rows by period (descending), then data element name, then disaggregation
        allDistrictRows = lodash.orderBy(
          allDistrictRows,
          ["period", "dataElementName", "disaggregationName"],
          ["desc", "asc", "asc"]
        );

        districtDataMap.set(district.name, allDistrictRows);
        totalAuditRows += allDistrictRows.length;
        console.log(
          `  -> ${allDistrictRows.length} modified audit record(s) merged for ${district.name}`
        );
      } else {
        console.log(`  -> No modified data values found for ${district.name}`);
      }
    }

    console.log(`\nGenerating Excel report at: ${options.output}...`);
    await this.exporter.exportReport(districtDataMap, options.output);

    console.log(`\nSuccess! Excel report created successfully.`);
    console.log(`Total district sheets created: ${districtDataMap.size}`);
    console.log(`Total audited rows exported:   ${totalAuditRows}`);

    return {
      districtCount: districtDataMap.size,
      totalAuditRows,
      outputPath: options.output,
    };
  }
}
