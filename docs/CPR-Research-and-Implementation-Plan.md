# Aider Extension - CPR Issue Research and Implementation Plan

## Executive Summary

The Aider extension currently shows "Your terminal doesn't support cursor
position requests" warnings due to xterm.js limitations. Research confirms that
xterm.js does not automatically handle CPR (Cursor Position Request) sequences
like real terminals do. The recommended solution is to replace xterm.js with VS
Code's native terminal integration while keeping the existing extension
architecture and chat interface.

## Problem Analysis

### Current Issue

- **Symptom**: Aider displays CPR warnings: "Your terminal doesn't support
  cursor position requests"
- **Root Cause**: xterm.js does not automatically respond to CPR sequences
  (`\x1b[6n`)
- **Impact**: Cosmetic warnings that may affect user confidence, though Aider
  remains functional

### Technical Research

#### CPR Protocol Understanding

- **CPR Request**: `\x1b[6n` (sent by Aider to query cursor position)
- **Expected Response**: `\x1b[row;colR` (e.g., `\x1b[31;1R` for row 31,
  column 1)
- **Purpose**: Allows applications like Aider to understand terminal state for
  better display formatting

#### Ubuntu Terminal vs xterm.js Comparison

**Ubuntu Terminal (TERM=xterm-256color)**:

- ✅ Automatic CPR support via terminfo capabilities
- ✅ Built-in `u6=\E[%i%d;%dR` and `u7=\E[6n` capabilities
- ✅ Responds automatically to `\x1b[6n` with proper escape sequences
- ✅ Terminal-level handling, invisible to applications

**xterm.js 5.5.0**:

- ❌ No automatic CPR response handling
- ❌ Requires manual implementation for bidirectional communication
- ❌ GitHub issue [#4893](https://github.com/xtermjs/xterm.js/issues/4893)
  confirms missing Device Status Report support
- ⚠️ Would need custom CPR implementation in extension code

### Current Architecture Limitations

```text
Current Flow (One-way):
AiderProcess → AiderChatViewProvider → WebView(xterm.js) → Display Only

Required for CPR (Bidirectional):
AiderProcess ← (CPR response) ← WebView Handler
AiderProcess → (CPR request) → WebView(xterm.js)
```

## Research Sources

### Primary Documentation

- **xterm.js GitHub**: <https://github.com/xtermjs/xterm.js>
- **CPR Issue #4893**: <https://github.com/xtermjs/xterm.js/issues/4893> (Device
  Status Report missing)
- **xterm.js Releases**: <https://github.com/xtermjs/xterm.js/releases>
  (reviewed versions 5.0.0 - 5.5.0)

### Terminal Standards

- **Terminfo Database**: Research on `u6`/`u7` capabilities for CPR support
- **VT100/ANSI Standards**: CPR sequence definitions and expected behavior
- **Ubuntu Terminal**: Native CPR testing confirmed automatic response handling

### VS Code Extension APIs

- **Terminal API**:
  <https://code.visualstudio.com/api/references/vscode-api#Terminal>
- **Pseudoterminal API**:
  <https://code.visualstudio.com/api/references/vscode-api#Pseudoterminal>
- **Extension Samples**: <https://github.com/microsoft/vscode-extension-samples>

## Recommended Solution: VS Code Native Terminal Integration

### Why This Approach

1. **Eliminates CPR Issues**: VS Code's terminal has proper CPR support
2. **Better Integration**: Native look and feel consistent with VS Code
3. **Simpler Architecture**: No need for custom bidirectional communication
4. **Professional Experience**: Matches user expectations for terminal-based
   extensions
5. **Maintenance**: Reduces complexity and custom terminal emulation code

### Architecture Changes

**Keep Unchanged**:

- ✅ VS Code extension structure
- ✅ Chat interface and webview
- ✅ Input box and send functionality
- ✅ AiderProcess management
- ✅ File operations and commands

**Replace**:

- ❌ xterm.js webview terminal → ✅ VS Code native terminal
- ❌ Manual terminal rendering → ✅ Built-in terminal display
- ❌ Custom fit/resize logic → ✅ Automatic terminal management

## Implementation Plan

### Phase 1: Research and Design (1-2 days)

- [ ] **Study VS Code Terminal APIs**
  - Review `vscode.window.createTerminal()` options
  - Understand Pseudoterminal implementation for custom shells
  - Research terminal integration patterns in existing extensions

- [ ] **Design New Architecture**
  - Map current xterm.js functionality to VS Code Terminal API
  - Plan integration points between chat interface and terminal
  - Design terminal lifecycle management (create, show, dispose)

