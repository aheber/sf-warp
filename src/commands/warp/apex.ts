/* eslint-disable @typescript-eslint/no-explicit-any */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
// eslint-disable-next-line no-restricted-imports
import ApexWarper, { Verbosity } from '../../lib/commands/apex';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sf-warp', 'warp.apex');

export default class Apex extends SfCommand<any> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({ aliases: ['username'], deprecateAliases: true }),
    class: Flags.string({
      summary: messages.getMessage('flags.class.summary'),
      char: 'c',
      multiple: true,
      required: true,
    }),
    'test-class': Flags.string({
      summary: messages.getMessage('flags.test-class.summary'),
      char: 't',
      multiple: true,
    }),
    // file: Flags.file({
    //   summary: messages.getMessage('flags.file.summary'),
    //   char: 'f',
    //   multiple: true,
    //   exists: true,
    // }),
    timeout: Flags.integer({
      summary: messages.getMessage('flags.timeout.summary'),
      char: 'm',
      default: 120,
    }),
    'test-class-match-pattern': Flags.string({
      summary: messages.getMessage('flags.test-class-match-pattern.summary'),
      description: messages.getMessage('flags.test-class-match-pattern.description'),
      char: 'p',
      multiple: true,
      default: [
        'Test{classname}',
        'Test_{classname}',
        '{classname}Test',
        '{classname}_Test',
        '{classname}Tests',
        '{classname}_Tests',
      ],
    }),
    'analyze-only': Flags.boolean({
      summary: messages.getMessage('flags.analyze-only.summary'),
      char: 'a',
    }),
    verbosity: Flags.string({
      summary: messages.getMessage('flags.verbosity.summary'),
      char: 'v',
      options: Object.keys(Verbosity),
      default: Verbosity.minimal.toString(),
    }),
    // TODO: define failure conditions, below x percent, no discovered test classes, etc...
  };

  public async run(): Promise<any> {
    const { flags } = await this.parse(Apex);

    // Create a connection to the org
    const connection = flags['target-org'].getConnection();

    // TODO: when do we fail with a non-zero exit code?
    // Probably has to be configurable
    // if we have class files, consume those files and build up the list of classes to test
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new ApexWarper(connection, {
      analyzeOnly: flags['analyze-only'],
      timeoutMs: flags.timeout * 1000,
      verbosity: (flags.json ? Verbosity.none : flags.verbosity) as Verbosity,
      testClassMatchPatterns: flags['test-class-match-pattern'],
      classes: flags.class.map((className) => ({
        className,
        testClasses: flags['test-class'] ?? [],
      })),
    }).executeWarpTests();
  }
}
