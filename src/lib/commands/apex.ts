/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable complexity */
/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as process from 'node:process';
import { Connection } from '@salesforce/core';
import * as Parser from 'tree-sitter';
import * as tsApex from 'tree-sitter-sfapex';
import { getApexClasses, executeTests, writeApexClassesToOrg, ApexClassRecord } from '../sf';
import { getTextParts, Lines, isTestClass, TSCapture } from '../ts_tools';
import { getMutatedParts } from '../mutations';
import { getPerfStart, getPerfDurationMs, getPerfDurationHumanReadable } from '../perf';

const queries = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'tsQueries', 'apexCaptures.scm'));

export enum Verbosity {
  none = 'none',
  minimal = 'minimal',
  details = 'details',
  full = 'full',
}

enum VerbosityVal {
  none = 1,
  minimal,
  details,
  full,
}

interface Config {
  analyzeOnly: boolean;
  timeoutMs: number;
  verbosity: Verbosity;
  testClassMatchPatterns: string[];
  suppressedRuleNames?: string[];
  classes: Array<{
    className: string;
    testClasses: string[];
  }>;
}

const isVerboseEnough = (val: Verbosity, minimumVerbosity: Verbosity): boolean => {
  return VerbosityVal[val] >= VerbosityVal[minimumVerbosity];
};

export default class ApexWarper {
  // takes in configuration
  private config: Config = {
    analyzeOnly: false,
    timeoutMs: 60000,
    verbosity: Verbosity.minimal,
    testClassMatchPatterns: [],
    classes: [],
    suppressedRuleNames: ['int_value'],
  };

  private classMapByName: { [key: string]: ApexClassRecord } = {};

  private mutants = {};

  private conn: Connection;

  private parser;

  private orgClassIsMutated = false;
  private unwindingPromise: Promise<void>;

  public constructor(conn: Connection, config: Config) {
    this.conn = conn;
    this.config = { ...this.config, ...config };
  }

  public async executeWarpTests(): Promise<any> {
    this.parser = new Parser();
    this.parser.setLanguage((await tsApex).apex);
    for (const classUnderTest of this.config.classes) {
      const totalExecutePerfName = getPerfStart();
      if (!classUnderTest.testClasses) {
        classUnderTest.testClasses = [];
      }
      // if no tests are specified, try and locate tests inside the org
      if (!classUnderTest.testClasses || classUnderTest.testClasses.length === 0) {
        await this.usePatternsToGuessAtTestClasses(classUnderTest);
      }

      if (classUnderTest.testClasses.length === 0) {
        throw new Error('No test classes identified, unable to continue');
      }
      // run tests first to ensure they are valid and passing in the current config
      let testResults = await executeTests(this.conn, classUnderTest.testClasses, this.config.timeoutMs);
      if (testResults.MethodsFailed > 0) {
        throw new Error('Tests not passing before modifying target, unable to start warp');
      }
      if (this.atLeastVerbosity(Verbosity.details)) {
        console.log('All tests passing before warping target');
      }
      const className = classUnderTest.className;
      const classes = await getApexClasses(this.conn, [classUnderTest.className]);
      const parsePerfName = getPerfStart();
      for (const c of classes) {
        this.classMapByName[c.Name] = c;
      }
      const originalClassText = classes[0].Body;
      this.subscribeToSignalToMaybeUnwind(className, originalClassText);

      // Process an Apex file, identify all potential mutants,
      const tree = this.parser.parse(originalClassText);
      const lines = originalClassText.split('\n');

      if (this.atLeastVerbosity(Verbosity.full)) {
        console.log('Parsed in', getPerfDurationHumanReadable(parsePerfName));
      }

      const query = new Parser.Query(this.parser.getLanguage(), queries);

      // TODO: Need to figure out how to block mutants inside of "ignore" sections
      const captures = this.getCaptures(tree, query).filter((c) => !this.config.suppressedRuleNames.includes(c.name));

      if (this.atLeastVerbosity(Verbosity.minimal)) {
        console.log(
          `Found ${captures.length} candidates in ${className}, testing with ${classUnderTest.testClasses.join(', ')}`
        );
      }
      let mutantsKilled = 0;
      let count = 0;
      this.mutants[className] = [];
      for (const capture of captures) {
        let finalStatus = 'unknown';
        let finalStatusMessage;
        const perfName = getPerfStart();

        const oldLines: Lines = {};
        for (let i = capture.node.startPosition.row; i <= capture.node.endPosition.row; i++) {
          oldLines[i] = lines[i];
          lines[i] = ''; // blank out the line so it is easier to inject replacements later
        }
        let deployDuration;
        let testPerfDuration;
        try {
          const textParts = getMutatedParts(capture, oldLines);
          if (this.atLeastVerbosity(Verbosity.details)) {
            this.reportMutant(capture, oldLines, textParts);
          }
          lines[capture.node.startPosition.row] = textParts.join('');
          // push the file to the org
          // TODO: capture compile errors/failures and report that status
          this.orgClassIsMutated = true;
          const writePerfName = getPerfStart();
          if (!this.config.analyzeOnly) {
            await this.writeApexClassesToOrg(classUnderTest.className, lines.join('\n'));
          }
          deployDuration = getPerfDurationMs(writePerfName);

          // run the target tests

          // capture the results against that mutant
          const testPerfName = getPerfStart();
          if (!this.config.analyzeOnly) {
            testResults = await executeTests(this.conn, classUnderTest.testClasses, this.config.timeoutMs);
          }
          testPerfDuration = getPerfDurationMs(testPerfName);
          // report the results of the mutant

          if (this.config.analyzeOnly) {
            if (this.config.verbosity === Verbosity.minimal) {
              process.stdout.write('⏭️');
            } else if (this.atLeastVerbosity(Verbosity.details)) {
              console.log('Evaluation Skipped ⏭️');
            }
            finalStatus = 'skipped';
          } else if (testResults.MethodsFailed > 0) {
            if (this.config.verbosity === Verbosity.minimal) {
              process.stdout.write('💀');
            } else if (this.atLeastVerbosity(Verbosity.details)) {
              console.log('Mutant Killed! 💀');
            }
            mutantsKilled++;
            finalStatus = 'killed';
          } else {
            if (this.config.verbosity === Verbosity.minimal) {
              process.stdout.write('👹');
            } else if (this.atLeastVerbosity(Verbosity.details)) {
              console.log('Mutant Survived 👹');
            }
            finalStatus = 'survived';
          }
        } catch (error) {
          // TODO: if in minimal mode, buffer these and drop after all tests are done
          finalStatus = 'failure';
          if (this.atLeastVerbosity(Verbosity.minimal)) {
            console.log('Failure:', error.mesage || error);
          }
          finalStatusMessage = error.message;
        }
        this.mutants[className].push({
          type: capture.name,
          startLine: capture.node.startPosition.row,
          startPosition: capture.node.startPosition.column,
          testResults,
          status: finalStatus,
          error: finalStatusMessage,
          deploymentDurationMs: deployDuration,
          testExecuteDurationMs: testPerfDuration,
        });
        // eslint-disable-next-line guard-for-in
        for (const lineNum in oldLines) {
          lines[lineNum] = oldLines[lineNum];
        }

        if (this.atLeastVerbosity(Verbosity.full)) {
          console.log('Evaluation took ', getPerfDurationHumanReadable(perfName));
        }
        count++;
      }

      if (this.atLeastVerbosity(Verbosity.minimal)) {
        console.log(
          `\nKilled ${mutantsKilled}/${count} (${(
            (mutantsKilled / count) *
            100
          ).toFixed()}%) in ${getPerfDurationHumanReadable(totalExecutePerfName)}`
        );
      }
      // put the class back the way we found it, what if they break the command??
      // probably best to try and capture the break command and fix the org code
      await this.writeApexClassesToOrg(classUnderTest.className, originalClassText);
      this.orgClassIsMutated = false;
    }
    return this.mutants;
  }

