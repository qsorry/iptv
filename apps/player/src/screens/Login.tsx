import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { useSession } from "../state/session";
import { navigate, href, goBack, canGoBack, type Route } from "../nav/router";
import { focusFirst } from "../nav/focus";
import { xtreamLogin } from "../catalog/xtream";
import { M3uSource } from "../catalog/m3u";
import { normalizeServer, xtreamFromUrl } from "../lib/accounts";
import { ACTIVATION_PATTERN, activateCode, checkCode, detectProvider, formatActivationInput, pollPairing, startPairing, type Detected, type Pairing, type ServerAccount } from "../lib/platform-api";
import { toLatinDigits } from "../lib/text";
import { Icon, BrandMark } from "../components/Icon";

const DISCLAIMER = "Ssouq Net مشغّل وسائط فقط ولا يحتوي على أي قنوات أو محتوى. المحتوى يقدّمه مزوّدك.";

function message(e: unknown): string {
  return e instanceof Error ? e.message : "حدث خطأ غير متوقع.";
}

/** يسجّل الدخول بحساب من خادم المنصة (كود تفعيل أو ربط التلفاز) بعد التحقق منه لدى المزوّد. */
function useAccountLogin() {
  const { addAccount } = useSession();
  return async (acc: ServerAccount) => {
    await xtreamLogin({ server: acc.server.url, username: acc.username, password: acc.password });
    addAccount({ type: "xtream", name: acc.provider.name, server: acc.server.url, username: acc.username, password: acc.password, providerName: acc.provider.name, serverLabel: acc.server.label });
    navigate("/", { replace: true });
  };
}

export function Login({ route, tv, wide }: { route: Route; tv: boolean; wide: boolean }) {
  const { accounts } = useSession();
  const manual = route.parts[1] === "manual";

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tv) focusFirst();
    }, 60);
    return () => window.clearTimeout(t);
  }, [manual, tv]);

  const close = accounts.length > 0 || manual ? () => (canGoBack() ? goBack() : navigate(manual ? "/login" : "/", { replace: true })) : null;

  return (
    <div className={`login${wide ? " login-wide" : ""}`}>
      <div className="login-main stack-6">
        <div className="row">
          <BrandMark size={44} />
          <div className="display login-brand ltr grow">Ssouq Net</div>
          {close && (
            <button type="button" className="icon-btn icon-btn-bare" aria-label="رجوع" onClick={close}>
              <Icon name="back" size={24} />
            </button>
          )}
        </div>
        {manual ? <ManualForm /> : <CredentialsForm tv={tv} />}
        {!manual && (
          <div className="stack-3 login-foot">
            <a href={href("/login/manual")} className="center">إضافة قائمة يدوياً (M3U / Xtream)</a>
            <p className="disclaimer">{DISCLAIMER}</p>
          </div>
        )}
      </div>
      {wide && !manual && <PairPanel />}
    </div>
  );
}

type DetectState = { kind: "idle" } | { kind: "checking" } | { kind: "found"; value: Detected } | { kind: "unknown" } | { kind: "offline" };
type CodeState = { kind: "idle" } | { kind: "checking" } | { kind: "valid"; providerName: string } | { kind: "error"; message: string };

