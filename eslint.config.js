import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "voice-gateway/node_modules/**",
      "voice-gateway/dist/**",
      "*.config.js",
      "*.config.cjs",
      "scripts/**",
      "coverage/**",
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // React-specific configuration for frontend
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React refresh for Vite HMR
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // TypeScript-specific rules
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Warn on explicit any (don't error - too many in codebase currently)
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow unused vars prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Allow empty functions (common in React)
      "@typescript-eslint/no-empty-function": "off",

      // Allow require imports in certain contexts
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Voice gateway specific rules
  {
    files: ["voice-gateway/src/**/*.ts"],
    rules: {
      // More lenient for backend code during transition
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
