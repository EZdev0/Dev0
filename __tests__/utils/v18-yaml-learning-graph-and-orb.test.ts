import JSZip from 'jszip';
import {
  discoverYamlSkills,
  formatSkillSourceForDisplay,
  matchActiveSkillsForTurn,
  repairCorruptedSkillContent,
  importSkillsFromZipOrFiles,
} from '../../utils/skill-loader';
import { buildSystemPrompt } from '../../utils/ai-service';
import { FileNode } from '../../types';

describe('Dev0 v1.8 — Extra YAML Learning, .ZIP Skill Pack Importer, Corrupted YAML AI Fix & Active Skill Matching', () => {
  it('strips .qoder/ and .qcoder/ prefixes from displayed skill sources', () => {
    expect(formatSkillSourceForDisplay('.qoder/rules/Agent.md')).toBe('rules/Agent.md');
    expect(formatSkillSourceForDisplay('.qcoder/skills/test.md')).toBe('skills/test.md');
    expect(formatSkillSourceForDisplay('.agents/teamwork/SKILL.md')).toBe('teamwork/SKILL.md');
  });

  it('flags non-YAML AGENTS.md or broken frontmatter as isCorrupted=true and repairs it via repairCorruptedSkillContent', () => {
    const files: FileNode[] = [
      {
        id: 'f1',
        name: 'AGENTS.md',
        type: 'file',
        content: '# Project Rules\nAlways use strict TypeScript and never push to main.',
      },
    ];

    const discovered = discoverYamlSkills(files);
    expect(discovered.length).toBe(1);
    expect(discovered[0].isCorrupted).toBe(true);
    expect(Boolean(discovered[0].corruptionReason)).toBe(true);

    const repaired = repairCorruptedSkillContent('AGENTS.md', files[0].content!);
    expect(repaired.valid).toBe(true);
    expect(repaired.content.startsWith('---\n')).toBe(true);
    expect(repaired.content.includes('name:')).toBe(true);
    expect(repaired.content.includes('trigger:')).toBe(true);

    const rediscovered = discoverYamlSkills([
      {
        ...files[0],
        content: repaired.content,
      },
    ]);
    expect(rediscovered.length).toBe(1);
    expect(rediscovered[0].isCorrupted).toBe(false);
  });

  it('extracts valid and corrupted skills from a .zip archive via importSkillsFromZipOrFiles', async () => {
    const zip = new JSZip();
    zip.file(
      'skills/valid-skill.md',
      `---\nname: Zustand Store Skill\ndescription: State management rules\ntrigger: keywords\nkeywords: zustand, store\n---\n\nUse selectors for all store reads.`,
    );
    zip.file('AGENTS.md', `# Legacy Non-YAML Agents File\nMust be flagged with (!).`);
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const result = await importSkillsFromZipOrFiles([
      { fileName: 'skills-pack.zip', arrayBuffer: bytes },
    ]);

    expect(result.importedFiles.length).toBe(2);
    expect(result.corruptedCount).toBe(1);
  });

  it('matches background (always) and custom trigger words/phrases in matchActiveSkillsForTurn and returns loadedSkillNames', () => {
    const files: FileNode[] = [
      {
        id: 's1',
        name: 'AGENTS.md',
        type: 'file',
        content: `---\nname: Core AGENTS.md Contract\ndescription: Global repo rules\ntrigger: always\n---\n\nFollow TypeScript strict mode.`,
      },
      {
        id: 's2',
        name: 'firebase-skill.md',
        type: 'file',
        content: `---\nname: Firebase Security Skill\ndescription: Firestore rules\ntrigger: keywords\nkeywords: firestore, security rules, rbac\n---\n\nValidate request.auth != null.`,
      },
    ];

    const skills = discoverYamlSkills(files);
    const turn1 = matchActiveSkillsForTurn(skills, 'How do I center a div in CSS?');
    expect(turn1.loadedSkillNames).toEqual(['Core AGENTS.md Contract']);

    const turn2 = matchActiveSkillsForTurn(skills, 'Please audit our Firestore security rules and RBAC');
    expect(turn2.loadedSkillNames).toEqual([
      'Core AGENTS.md Contract',
      'Firebase Security Skill',
    ]);
    expect(turn2.promptBlock.includes('Firebase Security Skill')).toBe(true);
  });

  it('enforces Forced Extended Thinking (<think>...</think>), removes legacy 5 Identity Files, and enforces Normal Chat Mode Sub-Agent Floating Menu in buildSystemPrompt', () => {
    const promptNormal = buildSystemPrompt({
      persona: 'coder',
      isNormalChatMode: true,
    });

    expect(promptNormal.includes('MANDATORY EXTENDED THINKING')).toBe(true);
    expect(promptNormal.includes('<think>')).toBe(true);
    expect(promptNormal.includes('SOUL.md')).toBe(false);
    expect(promptNormal.includes('IDENTITY.md')).toBe(false);
    expect(promptNormal.includes('Sub-Agent Configuration Floating Modal')).toBe(true);
  });
});
