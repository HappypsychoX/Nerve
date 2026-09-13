import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader title="Page not found" />
        <div className="px-4 py-4">
          <Link
            href="/"
            className="text-sm text-accent hover:text-accent-strong"
          >
            Back to Overview
          </Link>
        </div>
      </Card>
    </div>
  );
}
