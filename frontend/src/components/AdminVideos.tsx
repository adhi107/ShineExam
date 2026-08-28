import React, { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import "./AdminVideos.css";

interface VideoItem {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  assignedTo: string | string[];
  tags: string[];
  sourceType: "file" | "link";
  provider?: "youtube" | "vimeo" | "direct" | "local";
  videoUrl?: string;
  embedUrl?: string;
  originalUrl?: string;
  filename?: string;
  originalFilename?: string;
  fileSize?: number;
  viewCount: number;
  createdAt: string;
}

interface VideoStats {
  total: number;
  fileUploads: number;
  links: number;
  totalViews: number;
}

interface StudentUser {
  id?: string;
  userId: string;
  name: string;
  email?: string;
  isActive?: boolean;
}

const getMediaUrl = (url?: string): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const rawBase = (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "").replace(/\/api$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${rawBase}${cleanPath}`;
};

const CATEGORY_OPTIONS = [
  "General",
  "Banking",
  "SSC",
  "Quantitative Aptitude",
  "Reasoning Ability",
  "English Language",
  "General Awareness",
  "Current Affairs",
  "Computer Knowledge",
];

const AdminVideos: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<VideoStats>({ total: 0, fileUploads: 0, links: 0, totalViews: 0 });
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Standalone Assign Modal
  const [assigningVideo, setAssigningVideo] = useState<VideoItem | null>(null);
  const [assignSearch, setAssignSearch] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState<boolean>(false);

  // Form Fields
  const [sourceType, setSourceType] = useState<"link" | "file">("link");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<string>("General");
  const [duration, setDuration] = useState<string>("30m");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [assignmentMode, setAssignmentMode] = useState<"all" | "custom">("all");
  const [formSelectedStudents, setFormSelectedStudents] = useState<string[]>([]);
  const [formStudentSearch, setFormStudentSearch] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Playback Preview Modal
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  // Toast
  const [toast, setToast] = useState<string>("");
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    loadVideos();
    loadStudents();
    // eslint-disable-next-line
  }, [search, selectedCategory]);

  const loadStudents = async () => {
    try {
      const res = await apiGet<{ users: StudentUser[] }>("/admin/users");
      setStudents(res.users || []);
    } catch (e) {
      console.error("Failed to load students:", e);
    }
  };

  const loadVideos = async () => {
    setLoading(true);
    try {
      let url = `/admin/videos?search=${encodeURIComponent(search)}`;
      if (selectedCategory !== "all") {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      const res = await apiGet<{ videos: VideoItem[]; stats: VideoStats }>(url);
      setVideos(res.videos || []);
      if (res.stats) setStats(res.stats);
    } catch (err: any) {
      console.error("Failed to load videos:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingVideo(null);
    setSourceType("link");
    setTitle("");
    setDescription("");
    setCategory("General");
    setDuration("30m");
    setVideoUrl("");
    setTags("");
    setAssignmentMode("all");
    setFormSelectedStudents([]);
    setFormStudentSearch("");
    setSelectedFile(null);
    setShowModal(true);
  };

  const openEditModal = (video: VideoItem) => {
    setEditingVideo(video);
    setSourceType(video.sourceType || "link");
    setTitle(video.title);
    setDescription(video.description || "");
    setCategory(video.category || "General");
    setDuration(video.duration || "30m");
    setVideoUrl(video.originalUrl || video.embedUrl || "");
    setTags(Array.isArray(video.tags) ? video.tags.join(", ") : "");
    if (video.assignedTo === "all") {
      setAssignmentMode("all");
      setFormSelectedStudents([]);
    } else {
      setAssignmentMode("custom");
      setFormSelectedStudents(Array.isArray(video.assignedTo) ? video.assignedTo : [video.assignedTo].filter(Boolean));
    }
    setFormStudentSearch("");
    setSelectedFile(null);
    setShowModal(true);
  };

  const openAssignModal = (video: VideoItem) => {
    setAssigningVideo(video);
    setAssignSearch("");
    if (video.assignedTo === "all") {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(Array.isArray(video.assignedTo) ? video.assignedTo : [video.assignedTo].filter(Boolean));
    }
  };

  const saveQuickAssignments = async (mode: "all" | "custom") => {
    if (!assigningVideo) return;
    setSavingAssign(true);
    try {
      const assignedValue = mode === "all" ? "all" : selectedStudentIds;
      await apiPut(`/admin/videos/${assigningVideo.id}`, {
        assignedTo: assignedValue,
      });
      showToast(mode === "all" ? "Assigned to all enrolled students." : `Assigned to ${selectedStudentIds.length} students.`);
      setAssigningVideo(null);
      loadVideos();
    } catch (err: any) {
      alert(err?.message || "Failed to update assignments.");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a video title.");
      return;
    }

    const finalAssignedTo = assignmentMode === "all" ? "all" : formSelectedStudents;

    setSubmitting(true);
    try {
      if (editingVideo) {
        // Edit video
        await apiPut(`/admin/videos/${editingVideo.id}`, {
          title,
          description,
          category,
          duration,
          videoUrl,
          sourceType,
          assignedTo: finalAssignedTo,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        });
        showToast("Video updated successfully.");
      } else {
        // Create video
        if (sourceType === "file") {
          if (!selectedFile) {
            alert("Please select an MP4 or WebM video file to upload.");
            setSubmitting(false);
            return;
          }
          const formData = new FormData();
          formData.append("sourceType", "file");
          formData.append("title", title);
          formData.append("description", description);
          formData.append("category", category);
          formData.append("duration", duration);
          formData.append("assignedTo", typeof finalAssignedTo === "string" ? finalAssignedTo : finalAssignedTo.join(","));
          formData.append("tags", tags);
          formData.append("file", selectedFile);

          const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";
          const res = await fetch(`${API_BASE}/api/admin/videos`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to upload video file.");
          }
        } else {
          if (!videoUrl.trim()) {
            alert("Please enter a valid YouTube, Vimeo, or video stream link.");
            setSubmitting(false);
            return;
          }
          await apiPost("/admin/videos", {
            sourceType: "link",
            title,
            description,
            category,
            duration,
            videoUrl,
            assignedTo: finalAssignedTo,
            tags: tags.split(",").map(t => t.trim()).filter(Boolean),
          });
        }
        showToast("New video lecture published.");
      }

      setShowModal(false);
      loadVideos();
    } catch (err: any) {
      alert(err.message || "Failed to save video.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, videoTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${videoTitle}"? This cannot be undone.`)) {
      return;
    }
    try {
      await apiDelete(`/admin/videos/${id}`);
      showToast("Video deleted successfully.");
      loadVideos();
    } catch (err: any) {
      alert(err.message || "Failed to delete video.");
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredVideos = videos.filter((v) => {
    if (selectedSource === "file" && v.sourceType !== "file") return false;
    if (selectedSource === "link" && v.sourceType !== "link") return false;
    return true;
  });

  return (
    <div className="admin-videos-container">
      {/* Toast */}
      {toast && (
        <div className="admin-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="admin-videos-header">
        <div>
          <span className="section-eyebrow">LECTURE MANAGEMENT &amp; DRM</span>
          <h1>Video Classes &amp; Lectures</h1>
          <p>Upload course video files or embed video links with strict anti-recording DRM protection.</p>
        </div>
        <div className="header-actions">
          <button className="btn-add-video" onClick={openCreateModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Upload Video / Add Link
          </button>
        </div>
      </div>

      {/* KPI Cards (Compact Row Layout) */}
      <div className="videos-stats-grid">
        <div className="v-stat-card theme-blue">
          <div className="v-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <div className="v-stat-content">
            <span className="v-stat-label">Total Video Lectures</span>
            <strong className="v-stat-val">{stats.total}</strong>
            <small className="v-stat-help">Published in library</small>
          </div>
        </div>

        <div className="v-stat-card theme-emerald">
          <div className="v-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div className="v-stat-content">
            <span className="v-stat-label">File Uploads</span>
            <strong className="v-stat-val">{stats.fileUploads}</strong>
            <small className="v-stat-help">Direct MP4/WebM files</small>
          </div>
        </div>

        <div className="v-stat-card theme-purple">
          <div className="v-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div className="v-stat-content">
            <span className="v-stat-label">External Links</span>
            <strong className="v-stat-val">{stats.links}</strong>
            <small className="v-stat-help">YouTube / Vimeo / Cloud</small>
          </div>
        </div>

        <div className="v-stat-card theme-teal">
          <div className="v-stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div className="v-stat-content">
            <span className="v-stat-label">Student Views</span>
            <strong className="v-stat-val">{stats.totalViews}</strong>
            <small className="v-stat-help">Total playback sessions</small>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="videos-toolbar">
        <div className="search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by title, description or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="clear-btn" onClick={() => setSearch("")}>✕</button>}
        </div>

        <div className="filters-group">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Subjects / Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Source Types</option>
            <option value="file">File Uploads Only</option>
            <option value="link">Video Links Only</option>
          </select>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="videos-loading">
          <div className="spinner" />
          <p>Loading video library...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="videos-empty">
          <div className="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <h3>No Video Lectures Found</h3>
          <p>Upload video files or paste video links to build your student class curriculum.</p>
          <button className="btn-add-video" onClick={openCreateModal}>
            Upload First Video
          </button>
        </div>
      ) : (
        <div className="videos-grid">
          {filteredVideos.map((video) => (
            <div key={video.id} className="video-card">
              {/* Video Thumbnail / Top Strip */}
              <div className="video-card-thumb" onClick={() => setPreviewVideo(video)}>
                <div className="thumb-placeholder">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <div className="thumb-overlay">
                  <span className="play-badge">▶ Preview</span>
                </div>
                <span className="duration-badge">{video.duration}</span>
                <span className={`provider-badge provider-${video.provider || "direct"}`}>
                  {video.sourceType === "file" ? "MP4 Upload" : (video.provider?.toUpperCase() || "LINK")}
                </span>
              </div>

              {/* Card Body */}
              <div className="video-card-body">
                <div className="video-meta-top">
                  <span className="category-chip">{video.category}</span>
                  <span className="assigned-chip">
                    {video.assignedTo === "all" ? "All Students" : "Assigned Batch"}
                  </span>
                </div>
                <h3 className="video-title" title={video.title}>{video.title}</h3>
                {video.description && (
                  <p className="video-desc">{video.description}</p>
                )}

                <div className="video-card-footer">
                  <div className="video-stats">
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      {video.viewCount} views
                    </span>
                    {video.fileSize ? <span>• {formatFileSize(video.fileSize)}</span> : null}
                  </div>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-card-action assign"
                      onClick={() => openAssignModal(video)}
                      title="Assign Students"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action edit"
                      onClick={() => openEditModal(video)}
                      title="Edit Video"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action delete"
                      onClick={() => handleDelete(video.id, video.title)}
                      title="Delete Video"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Create/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{editingVideo ? "Edit Video Lecture" : "Upload Video / Add Link"}</h2>
                <p>Assign video lectures to student classes with DRM recording protection.</p>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {/* Mode Selector */}
              {!editingVideo && (
                <div className="source-type-selector">
                  <button
                    type="button"
                    className={`source-tab ${sourceType === "link" ? "active" : ""}`}
                    onClick={() => setSourceType("link")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    Add Video Link (YouTube / Vimeo / Cloud)
                  </button>
                  <button
                    type="button"
                    className={`source-tab ${sourceType === "file" ? "active" : ""}`}
                    onClick={() => setSourceType("file")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload Video File (MP4, WebM)
                  </button>
                </div>
              )}

              {/* Source Input */}
              {sourceType === "link" ? (
                <div className="form-group">
                  <label>Video URL / Stream Link *</label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/... or https://domain.com/video.mp4"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    required
                  />
                  <small className="form-hint">Supports YouTube, Vimeo, direct MP4 URLs, and cloud video streams.</small>
                </div>
              ) : (
                <div className="form-group">
                  <label>Upload Video File (MP4, WebM) *</label>
                  <div className="file-upload-box">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      required={!editingVideo}
                    />
                    <div className="file-upload-label">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <strong>{selectedFile ? selectedFile.name : "Click or drag video file here"}</strong>
                      <small>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : "Allowed formats: MP4, WebM, MOV, OGG"}</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Duration Row */}
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Lecture Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Quantitative Aptitude Masterclass - Chapter 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 45m or 1h 20m"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>

              {/* Category & Assignment Row */}
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Subject / Exam Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Student Assignment</label>
                  <select
                    value={assignmentMode}
                    onChange={(e) => setAssignmentMode(e.target.value as "all" | "custom")}
                  >
                    <option value="all">All Enrolled Candidates</option>
                    <option value="custom">Select Specific Candidates</option>
                  </select>
                </div>
              </div>

              {/* Interactive Student Selector in Form */}
              {assignmentMode === "custom" && (
                <div className="form-student-picker-box">
                  <div className="picker-header">
                    <span className="picker-title">Select Assigned Candidates ({formSelectedStudents.length} selected)</span>
                    {formSelectedStudents.length > 0 && (
                      <button
                        type="button"
                        className="picker-clear-btn"
                        onClick={() => setFormSelectedStudents([])}
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="picker-search-wrap">
                    <input
                      type="text"
                      placeholder="Filter candidates by name, user ID, email..."
                      value={formStudentSearch}
                      onChange={(e) => setFormStudentSearch(e.target.value)}
                    />
                  </div>

                  {/* Select All Toggle */}
                  <label className="picker-select-all">
                    <input
                      type="checkbox"
                      checked={
                        students.length > 0 &&
                        students
                          .filter((s) =>
                            `${s.name} ${s.userId} ${s.email || ""}`
                              .toLowerCase()
                              .includes(formStudentSearch.toLowerCase())
                          )
                          .every((s) => formSelectedStudents.includes(s.userId))
                      }
                      onChange={(e) => {
                        const visible = students.filter((s) =>
                          `${s.name} ${s.userId} ${s.email || ""}`
                            .toLowerCase()
                            .includes(formStudentSearch.toLowerCase())
                        );
                        if (e.target.checked) {
                          const combined = Array.from(new Set([...formSelectedStudents, ...visible.map((s) => s.userId)]));
                          setFormSelectedStudents(combined);
                        } else {
                          const visibleIds = new Set(visible.map((s) => s.userId));
                          setFormSelectedStudents(formSelectedStudents.filter((id) => !visibleIds.has(id)));
                        }
                      }}
                    />
                    <span>Select all visible candidates</span>
                  </label>

                  {/* Candidate Row List */}
                  <div className="picker-students-list">
                    {students
                      .filter((s) =>
                        `${s.name} ${s.userId} ${s.email || ""}`
                          .toLowerCase()
                          .includes(formStudentSearch.toLowerCase())
                      )
                      .map((student) => {
                        const isChecked = formSelectedStudents.includes(student.userId);
                        return (
                          <label key={student.userId} className={`picker-student-item ${isChecked ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormSelectedStudents([...formSelectedStudents, student.userId]);
                                } else {
                                  setFormSelectedStudents(formSelectedStudents.filter((id) => id !== student.userId));
                                }
                              }}
                            />
                            <div className="student-avatar-mini">{student.name.charAt(0).toUpperCase()}</div>
                            <div className="student-info-col">
                              <strong>{student.name}</strong>
                              <small>{student.userId} {student.email ? `• ${student.email}` : ""}</small>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="form-group">
                <label>Description / Lecture Notes</label>
                <textarea
                  rows={3}
                  placeholder="Key topics covered, timestamps, and lecture objectives..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Banking, Speed Math, Live Class, 2026 Batch"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              {/* DRM Protection Notice */}
              <div className="drm-notice-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>
                  <strong>Anti-Capture Protected:</strong> This video will play inside the student portal with screen recording lockout and forensic watermark burning.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : editingVideo ? "Save Changes" : "Publish Video Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Standalone Quick Assign Students Modal */}
      {assigningVideo && (
        <div className="modal-backdrop" onClick={() => setAssigningVideo(null)}>
          <div className="video-modal assign-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="section-eyebrow">LECTURE ACCESS PERMISSIONS</span>
                <h2>Assign Video: {assigningVideo.title}</h2>
                <p>Select which candidates can view this video lecture in their Classes portal.</p>
              </div>
              <button className="modal-close" onClick={() => setAssigningVideo(null)}>✕</button>
            </div>

            <div className="assign-modal-body">
              <div className="assign-mode-toggle">
                <button
                  type="button"
                  className={`assign-toggle-btn ${selectedStudentIds.length === 0 ? "active" : ""}`}
                  onClick={() => setSelectedStudentIds([])}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                  </svg>
                  All Enrolled Candidates
                </button>
                <button
                  type="button"
                  className={`assign-toggle-btn ${selectedStudentIds.length > 0 ? "active" : ""}`}
                  onClick={() => {
                    if (selectedStudentIds.length === 0 && students.length > 0) {
                      setSelectedStudentIds([students[0].userId]);
                    }
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  Specific Candidates ({selectedStudentIds.length})
                </button>
              </div>

              {selectedStudentIds.length > 0 && (
                <div className="form-student-picker-box">
                  <div className="picker-search-wrap">
                    <input
                      type="text"
                      placeholder="Search candidates by name, user ID, email..."
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                    />
                  </div>

                  <label className="picker-select-all">
                    <input
                      type="checkbox"
                      checked={
                        students.length > 0 &&
                        students
                          .filter((s) =>
                            `${s.name} ${s.userId} ${s.email || ""}`
                              .toLowerCase()
                              .includes(assignSearch.toLowerCase())
                          )
                          .every((s) => selectedStudentIds.includes(s.userId))
                      }
                      onChange={(e) => {
                        const visible = students.filter((s) =>
                          `${s.name} ${s.userId} ${s.email || ""}`
                            .toLowerCase()
                            .includes(assignSearch.toLowerCase())
                        );
                        if (e.target.checked) {
                          const combined = Array.from(new Set([...selectedStudentIds, ...visible.map((s) => s.userId)]));
                          setSelectedStudentIds(combined);
                        } else {
                          const visibleIds = new Set(visible.map((s) => s.userId));
                          setSelectedStudentIds(selectedStudentIds.filter((id) => !visibleIds.has(id)));
                        }
                      }}
                    />
                    <span>Select all visible candidates</span>
                  </label>

                  <div className="picker-students-list">
                    {students
                      .filter((s) =>
                        `${s.name} ${s.userId} ${s.email || ""}`
                          .toLowerCase()
                          .includes(assignSearch.toLowerCase())
                      )
                      .map((student) => {
                        const isChecked = selectedStudentIds.includes(student.userId);
                        return (
                          <label key={student.userId} className={`picker-student-item ${isChecked ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds([...selectedStudentIds, student.userId]);
                                } else {
                                  setSelectedStudentIds(selectedStudentIds.filter((id) => id !== student.userId));
                                }
                              }}
                            />
                            <div className="student-avatar-mini">{student.name.charAt(0).toUpperCase()}</div>
                            <div className="student-info-col">
                              <strong>{student.name}</strong>
                              <small>{student.userId} {student.email ? `• ${student.email}` : ""}</small>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ padding: "16px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setAssigningVideo(null)}
                disabled={savingAssign}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={() => saveQuickAssignments(selectedStudentIds.length === 0 ? "all" : "custom")}
                disabled={savingAssign}
              >
                {savingAssign ? "Saving..." : selectedStudentIds.length === 0 ? "Assign to All Students" : `Assign to ${selectedStudentIds.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Screen Playback Preview Modal */}
      {previewVideo && (
        <div className="modal-backdrop" onClick={() => setPreviewVideo(null)}>
          <div className="video-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="player-header">
              <div className="player-title-wrap">
                <span className="player-badge">{previewVideo.category}</span>
                <h3>{previewVideo.title}</h3>
              </div>
              <button className="player-close" onClick={() => setPreviewVideo(null)}>✕</button>
            </div>

            <div className="player-screen-wrap">
              {previewVideo.sourceType === "file" || previewVideo.provider === "direct" || previewVideo.provider === "local" ? (
                <video
                  src={getMediaUrl(previewVideo.videoUrl || previewVideo.embedUrl)}
                  controls
                  controlsList="nodownload"
                  autoPlay
                  className="native-video-screen"
                >
                  Your browser does not support HTML5 video playback.
                </video>
              ) : (
                <iframe
                  src={getMediaUrl(previewVideo.embedUrl || previewVideo.videoUrl)}
                  title={previewVideo.title}
                  className="iframe-video-screen"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {previewVideo.description && (
              <div className="player-footer">
                <p>{previewVideo.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVideos;

