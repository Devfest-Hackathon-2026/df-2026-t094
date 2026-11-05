import { Suspense } from "react";
import Play from "@/components/Play";

export default function Page() {
  return (
    <Suspense>
      <Play />
    </Suspense>
  );
}
