/**
 * Same instructions and output contract as
 * buildConceptExtractionPrompt — the schema the model must
 * return is identical, since both paths produce the same
 * ConceptExtractionResult. The only difference is how the source
 * content is provided: here it's attached as image content
 * block(s) alongside this prompt, rather than embedded as text.
 */
export function buildImageConceptExtractionPrompt(): string {
  return `
You are the Teacher Brain of an educational platform.

The attached image(s) are photographs of a page (or pages) from a
curriculum or educational book. Read the visible text carefully and
extract the fundamental educational concepts it contains.

A concept should represent a meaningful idea that a student needs to
understand. Do not create concepts for every sentence or example. If the
photograph is unclear or the text is only partially legible, extract what
you can confidently read and note any uncertainty in "warnings" rather
than guessing at illegible content.

For each concept, return:

- id: a short stable identifier
- name: the concept name
- learningObjectives: what the student should be able to understand or do
- explanation: a clear explanation of the concept
- prerequisites: concepts that should be understood first
- misconceptions: common ways a student might misunderstand the concept
- teachingStrategies: effective ways to teach the concept
- activities: activities that reinforce the concept
- realLifeExamples: real-world examples
- questionTemplates: types of questions that can assess understanding
- keywords: important search keywords

Return ONLY valid JSON in exactly this format:

{
  "concepts": [
    {
      "id": "string",
      "name": "string",
      "learningObjectives": ["string"],
      "explanation": "string",
      "prerequisites": ["string"],
      "misconceptions": ["string"],
      "teachingStrategies": ["string"],
      "activities": ["string"],
      "realLifeExamples": ["string"],
      "questionTemplates": ["string"],
      "keywords": ["string"]
    }
  ],
  "warnings": [],
  "metadata": {
    "documentId": "string",
    "extractor": "string",
    "extractedAt": "ISO timestamp"
  }
}
`;
}
