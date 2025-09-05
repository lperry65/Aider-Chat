/**
 * Aider VS Code Extension - Main Entry Point
 * Minimal activation following VS Code best practices
 */

import * as vscode from 'vscode';
import { AiderChatViewProvider } from './providers/AiderChatViewProvider';
import { EXTENSION_CONFIG } from './config/constants';
import { ExtensionDependencies } from './types';
import { handleError, disposeErrorHandler } from './utils/errorHandler';

// Global provider instance for proper disposal
let aiderChatProvider: AiderChatViewProvider | undefined;

/**
 * Extension activation - follows VS Code best practices
 */
export function activate(context: vscode.ExtensionContext): void {
  try {
    console.log(EXTENSION_CONFIG.MESSAGES.EXTENSION_ACTIVATED);

    // Create dependencies
    const dependencies: ExtensionDependencies = {
      context
    };

    // Create and register WebView provider
    aiderChatProvider = new AiderChatViewProvider(dependencies);

    const providerDisposable = vscode.window.registerWebviewViewProvider(
      AiderChatViewProvider.viewType,
      aiderChatProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: EXTENSION_CONFIG.WEBVIEW.RETAIN_CONTEXT
        }
      }
    );

    // Register start command
    const startCommandDisposable = vscode.commands.registerCommand(
      EXTENSION_CONFIG.COMMAND_ID,
      () => {
        // Focus the sidebar view
        vscode.commands.executeCommand(`${EXTENSION_CONFIG.VIEW_TYPE}.focus`);
      }
    );

    // Register all disposables with context.subscriptions (VS Code best practice)
    context.subscriptions.push(
      providerDisposable,
      startCommandDisposable
      // Provider disposal will be handled in deactivate()
    );

    console.log('Aider Extension activation completed successfully!');
  } catch (error) {
    const errorMessage = `${EXTENSION_CONFIG.MESSAGES.ACTIVATION_FAILED}: ${error}`;
    console.error(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
    handleError(error, 'extension_activation');
  }
}

/**
 * Extension deactivation - proper cleanup following VS Code best practices
 */
export function deactivate(): void {
  try {
    // Dispose of provider resources
    if (aiderChatProvider) {
      aiderChatProvider.dispose();
      aiderChatProvider = undefined;
    }

    // Dispose of global error handler
    disposeErrorHandler();

    console.log('Aider Extension deactivated successfully');
  } catch (error) {
    console.error('Error during extension deactivation:', error);
    // Don't show error messages during deactivation
  }
}
