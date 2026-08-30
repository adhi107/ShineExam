import React, { useState, useEffect } from "react";
import { apiGet, apiPost, getMediaUrl } from "../services/api";
import SensitiveContent from "../security/SensitiveContent";
import "./StudentClasses.css";

export interface StudentClassItem {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  sourceType: "file" | "link";
  provider?: "youtube" | "vimeo" | "direct" | "local";
  videoUrl?: string;
  embedUrl?: string;
  originalUrl?: string;
  tags?: string[];
  viewCount: number;
  createdAt: string;
}

interface StudentClassesProps {
  userId: string;
}

function resolveVideoEmbedUrl(url?: string): string {
  if (!url) return "";
  const clean = url.trim();
  const shortsMatch = clean.match(/(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([A-Za-z0-9_-]+)/i);
  if (shortsMatch) {
    const vid = shortsMatch[1].split("?")[0].split("&")[0];
    return `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1`;
  }
  const ytMatch = clean.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i);
  if (ytMatch) {
    const vid = ytMatch[1].split("?")[0].split("&")[0];
    return `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1`;
  }
  const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }
  return getMediaUrl(clean);
}

const StudentClasses: React.FC<StudentClassesProps> = ({ userId }) => {
  const [classes, setClasses] = useState<StudentClassItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // In-Screen Video Player State
  const [activeClass, setActiveClass] = useState<StudentClassItem | null>(null);

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line
  }, [selectedCategory, search]);

  const loadClasses = async () => {
    setLoading(true);
    try {
      let url = `/answerer/classes?userId=${encodeURIComponent(userId)}&search=${encodeURIComponent(search)}`;
      if (selectedCategory !== "all") {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      const res = await apiGet<{ classes: StudentClassItem[]; categories: string[]; totalCount: number }>(url);
      setClasses(res.classes || []);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }
    } catch (err: any) {
      console.error("Failed to load video classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchClass = (video: StudentClassItem) => {
    setActiveClass(video);
    // Track view asynchronously safely
    apiPost("/answerer/classes/track", { videoId: video.id, userId }).catch(() => {
      // Non-blocking fallback
    });
  };

  const closePlayer = () => {
    setActiveClass(null);
  };

  return (
    <SensitiveContent
      module="classes"
      userId={userId}
      showWatermark={true}
      hideOnTabSwitch={true}
      hideOnWindowBlur={false}
      enableVideoOverlay={false}
    >
      <div className="student-classes-shell">
        {/* Hero Banner */}
        <div className="classes-hero">
          <div className="hero-icon-box">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <div className="hero-content">
            <h2
              className="classes-hero-title"
              style={{
                color: "#ffffff",
                margin: "0 0 4px 0",
                fontSize: "21px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                textShadow: "0 1px 3px rgba(0,0,0,0.35)",
              }}
            >
              Video Classes &amp; Lectures
            </h2>
            <p
              className="classes-hero-subtitle"
              style={{
                color: "#e0f2fe",
                margin: 0,
                fontSize: "13px",
                fontWeight: 400,
                lineHeight: 1.4,
              }}
            >
              Watch subject lectures, concept breakdowns, and test prep masterclasses assigned by your instructors.
            </p>
          </div>
        </div>

        {/* Categories & Search Strip */}
        <div className="classes-toolbar">
          <div className="categories-pill-scroll">
            <button
              type="button"
              className={`cat-pill ${selectedCategory === "all" ? "active" : ""}`}
              onClick={() => setSelectedCategory("all")}
            >
              All Classes ({classes.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="classes-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear-search-btn" onClick={() => setSearch("")}>✕</button>}
          </div>
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="classes-loading-state">
            <div className="classes-spinner" />
            <p>Loading assigned video classes...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="classes-empty-state">
            <div className="empty-icon-wrap">🎬</div>
            <h3>No Video Classes Available</h3>
            <p>
              {selectedCategory !== "all" || search
                ? "No lectures match your current filter criteria."
                : "Your instructors haven't assigned any video lectures to your batch yet."}
            </p>
            {(selectedCategory !== "all" || search) && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearch("");
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="classes-card-grid">
            {classes.map((cls) => (
              <div key={cls.id} className="student-class-card">
                {/* Thumbnail Preview Area */}
                <div className="card-media-banner" onClick={() => handleWatchClass(cls)}>
                  <div className="media-play-overlay">
                    <div className="play-pulse-circle">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                  </div>
                  <span className="media-duration-chip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {cls.duration || "Video"}
                  </span>
                  <span className="media-provider-badge">
                    {cls.sourceType === "file" ? "📁 Local Video" : cls.provider === "youtube" ? "▶ YouTube" : "▶ Video Stream"}
                  </span>
                </div>

                {/* Card Info */}
                <div className="card-body">
                  <div className="card-meta-row">
                    <span className="category-tag">{cls.category || "General"}</span>
                    <span className="views-count">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      {cls.viewCount || 0} views
                    </span>
                  </div>

                  <h3 className="card-title" onClick={() => handleWatchClass(cls)} title={cls.title}>
                    {cls.title}
                  </h3>

                  {cls.description && (
                    <p className="card-description">{cls.description}</p>
                  )}

                  {cls.tags && cls.tags.length > 0 && (
                    <div className="card-tags-row">
                      {cls.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="lecture-tag">#{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="card-footer-action">
                    <button
                      type="button"
                      className="btn-watch-class"
                      onClick={() => handleWatchClass(cls)}
                    >
                      <span>Watch Lecture</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* In-Screen Protected Video Player with Anti-Recording DRM */}
        {activeClass && (
          <div className="player-modal-backdrop" onClick={closePlayer}>
            <div
              className="student-video-player-container"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Header */}
              <div className="student-player-header">
                <div className="player-meta-left">
                  <span className="player-badge">{activeClass.category}</span>
                  <h3 title={activeClass.title}>{activeClass.title}</h3>
                </div>
                <div className="player-meta-right">
                  <div className="drm-live-indicator">
                    <span className="live-dot" />
                    DRM Protected
                  </div>
                  <button className="btn-close-player" onClick={closePlayer} title="Close Player">✕</button>
                </div>
              </div>

              {/* In-Screen Video Screen */}
              <div className="student-player-screen">
                {activeClass.sourceType === "file" || activeClass.provider === "direct" || activeClass.provider === "local" ? (
                  <video
                    src={getMediaUrl(activeClass.videoUrl || activeClass.embedUrl)}
                    controls
                    controlsList="nodownload"
                    autoPlay
                    className="student-video-element"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    Your browser does not support video streaming.
                  </video>
                ) : (
                  <iframe
                    src={resolveVideoEmbedUrl(activeClass.embedUrl || activeClass.videoUrl || activeClass.originalUrl)}
                    title={activeClass.title}
                    className="student-iframe-element"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>

              {/* Lecture Description */}
              {activeClass.description && (
                <div className="student-player-footer">
                  <strong>Lecture Overview:</strong>
                  <p>{activeClass.description}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SensitiveContent>
  );
};

export default StudentClasses;
