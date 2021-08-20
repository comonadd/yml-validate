const { validateYaml, validateWith, VT } = require("../validate");

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
  const v = validateWith(C);
  const yaml = `
foo: bar
`;
  expect(v(yaml)).toEqual([]);
});

test("non-existent key", () => {
  const C = {
    children: {
      bar: { type: VT.STRLIT_ONE_OF, values: ["bar"] },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo: bar
`;
  expect(v(yaml)).toEqual([
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
  const v = validateWith(C);
  const yaml = `
foo:
  bar: var
`;
  expect(v(yaml)).toEqual([]);
});

test("embedded simple value mismatch", () => {
  const C = {
    children: {
      foo: {
        type: VT.BLOCK,
        children: {
          bar: { type: VT.NUMLIT_ONE_OF, values: [123] },
        },
      },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo:
  bar: 543
`;
  expect(v(yaml)).toEqual([
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
  const v = validateWith(C);
  const yaml = `
foo: var
`;
  expect(v(yaml)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: Only following values are allowed: bar`,
      type: "error",
    },
  ]);
});

test("STRLIT works properly", () => {
  const C = {
    children: {
      foo: { type: VT.STRLIT },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo: anything
`;
  expect(v(yaml)).toEqual([]);
  const yaml1 = `
foo: "anything"
`;
  expect(v(yaml1)).toEqual([]);
  const yaml2 = `
foo: 123
`;
  expect(v(yaml2)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: foo should be a string literal`,
      type: "error",
    },
  ]);
});

test("NUMLIT works properly", () => {
  const C = {
    children: {
      foo: { type: VT.NUMLIT },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo: 123
`;
  expect(v(yaml)).toEqual([]);
  const yaml2 = `
foo: anything
`;
  expect(v(yaml2)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: foo should be a number literal`,
      type: "error",
    },
  ]);
  const yaml3 = `
foo: 123.5
`;
  expect(v(yaml3)).toEqual([]);
  const yaml4 = `
foo: 123.5.3
`;
  expect(v(yaml4)).toEqual([
    {
      row: 1,
      column: 4,
      text: `Invalid number literal "123.5.3"`,
      type: "error",
    },
  ]);
});

test("NUMLIT_ONE_OF works properly", () => {
  const C = {
    children: {
      foo: { type: VT.NUMLIT_ONE_OF, values: [43, 123, 555] },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo: 555
`;
  expect(v(yaml)).toEqual([]);
  const yaml2 = `
foo: 2893
`;
  expect(v(yaml2)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: Only following values are allowed: 43, 123, 555`,
      type: "error",
    },
  ]);
  const yaml3 = `
foo: hello
`;
  expect(v(yaml3)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: foo should be a number literal`,
      type: "error",
    },
  ]);
});

test("required flag works properly", () => {
  const C = {
    children: {
      foo: { type: VT.NUMLIT_ONE_OF, values: [43, 123, 555], required: true },
      bar: { type: VT.NUMLIT_ONE_OF, values: [43, 123, 555], required: false },
    },
  };
  const v = validateWith(C);
  const yaml = `
foo: 555
`;
  expect(v(yaml)).toEqual([]);
  const yaml2 = `
`;
  expect(v(yaml2)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Option foo is required`,
      type: "error",
    },
  ]);
  const yaml3 = `
foo: hello
`;
  expect(v(yaml3)).toEqual([
    {
      column: 1,
      row: 1,
      text: `Format Error: foo should be a number literal`,
      type: "error",
    },
  ]);
});
