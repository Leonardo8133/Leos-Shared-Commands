export class MissingVariableError extends Error {
  constructor(public readonly key: string) {
    super(`Missing variable: ${key}`);
    this.name = 'MissingVariableError';
  }
}

export class UserCancelledError extends Error {
  constructor() {
    super('Command execution cancelled by user');
    this.name = 'UserCancelledError';
  }
}
