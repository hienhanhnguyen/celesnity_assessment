const tsJest = require.resolve('ts-jest');
const reflectMetadata = require.resolve('reflect-metadata');

module.exports = {
	testEnvironment: 'node',
	rootDir: '.',
	roots: ['<rootDir>/src'],
	testRegex: '.*\\.spec\\.ts$',
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.ts$': [tsJest, { tsconfig: '<rootDir>/tsconfig.json' }],
	},
	setupFiles: [reflectMetadata],
	clearMocks: true,
};
