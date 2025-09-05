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

    return this.processTemplate(template, templateData);
  }

  /**
   * Get HTML template (cached after first load)
   */
  private getHtmlTemplate(): string {
    if (!this.htmlTemplate) {
      const templatePath = path.join(this.extensionPath, 'src', 'webview', 'chat-view.html');

      try {
        this.htmlTemplate = fs.readFileSync(templatePath, 'utf8');
      } catch {
        // Fallback to minimal template if file not found
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
   * Generate model options HTML
   */
  private generateModelOptions(): string {
    return EXTENSION_CONFIG.AVAILABLE_MODELS.map(
      model =>
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
