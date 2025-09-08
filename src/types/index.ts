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

export interface StartNewChatMessage extends WebViewMessage {
  command: 'startNewChat';
}

export interface TerminalInputMessage extends WebViewMessage {
  command: 'terminalInput';
  data: string;
}

export interface TerminalResizeMessage extends WebViewMessage {
  command: 'terminalResize';
  cols: number;
  rows: number;
}

export interface ClearTerminalMessage extends WebViewMessage {
  command: 'clearTerminal';
}

export interface ShowInteractivePromptMessage extends WebViewMessage {
  command: 'showInteractivePrompt';
  promptText: string;
  options: string[];
}

export interface HideInteractivePromptMessage extends WebViewMessage {
  command: 'hideInteractivePrompt';
}

export interface InteractiveResponseMessage extends WebViewMessage {
  command: 'interactiveResponse';
  response: string;
  originalPrompt?: string;
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

  startWithSize(model: string, workspaceFolder: string, cols: number, rows: number): Promise<void>;
  stop(): Promise<void>;
  sendMessage(message: string): void;
  sendRawData(data: string): void;
  resize(cols: number, rows: number): void;

  onData(callback: (data: string) => void): void;
  onExit(callback: (exitInfo: ProcessExitInfo) => void): void;
  onError(callback: (error: AiderError) => void): void;
  onPrompt(callback: (prompt: { text: string; options: string[]; type: string }) => void): void;
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
