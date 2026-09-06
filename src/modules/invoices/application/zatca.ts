/**
 * ترميز TLV لرمز ZATCA (المرحلة الأولى). كل حقل: tag (بايت) + length (بايت) + value (UTF-8).
 * الوسوم: 1=اسم البائع، 2=الرقم الضريبي، 3=الطابع الزمني، 4=الإجمالي، 5=إجمالي الضريبة.
 */
function tlv(tag: number, value: string): Buffer {
  const val = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tag]), Buffer.from([val.length]), val]);
}

export function zatcaQrBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO
  total: string; // بالريال
  vatTotal: string;
}): string {
  const buf = Buffer.concat([
    tlv(1, params.sellerName),
    tlv(2, params.vatNumber),
    tlv(3, params.timestamp),
    tlv(4, params.total),
    tlv(5, params.vatTotal),
  ]);
  return buf.toString("base64");
}
