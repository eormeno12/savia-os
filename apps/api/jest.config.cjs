/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Resolve dual-package deps (jose, etc.) to their CJS/node build under ts-jest.
  testEnvironmentOptions: { customExportConditions: ['node', 'require', 'default'] },
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|test)\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', isolatedModules: true }],
  },
  // jose is ESM-only — let ts-jest transpile it (everything else in node_modules is skipped).
  transformIgnorePatterns: ['/node_modules/(?!\\.pnpm/jose@|jose/)'],
  // e2e tests (which need the live dev stack) are opt-in via TEST_E2E=1.
  testPathIgnorePatterns: process.env.TEST_E2E ? [] : ['\\.e2e\\.spec\\.ts$'],
  clearMocks: true,
};
