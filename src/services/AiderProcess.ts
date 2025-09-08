/**
 * AiderProcess service - handles only Aider process lifecycle
 * Follows Single Responsibility Principle and VS Code disposal patterns
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import * as pty from '@lydell/node-pty';
import { IAiderProcess, ProcessExitInfo, AiderError } from '../types';
import { EXTENSION_CONFIG, ENV_VARS } from '../config/constants';
import { handleError } from '../utils/errorHandler';

export class AiderProcess implements IAiderProcess {
  private process: pty.IPty | null = null;
  private _currentModel: string = EXTENSION_CONFIG.DEFAULT_MODEL;
  private dataCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((exitInfo: ProcessExitInfo) => void)[] = [];
  private errorCallbacks: ((error: AiderError) => void)[] = [];
  private promptCallbacks: ((prompt: { text: string; options: string[]; type: string }) => void)[] =
    [];

  constructor() {
    // Initialization happens in start()
  }

  get isRunning(): boolean {
    return this.process !== null;
  }

  get currentModel(): string {
    return this._currentModel;
  }

  /**
   * Start Aider process with specified model
   */
  async start(model: string, workspaceFolder: string): Promise<void> {
    console.log('🔨 AiderProcess.start called with:', { model, workspaceFolder });

    if (this.isRunning) {
      console.log('⚠️ Process already running, stopping first');
      await this.stop();
    }

    this._currentModel = model;

    try {
      console.log('🔧 Building process environment...');
      const processEnv = this.buildProcessEnvironment();

      console.log('📦 Dynamically importing node-pty...');
      const pty = await import('@lydell/node-pty');
      console.log('✅ node-pty imported successfully');

      // Build CLI args from aider.conf.yml + model
      const args = this.buildAiderArgs(model);

      console.log('🚀 Spawning aider process with args:', JSON.stringify(args));
      this.process = pty.spawn('aider', args, {
        name: EXTENSION_CONFIG.TERMINAL.NAME,
        cols: EXTENSION_CONFIG.TERMINAL.COLS,
        rows: EXTENSION_CONFIG.TERMINAL.ROWS,
        env: processEnv,
        cwd: workspaceFolder
      });

      console.log('✅ Aider process spawned successfully');
      this.attachEventHandlers();

      await this.captureInitialOutput();
    } catch (error) {
      this.process = null;
      const aiderError = this.createAiderError(error, 'process_start');
      this.notifyError(aiderError);
      throw aiderError;
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      this.process.write('/exit\r');
      await this.delay(1000);

      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    } catch (error) {
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
      handleError(error, 'process_stop');
    }
  }

  sendMessage(message: string): void {
    if (!this.process) {
      throw new Error('Aider process is not running');
    }

    try {
      const sanitizedMessage = this.sanitizeInput(message);
      this.process.write(sanitizedMessage + '\r');
    } catch (error) {
      console.error('Error sending message to Aider process:', error);
      const aiderError = this.createAiderError(error, 'send_message');
      this.notifyError(aiderError);
      throw aiderError;
    }
  }

  sendRawData(data: string): void {
    if (!this.process) {
      throw new Error('Aider process is not running');
    }

    try {
      this.process.write(data);
    } catch (error) {
      console.error('Error sending raw data to Aider process:', error);
      const aiderError = this.createAiderError(error, 'send_raw_data');
      this.notifyError(aiderError);
      throw aiderError;
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.process) {
      return;
    }

    try {
      this.process.resize(cols, rows);
      console.log(`Terminal resized to ${cols}x${rows}`);
    } catch (error) {
      console.error('Error resizing terminal:', error);
    }
  }

  onData(callback: (data: string) => void): void {
    this.dataCallbacks.push(callback);
  }

  onExit(callback: (exitInfo: ProcessExitInfo) => void): void {
    this.exitCallbacks.push(callback);
  }

  onError(callback: (error: AiderError) => void): void {
    this.errorCallbacks.push(callback);
  }

  onPrompt(callback: (prompt: { text: string; options: string[]; type: string }) => void): void {
    this.promptCallbacks.push(callback);
  }

  dispose(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.dataCallbacks = [];
    this.exitCallbacks = [];
    this.errorCallbacks = [];
    this.promptCallbacks = [];
  }

  private async captureInitialOutput(): Promise<void> {
    if (!this.process) {
      return;
    }

    // Wait for process to stabilize and allow initial output to complete
    await this.delay(1500);

    // Don't send anything - the CPR detection is now handled by the immediate
    // response in notifyData(), so we don't need to trigger anything here
  }

  private buildProcessEnvironment(): Record<string, string> {
    const baseEnv: Record<string, string> = {};

    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        baseEnv[key] = value;
      }
    });

    if (EXTENSION_CONFIG.PATHS.LOCAL_BIN) {
      const currentPath = baseEnv[ENV_VARS.PATH] || '';
      baseEnv[ENV_VARS.PATH] = `${currentPath}:${EXTENSION_CONFIG.PATHS.LOCAL_BIN}`;
    }

    // Ollama API base from config or env
    baseEnv[ENV_VARS.OLLAMA_API_BASE] =
      process.env[ENV_VARS.OLLAMA_API_BASE] || EXTENSION_CONFIG.OLLAMA.DEFAULT_API_BASE;

    // Add terminal environment variables to provide full terminal experience
    baseEnv.TERM = 'xterm-256color'; // Full featured terminal with CPR support
    baseEnv.FORCE_COLOR = '3'; // Enable truecolor support
    baseEnv.COLORTERM = 'truecolor';
    baseEnv.LINES = EXTENSION_CONFIG.TERMINAL.ROWS.toString();
    baseEnv.COLUMNS = EXTENSION_CONFIG.TERMINAL.COLS.toString();
    baseEnv.TERM_PROGRAM = 'vscode-aider-extension';
    baseEnv.TERM_PROGRAM_VERSION = '1.0.0';

    Object.assign(baseEnv, EXTENSION_CONFIG.TERMINAL.ENV);

    return baseEnv;
  }

  /**
   * Build Aider CLI args using ~/.aider.conf.yml
   */
  private buildAiderArgs(model: string): string[] {
    const args: string[] = ['--model', model];

    // Add terminal compatibility options
    args.push('--no-gui', '--no-browser', '--no-copy-paste');

    // Add option to disable CPR if available (this might not exist in Aider)
    // args.push('--no-cpr'); // Uncomment if Aider supports this option

    try {
      const configPath = path.join(process.env.HOME || '', '.aider.conf.yml');
      if (fs.existsSync(configPath)) {
        const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;

        // add edit-format
        if (config['edit-format']) {
          args.push('--edit-format', config['edit-format'] as string);
        }

        // add show-diffs
        if (config['show-diffs']) {
          args.push('--show-diffs');
        }

        // add restore-chat-history
        if (config['restore-chat-history']) {
          args.push('--restore-chat-history');
        }

        // handle set-env (map into --set-env KEY=VAL args)
        if (config['set-env']) {
          const envConfig = config['set-env'];
          if (typeof envConfig === 'object' && envConfig !== null) {
            for (const [key, value] of Object.entries(envConfig)) {
              args.push('--set-env');
              args.push(`${key}=${value}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not read aider.conf.yml, falling back to defaults:', err);
    }

    // Add current directory as the target
    // Note: Removed '.' as aider doesn't accept directories as file arguments
    // Aider will work in the current directory by default

    return args;
  }

  private attachEventHandlers(): void {
    if (!this.process) {
      return;
    }

    this.process.onData((data: string) => this.notifyData(data));

    this.process.onExit((exitInfo: { exitCode: number; signal?: number }) => {
      const processExitInfo: ProcessExitInfo = {
        exitCode: exitInfo.exitCode,
        signal: exitInfo.signal
      };

      console.log(`Aider process exited with code ${exitInfo.exitCode}`);

      // Provide specific error messages for common exit codes
      if (exitInfo.exitCode === 2) {
        console.error(
          'Aider exited with code 2 - likely a configuration or API connectivity issue'
        );
        console.error('Check your .aider.conf.yml file and ensure Ollama/API is accessible');
      } else if (exitInfo.exitCode !== 0) {
        console.error(`Aider exited with code ${exitInfo.exitCode} - check Aider logs for details`);
      }

      this.process = null;
      this.notifyExit(processExitInfo);
    });
  }

  private sanitizeInput(input: string): string {
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  private createAiderError(error: unknown, context: string): AiderError {
    const message = error instanceof Error ? error.message : String(error);
    const aiderError = new Error(message) as AiderError;
    aiderError.name = 'AiderError';
    aiderError.context = context;
    return aiderError;
  }

  private notifyData(data: string): void {
    // Handle CPR requests immediately
    if (data.includes('\x1b[6n')) {
      console.log('CPR request detected from Aider, responding immediately');
      // Send immediate CPR response (cursor at position 1,1 by default)
      const cprResponse = '\x1b[1;1R';
      this.sendRawData(cprResponse);

      // Remove CPR request from data to avoid displaying it
      data = data.replace(/\x1b\[6n/g, '');
      if (!data.trim()) {
        return; // Don't send empty data
      }
    }

    // Handle interactive prompts that need user interaction
    if (this.handleInteractivePrompt(data)) {
      return; // Don't send the prompt to webview, handle it through the prompt system
    }

    // Log control sequences for debugging
    if (data.charCodeAt(0) === 27) {
      // ESC character
      console.log('Control sequence from PTY:', data);
    }

    this.dataCallbacks.forEach(cb => {
      try {
        cb(data);
      } catch (error) {
        handleError(error, 'data_callback');
      }
    });
  }

  private notifyExit(exitInfo: ProcessExitInfo): void {
    this.exitCallbacks.forEach(cb => {
      try {
        cb(exitInfo);
      } catch (error) {
        handleError(error, 'exit_callback');
      }
    });
  }

  private notifyError(error: AiderError): void {
    this.errorCallbacks.forEach(cb => {
      try {
        cb(error);
      } catch (error) {
        handleError(error, 'error_callback');
      }
    });
  }

  /**
   * Handle interactive prompts from Aider by showing them to the user
   */
  private handleInteractivePrompt(data: string): boolean {
    // Check for common interactive prompts that need user response
    const promptPatterns = [
      /Press RETURN to continue/i,
      /Press Enter to continue/i,
      /Press any key to continue/i,
      /WARNING: terminal is not fully functional/i,
      /\(y\/n\)/i, // Yes/no prompts
      /\[y\/N\]/i,
      /\[Y\/n\]/i
    ];

    const needsResponse = promptPatterns.some(pattern => pattern.test(data));

    if (needsResponse) {
      console.log('Detected interactive prompt, showing to user:', data.trim());

      // Determine the type of prompt and appropriate options
      let options = ['Yes', 'No'];
      let promptType = 'confirmation';

      if (
        data.toLowerCase().includes('press return') ||
        data.toLowerCase().includes('press enter') ||
        data.toLowerCase().includes('press any key')
      ) {
        options = ['Continue'];
        promptType = 'continue';
      }

      // Send the prompt to the webview for user interaction
      this.promptCallbacks.forEach(cb => {
        try {
          cb({
            text: data.trim(),
            options: options,
            type: promptType
          });
        } catch (error) {
          handleError(error, 'prompt_callback');
        }
      });

      return true; // Indicate that we handled the prompt
    }

    return false; // Not an interactive prompt
  }

  /**
   * Send input to the Aider process (used for automatic responses)
   */
  private sendInput(input: string): void {
    if (!this.process) {
      console.warn('Cannot send input: Aider process is not running');
      return;
    }

    try {
      console.log('Sending automatic input to Aider:', input.replace('\n', '\\n'));
      this.process.write(input);
    } catch (error) {
      console.error('Error sending automatic input to Aider:', error);
      handleError(error, 'send_automatic_input');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Read VS Code extra models configuration from ~/.aider.conf.yml
   */
  private static readVSCodeConfig(): Record<string, Record<string, unknown>> {
    try {
      const configPath = path.join(process.env.HOME || '', '.aider.conf.yml');
      if (fs.existsSync(configPath)) {
        const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
        return (config['vscode-extra-models'] || {}) as Record<string, Record<string, unknown>>;
      }
    } catch (error) {
      console.warn('Failed to read vscode-extra-models from config:', error);
    }
    return {};
  }

  /**
   * Format model display name with edit format suffix
   */
  private static formatModelDisplayName(
    modelId: string,
    modelConfig: Record<string, unknown>
  ): string {
    const editFormat = modelConfig?.['edit-format'] || 'diff';
    const formatSuffix = editFormat === 'udiff' ? ' (udiff)' : '';

    // Convert model ID to display name
    const displayName = modelId
      .replace(/^[^/]+\//, '') // remove provider prefix (e.g. "openai/")
      .replace(/-/g, ' ') // replace dashes with spaces
      .replace(/\b\w/g, (l: string) => l.toUpperCase()); // capitalize first letter of each word

    return `${displayName}${formatSuffix}`;
  }

  /**
   * Static method to get available models from configuration
   */
  static getAvailableModels(): Array<{ id: string; displayName: string }> {
    try {
      const config = this.readVSCodeConfig();
      const models = Object.entries(config).map(
        ([modelId, modelConfig]: [string, Record<string, unknown>]) => ({
          id: modelId,
          displayName: this.formatModelDisplayName(modelId, modelConfig)
        })
      );
      return models.length > 0 ? models : EXTENSION_CONFIG.AVAILABLE_MODELS;
    } catch (error) {
      console.warn('Failed to load dynamic models from config:', error);
      return EXTENSION_CONFIG.AVAILABLE_MODELS;
    }
  }

  /**
   * Static method to get the default model
   */
  static getDefaultModel(): string {
    return EXTENSION_CONFIG.DEFAULT_MODEL;
  }
}
