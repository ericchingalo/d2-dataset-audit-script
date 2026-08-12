import { Command } from 'commander';

export interface ICLICommand {
  register(program: Command): void;
}
