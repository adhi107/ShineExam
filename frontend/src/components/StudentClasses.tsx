import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiGet, apiPost, getMediaUrl } from "../services/api";
import SensitiveContent from "../security/SensitiveContent";
import DynamicWatermark from "../security/DynamicWatermark";
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
  thumbnailUrl?: string;
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
  // YouTube Shorts
  const shortsMatch = clean.match(/(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([A-Za-z0-9_-]+)/i);
  if (shortsMatch) {
    const vid = shortsMatch[1].split("?")[0].split("&")[0];
    // Use embed with fastest load params: no related, no modestbranding, lazy load JS API
    return `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
  }
  // Regular YouTube
  const ytMatch = clean.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i);
  if (ytMatch) {
    const vid = ytMatch[1].split("?")[0].split("&")[0];
    return `https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
  }
  // Vimeo
  const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&byline=0&portrait=0&title=0&dnt=1`;
  }
  return getMediaUrl(clean);
}

function getYouTubeThumbnail(url?: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  const shortsMatch = clean.match(/(?:youtube\.com\/shorts\/|youtu\.be\/shorts\/)([A-Za-z0-9_-]+)/i);
  if (shortsMatch) {
    const vid = shortsMatch[1].split("?")[0].split("&")[0];
    return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  }
  const ytMatch = clean.match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]+)/i);
  if (ytMatch) {
    const vid = ytMatch[1].split("?")[0].split("&")[0];
    return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  }
  return null;
}

function isYouTubeOrVimeo(cls: StudentClassItem): boolean {
  const rawUrl = cls.embedUrl || cls.videoUrl || cls.originalUrl || "";
  return !!(
    rawUrl.match(/youtube\.com|youtu\.be/i) ||
    rawUrl.match(/vimeo\.com/i) ||
    cls.provider === "youtube" ||
    cls.provider === "vimeo"
  );
}

const StudentClasses: React.FC<StudentClassesProps> = ({ userId }) => {
  const [classes, setClasses] = useState<StudentClassItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // In-Screen Video Player State
  const [activeClass, setActiveClass] = useState<StudentClassItem | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setIframeLoaded(false);
    setIsBuffering(true);
    setPlaybackSpeed(1);
    setActiveClass(video);
    apiPost("/answerer/classes/track", { videoId: video.id, userId }).catch(() => {});
  };

  const closePlayer = useCallback(() => {
    if (activeClass && videoRef.current) {
      try {
        localStorage.setItem(`shine_class_pos_${activeClass.id}`, String(videoRef.current.currentTime));
      } catch {}
    }
    setActiveClass(null);
    setIframeLoaded(false);
    setIsBuffering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
  }, [activeClass]);

  const triggerSeekFeedback = (text: string) => {
    setSeekFeedback(text);
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 700);
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    triggerSeekFeedback(seconds > 0 ? `+${seconds}s ⏩` : `${seconds}s ⏪`);
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleVideoLoaded = () => {
    setIframeLoaded(true);
    setIsBuffering(false);
    if (videoRef.current && activeClass) {
      videoRef.current.playbackRate = playbackSpeed;
      try {
        const savedPos = localStorage.getItem(`shine_class_pos_${activeClass.id}`);
        if (savedPos && Number(savedPos) > 3) {
          videoRef.current.currentTime = Number(savedPos);
        }
      } catch {}
      videoRef.current.play().catch(() => {});
    }
  };

  const handleScreenDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) {
      seekRelative(-10);
    } else {
      seekRelative(10);
    }
  };

  // Keyboard shortcuts for YouTube-style experience
  useEffect(() => {
    if (!activeClass) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePlayer();
      } else if (e.key === " " || e.key === "k") {
        if (videoRef.current) {
          e.preventDefault();
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === "m") {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
        }
      } else if (e.key === "f") {
        const screen = document.querySelector(".student-player-screen");
        if (screen && !document.fullscreenElement) {
          screen.requestFullscreen().catch(() => {});
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeClass, closePlayer]);

  return (
    <SensitiveContent
      module="classes"
      userId={userId}
      showWatermark={false} // Watermark is placed directly on the player screen only
      hideOnTabSwitch={false}
      hideOnWindowBlur={false}
      enableVideoOverlay={true}
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
            <h2 className="classes-hero-title">
              Video Classes &amp; Lectures
            </h2>
            <p className="classes-hero-subtitle">
              Watch subject lectures, concept breakdowns, and test prep masterclasses assigned by your instructors.
            </p>
          </div>
          <div className="hero-stats-badge">
            <span className="hero-count-number">{classes.length}</span>
            <span className="hero-count-label">Assigned {classes.length === 1 ? "Class" : "Classes"}</span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search lectures, topics, or subjects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch("")} aria-label="Clear search">✕</button>
            )}
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
            <div className="empty-icon-wrap">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            </div>
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
            {classes.map((cls) => {
              const ytThumb = getYouTubeThumbnail(cls.embedUrl || cls.videoUrl || cls.originalUrl);
              return (
                <div key={cls.id} className="student-class-card">
                  {/* Thumbnail Preview Area */}
                  <div
                    className={`card-media-banner ${ytThumb ? "has-thumb" : ""}`}
                    onClick={() => handleWatchClass(cls)}
                    style={ytThumb ? { backgroundImage: `url(${ytThumb})` } : undefined}
                  >
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

                    {(cls.provider === "youtube" || ytThumb) && (
                      <span className="media-provider-badge">
                        ▶ YouTube
                      </span>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="card-body">
                    <div className="card-meta-row">
                      <span className="category-tag">{cls.category || "General"}</span>
                      <span className="views-count">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {cls.viewCount || 0} views
                      </span>
                    </div>

                    <h3 className="card-title" onClick={() => handleWatchClass(cls)} title={cls.title}>
                      {cls.title}
                    </h3>

                    {cls.description ? (
                      <p className="card-description">{cls.description}</p>
                    ) : (
                      <p className="card-description card-description--empty">Assigned lecture masterclass.</p>
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
              );
            })}
          </div>
        )}

        {/* Video Player Modal */}
        {activeClass && (
          <div
            className="player-modal-backdrop"
            onClick={closePlayer}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className="student-video-player-container"
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              style={{ userSelect: "none", WebkitUserSelect: "none" } as React.CSSProperties}
            >
              {/* Header */}
              <div className="student-player-header">
                <div className="player-meta-left">
                  <span className="player-badge">{activeClass.category || "Lecture"}</span>
                  <h3 title={activeClass.title}>{activeClass.title}</h3>
                </div>
                <div className="player-meta-right">
                  <button className="btn-close-player" onClick={closePlayer} title="Close Player" aria-label="Close Video">✕</button>
                </div>
              </div>

              {/* Protected Video Screen */}
              <div
                className="student-player-screen"
                style={{ position: "relative" }}
                onDoubleClick={handleScreenDoubleTap}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Forensic Watermark */}
                <DynamicWatermark
                  module="classes"
                  userId={userId}
                  opacity={0.16}
                  isBold={true}
                />

                {/* Seek Feedback Animation */}
                {seekFeedback && (
                  <div className="player-seek-overlay">
                    <span>{seekFeedback}</span>
                  </div>
                )}

                {/* Buffering Spinner */}
                {isBuffering && (
                  <div className="player-buffering-overlay" aria-label="Buffering video...">
                    <div className="youtube-buffer-spinner" />
                  </div>
                )}

                {/* Anti-grab DRM Overlay */}
                <div
                  className="video-drm-overlay"
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 10,
                    background: "transparent",
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                />

                {activeClass.sourceType === "file" || activeClass.provider === "direct" || activeClass.provider === "local" ? (
                  /* ── Local / Direct Video — Native HTML5 Player with Chunk Stream ── */
                  <video
                    ref={videoRef}
                    src={getMediaUrl(activeClass.videoUrl || activeClass.embedUrl)}
                    controls
                    controlsList="nodownload noremoteplayback"
                    autoPlay
                    playsInline
                    preload="auto"
                    className="student-video-element"
                    onContextMenu={(e) => e.preventDefault()}
                    disablePictureInPicture
                    onLoadedData={handleVideoLoaded}
                    onCanPlay={() => setIsBuffering(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onTimeUpdate={() => {
                      if (videoRef.current && activeClass) {
                        try {
                          localStorage.setItem(`shine_class_pos_${activeClass.id}`, String(videoRef.current.currentTime));
                        } catch {}
                      }
                    }}
                  >
                    Your browser does not support video streaming.
                  </video>
                ) : (
                  /* ── External Video (YouTube/Vimeo) — Sandboxed iframe ── */
                  <>
                    {!iframeLoaded && (
                      <div className="video-loading-skeleton" aria-label="Loading video...">
                        <div className="video-skeleton-pulse">
                          <div className="skeleton-play-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                          </div>
                          <p>Loading video stream...</p>
                        </div>
                      </div>
                    )}
                    <iframe
                      src={resolveVideoEmbedUrl(activeClass.embedUrl || activeClass.videoUrl || activeClass.originalUrl)}
                      title={activeClass.title}
                      className={`student-iframe-element ${iframeLoaded ? "iframe-ready" : "iframe-loading"}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="eager"
                      onLoad={() => { setIframeLoaded(true); setIsBuffering(false); }}
                    />
                  </>
                )}
              </div>

              {/* YouTube-Style Quick Speed & Seek Action Bar */}
              {(activeClass.sourceType === "file" || activeClass.provider === "direct" || activeClass.provider === "local") && (
                <div className="player-quick-controls-bar">
                  <div className="quick-seek-group">
                    <button type="button" className="quick-action-pill" onClick={() => seekRelative(-10)} title="Rewind 10s (Left Arrow / J)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
                      -10s
                    </button>
                    <button type="button" className="quick-action-pill" onClick={() => seekRelative(10)} title="Forward 10s (Right Arrow / L)">
                      +10s
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                    </button>
                  </div>
                  <div className="speed-selector-group">
                    <span className="speed-label">Speed:</span>
                    {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        className={`speed-pill ${playbackSpeed === spd ? "active" : ""}`}
                        onClick={() => changeSpeed(spd)}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lecture Overview */}
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
