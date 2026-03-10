#!/usr/bin/env node

/**
 * Build System for Cross-Provider Design Skills
 *
 * Transforms AiUnit71 source skills into provider-specific formats:
 * - Cursor: .cursor/skills/
 * - Claude Code: .claude/skills/
 * - Gemini: .gemini/skills/
 * - Codex: .codex/skills/
 * - Agents: .agents/skills/
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { readSourceFiles, readPatterns } from './lib/utils.js';
import {
  transformCursor,
  transformClaudeCode,
  transformGemini,
  transformCodex,
  transformAgents,
  transformKiro
} from './lib/transformers/index.js';

/**
 * Copy directory recursively
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Assemble universal directory from all provider outputs
 */
function assembleUniversal(distDir, suffix = '') {
  const universalDir = path.join(distDir, `universal${suffix}`);

  if (fs.existsSync(universalDir)) {
    fs.rmSync(universalDir, { recursive: true, force: true });
  }

  const providerMappings = [
    { provider: 'cursor', configDir: '.cursor' },
    { provider: 'claude-code', configDir: '.claude' },
    { provider: 'gemini', configDir: '.gemini' },
    { provider: 'codex', configDir: '.codex' },
    { provider: 'agents', configDir: '.agents' },
    { provider: 'kiro', configDir: '.kiro' },
  ];

  for (const { provider, configDir } of providerMappings) {
    const src = path.join(distDir, `${provider}${suffix}`, configDir);
    const dest = path.join(universalDir, configDir);
    if (fs.existsSync(src)) {
      copyDirSync(src, dest);
    }
  }

  const prefixNote = suffix ? '\nSkills in this bundle are prefixed with i- (e.g. /i-audit) to avoid conflicts.\n' : '';
  fs.writeFileSync(path.join(universalDir, 'README.txt'),
    `AiUnit71 Skills Distribution
${prefixNote}
This folder contains skills for all supported tools:

  .cursor/    → Cursor
  .claude/    → Claude Code
  .gemini/    → Gemini CLI
  .codex/     → Codex CLI
  .agents/    → VS Code Copilot, Antigravity
  .kiro/      → Kiro
`);

  const label = suffix ? ' (prefixed)' : '';
  console.log(`✓ Assembled universal${label} directory (${providerMappings.length} providers)`);
}

/**
 * Main build process
 */
async function build() {
  console.log('🔨 Building cross-provider design skills...\n');

  const { skills } = readSourceFiles(ROOT_DIR);
  // Optional: patterns extraction if maintained
  // const patterns = readPatterns(ROOT_DIR); 
  const patterns = { patterns: [], antipatterns: [] };
  console.log(`📖 Read ${skills.length} skills\n`);

  transformCursor(skills, DIST_DIR, patterns);
  transformClaudeCode(skills, DIST_DIR, patterns);
  transformGemini(skills, DIST_DIR, patterns);
  transformCodex(skills, DIST_DIR, patterns);
  transformAgents(skills, DIST_DIR, patterns);
  transformKiro(skills, DIST_DIR, patterns);

  assembleUniversal(DIST_DIR);

  console.log('\n✨ Build complete!');
}

build();
