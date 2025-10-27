# vscode-extension-tester setup

This folder contains an initial `vscode-extension-tester` harness that can be
used to validate UI scenarios locally or in CI.

## Prerequisites

1. Install dependencies (requires access to the public npm registry):
   ```bash
   npm install --save-dev vscode-extension-tester @types/vscode-extension-tester
   ```
2. The suite uses the fixture workspace stored in
   `et-tests/fixtures/python-flowchart`.

## Running the sample tests

The npm script below executes both the example smoke test and the flowchart
command coverage using the CLI runner:

```bash
npm run test:vet
```

If the CLI is not yet installed you can run the command with `npx` directly:

```bash
npx vscode-extension-tester --config ./et-tests/mocha-vscode.json
```

> **Note**
> This environment does not have network access, so the packages were not
> downloaded automatically. When running locally make sure to install the
> dependencies before executing the suite.
