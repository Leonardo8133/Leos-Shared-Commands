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
    
    // Ensure the destination directory exists
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.copyFileSync(src, dest);

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

