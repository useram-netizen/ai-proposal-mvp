declare module 'xlsx-populate' {
  interface Cell {
    value(): unknown;
    value(val: string | number | boolean | null): Cell;
  }
  interface Sheet {
    cell(address: string): Cell;
    cell(row: number, col: number): Cell;
  }
  interface Workbook {
    sheet(nameOrIndex: string | number): Sheet;
    outputAsync(): Promise<Buffer>;
  }
  const XlsxPopulate: {
    fromFileAsync(path: string): Promise<Workbook>;
    fromDataAsync(data: Buffer | Uint8Array): Promise<Workbook>;
  };
  export default XlsxPopulate;
}
