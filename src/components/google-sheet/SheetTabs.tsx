import { GoogleSheetInfo, GoogleSpreadsheet } from '@/types/google-sheet';

interface SheetTabsProps {
  sheets: GoogleSheetInfo[];
  loading: boolean;
  spreadsheets: GoogleSpreadsheet[];
  selectedSheetTitle: string;
  onSelectSheet: (spreadsheetId: string, sheetTitle: string) => void;
}

export const SheetTabs = ({
  sheets,
  loading,
  spreadsheets,
  selectedSheetTitle,
  onSelectSheet
}: SheetTabsProps) => {
  if (sheets.length <= 1) return null;

  return (
    <div className="mb-4">
      <h4 className="font-medium mb-2">Available Sheets:</h4>
      <div className="flex flex-wrap gap-2">
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => {
              const currentSpreadsheetId = spreadsheets.find(s => 
                s.name === selectedSheetTitle
              )?.id;
              if (currentSpreadsheetId) {
                onSelectSheet(currentSpreadsheetId, sheet.title);
              }
            }}
            disabled={loading}
            className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300 disabled:opacity-50"
          >
            {sheet.title}
          </button>
        ))}
      </div>
    </div>
  );
};
