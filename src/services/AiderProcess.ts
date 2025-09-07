/**
 * AiderProcess service - handles only Aider process lifecycle
 * Follows Single Responsibility Principle and VS Code disposal patterns
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { IAiderProcess, ProcessExitInfo, AiderError } from '../types';
import { EXTENSION_CONFIG, ENV_VARS } from '../config/constants';
import { handleError } from '../utils/errorHandler';

export class AiderProcess implements IAiderProcess {
  private process: import('node-pty').IPty | null = null;
  private _currentModel: string = EXTENSION_CONFIG.DEFAULT_MODEL;
  private dataCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((exitInfo: ProcessExitInfo) => void)[] = [];
  private errorCallbacks: ((error: AiderError) => void)[] = [];

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
      const pty = await import('node-pty');
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
      const aiderError = this.createAiderError(error, 'send_message');
      this.notifyError(aiderError);
      throw aiderError;
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

  dispose(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.dataCallbacks = [];
    this.exitCallbacks = [];
    this.errorCallbacks = [];
  }

  private async captureInitialOutput(): Promise<void> {
    if (!this.process) {
      return;
    }

    await this.delay(2000);
    this.process.write('\r');
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

    // Add terminal environment variables to improve compatibility
    baseEnv.TERM = 'xterm-256color';
    baseEnv.FORCE_COLOR = '3'; // Enable truecolor support
    baseEnv.COLORTERM = 'truecolor';

    Object.assign(baseEnv, EXTENSION_CONFIG.TERMINAL.ENV);

    return baseEnv;
  }

  /**
   * Build Aider CLI args using ~/.aider.conf.yml
   */
  private buildAiderArgs(model: string): string[] {
    const args: string[] = ['--model', model];

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
