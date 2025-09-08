/**
 * constants.ts
 * Centralized extension constants (DRY, KISS, SOLID)
 * Keeps configuration aligned with ~/.aider.conf.yml
 */

export const EXTENSION_CONFIG = {
  // ✅ Default model (must match ~/.aider.conf.yml extra-models key)
  DEFAULT_MODEL: 'ollama/deepseek-coder-v2:16b',

  // Available models for selection in UI
  AVAILABLE_MODELS: [
    { id: 'ollama/deepseek-coder-v2:16b', displayName: 'DeepSeek Coder V2 (16B)' },
    { id: 'ollama/deepseek-coder-v2:7b', displayName: 'DeepSeek Coder V2 (7B)' },
    { id: 'ollama/codellama:7b', displayName: 'Code Llama (7B)' },
    { id: 'ollama/codellama:13b', displayName: 'Code Llama (13B)' },
    { id: 'gpt-4', displayName: 'GPT-4' },
    { id: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo' }
  ],

  TERMINAL: {
    NAME: 'Aider Terminal',
    COLS: 80, // More conservative default that matches typical small terminals
    ROWS: 24, // Standard terminal height
    ENV: {} // additional environment vars if needed
  },

  PATHS: {
    LOCAL_BIN: '' // e.g. /usr/local/bin if custom installs
  },

  OLLAMA: {
    // Fallback API base if not set in ~/.aider.conf.yml
    DEFAULT_API_BASE: 'http://192.168.0.68:11434'
  },

  WEBVIEW: {
    ENABLE_SCRIPTS: true,
    RETAIN_CONTEXT: true
  },

  MESSAGES: {
    EXTENSION_ACTIVATED: 'Aider VS Code Extension Activated',
    ACTIVATION_FAILED: 'Failed to activate Aider extension',
    AIDER_START_FAILED: 'Failed to start Aider',
    WEBVIEW_INIT_FAILED: 'Failed to initialize chat interface',
    NO_WORKSPACE: 'No workspace folder open. Please open a folder before starting Aider.',
    NO_EDITOR: 'No active editor found. Please open a file.'
  },

  STORAGE_KEYS: {
    CONVERSATION_HISTORY: 'aiderConversationHistory'
  },

  COMMAND_ID: 'extension.startAider',
  VIEW_TYPE: 'aiderChatView'
};

/**
 * Environment variable keys used across the extension
 */
export const ENV_VARS = {
  PATH: 'PATH',
  OLLAMA_API_BASE: 'OLLAMA_API_BASE'
};

/**
 * Aider CLI command flags
 */
export const AIDER_COMMANDS = {
  MODEL_FLAG: '--model',
  EDIT_FORMAT_FLAG: '--edit-format',
  SHOW_DIFFS_FLAG: '--show-diffs',
  RESTORE_CHAT_HISTORY_FLAG: '--restore-chat-history',
  SET_ENV_FLAG: '--set-env'
};
