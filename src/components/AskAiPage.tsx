import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Loader2, MessageSquare, SendHorizonal, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  tool_calls?: Array<{ tool?: string; args?: Record<string, unknown> }>;
  created_at: string;
}

interface ChartMetadata {
  type: 'bar';
  title?: string;
  labels: string[];
  values: number[];
}

type TableConfig = {
  title: string;
  columns: string[];
  rows: Array<Array<string>>;
};

export function AskAiPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const wasNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messageListRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const nextSessions = (data || []) as ChatSession[];
      setSessions(nextSessions);

      if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0].id);
      }
    } catch (error) {
      console.error('Failed to load AI sessions:', error);
      toast.error('Failed to load chat sessions.');
    } finally {
      setIsLoadingSessions(false);
    }
  }, [selectedSessionId]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, metadata, tool_calls, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.error('Failed to load AI messages:', error);
      toast.error('Failed to load conversation.');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedSessionId);
  }, [selectedSessionId, fetchMessages]);

  useEffect(() => {
    const hasNewMessage = messages.length > previousMessageCountRef.current;
    const shouldAutoScroll = hasNewMessage && wasNearBottomRef.current;

    const animationFrame = requestAnimationFrame(() => {
      if (shouldAutoScroll) {
        scrollToBottom('auto');
      }
      previousMessageCountRef.current = messages.length;
      wasNearBottomRef.current = isNearBottom;
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [messages, isNearBottom, scrollToBottom]);

  const handleMessageScroll = () => {
    const container = messageListRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(distanceFromBottom <= 120);
  };

  const toCurrency = (value: unknown) => {
    const num = Number(value || 0);
    return `$${num.toFixed(2)}`;
  };

  const buildResultTable = (message: ChatMessage): TableConfig | null => {
    const metadata = message.metadata || {};
    const intent = String(metadata.intent || '');

    if (intent === 'hours_summary') {
      return {
        title: 'Hours Summary',
        columns: ['Person', 'Range', 'Total Hours', 'Entries'],
        rows: [[
          String(metadata.subject || '-'),
          `${String(metadata.startDate || '-') } to ${String(metadata.endDate || '-')}`,
          String(metadata.totalHours || '0'),
          String(metadata.entryCount || '0'),
        ]],
      };
    }

    if (intent === 'locations_summary' || intent === 'locations_chart') {
      const byPerson = Array.isArray(metadata.byPerson)
        ? (metadata.byPerson as Array<{ person?: string; locations?: string[]; totalHours?: number }>)
        : [];

      if (byPerson.length > 0) {
        return {
          title: 'Jobs By Employee',
          columns: ['Employee', 'Locations', 'Total Hours'],
          rows: byPerson.map((item) => [
            String(item.person || '-'),
            Array.isArray(item.locations) ? item.locations.join(', ') : '-',
            String(item.totalHours || 0),
          ]),
        };
      }

      const locations = Array.isArray(metadata.locations)
        ? (metadata.locations as Array<{ location?: string; hours?: number }>)
        : [];

      if (locations.length > 0) {
        return {
          title: 'Location Breakdown',
          columns: ['Location', 'Hours'],
          rows: locations.map((item) => [
            String(item.location || '-'),
            String(item.hours || 0),
          ]),
        };
      }
    }

    if (intent === 'expenses_count' || intent === 'expenses_total' || intent === 'expenses_by_job') {
      return {
        title: 'Expense Summary',
        columns: ['Person', 'Range', 'Expense Count', 'Total Amount', 'Location'],
        rows: [[
          String(metadata.subject || '-'),
          `${String(metadata.startDate || '-') } to ${String(metadata.endDate || '-')}`,
          String(metadata.expenseCount || '0'),
          toCurrency(metadata.totalExpenseAmount),
          String(metadata.location || 'All'),
        ]],
      };
    }

    return null;
  };

  const askQuestion = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed) {
      toast.error('Please enter a question first.');
      return;
    }

    setIsSubmitting(true);

    const temporaryUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, temporaryUserMessage]);
    setQuestion('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('No active session found.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/ask-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          question: trimmed,
          sessionId: selectedSessionId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'AI request failed');
      }

      const payload = await response.json();

      if (payload.sessionId && payload.sessionId !== selectedSessionId) {
        setSelectedSessionId(payload.sessionId);
      }

      await fetchSessions();
      if (payload.sessionId) {
        await fetchMessages(payload.sessionId);
      } else if (selectedSessionId) {
        await fetchMessages(selectedSessionId);
      }
    } catch (error) {
      console.error('Failed to ask AI question:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI answer.');
      setMessages((prev) => prev.filter((m) => m.id !== temporaryUserMessage.id));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Ask AI
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Ask natural language questions like: "How many hours did Person X work this week?"
        </p>
      </div>

      <div className={`grid grid-cols-1 ${isHistoryOpen ? 'md:grid-cols-[280px,1fr]' : 'md:grid-cols-1'} gap-4`}>
        <aside
          className={`rounded-xl border border-gray-200 bg-white p-3 h-[560px] overflow-y-auto ${
            isHistoryOpen ? 'block' : 'hidden'
          }`}
        >
          <div className="text-sm font-semibold text-gray-700 mb-3">Conversations</div>

          {isLoadingSessions ? (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-gray-500">No conversations yet. Ask your first question.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    selectedSessionId === session.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {session.title || 'Untitled conversation'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(session.updated_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col h-[560px]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Conversation</div>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              {isHistoryOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {isHistoryOpen ? 'Hide history' : 'Show history'}
            </button>
          </div>
          <div ref={messageListRef} onScroll={handleMessageScroll} className="flex-1 overflow-y-auto space-y-3 pr-1">
            {isLoadingMessages ? (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-500">
                Start by asking a question. Your message and AI response will appear here.
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === 'user';
                const metadata = message.metadata || {};
                const resultTable = !isUser ? buildResultTable(message) : null;
                const rawChart = metadata.chart as ChartMetadata | undefined;
                const canRenderChart =
                  !isUser &&
                  rawChart?.type === 'bar' &&
                  Array.isArray(rawChart.labels) &&
                  Array.isArray(rawChart.values) &&
                  rawChart.labels.length === rawChart.values.length &&
                  rawChart.labels.length > 0;

                return (
                  <div
                    key={message.id}
                    className={`rounded-xl border px-4 py-3 ${
                      isUser ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold mb-1 text-gray-800">
                      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      {isUser ? 'You asked' : 'AI answered'}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>

                    {resultTable && (
                      <div className="mt-4 rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
                          {resultTable.title}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {resultTable.columns.map((column) => (
                                  <th key={column} className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {resultTable.rows.map((row, rowIndex) => (
                                <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-gray-50/60">
                                  {row.map((cell, cellIndex) => (
                                    <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-gray-700 border-b border-gray-100">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                      {!isUser && (
                        <details className="mt-3 rounded-lg border border-gray-200 bg-white">
                          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-gray-700 flex items-center justify-between">
                            <span>Sources</span>
                            <span className="text-[11px] text-gray-500">expand</span>
                          </summary>
                          <div className="px-3 pb-3 text-xs text-gray-600 space-y-2">
                            <div>
                              <span className="font-semibold">Intent:</span>{' '}
                              {String(metadata.intent || 'unknown')}
                            </div>
                            <div>
                              <span className="font-semibold">Data source:</span>{' '}
                              {String(metadata.source || 'unknown')}
                            </div>
                            <div>
                              <span className="font-semibold">End date:</span>{' '}
                              {String(metadata.endDate || 'unknown')}
                            </div>
                            <div>
                              <span className="font-semibold">Tool calls:</span>
                              {Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? (
                                <ul className="mt-1 space-y-1">
                                  {message.tool_calls.map((call, index) => (
                                    <li key={`tool-${index}`} className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
                                      <div className="font-medium text-gray-700">{call.tool || 'unknown_tool'}</div>
                                      <div className="text-gray-600 break-words">{JSON.stringify(call.args || {})}</div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-1 text-gray-500">No tool calls recorded.</div>
                              )}
                            </div>
                          </div>
                        </details>
                      )}

                    {canRenderChart && (
                      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                          {rawChart.title || 'Location chart'}
                        </div>
                        <div className="h-56">
                          <Bar
                            data={{
                              labels: rawChart.labels,
                              datasets: [
                                {
                                  label: 'Hours',
                                  data: rawChart.values,
                                  backgroundColor: '#2563eb',
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: { display: false },
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  title: {
                                    display: true,
                                    text: 'Hours',
                                  },
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={askQuestion} className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="How many hours did Alex work this week?"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 text-sm font-medium"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                Ask
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
