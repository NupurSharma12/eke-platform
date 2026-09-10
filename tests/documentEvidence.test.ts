import assert from "node:assert/strict";

import { ParsedDocument } from "../packages/shared-types";
import { buildDocumentEvidenceText } from "../packages/ai/prompts/documentEvidence";

let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function main() {
  console.log("buildDocumentEvidenceText");

  test("a plain native-text document: every page gets a TEXT: section, no OCR/VISUAL EVIDENCE sections", () => {
    const document: ParsedDocument = {
      id: "text-only.pdf",
      filename: "text-only.pdf",
      kind: "pdf",
      text: "First page\nSecond page",
      pages: ["First page", "Second page"],
    };

    const evidence = buildDocumentEvidenceText(document);

    assert.match(evidence, /PAGE 1\n\nTEXT:\nFirst page/);
    assert.match(evidence, /PAGE 2\n\nTEXT:\nSecond page/);
    assert.doesNotMatch(evidence, /OCR:/);
    assert.doesNotMatch(evidence, /VISUAL EVIDENCE:/);
  });

  test("an OCR-only page (no native text): TEXT: section is omitted, OCR: section carries the text", () => {
    const document: ParsedDocument = {
      id: "ocr-only.pdf",
      filename: "ocr-only.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["Chapter 4 — Living and Non-living things"],
      pageTextSources: ["ocr"],
    };

    const evidence = buildDocumentEvidenceText(document);

    assert.doesNotMatch(evidence, /TEXT:/);
    assert.match(evidence, /OCR:\nChapter 4 — Living and Non-living things/);
  });

  test("visual evidence contributes only visualElements (type + description), never visibleText", () => {
    const document: ParsedDocument = {
      id: "vision-only.pdf",
      filename: "vision-only.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
      pageOcrText: ["some ocr text"],
      pageTextSources: ["ocr"],
      pageVisionAnalysis: [
        {
          visibleText: "SENTINEL_VISIBLE_TEXT_SHOULD_NOT_APPEAR",
          visualElements: [
            { type: "diagram", description: "a right angle formed by two sticks" },
            { type: "table", description: "a two-column living/non-living comparison table" },
          ],
          educationalSignificance: "shows angle classification",
        },
      ],
    };

    const evidence = buildDocumentEvidenceText(document);

    assert.doesNotMatch(evidence, /SENTINEL_VISIBLE_TEXT_SHOULD_NOT_APPEAR/);
    assert.match(evidence, /VISUAL EVIDENCE:\n- diagram: a right angle formed by two sticks\n- table: a two-column living\/non-living comparison table/);
  });

  test("a mixed document: native text, OCR-only, and OCR+vision pages are each formatted correctly and in page order", () => {
    const document: ParsedDocument = {
      id: "mixed.pdf",
      filename: "mixed.pdf",
      kind: "pdf",
      text: "Chapter 4 intro",
      pages: ["Chapter 4 intro", "", ""],
      pageOcrText: [null, "Let's Practise", "obtuse angle example"],
      pageTextSources: [null, "ocr", "ocr"],
      pageVisionAnalysis: [
        null,
        null,
        {
          visibleText: "should not appear",
          visualElements: [{ type: "diagram", description: "an obtuse angle formed by two rays" }],
          educationalSignificance: "geometry",
        },
      ],
    };

    const evidence = buildDocumentEvidenceText(document);

    const page1Index = evidence.indexOf("PAGE 1");
    const page2Index = evidence.indexOf("PAGE 2");
    const page3Index = evidence.indexOf("PAGE 3");
    assert.ok(page1Index < page2Index && page2Index < page3Index, "pages must appear in order");

    assert.match(evidence, /PAGE 1\n\nTEXT:\nChapter 4 intro/);
    assert.doesNotMatch(evidence.slice(page1Index, page2Index), /OCR:|VISUAL EVIDENCE:/);

    const page2Section = evidence.slice(page2Index, page3Index);
    assert.doesNotMatch(page2Section, /TEXT:/);
    assert.match(page2Section, /OCR:\nLet's Practise/);
    assert.doesNotMatch(page2Section, /VISUAL EVIDENCE:/);

    const page3Section = evidence.slice(page3Index);
    assert.doesNotMatch(page3Section, /TEXT:/);
    assert.match(page3Section, /OCR:\nobtuse angle example/);
    assert.match(page3Section, /VISUAL EVIDENCE:\n- diagram: an obtuse angle formed by two rays/);
  });

  test("native text remains available even if pageOcrText is (contrived) also set for the same page — OCR is only shown when it's actually the page's usable source", () => {
    const document: ParsedDocument = {
      id: "text-wins.pdf",
      filename: "text-wins.pdf",
      kind: "pdf",
      text: "real native text",
      pages: ["real native text"],
      pageOcrText: ["a stray OCR result that should not be shown"],
      pageTextSources: ["pdf"],
    };

    const evidence = buildDocumentEvidenceText(document);

    assert.match(evidence, /TEXT:\nreal native text/);
    assert.doesNotMatch(evidence, /a stray OCR result/);
    assert.doesNotMatch(evidence, /OCR:/);
  });

  test("a page with neither text, OCR, nor vision evidence still gets a labelled, non-empty section", () => {
    const document: ParsedDocument = {
      id: "empty-page.pdf",
      filename: "empty-page.pdf",
      kind: "pdf",
      text: "",
      pages: [""],
    };

    const evidence = buildDocumentEvidenceText(document);

    assert.match(evidence, /PAGE 1/);
    assert.match(evidence, /no extracted text or visual evidence/);
  });

  test("deterministic: calling twice on the same document produces byte-identical output", () => {
    const document: ParsedDocument = {
      id: "deterministic.pdf",
      filename: "deterministic.pdf",
      kind: "pdf",
      text: "some text",
      pages: ["some text", ""],
      pageOcrText: [null, "ocr text"],
      pageTextSources: [null, "ocr"],
      pageVisionAnalysis: [null, { visibleText: "x", visualElements: [{ type: "diagram", description: "d" }], educationalSignificance: "s" }],
    };

    assert.equal(buildDocumentEvidenceText(document), buildDocumentEvidenceText(document));
  });

  console.log(`\n${passed} passed`);
}

main();
