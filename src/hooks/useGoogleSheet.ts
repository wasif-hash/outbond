
import { useState } from 'react';
import { GoogleSpreadsheet, SpreadsheetData, GoogleConnectionStatus } from '@/types/google-sheet';

export const useGoogleSheets = () => {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/google-sheets/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  };

  const connectGoogleAccount = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/google');
      if (!response.ok) {
        throw new Error('Failed to get Google auth URL');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      setError('Failed to connect Google account');
      console.error('Connect error:', error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogleAccount = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/google-sheets/disconnect', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setStatus(null);
      setSpreadsheets([]);
      setSelectedSheet(null);
      checkConnectionStatus();
    } catch (error) {
      setError('Failed to disconnect Google account');
      console.error('Disconnect error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpreadsheets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/google-sheets');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch spreadsheets');
      }

      const { spreadsheets } = await response.json();
      setSpreadsheets(spreadsheets);
    } catch (error) {
      setError('Failed to fetch spreadsheets');
      console.error('Fetch spreadsheets error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetData = async (spreadsheetId: string, range?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = new URL(`/api/google-sheets/${spreadsheetId}`, window.location.origin);
      if (range) {
        url.searchParams.set('range', range);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch sheet data');
      }

      const data = await response.json();
      setSelectedSheet(data);
    } catch (error) {
      setError('Failed to fetch sheet data');
      console.error('Fetch sheet data error:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
};