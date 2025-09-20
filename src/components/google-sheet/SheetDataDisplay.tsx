
import { SpreadsheetData, GoogleSpreadsheet } from '@/types/google-sheet';
import { SheetTabs } from './SheetTabs';
import { DataTable } from './DataTable';

interface SheetDataDisplayProps {
  selectedSheet: SpreadsheetData;
  spreadsheets: GoogleSpreadsheet[];
  loading: boolean;
  onSelectSheet: (spreadsheetId: string, sheetTitle: string) => void;
}

export const SheetDataDisplay = ({
  selectedSheet,
  spreadsheets,
  loading,
  onSelectSheet
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
      />

      <DataTable data={selectedSheet.data} />
    </div>
  );
};
