import { useEffect, useState } from "react";
import { useSession } from "./state/session";
import { useLayout } from "./state/hooks";
import { canGoBack, goBack, navigate, useRoute, type Route } from "./nav/router";
import { focusFirst } from "./nav/focus";
import { installRemote, useRemote } from "./nav/remote";
import { canExit, exitApp } from "./platform";
import { Shell, type Tab } from "./components/Shell";
import { Icon } from "./components/Icon";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { Live } from "./screens/Live";
import { Movies } from "./screens/Movies";
import { SeriesHome } from "./screens/SeriesHome";
import { Browse } from "./screens/Browse";
import { MovieDetails } from "./screens/MovieDetails";
import { SeriesDetails } from "./screens/SeriesDetails";
import { Search } from "./screens/Search";
import { Settings } from "./screens/Settings";
import { Guide } from "./screens/Guide";
import { PlayerScreen } from "./player/PlayerScreen";

function tabFor(route: Route): Tab | null {
  const [first, second] = route.parts;
  if (!first) return "home";
  if (first === "live" || first === "guide") return "live";
  if (first === "movies") return "movies";
  if (first === "series") return "series";
  if (first === "browse") return second === "series" ? "series" : "movies";
  if (first === "search") return "search";
  if (first === "settings") return "settings";
  return null;
}

export function App() {
  const { account } = useSession();
  const route = useRoute();
  const { tv, wide } = useLayout();
  const [confirmExit, setConfirmExit] = useState(false);

  // زر الرجوع غير المستهلك: رجوع في السجل، أو من الرئيسية على التلفاز: تأكيد الخروج.
  useEffect(
    () =>
      installRemote(() => {
        if (canGoBack()) return goBack();
        if (route.path !== "/" && account) return navigate("/", { replace: true });
        if (canExit) setConfirmExit(true);
      }),
    [route.path, account],
  );

  // كل شاشة جديدة تبدأ بالتركيز على أول عنصر (للريموت) وتعود لأعلى الصفحة.
  useEffect(() => {
    window.scrollTo(0, 0);
    // scrollTop لا Element.scrollTo: الأخيرة غير موجودة قبل Chromium 61 (تلفزيونات 2018–2019) فتُسقط التطبيق.
    const main = document.querySelector(".shell-main");
    if (main) main.scrollTop = 0;
    if (!tv) return;
    const t = window.setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) focusFirst();
    }, 60);
    return () => window.clearTimeout(t);
  }, [route.path, tv, account?.id]);

  if (!account || route.parts[0] === "login") {
    return (
      <>
        <Login route={route} tv={tv} wide={wide} />
        {confirmExit && <ExitDialog onClose={() => setConfirmExit(false)} />}
      </>
    );
  }

  const [first, second, third] = route.parts;
  if (first === "play") return <PlayerScreen kind={second} id={third} extra={route.parts[3]} query={route.query} tv={tv} />;

  let screen;
  switch (first) {
    case undefined:
      screen = <Home wide={wide} />;
      break;
    case "live":
      screen = <Live wide={wide} tv={tv} categoryId={route.query.get("cat")} />;
      break;
    case "guide":
      screen = <Guide wide={wide} categoryId={route.query.get("cat")} />;
      break;
    case "movies":
      screen = second ? <MovieDetails id={second} wide={wide} /> : wide ? <Browse kind="movie" wide categoryId={route.query.get("cat")} /> : <Movies />;
      break;
    case "series":
      screen = second ? <SeriesDetails id={second} wide={wide} season={route.query.get("season")} /> : wide ? <Browse kind="series" wide categoryId={route.query.get("cat")} /> : <SeriesHome />;
      break;
    case "browse":
      screen = <Browse kind={second === "series" ? "series" : "movie"} wide={wide} categoryId={route.query.get("cat")} />;
      break;
    case "search":
      screen = <Search wide={wide} initial={route.query.get("q") ?? ""} />;
      break;
    case "settings":
      screen = <Settings wide={wide} />;
      break;
    default:
      screen = <Home wide={wide} />;
  }

  // المكتبة (تصنيفات + شبكة) تملأ الشاشة العريضة بلا القائمة الجانبية، كما في التصميم.
  const bare = wide && (first === "movies" || first === "series" || first === "browse") && (first === "browse" || !second);
  return (
    <>
      {bare ? (
        <main className="shell-bare" data-nav-region="main">
          {screen}
        </main>
      ) : (
        <Shell wide={wide} active={tabFor(route)}>
          {screen}
        </Shell>
      )}
      {confirmExit && <ExitDialog onClose={() => setConfirmExit(false)} />}
    </>
  );
}

function ExitDialog({ onClose }: { onClose: () => void }) {
  // زر الرجوع يغلق السؤال (لا يعيد فتحه).
  useRemote((action) => {
    if (action !== "back") return false;
    onClose();
    return true;
  });
  useEffect(() => {
    const t = window.setTimeout(() => focusFirst(), 30);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="dialog-backdrop" data-nav-scope>
      <div className="dialog stack-5" role="dialog" aria-modal="true" aria-labelledby="exit-title">
        <h2 id="exit-title">الخروج من Ssouq Net؟</h2>
        <div className="row row-2">
          <button type="button" className="btn btn-primary grow" onClick={exitApp}>
            <Icon name="exit" size={18} />
            <span>خروج</span>
          </button>
          <button type="button" className="btn btn-secondary grow" onClick={onClose} data-autofocus>
            بقاء
          </button>
        </div>
      </div>
    </div>
  );
}
