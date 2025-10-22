const path = require('path');
const glob = require('glob');
const Mocha = require('mocha');

function run() {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 30000 });
  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    glob('**/*.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }

      try {
        files.forEach(file => mocha.addFile(path.resolve(testsRoot, file)));
        mocha.run(failures => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  run
};
