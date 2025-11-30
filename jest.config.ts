import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/test/styleMock.js",
  },
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
};

export default config;
