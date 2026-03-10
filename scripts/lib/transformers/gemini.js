import path from 'path';
import { cleanDir, ensureDir, writeFile, generateYamlFrontmatter, replacePlaceholders, prefixSkillReferences } from '../utils.js';

/**
 * Gemini Transformer (Skills Only)
 */
export function transformGemini(skills, distDir, patterns = null, options = {}) {
  const { prefix = '', outputSuffix = '' } = options;
  const geminiDir = path.join(distDir, `gemini${outputSuffix}`);
  const skillsDir = path.join(geminiDir, '.gemini/skills');

  cleanDir(geminiDir);
  ensureDir(skillsDir);

  const allSkillNames = skills.map(s => s.name);
  const commandNames = skills.filter(s => s.userInvokable).map(s => `${prefix}${s.name}`);
  let refCount = 0;
  for (const skill of skills) {
    const skillName = `${prefix}${skill.name}`;
    const skillDir = path.join(skillsDir, skillName);

    const frontmatterObj = {
      name: skillName,
      description: skill.description,
    };

    const frontmatter = generateYamlFrontmatter(frontmatterObj);
    let skillBody = replacePlaceholders(skill.body, 'gemini', commandNames);

    // Inject MCP inline TODOs
    if (skill.rawFrontmatter.mcp_integration && Array.isArray(skill.rawFrontmatter.mcp_integration.required_tools)) {
      const mcpTodos = skill.rawFrontmatter.mcp_integration.required_tools.map(
        t => `<!-- TODO(mcp): Ensure memory usage support for tool: ${t.tool}, action: ${t.action}, key: ${t.key} -->`
      ).join('\n');
      skillBody = `${mcpTodos}\n\n${skillBody}`;
    }

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
        const refContent = replacePlaceholders(ref.content, 'gemini');
        writeFile(refOutputPath, refContent);
        refCount++;
      }
    }
  }

  const prefixInfo = prefix ? ` [${prefix}prefixed]` : '';
  console.log(`✓ Gemini${prefixInfo}: ${skills.length} skills`);
}
