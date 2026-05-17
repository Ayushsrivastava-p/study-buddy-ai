import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  Sparkles, FileText, HelpCircle, Send, Loader2,
  Trash2, Bot, User, BookOpen, CheckCircle2, List,
} from "lucide-react";
import { getSessionId } from "@/lib/session";
import { PdfUpload, type UploadedPdf } from "@/components/pdf-upload";

const API_URL = "https://shawl-tasting-rice.ngrok-free.dev/webhook/study-buddy";
const STORAGE_KEY = "study-buddy-chat";

type Role = "user" | "assistant";

type QuizItem = {
  question: string;
  options: string[];
  answer: string;
};

type Message = {
  id: string;
  role: Role;
  content?: string; // backward compatibility
  response?: string;
  type?: "quiz" | "explanation" | "summary" | "normal";
  quiz?: QuizItem[];
  short_notes?: string[];
  createdAt: number;
};

function pickAnswer(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return pickAnswer(data[0]);
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // New API format: response field
    if (typeof d.response === "string" && d.response.trim()) return d.response;
    return (
      (d.answer as string) ||
      (d.explanation as string) ||
      (d.text as string) ||
      (d.output as string) ||
      pickAnswer(d.data) ||
      pickAnswer(d.json) ||
      pickAnswer(d.result) ||
      JSON.stringify(d, null, 2)
    );
  }
  return "";
}

function parseApiResponse(data: unknown): Partial<Omit<Message, "id" | "role" | "createdAt">> {
  if (!data || typeof data !== "object") return { response: String(data) };
  const d = data as Record<string, unknown>;

  const response = typeof d.response === "string" ? d.response : pickAnswer(data);
  const type = ["quiz", "explanation", "summary", "normal"].includes(d.type as string)
    ? (d.type as Message["type"])
    : "normal";

  let quiz: QuizItem[] | undefined;
  if (Array.isArray(d.quiz)) {
    quiz = d.quiz.map((q: unknown) => {
      if (!q || typeof q !== "object") return { question: "", options: [], answer: "" };
      const item = q as Record<string, unknown>;
      return {
        question: String(item.question ?? ""),
        options: Array.isArray(item.options) ? item.options.map(String) : [],
        answer: String(item.answer ?? ""),
      };
    }).filter((q) => q.question);
  }

  let short_notes: string[] | undefined;
  if (Array.isArray(d.short_notes)) {
    short_notes = d.short_notes.map(String).filter(Boolean);
  }

  return { response, type, quiz, short_notes };
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function StudyChat() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdf | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getSessionId(); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as Message[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (prompt?: string) => {
    const text = (prompt ?? question).trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, userMsg]);
    setQuestion("");

    try {
      const selectedFile = uploadedPdf?.file;
      const sessionId = getSessionId();
      console.log("Sending chat with file:", selectedFile?.name ?? "(no file)");

      let pdfBase64: string | null = null;
      let fileName: string | null = null;

      if (selectedFile) {
        fileName = selectedFile.name;
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error ?? new Error("Failed to read PDF"));
          reader.readAsDataURL(selectedFile);
        });
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          sessionId,
          fileName,
          pdfBase64,
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const raw = await res.text();
      let data: unknown = raw;
      try { data = JSON.parse(raw); } catch { /* keep string */ }

      const parsed = parseApiResponse(data);

      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: "assistant",
        response: parsed.response,
        type: parsed.type,
        quiz: parsed.quiz,
        short_notes: parsed.short_notes,
        createdAt: Date.now(),
      }]);
    } catch (e) {
      console.error("Study Buddy webhook error:", e);
      setError("Failed to connect to AI assistant");
    } finally {
      setLoading(false);
    }
  };

  const hasPdf = !!uploadedPdf?.file;
  const canSend = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Left: PDF panel */}
      <div className="space-y-4">
        <PdfUpload onUploaded={setUploadedPdf} />
      </div>

      {/* Right: Chat */}
      <Card className="flex h-[calc(100vh-12rem)] min-h-[560px] flex-col overflow-hidden border-0 bg-gradient-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">AI Study Buddy</p>
              <p className="text-xs text-muted-foreground">
                {hasPdf ? `Asking about: ${uploadedPdf!.name}` : "Upload a PDF to ground answers"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-4 py-6 md:px-6">
            {messages.length === 0 && !loading && (
              <EmptyState hasPdf={hasPdf} onPick={(p) => send(p)} />
            )}
            {messages.map((m) => <Bubble key={m.id} message={m} />)}
            {loading && <TypingBubble />}
            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 border-t border-border/40 px-4 py-3 md:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !hasPdf}
            onClick={() => send("Summarize this PDF in clear bullet points covering the key concepts and main takeaways.")}
            className="rounded-full"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Summarize PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !hasPdf}
            onClick={() => send("Generate a 5-question quiz from this PDF with answers. Mix multiple choice and short answer.")}
            className="rounded-full"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Generate Quiz
          </Button>
          {!hasPdf && (
            <span className="ml-1 self-center text-xs text-muted-foreground">
              Upload a PDF to enable these
            </span>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border/40 bg-background/40 p-3 md:p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={hasPdf ? "Ask anything about your PDF…" : "Ask anything to start learning…"}
              className="min-h-[52px] flex-1 resize-none rounded-2xl border-border/50 bg-background/80"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              onClick={() => send()}
              disabled={!canSend}
              className="h-12 rounded-full bg-gradient-primary px-5 shadow-glow hover:opacity-90"
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Enter to send · Shift + Enter for newline
          </p>
        </div>
      </Card>
    </div>
  );
}

