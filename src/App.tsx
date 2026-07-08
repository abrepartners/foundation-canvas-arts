import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Trends from "./pages/Trends";
import Queue from "./pages/Queue";
import Animated from "./pages/Animated";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import { Terms, Privacy } from "./pages/Legal";
import { RequireAuth } from "@/lib/auth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
          <Route path="/trends" element={<RequireAuth><Trends /></RequireAuth>} />
          <Route path="/animated" element={<RequireAuth><Animated /></RequireAuth>} />
          <Route path="/queue" element={<RequireAuth><Queue /></RequireAuth>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
