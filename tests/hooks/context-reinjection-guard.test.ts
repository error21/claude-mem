/**
 * Tests for Context Re-Injection Guard (#1079)
 *
 * Validates:
 * - session-init handler skips SDK agent init when contextInjected=true
 * - session-init handler proceeds with SDK agent init when contextInjected=false
 * - SessionManager.getSession returns undefined for uninitialized sessions
 * - SessionManager.getSession returns session after initialization
 */
import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { homedir } from 'os';
import { join } from 'path';

// Mock modules that cause import chain issues - MUST be before handler imports
// paths.ts calls SettingsDefaultsManager.get() at module load time
mock.module('../../src/shared/SettingsDefaultsManager.js', () => {
  // Must provide ALL static methods AND complete defaults to avoid breaking
  // other tests when Bun runs files in the same process (mock.module is global).
  const DEFAULTS: Record<string, string> = {
    CLAUDE_MEM_MODEL: 'claude-sonnet-4-5',
    CLAUDE_MEM_CONTEXT_OBSERVATIONS: '50',
    CLAUDE_MEM_WORKER_PORT: '37777',
    CLAUDE_MEM_WORKER_HOST: '127.0.0.1',
    CLAUDE_MEM_SKIP_TOOLS: 'ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion',
    CLAUDE_MEM_PROVIDER: 'claude',
    CLAUDE_MEM_CLAUDE_AUTH_METHOD: 'cli',
    CLAUDE_MEM_GEMINI_API_KEY: '',
    CLAUDE_MEM_GEMINI_MODEL: 'gemini-2.5-flash-lite',
    CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: 'true',
    CLAUDE_MEM_OPENROUTER_API_KEY: '',
    CLAUDE_MEM_OPENROUTER_MODEL: 'xiaomi/mimo-v2-flash:free',
    CLAUDE_MEM_OPENROUTER_SITE_URL: '',
    CLAUDE_MEM_OPENROUTER_APP_NAME: 'claude-mem',
    CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES: '20',
    CLAUDE_MEM_OPENROUTER_MAX_TOKENS: '100000',
    CLAUDE_MEM_DATA_DIR: join(homedir(), '.claude-mem'),
    CLAUDE_MEM_LOG_LEVEL: 'INFO',
    CLAUDE_MEM_PYTHON_VERSION: '3.13',
    CLAUDE_CODE_PATH: '',
    CLAUDE_MEM_MODE: 'code',
    CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS: 'false',
    CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS: 'false',
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT: 'false',
    CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT: 'true',
    CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES: 'bugfix,feature,refactor,discovery,decision,change',
    CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS: 'how-it-works,why-it-exists,what-changed,problem-solution,gotcha,pattern,trade-off',
    CLAUDE_MEM_CONTEXT_FULL_COUNT: '0',
    CLAUDE_MEM_CONTEXT_FULL_FIELD: 'narrative',
    CLAUDE_MEM_CONTEXT_SESSION_COUNT: '10',
    CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY: 'true',
    CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE: 'false',
    CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT: 'true',
    CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: 'false',
    CLAUDE_MEM_MAX_CONCURRENT_AGENTS: '2',
    CLAUDE_MEM_EXCLUDED_PROJECTS: '',
    CLAUDE_MEM_FOLDER_MD_EXCLUDE: '[]',
    CLAUDE_MEM_CHROMA_ENABLED: 'true',
    CLAUDE_MEM_CHROMA_MODE: 'local',
    CLAUDE_MEM_CHROMA_HOST: '127.0.0.1',
    CLAUDE_MEM_CHROMA_PORT: '8000',
    CLAUDE_MEM_CHROMA_SSL: 'false',
    CLAUDE_MEM_CHROMA_API_KEY: '',
    CLAUDE_MEM_CHROMA_TENANT: 'default_tenant',
    CLAUDE_MEM_CHROMA_DATABASE: 'default_database',
    CLAUDE_MEM_STORAGE_PROVIDER: 'sqlite',
    CLAUDE_MEM_PG_HOST: '127.0.0.1',
    CLAUDE_MEM_PG_PORT: '5432',
    CLAUDE_MEM_PG_DATABASE: 'claude_mem',
    CLAUDE_MEM_PG_USER: '',
    CLAUDE_MEM_PG_PASSWORD: '',
    CLAUDE_MEM_PG_SSL: 'false',
    CLAUDE_MEM_PG_CONNECTION_STRING: '',
    CLAUDE_MEM_PG_POOL_MIN: '2',
    CLAUDE_MEM_PG_POOL_MAX: '10',
    CLAUDE_MEM_EMBEDDING_PROVIDER: 'local',
    CLAUDE_MEM_EMBEDDING_API_KEY: '',
    CLAUDE_MEM_EMBEDDING_MODEL: '',
    CLAUDE_MEM_EMBEDDING_DIMENSIONS: '',
  };

  const applyEnvOverrides = (settings: Record<string, string>) => {
    const result = { ...settings };
    for (const key of Object.keys(DEFAULTS)) {
      if (process.env[key] !== undefined) {
        result[key] = process.env[key]!;
      }
    }
    return result;
  };

  return {
    SettingsDefaultsManager: {
      get: (key: string) => process.env[key] ?? DEFAULTS[key] ?? '',
      getInt: (key: string) => parseInt(process.env[key] ?? DEFAULTS[key] ?? '0', 10),
      getBool: (key: string) => (process.env[key] ?? DEFAULTS[key] ?? '') === 'true',
      getAllDefaults: () => ({ ...DEFAULTS }),
      loadFromFile: (settingsPath: string) => {
        try {
          const { readFileSync, existsSync, mkdirSync, writeFileSync } = require('fs');
          const { dirname } = require('path');
          if (!existsSync(settingsPath)) {
            const dir = dirname(settingsPath);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(settingsPath, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
            return applyEnvOverrides({ ...DEFAULTS });
          }
          const data = readFileSync(settingsPath, 'utf-8');
          const parsed = JSON.parse(data);
          let flat = parsed;
          if (parsed.env && typeof parsed.env === 'object') {
            flat = parsed.env;
            // Auto-migrate file from nested to flat schema
            try { writeFileSync(settingsPath, JSON.stringify(flat, null, 2), 'utf-8'); } catch {}
          }
          const result = { ...DEFAULTS };
          for (const key of Object.keys(DEFAULTS)) {
            if (flat[key] !== undefined) (result as any)[key] = flat[key];
          }
          return applyEnvOverrides(result);
        } catch {
          return applyEnvOverrides({ ...DEFAULTS });
        }
      },
    },
  };
});

mock.module('../../src/shared/worker-utils.js', () => ({
  ensureWorkerRunning: () => Promise.resolve(true),
  getWorkerPort: () => 37777,
}));

mock.module('../../src/utils/project-name.js', () => ({
  getProjectName: () => 'test-project',
}));

mock.module('../../src/utils/project-filter.js', () => {
  // Must provide full implementation since mock.module is global in Bun
  function globToRegex(pattern: string): RegExp {
    let expanded = pattern.startsWith('~') ? homedir() + pattern.slice(1) : pattern;
    expanded = expanded.replace(/\\/g, '/');
    let regex = expanded.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regex = regex
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    return new RegExp(`^${regex}$`);
  }
  return {
    isProjectExcluded: (projectPath: string, exclusionPatterns: string): boolean => {
      if (!exclusionPatterns || !exclusionPatterns.trim()) return false;
      const normalizedProjectPath = projectPath.replace(/\\/g, '/');
      const patternList = exclusionPatterns.split(',').map(p => p.trim()).filter(Boolean);
      for (const pattern of patternList) {
        try {
          if (globToRegex(pattern).test(normalizedProjectPath)) return true;
        } catch { continue; }
      }
      return false;
    },
  };
});

// Now import after mocks
import { logger } from '../../src/utils/logger.js';

// Suppress logger output during tests
let loggerSpies: ReturnType<typeof spyOn>[] = [];

beforeEach(() => {
  loggerSpies = [
    spyOn(logger, 'info').mockImplementation(() => {}),
    spyOn(logger, 'debug').mockImplementation(() => {}),
    spyOn(logger, 'warn').mockImplementation(() => {}),
    spyOn(logger, 'error').mockImplementation(() => {}),
    spyOn(logger, 'failure').mockImplementation(() => {}),
  ];
});

afterEach(() => {
  loggerSpies.forEach(spy => spy.mockRestore());
});

describe('Context Re-Injection Guard (#1079)', () => {
  describe('session-init handler - contextInjected flag behavior', () => {
    it('should skip SDK agent init when contextInjected is true', async () => {
      const fetchedUrls: string[] = [];

      const mockFetch = mock((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchedUrls.push(urlStr);

        if (urlStr.includes('/api/sessions/init')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              sessionDbId: 42,
              promptNumber: 2,
              skipped: false,
              contextInjected: true  // SDK agent already running
            })
          });
        }

        // The /sessions/42/init call — should NOT be reached
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'initialized' })
        });
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        const { sessionInitHandler } = await import('../../src/cli/handlers/session-init.js');

        const result = await sessionInitHandler.execute({
          sessionId: 'test-session-123',
          cwd: '/test/project',
          prompt: 'second prompt in this session',
          platform: 'claude-code',
        });

        // Should return success without making the second /sessions/42/init call
        expect(result.continue).toBe(true);
        expect(result.suppressOutput).toBe(true);

        // Only the /api/sessions/init call should have been made
        const apiInitCalls = fetchedUrls.filter(u => u.includes('/api/sessions/init'));
        const sdkInitCalls = fetchedUrls.filter(u => u.includes('/sessions/42/init'));

        expect(apiInitCalls.length).toBe(1);
        expect(sdkInitCalls.length).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should proceed with SDK agent init when contextInjected is false', async () => {
      const fetchedUrls: string[] = [];

      const mockFetch = mock((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchedUrls.push(urlStr);

        if (urlStr.includes('/api/sessions/init')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              sessionDbId: 42,
              promptNumber: 1,
              skipped: false,
              contextInjected: false  // First prompt — SDK agent not yet started
            })
          });
        }

        // The /sessions/42/init call — SHOULD be reached
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'initialized' })
        });
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        const { sessionInitHandler } = await import('../../src/cli/handlers/session-init.js');

        const result = await sessionInitHandler.execute({
          sessionId: 'test-session-456',
          cwd: '/test/project',
          prompt: 'first prompt in session',
          platform: 'claude-code',
        });

        expect(result.continue).toBe(true);
        expect(result.suppressOutput).toBe(true);

        // Both calls should have been made
        const apiInitCalls = fetchedUrls.filter(u => u.includes('/api/sessions/init'));
        const sdkInitCalls = fetchedUrls.filter(u => u.includes('/sessions/42/init'));

        expect(apiInitCalls.length).toBe(1);
        expect(sdkInitCalls.length).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should proceed with SDK agent init when contextInjected is undefined (backward compat)', async () => {
      const fetchedUrls: string[] = [];

      const mockFetch = mock((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        fetchedUrls.push(urlStr);

        if (urlStr.includes('/api/sessions/init')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              sessionDbId: 42,
              promptNumber: 1,
              skipped: false
              // contextInjected not present (older worker version)
            })
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'initialized' })
        });
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      try {
        const { sessionInitHandler } = await import('../../src/cli/handlers/session-init.js');

        const result = await sessionInitHandler.execute({
          sessionId: 'test-session-789',
          cwd: '/test/project',
          prompt: 'test prompt',
          platform: 'claude-code',
        });

        expect(result.continue).toBe(true);

        // When contextInjected is undefined/missing, should still make the SDK init call
        const sdkInitCalls = fetchedUrls.filter(u => u.includes('/sessions/42/init'));
        expect(sdkInitCalls.length).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('SessionManager contextInjected logic', () => {
    it('should return undefined for getSession when no active session exists', async () => {
      const { SessionManager } = await import('../../src/services/worker/SessionManager.js');

      const mockDbManager = {
        getSessionById: () => ({
          id: 1,
          content_session_id: 'test-session',
          project: 'test',
          user_prompt: 'test prompt',
          memory_session_id: null,
          status: 'active',
          started_at: new Date().toISOString(),
          completed_at: null,
        }),
        getSessionStore: () => ({ db: {} }),
      } as any;

      const sessionManager = new SessionManager(mockDbManager);

      // Session 42 has not been initialized in memory
      const session = sessionManager.getSession(42);
      expect(session).toBeUndefined();
    });

    it('should return active session after initializeSession is called', async () => {
      const { SessionManager } = await import('../../src/services/worker/SessionManager.js');

      const mockDbManager = {
        getSessionById: () => ({
          id: 42,
          content_session_id: 'test-session',
          project: 'test',
          user_prompt: 'test prompt',
          memory_session_id: null,
          status: 'active',
          started_at: new Date().toISOString(),
          completed_at: null,
        }),
        getSessionStore: () => ({
          db: {},
          clearMemorySessionId: () => {},
        }),
      } as any;

      const sessionManager = new SessionManager(mockDbManager);

      // Initialize session (simulates first SDK agent init)
      sessionManager.initializeSession(42, 'first prompt', 1);

      // Now getSession should return the active session
      const session = sessionManager.getSession(42);
      expect(session).toBeDefined();
      expect(session!.contentSessionId).toBe('test-session');
    });

    it('should return contextInjected=true pattern for subsequent prompts', async () => {
      const { SessionManager } = await import('../../src/services/worker/SessionManager.js');

      const mockDbManager = {
        getSessionById: () => ({
          id: 42,
          content_session_id: 'test-session',
          project: 'test',
          user_prompt: 'test prompt',
          memory_session_id: 'sdk-session-abc',
          status: 'active',
          started_at: new Date().toISOString(),
          completed_at: null,
        }),
        getSessionStore: () => ({
          db: {},
          clearMemorySessionId: () => {},
        }),
      } as any;

      const sessionManager = new SessionManager(mockDbManager);

      // Before initialization: contextInjected would be false
      expect(sessionManager.getSession(42)).toBeUndefined();

      // After initialization: contextInjected would be true
      sessionManager.initializeSession(42, 'first prompt', 1);
      expect(sessionManager.getSession(42)).toBeDefined();

      // Second call to initializeSession returns existing session (idempotent)
      const session2 = sessionManager.initializeSession(42, 'second prompt', 2);
      expect(session2.contentSessionId).toBe('test-session');
      expect(session2.userPrompt).toBe('second prompt');
      expect(session2.lastPromptNumber).toBe(2);
    });
  });
});
