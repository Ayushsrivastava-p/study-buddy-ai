import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/quiz")({
  component: () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Quiz</h1>
      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Practice quizzes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Generate quizzes from the Home page — they will be collected here.
        </CardContent>
      </Card>
    </div>
  ),
});
