import { GoogleSpreadsheet } from '@/types/google-sheet';

interface SpreadsheetsListProps {
  spreadsheets: GoogleSpreadsheet[];
  loading: boolean;
  onLoadData: (spreadsheetId: string) => void;
}

export const SpreadsheetsList = ({
  spreadsheets,
  loading,
  onLoadData
}: SpreadsheetsListProps) => {
  if (spreadsheets.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">Your Spreadsheets</h3>
      <div className="grid gap-4">
        {spreadsheets.map((sheet) => (
          <div key={sheet.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
            <h4 className="font-medium text-lg mb-2">{sheet.name}</h4>
            <div className="space-x-2">
              <button
                onClick={() => onLoadData(sheet.id)}
                disabled={loading}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                Load Data
              </button>
              <a
                href={sheet.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 inline-block"
              >
                Open in Google Sheets
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};