import { parseDocument } from "./ingestion/parseDocument";

async function main() {
  const document = await parseDocument(
    "data/ncert/eemm103.pdf"
  );

  console.log("Filename:", document.filename);
  console.log("Pages:", document.pages.length);
  console.log("Characters:", document.text.length);

  console.log("\n--- First 1000 characters ---\n");
  console.log(document.text.slice(0, 1000));
}

main().catch(console.error);