# sf-warp

[![NPM](https://img.shields.io/npm/v/sf-warp.svg?label=sf-warp)](https://www.npmjs.com/package/sf-warp) [![Downloads/week](https://img.shields.io/npm/dw/sf-warp.svg)](https://npmjs.org/package/sf-warp) ![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)

This plugin is used to manipulate logic statements in source code then run tests against those manipulations to see if your tests are able to validate the logic differences.

Currently supports Apex Classes only

For Apex, this plugin **does not** use your local source code and does not need to be in a project directory. It reads code from the target org ONLY. This is because it is using that org as an execution environment, the local source isn't particularly helpful. If you're evaluating changed code, push it to the org _before_ running this tool.

## Install

```bash
sf plugins install sf-warp
```

(depends on native compiled modules, tree-sitter and tree-sitter-sfapex, may need functional compilation tools on your system to install)

## Issues

Please report any issues at https://github.com/aheber/sf-warp/issues

## Contributing

1. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
2. Fork this repository.
3. [Build the plugin locally](#build)
4. Create a _topic_ branch in your fork. Note, this step is recommended but technically not required if contributing using a fork.
5. Edit the code in your fork.
6. Write appropriate tests for your changes.
7. Send a pull request when you are done. We'll review your code, suggest any needed changes, and merge it in.

### Build

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:aheber/sf-warp

# Install the dependencies and compile
yarn && yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev warp apex -c [classname]
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sf cli
sf plugins link .
# To verify
sf plugins
```

## TODOs

- Tests
- Read class lists from a file for more automated evaluation of change collection
- Add additional mutation types or refine matchers
- More CLI flags for select/suppress mutation types
- Code comments to disable mutations by type, by line
- Code comments to pair a specific test file
- Need to be able to suppress mutations in specific contexts (don't mutate no-ops like Debug statement)
- Long-term: given a git diff, determine the hunks that are eligible for mutation and the supporting tests, only execute mutations on those hunks. (Would be so awesome! Also help with total execution time)
- Not sure how to make it go faster, a good run is ~15 seconds per cycle, a bad run is 30+ seconds, or worse. Large classes could have hundreds of mutations that need to be evaluated, easily generating an hour or two's work.
- Support more than one target class at a time
- All the words/text/etc... will get an overhaul later as well as proper "message"/translation support
- Modify exit conditions. percentage threshold, unable to find paired test class, etc...

## Known Issues

- Sometimes if you break the command mid-execution, the "restore the org" process runs but the Apex Class isn't put back the way it is. Need to run a belt and suspenders on that one.
- If a test execution times out, it leaves the test in pending state. This will cause the subsequent test requests to fail as that test is already enqueued. Should be able to cancel it.
- Not all mutations are valuable, better rules to identify those and a way to express a pattern for blocking mutation in certain contexts

## Commands

<!-- commands -->

- [`sf warp apex`](#sf-warp-apex)

## `sf warp apex`

Warp an Apex class in the target org, run tests to see if they notice.

```
USAGE
  $ sf warp apex [--json] [-e <value>] [-c <value>] [-t <value>] [-o <value>] [-p <value>] [-a] [-v
    none|minimal|details|full]

FLAGS
  -a, --analyze-only                           Don't modify the Apex, only report possible changes.
  -c, --class=<value>                          Class name to warp.
  -e, --username=<value>                       [default: test-pxjwqols06it@example.com]
  -o, --timeout=<value>                        [default: 120] Maximum seconds for each deployment or test execution
  -p, --test-class-match-pattern=<value>...    [default:
                                               Test{classname},Test_{classname},{classname}_Test,{classname}Test]
                                               Fallback pattern to find supporting test classes.
  -t, --test-class=<value>...                  Class name to use in testing.
  -v, --verbosity=(none|minimal|details|full)  [default: minimal] Set the output verbosity to control the text volume

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Warp an Apex class in the target org, run tests to see if they notice.

  For one or many Apex classes, warp one small aspect at a time and run tests against that variation.

  If your tests notice the change and fail that is good, your tests proved that they are validating logic. If the test
  still passes then your tests didn't care about the logic change. That might indicate a need for a better test, or it
  might indicate that the change would never matter and is a false-positive.

EXAMPLES
  Execute against a class named "Utils"

    $ sf warp apex --class Utils

  Increase verbosity to see what changes are being made

    $ sf warp apex --class Utils --verbosity details

  Specificy multiple test classes that should be used for evaluation

    $ sf warp apex --class Utils --test-class Utils_Test --test-class TestForUtils

FLAG DESCRIPTIONS
  -p, --test-class-match-pattern=<value>...  Fallback pattern to find supporting test classes.

    Specify a test pattern that will be used against available class names existing in the org. Matches that are test
    classes will be used to evaluate mutations.

    Available replacements are:

    - className - The name of the Class under test
    examples: `Test{className}`, `{className}_Test`, `{className}Test`

    NOTE: Only used if a specific test class was not specified.
```

<!-- commandsstop -->