function CredentialsForm({ tv }: { tv: boolean }) {
  const [tab, setTab] = useState<"user" | "code">("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [detect, setDetect] = useState<DetectState>({ kind: "idle" });
  const [codeState, setCodeState] = useState<CodeState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addAccount } = useSession();
  const loginWith = useAccountLogin();

  // التعرّف على المزوّد أثناء الكتابة (بعد توقف قصير).
  useEffect(() => {
    const u = toLatinDigits(username).trim();
    if (u.length < 3) return setDetect({ kind: "idle" });
    setDetect({ kind: "checking" });
    let alive = true;
    const t = window.setTimeout(() => {
      detectProvider(u).then(
        (value) => alive && setDetect(value ? { kind: "found", value } : { kind: "unknown" }),
        () => alive && setDetect({ kind: "offline" }),
      );
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [username]);

  // تحقق بلا استخدام عند اكتمال الصيغة؛ الاستبدال الفعلي (ويُحسب دخولاً) عند «دخول» فقط.
  useEffect(() => {
    if (!ACTIVATION_PATTERN.test(code)) return setCodeState({ kind: "idle" });
    setCodeState({ kind: "checking" });
    let alive = true;
    checkCode(code).then(
      (r) => alive && setCodeState({ kind: "valid", providerName: r.provider.name }),
      (e) => alive && setCodeState({ kind: "error", message: message(e) }),
    );
    return () => {
      alive = false;
    };
  }, [code]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "code") {
        if (codeState.kind !== "valid") throw new Error("أدخل كود التفعيل كاملاً بصيغة SN-XXXX-XXXX.");
        await loginWith(await activateCode(code));
      } else {
        if (detect.kind !== "found") throw new Error(detect.kind === "offline" ? "تعذّر الوصول لخدمة التعرّف على المزوّد. أضف الخادم يدوياً." : "لم نتعرّف على مزوّد لاسم المستخدم هذا.");
        if (!password) throw new Error("أدخل كلمة المرور.");
        const u = toLatinDigits(username).trim();
        const server = detect.value.server.url;
        await xtreamLogin({ server, username: u, password });
        addAccount({ type: "xtream", name: detect.value.provider.name, server, username: u, password, providerName: detect.value.provider.name, serverLabel: detect.value.server.label });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && (tab === "code" ? codeState.kind === "valid" : detect.kind === "found" && password.length > 0);

  return (
    <form className="stack-6" onSubmit={submit} noValidate>
      <div className="stack-2">
        <h1 className="login-title">تسجيل الدخول</h1>
        <p className="login-lead">أدخل بيانات اشتراكك التي استلمتها من مزوّدك، أو كود التفعيل.</p>
      </div>

      <div className="segmented" role="group" aria-label="طريقة الدخول">
        <button type="button" aria-pressed={tab === "user"} onClick={() => setTab("user")} data-autofocus={tv || undefined}>
          اسم المستخدم
        </button>
        <button type="button" aria-pressed={tab === "code"} onClick={() => setTab("code")}>
          كود التفعيل
        </button>
      </div>

      {tab === "user" ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="sn-user">اسم المستخدم</label>
            <input id="sn-user" className="input input-ltr" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: 394…" />
          </div>
          <DetectNotice state={detect} />
          <div className="field">
            <label htmlFor="sn-pass">كلمة المرور</label>
            <input id="sn-pass" className="input input-ltr" dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="field">
            <label htmlFor="sn-code">كود التفعيل</label>
            <input id="sn-code" className="input input-code" dir="ltr" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(formatActivationInput(e.target.value))} placeholder="SN-XXXX-XXXX" />
          </div>
          <CodeNotice state={codeState} />
          {!tv && (
            <div className="row row-2 hint">
              <Icon name="qr" size={18} />
              <span>لتسجيل الدخول على التلفاز: امسح رمز QR الظاهر عليه بكاميرا جوالك.</span>
            </div>
          )}
        </div>
      )}

      {error && <Notice kind="error" title={error} />}

      <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
        {busy ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}

function Notice({ kind, title, detail }: { kind: "ok" | "warn" | "error"; title: string; detail?: string }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "ok" ? "status" : "alert"}>
      <Icon name={kind === "ok" ? "check" : "alert"} size={20} strokeWidth={2.4} />
      <div>
        {kind === "ok" ? <strong>{title}</strong> : <span>{title}</span>}
        {detail && <div>{detail}</div>}
      </div>
    </div>
  );
}

function DetectNotice({ state }: { state: DetectState }) {
  switch (state.kind) {
    case "found":
      return <Notice kind="ok" title="تم التعرّف على المزوّد تلقائياً" detail={`${state.value.provider.name} · ${state.value.server.label}`} />;
    case "unknown":
      return <Notice kind="warn" title="لم نتعرّف على مزوّد لهذا الاسم. جرّب كود التفعيل، أو أضف الخادم يدوياً." />;
    case "offline":
      return <Notice kind="warn" title="تعذّر الوصول لخدمة التعرّف على المزوّد. تحقق من الإنترنت أو أضف الخادم يدوياً." />;
    case "checking":
      return <p className="hint">جارٍ التعرّف على المزوّد…</p>;
    default:
      return <p className="hint">سيتعرّف التطبيق على مزوّدك من أول أرقام اسم المستخدم.</p>;
  }
}

function CodeNotice({ state }: { state: CodeState }) {
  switch (state.kind) {
    case "valid":
      return <Notice kind="ok" title="الكود صالح" detail={`مرتبط بـ ${state.providerName} · لا حاجة لكلمة مرور`} />;
    case "error":
      return <Notice kind="warn" title={state.message} />;
    case "checking":
      return <p className="hint">جارٍ التحقق من الكود…</p>;
    default:
      return <p className="hint">الكود من مزوّدك بصيغة SN-XXXX-XXXX.</p>;
  }
}

function ManualForm() {
  const [tab, setTab] = useState<"xtream" | "m3u">("xtream");
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addAccount } = useSession();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "xtream") {
        const origin = normalizeServer(server);
        if (!origin) throw new Error("رابط الخادم غير صالح. مثال: http://host:8080");
        if (!username || !password) throw new Error("أدخل اسم المستخدم وكلمة المرور.");
        await xtreamLogin({ server: origin, username: username.trim(), password });
        addAccount({ type: "xtream", name: new URL(origin).hostname, server: origin, username: username.trim(), password });
      } else {
        const link = url.trim();
        if (!/^https?:\/\//i.test(link)) throw new Error("أدخل رابط القائمة كاملاً يبدأ بـ http:// أو https://");
        const xt = xtreamFromUrl(link);
        if (xt) {
          // رابط get.php هو حساب Xtream: نستخدم الـ API (أسرع ويحوي الدليل والتفاصيل).
          await xtreamLogin(xt);
          addAccount({ type: "xtream", name: new URL(xt.server).hostname, ...xt });
        } else {
          const src = new M3uSource(link);
          const catalog = await src.load();
          if (catalog.live.length + catalog.movies.length + catalog.series.length === 0) throw new Error("القائمة فارغة.");
          addAccount({ type: "m3u", name: new URL(link).hostname, url: link });
        }
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-6" onSubmit={submit} noValidate>
      <div className="stack-2">
        <h1 className="login-title">إضافة قائمة يدوياً</h1>
        <p className="login-lead">لقوائم لم يتعرّف عليها التطبيق تلقائياً. البيانات تُحفظ على هذا الجهاز فقط.</p>
      </div>
      <div className="segmented" role="group" aria-label="نوع القائمة">
        <button type="button" aria-pressed={tab === "xtream"} onClick={() => setTab("xtream")} data-autofocus>
          Xtream Codes
        </button>
        <button type="button" aria-pressed={tab === "m3u"} onClick={() => setTab("m3u")}>
          رابط M3U
        </button>
      </div>
      {tab === "xtream" ? (
        <div className="stack">
          <div className="field">
            <label htmlFor="mx-server">رابط الخادم</label>
            <input id="mx-server" className="input input-ltr" dir="ltr" inputMode="url" autoCapitalize="none" spellCheck={false} value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://host:8080" />
          </div>
          <div className="field">
            <label htmlFor="mx-user">اسم المستخدم</label>
            <input id="mx-user" className="input input-ltr" dir="ltr" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="mx-pass">كلمة المرور</label>
            <input id="mx-pass" className="input input-ltr" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="mx-url">رابط القائمة</label>
          <input id="mx-url" className="input input-ltr" dir="ltr" inputMode="url" autoCapitalize="none" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://…/playlist.m3u" />
        </div>
      )}
      {error && <Notice kind="error" title={error} />}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "جارٍ التحقق…" : "إضافة"}
      </button>
      <p className="disclaimer">{DISCLAIMER}</p>
    </form>
  );
}

