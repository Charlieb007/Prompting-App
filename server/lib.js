/* Pure refiner helpers — no Express/SDK/IO deps, so they can be unit-tested
   in isolation (see lib.test.js). index.js imports everything from here. */

export const DEFAULT_DIMENSIONS = [
  { id: 'specificity', label: 'Specificity', description: 'Concreteness and detail of the request.' },
  { id: 'audience',    label: 'Audience',    description: 'Who the response is for and what they need.' },
  { id: 'format',      label: 'Format',      description: 'Whether the desired output format is specified.' },
  { id: 'constraints', label: 'Constraints', description: 'Limits, exclusions, requirements stated.' },
  { id: 'examples',   label: 'Examples',    description: 'Examples provided or step-by-step reasoning requested.' },
];

// Guidance appended to the system prompt to tailor the refined output to a
// specific destination model's idioms.
export function targetModelGuidance(targetModel) {
  if (!targetModel || typeof targetModel !== 'string') return '';
  if (targetModel.startsWith('claude')) return `\n\nOptimize the refined prompt for Anthropic Claude: use XML tags to delimit sections (e.g. <context>, <instructions>, <example>, <format>), put role and behaviour framing up front, and prefer explicit, structured instructions.`;
  if (targetModel.startsWith('gpt')) return `\n\nOptimize the refined prompt for OpenAI GPT models: use Markdown headings and numbered lists, lead with the single most important instruction, and keep sections clearly separated with ## headers.`;
  if (targetModel.startsWith('gemini')) return `\n\nOptimize the refined prompt for Google Gemini: use concise natural-language sections with explicit step markers and a short illustrative example; avoid heavy XML.`;
  return '';
}

// Guidance that reframes refinement when the input is a system prompt rather
// than a one-off user request.
export function promptTypeGuidance(promptType) {
  if (promptType === 'system') return `\n\nThis is a SYSTEM prompt — it configures an AI assistant's persistent behaviour, not a single one-off request. Refine it accordingly: define the assistant's role and scope, specify behavioural rules and tone, state the output contract, and add guardrails for edge cases and disallowed behaviour. Do NOT collapse it into a single task request.`;
  return '';
}

export function buildSystemPrompt(dimensions, { targetModel, promptType } = {}) {
  const dims = dimensions && dimensions.length > 0 ? dimensions : DEFAULT_DIMENSIONS;
  const dimList = dims.map(d => `  - ${d.id}: ${d.description || d.label}`).join('\n');
  const dimKeys = dims.map(d => d.id).join(', ');

  return `You are a prompt engineering specialist. Your job is to take a rough, vague, or incomplete prompt from a user and refine it into a well-structured prompt that will get better results from an AI model.

When refining a prompt, you should:
- Add specificity (what exactly is being asked?)
- Clarify the audience (who is the output for?)
- Specify the output format (length, structure, tone)
- Add useful constraints (what to include, what to exclude)
- Sometimes add examples or ask for step-by-step reasoning

You must respond in this exact format, using these exact delimiters:

<<<REFINED_PROMPT>>>
[the improved prompt text]
<<<CHANGES_JSON>>>
[a JSON array of changes, each with "title" and "explanation" fields]
<<<SCORES_JSON>>>
[a JSON object with "rough" and "refined" keys, each containing scores for these dimensions: ${dimKeys}
Each score is an object: {"score": 1-5, "rationale": "..."}
Dimensions to score:
${dimList}]
<<<END>>>

For follow-up refinements, the user gives you a previously-refined prompt and feedback. Apply the feedback to produce a new refined version. Score the new version (not the original rough prompt) against the previous refined version. The "rough" scores in this case represent the previous refined version's scores.

Be honest in scoring — a great rough prompt should score high. A bad refinement should score low. Don't pad numbers to seem helpful.${targetModelGuidance(targetModel)}${promptTypeGuidance(promptType)}`;
}

export const REFINER_USER_TEMPLATE = (prompt, category, customInstructions) => `Category: ${category}

Rough prompt:
${prompt}
${customInstructions ? `\nAdditional refinement instructions from the user:\n${customInstructions}\n` : ''}
Refine this prompt and respond in the exact format specified.`;

export const FOLLOWUP_USER_TEMPLATE = (originalRough, previousRefined, feedback, category, customInstructions) => `Category: ${category}

Original rough prompt:
${originalRough}

Previous refined version:
${previousRefined}

User feedback for further refinement:
${feedback}
${customInstructions ? `\nAdditional refinement instructions from the user:\n${customInstructions}\n` : ''}
Apply the feedback to produce a new refined version. Score against the previous refined version (use it as the "rough" baseline).`;

export function parseRefinerResponse(fullText) {
  const refined = (fullText.match(/<<<REFINED_PROMPT>>>([\s\S]*?)<<<CHANGES_JSON>>>/) || [])[1]?.trim() || '';
  const changesRaw = (fullText.match(/<<<CHANGES_JSON>>>([\s\S]*?)<<<SCORES_JSON>>>/) || [])[1]?.trim() || '[]';
  const scoresRaw = (fullText.match(/<<<SCORES_JSON>>>([\s\S]*?)<<<END>>>/) || [])[1]?.trim() || '{}';

  let changes = [];
  let scores = null;

  try { changes = JSON.parse(changesRaw); } catch (e) { console.warn('Failed to parse changes JSON:', e); }
  try { scores = JSON.parse(scoresRaw); } catch (e) { console.warn('Failed to parse scores JSON:', e); }

  return { refined, changes, scores };
}
