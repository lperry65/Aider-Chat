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
  ConversationEntry,
  ExtensionDependencies,
  ProcessExitInfo,
  AiderError
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

    // Start a fresh chat session if no history exists
    this.initializeNewChatIfNeeded();
  }

  /**
   * Initialize a new chat session if no conversation history exists
   */
  private async initializeNewChatIfNeeded(): Promise<void> {
    if (this.conversationHistory.length === 0) {
      await this.startNewChatSession();
    }
  }

  /**
   * Start a new chat session with Aider
   */
  public async startNewChatSession(): Promise<void> {
    try {
      const workspaceFolder = this.getWorkspaceFolder();
      if (!workspaceFolder) {
        this.showError(EXTENSION_CONFIG.MESSAGES.NO_WORKSPACE);
        return;
      }

      // Clear existing conversation
      this.conversationHistory = [];
      this.savePersistedState();

      // Clear the terminal display
      this.sendToWebView({ command: 'clearTerminal' });

      // Start Aider process with default model
      await this.aiderProcess.start(EXTENSION_CONFIG.DEFAULT_MODEL, workspaceFolder);

      // Add initial welcome message
      this.addConversationEntry({
        type: 'system',
        content: '🤖 Aider is starting... Please wait for the initial prompt.',
        timestamp: new Date()
      });

      this.sendToWebView({
        command: 'updateConversation',
        text: '🤖 Aider is starting... Please wait for the initial prompt.'
      });
    } catch (error) {
      this.showError(`Failed to start new chat session: ${error}`);
    }
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
    if (!this._view) {
      return;
    }

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
    if (!this._view) {
      return;
    }

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

        case 'startNewChat':
          await this.startNewChatSession();
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
    console.log('🔵 handleSendToAider called with:', message);
    const { text, model } = message;

    // Validate input
    if (!text?.trim()) {
      console.log('⚠️ No text provided, returning');
      return;
    }

    try {
      console.log('➕ Adding user message to conversation');
      // Add user message to conversation
      this.addConversationEntry({
        type: 'user',
        content: text,
        timestamp: new Date()
      });

      // Check if model changed
      if (model && model !== this.aiderProcess.currentModel) {
        console.log('🔄 Model changed, restarting Aider');
        await this.restartAiderWithModel(model);
      }

      // Start Aider if not running
      if (!this.aiderProcess.isRunning) {
        console.log('🚀 Starting Aider process...');
        await this.startAider(model || EXTENSION_CONFIG.DEFAULT_MODEL);
      }

      // Send message to Aider only if it's running
      if (this.aiderProcess.isRunning) {
        console.log('📤 Sending message to Aider');
        this.aiderProcess.sendMessage(text);
        console.log('✅ Message sent successfully');
      } else {
        console.error('❌ Aider process is not running, cannot send message');
        this.addConversationEntry({
          type: 'system',
          content: 'Failed to start Aider process. Please check your configuration.',
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('❌ Error in handleSendToAider:', error);
      this.addConversationEntry({
        type: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      });
      handleError(error, 'send_to_aider');
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
    console.log('🔧 startAider called with model:', model);
    const workspaceFolder = this.getWorkspaceFolder();
    console.log('📁 Workspace folder:', workspaceFolder);
    if (!workspaceFolder) {
      console.log('❌ No workspace folder found');
      this.showError(EXTENSION_CONFIG.MESSAGES.NO_WORKSPACE);
      return;
    }

    console.log('🚀 About to call aiderProcess.start...');
    try {
      await this.aiderProcess.start(model, workspaceFolder);
      console.log('✅ aiderProcess.start completed successfully');
    } catch (error) {
      console.error('❌ Failed to start Aider process:', error);
      handleError(error, 'aider_start');
      throw error; // Re-throw to prevent further execution
    }
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

    this.aiderProcess.onExit((exitInfo: ProcessExitInfo) => {
      const message = `Aider process exited with code ${exitInfo.exitCode}`;
      this.addConversationEntry({
        type: 'system',
        content: message,
        timestamp: new Date()
      });
      this.updateConversation(message);
    });

    this.aiderProcess.onError((error: AiderError) => {
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
  private sendToWebView(message: { command: string; [key: string]: unknown }): void {
    this._view?.webview.postMessage(message);
  }

  /**
   * Restore conversation history in webview
   */
  private restoreConversationHistory(): void {
    this.conversationHistory.forEach(entry => {
      // Validate entry before displaying
      if (entry && entry.type && entry.content) {
        const displayText = `${entry.type}: ${entry.content}`;
        this.sendToWebView({ command: 'updateConversation', text: displayText });
      } else {
        console.warn('Skipping invalid conversation entry:', entry);
      }
    });
  }

  /**
   * Load persisted state from VS Code global state
   */
  private loadPersistedState(): void {
    try {
      console.log('💾 Loading persisted state...');

      // Clear any corrupted state for now to fix undefined messages
      this.context.globalState.update(EXTENSION_CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY, []);
      this.conversationHistory = [];
      console.log('🧹 Cleared conversation history to fix undefined messages');

      /* TODO: Re-enable persistence after fixing undefined issue
      const saved = this.context.globalState.get<ConversationEntry[]>(
        EXTENSION_CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY,
        []
      );

      if (Array.isArray(saved)) {
        // Validate each entry
        this.conversationHistory = saved.filter(entry => 
          entry && 
          typeof entry.type === 'string' && 
          typeof entry.content === 'string' &&
          entry.timestamp
        );
        console.log('💾 Loaded', this.conversationHistory.length, 'valid conversation entries');
      } else {
        console.log('⚠️ Saved data is not an array, initializing empty');
        this.conversationHistory = [];
      }
      */
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
    if (!this._view) {
      return;
    }

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
