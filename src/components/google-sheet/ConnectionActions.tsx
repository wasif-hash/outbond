import { GoogleConnectionStatus } from '@/types/google-sheet';

interface ConnectionActionsProps {
  status: GoogleConnectionStatus | null;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onFetchSpreadsheets: () => void;
  onRefreshStatus: () => void;
}

export const ConnectionActions = ({
  status,
  loading,
  onConnect,
  onDisconnect,
  onFetchSpreadsheets,
  onRefreshStatus
}: ConnectionActionsProps) => {
  return (
    <div className="mb-6 space-x-4">
      {!status?.isConnected || status?.isExpired ? (
        <button
          onClick={onConnect}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : 'Connect Google Account'}
        </button>
      ) : (
        <>
          <button
            onClick={onFetchSpreadsheets}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Fetch Spreadsheets'}
          </button>
          <button
            onClick={onDisconnect}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </>
      )}
      <button
        onClick={onRefreshStatus}
        disabled={loading}
        className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Refresh Status
      </button>
    </div>
  );
};
