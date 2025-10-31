const path = require('path');
const { glob } = require('glob');
const Mocha = require('mocha');

async function run() {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 30000 });
  const testsRoot = path.resolve(__dirname);

  try {
    const files = await glob('**/*.test.js', { cwd: testsRoot });
    
    files.forEach(file => mocha.addFile(path.resolve(testsRoot, file)));
    
    return new Promise((resolve, reject) => {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

module.exports = {
  run
};
