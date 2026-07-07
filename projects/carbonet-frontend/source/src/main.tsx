import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

declare global {
  interface Window {
    __CARBONET_REACT_APP_MOUNTED__?: boolean;
  }
}

const rootElement = document.getElementById("root");

if (rootElement && !window.__CARBONET_REACT_APP_MOUNTED__) {
  window.__CARBONET_REACT_APP_MOUNTED__ = true;
  ReactDOM.createRoot(rootElement).render(
    <App />
  );
}
