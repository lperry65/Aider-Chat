# Technical Architecture

This document outlines the architectural principles and development practices
for the Aider VS Code Extension project.

## Core Development Principles

### DRY (Don't Repeat Yourself)

- **Eliminate duplication**: Extract common functionality into reusable
  components
- **Single source of truth**: Configuration, constants, and logic should exist
  in one place
- **Shared utilities**: Create helper functions for repeated operations

### KISS (Keep It Simple, Stupid)

- **Minimal complexity**: Choose the simplest solution that works
- **Clear intent**: Code should be self-documenting through good naming
- **Single purpose**: Each function/class should do one thing well
- **Avoid over-engineering**: Don't build for hypothetical future requirements

### SOLID Principles

#### Single Responsibility Principle (SRP)

- Each class should have only one reason to change
- Separate concerns: UI logic ≠ business logic ≠ data access

#### Open/Closed Principle (OCP)

- Open for extension, closed for modification
- Use interfaces and dependency injection for extensibility

#### Liskov Substitution Principle (LSP)

- Derived classes must be substitutable for their base classes
- Maintain expected behavior in inheritance hierarchies

#### Interface Segregation Principle (ISP)

- Clients shouldn't depend on interfaces they don't use
- Create focused, specific interfaces

#### Dependency Inversion Principle (DIP)

- Depend on abstractions, not concretions
- High-level modules shouldn't depend on low-level modules

## Code Quality Standards

### Comments Philosophy

- **Add value, not noise**: Comments should explain WHY, not WHAT
- **Succinct and precise**: Avoid verbose explanations
- **Maintain relevance**: Update comments when code changes
- **Examples**:

  ```typescript
  // Good: Explains business logic
  // Restart process when model changes to avoid state conflicts

  // Bad: Restates obvious code
  // Set the current model to the new model
  ```

### Naming Conventions

- **Descriptive and clear**: Names should reveal intent
- **Consistent patterns**: Follow established conventions
- **Avoid abbreviations**: Use full words unless widely understood

### Error Handling

- **Fail fast**: Catch errors early and provide clear messages
- **Graceful degradation**: System should continue working when possible
- **User-friendly messages**: Hide technical details from end users
- **Consistent patterns**: Use common error handling utilities

## VS Code Extension Best Practices

### Activation and Lifecycle

- **Lazy activation**: Use specific activation events, avoid `*`
- **Resource cleanup**: Properly dispose of all resources in deactivate()
- **Context subscriptions**: Register all disposables with context.subscriptions
- **Minimal activation**: Only activate when extension functionality is needed
- **Extension context**: Use context.extensionUri instead of deprecated
  extensionPath
- **Async activation**: Handle activation errors gracefully with try-catch

### WebView Guidelines

- **Content Security Policy**: Always implement CSP headers for security
- **State persistence**: Use webview state API instead of
  retainContextWhenHidden
- **Resource management**: Deallocate webview documents when not visible
- **Message passing**: Use postMessage API for extension-webview communication
- **Local resources**: Use asWebviewUri() for workspace resources
- **HTML separation**: Keep HTML templates in separate files, not inline
- **Nonce generation**: Use cryptographic nonces for inline scripts

### Security Requirements

- **Sandbox webviews**: Never disable webview sandboxing
- **Input sanitization**: Validate all data from webviews and external sources
- **CSP implementation**: Restrict script and resource loading
- **URI validation**: Use proper VS Code URI handling
- **HTML escaping**: Prevent XSS with proper HTML escaping
- **Path validation**: Validate all file paths and workspace access

### Performance Optimization

- **Lazy loading**: Load resources only when needed
- **Dispose patterns**: Implement proper cleanup for event listeners
- **Memory management**: Avoid retainContextWhenHidden unless absolutely
  necessary
- **Background operations**: Use proper async patterns for long-running tasks

### File Organization (VS Code Recommended)

```text
src/
├── extension.ts        # Main activation/deactivation
├── providers/          # WebView providers and tree data providers
├── commands/           # Command implementations
├── webview/           # WebView HTML and resources
├── services/          # Business logic services
└── utils/             # Shared utilities
```

### Extension Manifest Best Practices

- **Precise activation events**: Use specific triggers (onView:, onCommand:)
- **Contribution points**: Follow VS Code's contribution model
- **Version constraints**: Specify minimum VS Code version
- **Categories**: Proper categorization for marketplace
- **Main entry point**: Point to compiled output directory (./out/extension)
- **Engine compatibility**: Specify VS Code version range

