'use client';

import { useEffect } from 'react';
import { ErrorAlert } from './google-sheet/ErrorAlert';
import { ConnectionStatus } from './google-sheet/ConnectionStatus';
import { ConnectionActions } from './google-sheet/ConnectionActions';
import { SpreadsheetsList } from './google-sheet/SpreadsheetsList';
import { useGoogleSheets } from '@/hooks/useGoogleSheet';
import { SheetDataDisplay } from './google-sheet/SheetDataDisplay';


export default function GoogleSheetsButton() {
  const {
    status,
    spreadsheets,
    selectedSheet,
    loading,
    error,
    setError,
    checkConnectionStatus,
    connectGoogleAccount,
    disconnectGoogleAccount,
    fetchSpreadsheets,
    fetchSheetData,
  } = useGoogleSheets();

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Google Sheets Integration</h2>

        {error && <ErrorAlert error={error} onClose={() => setError(null)} />}

        <ConnectionStatus status={status} />

        <ConnectionActions
          status={status}
          loading={loading}
          onConnect={connectGoogleAccount}
          onDisconnect={disconnectGoogleAccount}
          onFetchSpreadsheets={fetchSpreadsheets}
          onRefreshStatus={checkConnectionStatus}
        />

        <SpreadsheetsList
          spreadsheets={spreadsheets}
          loading={loading}
          onLoadData={fetchSheetData}
        />

        {selectedSheet && (
          <SheetDataDisplay
            selectedSheet={selectedSheet}
            spreadsheets={spreadsheets}
            loading={loading}
            onSelectSheet={fetchSheetData}
          />
        )}
      </div>
    </div>
  );
}