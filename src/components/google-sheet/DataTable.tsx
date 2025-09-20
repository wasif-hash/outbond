interface DataTableProps {
  data: string[][];
}

export const DataTable = ({ data }: DataTableProps) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No data found in this sheet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="min-w-full border-collapse">
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? 'bg-gray-50' : 'hover:bg-gray-50'}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`border border-gray-200 px-3 py-2 text-sm ${
                    rowIndex === 0 ? 'font-medium bg-gray-100' : ''
                  }`}
                >
                  {cell || '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 bg-gray-50 text-sm text-gray-600">
        Showing {data.length} rows × {data[0]?.length || 0} columns
      </div>
    </div>
  );
};