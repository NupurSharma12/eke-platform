/**
 * Distinguishes "every cached candidate for this (conceptId,
 * difficulty, questionType) has already been attempted by this
 * student" from a plain cache miss. Thrown instead of silently
 * falling through to a fresh LLM generation or re-serving an
 * already-attempted question, so the caller (the API route) can
 * report this as an explicit state rather than a generic failure.
 */
export class QuestionPoolExhaustedError extends Error {
  constructor(
    message = "Every available question for this concept, difficulty, and question type has already been attempted."
  ) {
    super(message);
    this.name = "QuestionPoolExhaustedError";
  }
}