  private getCaptures(tree, query): TSCapture[] {
    const queryPerfName = getPerfStart();

    const captures = query.captures(tree.rootNode) as TSCapture[];

    if (this.atLeastVerbosity(Verbosity.full)) {
      console.log('Query executed in', getPerfDurationHumanReadable(queryPerfName));
    }
    return captures;
  }

  private reportMutant(capture: TSCapture, oldText: Lines, newLineParts: string[]): void {
    // probably a smarter way to do this out there...
    const [start, middle, end] = getTextParts(oldText, capture.node);
    console.log(
      `Start Line ${capture.node.startPosition.row} | ${capture.name}\n`,
      `- ${start}\x1b[32m${middle}\x1b[0m${end}`,
      '\n',
      `+ ${newLineParts[0]}\x1b[31m${newLineParts[1]}\x1b[0m${newLineParts[2]}`
    );
  }

  private subscribeToSignalToMaybeUnwind(className: string, originalClassText: string): void {
    // Using a single function to handle multiple signals
    // if the class in the org is currently mutated, it must be restored on term

    const handle = (signal: string): void => {
      if (this.unwindingPromise !== undefined) {
        console.log('Still restoring original Apex code');
        this.unwindingPromise.catch(() => {
          process.exit(101);
        });
        return;
      }
      if (this.orgClassIsMutated) {
        console.log(`Received ${signal}, restoring ${className} to original state before exiting`);
        // TODO: this isn't always leaving the org clean, need to look into why it doesn't always restore
        this.unwindingPromise = this.writeApexClassesToOrg(className, originalClassText).then(() => process.exit(100));
      } else {
        process.exit(101);
      }
    };

    process.on('SIGTERM', handle);
    process.on('SIGINT', handle);
  }

  private atLeastVerbosity(val: Verbosity): boolean {
    return isVerboseEnough(this.config.verbosity, val);
  }

  private async writeApexClassesToOrg(className: string, body: string): Promise<any> {
    // If the system received a stop request and started unwinding, don't deploy again
    // will process exit as part of that promise so this is really just forcing a stop
    if (this.unwindingPromise !== undefined) {
      await this.unwindingPromise;
    }
    return writeApexClassesToOrg(this.conn, this.classMapByName[className].Id, body, this.config.timeoutMs);
  }

  private async usePatternsToGuessAtTestClasses(classUnderTest: {
    className: string;
    testClasses: string[];
  }): Promise<void> {
    const testClassCandidates: string[] = [];
    for (const pattern of this.config.testClassMatchPatterns) {
      testClassCandidates.push(pattern.replace(new RegExp('{classname}', 'g'), classUnderTest.className));
    }

    const testClassResults = await getApexClasses(this.conn, testClassCandidates);
    for (const r of testClassResults) {
      if (await isTestClass(r.Body)) {
        classUnderTest.testClasses.push(r.Name);
      }
    }
  }
}
