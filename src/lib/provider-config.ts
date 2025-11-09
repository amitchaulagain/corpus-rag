import fs from 'fs/promises';
import path from 'path';
import type { ProviderConfig } from './providers/base-provider';
import { env } from '$env/dynamic/private';

export class ProviderConfigManager {
  private configPath: string;
  private cache: ProviderConfig[] | null = null;

  constructor(configPath: string = './src/config/providers.json') {
    this.configPath = configPath;
  }

  async loadProviders(): Promise<ProviderConfig[]> {
    if (this.cache) return this.cache;

    try {
      const configFile = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configFile);

      // Inject API keys from environment variables
      const providers = config.providers.map((p: ProviderConfig) => {
        let apiKey = p.apiKey; // Use existing if present

        // Override with env vars if available (try both env module and process.env)
        if (p.type === 'claude' && (env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY)) {
          apiKey = env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY;
        } else if (p.type === 'deepseek' && (env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY)) {
          apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        } else if (p.type === 'gemini' && (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY)) {
          apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        }

        return { ...p, apiKey };
      });

      this.cache = providers;
      return this.cache;
    } catch (error) {
      console.error('Failed to load provider config:', error);
      return [];
    }
  }

  async getEnabledProviders(): Promise<ProviderConfig[]> {
    const providers = await this.loadProviders();
    // Ollama doesn't need API key, so check for it or allow if type is ollama
    return providers.filter((p) => p.enabled && (p.apiKey || p.type === 'ollama'));
  }

  async getProvider(id: string): Promise<ProviderConfig | null> {
    const providers = await this.loadProviders();
    return providers.find((p) => p.id === id) || null;
  }

  async saveProvider(config: ProviderConfig): Promise<void> {
    const providers = await this.loadProviders();
    const index = providers.findIndex((p) => p.id === config.id);

    if (index >= 0) {
      providers[index] = config;
    } else {
      providers.push(config);
    }

    await this.saveConfig({ providers });
    this.cache = null; // Invalidate cache
  }

  async updateProvider(id: string, updates: Partial<ProviderConfig>): Promise<void> {
    const providers = await this.loadProviders();
    const index = providers.findIndex((p) => p.id === id);

    if (index < 0) {
      throw new Error(`Provider not found: ${id}`);
    }

    providers[index] = { ...providers[index], ...updates };
    await this.saveConfig({ providers });
    this.cache = null;
  }

  async deleteProvider(id: string): Promise<void> {
    const providers = await this.loadProviders();
    const filtered = providers.filter((p) => p.id !== id);

    await this.saveConfig({ providers: filtered });
    this.cache = null;
  }

  private async saveConfig(config: { providers: ProviderConfig[] }): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  // Test all enabled providers
  async testAll(): Promise<{ id: string; name: string; success: boolean }[]> {
    const providers = await this.getEnabledProviders();
    const { ClaudeProvider } = await import('./providers/claude-provider');
    const { DeepSeekProvider } = await import('./providers/deepseek-provider');
    const { GeminiProvider } = await import('./providers/gemini-provider');
    const { OllamaProvider } = await import('./providers/ollama-provider');

    const results = await Promise.all(
      providers.map(async (config) => {
        let provider;

        switch (config.type) {
          case 'claude':
            provider = new ClaudeProvider(config);
            break;
          case 'deepseek':
            provider = new DeepSeekProvider(config);
            break;
          case 'gemini':
            provider = new GeminiProvider(config);
            break;
          case 'ollama':
            provider = new OllamaProvider(config);
            break;
          default:
            return { id: config.id, name: config.name, success: false };
        }

        const success = await provider.testConnection();
        return { id: config.id, name: config.name, success };
      })
    );

    return results;
  }
}
