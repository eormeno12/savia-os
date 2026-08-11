import { Suspense } from "react";
import { Box } from "@chakra-ui/react";
import { SearchResults } from "@/components/memory/search-results";

/** M5 — search results. Suspense boundary required for `useSearchParams`. */
export default function ResultadosPage() {
  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0" h="full">
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </Box>
  );
}
