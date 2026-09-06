import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Icon, MDI, type MdiName } from "@/components/icons/mdi";
import { PAYMENT_METHODS, footerPageMeta, whatsappHref, type FooterSettings } from "@/modules/stores";

type FooterPage = { title: string; slug: string };
type Props = {
  store: { name: string; logoUrl?: string | null; description?: string | null };
  footer: FooterSettings;
  vatNumber?: string;
  pages: FooterPage[];
};

const SOCIAL: { key: keyof FooterSettings; icon: MdiName; label: string }[] = [
  { key: "instagram", icon: "Instagram", label: "إنستغرام" },
  { key: "snapchat", icon: "Snapchat", label: "سناب شات" },
  { key: "facebook", icon: "Facebook", label: "فيسبوك" },
  { key: "twitter", icon: "Twitter", label: "إكس" },
  { key: "youtube", icon: "Youtube", label: "يوتيوب" },
];

const mdi = (name: string) => MDI[(name in MDI ? name : "FileDocumentOutline") as MdiName];

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-bold text-[var(--fg)]">{children}</h3>;
}

function FooterLink({ href, icon, children, external }: { href: string; icon: string; children: React.ReactNode; external?: boolean }) {
  const cls = "touch-target flex items-center gap-2.5 py-1.5 text-sm text-[var(--muted)] transition hover:text-[var(--brand)]";
  const inner = (
    <>
      <Icon path={mdi(icon)} className="h-[18px] w-[18px] shrink-0 opacity-80" />
      <span>{children}</span>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}

/**
 * ذيل موحّد لكل صفحات المتجر: الهوية، الروابط، السياسات، التواصل، السجلات النظامية، وطرق الدفع.
 * كل عنصر يظهر فقط إن كانت بياناته متوفرة في إعدادات المتجر، فيبقى الذيل نظيفاً لكل مستأجر.
 */
export function StoreFooter({ store, footer, vatNumber, pages }: Props) {
  const year = new Date().getFullYear();
  const company = pages.filter((p) => footerPageMeta(p.slug, p.title).group === "company");
  const policies = pages.filter((p) => footerPageMeta(p.slug, p.title).group === "policies");
  const social = SOCIAL.filter((s) => footer[s.key]);
  const hasContact = Boolean(footer.phone || footer.whatsapp || footer.email || footer.address);
  const legal: { icon: MdiName; label: string; value: string; href?: string }[] = [];
  if (footer.commercialNumber) legal.push({ icon: "CertificateOutline", label: "السجل التجاري", value: footer.commercialNumber });
  if (vatNumber) legal.push({ icon: "ReceiptTextOutline", label: "الرقم الضريبي", value: vatNumber });
  if (footer.certificateId) legal.push({ icon: "CheckDecagramOutline", label: "شهادة المركز السعودي للأعمال", value: footer.certificateId, href: footer.certificateUrl || undefined });
  const payments = footer.payments.map((id) => PAYMENT_METHODS[id]).filter(Boolean);

  return (
    <footer className="mt-10 border-t border-[var(--border)] bg-[var(--surface-1)] pb-[calc(1rem+var(--safe-bottom))] text-sm">
      <Container className="grid grid-cols-1 gap-8 py-8 sm:grid-cols-2 sm:py-10 lg:grid-cols-4 lg:gap-6">
        {/* الهوية */}
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-base font-bold">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)]"><Icon path={MDI.StoreOutline} /></span>
            )}
            <span>{store.name}</span>
          </Link>
          {store.description && <p className="mt-3 max-w-xs leading-6 text-[var(--muted)]">{store.description}</p>}
          {social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="حساباتنا على التواصل الاجتماعي">
              {social.map((s) => (
                <li key={s.key}>
                  <a href={String(footer[s.key])} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">
                    <Icon path={MDI[s.icon]} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* روابط مهمة */}
        <nav aria-label="روابط مهمة">
          <Heading>روابط مهمة</Heading>
          <ul>
            {company.map((p) => (
              <li key={p.slug}><FooterLink href={`/pages/${encodeURIComponent(p.slug)}`} icon={footerPageMeta(p.slug, p.title).icon}>{p.title}</FooterLink></li>
            ))}
            <li><FooterLink href="/blog" icon="PostOutline">المدونة</FooterLink></li>
            <li><FooterLink href="/account" icon="LockOutline">حسابي وطلباتي</FooterLink></li>
          </ul>
        </nav>

        {/* السياسات */}
        {policies.length > 0 && (
          <nav aria-label="السياسات">
            <Heading>السياسات</Heading>
            <ul>
              {policies.map((p) => (
                <li key={p.slug}><FooterLink href={`/pages/${encodeURIComponent(p.slug)}`} icon={footerPageMeta(p.slug, p.title).icon}>{p.title}</FooterLink></li>
              ))}
            </ul>
          </nav>
        )}

        {/* تواصل معنا */}
        {hasContact && (
          <address className="not-italic">
            <Heading>تواصل معنا</Heading>
            <ul>
              {footer.phone && <li><FooterLink href={`tel:${footer.phone}`} icon="PhoneOutline" external><span dir="ltr">{footer.phone}</span></FooterLink></li>}
              {footer.whatsapp && <li><FooterLink href={whatsappHref(footer.whatsapp)} icon="Whatsapp" external>واتساب <span dir="ltr">{footer.whatsapp}</span></FooterLink></li>}
              {footer.email && <li><FooterLink href={`mailto:${footer.email}`} icon="EmailOutline" external><span dir="ltr">{footer.email}</span></FooterLink></li>}
              {footer.address && (
                <li className="flex items-start gap-2.5 py-1.5 text-[var(--muted)]">
                  <Icon path={MDI.MapMarkerOutline} className="mt-0.5 h-[18px] w-[18px] shrink-0 opacity-80" />
                  <span>{footer.address}</span>
                </li>
              )}
            </ul>
          </address>
        )}
      </Container>

      {/* السجلات النظامية وطرق الدفع */}
      {(legal.length > 0 || payments.length > 0) && (
        <div className="border-t border-[var(--border)]">
          <Container className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            {legal.length > 0 && (
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--muted)]">
                {legal.map((l) => {
                  const body = (
                    <>
                      <Icon path={MDI[l.icon]} className="h-4 w-4 shrink-0" />
                      <span>{l.label}:</span>
                      <span className="font-semibold text-[var(--fg)]" dir="ltr">{l.value}</span>
                    </>
                  );
                  return (
                    <li key={l.label}>
                      {l.href ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-[var(--brand)]" title="التحقق من الشهادة">
                          {body}<Icon path={MDI.OpenInNew} className="h-3 w-3 opacity-70" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">{body}</span>
                      )}
                    </li>
                  );
                })}
                {footer.certificateImage && (
                  <li>
                    <a href={footer.certificateUrl || footer.certificateImage} target="_blank" rel="noopener noreferrer" className="inline-block" title="شهادة توثيق المتجر">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={footer.certificateImage} alt="شهادة توثيق المتجر من المركز السعودي للأعمال" className="h-10 w-auto rounded border border-[var(--border)] bg-white object-contain" loading="lazy" />
                    </a>
                  </li>
                )}
              </ul>
            )}
            {payments.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2" aria-label="طرق الدفع المتاحة">
                {payments.map((pm) => (
                  <li key={pm.name} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--fg)]">
                    <Icon path={mdi(pm.icon)} className="h-4 w-4 text-[var(--muted)]" />
                    <span>{pm.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Container>
        </div>
      )}

      <div className="border-t border-[var(--border)]">
        <Container className="flex flex-col items-center gap-1 py-4 text-center text-xs text-[var(--muted)] sm:flex-row sm:justify-between sm:text-start">
          <span>© {year} {store.name} — جميع الحقوق محفوظة</span>
          {footer.legalName && <span className="inline-flex items-center gap-1.5"><Icon path={MDI.OfficeBuildingOutline} className="h-3.5 w-3.5" />{footer.legalName}</span>}
        </Container>
      </div>
    </footer>
  );
}
