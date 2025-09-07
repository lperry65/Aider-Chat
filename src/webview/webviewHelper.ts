/**
 * WebView HTML helper - generates secure HTML with proper CSP
 * Follows KISS principle and VS Code security best practices
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HtmlTemplateData } from '../types';
import { EXTENSION_CONFIG } from '../config/constants';

export class WebViewHelper {
  private readonly extensionPath: string;
  private htmlTemplate: string | null = null;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * Generate HTML for webview with proper security headers
   */
  generateHtml(webview: vscode.Webview): string {
    const template = this.getHtmlTemplate();
    const templateData = this.buildTemplateData(webview);
    const processedTemplate = this.processTemplate(template, templateData);

    // Inject xterm scripts
    const finalHtml = this.injectXtermScripts(processedTemplate, webview);

    // Debug: Log the final HTML to see what we're generating
    console.log('Generated HTML length:', finalHtml.length);
    console.log('HTML contains xterm script tags:', finalHtml.includes('xterm'));

    return finalHtml;
  }

  /**
   * Get HTML template (cached after first load)
   */
  private getHtmlTemplate(): string {
    if (!this.htmlTemplate) {
      // Try multiple paths to find the template
      const possiblePaths = [
        path.join(this.extensionPath, 'src', 'webview', 'chat-view.html'), // Development
        path.join(this.extensionPath, 'out', 'webview', 'chat-view.html'), // Compiled
        path.join(this.extensionPath, 'webview', 'chat-view.html') // Packaged
      ];

      for (const templatePath of possiblePaths) {
        try {
          this.htmlTemplate = fs.readFileSync(templatePath, 'utf8');
          break;
        } catch {
          // Continue to next path
        }
      }

      // Fallback to minimal template if file not found
      if (!this.htmlTemplate) {
        this.htmlTemplate = this.getMinimalTemplate();
      }
    }

    return this.htmlTemplate;
  }

  /**
   * Build template data for HTML generation
   */
  private buildTemplateData(webview: vscode.Webview): HtmlTemplateData {
    return {
      cspSource: webview.cspSource,
      modelOptions: this.generateModelOptions(),
      nonce: this.generateNonce()
    };
  }

  /**
   * Process template with data substitution
   */
  private processTemplate(template: string, data: HtmlTemplateData): string {
    return template
      .replace(/#{cspSource}/g, data.cspSource)
      .replace(/#{modelOptions}/g, data.modelOptions)
      .replace(/#{nonce}/g, data.nonce || '');
  }

  /**
   * Inject xterm.js scripts into the webview
   */
  private injectXtermScripts(html: string, webview: vscode.Webview): string {
    try {
      console.log('Injecting xterm scripts...');

      // Try to find xterm files in the extension
      const possibleXtermPaths = [
        'node_modules/xterm/lib/xterm.js',
        'node_modules/@xterm/xterm/lib/xterm.js',
        'dist/xterm.js',
        'out/xterm.js'
      ];

      const possibleCssPaths = [
        'node_modules/xterm/css/xterm.css',
        'node_modules/@xterm/xterm/css/xterm.css',
        'dist/xterm.css',
        'out/xterm.css'
      ];

      const possibleFitPaths = [
        'node_modules/xterm-addon-fit/lib/xterm-addon-fit.js',
        'node_modules/@xterm/addon-fit/lib/addon-fit.js',
        'dist/xterm-addon-fit.js',
        'out/xterm-addon-fit.js'
      ];

      let xtermScriptUri = '';
      let xtermCssUri = '';
      let fitAddonUri = '';

      // Try to find and generate URIs for the xterm files
      for (const scriptPath of possibleXtermPaths) {
        try {
          const fullPath = path.join(this.extensionPath, scriptPath);
          if (fs.existsSync(fullPath)) {
            xtermScriptUri = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
            console.log('Found xterm script at:', scriptPath);
            break;
          }
        } catch {
          // Continue searching
        }
      }

      for (const cssPath of possibleCssPaths) {
        try {
          const fullPath = path.join(this.extensionPath, cssPath);
          if (fs.existsSync(fullPath)) {
            xtermCssUri = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
            console.log('Found xterm CSS at:', cssPath);
            break;
          }
        } catch {
          // Continue searching
        }
      }

      for (const fitPath of possibleFitPaths) {
        try {
          const fullPath = path.join(this.extensionPath, fitPath);
          if (fs.existsSync(fullPath)) {
            fitAddonUri = webview.asWebviewUri(vscode.Uri.file(fullPath)).toString();
            console.log('Found fit addon at:', fitPath);
            break;
          }
        } catch {
          // Continue searching
        }
      }

      // Inject the scripts if found
      const headCloseIndex = html.indexOf('</head>');
      if (headCloseIndex !== -1 && (xtermScriptUri || xtermCssUri)) {
        let xtermIncludes = '';

        if (xtermCssUri) {
          xtermIncludes += `\n    <link rel="stylesheet" href="${xtermCssUri}">`;
        }

        if (xtermScriptUri) {
          xtermIncludes += `\n    <script src="${xtermScriptUri}"></script>`;
        }

        if (fitAddonUri) {
          xtermIncludes += `\n    <script src="${fitAddonUri}"></script>`;
        }

        if (xtermIncludes) {
          html =
            html.substring(0, headCloseIndex) +
            xtermIncludes +
            '\n' +
            html.substring(headCloseIndex);
          console.log('Xterm scripts injected');
        } else {
          console.warn('No xterm files found to inject');
        }
      }

      return html;
    } catch (error) {
      console.error('Failed to inject xterm scripts:', error);
      return html;
    }
  }

  /**
   * Generate model options HTML
   */
  private generateModelOptions(): string {
    return EXTENSION_CONFIG.AVAILABLE_MODELS.map(
      (model: { id: string; displayName: string }) =>
        `<option value="${this.escapeHtml(model.id)}">${this.escapeHtml(model.displayName)}</option>`
    ).join('\n            ');
  }

  /**
   * Generate cryptographic nonce for CSP
   */
  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Fallback minimal template if external file fails to load
   */
  private getMinimalTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src #{cspSource} 'unsafe-inline'; script-src #{cspSource} 'unsafe-inline';">
    <title>Aider Chat</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 10px; 
            color: var(--vscode-foreground); 
        }
        .error { 
            color: var(--vscode-errorForeground); 
            background: var(--vscode-errorBackground); 
            padding: 8px; 
            border-radius: 4px; 
        }
    </style>
</head>
<body>
    <div class="error">
        <h3>Template Loading Error</h3>
        <p>Could not load the chat interface template. Please check the extension installation.</p>
    </div>
</body>
</html>`;
  }
}
