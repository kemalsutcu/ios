const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([expoConfig, { ignores: ['vendor/**', 'dist/**', 'dist-web/**', '.expo/**', 'node_modules/**'] }]);
