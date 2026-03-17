import Papa from "papaparse";

export type ParsedCSV = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [",", ";", "\t"],
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data });
      },
      error: (error) => reject(error),
    });
  });
}
