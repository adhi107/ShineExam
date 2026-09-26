import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

// Global memory cache for generated local video thumbnails
const localThumbnailCache: Record<string, string> = {};

function resolveVideoEmbedUrl(url?: string): string {
  if (!url) return "";
  const clean = url.trim();
  const origin = typeof window !== "undefined" && window.location?.origin ? encodeURIComponent(window.location.origin) : "";

  // YouTube Shorts & standard YouTube videos
  const ytMatch = clean.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/|live\/)|youtu\.be\/(?:shorts\/)?)([A-Za-z0-9_-]+)/i);
  if (ytMatch) {
    const vid = ytMatch[1].split("?")[0].split("&")[0];
    return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=1${origin ? `&origin=${origin}` : ""}`;
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

function formatDurationSeconds(secs: number): string {
  if (!secs || isNaN(secs)) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const StudentClasses: React.FC<StudentClassesProps> = ({ userId }) => {
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
  const [seekFeedback, setSeekFeedback] = useState<{ text: string; side: "left" | "right" } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);

  // Map of generated local video thumbnails
  const [localThumbs, setLocalThumbs] = useState<Record<string, string>>(localThumbnailCache);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerScreenRef = useRef<HTMLDivElement>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloadedUrls = useRef<Set<string>>(new Set());

  // 1. Preconnect to external video CDNs for ultra-low latency playback
  useEffect(() => {
    const preconnectHosts = [
      "https://www.youtube-nocookie.com",
      "https://i.ytimg.com",
      "https://googlevideo.com",
      "https://player.vimeo.com"
    ];
    preconnectHosts.forEach((host) => {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = host;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }, []);

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
      const fetchedClasses = res.classes || [];
      setClasses(fetchedClasses);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }

      // Generate instant thumbnail snapshots for local video uploads
      generateLocalThumbnails(fetchedClasses);
    } catch (err: any) {
      console.error("Failed to load video classes:", err);
    } finally {
      setLoading(false);
    }
  };

  // High-performance background video frame extractor for local video thumbnails
  const generateLocalThumbnails = (items: StudentClassItem[]) => {
    items.forEach((item) => {
      if (item.sourceType === "file" && !getYouTubeThumbnail(item.videoUrl)) {
        const fullSrc = getMediaUrl(item.videoUrl || item.embedUrl);
        if (!fullSrc || localThumbnailCache[item.id]) return;

        try {
          const v = document.createElement("video");
          v.crossOrigin = "anonymous";
          v.preload = "metadata";
          v.muted = true;
          v.src = fullSrc;
          v.currentTime = 1.0;

          v.onloadeddata = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = 360;
              canvas.height = 202;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                localThumbnailCache[item.id] = dataUrl;
                setLocalThumbs((p) => ({ ...p, [item.id]: dataUrl }));
              }
            } catch {}
          };
        } catch {}
      }
    });
  };

  // Ultra-fast hover preloader: Pre-warms the media stream before the student clicks play
  const prewarmVideo = (item: StudentClassItem) => {
    const src = getMediaUrl(item.videoUrl || item.embedUrl);
    if (!src || preloadedUrls.current.has(src)) return;
    preloadedUrls.current.add(src);

    // Preconnect stream endpoint
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.href = src;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  };

  const handleWatchClass = (video: StudentClassItem) => {
    setIframeLoaded(false);
    setIsBuffering(true);
    setPlaybackSpeed(1);
    setActiveClass(video);
    setCurrentTime(0);
    setDuration(0);

    // Instant tracking
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

  const triggerSeekFeedback = (text: string, side: "left" | "right") => {
    setSeekFeedback({ text, side });
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 650);
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    triggerSeekFeedback(seconds > 0 ? `+${seconds}s ⏩` : `${seconds}s ⏪`, seconds > 0 ? "right" : "left");
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch {}
  };

  const toggleFullscreen = () => {
    if (!playerScreenRef.current) return;
    if (!document.fullscreenElement) {
      playerScreenRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleVideoLoaded = () => {
    setIframeLoaded(true);
    setIsBuffering(false);
    if (videoRef.current && activeClass) {
      videoRef.current.playbackRate = playbackSpeed;
      setDuration(videoRef.current.duration || 0);

      // Instant Smart Resume
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

  // Keyboard shortcuts for YouTube/Netflix-style playback speed and control
  useEffect(() => {
    if (!activeClass) return;
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept if student is typing in an input/textarea
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "Escape") {
        closePlayer();
      } else if (e.key === " " || e.key === "k" || e.key === "K") {
        if (videoRef.current) {
          e.preventDefault();
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        seekRelative(10);
      } else if (e.key === "m" || e.key === "M") {
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "p" || e.key === "P") {
        togglePiP();
      } else if (e.key >= "0" && e.key <= "9") {
        if (videoRef.current && videoRef.current.duration) {
          const fraction = parseInt(e.key, 10) / 10;
          videoRef.current.currentTime = videoRef.current.duration * fraction;
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeClass, closePlayer]);

  // Compute saved progress percentage for cards
  const getSavedProgressPercent = (classId: string): number => {
    try {
      const pos = Number(localStorage.getItem(`shine_class_pos_${classId}`) || 0);
      if (pos > 5) return Math.min(100, Math.round((pos / 900) * 100));
    } catch {}
    return 0;
  };

  return (
    <SensitiveContent
      module="classes"
      userId={userId}
      showWatermark={false}
      hideOnTabSwitch={false}
      hideOnWindowBlur={false}
      enableVideoOverlay={true}
    >
      <div className="student-classes-shell">
        {/* Hero Banner */}
        <div className="classes-hero">
          <div className="hero-icon-box">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className="hero-content">
            <h2 className="classes-hero-title">Video Classes</h2>
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search lectures, topics, or subjects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch("")} aria-label="Clear search">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="classes-loading-state">
            <div className="classes-spinner" />
            <p>Loading assigned video classes with instant pre-warming...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="classes-empty-state">
            <div className="empty-icon-wrap">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
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
              const thumbUrl = ytThumb || localThumbs[cls.id] || cls.thumbnailUrl;
              const progressPct = getSavedProgressPercent(cls.id);
              const savedPos = localStorage.getItem(`shine_class_pos_${cls.id}`);

              return (
                <div
                  key={cls.id}
                  className="student-class-card"
                  onMouseEnter={() => prewarmVideo(cls)}
                  onFocus={() => prewarmVideo(cls)}
                >
                  {/* Thumbnail Preview Area with Instant Pre-Warm */}
                  <div
                    className={`card-media-banner ${thumbUrl ? "has-thumb" : ""}`}
                    onClick={() => handleWatchClass(cls)}
                    style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
                  >
                    <div className="media-play-overlay">
                      <div className="play-pulse-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>

                    <span className="media-duration-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {cls.duration || "HD Video"}
                    </span>


                    {/* Resume indicator if student watched partially */}
                    {savedPos && Number(savedPos) > 10 && (
                      <span className="media-resume-chip">
                        ↺ Resume at {formatDurationSeconds(Number(savedPos))}
                      </span>
                    )}

                    {/* Progress bar overlay */}
                    {progressPct > 0 && (
                      <div className="card-watched-progress-bar">
                        <div className="watched-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="card-body">
                    <div className="card-meta-row">
                      <span className="category-tag">{cls.category || "General"}</span>
                      <span className="views-count">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {cls.viewCount || 0} views
                      </span>
                    </div>

                    <h3 className="card-title" onClick={() => handleWatchClass(cls)} title={cls.title}>
                      {cls.title}
                    </h3>

                    <div className="card-footer-action">
                      <button type="button" className="btn-watch-class" onClick={() => handleWatchClass(cls)}>
                        <span>{savedPos && Number(savedPos) > 10 ? "Resume Class" : "Watch Lecture"}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CINEMA ULTRA-FAST VIDEO PLAYER MODAL SCREEN
            ═══════════════════════════════════════════════════════════════ */}
        {activeClass && (
          <div className="player-modal-backdrop" onClick={closePlayer} onContextMenu={(e) => e.preventDefault()}>
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
                  <button
                    className="btn-close-player"
                    onClick={closePlayer}
                    title="Close Player (Esc)"
                    aria-label="Close Video"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Protected Video Screen */}
              <div
                ref={playerScreenRef}
                className="student-player-screen"
                style={{ position: "relative" }}
                onDoubleClick={handleScreenDoubleTap}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Forensic Watermark */}
                <DynamicWatermark module="classes" userId={userId} opacity={0.16} isBold={true} />

                {/* Double-Tap / Seek Animation Overlay */}
                {seekFeedback && (
                  <div className={`player-seek-overlay ${seekFeedback.side}`}>
                    <div className="seek-ripple-circle">
                      <span>{seekFeedback.text}</span>
                    </div>
                  </div>
                )}

                {/* Buffering Indicator */}
                {isBuffering && (
                  <div className="player-buffering-overlay" aria-label="Buffering video...">
                    <div className="youtube-buffer-spinner" />
                    <span className="buffering-text">Loading video...</span>
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
                    pointerEvents: "none"
                  }}
                  aria-hidden="true"
                />

                {activeClass.sourceType === "file" ||
                activeClass.provider === "direct" ||
                activeClass.provider === "local" ? (
                  /* ── Local / Direct Video — Native High-Speed HTML5 Player with Chunk Stream ── */
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
                    disablePictureInPicture={false}
                    onLoadedData={handleVideoLoaded}
                    onCanPlay={() => setIsBuffering(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onTimeUpdate={() => {
                      if (videoRef.current && activeClass) {
                        setCurrentTime(videoRef.current.currentTime);
                        setDuration(videoRef.current.duration || 0);
                        try {
                          localStorage.setItem(
                            `shine_class_pos_${activeClass.id}`,
                            String(videoRef.current.currentTime)
                          );
                        } catch {}
                      }
                    }}
                  >
                    Your browser does not support video streaming.
                  </video>
                ) : (
                  /* ── External Video (YouTube/Vimeo) — Sandboxed High-Speed iframe ── */
                  <>
                    {!iframeLoaded && (
                      <div className="video-loading-skeleton" aria-label="Loading video...">
                        <div className="video-skeleton-pulse">
                          <div className="skeleton-play-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                          <p>Loading lecture video...</p>
                        </div>
                      </div>
                    )}
                    <iframe
                      src={resolveVideoEmbedUrl(activeClass.embedUrl || activeClass.videoUrl || activeClass.originalUrl)}
                      title={activeClass.title}
                      className={`student-iframe-element ${iframeLoaded ? "iframe-ready" : "iframe-loading"}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; fullscreen; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="eager"
                      onLoad={() => {
                        setIframeLoaded(true);
                        setIsBuffering(false);
                      }}
                    />
                  </>
                )}
              </div>

              {/* YouTube-Style Quick Control Toolbar */}
              {(activeClass.sourceType === "file" ||
                activeClass.provider === "direct" ||
                activeClass.provider === "local") && (
                <div className="player-quick-controls-bar">
                  <div className="quick-seek-group">
                    <button
                      type="button"
                      className="quick-action-pill"
                      onClick={() => seekRelative(-10)}
                      title="Rewind 10s (Left Arrow / J)"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="11 17 6 12 11 7" />
                        <polyline points="18 17 13 12 18 7" />
                      </svg>
                      -10s
                    </button>
                    <button
                      type="button"
                      className="quick-action-pill"
                      onClick={() => seekRelative(10)}
                      title="Forward 10s (Right Arrow / L)"
                    >
                      +10s
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="13 17 18 12 13 7" />
                        <polyline points="6 17 11 12 6 7" />
                      </svg>
                    </button>
                    <span className="player-live-time">
                      {formatDurationSeconds(currentTime)} / {formatDurationSeconds(duration)}
                    </span>
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
                    <button
                      type="button"
                      className={`speed-pill ${isPiPActive ? "active" : ""}`}
                      onClick={togglePiP}
                      title="Picture-in-Picture (P)"
                    >
                      📺 PiP
                    </button>
                    <button
                      type="button"
                      className="speed-pill"
                      onClick={toggleFullscreen}
                      title="Fullscreen (F)"
                    >
                      ⛶
                    </button>
                  </div>
                </div>
              )}

              {/* Lecture Overview & Keyboard Cheatsheet */}
              <div className="student-player-footer">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div>
                    <strong>Lecture Overview:</strong>
                    <p style={{ margin: "4px 0 0", color: "#475569", fontSize: "0.85rem" }}>
                      {activeClass.description || "Assigned conceptual video lecture."}
                    </p>
                  </div>
                  <div className="player-shortcuts-hint">
                    <small>⌨️ Shortcuts: Space (Play/Pause) • J/L (Seek 10s) • M (Mute) • F (Fullscreen)</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SensitiveContent>
  );
};

export default StudentClasses;
