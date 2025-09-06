/**
 * AiderProcess service - handles only Aider process lifecycle
 * Follows Single Responsibility Principle and VS Code disposal patterns
 */

import { IAiderProcess, ProcessExitInfo, AiderError } from '../types';
import { EXTENSION_CONFIG, ENV_VARS, AIDER_COMMANDS } from '../config/constants';
import { handleError } from '../utils/errorHandler';

export class AiderProcess implements IAiderProcess {
  private process: import('node-pty').IPty | null = null;
  private _currentModel: string = EXTENSION_CONFIG.DEFAULT_MODEL;
  private dataCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((exitInfo: ProcessExitInfo) => void)[] = [];
  private errorCallbacks: ((error: AiderError) => void)[] = [];

  constructor() {
    // Empty constructor - initialization happens in start()
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
      // Dynamic import of node-pty to avoid loading at module initialization
      const pty = await import('node-pty');
      console.log('✅ node-pty imported successfully');

      console.log('🚀 Spawning aider process...');
      this.process = pty.spawn('aider', [AIDER_COMMANDS.MODEL_FLAG, model, '.'], {
        name: EXTENSION_CONFIG.TERMINAL.NAME,
        cols: EXTENSION_CONFIG.TERMINAL.COLS,
        rows: EXTENSION_CONFIG.TERMINAL.ROWS,
        env: processEnv,
        cwd: workspaceFolder
      });

      console.log('✅ Aider process spawned successfully');
      this.attachEventHandlers();
    } catch (error) {
      this.process = null;
      const aiderError = this.createAiderError(error, 'process_start');
      this.notifyError(aiderError);
      throw aiderError;
    }
  }

  /**
   * Stop Aider process gracefully
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      // Send graceful exit command first
      this.process.write('/exit\r');

      // Wait a moment for graceful exit
      await this.delay(1000);

      // Force kill if still running
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
    } catch (error) {
      // Force cleanup on error
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
      handleError(error, 'process_stop');
    }
  }

  /**
   * Send message to Aider process
   */
  sendMessage(message: string): void {
    if (!this.process) {
      throw new Error('Aider process is not running');
    }

    try {
      // Validate and sanitize input
      const sanitizedMessage = this.sanitizeInput(message);
      this.process.write(sanitizedMessage + '\r');
    } catch (error) {
      const aiderError = this.createAiderError(error, 'send_message');
      this.notifyError(aiderError);
      throw aiderError;
    }
  }

  /**
   * Register callback for process data output
   */
  onData(callback: (data: string) => void): void {
    this.dataCallbacks.push(callback);
  }

  /**
   * Register callback for process exit
   */
  onExit(callback: (exitInfo: ProcessExitInfo) => void): void {
    this.exitCallbacks.push(callback);
  }

  /**
   * Register callback for process errors
   */
  onError(callback: (error: AiderError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Dispose of resources - VS Code pattern
   */
  dispose(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Clear all callbacks
    this.dataCallbacks = [];
    this.exitCallbacks = [];
    this.errorCallbacks = [];
  }

  /**
   * Build process environment with proper path and Ollama configuration
   */
  private buildProcessEnvironment(): Record<string, string> {
    const baseEnv: Record<string, string> = {};

    // Copy environment variables, filtering out undefined values
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        baseEnv[key] = value;
      }
    });

    // Add local bin to PATH if needed
    if (EXTENSION_CONFIG.PATHS.LOCAL_BIN) {
      const currentPath = baseEnv[ENV_VARS.PATH] || '';
      baseEnv[ENV_VARS.PATH] = `${currentPath}:${EXTENSION_CONFIG.PATHS.LOCAL_BIN}`;
    }

    // Set Ollama API base
    baseEnv[ENV_VARS.OLLAMA_API_BASE] =
      process.env[ENV_VARS.OLLAMA_API_BASE] || EXTENSION_CONFIG.OLLAMA.DEFAULT_API_BASE;

    // Add terminal environment
    Object.assign(baseEnv, EXTENSION_CONFIG.TERMINAL.ENV);

    return baseEnv;
  }

  /**
   * Attach event handlers to the pty process
   */
  private attachEventHandlers(): void {
    if (!this.process) {
      return;
    }

    this.process.onData((data: string) => {
      this.notifyData(data);
    });

    this.process.onExit((exitInfo: { exitCode: number; signal?: number }) => {
      const processExitInfo: ProcessExitInfo = {
        exitCode: exitInfo.exitCode,
        signal: exitInfo.signal
      };

      this.process = null;
      this.notifyExit(processExitInfo);
    });
  }

  /**
   * Sanitize input for security
   */
  private sanitizeInput(input: string): string {
    // Remove control characters except newline and carriage return
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Create standardized AiderError
   */
  private createAiderError(error: unknown, context: string): AiderError {
    const message = error instanceof Error ? error.message : String(error);
    const aiderError = new Error(message) as AiderError;
    aiderError.name = 'AiderError';
    aiderError.context = context;
    return aiderError;
  }

  /**
   * Notify data callbacks
   */
  private notifyData(data: string): void {
    this.dataCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        handleError(error, 'data_callback');
      }
    });
  }

  /**
   * Notify exit callbacks
   */
  private notifyExit(exitInfo: ProcessExitInfo): void {
    this.exitCallbacks.forEach(callback => {
      try {
        callback(exitInfo);
      } catch (error) {
        handleError(error, 'exit_callback');
      }
    });
  }

  /**
   * Notify error callbacks
   */
  private notifyError(error: AiderError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        handleError(error, 'error_callback');
      }
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
