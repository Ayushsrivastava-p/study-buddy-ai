import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotebookPen } from "lucide-react";

export const Route = createFileRoute("/notes")({
  component: () => (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Notes</h1>
      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><NotebookPen className="h-5 w-5 text-primary" /> Saved notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your AI-generated notes will appear here. Connect storage to keep them between sessions.
        </CardContent>
      </Card>
    </div>
  ),
});
