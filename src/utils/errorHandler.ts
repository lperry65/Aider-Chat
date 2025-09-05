/**
 * Error handling utility for Aider VS Code Extension
 * Centralizes error handling following DRY principle
 */

import * as vscode from 'vscode';
import { AiderError, IErrorHandler } from '../types';
import { EXTENSION_CONFIG } from '../config/constants';

export class ErrorHandler implements IErrorHandler {
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Aider Extension');
  }

  /**
   * Handle errors with appropriate user feedback and logging
   */
  handleError(error: Error | AiderError, context?: string): void {
    this.logError(error, context);

    // Determine user-friendly message
    const userMessage = this.getUserFriendlyMessage(error, context);
    this.showUserError(userMessage);
  }

  /**
   * Show error message to user
   */
  showUserError(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  /**
   * Log error details for debugging
   */
  logError(error: Error | AiderError, context?: string): void {
    const timestamp = new Date().toISOString();
    const contextInfo = context ? ` [${context}]` : '';

    console.error(`[${timestamp}]${contextInfo} ${error.name}: ${error.message}`);

    if (error.stack) {
      console.error(error.stack);
    }

    // Log to VS Code output channel
    this.outputChannel.appendLine(`[${timestamp}]${contextInfo} Error: ${error.message}`);
    if (error.stack) {
      this.outputChannel.appendLine(error.stack);
    }
  }

  /**
   * Create user-friendly error messages hiding technical details
   */
  private getUserFriendlyMessage(error: Error | AiderError, context?: string): string {
    // Check for specific error types
    if (this.isAiderNotFound(error)) {
      return `${EXTENSION_CONFIG.MESSAGES.AIDER_START_FAILED}. Make sure Aider is installed and available in PATH.`;
    }

    if (this.isProcessError(error)) {
      return `${EXTENSION_CONFIG.MESSAGES.AIDER_START_FAILED}. Please check your Aider configuration.`;
    }

    if (this.isWebViewError(error, context)) {
      return EXTENSION_CONFIG.MESSAGES.WEBVIEW_INIT_FAILED;
    }

    // Generic error message
    return `${EXTENSION_CONFIG.MESSAGES.AIDER_START_FAILED}: ${error.message}`;
  }

  /**
   * Check if error is related to Aider not being found
   */
  private isAiderNotFound(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('not found') ||
      message.includes('enoent') ||
      message.includes('command not found')
    );
  }

  /**
   * Check if error is related to process spawning
   */
  private isProcessError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('spawn') || message.includes('process') || message.includes('pty');
  }

  /**
   * Check if error is related to webview
   */
  private isWebViewError(error: Error, context?: string): boolean {
    return (
      context?.toLowerCase().includes('webview') || error.message.toLowerCase().includes('webview')
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Singleton instance for global error handling
let errorHandlerInstance: ErrorHandler | undefined;

/**
 * Get global error handler instance
 */
export function getErrorHandler(): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}

/**
 * Dispose of global error handler
 */
export function disposeErrorHandler(): void {
  if (errorHandlerInstance) {
    errorHandlerInstance.dispose();
    errorHandlerInstance = undefined;
  }
}

/**
 * Helper function for consistent error handling
 */
export function handleError(error: unknown, context?: string): void {
  const errorHandler = getErrorHandler();

  if (error instanceof Error) {
    errorHandler.handleError(error, context);
  } else {
    // Handle non-Error objects
    const genericError = new Error(String(error));
    errorHandler.handleError(genericError, context);
  }
}

/**
 * Async wrapper that handles errors consistently
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return undefined;
  }
}
