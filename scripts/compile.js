const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    // Compile TypeScript
    console.log('Compiling TypeScript...');
    execSync('node node_modules/typescript/lib/tsc.js', { stdio: 'inherit' });
    
    // Copy runTest.js
    console.log('Copying runTest.js...');
    const src = path.join(__dirname, '..', 'test', 'runTest.js');
    const dest = path.join(__dirname, '..', 'out', 'test', 'runTest.js');
    fs.copyFileSync(src, dest);
    
    console.log('Compilation complete!');
} catch (error) {
    console.error('Compilation failed:', error.message);
    process.exit(1);
}

