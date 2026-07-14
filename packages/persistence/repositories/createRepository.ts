import { Concept } from "../../shared-types";

export interface ConceptRepository {

  save(concept: Concept): Promise<void>;

  saveMany(concepts: Concept[]): Promise<void>;

  findById(id: string): Promise<Concept | null>;

  search(query: string): Promise<Concept[]>;

}

