/**
 * Start Aider Command - Handles the startAider command implementation
 * Follows Single Responsibility Principle
 */

import * as vscode from 'vscode';
import { EXTENSION_CONFIG } from '../config/constants';

/**
 * Implementation of the startAider command
 * Focuses the sidebar view to show the Aider chat
 */
export function startAiderCommand(): void {
  // Focus the sidebar view
  vscode.commands.executeCommand(`${EXTENSION_CONFIG.VIEW_TYPE}.focus`);
}

/**
 * Register the startAider command with VS Code
 */
export function registerStartAiderCommand(_context: vscode.ExtensionContext): vscode.Disposable {
  console.log('⚡ Registering startAider command...');

  const commandDisposable = vscode.commands.registerCommand(
    EXTENSION_CONFIG.COMMAND_ID,
    startAiderCommand
  );

  console.log('✅ startAider command registered successfully');
  return commandDisposable;
}
