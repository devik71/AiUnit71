import path from 'path';
import { cleanDir, ensureDir, writeFile, generateYamlFrontmatter, replacePlaceholders, prefixSkillReferences } from '../utils.js';

/**
 * Claude Code Transformer (Skills Only)
 */
export function transformClaudeCode(skills, distDir, patterns = null, options = {}) {
  const { prefix = '', outputSuffix = '' } = options;
  const claudeDir = path.join(distDir, `claude-code${outputSuffix}`);
  const skillsDir = path.join(claudeDir, '.claude/skills');

  cleanDir(claudeDir);
  ensureDir(skillsDir);

  const allSkillNames = skills.map(s => s.name);
  const commandNames = skills.filter(s => s.userInvokable).map(s => `${prefix}${s.name}`);
  let refCount = 0;
  for (const skill of skills) {
    const skillName = `${prefix}${skill.name}`;
    const skillDir = path.join(skillsDir, skillName);

    // Retain all AiUnit71 frontmatter properties, override name
    const frontmatterObj = { ...skill.rawFrontmatter };
    frontmatterObj.name = skillName;
    if (skill.description) {
      frontmatterObj.description = skill.description;
    }

    // Clean up purely impeccable fields if any leaked
    delete frontmatterObj['user-invokable'];
    delete frontmatterObj['args'];

    const frontmatter = generateYamlFrontmatter(frontmatterObj);
    let skillBody = replacePlaceholders(skill.body, 'claude-code', commandNames);
    if (prefix) skillBody = prefixSkillReferences(skillBody, prefix, allSkillNames);
    const content = `${frontmatter}\n\n${skillBody}`;
    const outputPath = path.join(skillDir, 'SKILL.md');
    writeFile(outputPath, content);

    // Copy reference files if they exist
    if (skill.references && skill.references.length > 0) {
      const refDir = path.join(skillDir, 'reference');
      ensureDir(refDir);
      for (const ref of skill.references) {
        const refOutputPath = path.join(refDir, `${ref.name}.md`);
        const refContent = replacePlaceholders(ref.content, 'claude-code');
        writeFile(refOutputPath, refContent);
        refCount++;
      }
    }
  }

  const prefixInfo = prefix ? ` [${prefix}prefixed]` : '';
  console.log(`✓ Claude Code${prefixInfo}: ${skills.length} skills`);
}
