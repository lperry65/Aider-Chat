/**
 * AiderChatViewProvider - Clean WebView provider following SRP
 * Handles only VS Code WebView lifecycle, delegates business logic to services
 */

import * as vscode from 'vscode';
import {
  IWebViewProvider,
  WebViewMessage,
  SendToAiderMessage,
  SendCurrentFileMessage,
  UpdateConversationMessage,
  ConversationEntry,
  ExtensionDependencies
} from '../types';
import { EXTENSION_CONFIG } from '../config/constants';
import { AiderProcess } from '../services/AiderProcess';
import { WebViewHelper } from '../webview/webviewHelper';
import { handleError, safeAsync } from '../utils/errorHandler';

export class AiderChatViewProvider implements vscode.WebviewViewProvider, IWebViewProvider {
  public static readonly viewType = EXTENSION_CONFIG.VIEW_TYPE;

  private _view?: vscode.WebviewView;
  private readonly aiderProcess: AiderProcess;
  private readonly webViewHelper: WebViewHelper;
  private readonly context: vscode.ExtensionContext;
  private conversationHistory: ConversationEntry[] = [];

  constructor(dependencies: ExtensionDependencies) {
    this.context = dependencies.context;
    this.aiderProcess = new AiderProcess();
    this.webViewHelper = new WebViewHelper(this.context.extensionUri.fsPath);

    this.loadPersistedState();
    this.setupProcessEventHandlers();
  }

  get viewType(): string {
    return AiderChatViewProvider.viewType;
  }

  /**
   * VS Code WebView lifecycle - resolveWebviewView
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Configure webview options following VS Code best practices
    webviewView.webview.options = {
      enableScripts: EXTENSION_CONFIG.WEBVIEW.ENABLE_SCRIPTS,
      localResourceRoots: [this.context.extensionUri]
    };

    // Generate secure HTML
    this.generateWebViewHtml();

    // Setup message handling
    this.setupMessageHandling();

    // Restore conversation if exists
    this.restoreConversationHistory();
  }

  /**
   * Refresh the webview content
   */
  public refresh(): void {
    if (this._view) {
      this.generateWebViewHtml();
    }
  }

  /**
   * Update conversation with new text
   */
  public updateConversation(text: string): void {
    const entry: ConversationEntry = {
      type: 'aider',
      content: text,
      timestamp: new Date()
    };

    this.addConversationEntry(entry);
    this.sendToWebView({ command: 'updateConversation', text });
  }

  /**
   * Show error message in webview
   */
  public showError(message: string): void {
    this.updateConversation(`Error: ${message}`);
  }

  /**
   * Dispose of resources - VS Code pattern
   */
  public dispose(): void {
    this.aiderProcess.dispose();
    this.savePersistedState();
  }

  /**
   * Generate secure HTML content
   */
  private generateWebViewHtml(): void {
    if (!this._view) return;

    try {
      this._view.webview.html = this.webViewHelper.generateHtml(this._view.webview);
    } catch (error) {
      handleError(error, 'webview_html_generation');
      this.showFallbackContent();
    }
  }

  /**
   * Setup message handling from webview
   */
  private setupMessageHandling(): void {
    if (!this._view) return;

    this._view.webview.onDidReceiveMessage(
      (message: WebViewMessage) => this.handleWebViewMessage(message),
      undefined,
      this.context.subscriptions
    );
  }

  /**
   * Handle messages from webview
   */
  private async handleWebViewMessage(message: WebViewMessage): Promise<void> {
    try {
      switch (message.command) {
        case 'sendToAider':
          await this.handleSendToAider(message as SendToAiderMessage);
          break;

        case 'sendCurrentFile':
          await this.handleSendCurrentFile(message as SendCurrentFileMessage);
          break;

        default:
          console.warn('Unknown webview message command:', message.command);
      }
    } catch (error) {
      handleError(error, `webview_message_${message.command}`);
    }
  }

