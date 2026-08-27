"use client";

import { useEffect, useRef, useState } from "react";
import {
  askDataAgentAction,
} from "@/lib/dataAgentActions";
import type { DataAgentTable } from "@/lib/dataAgentParse";
import { Button, Input } from "@/components/ui";

type ChatMessage = {
  role: "user" | "agent" | "error";
  text: string;
  table?: DataAgentTable | null;
};

function formatCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function AnswerTable({ table }: { table: DataAgentTable }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border-subtle">
      <table className="min-w-full border-collapse text-left text-sm text-text-primary">
        <thead className="bg-bg-muted">
          <tr>
            {table.headers.map((header, headerIndex) => (
              <th
                key={headerIndex}
                className="border-b border-border-subtle px-3 py-1.5 font-medium"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-border-subtle px-3 py-1.5 align-top"
                >
                  {formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const canSubmit = !loading && question.trim().length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;

    const history = messages
      .filter(
        (message): message is ChatMessage & { role: "user" | "agent" } =>
          (message.role === "user" || message.role === "agent") &&
          Boolean(message.text.trim())
      )
      .map((message) => ({ role: message.role, text: message.text }));

    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const answer = await askDataAgentAction(text, history);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: answer.text, table: answer.table },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          text: e instanceof Error ? e.message : "Could not get an answer",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.length === 0 && !loading ? (
          <p className="text-sm text-text-primary/70">
            Ask a question about projects, customers, or allocations — e.g.
            &quot;How much is allocated on Lexit in September?&quot;
          </p>
        ) : (
          <ul className="space-y-4">
            {messages.map((message, index) => (
              <li key={index}>
                <p
                  className={`text-xs font-medium ${
                    message.role === "error"
                      ? "text-danger"
                      : "text-text-primary/60"
                  }`}
                >
                  {message.role === "user"
                    ? "You"
                    : message.role === "error"
                      ? "Error"
                      : "Agent"}
                </p>
                {message.text ? (
                  <p
                    className={`mt-1 whitespace-pre-wrap text-sm ${
                      message.role === "error"
                        ? "text-danger"
                        : "text-text-primary"
                    }`}
                  >
                    {message.text}
                  </p>
                ) : null}
                {message.table && message.table.rows.length > 0 ? (
                  <AnswerTable table={message.table} />
                ) : null}
              </li>
            ))}
            {loading ? (
              <li className="text-sm text-text-primary/70">Thinking…</li>
            ) : null}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            ref={inputRef}
            id="data-agent-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question"
            disabled={loading}
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={!canSubmit} className="mt-0 shrink-0">
          {loading ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