/** لوحة التلفاز: QR ورمز ربط؛ الجوال يرسل الحساب والتلفاز يستطلع كل 3 ثوانٍ. */
function PairPanel() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "signing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loginWith = useAccountLogin();
  const loginRef = useRef(loginWith);
  loginRef.current = loginWith;

  useEffect(() => {
    let alive = true;
    let timer = 0;
    setStatus("loading");
    setError(null);
    startPairing()
      .then(async (p) => {
        if (!alive) return;
        setPairing(p);
        const css = getComputedStyle(document.documentElement);
        setQr(await QRCode.toDataURL(p.pairUrl, { margin: 1, width: 360, color: { dark: css.getPropertyValue("--bg").trim() || "#000", light: css.getPropertyValue("--ink").trim() || "#fff" } }));
        setStatus("waiting");
        const poll = async () => {
          if (!alive) return;
          try {
            const res = await pollPairing(p);
            if (!alive) return;
            if (res.status === "completed") {
              setStatus("signing");
              try {
                await loginRef.current(res.account);
              } catch (e) {
                setError(message(e));
                setStatus("error");
              }
              return;
            }
            if (res.status === "expired" || res.status === "consumed") return setNonce((n) => n + 1);
          } catch {
            // انقطاع مؤقت: نكمل الاستطلاع.
          }
          timer = window.setTimeout(poll, 3000);
        };
        timer = window.setTimeout(poll, 3000);
      })
      .catch((e) => {
        if (!alive) return;
        setError(message(e));
        setStatus("error");
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [nonce]);

  const host = pairing ? pairing.pairUrl.replace(/^https?:\/\//, "").split("?")[0] : "";
  return (
    <aside className="pair-panel stack-5" aria-labelledby="pair-title">
      <div className="stack-2">
        <h2 id="pair-title">سجّل الدخول من جوالك</h2>
        <p className="muted">امسح الرمز بكاميرا الجوال، ثم أرسل كود التفعيل أو بيانات اشتراكك. يفتح التلفاز حسابك تلقائياً.</p>
      </div>
      <div className="pair-qr center">
        {status === "loading" && <div className="spinner" />}
        {qr && status !== "loading" && <img src={qr} alt="رمز QR لربط التلفاز" />}
      </div>
      {pairing && status !== "error" && (
        <div className="stack-1 center-text">
          <div className="muted">أو افتح <span className="ltr">{host}</span> وأدخل الرمز</div>
          <div className="pair-code ltr">{pairing.code}</div>
        </div>
      )}
      {status === "signing" && <p className="hint center-text">وصل الحساب، جارٍ الدخول…</p>}
      {status === "error" && (
        <div className="stack-3">
          <Notice kind="warn" title={error ?? "تعذّر إنشاء رمز الربط."} />
          <button type="button" className="btn btn-secondary" onClick={() => setNonce((n) => n + 1)}>
            <Icon name="refresh" size={18} />
            <span>رمز جديد</span>
          </button>
        </div>
      )}
    </aside>
  );
}
