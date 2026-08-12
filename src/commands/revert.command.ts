import { Command } from 'commander';
import { ICLICommand } from './command.interface.js';
import { IRevertService } from '../interfaces/revert-service.interface.js';
import { RevertService } from '../services/revert.service.js';

export class RevertCommand implements ICLICommand {
  private revertService: IRevertService;

  constructor(revertService?: IRevertService) {
    this.revertService = revertService || new RevertService();
  }

  register(program: Command): void {
    program
      .command('revert')
      .description('Initiate process to revert dataset values to prior state')
      .option(
        '-p, --parentOrgUnit <id>',
        'Parent Organisation Unit ID (fetches level 4 districts under this parent)'
      )
      .option('-d, --dataSet <id>', 'DHIS2 Dataset ID')
      .option(
        '-e, --periods <periods>',
        'Comma-separated list of periods (e.g. 2026 or 202601,202602)'
      )
      .option(
        '--baseUrl <url>',
        'DHIS2 Base URL (overrides DHIS2_BASE_URL env variable)'
      )
      .action(async (options) => {
        const baseUrl = options.baseUrl || process.env.DHIS2_BASE_URL;
        const username = process.env.DHIS2_USERNAME;
        const password = process.env.DHIS2_PASSWORD;
        const patToken = process.env.DHIS2_PAT_TOKEN;

        const periodsList = options.periods
          ? options.periods
              .split(',')
              .map((p: string) => p.trim())
              .filter(Boolean)
          : undefined;

        await this.revertService.execute({
          parentOrgUnit: options.parentOrgUnit,
          dataSet: options.dataSet,
          periods: periodsList,
          baseUrl,
          username,
          password,
          patToken,
        });
      });
  }
}
