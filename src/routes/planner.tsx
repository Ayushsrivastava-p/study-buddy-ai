import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/planner")({
  component: () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Study Planner</h1>
      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Your schedule</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Plan your study sessions and track progress here.
        </CardContent>
      </Card>
    </div>
  ),
});
