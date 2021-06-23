const { validateYaml, VT } = require("../validate");

test("validates an empty file as having no errors", () => {
  expect(validateYaml({}, "")).toEqual([]);
  expect(validateYaml({}, " ")).toEqual([]);
  expect(validateYaml({}, "     ")).toEqual([]);
  expect(
    validateYaml(
      {},
      `


`,
    ),
  ).toEqual([]);
});

test("validates a simple yaml file containing one key-value pair properly", () => {
  const C = {
    children: {
      foo: { type: VT.STRLIT_ONE_OF, values: ["bar"] },
    },
  };
  const yaml = `
foo: bar
`;
  expect(validateYaml(C, yaml)).toEqual([]);
});

test("non-existent key", () => {
  const C = {
    children: {
      bar: { type: VT.STRLIT_ONE_OF, values: ["bar"] },
    },
  };
  const yaml = `
foo: bar
`;
  expect(validateYaml(C, yaml)).toEqual([
    {
      column: 1,
      row: 1,
      text: 'Format Error: Property "foo" not allowed here. Allowed options: "bar"',
      type: "error",
    },
  ]);
});

test("embedded simple", () => {
  const C = {
    children: {
      foo: {
        type: VT.BLOCK,
        children: {
          bar: { type: VT.STRLIT_ONE_OF, values: ["var"] },
        },
      },
    },
  };
  const yaml = `
foo:
  bar: var
`;
  expect(validateYaml(C, yaml)).toEqual([]);
});

test("embedded simple value mismatch", () => {
  const C = {
    children: {
      foo: {
        type: VT.BLOCK,
        children: {
          bar: { type: VT.STRLIT_ONE_OF, values: [123] },
        },
      },
    },
  };
  const yaml = `
foo:
  bar: 543
`;
  expect(validateYaml(C, yaml)).toEqual([
    {
      column: 2,
      row: 2,
      text: "Format Error: Only following values are allowed: 123",
      type: "error",
    },
  ]);
});

test("non-existent key value STRLIT_ONE_OF", () => {
  const C = {
    children: {
      foo: { type: VT.STRLIT_ONE_OF, values: ["bar"] },
    },
  };
  const yaml = `
foo: var
`;
  expect(validateYaml(C, yaml)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: Only following values are allowed: bar`,
      type: "error",
    },
  ]);
});
