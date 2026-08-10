import ReactDOM from "react-dom/client";
import { installAiContextRuntime } from "./lib/aiContext";
import "./styles.css";

declare global {
  interface Window {
    __CARBONET_REACT_APP_MOUNTED__?: boolean;
    __CARBONET_REACT_APP_MOUNTING__?: boolean;
  }
}

const rootElement = document.getElementById("root");

installAiContextRuntime({ application: "CCUS 탄소중립 플랫폼" });

async function resolveEntryComponent() {
  const pathname = window.location.pathname.toLowerCase();
  if (pathname === "/join/companyreapply" || pathname === "/join/en/companyreapply") {
    const module = await import("./features/join-company-reapply/JoinCompanyReapplyEntry");
    return module.JoinCompanyReapplyEntry;
  }
  return (await import("./App")).default;
}

if (rootElement && !window.__CARBONET_REACT_APP_MOUNTED__ && !window.__CARBONET_REACT_APP_MOUNTING__) {
  window.__CARBONET_REACT_APP_MOUNTING__ = true;
  void resolveEntryComponent()
    .then((EntryComponent) => {
      window.__CARBONET_REACT_APP_MOUNTED__ = true;
      window.__CARBONET_REACT_APP_MOUNTING__ = false;
      ReactDOM.createRoot(rootElement).render(<EntryComponent />);
    })
    .catch(() => {
      window.__CARBONET_REACT_APP_MOUNTING__ = false;
      rootElement.innerHTML = '<main role="alert" class="p-6">React app did not mount. Please retry.</main>';
    });
}
