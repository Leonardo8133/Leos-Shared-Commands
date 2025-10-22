"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCancelledError = exports.MissingVariableError = void 0;
class MissingVariableError extends Error {
    constructor(key) {
        super(`Missing variable: ${key}`);
        this.key = key;
        this.name = 'MissingVariableError';
    }
}
exports.MissingVariableError = MissingVariableError;
class UserCancelledError extends Error {
    constructor() {
        super('Command execution cancelled by user');
        this.name = 'UserCancelledError';
    }
}
exports.UserCancelledError = UserCancelledError;
//# sourceMappingURL=errors.js.map