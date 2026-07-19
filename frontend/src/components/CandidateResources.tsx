import React, { useEffect, useState } from "react";
import { API_BASE, apiGet, apiPost } from "../services/api";
import "./CandidateResources.css";

export interface CandidateBookmark {
  id: string;
  type: "test" | "question";
  testId: string;
  questionId?: string;
  title: string;
  question?: string;
  createdAt: string;
}

interface CandidateDocument {
  id: string;
  title: string;
  description: string;
  originalName: string;
  size: number;
  createdAt: string;
}
interface CandidateAnnouncement { id:string;title:string;message:string;linkUrl:string;imageUrl:string;publishAt:string;createdAt:string }

export const CandidateDocuments = ({ userId }: { userId: string }) => {
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiGet<{ documents: CandidateDocument[] }>(`/answerer/documents?userId=${encodeURIComponent(userId)}`)
      .then(result => setDocuments(result.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);
  const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return <section className="portal-page resource-page"><ResourceHero icon="▧" title="Documents" text="Study material assigned to you by the Shine administrator." />
    {loading ? <div className="resource-empty">Loading your documents…</div> : documents.length === 0 ? <div className="resource-empty"><b>▧</b><h3>No documents assigned</h3><p>Documents assigned by your administrator will appear here.</p></div> : <div className="resource-grid">{documents.map(document => <article key={document.id}><span className="resource-file-icon">DOC</span><div><h3>{document.title}</h3><p>{document.description || document.originalName}</p><small>{document.originalName} · {size(document.size)}</small></div><div className="resource-actions"><a className="view-resource" target="_blank" rel="noreferrer" href={`${API_BASE}/answerer/documents/${document.id}/view?userId=${encodeURIComponent(userId)}`}>View <span>↗</span></a><a href={`${API_BASE}/answerer/documents/${document.id}/download?userId=${encodeURIComponent(userId)}`}>Download <span>↓</span></a></div></article>)}</div>}
  </section>;
};

export const CandidateBookmarks = ({ userId, bookmarks, onChanged, onOpenTest }: { userId: string; bookmarks: CandidateBookmark[]; onChanged: () => void; onOpenTest: (testId: string) => void }) => {
  const remove = async (bookmark: CandidateBookmark) => {
    await apiPost("/answerer/bookmarks/toggle", { userId, type: bookmark.type, testId: bookmark.testId, questionId: bookmark.questionId });
    onChanged();
  };
  return <section className="portal-page resource-page"><ResourceHero icon="★" title="Bookmarks" text="Saved tests and questions for quick revision." />
    {bookmarks.length === 0 ? <div className="resource-empty"><b>☆</b><h3>No bookmarks yet</h3><p>Use the bookmark button on a test card or question to save it here.</p></div> : <div className="bookmark-list">{bookmarks.map(bookmark => <article key={bookmark.id}><span className={bookmark.type}>★</span><div><small>{bookmark.type === "test" ? "SAVED TEST" : "SAVED QUESTION"}</small><h3>{bookmark.title}</h3>{bookmark.question && <p>{bookmark.question}</p>}</div><button onClick={() => onOpenTest(bookmark.testId)}>Open test</button><button className="remove-bookmark" onClick={() => remove(bookmark)}>Remove</button></article>)}</div>}
  </section>;
};

export const CandidateAnnouncements = ({ userId }: { userId: string }) => {
  const [items,setItems]=useState<CandidateAnnouncement[]>([]),[loading,setLoading]=useState(true);
  useEffect(()=>{apiGet<{announcements:CandidateAnnouncement[]}>(`/answerer/announcements?userId=${encodeURIComponent(userId)}`).then(result=>setItems(result.announcements||[])).catch(console.error).finally(()=>setLoading(false))},[userId]);
  return <section className="portal-page resource-page"><ResourceHero icon="♢" title="Announcements" text="Latest batches, pages and notices assigned to you." />{loading?<div className="resource-empty">Loading announcements…</div>:items.length===0?<div className="resource-empty"><b>♢</b><h3>No announcements</h3><p>New updates from your administrator will appear here.</p></div>:<div className="announcement-list">{items.map(item=><article key={item.id}>{item.imageUrl&&<img src={`${API_BASE}${item.imageUrl}`} alt=""/>}<div><small>{new Date(item.publishAt||item.createdAt).toLocaleDateString("en-IN")}</small><h3>{item.title}</h3><p>{item.message}</p>{item.linkUrl&&<a href={item.linkUrl} target="_blank" rel="noreferrer">Open batch page →</a>}</div></article>)}</div>}</section>;
};

const ResourceHero = ({ icon, title, text }: { icon: string; title: string; text: string }) => <div className="resource-hero"><span>{icon}</span><div><h2>{title}</h2><p>{text}</p></div></div>;
