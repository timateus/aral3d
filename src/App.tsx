import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VoxelPage from "./pages/Voxel";
import SharePage from "./pages/Share";
import LocationPage from "./pages/LocationPage";
import DataSources from "./pages/DataSources";
import { LOCATIONS } from "./lib/locations";



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/voxel" element={<VoxelPage />} />
          <Route path="/share/:id" element={<SharePage />} />
          {LOCATIONS.map((l) => (
            <Route key={l.slug} path={`/${l.slug}`} element={<LocationPage />} />
          ))}
          

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
