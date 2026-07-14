import { Concept } from "../../shared-types";
import { ConceptRepository } from "../repositories/ConceptRepository";

export class XysqConceptRepository implements ConceptRepository {

  async save(concept: Concept): Promise<void> {
    throw new Error("Not implemented");
  }

  async saveMany(concepts: Concept[]): Promise<void> {
    throw new Error("Not implemented");
  }

  async findById(id: string): Promise<Concept | null> {
    throw new Error("Not implemented");
  }

  async search(query: string): Promise<Concept[]> {
    throw new Error("Not implemented");
  }
}