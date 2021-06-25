import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import pkg from "./package.json";
import { terser } from "rollup-plugin-terser";

export default [
  // browser-friendly UMD build
  {
    input: "validate.js",
    output: {
      name: "validateYaml",
      file: pkg.browser,
      format: "umd",
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // CommonJS (for Node) and ES module (for bundlers) build.
  {
    input: "validate.js",
    external: ["lodash"],
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    plugins: [terser()],
  },
];
