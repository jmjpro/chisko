import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router";
import "./i18n";
import "./index.css";
import App from "./app.tsx";
import { getConvexUrl } from "./lib/getConvexUrl";

const convex = new ConvexReactClient(
  getConvexUrl(import.meta.env.VITE_CONVEX_URL),
);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </Suspense>
  </StrictMode>,
);
