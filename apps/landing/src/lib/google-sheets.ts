import { google } from "googleapis";

type SheetRow = (string | number | boolean | null)[];

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
};

type ValidServiceAccount = {
  client_email: string;
  private_key: string;
};

export type WaitlistEntry = {
  aiTools: string;
  email: string;
  experience: string;
  language: string;
  monthlySpend: string;
  referer: string;
  role: string;
  source: string;
  userAgent: string;
  utmCampaign: string;
  utmMedium: string;
  utmSource: string;
};

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let spreadsheetId: string | null = null;
let sheetRange: string | null = null;

export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON && process.env.GOOGLE_SHEETS_ID,
  );
}

function readServiceAccount(): ValidServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;

  if (!raw) {
    throw new Error("Missing env var: GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }

  const parsed = JSON.parse(raw) as ServiceAccount;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY_JSON");
  }

  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function getSheetsClient() {
  if (!sheetsClient) {
    const serviceAccount = readServiceAccount();
    const id = process.env.GOOGLE_SHEETS_ID;

    if (!id) throw new Error("Missing env var: GOOGLE_SHEETS_ID");

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheetsClient = google.sheets({ version: "v4", auth });
    spreadsheetId = id;
    sheetRange = process.env.GOOGLE_SHEETS_RANGE ?? "waitlist";
  }

  return { range: sheetRange!, sheets: sheetsClient, spreadsheetId: spreadsheetId! };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function quoteSheetName(sheetName: string) {
  const trimmed = sheetName.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
}

function getEmailColumnRange(range: string) {
  const [sheetName] = range.split("!");
  return `${quoteSheetName(sheetName)}!B:B`;
}

async function appendToSheet(row: SheetRow) {
  const { range, sheets, spreadsheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function hasWaitlistEmail(email: string) {
  const { range, sheets, spreadsheetId } = getSheetsClient();
  const normalizedEmail = normalizeEmail(email);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: getEmailColumnRange(range),
  });

  const values = response.data.values ?? [];

  return values.some(
    ([value]) => String(value ?? "").trim().toLowerCase() === normalizedEmail,
  );
}

export async function appendWaitlistEntry(entry: WaitlistEntry) {
  await appendToSheet([
    new Date().toISOString(),
    normalizeEmail(entry.email),
    entry.role,
    entry.experience,
    entry.aiTools,
    entry.monthlySpend,
    entry.source,
    entry.referer,
    entry.userAgent,
    entry.language,
    entry.utmSource,
    entry.utmMedium,
    entry.utmCampaign,
  ]);
}
