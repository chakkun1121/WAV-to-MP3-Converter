
// utils/dataViewUtils.ts
export const getStringFromDataView = (view: DataView, offset: number, length: number): string => {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
};
