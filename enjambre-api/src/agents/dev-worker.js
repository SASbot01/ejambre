// ============================================
// DEV WORKER - Autonomous Developer Agent
// Analyzes BlackWolf projects, finds improvements,
// implements them, commits, pushes, and creates tickets.
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { execSync, exec } from 'child_process';
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

// ---------------------------------------------------------------------------
// Safety constants
// ---------------------------------------------------------------------------

const FORBIDDEN_FILE_PATTERNS = [
  /\.env$/,
  /\.env\..*/,
  /credentials/i,
  /secrets/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /\.pgpass$/,
];

const ALLOWED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.html',
  '.md', '.yml', '.yaml', '.toml', '.sql', '.sh', '.mjs',
];

const PROJECTS = [
  {
    name: 'Enjambre',
    path: '/home/s4sf/ejambre',
    description: 'Main enjambre monorepo (API + Dashboard)',
    srcDirs: ['enjambre-api/src', 'enjambre-dashboard/src'],
  },
  {
    name: 'Dashboard-Ops',
    path: '/home/s4sf/ejambre/Dashboard-Ops-',
    description: 'Operations dashboard (Vercel deploy on push)',
    srcDirs: ['src', 'api'],
  },
  // SOC is only added if it exists
];

if (existsSync('/home/s4sf/ejambre/soc')) {
  PROJECTS.push({
    name: 'SOC',
    path: '/home/s4sf/ejambre/soc',
    description: 'Security Operations Center',
    srcDirs: ['src'],
  });
}

const ANALYSIS_CATEGORIES = [
  {
    name: 'code_quality',
    prompt: `Look for code quality issues:
- Unused imports or variables
- Dead code (functions never called)
- Inconsistent naming conventions
- Duplicated logic that could be extracted
- Missing JSDoc comments on exported functions
- Console.log statements left in production code`,
  },
  {
    name: 'error_handling',
    prompt: `Look for missing or weak error handling:
- try/catch blocks missing around async operations
- Unhandled promise rejections
- Missing error responses in API routes
- Generic catch blocks that swallow errors
- Missing input validation`,
  },
  {
    name: 'security',
    prompt: `Look for security issues:
- SQL injection vectors (string concatenation in queries)
- Missing input sanitization
- XSS vectors in JSX (dangerouslySetInnerHTML)
- Hardcoded tokens or API keys in source code
- Missing rate limiting on endpoints
- Missing CORS configuration issues
- Exposed stack traces in error responses`,
  },
  {
    name: 'performance',
    prompt: `Look for performance issues:
- Unnecessary re-renders in React components (missing memo/useMemo/useCallback)
- N+1 query patterns
- Missing database indexes suggested by query patterns
- Large bundle imports that could be tree-shaken
- Missing pagination on list endpoints
- Synchronous operations that could be async`,
  },
  {
    name: 'build_config',
    prompt: `Look for build and configuration improvements:
- Missing or outdated ESLint rules
- Missing Prettier configuration
- Package.json scripts that could be improved
- Missing .gitignore entries
- Vite/build config optimizations`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shell(cmd, cwd, timeoutMs = 30_000) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    return `ERROR: ${err.stderr || err.message}`.slice(0, 2000);
  }
}

