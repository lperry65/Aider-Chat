/**
 * Type definitions for Aider VS Code Extension
 * Provides type safety and clear interfaces
 */

import { ExtensionContext } from 'vscode';

// WebView message types
export interface WebViewMessage {
  command: string;
  text?: string;
  model?: string;
}

export interface SendToAiderMessage extends WebViewMessage {
  command: 'sendToAider';
  text: string;
  model: string;
}

export interface SendCurrentFileMessage extends WebViewMessage {
  command: 'sendCurrentFile';
}

export interface UpdateConversationMessage extends WebViewMessage {
  command: 'updateConversation';
  text: string;
}

// Process-related types
export interface ProcessExitInfo {
  exitCode: number;
  signal?: number;
}

export interface ProcessSpawnOptions {
  name: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
  cwd: string;
}

// Configuration types
export interface ModelConfig {
  id: string;
  displayName: string;
}

export interface TerminalConfig {
  name: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

export interface OllamaConfig {
  defaultApiBase: string;
  timeout: number;
}

// State management types
export interface ConversationEntry {
  type: 'user' | 'aider' | 'system';
  content: string;
  timestamp: Date;
}

export interface ExtensionState {
  conversationHistory: ConversationEntry[];
  currentModel: string;
  isProcessRunning: boolean;
}

// Error types
export interface AiderError extends Error {
  code?: string;
  context?: string;
}

// Aider process interface
export interface IAiderProcess {
  readonly isRunning: boolean;
  readonly currentModel: string;

  start(model: string, workspaceFolder: string): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: string): void;

  onData(callback: (data: string) => void): void;
  onExit(callback: (exitInfo: ProcessExitInfo) => void): void;
  onError(callback: (error: AiderError) => void): void;
}

// WebView provider interface
export interface IWebViewProvider {
  readonly viewType: string;

  refresh(): void;
  updateConversation(text: string): void;
  showError(message: string): void;
}

// HTML template data
export interface HtmlTemplateData {
  cspSource: string;
  modelOptions: string;
  nonce?: string;
}

// Extension dependencies
export interface ExtensionDependencies {
  context: ExtensionContext;
}

// Performance utilities types
export type DebouncedFunction<T extends (...args: unknown[]) => unknown> = (
  ...args: Parameters<T>
) => void;
export type ThrottledFunction<T extends (...args: unknown[]) => unknown> = (
  ...args: Parameters<T>
) => void;

// Error handler interface
export interface IErrorHandler {
  handleError(error: Error | AiderError, context?: string): void;
  showUserError(message: string): void;
  logError(error: Error | AiderError, context?: string): void;
}

// File operations
export interface FileInfo {
  content: string;
  fileName: string;
  uri: string;
}

// Environment configuration
export interface EnvironmentConfig {
  ollamaApiBase: string;
  pathExtensions: string[];
  terminalEnv: Record<string, string>;
}
