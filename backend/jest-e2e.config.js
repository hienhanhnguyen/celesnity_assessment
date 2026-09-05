const tsJest = require.resolve('ts-jest');
const reflectMetadata = require.resolve('reflect-metadata');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	testEnvironment: 'node',
	rootDir: '.',
	roots: ['<rootDir>/test'],
	testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.ts$': [tsJest, { tsconfig: '<rootDir>/tsconfig.e2e.json' }],
	},
	setupFiles: [reflectMetadata],
	globalSetup: '<rootDir>/test/e2e/global-setup.ts',
	globalTeardown: '<rootDir>/test/e2e/global-teardown.ts',
	testTimeout: 120000,
	maxWorkers: 1,
	clearMocks: true,
};
