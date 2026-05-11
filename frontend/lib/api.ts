const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UploadResult {
  document_id: string;
  chunk_count: number;
  s3_url: string;
}

export interface Citation {
  filename: string;
  page_number: number;
  content: string;
}

export interface QueryResult {
  answer: string;
  citations: Citation[];
  tool_calls: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
}

export async function uploadDocument(file: File, userId: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', userId);
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function queryDocuments(query: string, userId: string, documentId?: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, user_id: userId, document_id: documentId ?? null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Query failed');
  }
  return res.json();
}

export async function generateQuiz(documentId: string, userId: string, numQuestions = 5): Promise<QuizResult> {
  const res = await fetch(`${API_BASE}/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, user_id: userId, num_questions: numQuestions }),
  });
  if (!res.ok) throw new Error('Quiz generation failed');
  return res.json();
}

export interface GraphNode {
  id: string;
  label: string;
  topic: string;
  summary: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MasteryTopic {
  name: string;
  masteryScore: number;
  questionsAsked: number;
  quizCorrect: number;
  quizTotal: number;
  status: 'strong' | 'developing' | 'weak';
  suggestedQuestion: string;
}

export interface MasteryResult {
  topics: MasteryTopic[];
  overallMastery: number;
  studyStreak: number;
  suggestedNextTopic: string;
}

export async function fetchKnowledgeGraph(documentId: string, userId: string): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/graph/${documentId}?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch knowledge graph');
  return res.json();
}

export async function submitMasteryAnalysis(
  documentId: string,
  userId: string,
  chatHistory: { role: string; content: string }[],
  quizHistory: { question: string; answer: string; userAnswer?: string }[],
  studyStreak = 1,
): Promise<MasteryResult> {
  const res = await fetch(`${API_BASE}/mastery/${documentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      chat_history: chatHistory,
      quiz_history: quizHistory,
      study_streak: studyStreak,
    }),
  });
  if (!res.ok) throw new Error('Failed to analyze mastery');
  return res.json();
}
