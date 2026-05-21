#!/usr/bin/env node
import { runCli } from './commands.js';

const result = await runCli(process.argv.slice(2));
process.exitCode = result.exitCode;
