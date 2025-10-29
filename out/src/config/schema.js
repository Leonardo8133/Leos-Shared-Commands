"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.getDefaultConfig = void 0;
function getDefaultConfig() {
    return {
        folders: [
            {
                name: 'Samples',
                icon: '$(beaker)',
                commands: [
                    {
                        id: 'hello-world',
                        label: 'Echo Hello',
                        command: 'echo "Hello from Task and Documentation Hub"',
                        terminal: {
                            type: 'vscode-new',
                            name: 'Task and Documentation Hub'
                        },
                        description: 'Sample command that echoes a welcome message'
                    },
                    {
                        id: 'build-environment',
                        label: 'Build for environment',
                        command: 'npm run build -- --env $ENVIRONMENT_NAME',
                        terminal: {
                            type: 'vscode-current'
                        },
                        variables: [
                            {
                                key: 'ENVIRONMENT_NAME',
                                value: 'production\ndevelopment\nstaging',
                                label: 'Environment',
                                type: 'options'
                            }
                        ],
                        description: 'Builds the project using one of the configured environments'
                    }
                ]
            }
        ],
        testRunners: [],
        sharedVariables: [
            {
                key: 'PROJECT_ROOT',
                label: 'Project root',
                value: '${workspaceFolder}',
                description: 'Path to the current workspace folder'
            }
        ],
        sharedLists: [
            {
                key: 'ENVIRONMENT_NAME',
                label: 'Environment',
                options: ['local', 'staging', 'production'],
                description: 'Common deployment targets'
            }
        ]
    };
}
exports.getDefaultConfig = getDefaultConfig;
function validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
        errors.push('Config must be an object');
        return { valid: false, errors };
    }
    if (config.testRunners && !Array.isArray(config.testRunners)) {
        errors.push('Config testRunners must be an array when provided');
    }
    if (!Array.isArray(config.folders)) {
        errors.push('Config must have a folders array');
    }
    if (Array.isArray(config.folders)) {
        config.folders.forEach((folder, folderIndex) => {
            if (!folder || typeof folder !== 'object') {
                errors.push(`Folder ${folderIndex} must be an object`);
                return;
            }
            if (!folder.name || typeof folder.name !== 'string') {
                errors.push(`Folder ${folderIndex} must have a name`);
            }
            if (!Array.isArray(folder.commands)) {
                errors.push(`Folder ${folderIndex} must have a commands array`);
                return;
            }
            folder.commands.forEach((command, commandIndex) => {
                if (!command || typeof command !== 'object') {
                    errors.push(`Command ${commandIndex} in folder ${folderIndex} must be an object`);
                    return;
                }
                if (!command.id || typeof command.id !== 'string') {
                    errors.push(`Command ${commandIndex} in folder ${folderIndex} must have an id`);
                }
                if (!command.label || typeof command.label !== 'string') {
                    errors.push(`Command ${commandIndex} in folder ${folderIndex} must have a label`);
                }
                if (!command.command || typeof command.command !== 'string') {
                    errors.push(`Command ${commandIndex} in folder ${folderIndex} must have a command string`);
                }
                if (!command.terminal || typeof command.terminal !== 'object') {
                    errors.push(`Command ${commandIndex} in folder ${folderIndex} must have terminal settings`);
                }
                if (Array.isArray(command.variables)) {
                    command.variables.forEach((variable, variableIndex) => {
                        if (!variable || typeof variable !== 'object') {
                            errors.push(`Variable ${variableIndex} in command ${commandIndex} must be an object`);
                            return;
                        }
                        if (!variable.key || typeof variable.key !== 'string') {
                            errors.push(`Variable ${variableIndex} in command ${commandIndex} must have a key`);
                        }
                        if (variable.type !== 'fixed' && variable.type !== 'options' && variable.type !== 'file') {
                            errors.push(`Variable ${variableIndex} in command ${commandIndex} must be of type "fixed", "options", or "file"`);
                        }
                    });
                }
            });
        });
    }
    if (Array.isArray(config.testRunners)) {
        config.testRunners.forEach((runner, index) => {
            if (!runner || typeof runner !== 'object') {
                errors.push(`Test runner ${index} must be an object`);
                return;
            }
            if (typeof runner.id !== 'string' || runner.id.trim() === '') {
                errors.push(`Test runner ${index} must have an id`);
            }
            if (typeof runner.title !== 'string' || runner.title.trim() === '') {
                errors.push(`Test runner ${index} must have a title`);
            }
            if (typeof runner.activated !== 'boolean') {
                errors.push(`Test runner ${index} must have an activated flag`);
            }
            if (!['javascript', 'typescript', 'python'].includes(runner.fileType)) {
                errors.push(`Test runner ${index} must have a valid file type`);
            }
            if (typeof runner.fileNamePattern !== 'string') {
                errors.push(`Test runner ${index} must have a file name pattern string`);
            }
            if (typeof runner.testNamePattern !== 'string') {
                errors.push(`Test runner ${index} must have a test name pattern string`);
            }
            if (typeof runner.runTestCommand !== 'string' || runner.runTestCommand.trim() === '') {
                errors.push(`Test runner ${index} must have a run test command`);
            }
        });
    }
    return { valid: errors.length === 0, errors };
}
exports.validateConfig = validateConfig;
//# sourceMappingURL=schema.js.map
