export interface ExtractedConcept {

    id: string;

    name: string;

    learningObjectives: string[];

    explanation: string;

    prerequisites: string[];

    misconceptions: string[];

    teachingStrategies: string[];

    activities: string[];

    realLifeExamples: string[];

    questionTemplates: string[];

    keywords: string[];
}

export interface ConceptExtractionResult {

    concepts: ExtractedConcept[];

    warnings: string[];

    metadata: {
        documentId: string;
        extractor: string;
        extractedAt: string;
    };
}