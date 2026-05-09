import { createFileRoute } from "@tanstack/react-router";
import { StudyChat } from "@/components/study-chat";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-2">
        <h1 className="bg-gradient-primary bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
          Hey, ready to learn?
        </h1>
        <p className="text-muted-foreground">
          Ask anything — get an explanation, short notes, and a quick quiz instantly.
        </p>
      </div>
      <StudyChat />
    </div>
  );
}
