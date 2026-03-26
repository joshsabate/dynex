function DataTable({
  columns,
  rows,
  emptyMessage,
  renderActions,
  actionsColumnClassName,
  getRowClassName,
  wrapClassName,
  tableClassName,
}) {
  if (!rows.length) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className={wrapClassName ? `table-wrap ${wrapClassName}` : "table-wrap"}>
      <table className={tableClassName ? `data-table ${tableClassName}` : "data-table"}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className || ""}>
                {column.header}
              </th>
            ))}
            {renderActions ? <th className={actionsColumnClassName || ""}>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.roomId} className={getRowClassName ? getRowClassName(row) : ""}>
              {columns.map((column) => (
                <td key={column.key} className={column.className || ""}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
              {renderActions ? <td className={actionsColumnClassName || ""}>{renderActions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
