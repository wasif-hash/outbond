import { GoogleConnectionStatus } from '@/types/google-sheet';

interface ConnectionStatusProps {
  status: GoogleConnectionStatus | null;
}

export const ConnectionStatus = ({ status }: ConnectionStatusProps) => {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
      {status ? (
        <div className="space-y-2">
          <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
            status.isConnected && !status.isExpired 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {status.isConnected && !status.isExpired ? 'Connected' : 'Disconnected/Expired'}
          </div>
          {status.connectedAt && (
            <p className="text-sm text-gray-600">
              Connected: {new Date(status.connectedAt).toLocaleDateString()}
            </p>
          )}
          {status.expiresAt && (
            <p className="text-sm text-gray-600">
              Expires: {new Date(status.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <div className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          Not Connected
        </div>
      )}
    </div>
  );
};