function EmptyState({ hasPdf, onPick }: { hasPdf: boolean; onPick: (p: string) => void }) {
  const samples = hasPdf
    ? [
        "Explain the main concepts in this PDF.",
        "What are the most important formulas or definitions?",
        "Quiz me on chapter 1.",
      ]
    : [
        "Explain photosynthesis like I'm 12.",
        "Give me 5 quick facts about the French Revolution.",
        "What's the difference between mitosis and meiosis?",
      ];
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
        <Sparkles className="h-6 w-6 text-primary-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">How can I help you study?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasPdf ? "Ask about your uploaded PDF or try a suggestion." : "Upload a PDF or try a quick prompt."}
        </p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-border/50 bg-background/60 p-3 text-left text-sm transition-all hover:border-primary/50 hover:bg-background"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const displayText = message.response || message.content || "";

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="max-w-[80%] items-end flex flex-col gap-1">
          <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-gradient-primary px-4 py-3 text-sm leading-relaxed shadow-soft text-primary-foreground">
            {displayText}
          </div>
          <span className="px-1 text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 flex-row">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] items-start flex flex-col gap-3">
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-background/80 px-4 py-3 text-sm leading-relaxed shadow-soft text-foreground">
          {displayText}
        </div>

        {message.quiz && message.quiz.length > 0 && (
          <div className="w-full space-y-3">
            {message.quiz.map((q, idx) => (
              <QuizCard key={idx} index={idx} quiz={q} />
            ))}
          </div>
        )}

        {message.short_notes && message.short_notes.length > 0 && (
          <ShortNotes notes={message.short_notes} />
        )}

        <span className="px-1 text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}

function QuizCard({ index, quiz }: { index: number; quiz: QuizItem }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-4 shadow-soft">
      <p className="mb-3 text-sm font-semibold text-foreground">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {index + 1}
        </span>
        {quiz.question}
      </p>
      <div className="grid gap-2">
        {quiz.options.map((opt, i) => {
          const isCorrect = opt === quiz.answer;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                isCorrect
                  ? "border border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border border-border/40 bg-background/40 text-foreground"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
              )}
              <span>{opt}</span>
            </div>
          );
        })}
      </div>
      {!quiz.options.some((o) => o === quiz.answer) && quiz.answer && (
        <p className="mt-2 text-xs text-primary">
          <CheckCircle2 className="mr-1 inline h-3 w-3" />
          Correct answer: {quiz.answer}
        </p>
      )}
    </div>
  );
}

function ShortNotes({ notes }: { notes: string[] }) {
  return (
    <div className="w-full rounded-2xl border border-border/50 bg-background/60 p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <List className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Short Notes</h4>
      </div>
      <ul className="space-y-1.5">
        {notes.map((note, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-background/80 px-4 py-3 shadow-soft">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Keeping a no-op export footprint compatible with prior imports (none external).
export type { Message };
// Reference to silence unused-import warnings for icons reserved for future use.
void FileText;
void CardContent;
