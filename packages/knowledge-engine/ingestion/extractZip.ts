import AdmZip from "adm-zip";

export async function extractZip(
  zipPath: string,
  targetDir: string
): Promise<void> {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);
}
