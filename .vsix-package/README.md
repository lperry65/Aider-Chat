# Aider VS Code Extension

A Visual Studio Code extension that provides a Copilot-like experience for
interacting with [Aider](https://aider.chat/) via an integrated terminal
interface. This extension brings the power of AI-assisted coding directly into
your VS Code sidebar.

## Project Purpose

This extension integrates Aider CLI into VS Code, providing:

- **Sidebar Chat Interface**: Interact with Aider through a dedicated VS Code
  sidebar panel
- **Real Terminal Experience**: Full terminal functionality with colors and
  proper TTY support via node-pty
- **Seamless Workflow**: Keep your AI coding assistant alongside your editor
  without switching contexts
- **Local AI Integration**: Designed to work with local Ollama installations for
  privacy and performance

## Features

- 🤖 **AI-Powered Code Assistant**: Chat with AI models to help write, debug,
  and improve your code
- 🖥️ **Integrated Terminal**: Real pseudo-terminal interface with full color
  support
- 📁 **Workspace Awareness**: Aider understands your project structure and can
  modify files directly
- 🔒 **Privacy-First**: Works with local Ollama installations - your code never
  leaves your machine
- ⚡ **Fast Response**: Direct connection to local models for quick AI responses

## Requirements

### Software Dependencies

- **VS Code**: Version 1.50.0 or higher
- **Node.js**: Version 16 or higher
- **Aider CLI**: Install via `pip install aider-chat`
- **Ollama**: For running local AI models

### Tested Environment

- **Operating System**: Ubuntu 24.04.3 LTS (Noble)
- **Python**: System Python (pyenv compatible)
- **Shell**: Bash

## Installation

### 1. Install Prerequisites

First, ensure you have the required software:

```bash
# Install Aider CLI
pip install aider-chat

# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Set Up AI Models

Pull your desired models with Ollama:

```bash
# Example: Pull popular coding models
ollama pull deepseek-coder-v2:16b
ollama pull qwen2.5-coder:7b
ollama pull codellama:13b
```

### 3. Configure Aider for Ollama

Configure Aider to use your local Ollama installation. Create or edit
`~/.aider.conf.yml`:

```yaml
# Example configuration for local Ollama
model: ollama/deepseek-coder-v2:16b
ollama-api-base: http://localhost:11434
```

For remote Ollama instances (like an AIVA server), use:

```yaml
model: ollama/deepseek-coder-v2:16b
ollama-api-base: http://YOUR_SERVER_IP:11434
```

### 4. Install the Extension

#### Option A: From Source (Development)

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd aider-extension
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. **Ubuntu 24.04 Specific**: Rebuild node-pty if you encounter issues:

   ```bash
   npm rebuild node-pty
   ```

4. Compile the extension:

   ```bash
   npm run compile
   ```

5. Open VS Code and press `F5` to launch the extension in development mode

#### Option B: Install from VSIX (Coming Soon)

The extension will be available as a `.vsix` package for easy installation.

## Ubuntu 24.04 Setup Notes

### node-pty Compilation Issues

If you're using pyenv on Ubuntu 24.04, you may need to configure it properly for
native module compilation:

1. **Check your pyenv configuration** in `~/.bashrc`:

   ```bash
   # Good configuration (allows system Python access)
   export PYENV_ROOT="$HOME/.pyenv"
   [[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
   eval "$(pyenv init -)"

   # Avoid this (blocks system Python)
   # eval "$(pyenv init --path)"
   ```

2. **Reload your shell** and rebuild if needed:

   ```bash
   source ~/.bashrc
   npm rebuild node-pty
   ```

This ensures node-gyp can find the system Python needed for compiling native
modules.

## Usage

1. **Open VS Code** in your project directory
2. **Activate the extension** by clicking the Aider icon in the Activity Bar
   (sidebar)
3. **Start chatting** with your AI assistant in the Aider Chat panel
4. **Give commands** like:
   - `add file.py` - Add files to the chat context
   - `create a function that sorts a list` - Request code generation
   - `/help` - See all available Aider commands

## Configuration

### Environment Variables

You can configure the extension through environment variables:

- `AIDER_MODEL`: Specify which model to use (e.g.,
  `ollama/deepseek-coder-v2:16b`)
- `OLLAMA_API_BASE`: Set the Ollama server URL (default:
  `http://localhost:11434`)

### VS Code Settings

The extension respects your VS Code theme and terminal settings for the best
integrated experience.

## About Ollama

[Ollama](https://ollama.ai/) is a tool that makes it easy to run large language
models locally. It acts as:

- **Model Manager**: Download and manage AI models (`ollama pull <model>`)
- **API Server**: Provides a REST API for applications to interact with models
- **Runtime Environment**: Efficiently runs models with GPU acceleration when
  available

Popular models for coding:

- **deepseek-coder-v2**: Excellent for code generation and explanation
- **qwen2.5-coder**: Fast and capable coding assistant
- **codellama**: Meta's specialized coding model

## Troubleshooting

### Extension Won't Start

- Check VS Code Developer Console (`Help > Toggle Developer Tools`)
- Ensure node-pty compiled successfully: `npm rebuild node-pty`
- Verify Aider is installed: `aider --version`

### Can't Connect to Models

- Verify Ollama is running: `ollama list`
- Check your Aider configuration: `cat ~/.aider.conf.yml`
- Test Ollama directly: `ollama run <model-name>`

### Terminal Issues

- If you see "Input is not a terminal" warnings, the extension uses node-pty to
  provide a real terminal experience
- Ensure your shell environment is properly configured

## Contributing

Contributions are welcome! Please review our
[Technical Architecture](docs/technical-architecture.md) document for
development principles and coding standards.

Key principles:

- **DRY** (Don't Repeat Yourself)
- **KISS** (Keep It Simple, Stupid)
- **SOLID** (Single Responsibility, Open/Closed, Liskov Substitution, Interface
  Segregation, Dependency Inversion)

Please feel free to submit issues and pull requests.## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

**TL;DR**: Use it however you want, no guarantees, no liability on the author.

## Acknowledgments

- [Aider](https://aider.chat/) - The amazing AI coding assistant this extension
  integrates
- [Ollama](https://ollama.ai/) - Making local AI models accessible
- [node-pty](https://github.com/microsoft/node-pty) - Providing real terminal
  functionality
