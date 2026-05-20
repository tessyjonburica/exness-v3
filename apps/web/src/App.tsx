import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppToaster } from "./components/AppToaster.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";

const LandingPage = lazy(() => import("./pages/LandingPage.js"));
const TradingPage = lazy(() => import("./pages/TradingPage.js"));
const DocsPage = lazy(() => import("./pages/DocsPage.js"));
const AuthPage = lazy(() => import("./pages/AuthPage.js"));
const NotFound = lazy(() => import("./pages/NotFound.js"));
const WalletPage = lazy(() => import("./pages/WalletPage.js"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AppToaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Suspense fallback={<div className="min-h-screen bg-white dark:bg-gray-900" />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/trade" element={<TradingPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/signin" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