  /**
   * Handle send message to Aider
   */
  private async handleSendToAider(message: SendToAiderMessage): Promise<void> {
    const { text, model } = message;

    // Validate input
    if (!text?.trim()) {
      return;
    }

    // Add user message to conversation
    this.addConversationEntry({
      type: 'user',
      content: text,
      timestamp: new Date()
    });

    // Check if model changed
    if (model && model !== this.aiderProcess.currentModel) {
      await this.restartAiderWithModel(model);
    }

    // Start Aider if not running
    if (!this.aiderProcess.isRunning) {
      await this.startAider(model || EXTENSION_CONFIG.DEFAULT_MODEL);
    }

    // Send message to Aider
    if (this.aiderProcess.isRunning) {
      this.aiderProcess.sendMessage(text);
    }
  }

  /**
   * Handle send current file to Aider
   */
  private async handleSendCurrentFile(_message: SendCurrentFileMessage): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showErrorMessage(EXTENSION_CONFIG.MESSAGES.NO_EDITOR);
      return;
    }

    const fileContent = editor.document.getText();
    const fileName = editor.document.fileName;
    const aiderCommand = `/read ${fileName}\n${fileContent}`;

    // Add system message to conversation
    this.addConversationEntry({
      type: 'system',
      content: `Sent file: ${fileName}`,
      timestamp: new Date()
    });

    // Send to Aider if running
    if (this.aiderProcess.isRunning) {
      this.aiderProcess.sendMessage(aiderCommand);
    }
  }

  /**
   * Start Aider process
   */
  private async startAider(model: string): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      this.showError(EXTENSION_CONFIG.MESSAGES.NO_WORKSPACE);
      return;
    }

    await safeAsync(() => this.aiderProcess.start(model, workspaceFolder), 'aider_start');
  }

  /**
   * Restart Aider with new model
   */
  private async restartAiderWithModel(model: string): Promise<void> {
    if (this.aiderProcess.isRunning) {
      await safeAsync(() => this.aiderProcess.stop(), 'aider_stop');
    }
    await this.startAider(model);
  }

  /**
   * Get workspace folder path
   */
  private getWorkspaceFolder(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Setup event handlers for Aider process
   */
  private setupProcessEventHandlers(): void {
    this.aiderProcess.onData((data: string) => {
      this.updateConversation(data);
    });

    this.aiderProcess.onExit(exitInfo => {
      const message = `Aider process exited with code ${exitInfo.exitCode}`;
      this.addConversationEntry({
        type: 'system',
        content: message,
        timestamp: new Date()
      });
      this.updateConversation(message);
    });

    this.aiderProcess.onError(error => {
      this.showError(error.message);
    });
  }

  /**
   * Add entry to conversation history
   */
  private addConversationEntry(entry: ConversationEntry): void {
    this.conversationHistory.push(entry);
    this.savePersistedState();
  }

  /**
   * Send message to webview
   */
  private sendToWebView(message: UpdateConversationMessage): void {
    this._view?.webview.postMessage(message);
  }

  /**
   * Restore conversation history in webview
   */
  private restoreConversationHistory(): void {
    this.conversationHistory.forEach(entry => {
      const displayText = `${entry.type}: ${entry.content}`;
      this.sendToWebView({ command: 'updateConversation', text: displayText });
    });
  }

  /**
   * Load persisted state from VS Code global state
   */
  private loadPersistedState(): void {
    try {
      const saved = this.context.globalState.get<ConversationEntry[]>(
        EXTENSION_CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY,
        []
      );

      if (Array.isArray(saved)) {
        this.conversationHistory = saved;
      }
    } catch (error) {
      handleError(error, 'load_persisted_state');
      this.conversationHistory = [];
    }
  }

  /**
   * Save state to VS Code global state
   */
  private savePersistedState(): void {
    try {
      this.context.globalState.update(
        EXTENSION_CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY,
        this.conversationHistory
      );
    } catch (error) {
      handleError(error, 'save_persisted_state');
    }
  }

  /**
   * Show fallback content if HTML generation fails
   */
  private showFallbackContent(): void {
    if (!this._view) return;

    this._view.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aider Chat - Error</title>
        </head>
        <body style="font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-errorForeground);">
          <h3>Template Error</h3>
          <p>Could not load chat interface. Please reload the extension.</p>
        </body>
      </html>
    `;
  }
}
