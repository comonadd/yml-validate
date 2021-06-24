yml-validate
============

This package implements a configurable YAML validation function.
You can see the usage examples in the tests directory.

Example:

```
  const C = {
    children: {
      foo: { type: VT.STRLIT_ONE_OF, values: ["bar"] },
      something: {
        allowListValues: true,
      },
      wow: {
        type: VT.BLOCK,
        children: {
          well: { type: VT.STRLIT_ONE_OF, values: ["five"] }
        },
      },
    },
  };
  const yaml = `
foo: bar
something:
  - Hello
  - 123
  - Times
  - Three
wow:
  well: five
`;
// this gives an empty array, signaling that there is no validation errors
// in the provided YAML input
const validateYaml(C, yaml);
// or
const validateMyYaml = validateWith(C);
validateMyYaml(yaml);
```
