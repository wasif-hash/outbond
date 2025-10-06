
import { SpreadsheetData, GoogleSpreadsheet } from '@/types/google-sheet';
import { SheetTabs } from './SheetTabs';
import { DataTable } from './DataTable';

interface SheetDataDisplayProps {
  selectedSheet: SpreadsheetData;
  spreadsheets: GoogleSpreadsheet[];
  loading: boolean;
  onSelectSheet: (spreadsheetId: string, sheetTitle: string) => void;
  activeSpreadsheetId?: string;
}

export const SheetDataDisplay = ({
  selectedSheet,
  spreadsheets,
  loading,
  onSelectSheet,
  activeSpreadsheetId
}: SheetDataDisplayProps) => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">
        Sheet Data: {selectedSheet.spreadsheet.properties.title}
      </h3>
      
      <SheetTabs
        sheets={selectedSheet.sheets}
        loading={loading}
        spreadsheets={spreadsheets}
        selectedSheetTitle={selectedSheet.spreadsheet.properties.title}
        onSelectSheet={onSelectSheet}
        activeSpreadsheetId={activeSpreadsheetId}
      />

      <DataTable data={selectedSheet.data} />
    </div>
  );
};
