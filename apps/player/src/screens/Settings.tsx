import { useSession } from "../state/session";
import { useAsync, useSettings } from "../state/hooks";
import { href, navigate } from "../nav/router";
import { xtreamLogin } from "../catalog/xtream";
import { clearHistory } from "../lib/library";
import { date } from "../lib/format";
import { platformKind } from "../platform";
import { Icon } from "../components/Icon";
import type { Account } from "../lib/accounts";

const PLATFORM_LABEL = { tizen: "Samsung Tizen", webos: "LG webOS", android: "Android", vidaa: "VIDAA", browser: "المتصفح" } as const;

function accountLine(a: Account) {
  return a.type === "xtream" ? [a.providerName ?? new URL(a.server).hostname, a.serverLabel, a.username].filter(Boolean).join(" · ") : `قائمة M3U · ${new URL(a.url).hostname}`;
}

/** «المزيد»: الحساب والاشتراك، تبديل الحسابات، تفضيلات التشغيل، وعن التطبيق. */
export function Settings({ wide }: { wide: boolean }) {
  const { account, accounts, switchAccount, removeAccount } = useSession();
  const [settings, update] = useSettings();
  const status = useAsync(async () => (account?.type === "xtream" ? xtreamLogin(account) : null), [account]);
  if (!account) return null;

  return (
    <div className={`screen stack-6${wide ? " settings-wide" : ""}`}>
      <h1 className="page-title">الإعدادات</h1>

      <section className="panel stack-3" aria-labelledby="acc-h">
        <h2 id="acc-h" className="panel-title">الاشتراك الحالي</h2>
        <div className="row">
          <span className="avatar">
            <Icon name="user" size={20} />
          </span>
          <div className="grow">
            <div className="strong truncate">{account.name}</div>
            <div className="muted small truncate ltr-mixed">{accountLine(account)}</div>
          </div>
        </div>
        {account.type === "xtream" &&
          (status.loading ? (
            <p className="muted small">جارٍ التحقق من الاشتراك لدى المزوّد…</p>
          ) : status.error ? (
            <p className="notice notice-warn">{status.error.message}</p>
          ) : status.data ? (
            <dl className="facts">
              <div><dt>الحالة</dt><dd>{status.data.status === "Active" ? "فعّال" : status.data.status}{status.data.isTrial ? " (تجريبي)" : ""}</dd></div>
              <div><dt>ينتهي</dt><dd>{status.data.expiresAt ? date(status.data.expiresAt) : "بلا انتهاء"}</dd></div>
              {status.data.maxConnections !== undefined && <div><dt>الأجهزة المتزامنة</dt><dd className="ltr">{status.data.activeConnections ?? 0} / {status.data.maxConnections}</dd></div>}
            </dl>
          ) : null)}
      </section>

      <section className="panel stack-3" aria-labelledby="accs-h">
        <h2 id="accs-h" className="panel-title">الحسابات على هذا الجهاز</h2>
        {accounts.map((a) => (
          <div key={a.id} className="row account-row">
            <div className="grow">
              <div className="truncate">{a.name}{a.id === account.id && <span className="badge badge-accent inline-badge">الحالي</span>}</div>
              <div className="muted small truncate">{accountLine(a)}</div>
            </div>
            {a.id !== account.id && (
              <button type="button" className="btn btn-secondary" onClick={() => { switchAccount(a.id); navigate("/", { replace: true }); }}>
                تبديل
              </button>
            )}
            <button type="button" className="icon-btn" aria-label={`حذف ${a.name}`} onClick={() => { if (window.confirm(`حذف «${a.name}» من هذا الجهاز؟`)) removeAccount(a.id); }}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <a className="btn btn-secondary" href={href("/login")}>
          <Icon name="plus" size={18} />
          <span>إضافة حساب</span>
        </a>
      </section>

      <section className="panel stack-3" aria-labelledby="pref-h">
        <h2 id="pref-h" className="panel-title">التشغيل</h2>
        <Choice label="صيغة البث المباشر" hint="HLS يعمل في كل الأجهزة؛ جرّب TS إن تقطّع البث على التلفاز." value={settings.liveFormat} options={[["m3u8", "HLS"], ["ts", "TS"]]} onChange={(v) => update({ liveFormat: v })} />
        <Choice label="تشغيل الحلقة التالية تلقائياً" value={settings.autoplayNext ? "on" : "off"} options={[["on", "نعم"], ["off", "لا"]]} onChange={(v) => update({ autoplayNext: v === "on" })} />
        <Choice label="واجهة التلفاز" hint="التلقائي يكتشف التلفاز؛ فرضها مفيد لجهاز يُتحكم به بالريموت." value={settings.tvMode} options={[["auto", "تلقائي"], ["on", "تشغيل"], ["off", "إيقاف"]]} onChange={(v) => update({ tvMode: v })} />
        <button type="button" className="btn btn-ghost" onClick={() => { if (window.confirm("مسح سجل المشاهدة لهذا الحساب؟")) clearHistory(account.id); }}>
          مسح سجل المشاهدة
        </button>
      </section>

      <section className="panel stack-2" aria-labelledby="about-h">
        <h2 id="about-h" className="panel-title">عن التطبيق</h2>
        <p className="muted small">Ssouq Net <span className="ltr">{__APP_VERSION__}</span> · {PLATFORM_LABEL[platformKind]}</p>
        <p className="muted small">Ssouq Net مشغّل وسائط فقط ولا يحتوي على أي قنوات أو محتوى. المحتوى يقدّمه مزوّدك، ويتصل التطبيق بخادمه مباشرة.</p>
      </section>
    </div>
  );
}

function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint?: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="choice">
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
      <div className="segmented segmented-sm" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
