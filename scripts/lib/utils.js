import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Parse frontmatter from markdown content
 * Returns { frontmatter: object, body: string }
 */
export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, frontmatterText, body] = match;
  let frontmatter = {};

  try {
    frontmatter = yaml.load(frontmatterText) || {};
  } catch (e) {
    console.warn('Failed to parse YAML frontmatter:', e.message);
  }

  return { frontmatter, body: body.trim() };
}

/**
 * Recursively read all .md files from a directory
 */
export function readFilesRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      readFilesRecursive(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Read and parse all source files (unified skills architecture)
 * All source lives in source/skills/{name}/SKILL.md
 * Returns { skills } where each skill has userInvokable flag
 */
export function readSourceFiles(rootDir) {
  const skillsDir = path.join(rootDir, 'skills/aiunit71');
  const skills = [];

  if (fs.existsSync(skillsDir)) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(entryPath, 'SKILL.md');

      if (fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, 'utf-8');
        const { frontmatter, body } = parseFrontmatter(content);

        // Read reference files if they exist
        const references = [];
        const referenceDir = path.join(entryPath, 'reference');
        if (fs.existsSync(referenceDir)) {
          const refFiles = fs.readdirSync(referenceDir).filter(f => f.endsWith('.md'));
          for (const refFile of refFiles) {
            const refPath = path.join(referenceDir, refFile);
            const refContent = fs.readFileSync(refPath, 'utf-8');
            references.push({
              name: path.basename(refFile, '.md'),
              content: refContent,
              filePath: refPath
            });
          }
        }

        skills.push({
          rawFrontmatter: frontmatter,
          name: frontmatter.name || entry.name,
          description: frontmatter.description || '',
          body,
          filePath: skillMdPath,
          references
        });
      }
    }
  }

  return { skills };
}

/**
 * Ensure directory exists, create if needed
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Clean directory (remove all contents)
 */
export function cleanDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Write file with automatic directory creation
 */
export function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Extract patterns from frontend-design SKILL.md
 * Parses **DO**: and **DON'T**: lines, grouped by section headings
 * Returns { patterns: [...], antipatterns: [...] }
 */
export function readPatterns(rootDir) {
  const skillPath = path.join(rootDir, 'source/skills/frontend-design/SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return { patterns: [], antipatterns: [] };
  }

  const content = fs.readFileSync(skillPath, 'utf-8');
  const lines = content.split('\n');

  const patternsMap = {};  // category -> items[]
  const antipatternsMap = {};  // category -> items[]
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track section headings (### Typography, ### Color & Theme, etc.)
    if (trimmed.startsWith('### ')) {
      currentSection = trimmed.slice(4).trim();
      // Normalize "Color & Theme" to "Color & Contrast" for consistency
      if (currentSection === 'Color & Theme') {
        currentSection = 'Color & Contrast';
      }
      continue;
    }

    // Parse **DO**: lines
    if (trimmed.startsWith('**DO**:') && currentSection) {
      const item = trimmed.slice(7).trim();
      if (!patternsMap[currentSection]) {
        patternsMap[currentSection] = [];
      }
      patternsMap[currentSection].push(item);
      continue;
    }

    // Parse **DON'T**: lines
    if (trimmed.startsWith("**DON'T**:") && currentSection) {
      const item = trimmed.slice(10).trim();
      if (!antipatternsMap[currentSection]) {
        antipatternsMap[currentSection] = [];
      }
      antipatternsMap[currentSection].push(item);
      continue;
    }
  }

  // Convert maps to arrays in consistent order
  const sectionOrder = ['Typography', 'Color & Contrast', 'Layout & Space', 'Visual Details', 'Motion', 'Interaction', 'Responsive', 'UX Writing'];

  const patterns = [];
  const antipatterns = [];

  for (const section of sectionOrder) {
    if (patternsMap[section] && patternsMap[section].length > 0) {
      patterns.push({ name: section, items: patternsMap[section] });
    }
    if (antipatternsMap[section] && antipatternsMap[section].length > 0) {
      antipatterns.push({ name: section, items: antipatternsMap[section] });
    }
  }

  return { patterns, antipatterns };
}

/**
 * Provider-specific placeholders
 */
export const PROVIDER_PLACEHOLDERS = {
  'claude-code': {
    model: 'Claude',
    config_file: 'CLAUDE.md',
    ask_instruction: 'STOP and call the AskUserQuestionTool to clarify.'
  },
  'cursor': {
    model: 'the model',
    config_file: '.cursorrules',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.'
  },
  'gemini': {
    model: 'Gemini',
    config_file: 'GEMINI.md',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.'
  },
  'codex': {
    model: 'GPT',
    config_file: 'AGENTS.md',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.'
  },
  'agents': {
    model: 'the model',
    config_file: '.github/copilot-instructions.md',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.'
  },
  'kiro': {
    model: 'Claude',
    config_file: '.kiro/settings.json',
    ask_instruction: 'ask the user directly to clarify what you cannot infer.'
  }
};

/**
 * Replace all {{placeholder}} tokens with provider-specific values
 */
/**
 * Prefix skill cross-references in body text.
 * Replaces patterns like `/skillname` and `the skillname skill` with prefixed versions.
 *
 * @param {string} content - The skill body text
 * @param {string} prefix - The prefix to add (e.g., 'i-')
 * @param {string[]} skillNames - Array of all skill names
 */
export function prefixSkillReferences(content, prefix, skillNames) {
  if (!prefix || !skillNames || skillNames.length === 0) return content;

  let result = content;
  // Sort by length descending to avoid partial matches (e.g. 'teach-impeccable' before 'teach')
  const sorted = [...skillNames].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    const prefixed = `${prefix}${name}`;

    // Replace `/skillname` references (command invocations)
    result = result.replace(new RegExp(`\\/(?=${escapeRegex(name)}(?:[^a-zA-Z0-9_-]|$))`, 'g'), `/${prefix}`);

    // Replace `the skillname skill` references
    result = result.replace(new RegExp(`the ${escapeRegex(name)} skill`, 'gi'), `the ${prefixed} skill`);
  }

  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EXCLUDED_FROM_SUGGESTIONS = new Set(['teach-impeccable', 'i-teach-impeccable']);

export function replacePlaceholders(content, provider, commandNames = []) {
  const placeholders = PROVIDER_PLACEHOLDERS[provider] || PROVIDER_PLACEHOLDERS['cursor'];
  const commandList = commandNames
    .filter(n => !EXCLUDED_FROM_SUGGESTIONS.has(n))
    .map(n => `/${n}`)
    .join(', ');

  return content
    .replace(/\{\{model\}\}/g, placeholders.model)
    .replace(/\{\{config_file\}\}/g, placeholders.config_file)
    .replace(/\{\{ask_instruction\}\}/g, placeholders.ask_instruction)
    .replace(/\{\{available_commands\}\}/g, commandList);
}

/**
 * Generate YAML frontmatter string
 */
export function generateYamlFrontmatter(data) {
  if (!data || Object.keys(data).length === 0) return '---\n---';
  return '---\n' + yaml.dump(data, { skipInvalid: true, lineWidth: -1 }).trim() + '\n---';
}
