const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    // Compile TypeScript
    console.log('Compiling TypeScript...');
    execSync('node node_modules/typescript/lib/tsc.js', { stdio: 'inherit' });
    
    // Copy test files
    console.log('Copying test files...');
    const testSrc = path.join(__dirname, '..', 'test');
    const testDest = path.join(__dirname, '..', 'out', 'test');
    
    // Copy runTest.js
    const runTestSrc = path.join(testSrc, 'runTest.js');
    const runTestDest = path.join(testDest, 'runTest.js');
    const runTestDestDir = path.dirname(runTestDest);
    if (!fs.existsSync(runTestDestDir)) {
        fs.mkdirSync(runTestDestDir, { recursive: true });
    }
    fs.copyFileSync(runTestSrc, runTestDest);
    
    // Copy test suite directory
    const suiteSrc = path.join(testSrc, 'suite');
    const suiteDest = path.join(testDest, 'suite');
    if (fs.existsSync(suiteSrc)) {
        copyRecursive(suiteSrc, suiteDest);
    }

    // Copy resources (webviews, icons, etc.) into out/resources
    console.log('Copying resources...');
    const resourcesSrc = path.join(__dirname, '..', 'resources');
    const resourcesDest = path.join(__dirname, '..', 'out', 'resources');

    function copyRecursive(srcDir, destDir) {
        if (!fs.existsSync(srcDir)) {
            return;
        }
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                copyRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    copyRecursive(resourcesSrc, resourcesDest);
    
    console.log('Compilation complete!');
} catch (error) {
    console.error('Compilation failed:', error.message);
    process.exit(1);
}

