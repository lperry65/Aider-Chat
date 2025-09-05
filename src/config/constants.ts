/**
 * Configuration constants for Aider VS Code Extension
 * Centralizes all configurable values following DRY principle
 */

export const EXTENSION_CONFIG = {
  // Extension identifiers
  VIEW_TYPE: 'aiderChatView',
  COMMAND_ID: 'extension.startAider',

  // Default AI model configuration
  DEFAULT_MODEL: 'ollama_chat/deepseek-coder-v2:16b',

  // Ollama API configuration
  OLLAMA: {
    DEFAULT_API_BASE: 'http://localhost:11434',
    TIMEOUT: 30000 // 30 seconds
  },

  // Terminal configuration for pty
  TERMINAL: {
    NAME: 'xterm-color',
    COLS: 120,
    ROWS: 30,
    ENV: {
      TERM: 'xterm-256color',
      FORCE_COLOR: '1'
    }
  },

  // WebView configuration
  WEBVIEW: {
    ENABLE_SCRIPTS: true,
    RETAIN_CONTEXT: false // Follow VS Code best practice
  },

  // Storage keys for state persistence
  STORAGE_KEYS: {
    CONVERSATION_HISTORY: 'aiderConversationHistory',
    CURRENT_MODEL: 'currentAiderModel'
  },

  // UI Messages
  MESSAGES: {
    NO_WORKSPACE: 'Warning: No workspace folder found. Please open a folder first.',
    NO_EDITOR: 'No active text editor found.',
    EXTENSION_ACTIVATED: 'Aider Extension is now active!',
    ACTIVATION_FAILED: 'Failed to activate Aider Extension',
    AIDER_START_FAILED: 'Failed to start Aider',
    WEBVIEW_INIT_FAILED: 'Failed to initialize Aider chat view'
  },

  // Available models for dropdown
  AVAILABLE_MODELS: [
    {
      id: 'ollama_chat/deepseek-coder-v2:16b',
      displayName: 'deepseek-coder-v2:16b'
    },
    {
      id: 'ollama_chat/qwen3:30b',
      displayName: 'qwen3:30b'
    }
  ],

  // Path configuration
  PATHS: {
    LOCAL_BIN: '/home/lee/.local/bin' // TODO: Make this configurable per user
  }
} as const;

// Environment variable keys
export const ENV_VARS = {
  OLLAMA_API_BASE: 'OLLAMA_API_BASE',
  PATH: 'PATH'
} as const;

// Command names for Aider CLI
export const AIDER_COMMANDS = {
  MODEL_FLAG: '--model',
  READ_COMMAND: '/read'
} as const;
