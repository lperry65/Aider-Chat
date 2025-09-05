# Pre-commit Hooks Configuration

This document describes the pre-commit hooks setup for the Aider VS Code
Extension project.

## Overview

Pre-commit hooks ensure code quality and consistency by automatically running
checks before each commit. Our setup includes:

- **ESLint**: TypeScript/JavaScript linting with custom rules
- **Prettier**: Code formatting for consistent style
- **Husky**: Git hooks management
- **lint-staged**: Run tools only on staged files

## Tools Configured

### ESLint (.eslintrc.json)

- **Purpose**: Static code analysis for TypeScript files
- **Rules**:
  - No unused variables (except prefixed with `_`)
  - No explicit `any` types
  - Prefer `const` over `let`
  - Single quotes for strings
  - Semicolons required
  - Console statements as warnings (allowed for VS Code extensions)

### Prettier (.prettierrc.json)

- **Purpose**: Consistent code formatting
- **Configuration**:
  - Print width: 100 characters
  - 2-space tabs
  - Single quotes
  - No trailing commas
  - LF line endings

### Husky & lint-staged

- **Purpose**: Run linting and formatting only on staged files
- **Pre-commit workflow**:
  1. ESLint auto-fix for TypeScript/JavaScript files
  2. Prettier formatting for all supported files
  3. Only runs on files being committed

## Available Scripts

```bash
# Linting
npm run lint                # Check all TypeScript files
npm run lint:fix           # Auto-fix linting issues

# Formatting
npm run format             # Format all source files
npm run format:check       # Check formatting without changes

# Type checking
npm run type-check         # TypeScript compilation check

# Pre-commit setup
npm run prepare            # Install Husky hooks (automatic)
```

## Files Ignored

### .prettierignore

- Build outputs (`out/`, `dist/`)
- Dependencies (`node_modules/`)
- Generated files (`*.d.ts`)
- Package lock files

### ESLint ignorePatterns

- Same as Prettier, focused on source code quality

## Workflow

1. **Development**: Write code normally
2. **Staging**: `git add <files>` - stages changes
3. **Committing**: `git commit -m "message"` triggers:
   - ESLint fixes on staged .ts/.js files
   - Prettier formatting on staged files
   - Commit proceeds if no errors

## Compatibility

- **Node.js**: 18+ (some packages prefer 20+)
- **ESLint**: v8.x (legacy .eslintrc.json format)
- **VS Code**: Compatible with extension development
- **TypeScript**: 4.x+ with strict type checking

## Benefits

✅ **Consistent Code Style**: Automatic formatting ✅ **Early Error Detection**:
Catch issues before commit ✅ **Team Collaboration**: Shared code standards ✅
**Zero Configuration**: Works automatically after setup ✅ **Fast**: Only
processes changed files

## Troubleshooting

### Common Issues

1. **Node version warnings**: Upgrade to Node 20+ if possible
2. **ESLint config errors**: Ensure TypeScript packages are installed
3. **Prettier conflicts**: Check .prettierignore for excluded files
4. **Hook not running**: Run `npm run prepare` to reinstall

### Manual Override

```bash
# Skip pre-commit hooks (not recommended)
git commit --no-verify -m "Emergency commit"

# Fix formatting after commit
npm run format
npm run lint:fix
```

## Integration with VS Code

The configuration works seamlessly with VS Code's built-in ESLint and Prettier
extensions, providing real-time feedback during development.
