import * as vscode from 'vscode';
import * as path from 'path';
import { CommandConfig, Command, Folder, SharedVariable, SharedList, ConfigVersion } from '../../types';
import { ConfigManager } from '../../config/ConfigManager';

export class WebviewManager {
  private static instance: WebviewManager;
  private panel: vscode.WebviewPanel | undefined;
  private configPanel: vscode.WebviewPanel | undefined;
  private configManager: ConfigManager;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): WebviewManager {
    if (!WebviewManager.instance) {
      WebviewManager.instance = new WebviewManager();
    }
    return WebviewManager.instance;
  }

  public showCommandEditor(command?: Command): void {
    if (this.panel) {
      this.panel.reveal();
      if (command) {
        this.panel.title = `${command.label} - Editor`;
        this.panel.webview.postMessage({ type: 'editCommand', command });
      }
      return;
    }

    const panelTitle = command ? `${command.label} - Editor` : 'Command Editor';
    this.panel = vscode.window.createWebviewPanel(
      'commandEditor',
      panelTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources'))]
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'saveCommand':
            await this.saveCommand(message.command);
            break;
          case 'saveConfig':
            await this.saveConfig(message.config);
            break;
          case 'getConfig':
            this.sendConfig();
            break;
          case 'getGlobalVariables':
            this.sendGlobalVariables();
            break;
          case 'openCommandConfig':
            await this.openCommandConfig(message.variable);
            break;
          case 'close':
            this.panel?.dispose();
            break;
        }
      },
      undefined,
      []
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    if (command) {
      this.panel.webview.postMessage({ type: 'editCommand', command });
    }
  }

  public showFolderEditor(folder?: Folder, folderPath?: string): void {
    if (this.panel) {
      this.panel.reveal();
      if (folder) {
        this.panel.title = `${folder.name} - Folder Editor`;
        this.panel.webview.postMessage({ type: 'editFolder', folder, folderPath });
      }
      return;
    }

    const panelTitle = folder ? `${folder.name} - Folder Editor` : 'Folder Editor';
    this.panel = vscode.window.createWebviewPanel(
      'folderEditor',
      panelTitle,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources'))]
      }
    );

    this.panel.webview.html = this.getFolderEditorContent();

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'saveFolder':
            await this.saveFolder(message.folder, message.folderPath);
            break;
          case 'close':
            this.panel?.dispose();
            break;
        }
      },
      undefined,
      []
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    if (folder) {
      this.panel.webview.postMessage({ type: 'editFolder', folder, folderPath });
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Command Editor</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css">
        <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: 11px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 8px;
        }
        .container {
            max-width: 700px;
            margin: 0 auto;
        }
        .form-group {
            margin-bottom: 8px;
        }
        .form-row {
            display: flex;
            gap: 8px;
            align-items: end;
        }
        .form-row .form-group {
            flex: 1;
            margin-bottom: 0;
        }
        label {
            display: block;
            margin-bottom: 2px;
            font-weight: bold;
            font-size: 12px;
        }
        input, textarea, select {
            width: 100%;
            padding: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 12px;
        }
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            margin-top: 3px;
        }
        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin: 0;
            transform: scale(1.2);
        }
        .checkbox-group label {
            margin: 0;
            font-weight: normal;
            cursor: pointer;
        }
        .icon-preview {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 5px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        .icon-preview-icon {
            font-size: 16px;
            color: var(--vscode-foreground);
        }
        .icon-preview-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .codicon {
            font-family: 'codicon';
            font-size: 16px;
            color: var(--vscode-foreground);
            display: inline-block;
            font-style: normal;
            font-variant: normal;
            text-rendering: auto;
            line-height: 1;
        }
        .variable-dropdown {
            position: absolute;
            background-color: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .variable-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }
        .variable-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .variable-item:last-child {
            border-bottom: none;
        }
        .variable-key {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        .variable-label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .command-textarea-container {
            position: relative;
        }
        .variable-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
        }
        .variable-link:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        textarea {
            height: 60px;
            resize: vertical;
        }
        .button-group {
            display: flex;
            gap: 6px;
            margin-top: 12px;
        }
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .variables-section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 8px;
            margin-top: 12px;
        }
        .variable-item {
            display: flex;
            gap: 6px;
            margin-bottom: 6px;
            align-items: center;
        }
        .variable-item input {
            flex: 1;
        }
        .variable-item select {
            flex: 1;
        }
        .add-variable {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
        }
        .remove-variable {
            background-color: var(--vscode-errorForeground);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-focusBorder);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .json-editor {
            width: 100%;
            height: 400px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        .low-margin {
            margin-bottom: 5px;
            margin-top: 0px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="form-tab" class="tab-content active">
            <form id="command-form">
                <input type="hidden" id="command-id">

                <div class="form-group">
                    <label for="command-icon">Icon:</label>
                    <select id="command-icon" onchange="updateIconPreview()">
                        <option value="">No Icon</option>
                        <option value="$(play)" data-icon="play">▶ Play</option>
                        <option value="$(stop)" data-icon="stop">⏹ Stop</option>
                        <option value="$(refresh)" data-icon="refresh">🔄 Refresh</option>
                        <option value="$(edit)" data-icon="edit">✏ Edit</option>
                        <option value="$(add)" data-icon="add">➕ Add</option>
                        <option value="$(trash)" data-icon="trash">🗑 Delete</option>
                        <option value="$(folder)" data-icon="folder">📁 Folder</option>
                        <option value="$(file)" data-icon="file">📄 File</option>
                        <option value="$(terminal)" data-icon="terminal">💻 Terminal</option>
                        <option value="$(gear)" data-icon="gear">⚙ Settings</option>
                        <option value="$(bug)" data-icon="bug">🐛 Debug</option>
                        <option value="$(check)" data-icon="check">✅ Check</option>
                        <option value="$(close)" data-icon="close">❌ Close</option>
                        <option value="$(arrow-up)" data-icon="arrow-up">⬆ Arrow Up</option>
                        <option value="$(arrow-down)" data-icon="arrow-down">⬇ Arrow Down</option>
                        <option value="$(arrow-left)" data-icon="arrow-left">⬅ Arrow Left</option>
                        <option value="$(arrow-right)" data-icon="arrow-right">➡ Arrow Right</option>
                        <option value="$(search)" data-icon="search">🔍 Search</option>
                        <option value="$(home)" data-icon="home">🏠 Home</option>
                        <option value="$(heart)" data-icon="heart">❤ Heart</option>
                        <option value="$(star)" data-icon="star">⭐ Star</option>
                        <option value="$(zap)" data-icon="zap">⚡ Zap</option>
                        <option value="$(rocket)" data-icon="rocket">🚀 Rocket</option>
                        <option value="$(code)" data-icon="code">💻 Code</option>
                        <option value="$(database)" data-icon="database">🗄 Database</option>
                        <option value="$(server)" data-icon="server">🖥 Server</option>
                        <option value="$(cloud)" data-icon="cloud">☁ Cloud</option>
                        <option value="$(package)" data-icon="package">📦 Package</option>
                        <option value="$(book)" data-icon="book">📖 Book</option>
                        <option value="$(globe)" data-icon="globe">🌍 Globe</option>
                        <option value="$(key)" data-icon="key">🔑 Key</option>
                        <option value="$(lock)" data-icon="lock">🔒 Lock</option>
                        <option value="$(unlock)" data-icon="unlock">🔓 Unlock</option>
                        <option value="$(eye)" data-icon="eye">👁 Eye</option>
                        <option value="$(eye-closed)" data-icon="eye-closed">🙈 Eye Closed</option>
                        <option value="$(info)" data-icon="info">ℹ Info</option>
                        <option value="$(warning)" data-icon="warning">⚠ Warning</option>
                        <option value="$(error)" data-icon="error">❌ Error</option>
                    </select>
                    <div id="icon-preview" class="icon-preview" style="display: none;">
                        <span id="icon-preview-icon" class="icon-preview-icon"></span>
                        <span id="icon-preview-text" class="icon-preview-text">Icon Preview</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="command-label">Label:</label>
                    <input type="text" id="command-label" required>
                </div>

                <div class="form-group">
                    <label for="command-description">Description:</label>
                    <input type="text" id="command-description">
                </div>

                <div class="form-group">
                    <label for="command-command">Command:</label>
                    <div class="command-textarea-container">
                        <textarea id="command-command" placeholder="Enter the command to execute (type { to see variables)" required></textarea>
                        <div id="variable-dropdown" class="variable-dropdown" style="display: none;"></div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="terminal-type">Terminal Type:</label>
                        <select id="terminal-type">
                            <option value="vscode-current">VS Code Current Terminal</option>
                            <option value="vscode-new">VS Code New Terminal</option>
                            <option value="external-cmd">External CMD</option>
                            <option value="external-powershell">External PowerShell</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="terminal-name">Terminal Name:</label>
                        <input type="text" id="terminal-name" placeholder="Optional terminal name">
                    </div>
                </div>

                <div class="checkbox-group">
                    <input type="checkbox" id="keep-open">
                    <label for="keep-open">Keep terminal open after execution</label>
                </div>

                <div class="checkbox-group">
                    <input type="checkbox" id="clear-before-run">
                    <label for="clear-before-run">Clear terminal before running</label>
                </div>

                <div class="variables-section">
                    <h3 class='low-margin'>Variables</h3>
                    <div id="variables-container">
                        <!-- Variables will be added here -->
                    </div>
                    <button type="button" class="add-variable" onclick="addVariable()">Add Variable</button>
                </div>

                <div class="button-group">
                    <button type="submit" class="btn-primary">Save Command</button>
                    <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentConfig = null;
        let currentCommand = null;


        // Load configuration
        function loadConfig() {
            vscode.postMessage({ type: 'getConfig' });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'config':
                    currentConfig = message.config;
                    if (message.command) {
                        loadCommand(message.command);
                    }
                    break;
                case 'globalVariables':
                    // Handle global variables response for autocomplete
                    if (window.globalVariables) {
                        window.globalVariables = message.variables || [];
                    }
                    break;
                case 'editCommand':
                    currentCommand = message.command;
                    loadCommand(message.command);
                    break;
            }
        });

        // Load command into form
        function loadCommand(command) {
            document.getElementById('command-id').value = command.id || '';
            document.getElementById('command-label').value = command.label || '';
            document.getElementById('command-description').value = command.description || '';
            document.getElementById('command-command').value = command.command || '';
            document.getElementById('command-icon').value = command.icon || '';
            document.getElementById('terminal-type').value = command.terminal?.type || 'vscode-new';
            document.getElementById('terminal-name').value = command.terminal?.name || '';
            document.getElementById('keep-open').checked = command.terminal?.keepOpen || false;
            document.getElementById('clear-before-run').checked = command.terminal?.clearBeforeRun || false;
            
            // Update icon preview when loading command
            updateIconPreview();
            
            loadVariables(command.variables || []);
        }

        // Generate command ID from label
        function generateCommandId(label) {
            if (!label) return '';
            return label.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
        }

        // Auto-generate command ID when label changes
        document.addEventListener('DOMContentLoaded', function() {
            const labelInput = document.getElementById('command-label');
            const idInput = document.getElementById('command-id');
            
            labelInput.addEventListener('input', function() {
                const currentId = idInput.value;
                // Only auto-generate if ID is empty or matches previous generated pattern
                if (!currentId || currentId === generateCommandId(labelInput.value.split('-')[0])) {
                    idInput.value = generateCommandId(labelInput.value);
                }
            });

            // Variable autocomplete functionality
            setupVariableAutocomplete();
        });

        // Variable autocomplete functionality
        function setupVariableAutocomplete() {
            const commandTextarea = document.getElementById('command-command');
            const dropdown = document.getElementById('variable-dropdown');
            let currentCursorPos = 0;
            let allVariables = [];

            commandTextarea.addEventListener('input', function(e) {
                const text = e.target.value;
                const cursorPos = e.target.selectionStart;
                currentCursorPos = cursorPos;

                // Check if user typed { and cursor is at the end
                if (text.charAt(cursorPos - 1) === '{') {
                    showVariableDropdown();
                } else if (text.charAt(cursorPos - 1) === '}') {
                    hideVariableDropdown();
                    // Convert {variable} to clickable link
                    setTimeout(() => convertVariablesToLinks(), 100);
                } else {
                    hideVariableDropdown();
                }
            });

            commandTextarea.addEventListener('click', function(e) {
                // Convert variables to links when clicking
                setTimeout(() => convertVariablesToLinks(), 100);
            });

            function showVariableDropdown() {
                if (allVariables.length === 0) {
                    loadAllVariables();
                }
                
                const rect = commandTextarea.getBoundingClientRect();
                dropdown.style.top = (rect.bottom - rect.top - 20) + 'px';
                dropdown.style.left = '0px';
                dropdown.style.display = 'block';
                
                populateDropdown();
            }

            function hideVariableDropdown() {
                dropdown.style.display = 'none';
            }

            function populateDropdown() {
                dropdown.innerHTML = '';
                
                // Add local variables (command variables)
                const localVars = getLocalVariables();
                if (localVars.length > 0) {
                    const header = document.createElement('div');
                    header.className = 'variable-item';
                    header.style.fontWeight = 'bold';
                    header.style.backgroundColor = 'var(--vscode-list-inactiveSelectionBackground)';
                    header.textContent = 'Local Variables';
                    dropdown.appendChild(header);
                    
                    localVars.forEach(variable => {
                        const item = createVariableItem(variable.key, variable.label, 'local');
                        dropdown.appendChild(item);
                    });
                }

                // Add global variables
                if (allVariables.length > 0) {
                    const header = document.createElement('div');
                    header.className = 'variable-item';
                    header.style.fontWeight = 'bold';
                    header.style.backgroundColor = 'var(--vscode-list-inactiveSelectionBackground)';
                    header.textContent = 'Global Variables';
                    dropdown.appendChild(header);
                    
                    allVariables.forEach(variable => {
                        const item = createVariableItem(variable.key, variable.label, 'global');
                        dropdown.appendChild(item);
                    });
                }
            }

            function createVariableItem(key, label, type) {
                const item = document.createElement('div');
                item.className = 'variable-item';
                
                // Get full variable details for tooltip
                const variableDetails = getVariableDetails(key, type);
                const tooltipText = variableDetails ? 
                    'Variable: ' + key + '\\nLabel: ' + label + '\\nType: ' + variableDetails.type + 
                    (variableDetails.defaultValue ? '\\nDefault: ' + variableDetails.defaultValue : '') :
                    'Variable: ' + key + '\\nLabel: ' + label;
                
                item.title = tooltipText;
                item.innerHTML = '<div class="variable-key">' + key + '</div><div class="variable-label">' + label + '</div>';
                
                item.addEventListener('click', function() {
                    insertVariable(key);
                    hideVariableDropdown();
                });
                
                return item;
            }

            function getVariableDetails(key, source) {
                if (source === 'local') {
                    const localVars = getLocalVariables();
                    const found = localVars.find(v => v.key === key);
                    if (found) {
                        // Get full details from form
                        const variablesContainer = document.getElementById('variables-container');
                        const variableElements = variablesContainer.querySelectorAll('.variable-item');
                        for (const el of variableElements) {
                            const elKey = el.querySelector('[data-field="key"]').value;
                            if (elKey === key) {
                                return {
                                    key: key,
                                    label: el.querySelector('[data-field="label"]').value,
                                    type: el.querySelector('[data-field="type"]').value,
                                    defaultValue: el.querySelector('[data-field="defaultValue"]').value
                                };
                            }
                        }
                    }
                } else if (source === 'global') {
                    const found = allVariables.find(v => v.key === key);
                    if (found) {
                        return {
                            key: found.key,
                            label: found.label,
                            type: 'shared',
                            defaultValue: found.value || found.options?.join(', ')
                        };
                    }
                }
                return null;
            }

            function insertVariable(key) {
                const text = commandTextarea.value;
                const beforeCursor = text.substring(0, currentCursorPos - 1); // Remove the {
                const afterCursor = text.substring(currentCursorPos);
                const newText = beforeCursor + '{' + key + '}' + afterCursor;
                
                commandTextarea.value = newText;
                
                // Update cursor position
                const newCursorPos = currentCursorPos + key.length + 1; // +1 for the }
                commandTextarea.setSelectionRange(newCursorPos, newCursorPos);
                
                // Convert to links
                setTimeout(() => convertVariablesToLinks(), 100);
            }

            function loadAllVariables() {
                // Request global variables from extension
                vscode.postMessage({ type: 'getGlobalVariables' });
            }

            function getLocalVariables() {
                const variablesContainer = document.getElementById('variables-container');
                const variables = [];
                
                variablesContainer.querySelectorAll('.variable').forEach(variableEl => {
                    const key = variableEl.querySelector('.variable-key').textContent;
                    const label = variableEl.querySelector('.variable-label').textContent;
                    variables.push({ key, label });
                });
                
                return variables;
            }

            function convertVariablesToLinks() {
                const text = commandTextarea.value;
                const textareaContainer = commandTextarea.parentElement;
                
                // Create a temporary div to work with HTML
                const tempDiv = document.createElement('div');
                tempDiv.style.position = 'absolute';
                tempDiv.style.visibility = 'hidden';
                tempDiv.style.whiteSpace = 'pre-wrap';
                tempDiv.style.font = window.getComputedStyle(commandTextarea).font;
                tempDiv.style.width = commandTextarea.offsetWidth + 'px';
                tempDiv.style.padding = window.getComputedStyle(commandTextarea).padding;
                
                // Replace {variable} with clickable links
                let htmlText = text.replace(/\{([^}]+)\}/g, function(match, variable) {
                    return '<span class="variable-link" data-variable="' + variable + '">' + match + '</span>';
                });
                
                tempDiv.innerHTML = htmlText;
                document.body.appendChild(tempDiv);
                
                // Add click handlers to links
                tempDiv.querySelectorAll('.variable-link').forEach(link => {
                    link.addEventListener('click', function() {
                        const variable = this.getAttribute('data-variable');
                        // Send message to extension to open command config
                        vscode.postMessage({ 
                            type: 'openCommandConfig', 
                            variable: variable 
                        });
                    });
                });
                
                document.body.removeChild(tempDiv);
            }

            // Listen for global variables response
            window.addEventListener('message', function(event) {
                const message = event.data;
                if (message.type === 'globalVariables') {
                    allVariables = message.variables || [];
                }
            });
        }

        // Load variables
        function loadVariables(variables) {
            const container = document.getElementById('variables-container');
            container.innerHTML = '';
            
            variables.forEach((variable, index) => {
                addVariable(variable, index);
            });
        }

        // Add variable
        function addVariable(variable = null, index = null) {
            const container = document.getElementById('variables-container');
            const variableDiv = document.createElement('div');
            variableDiv.className = 'variable-item';
            
            variableDiv.innerHTML = 
                '<input type="text" placeholder="Variable key" value="' + (variable?.key || '') + '" data-field="key">' +
                '<input type="text" placeholder="Variable label" value="' + (variable?.label || '') + '" data-field="label">' +
                '<select data-field="type">' +
                    '<option value="input"' + (variable?.type === 'input' ? ' selected' : '') + '>Input</option>' +
                    '<option value="quickpick"' + (variable?.type === 'quickpick' ? ' selected' : '') + '>Quick Pick</option>' +
                    '<option value="file"' + (variable?.type === 'file' ? ' selected' : '') + '>File</option>' +
                    '<option value="folder"' + (variable?.type === 'folder' ? ' selected' : '') + '>Folder</option>' +
                    '<option value="environment"' + (variable?.type === 'environment' ? ' selected' : '') + '>Environment</option>' +
                '</select>' +
                '<input type="text" placeholder="Default value" value="' + (variable?.defaultValue || '') + '" data-field="defaultValue">' +
                '<button type="button" class="remove-variable" onclick="removeVariable(this)">Remove</button>';
            
            container.appendChild(variableDiv);
        }

        // Remove variable
        function removeVariable(button) {
            button.parentElement.remove();
        }

        // Form submission
        document.getElementById('command-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const command = {
                id: document.getElementById('command-id').value,
                label: document.getElementById('command-label').value,
                description: document.getElementById('command-description').value,
                command: document.getElementById('command-command').value,
                icon: document.getElementById('command-icon').value,
                terminal: {
                    type: document.getElementById('terminal-type').value,
                    name: document.getElementById('terminal-name').value,
                    keepOpen: document.getElementById('keep-open').checked,
                    clearBeforeRun: document.getElementById('clear-before-run').checked
                },
                variables: getVariables()
            };
            
            vscode.postMessage({ type: 'saveCommand', command });
        });

        // Get variables from form
        function getVariables() {
            const variables = [];
            const container = document.getElementById('variables-container');
            const variableItems = container.querySelectorAll('.variable-item');
            
            variableItems.forEach(item => {
                const key = item.querySelector('[data-field="key"]').value;
                const label = item.querySelector('[data-field="label"]').value;
                const type = item.querySelector('[data-field="type"]').value;
                const defaultValue = item.querySelector('[data-field="defaultValue"]').value;
                
                if (key && label && type) {
                    variables.push({
                        key,
                        label,
                        type,
                        defaultValue: defaultValue || undefined
                    });
                }
            });
            
            return variables;
        }


        // Update icon preview
        function updateIconPreview() {
            const iconSelect = document.getElementById('command-icon');
            const preview = document.getElementById('icon-preview');
            const previewIcon = document.getElementById('icon-preview-icon');
            const previewText = document.getElementById('icon-preview-text');
            
            const selectedIcon = iconSelect.value;
            
            if (selectedIcon) {
                // Display the icon using the VS Code icon format
                const iconClass = selectedIcon.replace('$(', '').replace(')', '');
                previewIcon.innerHTML = '<span class="codicon codicon-' + iconClass + '"></span>';
                previewText.textContent = 'Icon Preview: ' + iconSelect.options[iconSelect.selectedIndex].text;
                preview.style.display = 'flex';
            } else {
                preview.style.display = 'none';
            }
        }

        function cancel() {
            vscode.postMessage({ type: 'close' });
        }

        // Initialize
        loadConfig();
    </script>
