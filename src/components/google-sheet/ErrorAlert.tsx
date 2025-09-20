interface ErrorAlertProps {
  error: string;
  onClose: () => void;
}

export const ErrorAlert = ({ error, onClose }: ErrorAlertProps) => {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
      <button
        onClick={onClose}
        className="float-right text-red-700 hover:text-red-900"
      >
        ×
      </button>
    </div>
  );
};