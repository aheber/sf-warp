# summary

Warp an Apex class in the target org, run tests to see if they notice.

# description

For one or many Apex classes, warp one small aspect at a time and run tests against that variation.

If your tests notice the change and fail that is good, your tests proved that they are validating logic. If the test still passes then your tests didn't care about the logic change. That might indicate a need for a better test, or it might indicate that the change would never matter and is a false-positive.

# examples

- Execute against a class named "Utils"

  <%= config.bin %> <%= command.id %> --class Utils

- Increase verbosity to see what changes are being made

  <%= config.bin %> <%= command.id %> --class Utils --verbosity details

- Specificy multiple test classes that should be used for evaluation

  <%= config.bin %> <%= command.id %> --class Utils --test-class Utils_Test --test-class TestForUtils

# flags.class.summary

Class name to warp.

# flags.test-class.summary

Class name to use in testing.

# flags.timeout.summary

Maximum seconds for each deployment or test execution

# flags.test-class-match-pattern.summary

Fallback pattern to find supporting test classes.

# flags.test-class-match-pattern.description

Specify a test pattern that will be used against available class names existing in the org. Matches that are test classes will be used to evaluate mutations.

Available replacements are:

- className - The name of the Class under test
  examples: `Test{className}`, `{className}_Test`, `{className}Test`

NOTE: Only used if a specific test class was not specified.

# flags.file.summary

(not implemented) File with a list of classes that should be tested.

# flags.analyze-only.summary

Don't modify the Apex, only report possible changes.

# flags.verbosity.summary

Set the output verbosity to control the text volume
