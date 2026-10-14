import { SKILL_IDS, SKILLS_REPO_URL } from '../data/content.js';

/**
 * Install prompt for one skill (index into SKILL_IDS) or for all of them ('all'):
 * `full` is what gets copied for the user's AI, `short` is the one-line label shown.
 */
export function skillPrompt(t, which) {
  if (which === 'all') {
    return {
      full: t.skillPromptAll.replace('{repo}', SKILLS_REPO_URL).replace('{names}', SKILL_IDS.join(', ')),
      short: t.skillPromptAllShort,
    };
  }
  const name = SKILL_IDS[which];
  return {
    full: t.skillPrompt.replace('{repo}', SKILLS_REPO_URL).replaceAll('{name}', name),
    short: t.skillPromptShort.replace('{name}', name),
  };
}
