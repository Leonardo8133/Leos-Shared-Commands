"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.validateConfig = validateConfig;
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
                        command: 'echo "Hello from Command Manager"',
                        terminal: {
                            type: 'vscode-new',
                            name: 'Command Manager',
                            keepOpen: true
                        },
                        description: 'Sample command that echoes a welcome message'
                    },
                    {
                        id: 'build-environment',
                        label: 'Build for environment',
                        command: 'npm run build -- --env $ENVIRONMENT_NAME',
                        terminal: {
                            type: 'vscode-current',
                            keepOpen: true
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
function validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
        errors.push('Config must be an object');
        return { valid: false, errors };
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
                        if (variable.type !== 'fixed' && variable.type !== 'options') {
                            errors.push(`Variable ${variableIndex} in command ${commandIndex} must be of type "fixed" or "options"`);
                        }
                    });
                }
            });
        });
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=schema.js.map