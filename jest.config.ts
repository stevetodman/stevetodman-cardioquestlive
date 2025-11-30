import type { Config } from "jest";

const config: Config = {
  // Treat TS/TSX as ESM so `import.meta` works like Vite.
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/test/styleMock.js",
  },
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
};

export default config;
