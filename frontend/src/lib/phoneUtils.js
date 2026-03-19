/** При вводе телефона: 8→+7, 7→+7, 9...→+79... */
export function normalizePhone(val) {
  if (!val || val.startsWith("+7")) return val;
  if (val.startsWith("8")) return "+7" + val.slice(1).trimStart();
  if (val.startsWith("7")) return "+" + val;
  return "+7" + val;
}
