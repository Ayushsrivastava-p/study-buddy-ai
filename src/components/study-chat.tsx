import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, BookOpen, FileText, HelpCircle, Send, Loader2,
  History, Trash2, MessageSquare,
} from "lucide-react";
import { getSessionId } from "@/lib/session";

const API_URL = "https://shawl-tasting-rice.ngrok-free.dev/webhook/study-buddy";
const STORAGE_KEY = "study-buddy-history";

type AIResult = {
  explanation?: string;
  notes?: string[] | string;
  quiz?: { question: string; answer?: string; options?: string[] }[] | string;
  raw?: string;
};

type HistoryEntry = {
  id: string;
  question: string;
  result: AIResult;
  createdAt: number;
};

function parseResult(data: unknown): AIResult {
  if (typeof data === "string") return { raw: data };
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return {
      explanation: (d.response as string) || (d.explanation as string) || (d.answer as string),
      notes: (d.short_notes as AIResult["notes"]) ?? (d.notes as AIResult["notes"]),
      quiz: d.quiz as AIResult["quiz"],
      raw: !d.response && !d.explanation && !d.notes && !d.short_notes && !d.quiz ? JSON.stringify(d, null, 2) : undefined,
    };
  }
  return {};
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StudyChat() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { getSessionId(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryEntry[];
        setHistory(parsed);
        setActiveId(parsed[0]?.id ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
  }, [history]);

  const askAI = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    const userQuestion = question.trim();
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        // Send question + persistent sessionId so n8n Memory Plus can
        // associate this request with prior conversation history.
        body: JSON.stringify({
          question: userQuestion,
          sessionId: getSessionId(),
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const text = await res.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch { /* keep as string */ }
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        question: userQuestion,
        result: parseResult(data),
        createdAt: Date.now(),
      };
      setHistory((h) => [entry, ...h]);
      setActiveId(entry.id);
      setQuestion("");
    } catch (e) {
      console.error("Study Buddy webhook error:", e);
      setError("Failed to connect to AI assistant");
    } finally {
      setLoading(false);
    }
  };

  const active = history.find((h) => h.id === activeId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6 min-w-0">
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
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) askAI(); }}
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

        {active && !loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm">
              <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              <span className="font-medium">{active.question}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatTime(active.createdAt)}</span>
            </div>
            <ResultCards result={active.result} />
          </div>
        )}

        {!active && !loading && !error && (
          <Card className="border-dashed bg-transparent">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 text-primary/60" />
              <p className="text-sm">Ask your first question to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <HistoryPanel
        history={history}
        activeId={activeId}
        onSelect={setActiveId}
        onClear={() => { setHistory([]); setActiveId(null); }}
      />
    </div>
  );
}

function HistoryPanel({
  history, activeId, onSelect, onClear,
}: {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <Card className="border-0 bg-gradient-card shadow-soft lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" /> History
        </CardTitle>
        {history.length > 0 && (
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear history" className="h-8 w-8">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px] lg:h-[calc(100vh-11rem)]">
          <div className="space-y-2 px-4 pb-4">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No past questions yet.
              </p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onSelect(h.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all hover:border-primary/50 hover:bg-background/70 ${
                    activeId === h.id
                      ? "border-primary/60 bg-background shadow-soft"
                      : "border-border/40 bg-background/40"
                  }`}
                >
                  <p className="line-clamp-2 text-sm font-medium">{h.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTime(h.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
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
        <CardContent className="text-[15px] leading-7">
          {Array.isArray(result.notes) ? (
            <ul className="list-disc space-y-2 rounded-xl bg-background/60 p-4 pl-6">
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          ) : result.notes ? (
            <p
              id="shortNotes"
              className="rounded-xl bg-background/60 p-4 [white-space:pre-line]"
            >
              {result.notes}
            </p>
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
