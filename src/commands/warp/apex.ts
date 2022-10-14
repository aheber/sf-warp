/* eslint-disable @typescript-eslint/no-explicit-any */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import ApexWarper, { Verbosity } from '../../lib/commands/apex';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.load('sf-warp', 'warp.apex', [
  'summary',
  'description',
  'examples',
  'flags.analyze-only.summary',
  'flags.class.summary',
  // 'flags.file.summary',
  'flags.test-class.summary',
  'flags.timeout.summary',
  'flags.test-class-match-pattern.summary',
  'flags.test-class-match-pattern.description',
  'flags.verbosity.summary',
]);

export default class Apex extends SfCommand<any> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static flags = {
    username: Flags.requiredOrg(),
    class: Flags.string({
      summary: messages.getMessage('flags.class.summary'),
      char: 'c',
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
      char: 'o',
      default: 120,
    }),
    'test-class-match-pattern': Flags.string({
      summary: messages.getMessage('flags.test-class-match-pattern.summary'),
      description: messages.getMessage('flags.test-class-match-pattern.description'),
      char: 'p',
      multiple: true,
      default: ['Test{classname}', 'Test_{classname}', '{classname}_Test', '{classname}Test'],
    }),
    'analyze-only': Flags.boolean({
      summary: messages.getMessage('flags.analyze-only.summary'),
      char: 'a',
    }),
    verbosity: Flags.enum({
      summary: messages.getMessage('flags.verbosity.summary'),
      char: 'v',
      options: Object.keys(Verbosity),
      default: Verbosity.minimal.toString(),
    }),
    // TODO: define failure conditions, below x percent, no discovered test classes, etc...
  };

  public async run(): Promise<any> {
    const { flags } = await this.parse(Apex);

    // this.log(`Connecting to ${flags.username}...`);

    // Initialize the authorization for the provided username

    // Create a connection to the org
    const connection = flags.username.getConnection();

    // TODO: when do we fail with a non-zero exit code?
    // Probably has to be configurable
    // if we have class files, consume those files and build up the list of classes to test
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await new ApexWarper(connection, {
      analyzeOnly: flags['analyze-only'],
      timeoutMs: flags.timeout * 1000,
      verbosity: flags.verbosity as Verbosity,
      testClassMatchPatterns: flags['test-class-match-pattern'],
      classes: [
        {
          className: flags.class,
          testClasses: flags['test-class'],
        },
      ],
    }).executeWarpTests();
  }
}