### Development Workflow

- **Build system**: Use TypeScript compiler with proper tsconfig.json
- **Watch mode**: Enable watch compilation during development
- **Testing**: Implement unit tests for core functionality
- **Packaging**: Use vsce for extension packaging and publishing
- **Debugging**: Configure launch.json for extension host debugging

## Architecture Patterns

### Separation of Concerns

- **UI Layer**: Handle user interactions and display
- **Business Logic**: Core functionality and rules
- **Data Layer**: State management and persistence
- **Infrastructure**: External dependencies and services

### Dependency Management

- **Minimal dependencies**: Only add what's necessary
- **Version pinning**: Lock to specific versions for stability
- **Abstract integrations**: Don't directly couple to external APIs

### Configuration Management

- **Environment-based**: Support different configurations per environment
- **Centralized**: Keep configuration in dedicated files/modules
- **Type-safe**: Use TypeScript interfaces for configuration objects

## File Organization

src/ ├── core/ # Business logic and domain models ├── ui/ # User interface
components ├── services/ # External service integrations ├── utils/ # Shared
utility functions ├── types/ # TypeScript type definitions └── config/ #
Configuration and constants

### File Naming

- **PascalCase**: Classes and interfaces (`AiderProcess.ts`)
- **camelCase**: Functions and variables (`processManager.ts`)
- **kebab-case**: Files and directories (`process-manager.ts`)

## Testing Strategy

### Unit Tests

- **High coverage**: Aim for >80% code coverage
- **Fast execution**: Tests should run quickly
- **Isolated**: Each test should be independent
- **Clear assertions**: Test intent should be obvious

### Integration Tests

- **Critical paths**: Test important user workflows
- **External dependencies**: Mock or stub external services
- **Error scenarios**: Test failure conditions

## Performance Considerations

### Resource Management

- **Memory efficiency**: Clean up resources and event listeners
- **Process lifecycle**: Properly manage child processes
- **Event debouncing**: Prevent excessive API calls

### User Experience

- **Responsive UI**: Don't block the main thread
- **Error feedback**: Provide immediate user feedback
- **Progressive loading**: Show content as it becomes available

## Security Guidelines

### Input Validation

- **Sanitize user input**: Never trust external data
- **Command injection**: Carefully handle shell commands
- **Path traversal**: Validate file paths and access

### Dependencies

- **Regular updates**: Keep dependencies current
- **Vulnerability scanning**: Monitor for security issues
- **Minimal privileges**: Run with least necessary permissions

## Documentation Standards

### Code Documentation

- **API documentation**: Document public interfaces
- **README updates**: Keep installation and usage current
- **Architecture decisions**: Record significant design choices

### Comments in Code

- **Business rules**: Document complex logic
- **Workarounds**: Explain temporary solutions
- **Dependencies**: Note external requirements or limitations

## Refactoring Guidelines

### When to Refactor

- **Violates principles**: Code doesn't follow DRY, KISS, or SOLID
- **Difficult to test**: Hard to write unit tests
- **Hard to understand**: Requires extensive documentation
- **Performance issues**: Identified bottlenecks

### How to Refactor

1. **Write tests first**: Ensure behavior is preserved
2. **Small increments**: Make small, focused changes
3. **Verify functionality**: Test after each change
4. **Update documentation**: Keep docs in sync

## Technology Choices

### Primary Stack

- **TypeScript**: Type safety and modern language features
- **VS Code API**: Native integration with editor
- **Node.js**: Runtime environment

### External Dependencies

- **node-pty**: Real terminal functionality
- **Minimal additions**: Each dependency must justify its inclusion

### Development Tools

- **ESLint**: Code quality and consistency
- **TypeScript compiler**: Type checking and compilation
- **VS Code debugger**: Built-in debugging support

## Future Considerations

### Extensibility

- **Plugin architecture**: Allow third-party extensions
- **Configuration options**: Support user customization
- **API design**: Plan for future feature additions

### Maintainability

- **Clear ownership**: Document who maintains what
- **Upgrade paths**: Plan for dependency updates
- **Backward compatibility**: Minimize breaking changes

---

_This document should be updated as the project evolves and new architectural
decisions are made._
