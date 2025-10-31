'use client';

import { useEffect, useRef } from 'react';
import { ErrorAlert } from './google-sheet/ErrorAlert';
import { ConnectionStatus } from './google-sheet/ConnectionStatus';
import { ConnectionActions } from './google-sheet/ConnectionActions';
import { SpreadsheetsList } from './google-sheet/SpreadsheetsList';
import { useGoogleSheets } from '@/hooks/useGoogleSheet';
import { SheetDataDisplay } from './google-sheet/SheetDataDisplay';
import { toast } from 'sonner';


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

  const lastConnectionRef = useRef<boolean | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const wasExpiredRef = useRef<boolean>(false);

  useEffect(() => {
    void checkConnectionStatus();
  }, [checkConnectionStatus]);

  useEffect(() => {
    const isConnected = Boolean(status?.isConnected && !status?.isExpired);

    if (isConnected && lastConnectionRef.current !== true) {
      toast.success('Google Sheets connected successfully');
    }

    if (!isConnected && lastConnectionRef.current === true) {
      toast.warning('Google Sheets disconnected');
    }

    if (status?.isExpired && !wasExpiredRef.current) {
      toast.warning('Google Sheets connection expired. Please reconnect.');
    }

    wasExpiredRef.current = Boolean(status?.isExpired);
    lastConnectionRef.current = isConnected;
  }, [status]);

  useEffect(() => {
    if (!error) return;
    if (error === lastErrorRef.current) return;
    toast.error(error);
    lastErrorRef.current = error;
  }, [error]);

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
          onFetchSpreadsheets={() => {
            void fetchSpreadsheets({ force: true });
          }}
          onRefreshStatus={() => {
            void checkConnectionStatus();
          }}
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