function shellAsync(cmd, cwd, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    const child = exec(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (err, stdout, stderr) => {
      if (err) {
        resolve(`ERROR: ${stderr || err.message}`.slice(0, 2000));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function isForbiddenFile(filePath) {
  return FORBIDDEN_FILE_PATTERNS.some((pat) => pat.test(filePath));
}

function isAllowedExtension(filePath) {
  const ext = extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext) || ext === '';
}

function readFileSafe(filePath, maxBytes = 50_000) {
  if (isForbiddenFile(filePath)) {
    return '[BLOCKED: forbidden file pattern]';
  }
  if (!existsSync(filePath)) {
    return '[FILE NOT FOUND]';
  }
  try {
    const stat = statSync(filePath);
    if (stat.size > maxBytes) {
      return readFileSync(filePath, 'utf-8').slice(0, maxBytes) + '\n...[TRUNCATED]';
    }
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '[READ ERROR]';
  }
}

function collectSourceFiles(projectPath, srcDirs, maxFiles = 40) {
  const files = [];
  for (const srcDir of srcDirs) {
    const dirPath = join(projectPath, srcDir);
    if (!existsSync(dirPath)) continue;
    walkDir(dirPath, files, maxFiles);
    if (files.length >= maxFiles) break;
  }
  return files.slice(0, maxFiles);
}

function walkDir(dir, files, maxFiles, depth = 0) {
  if (depth > 6 || files.length >= maxFiles) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= maxFiles) return;
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') continue;
    if (entry.isDirectory()) {
      walkDir(full, files, maxFiles, depth + 1);
    } else if (entry.isFile() && isAllowedExtension(entry.name) && !isForbiddenFile(entry.name)) {
      files.push(full);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

// ---------------------------------------------------------------------------
// Claude integration
// ---------------------------------------------------------------------------

function createClient() {
  return new Anthropic();
}

async function askClaude(client, systemPrompt, userPrompt, maxTokens = 4096) {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return text;
}

// ---------------------------------------------------------------------------
// Core analysis and implementation
// ---------------------------------------------------------------------------

const ANALYSIS_SYSTEM_PROMPT = `You are an expert senior developer auditing a production codebase.
Your job is to find ONE specific, small, safe improvement you can make.

CRITICAL RULES:
- NEVER suggest changes to .env files, credentials, secrets, or authentication tokens
- NEVER suggest changes that affect client data (CRM contacts, sales, leads, commissions, team data, payments)
- NEVER suggest deleting files
- NEVER suggest changes to database schemas or data migration
- Only suggest changes to: code quality, error handling, performance, security hardening, documentation, tests, build config
- NEVER suggest adding new npm packages or dependencies that are not already in package.json
- Only use imports/modules that already exist in the project
- The change must be small enough to implement in a single commit (1-3 files max)
- The change must not break existing functionality
- Prefer modifying EXISTING source files (adding error handling, adding validation, fixing bugs, improving logic)
- You can also create small new files (like config files) with action "create"
- Focus on real code improvements that make the software better, not just cosmetic

Respond ONLY in this JSON format:
{
  "found": true,
  "category": "code_quality|error_handling|security|performance|build_config",
  "title": "Short title for the ticket",
  "description": "What the issue is and why it matters",
  "file_path": "relative/path/to/file.js",
  "severity": "medium",
  "changes": [
    {
      "file": "relative/path/to/file.js",
      "action": "modify|create",
      "description": "What to change in this file"
    }
  ]
}

If you cannot find any safe improvement, respond with:
{ "found": false, "reason": "explanation" }`;

const IMPLEMENTATION_SYSTEM_PROMPT = `You are an expert developer implementing a specific code improvement.
You will be given the current file contents and a description of what to change.

CRITICAL RULES:
- NEVER modify .env files, credentials, or secrets
- NEVER modify code that handles client data (CRM, sales, leads, commissions, payments)
- NEVER delete existing functionality
- NEVER add new npm packages or imports that are not already installed
- Make the MINIMUM change needed
- Preserve existing code style (indentation, quotes, semicolons)
- Ensure the result is valid, working code
- If unsure, make the safer choice

Respond ONLY with the complete new file contents, nothing else. No markdown code fences, no explanation.
Just the raw file content that should replace the current file.`;

async function analyzeProject(client, project) {
  const files = collectSourceFiles(project.path, project.srcDirs);
  if (files.length === 0) {
    return { found: false, reason: 'No source files found' };
  }

  // Pick a random analysis category for variety
  const category = ANALYSIS_CATEGORIES[Math.floor(Math.random() * ANALYSIS_CATEGORIES.length)];

  // Build a file listing with contents (truncated)
  const fileContents = files.map((f) => {
    const rel = relative(project.path, f);
    const content = readFileSafe(f, 8000);
    return `=== ${rel} ===\n${content}`;
  }).join('\n\n');

  const userPrompt = `Project: ${project.name}
Path: ${project.path}
Description: ${project.description}

Analysis focus: ${category.name}
${category.prompt}

Here are the source files:

${fileContents}

Find ONE specific, small improvement. Respond in the JSON format specified.`;

  const response = await askClaude(client, ANALYSIS_SYSTEM_PROMPT, userPrompt, 2048);

  // Parse the JSON response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { found: false, reason: 'Could not parse Claude response' };
    const result = JSON.parse(jsonMatch[0]);
    if (result.found) {
      result.project = project;
      result.analysisCategory = category.name;
    }
    return result;
  } catch (err) {
    return { found: false, reason: `JSON parse error: ${err.message}` };
  }
}

async function implementChange(client, analysis) {
  const { project, changes } = analysis;
  const results = [];

  for (const change of changes) {
    if (!['modify', 'create'].includes(change.action)) continue;

    const filePath = join(project.path, change.file);

    // Safety checks
    if (isForbiddenFile(filePath)) {
      results.push({ file: change.file, status: 'BLOCKED', reason: 'Forbidden file pattern' });
      continue;
    }
    if (!isAllowedExtension(filePath)) {
      results.push({ file: change.file, status: 'BLOCKED', reason: 'Disallowed file extension' });
      continue;
    }
    if (change.action === 'modify' && !existsSync(filePath)) {
      results.push({ file: change.file, status: 'SKIPPED', reason: 'File does not exist' });
      continue;
    }

    const isCreate = change.action === 'create' || !existsSync(filePath);
    const currentContent = isCreate ? '' : readFileSafe(filePath, 100_000);
    if (!isCreate && currentContent.startsWith('[')) {
      results.push({ file: change.file, status: 'SKIPPED', reason: currentContent });
      continue;
    }

    const userPrompt = isCreate
      ? `Create a new file: ${change.file}\nPurpose: ${change.description}\nContext: ${analysis.title} - ${analysis.description}\n\nOutput the complete file contents. Nothing else.`
      : `File: ${change.file}\nChange requested: ${change.description}\nContext: ${analysis.title} - ${analysis.description}\n\nCurrent file contents:\n${currentContent}\n\nOutput the complete new file contents. Nothing else.`;

    const newContent = await askClaude(client, IMPLEMENTATION_SYSTEM_PROMPT, userPrompt, 4096);

    // Safety: verify we are not wiping an existing file
    if (!isCreate && newContent.length < currentContent.length * 0.5 && currentContent.length > 100) {
      results.push({ file: change.file, status: 'BLOCKED', reason: 'New content is suspiciously shorter than original' });
      continue;
    }

    if (!isCreate && newContent === currentContent) {
      results.push({ file: change.file, status: 'SKIPPED', reason: 'No actual change detected' });
      continue;
    }

    // Write the file
    try {
      writeFileSync(filePath, newContent, 'utf-8');
      results.push({ file: change.file, status: 'APPLIED' });
    } catch (err) {
      results.push({ file: change.file, status: 'ERROR', reason: err.message });
    }
  }

  return results;
}

async function commitAndPush(project, analysis) {
  const cwd = project.path;
  const branch = shell('git rev-parse --abbrev-ref HEAD', cwd);

  // Stage only the specific files we changed
  for (const change of analysis.changes) {
    const filePath = change.file;
    if (isForbiddenFile(filePath)) continue;
    shell(`git add "${filePath}"`, cwd);
  }

  // Check if there are staged changes
  const staged = shell('git diff --cached --stat', cwd);
  if (!staged || staged.startsWith('ERROR')) {
    return { committed: false, reason: 'Nothing staged' };
  }

  // Commit
  const category = analysis.category || 'improvement';
  const commitMsg = `fix(${category}): ${analysis.title}\n\n${analysis.description}\n\n[dev-worker autonomous commit]`;
  const commitResult = shell(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, cwd);

  if (commitResult.startsWith('ERROR')) {
    shell('git reset HEAD', cwd);
    return { committed: false, reason: commitResult };
  }

  // Push
  const pushResult = await shellAsync(`git push origin ${branch}`, cwd, 60_000);
  const pushed = !pushResult.startsWith('ERROR');

  return { committed: true, pushed, branch, commitMessage: commitMsg, pushResult: pushResult.slice(0, 500) };
}

// ---------------------------------------------------------------------------
// BUILD + HEALTH CHECK + ROLLBACK
// ---------------------------------------------------------------------------

async function buildAndDeploy(project, analysis, eventBus, sessionId) {
  const projectName = project.name;
  const cwd = project.path;
  const changedFiles = (analysis.changes || []).map(c => c.file);
  const touchesDashboard = changedFiles.some(f => f.includes('enjambre-dashboard'));
  const touchesAPI = changedFiles.some(f => f.includes('enjambre-api') || f.includes('src/'));

  // Dashboard-Ops deploys automatically via Vercel on push — no action needed
  if (projectName === 'Dashboard-Ops') {
    console.log('[dev-worker] Dashboard-Ops: Vercel auto-deploys on push, skipping local build');
    return { deployed: true, method: 'vercel-auto' };
  }

  // For Enjambre: rebuild dashboard if frontend changed, restart API if backend changed
  const results = { deployed: false, steps: [] };

  // Save current commit hash for rollback
  const prevCommit = shell('git rev-parse HEAD~1', cwd);

  try {
    // Step 1: Build dashboard if frontend files changed
    if (touchesDashboard) {
      console.log('[dev-worker] Building dashboard...');
      const buildResult = await shellAsync('npx vite build', join(cwd, 'enjambre-dashboard'), 120_000);
      if (buildResult.startsWith('ERROR')) {
        console.log('[dev-worker] Build FAILED, rolling back...');
        await rollback(cwd, prevCommit, eventBus, sessionId);
        results.steps.push({ step: 'build', status: 'FAILED', detail: buildResult.slice(0, 300) });
        return results;
      }
      results.steps.push({ step: 'build', status: 'OK' });
    }

    // Step 2: Syntax check API files if backend changed
    if (touchesAPI) {
      console.log('[dev-worker] Syntax checking API...');
      const syntaxCheck = shell('node --check src/server.js', join(cwd, 'enjambre-api'));
      if (syntaxCheck.startsWith('ERROR')) {
        console.log('[dev-worker] Syntax check FAILED, rolling back...');
        await rollback(cwd, prevCommit, eventBus, sessionId);
        results.steps.push({ step: 'syntax', status: 'FAILED', detail: syntaxCheck.slice(0, 300) });
        return results;
      }
      results.steps.push({ step: 'syntax', status: 'OK' });
    }

    // Step 3: Restart API service
    if (touchesAPI || touchesDashboard) {
      console.log('[dev-worker] Restarting enjambre-api service...');
      await shellAsync('systemctl restart enjambre-api', '/tmp', 30_000);
      results.steps.push({ step: 'restart', status: 'OK' });

      // Step 4: Health check — wait and verify API responds
      console.log('[dev-worker] Health check...');
      let healthy = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const check = shell('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3500/health', '/tmp');
          if (check.trim() === '200') {
            healthy = true;
            break;
          }
        } catch {}
      }

      if (!healthy) {
        console.log('[dev-worker] Health check FAILED! Rolling back...');
        await rollback(cwd, prevCommit, eventBus, sessionId);
        await shellAsync('systemctl restart enjambre-api', '/tmp', 30_000);
        // Wait for rollback restart
        await new Promise(r => setTimeout(r, 10000));
        results.steps.push({ step: 'healthcheck', status: 'FAILED' });
        return results;
      }

      results.steps.push({ step: 'healthcheck', status: 'OK' });
      console.log('[dev-worker] Deploy SUCCESS — service healthy');
    }

    results.deployed = true;
    await eventBus.publish('dev.deploy.success', 'developer', {
      sessionId, project: projectName, steps: results.steps,
    });

  } catch (err) {
    console.log(`[dev-worker] Deploy error: ${err.message}, rolling back...`);
    await rollback(cwd, prevCommit, eventBus, sessionId);
    results.steps.push({ step: 'error', status: 'FAILED', detail: err.message });
  }

  return results;
}

async function rollback(cwd, prevCommit, eventBus, sessionId) {
  console.log(`[dev-worker] ROLLBACK to ${prevCommit}`);
  shell(`git revert --no-edit HEAD`, cwd);
  await shellAsync(`git push origin`, cwd, 60_000);
  await eventBus.publish('dev.deploy.rollback', 'developer', { sessionId, rolledBackTo: prevCommit });
}

// ---------------------------------------------------------------------------
// MAIN SESSION LOOP
// ---------------------------------------------------------------------------

export async function startDevSession(durationHours, sessionId, eventBus, dbQuery) {
  const client = createClient();
  const endTime = Date.now() + durationHours * 3600_000;
  let cycleCount = 0;

  console.log(`[dev-worker] Session ${sessionId} started. Duration: ${durationHours}h. Projects: ${PROJECTS.map(p => p.name).join(', ')}`);

  await eventBus.publish('dev.session.started', 'developer', { sessionId, hours: durationHours, projects: PROJECTS.map(p => p.name) });

  while (Date.now() < endTime) {
    cycleCount++;
    const project = PROJECTS[cycleCount % PROJECTS.length];

    console.log(`[dev-worker] Cycle ${cycleCount}: analyzing ${project.name}...`);
    await eventBus.publish('dev.cycle.started', 'developer', { sessionId, cycle: cycleCount, project: project.name });

    try {
      // Analyze
      const analysis = await analyzeProject(client, project);

      if (!analysis.found) {
        console.log(`[dev-worker] Cycle ${cycleCount}: nothing found`);
        await eventBus.publish('dev.cycle.skipped', 'developer', { sessionId, cycle: cycleCount, reason: analysis.reason });
      } else {
        console.log(`[dev-worker] Cycle ${cycleCount}: found "${analysis.title}" (${analysis.analysisCategory}/${analysis.severity})`);

        // Implement
        const implResults = await implementChange(client, analysis);
        const applied = implResults.filter(r => r.status === 'APPLIED');

        if (applied.length > 0) {
          // Commit + Push
          const commitInfo = await commitAndPush(project, analysis);

          if (commitInfo.committed) {
            console.log(`[dev-worker] Cycle ${cycleCount}: committed and pushed`);

            // Build + Deploy + Health Check
            const deployResult = await buildAndDeploy(project, analysis, eventBus, sessionId);

            if (deployResult.deployed) {
              console.log(`[dev-worker] Cycle ${cycleCount}: deployed successfully`);
            } else {
              console.log(`[dev-worker] Cycle ${cycleCount}: deploy failed, rolled back`);
            }

            await eventBus.publish('dev.change.implemented', 'developer', {
              sessionId, cycle: cycleCount, project: project.name,
              title: analysis.title, files: applied.map(r => r.file),
              deployed: deployResult.deployed,
            });
          } else {
            console.log(`[dev-worker] Cycle ${cycleCount}: commit failed - ${commitInfo.reason}`);
          }
        } else {
          const reasons = implResults.map(r => `${r.file}: ${r.status}`).join('; ');
          console.log(`[dev-worker] Cycle ${cycleCount}: no changes applied - ${reasons}`);
        }

        // Create ticket
        try {
          await dbQuery(
            'INSERT INTO dev_tickets (title, description, project, status) VALUES ($1, $2, $3, $4)',
            [analysis.title, analysis.description, project.name.toLowerCase(), applied.length > 0 ? 'done' : 'pending']
          );
        } catch {}
      }
    } catch (err) {
      console.log(`[dev-worker] Cycle ${cycleCount} error: ${err.message}`);
      await eventBus.publish('dev.cycle.error', 'developer', { sessionId, cycle: cycleCount, error: err.message });
    }

    // Wait 10-15 minutes between cycles (saves tokens)
    if (Date.now() >= endTime) break;
    const waitMs = randomBetween(10 * 60 * 1000, 15 * 60 * 1000);
    const waitMin = (waitMs / 60_000).toFixed(1);
    console.log(`[dev-worker] Waiting ${waitMin} minutes before next cycle...`);

    const sleepEnd = Date.now() + waitMs;
    while (Date.now() < sleepEnd && Date.now() < endTime) {
      await sleep(10_000);
    }
  }

  console.log(`[dev-worker] Session ${sessionId} completed. ${cycleCount} cycles.`);
  await eventBus.publish('dev.session.completed', 'developer', { sessionId, cycles: cycleCount });
}