</body>
</html>`;
  }

  private async saveCommand(command: Command): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      
      // Find and update existing command or add new one
      let commandFound = false;
      for (const folder of config.folders) {
        for (let i = 0; i < folder.commands.length; i++) {
          if (folder.commands[i].id === command.id) {
            folder.commands[i] = command;
            commandFound = true;
            break;
          }
        }
        if (commandFound) break;
      }

      if (!commandFound) {
        // Add to first folder if not found
        if (config.folders.length > 0) {
          config.folders[0].commands.push(command);
        }
      }

      await this.configManager.saveConfig(config);
      vscode.window.showInformationMessage('Command saved successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save command: ${error}`);
    }
  }

  private sendGlobalVariables(): void {
    if (this.panel) {
      const config = this.configManager.getConfig();
      const globalVariables = config.sharedVariables || [];
      this.panel?.webview.postMessage({
        type: 'globalVariables',
        variables: globalVariables
      });
    }
  }

  private async openCommandConfig(variable: string): Promise<void> {
    try {
      const config = await this.configManager.getConfig();
      
      // Find the command that contains this variable
      let targetCommand: any = null;
      let targetFolder: any = null;
      
      for (const folder of config.folders || []) {
        for (const command of folder.commands || []) {
          if (command.command && command.command.includes(`{${variable}}`)) {
            targetCommand = command;
            targetFolder = folder;
            break;
          }
        }
        if (targetCommand) break;
      }
      
      if (targetCommand) {
        // Close current panel and open command editor
        this.panel?.dispose();
        this.showCommandEditor(targetCommand);
      } else {
        vscode.window.showInformationMessage(`No command found using variable "${variable}"`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open command config: ${error}`);
    }
  }

  private async saveConfig(config: CommandConfig): Promise<void> {
    try {
      await this.configManager.saveConfig(config);
      vscode.window.showInformationMessage('Configuration saved successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
    }
  }

  private sendConfig(): void {
    const config = this.configManager.getConfig();
    this.panel?.webview.postMessage({ type: 'config', config });
  }

  private async saveSharedVariable(variable: SharedVariable): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.sharedVariables) {
        config.sharedVariables = [];
      }
      
      const existingIndex = config.sharedVariables.findIndex(v => v.key === variable.key);
      if (existingIndex >= 0) {
        config.sharedVariables[existingIndex] = variable;
      } else {
        config.sharedVariables.push(variable);
      }
      
      await this.configManager.saveConfig(config);
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage('Shared variable saved successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save shared variable: ${error}`);
    }
  }

  private async saveSharedList(list: SharedList): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.sharedLists) {
        config.sharedLists = [];
      }
      
      const existingIndex = config.sharedLists.findIndex(l => l.key === list.key);
      if (existingIndex >= 0) {
        config.sharedLists[existingIndex] = list;
      } else {
        config.sharedLists.push(list);
      }
      
      await this.configManager.saveConfig(config);
      this.sendConfigToConfigPanel();
      vscode.window.showInformationMessage('Shared list saved successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save shared list: ${error}`);
    }
  }

  private async deleteSharedVariable(key: string): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (config.sharedVariables) {
        config.sharedVariables = config.sharedVariables.filter(v => v.key !== key);
        await this.configManager.saveConfig(config);
        this.sendConfigToConfigPanel();
        vscode.window.showInformationMessage('Shared variable deleted successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete shared variable: ${error}`);
    }
  }

  private async deleteSharedList(key: string): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (config.sharedLists) {
        config.sharedLists = config.sharedLists.filter(l => l.key !== key);
        await this.configManager.saveConfig(config);
        this.sendConfigToConfigPanel();
        vscode.window.showInformationMessage('Shared list deleted successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete shared list: ${error}`);
    }
  }

  private sendConfigToConfigPanel(): void {
    const config = this.configManager.getConfig();
    this.configPanel?.webview.postMessage({ 
      type: 'config', 
      config: config
    });
  }

  public dispose(): void {
    this.panel?.dispose();
    this.configPanel?.dispose();
    this.configManager = null as any;
  }

  public showWebview(): void {
    this.showCommandEditor();
  }

  public showVariableManager(): void {
    // TODO: Implement variable manager webview
    vscode.window.showInformationMessage('Variable manager not yet implemented');
  }

  public showConfigurationManager(): void {
    if (this.configPanel) {
      this.configPanel.reveal();
      return;
    }

    this.configPanel = vscode.window.createWebviewPanel(
      'commandConfig',
      'Command Configuration',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources'))]
      }
    );

    this.configPanel.webview.html = this.getConfigWebviewContent();

    this.configPanel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'saveSharedVariable':
            await this.saveSharedVariable(message.variable);
            break;
          case 'saveSharedList':
            await this.saveSharedList(message.list);
            break;
          case 'deleteSharedVariable':
            await this.deleteSharedVariable(message.key);
            break;
          case 'deleteSharedList':
            await this.deleteSharedList(message.key);
            break;
          case 'getConfig':
            this.sendConfigToConfigPanel();
            break;
          case 'saveConfig':
            await this.saveConfig(message.config);
            break;
          case 'close':
            this.configPanel?.dispose();
            break;
        }
      },
      undefined,
      []
    );

    this.configPanel.onDidDispose(() => {
      this.configPanel = undefined;
    });

    this.sendConfigToConfigPanel();
  }

  public handleWebviewMessage(message: any): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  private async saveFolder(folder: Folder, folderPath?: string): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      
      if (!folderPath) {
        // New folder - add to root
        config.folders.push(folder);
      } else {
        // Update existing folder
        const pathParts = folderPath.split('/').filter(p => p);
        let currentFolders = config.folders;
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderIndex = parseInt(pathParts[i]);
          if (currentFolders[folderIndex].subfolders) {
            currentFolders = currentFolders[folderIndex].subfolders!;
          }
        }
        
        const lastIndex = parseInt(pathParts[pathParts.length - 1]);
        currentFolders[lastIndex] = folder;
      }

      await this.configManager.saveConfig(config);
      vscode.window.showInformationMessage('Folder saved successfully');
      this.panel?.dispose();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save folder: ${error}`);
    }
  }

  private getFolderEditorContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Folder Editor</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.36/dist/codicon.css">
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: 11px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 8px;
        }
        .container {
            max-width: 700px;
            margin: 0 auto;
        }
        .form-group {
            margin-bottom: 8px;
        }
        label {
            display: block;
            margin-bottom: 2px;
            font-weight: bold;
            font-size: 12px;
        }
        input, textarea, select {
            width: 100%;
            padding: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 12px;
        }
        textarea {
            height: 60px;
            resize: vertical;
        }
        .icon-preview {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 5px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
        }
        .icon-preview-icon {
            font-size: 16px;
            color: var(--vscode-foreground);
        }
        .icon-preview-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .codicon {
            font-family: 'codicon';
            font-size: 16px;
            color: var(--vscode-foreground);
            display: inline-block;
            font-style: normal;
            font-variant: normal;
            text-rendering: auto;
            line-height: 1;
        }
        .button-group {
            display: flex;
            gap: 6px;
            margin-top: 12px;
        }
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="margin: 0 0 12px 0; font-size: 16px;">Folder Editor</h1>
        
        <form id="folder-form">
            <input type="hidden" id="folder-path">
            <input type="hidden" id="folder-commands">
            <input type="hidden" id="folder-subfolders">

            <div class="form-group">
                <label for="folder-icon">Icon:</label>
                <select id="folder-icon" onchange="updateIconPreview()">
                    <option value="">No Icon</option>
                    <option value="$(folder)" data-icon="folder">📁 Folder</option>
                    <option value="$(folder-opened)" data-icon="folder-opened">📂 Folder Opened</option>
                    <option value="$(folder-active)" data-icon="folder-active">📂 Folder Active</option>
                    <option value="$(file-directory)" data-icon="file-directory">📁 Directory</option>
                    <option value="$(repo)" data-icon="repo">📦 Repository</option>
                    <option value="$(project)" data-icon="project">🗂 Project</option>
                    <option value="$(package)" data-icon="package">📦 Package</option>
                    <option value="$(gear)" data-icon="gear">⚙ Settings</option>
                    <option value="$(tools)" data-icon="tools">🔧 Tools</option>
                    <option value="$(rocket)" data-icon="rocket">🚀 Rocket</option>
                    <option value="$(star)" data-icon="star">⭐ Star</option>
                    <option value="$(heart)" data-icon="heart">❤ Heart</option>
                    <option value="$(briefcase)" data-icon="briefcase">💼 Briefcase</option>
                    <option value="$(archive)" data-icon="archive">🗄 Archive</option>
                    <option value="$(database)" data-icon="database">🗄 Database</option>
                    <option value="$(server)" data-icon="server">🖥 Server</option>
                    <option value="$(cloud)" data-icon="cloud">☁ Cloud</option>
                    <option value="$(globe)" data-icon="globe">🌍 Globe</option>
                    <option value="$(book)" data-icon="book">📖 Book</option>
                    <option value="$(code)" data-icon="code">💻 Code</option>
                    <option value="$(terminal)" data-icon="terminal">💻 Terminal</option>
                </select>
                <div id="icon-preview" class="icon-preview" style="display: none;">
                    <span id="icon-preview-icon" class="icon-preview-icon"></span>
                    <span id="icon-preview-text" class="icon-preview-text">Icon Preview</span>
                </div>
            </div>

            <div class="form-group">
                <label for="folder-name">Name:</label>
                <input type="text" id="folder-name" placeholder="Enter folder name" required>
            </div>

            <div class="form-group">
                <label for="folder-description">Description:</label>
                <textarea id="folder-description" placeholder="Optional folder description"></textarea>
            </div>

            <div class="button-group">
                <button type="submit" class="btn-primary">Save Folder</button>
                <button type="button" class="btn-secondary" onclick="cancel()">Cancel</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentFolder = null;
        let currentFolderPath = null;

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'editFolder':
                    currentFolder = message.folder;
                    currentFolderPath = message.folderPath;
                    loadFolder(message.folder);
                    break;
            }
        });

        // Load folder into form
        function loadFolder(folder) {
            document.getElementById('folder-name').value = folder.name || '';
            document.getElementById('folder-icon').value = folder.icon || '';
            document.getElementById('folder-description').value = folder.description || '';
            document.getElementById('folder-path').value = currentFolderPath || '';
            document.getElementById('folder-commands').value = JSON.stringify(folder.commands || []);
            document.getElementById('folder-subfolders').value = JSON.stringify(folder.subfolders || []);
            
            // Update icon preview when loading folder
            updateIconPreview();
        }

        // Update icon preview
        function updateIconPreview() {
            const iconSelect = document.getElementById('folder-icon');
            const preview = document.getElementById('icon-preview');
            const previewIcon = document.getElementById('icon-preview-icon');
            const previewText = document.getElementById('icon-preview-text');
            
            const selectedIcon = iconSelect.value;
            
            if (selectedIcon) {
                // Display the icon using the VS Code icon format
                const iconClass = selectedIcon.replace('$(', '').replace(')', '');
                previewIcon.innerHTML = '<span class="codicon codicon-' + iconClass + '"></span>';
                previewText.textContent = 'Icon Preview: ' + iconSelect.options[iconSelect.selectedIndex].text;
                preview.style.display = 'flex';
            } else {
                preview.style.display = 'none';
            }
        }

        // Form submission
        document.getElementById('folder-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const folder = {
                name: document.getElementById('folder-name').value,
                icon: document.getElementById('folder-icon').value || undefined,
                description: document.getElementById('folder-description').value || undefined,
                commands: JSON.parse(document.getElementById('folder-commands').value),
                subfolders: JSON.parse(document.getElementById('folder-subfolders').value)
            };

            // Remove empty arrays
            if (folder.commands.length === 0) {
                folder.commands = currentFolder?.commands || [];
            }
            if (folder.subfolders && folder.subfolders.length === 0) {
                folder.subfolders = currentFolder?.subfolders;
            }
            
            vscode.postMessage({ 
                type: 'saveFolder', 
                folder,
                folderPath: document.getElementById('folder-path').value || undefined
            });
        });

        function cancel() {
            vscode.postMessage({ type: 'close' });
        }
    </script>
</body>
</html>`;
  }

  private getConfigWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Command Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: 11px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 8px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .section {
            margin-bottom: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            padding: 8px;
        }
        .section h2 {
            margin: 0 0 8px 0;
            font-size: 12px;
            color: var(--vscode-foreground);
        }
        .form-group {
            margin-bottom: 6px;
        }
        .form-row {
            display: flex;
            gap: 8px;
            align-items: end;
        }
        .form-row .form-group {
            flex: 1;
            margin-bottom: 0;
        }
        label {
            display: block;
            margin-bottom: 2px;
            font-weight: bold;
            font-size: 11px;
        }
        input, textarea, select {
            width: 100%;
            padding: 4px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 11px;
        }
        textarea {
            height: 40px;
            resize: vertical;
        }
        .button-group {
            display: flex;
            gap: 4px;
            margin-top: 8px;
        }
        button {
            padding: 4px 8px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-danger {
            background-color: var(--vscode-errorForeground);
            color: white;
        }
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .btn-danger:hover {
            background-color: var(--vscode-errorForeground);
            opacity: 0.8;
        }
        .item-list {
            margin-top: 6px;
        }
        .item {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            margin-bottom: 4px;
            background-color: var(--vscode-editor-background);
        }
        .item-info {
            flex: 1;
        }
        .item-key {
            font-weight: bold;
            color: var(--vscode-foreground);
            font-size: 11px;
        }
        .item-label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .item-actions {
            display: flex;
            gap: 2px;
        }
        .btn-small {
            padding: 2px 4px;
            font-size: 9px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 style="margin: 0 0 8px 0; font-size: 14px;">Command Configuration</h1>

        <div class="section">
            <h2>Shared Variables</h2>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">Variables that can be used across all commands with fixed values.</p>
            
            <form id="variable-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="variable-key">Key:</label>
                        <input type="text" id="variable-key" placeholder="e.g., PROJECT_ROOT" required>
                    </div>
                    <div class="form-group">
                        <label for="variable-label">Label:</label>
                        <input type="text" id="variable-label" placeholder="e.g., Project Root Path" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="variable-value">Value:</label>
                    <input type="text" id="variable-value" placeholder="e.g., /path/to/project" required>
                </div>
                <div class="form-group">
                    <label for="variable-description">Description:</label>
                    <textarea id="variable-description" placeholder="Optional description"></textarea>
                </div>
                <button type="submit" class="btn-primary">Add Variable</button>
            </form>

            <div class="item-list" id="variables-list">
                <!-- Variables will be loaded here -->
            </div>
        </div>

        <div class="section">
            <h2>Shared Lists</h2>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">Lists that provide options to choose from when running commands.</p>
            
            <form id="list-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="list-key">Key:</label>
                        <input type="text" id="list-key" placeholder="e.g., ENVIRONMENT" required>
                    </div>
                    <div class="form-group">
                        <label for="list-label">Label:</label>
                        <input type="text" id="list-label" placeholder="e.g., Environment" required>
                    </div>
                </div>
                <div class="form-group">
                    <label for="list-options">Options (one per line):</label>
                    <textarea id="list-options" placeholder="development&#10;staging&#10;production" required></textarea>
                </div>
                <div class="form-group">
                    <label for="list-description">Description:</label>
                    <textarea id="list-description" placeholder="Optional description"></textarea>
                </div>
                <button type="submit" class="btn-primary">Add List</button>
            </form>

            <div class="item-list" id="lists-list">
                <!-- Lists will be loaded here -->
            </div>
        </div>

        <div class="section">
            <h2>JSON Editor</h2>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: var(--vscode-descriptionForeground);">Edit the complete configuration in JSON format.</p>
            
            <textarea id="json-editor" placeholder="JSON configuration will appear here" style="width: 100%; height: 300px; font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; border: 1px solid var(--vscode-input-border); background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; resize: vertical;"></textarea>
            
            <div class="button-group">
                <button type="button" class="btn-primary" onclick="saveJsonConfig()">Save JSON Config</button>
            </div>
        </div>

        <div class="button-group">
            <button type="button" class="btn-secondary" onclick="closePanel()">Close</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentConfig = null;

        // Load configuration
        function loadConfig() {
            vscode.postMessage({ type: 'getConfig' });
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'config':
                    currentConfig = message.config;
                    loadVariables();
                    loadLists();
                    loadJsonConfig();
                    break;
            }
        });

        // Variable management
        document.getElementById('variable-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const variable = {
                key: document.getElementById('variable-key').value,
                label: document.getElementById('variable-label').value,
                value: document.getElementById('variable-value').value,
                description: document.getElementById('variable-description').value || undefined
            };
            
            vscode.postMessage({ type: 'saveSharedVariable', variable });
            document.getElementById('variable-form').reset();
        });

        // List management
        document.getElementById('list-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const options = document.getElementById('list-options').value
                .split('\n')
                .map(opt => opt.trim())
                .filter(opt => opt.length > 0);
            
            const list = {
                key: document.getElementById('list-key').value,
                label: document.getElementById('list-label').value,
                options: options,
                description: document.getElementById('list-description').value || undefined
            };
            
            vscode.postMessage({ type: 'saveSharedList', list });
            document.getElementById('list-form').reset();
        });

        function loadVariables() {
            const container = document.getElementById('variables-list');
            container.innerHTML = '';
            
            if (currentConfig.sharedVariables) {
                currentConfig.sharedVariables.forEach(variable => {
                    const div = document.createElement('div');
                    div.className = 'item';
                    div.innerHTML = 
                        '<div class="item-info">' +
                            '<div class="item-key">' + variable.key + '</div>' +
                            '<div class="item-label">' + variable.label + ': ' + variable.value + '</div>' +
                            (variable.description ? '<div class="item-label">' + variable.description + '</div>' : '') +
                        '</div>' +
                        '<div class="item-actions">' +
                            '<button type="button" class="btn-danger btn-small" onclick="deleteVariable(\'' + variable.key + '\')">Delete</button>' +
                        '</div>';
                    container.appendChild(div);
                });
            }
        }

        function loadLists() {
            const container = document.getElementById('lists-list');
            container.innerHTML = '';
            
            if (currentConfig.sharedLists) {
                currentConfig.sharedLists.forEach(list => {
                    const div = document.createElement('div');
                    div.className = 'item';
                    div.innerHTML = 
                        '<div class="item-info">' +
                            '<div class="item-key">' + list.key + '</div>' +
                            '<div class="item-label">' + list.label + ': ' + list.options.join(', ') + '</div>' +
                            (list.description ? '<div class="item-label">' + list.description + '</div>' : '') +
                        '</div>' +
                        '<div class="item-actions">' +
                            '<button type="button" class="btn-danger btn-small" onclick="deleteList(\'' + list.key + '\')">Delete</button>' +
                        '</div>';
                    container.appendChild(div);
                });
            }
        }

        function deleteVariable(key) {
            if (confirm('Are you sure you want to delete this variable?')) {
                vscode.postMessage({ type: 'deleteSharedVariable', key });
            }
        }

        function deleteList(key) {
            if (confirm('Are you sure you want to delete this list?')) {
                vscode.postMessage({ type: 'deleteSharedList', key });
            }
        }

        function closePanel() {
            vscode.postMessage({ type: 'close' });
        }

        // JSON editor functions
        function loadJsonConfig() {
            if (currentConfig) {
                document.getElementById('json-editor').value = JSON.stringify(currentConfig, null, 2);
            }
        }

        function saveJsonConfig() {
            try {
                const jsonText = document.getElementById('json-editor').value;
                if (!jsonText.trim()) {
                    alert('Please enter JSON configuration');
                    return;
                }
                
                const config = JSON.parse(jsonText);
                
                // Basic validation
                if (!config.folders || !Array.isArray(config.folders)) {
                    alert('Invalid JSON: Configuration must have a "folders" array');
                    return;
                }
                
                vscode.postMessage({ type: 'saveConfig', config });
            } catch (error) {
                alert('Invalid JSON: ' + error.message);
            }

        }

        // Initialize
        loadConfig();
    </script>
</body>
</html>`;
  }
}

