import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The App Store / Google Play shell: generated native projects and the
    // copies of Capacitor's bridge script that `cap sync` drops into them.
    "mobile/android/**",
    "mobile/ios/**",
    "mobile/node_modules/**",
  ]),
]);

export default eslintConfig;
