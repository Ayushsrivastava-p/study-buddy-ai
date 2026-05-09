import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, BookOpen, FileText, HelpCircle, Send, Loader2 } from "lucide-react";

const API_URL = "http://localhost:5678/webhook/study-buddy";

type AIResult = {
  explanation?: string;
  notes?: string[] | string;
  quiz?: { question: string; answer?: string; options?: string[] }[] | string;
  raw?: string;
};

function parseResult(data: unknown): AIResult {
  if (typeof data === "string") return { raw: data };
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return {
      explanation: (d.explanation as string) || (d.answer as string) || (d.response as string),
      notes: d.notes as AIResult["notes"],
      quiz: d.quiz as AIResult["quiz"],
      raw: !d.explanation && !d.notes && !d.quiz ? JSON.stringify(d, null, 2) : undefined,
    };
  }
  return {};
}

export function StudyChat() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const askAI = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const text = await res.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch { /* keep as string */ }
      setResult(parseResult(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask your AI Study Buddy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Explain photosynthesis with a quick quiz…"
            className="min-h-[110px] resize-none rounded-2xl border-border/50 bg-background/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askAI();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tip: ⌘/Ctrl + Enter to send</span>
            <Button
              onClick={askAI}
              disabled={loading || !question.trim()}
              className="rounded-full bg-gradient-primary px-6 shadow-glow hover:opacity-90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Ask AI
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <LoadingCards />}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}. Make sure your endpoint at <code className="font-mono">{API_URL}</code> is running.
          </CardContent>
        </Card>
      )}

      {result && !loading && <ResultCards result={result} />}
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="overflow-hidden border-0 bg-gradient-card shadow-soft">
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-3 w-3 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Thinking…</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ResultCards({ result }: { result: AIResult }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Explanation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-foreground/90">
          {result.explanation || result.raw || <em className="text-muted-foreground">No explanation returned.</em>}
        </CardContent>
      </Card>

      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Short Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {Array.isArray(result.notes) ? (
            <ul className="list-disc space-y-1 pl-4">
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          ) : result.notes ? (
            <p className="whitespace-pre-wrap">{result.notes}</p>
          ) : (
            <em className="text-muted-foreground">No notes returned.</em>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-gradient-card shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-primary" /> Quiz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {Array.isArray(result.quiz) ? (
            result.quiz.map((q, i) => (
              <div key={i} className="rounded-xl bg-background/50 p-3">
                <p className="font-medium">Q{i + 1}. {q.question}</p>
                {q.options && (
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {q.options.map((o, j) => <li key={j}>• {o}</li>)}
                  </ul>
                )}
                {q.answer && <p className="mt-1 text-xs text-primary">Answer: {q.answer}</p>}
              </div>
            ))
          ) : result.quiz ? (
            <p className="whitespace-pre-wrap">{result.quiz}</p>
          ) : (
            <em className="text-muted-foreground">No quiz returned.</em>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