### Phase 2: Core Implementation (3-4 days)

- [ ] **Create Terminal Service**
  - Build `AiderTerminalService` class to manage VS Code terminals
  - Implement terminal creation with Aider process integration
  - Handle terminal lifecycle and cleanup

- [ ] **Update AiderChatViewProvider**
  - Remove xterm.js dependencies and HTML terminal element
  - Add terminal management methods
  - Update webview communication for terminal control

- [ ] **Modify AiderProcess Integration**
  - Connect AiderProcess output to VS Code terminal instead of xterm.js
  - Ensure proper TERM environment variable handling
  - Test CPR functionality with real VS Code terminal

### Phase 3: UI/UX Integration (2-3 days)

- [ ] **Chat Interface Updates**
  - Remove terminal HTML element from webview
  - Add terminal control buttons (show/hide, clear, restart)
  - Implement terminal focus management

- [ ] **Terminal Positioning**
  - Research terminal panel vs editor group placement
  - Implement user preferences for terminal location
  - Add commands for terminal management

### Phase 4: Testing and Polish (2-3 days)

- [ ] **CPR Verification**
  - Test Aider CPR requests work without warnings
  - Verify cursor positioning and display formatting
  - Compare behavior with normal terminal usage

- [ ] **Integration Testing**
  - Test all Aider commands and features
  - Verify file operations and model switching
  - Test terminal lifecycle across extension sessions

- [ ] **User Experience**
  - Polish terminal integration UX
  - Add proper error handling and recovery
  - Document new terminal-based workflow

## Technical Implementation Details

### VS Code Terminal API Usage

```typescript
// Create terminal with Aider process
const terminal = vscode.window.createTerminal({
  name: 'Aider Chat',
  shellPath: aiderExecutable,
  shellArgs: aiderArgs,
  env: processEnvironment,
  cwd: workspaceRoot
});

// Show terminal in panel
terminal.show(preserveFocus: false);

// Send commands to terminal
terminal.sendText(userInput, addNewLine: true);
```

### Benefits Over xterm.js

1. **Automatic CPR Support**: No custom implementation needed
2. **Native Integration**: Consistent with VS Code's terminal behavior
3. **Reduced Complexity**: Eliminates custom terminal emulation code
4. **Better Performance**: Leverages VS Code's optimized terminal rendering
5. **Feature Parity**: Access to all VS Code terminal features (themes, fonts,
   etc.)

## Risk Assessment

### Low Risk

- ✅ VS Code Terminal API is stable and well-documented
- ✅ Keeps existing extension architecture intact
- ✅ No breaking changes to user workflow

### Medium Risk

- ⚠️ Need to handle terminal lifecycle properly
- ⚠️ May require adjustments to chat interface layout
- ⚠️ Terminal positioning preferences may vary by user

### Mitigation Strategies

- Implement proper error handling and fallback options
- Add user preferences for terminal behavior
- Maintain backward compatibility during transition

## Success Criteria

### Primary Goals

- [ ] ✅ No more CPR warnings from Aider
- [ ] ✅ Professional terminal experience matching VS Code standards
- [ ] ✅ All existing Aider functionality preserved
- [ ] ✅ Chat interface remains fully functional

### Secondary Goals

- [ ] ✅ Improved terminal performance and responsiveness
- [ ] ✅ Better integration with VS Code themes and settings
- [ ] ✅ Reduced extension bundle size (removing xterm.js dependencies)
- [ ] ✅ Simplified codebase maintenance

## Timeline Estimate

**Total Duration**: 8-12 days

- **Week 1**: Research, design, and core implementation (Days 1-6)
- **Week 2**: Integration, testing, and polish (Days 7-12)

## Next Steps

1. **Immediate Actions**:
   - Review VS Code Terminal API documentation
   - Create prototype terminal integration
   - Test CPR behavior with VS Code terminal

2. **Short Term**:
   - Begin Phase 1 implementation
   - Set up development and testing environment
   - Create backup branch for current xterm.js implementation

3. **Long Term**:
   - Complete implementation and testing
   - Gather user feedback on new terminal integration
   - Consider additional terminal-based features

---

## Notes

- This document serves as the comprehensive research and implementation guide
- All technical decisions are based on confirmed research from official sources
- Implementation plan is designed to minimize risk while maximizing user
  experience improvement
- Timeline estimates include buffer time for testing and iteration

**Created**: September 8, 2025 **Last Updated**: September 8, 2025 **Status**:
Ready for Implementation
