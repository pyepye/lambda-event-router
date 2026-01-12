import type { Options } from "tsup";

export const baseConfig: Options = {
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node24",
};
