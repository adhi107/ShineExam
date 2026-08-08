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

interface CandidateAnnouncement {
  id: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  publishAt: string;
  createdAt: string;
}

export const ResourceHero = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <div className="resource-hero">
    <span>{icon}</span>
    <div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  </div>
);

export const CandidateDocuments = ({ userId }: { userId: string }) => {
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ documents: CandidateDocument[] }>(`/answerer/documents?userId=${encodeURIComponent(userId)}`)
      .then((result) => setDocuments(result.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const size = (bytes: number) =>
    bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <section className="portal-page resource-page">
      <ResourceHero icon="▧" title="Documents" text="Study material assigned to you by the Shine administrator." />

      {loading ? (
        <div className="resource-empty">Loading your documents…</div>
      ) : documents.length === 0 ? (
        <div className="resource-empty">
          <b>▧</b>
          <h3>No documents assigned</h3>
          <p>Documents assigned by your administrator will appear here.</p>
        </div>
      ) : (
        <div className="resource-grid">
          {documents.map((document) => {
            const cleanDesc =
              document.description && document.description.trim() !== document.originalName.trim()
                ? document.description
                : "";
            const ext = (document.originalName.split('.').pop() || 'PDF').toUpperCase();

            return (
              <article key={document.id} className="candidate-document-card">
                <div className="doc-type-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span className="doc-ext-badge">{ext}</span>
                </div>

                <div className="doc-card-info">
                  <h3>{document.title || document.originalName}</h3>
                  {cleanDesc && <p className="doc-desc">{cleanDesc}</p>}
                  <div className="doc-file-meta">
                    <span className="doc-name">{document.originalName}</span>
                    <span className="doc-size-badge">{size(document.size)}</span>
                  </div>
                </div>

                <div className="resource-actions">
                  <a
                    className="view-resource-btn"
                    target="_blank"
                    rel="noreferrer"
                    href={`${API_BASE}/answerer/documents/${document.id}/view?userId=${encodeURIComponent(userId)}`}
                  >
                    View <span>↗</span>
                  </a>
                  <a
                    className="download-resource-btn"
                    href={`${API_BASE}/answerer/documents/${document.id}/download?userId=${encodeURIComponent(userId)}`}
                  >
                    Download <span>↓</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const CandidateBookmarks = ({
  userId,
  bookmarks,
  onChanged,
  onOpenTest,
}: {
  userId: string;
  bookmarks: CandidateBookmark[];
  onChanged: () => void;
  onOpenTest: (testId: string) => void;
}) => {
  const remove = async (bookmark: CandidateBookmark) => {
    await apiPost("/answerer/bookmarks/toggle", {
      userId,
      type: bookmark.type,
      testId: bookmark.testId,
      questionId: bookmark.questionId,
    });
    onChanged();
  };

  return (
    <section className="portal-page resource-page">
      <ResourceHero icon="★" title="Bookmarks" text="Saved tests and questions for quick revision." />

      {bookmarks.length === 0 ? (
        <div className="resource-empty">
          <b>☆</b>
          <h3>No bookmarks yet</h3>
          <p>Use the bookmark button on a test card or question to save it here.</p>
        </div>
      ) : (
        <div className="bookmark-list">
          {bookmarks.map((bookmark) => (
            <article key={bookmark.id} className="candidate-bookmark-card">
              <span className={`bookmark-type-icon ${bookmark.type}`}>★</span>
              <div className="bookmark-card-info">
                <small className={`bookmark-badge ${bookmark.type}`}>
                  {bookmark.type === "test" ? "SAVED TEST" : "SAVED QUESTION"}
                </small>
                <h3>{bookmark.title}</h3>
                {bookmark.question && <p className="bookmark-question-preview">{bookmark.question}</p>}
              </div>
              <div className="bookmark-actions">
                <button className="open-test-btn" onClick={() => onOpenTest(bookmark.testId)}>
                  Open test <span>→</span>
                </button>
                <button className="remove-bookmark-btn" onClick={() => remove(bookmark)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export const CandidateAnnouncements = ({ userId }: { userId: string }) => {
  const [announcements, setAnnouncements] = useState<CandidateAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ announcements: CandidateAnnouncement[] }>(`/answerer/announcements?userId=${encodeURIComponent(userId)}`)
      .then((result) => setAnnouncements(result.announcements || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <section className="portal-page resource-page">
      <ResourceHero icon="📢" title="Announcements" text="Latest updates and notices from Shine Exam Portal." />

      {loading ? (
        <div className="resource-empty">Loading announcements…</div>
      ) : announcements.length === 0 ? (
        <div className="resource-empty">
          <b>📢</b>
          <h3>No announcements</h3>
          <p>Important notices from your administrator will appear here.</p>
        </div>
      ) : (
        <div className="announcement-list">
          {announcements.map((item) => (
            <article key={item.id}>
              {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
              <div>
                <small>{new Date(item.publishAt || item.createdAt).toLocaleDateString()}</small>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                {item.linkUrl && (
                  <a href={item.linkUrl} target="_blank" rel="noreferrer">
                    Read details <span>→</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
