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
  private pendingAiderStart?: { model: string; workspaceFolder: string };

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

      // Don't start Aider immediately - wait for terminal size from webview
      this.pendingAiderStart = {
        model: EXTENSION_CONFIG.DEFAULT_MODEL,
        workspaceFolder: workspaceFolder
      };
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

        case 'interactiveResponse':
          await this.handleInteractiveResponse(message);
          break;

        case 'terminalInput':
          await this.handleTerminalInput(message as { command: string; data: string });
          break;

        case 'webviewReady':
          await this.handleWebviewReady(message as { command: string; cols: number; rows: number });
          break;

        case 'terminalResize':
          await this.handleTerminalResize(
            message as { command: string; cols: number; rows: number }
          );
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

      // If Aider is not running, show a message and wait for it to be started by webviewReady
      if (!this.aiderProcess.isRunning) {
        console.log('⏳ Aider is not running yet, waiting for webview to be ready.');
        this.addConversationEntry({
          type: 'system',
          content: 'Aider is starting, please wait...',
          timestamp: new Date()
        });
        // The message will be sent once the process starts, or we can queue it.
        // For now, we just inform the user.
        return;
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
   * Restart Aider with new model
   */
  private async restartAiderWithModel(model: string): Promise<void> {
    if (this.aiderProcess.isRunning) {
      await safeAsync(() => this.aiderProcess.stop(), 'aider_stop');
    }

    // Set pending start and refresh webview to trigger restart
    const workspaceFolder = this.getWorkspaceFolder();
    if (workspaceFolder) {
      this.pendingAiderStart = { model, workspaceFolder };
      this.refresh();
    } else {
      this.showError(EXTENSION_CONFIG.MESSAGES.NO_WORKSPACE);
    }
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

    this.aiderProcess.onPrompt(prompt => {
      this.handleInteractivePrompt(prompt);
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
   * Handle interactive prompts from Aider
   */
  private handleInteractivePrompt(prompt: { text: string; options: string[]; type: string }): void {
    console.log('Handling interactive prompt:', prompt);

    // Send the prompt to the webview to show the overlay
    this.sendToWebView({
      command: 'showInteractivePrompt',
      promptText: prompt.text,
      options: prompt.options
    });
  }

  /**
   * Handle terminal input (like CPR responses) from the webview
   */
  private async handleTerminalInput(message: {
    command: string;
    data: string;
    isCPR?: boolean;
  }): Promise<void> {
    if (!this.aiderProcess.isRunning) {
      console.warn('Terminal input received but Aider process is not running');
      return;
    }

    try {
      if (message.isCPR) {
        console.log('🎯 Forwarding CPR response to Aider:', JSON.stringify(message.data));
      } else {
        console.log('🔄 Forwarding terminal input to Aider:', JSON.stringify(message.data));
      }

      // Forward the terminal input (like CPR responses) directly to Aider
      this.aiderProcess.sendRawData(message.data);
    } catch (error) {
      console.error('Error handling terminal input:', error);
      handleError(error, 'terminal_input');
    }
  }

  /**
   * Handle the webview's "ready" signal
   */
  private async handleWebviewReady(message: {
    command: string;
    cols: number;
    rows: number;
  }): Promise<void> {
    // If we have a pending Aider start, start it now with the correct terminal size
    if (this.pendingAiderStart && !this.aiderProcess.isRunning) {
      try {
        console.log(
          `🚀 Webview is ready. Starting Aider with terminal size ${message.cols}x${message.rows}`
        );

        // Update the PTY configuration with the actual terminal size
        await this.aiderProcess.startWithSize(
          this.pendingAiderStart.model,
          this.pendingAiderStart.workspaceFolder,
          message.cols,
          message.rows
        );

        this.pendingAiderStart = undefined;
      } catch (error) {
        console.error('Error starting Aider with terminal size:', error);
        handleError(error, 'aider_start_with_size');
        return;
      }
    }
  }

  /**
   * Handle terminal resize events from the webview
   */
  private async handleTerminalResize(message: {
    command: string;
    cols: number;
    rows: number;
  }): Promise<void> {
    // If Aider is running, resize the terminal
    if (this.aiderProcess.isRunning) {
      try {
        console.log(`Resizing terminal to ${message.cols}x${message.rows}`);
        this.aiderProcess.resize(message.cols, message.rows);
      } catch (error) {
        console.error('Error handling terminal resize:', error);
        handleError(error, 'terminal_resize');
      }
    }
  }

  /**
   * Handle user response to interactive prompts
   */
  private async handleInteractiveResponse(
    message: WebViewMessage & { response?: string; originalPrompt?: string }
  ): Promise<void> {
    if (!this.aiderProcess.isRunning) {
      console.warn('Interactive response received but Aider process is not running');
      return;
    }

    try {
      const response = message.response || '';
      console.log('User responded to interactive prompt:', response);

      // Convert user-friendly responses to terminal input
      let terminalInput = '';
      if (response.toLowerCase() === 'yes' || response.toLowerCase() === 'y') {
        terminalInput = 'y\n';
      } else if (response.toLowerCase() === 'no' || response.toLowerCase() === 'n') {
        terminalInput = 'n\n';
      } else if (response.toLowerCase() === 'continue') {
        terminalInput = '\n';
      } else {
        // For custom responses, use as-is
        terminalInput = response + '\n';
      }

      // Send the response to Aider
      this.aiderProcess.sendMessage(terminalInput);

      // Hide the prompt overlay
      this.sendToWebView({ command: 'hideInteractivePrompt' });
    } catch (error) {
      console.error('Error handling interactive response:', error);
      handleError(error, 'interactive_response');
    }
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
