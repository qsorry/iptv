import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getAdminContext } from "@/core/tenancy/server";
import { getInvoiceByOrder } from "@/modules/invoices";
import { orderRepository } from "@/modules/orders";
import { formatMoney, toMinor } from "@/core/money";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const invoice = await getInvoiceByOrder(ctx.storeId, id);
  if (!invoice) notFound();
  const order = await orderRepository.findById(ctx.storeId, id);
  const items = order ? await orderRepository.itemsFor(order.id) : [];
  const qr = await QRCode.toDataURL(invoice.qrData, { margin: 1, width: 160 });

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">فاتورة ضريبية مبسّطة</h1>
        <Link href={`/admin/orders/${id}`}><Button variant="secondary">رجوع</Button></Link>
      </div>
      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold">{invoice.sellerName}</div>
            {invoice.vatNumber && <div className="text-sm text-[var(--muted)]">الرقم الضريبي: <span dir="ltr">{invoice.vatNumber}</span></div>}
            <div className="text-sm text-[var(--muted)]">رقم الفاتورة: <span dir="ltr">{invoice.invoiceNumber}</span></div>
            <div className="text-sm text-[var(--muted)]" dir="ltr">{invoice.issuedAt.toLocaleString("ar-SA")}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="ZATCA QR" className="h-32 w-32" />
        </div>

        <table className="w-full text-right text-sm">
          <thead className="text-[var(--muted)]"><tr><th className="py-1">الصنف</th><th className="py-1">كمية</th><th className="py-1">الإجمالي</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-[var(--border)]">
                <td className="py-1">{it.productName}</td>
                <td className="py-1" dir="ltr">{it.quantity}</td>
                <td className="py-1" dir="ltr">{formatMoney(toMinor(it.total), invoice.currencyCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 border-t border-[var(--border)] pt-3 text-sm">
          <Row label="المجموع الفرعي" value={formatMoney(toMinor(invoice.subtotal), invoice.currencyCode)} />
          <Row label="الضريبة" value={formatMoney(toMinor(invoice.taxTotal), invoice.currencyCode)} />
          <Row label="الإجمالي" value={formatMoney(toMinor(invoice.total), invoice.currencyCode)} strong />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span><span dir="ltr">{value}</span>
    </div>
  );
}
