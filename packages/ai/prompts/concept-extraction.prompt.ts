export function buildConceptExtractionPrompt(
  documentText: string
): string {
  return `
You are the Teacher Brain of an educational platform.

Your task is to analyze the provided curriculum document and extract the
fundamental educational concepts contained in it.

A concept should represent a meaningful idea that a student needs to
understand. Do not create concepts for every sentence or example.

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

CURRICULUM DOCUMENT:

${documentText}
`;
}