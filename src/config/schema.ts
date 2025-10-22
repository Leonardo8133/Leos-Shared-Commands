import { CommandConfig } from '../types';

export function getDefaultConfig(): CommandConfig {
  return {
    folders: [
      {
        name: "Examples",
        icon: "📝",
        commands: [
          {
            id: "example-1",
            label: "Echo Hello",
            command: "echo Hello World",
            terminal: {
              type: "vscode-new",
              name: "Echo Example",
              keepOpen: true
            },
            description: "Simple echo command example"
          },
          {
            id: "example-2",
            label: "Django Server",
            command: "docker compose run -e SITE=${input:site} --service-ports --rm django ./manage.py runserver 0.0.0.0:8000",
            terminal: {
              type: "vscode-new",
              name: "Django Server",
              keepOpen: true
            },
            variables: [
              {
                key: "site",
                label: "Site",
                type: "quickpick",
                options: ["alphabuyer", "betaseller"],
                remember: true,
                defaultValue: "alphabuyer"
              }
            ],
            description: "Run Django development server with site selection"
          }
        ]
      }
    ],
    globalVariables: [
      {
        key: "PROJECT_ROOT",
        value: "${workspaceFolder}"
      }
    ]
  };
}

export function validateConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }

  if (!Array.isArray(config.folders)) {
    errors.push('Config must have a folders array');
  }

  if (config.folders) {
    config.folders.forEach((folder: any, index: number) => {
      if (!folder.name || typeof folder.name !== 'string') {
        errors.push(`Folder ${index} must have a name`);
      }
      if (!Array.isArray(folder.commands)) {
        errors.push(`Folder ${index} must have a commands array`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
