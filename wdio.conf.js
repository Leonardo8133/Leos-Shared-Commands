const path = require('path');

exports.config = {
  runner: 'local',
  specs: ['./ui-tests/specs/**/*.spec.js'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'vscode',
      'vscode:extensionPath': path.resolve(__dirname),
      'vscode:workspacePath': path.resolve(__dirname)
    }
  ],
  logLevel: 'warn',
  services: [
    ['vscode', {
      extensionPath: path.resolve(__dirname)
    }]
  ],
  framework: 'mocha',
  mochaOpts: {
    timeout: 120000
  }
};
