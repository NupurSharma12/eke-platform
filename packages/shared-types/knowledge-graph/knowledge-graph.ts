import { Concept } from "../concept/concept";

export type RelationshipType =
  | "prerequisite"
  | "related"
  | "extends";

export interface ConceptRelationship {
  from: string; // Concept ID
  to: string;   // Concept ID
  type: RelationshipType;
}

export interface KnowledgeGraph {
  concepts: Concept[];
  relationships: ConceptRelationship[];
}