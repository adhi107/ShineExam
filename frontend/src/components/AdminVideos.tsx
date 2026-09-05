import React, { useState, useEffect } from "react";
import { apiGet, apiPost, apiPut, apiDelete, buildUrl, getMediaUrl, getAuthHeaders } from "../services/api";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
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
  const [videoDurationDetected, setVideoDurationDetected] = useState<string>("");
  const [videoThumbnailSnapshot, setVideoThumbnailSnapshot] = useState<string | null>(null);

  // Playback Preview Modal
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  // In-Screen Confirm Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    variant?: DialogVariant;
    icon?: string;
    onConfirm: () => void;
  } | null>(null);

  // High-Speed Upload State & Live Metrics
  const [toast, setToast] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>("");
  const [uploadEta, setUploadEta] = useState<string>("");
  const [uploadChunkInfo, setUploadChunkInfo] = useState<string>("");
  const [uploadedBytesFormatted, setUploadedBytesFormatted] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

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

  // Extract video duration and snapshot thumbnail client-side
  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    setUploadProgress(0);
    setUploadSpeed("");
    setUploadEta("");
    setUploadChunkInfo("");
    setUploadedBytesFormatted("");

    // Auto-fill title if empty
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    try {
      const objUrl = URL.createObjectURL(file);
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      tempVideo.src = objUrl;
      tempVideo.muted = true;
      tempVideo.playsInline = true;

      tempVideo.onloadedmetadata = () => {
        const totalSec = Math.floor(tempVideo.duration);
        if (totalSec && !isNaN(totalSec) && isFinite(totalSec)) {
          const hrs = Math.floor(totalSec / 3600);
          const mins = Math.floor((totalSec % 3600) / 60);
          const secs = totalSec % 60;
          let formatted = "";
          if (hrs > 0) {
            formatted = `${hrs}h ${mins}m`;
          } else if (mins > 0) {
            formatted = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
          } else {
            formatted = `${secs}s`;
          }
          setDuration(formatted);
          setVideoDurationDetected(formatted);
        }

        // Seek to 1s to capture snapshot thumbnail
        tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 1) / 2);
      };

      tempVideo.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(tempVideo.videoWidth || 480, 480);
          canvas.height = Math.min(tempVideo.videoHeight || 270, 270);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            const thumbUrl = canvas.toDataURL("image/jpeg", 0.75);
            setVideoThumbnailSnapshot(thumbUrl);
          }
        } catch {
          // Canvas capture optional
        } finally {
          URL.revokeObjectURL(objUrl);
        }
      };

      tempVideo.onerror = () => {
        URL.revokeObjectURL(objUrl);
      };
    } catch {
      // Non-blocking metadata extraction
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
    setVideoDurationDetected("");
    setVideoThumbnailSnapshot(null);
    setUploadProgress(0);
    setUploadSpeed("");
    setUploadEta("");
    setUploadChunkInfo("");
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
    setVideoDurationDetected("");
    setVideoThumbnailSnapshot(null);
    setUploadProgress(0);
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

  // High-Speed Multi-Stream Parallel Chunked Uploader Engine
  const uploadVideoParallelChunks = async (
    file: File,
    meta: {
      title: string;
      description: string;
      category: string;
      duration: string;
      assignedTo: string | string[];
      tags: string;
    }
  ) => {
    const authHeaders = getAuthHeaders();
    const startTime = Date.now();
    let lastTime = Date.now();
    let lastLoadedTotal = 0;

    // 1. Initialize Chunk Session
    const initRes = await fetch(buildUrl("/admin/videos/upload-init"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
      }),
    });

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({ error: "Failed to initialize upload session." }));
      throw new Error(errData.error || "Failed to initialize upload session.");
    }

    const { sessionId, chunkSize = 5 * 1024 * 1024 } = await initRes.json();
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
    const chunkLoaded = new Array(totalChunks).fill(0);

    const updateLiveMetrics = () => {
      const currentTotalLoaded = chunkLoaded.reduce((a, b) => a + b, 0);
      const percent = Math.min(99, Math.round((currentTotalLoaded / file.size) * 100));
      setUploadProgress(percent);

      const now = Date.now();
      const elapsedTotalSec = (now - startTime) / 1000;
      const intervalSec = (now - lastTime) / 1000;

      if (intervalSec >= 0.3) {
        const deltaBytes = currentTotalLoaded - lastLoadedTotal;
        const currentSpeedBytesPerSec = intervalSec > 0 ? deltaBytes / intervalSec : (currentTotalLoaded / elapsedTotalSec);
        
        if (currentSpeedBytesPerSec > 0) {
          const speedMB = currentSpeedBytesPerSec / (1024 * 1024);
          setUploadSpeed(`${speedMB >= 1 ? speedMB.toFixed(1) : (currentSpeedBytesPerSec / 1024).toFixed(0)} ${speedMB >= 1 ? "MB/s" : "KB/s"}`);

          const remainingBytes = Math.max(0, file.size - currentTotalLoaded);
          const etaSec = Math.round(remainingBytes / currentSpeedBytesPerSec);
          if (etaSec > 60) {
            setUploadEta(`ETA: ${Math.floor(etaSec / 60)}m ${etaSec % 60}s`);
          } else {
            setUploadEta(`ETA: ${etaSec}s`);
          }
        }

        const loadedMB = (currentTotalLoaded / (1024 * 1024)).toFixed(1);
        const totalMB = (file.size / (1024 * 1024)).toFixed(1);
        setUploadedBytesFormatted(`${loadedMB} MB / ${totalMB} MB`);

        lastTime = now;
        lastLoadedTotal = currentTotalLoaded;
      }
    };

    // 2. Upload Individual Chunk with Auto-Retry
    const uploadSingleChunk = async (chunkIndex: number, retries = 3): Promise<void> => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const blobSlice = file.slice(start, end);

      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("chunkIndex", String(chunkIndex));
      formData.append("totalChunks", String(totalChunks));
      formData.append("chunk", blobSlice, `${file.name}.part${chunkIndex}`);

      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", buildUrl("/admin/videos/upload-chunk"));
        Object.entries(authHeaders).forEach(([k, v]) => {
          xhr.setRequestHeader(k, v);
        });

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            chunkLoaded[chunkIndex] = e.loaded;
            updateLiveMetrics();
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            chunkLoaded[chunkIndex] = blobSlice.size;
            updateLiveMetrics();
            resolve();
          } else {
            if (retries > 0) {
              setTimeout(() => {
                uploadSingleChunk(chunkIndex, retries - 1).then(resolve).catch(reject);
              }, 600);
            } else {
              reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed.`));
            }
          }
        };

        xhr.onerror = () => {
          if (retries > 0) {
            setTimeout(() => {
              uploadSingleChunk(chunkIndex, retries - 1).then(resolve).catch(reject);
            }, 600);
          } else {
            reject(new Error(`Network interruption on chunk ${chunkIndex + 1}.`));
          }
        };

        xhr.send(formData);
      });
    };

    // 3. Parallel Worker Pool (3 Concurrent Upload Streams)
    const CONCURRENCY = Math.min(3, totalChunks);
    let nextChunkIdx = 0;
    let completedChunks = 0;

    const worker = async (): Promise<void> => {
      while (nextChunkIdx < totalChunks) {
        const idx = nextChunkIdx++;
        setUploadChunkInfo(`Stream pipeline: Part ${idx + 1} of ${totalChunks}`);
        await uploadSingleChunk(idx);
        completedChunks++;
        setUploadChunkInfo(`Completed ${completedChunks} of ${totalChunks} parts`);
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    // 4. Finalize and assemble chunks into database record
    setUploadChunkInfo("Finalizing video & generating DRM streams...");
    setUploadProgress(100);

    const completeRes = await fetch(buildUrl("/admin/videos/upload-complete"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        sessionId,
        filename: file.name,
        totalChunks,
        title: meta.title,
        description: meta.description,
        category: meta.category,
        duration: meta.duration,
        assignedTo: meta.assignedTo,
        tags: meta.tags,
      }),
    });

    if (!completeRes.ok) {
      const errData = await completeRes.json().catch(() => ({ error: "Failed to finalize video assembly." }));
      throw new Error(errData.error || "Failed to finalize video assembly.");
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
        showToast("Video lecture updated successfully.");
      } else {
        // Create video
        if (sourceType === "file") {
          if (!selectedFile) {
            alert("Please select a video file to upload.");
            setSubmitting(false);
            return;
          }

          await uploadVideoParallelChunks(selectedFile, {
            title,
            description,
            category,
            duration,
            assignedTo: finalAssignedTo,
            tags,
          });

          showToast("Video lecture uploaded and published at high speed!");
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
          showToast("New video lecture published.");
        }
      }

      setShowModal(false);
      loadVideos();
    } catch (err: any) {
      console.error("Video save error:", err);
      alert(err.message || "Failed to save video.");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
      setUploadSpeed("");
      setUploadEta("");
      setUploadChunkInfo("");
      setUploadedBytesFormatted("");
    }
  };

  const handleDelete = (id: string, videoTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Video Lecture?",
      message: (
        <span>
          Are you sure you want to delete <strong>"{videoTitle}"</strong>? This action cannot be undone.
        </span>
      ),
      confirmText: "Yes, Delete Video",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiDelete(`/admin/videos/${id}`);
          showToast("Video deleted successfully.");
          loadVideos();
        } catch (err: any) {
          showToast(err.message || "Failed to delete video.");
        }
      },
    });
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
                      title="Assign Candidates"
                      aria-label="Assign Candidates"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action edit"
                      onClick={() => openEditModal(video)}
                      title="Edit Video Details"
                      aria-label="Edit Video Details"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-action delete"
                      onClick={() => handleDelete(video.id, video.title)}
                      title="Delete Video"
                      aria-label="Delete Video"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
                    Upload Video File (MP4, MKV, AVI &amp; more)
                  </button>
                </div>
              )}

              {/* Source Input */}
              {sourceType === "link" ? (
                <div className="form-group">
                  <label>Video URL / Stream Link *</label>
                  <input
                    type="url"
                    placeholder="YouTube, YouTube Shorts, Vimeo, or direct video URL"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    required
                  />
                  <small className="form-hint">Supports: YouTube (watch, shorts, live), Vimeo, direct MP4/WebM/MKV URLs, cloud video streams.</small>
                </div>
              ) : (
                <div className="form-group">
                  <div className="form-label-row">
                    <label>Upload Video File *</label>
                    {videoDurationDetected && (
                      <span className="auto-detect-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Detected Duration: {videoDurationDetected}
                      </span>
                    )}
                  </div>

                  {!selectedFile ? (
                    <div
                      className={`file-upload-box ${isDragOver ? "drag-active" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelection(e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,video/x-msvideo,video/x-flv,video/x-ms-wmv,video/3gpp,video/mpeg,.mp4,.webm,.ogg,.mov,.mkv,.avi,.flv,.wmv,.3gp,.m4v,.ts,.mpeg,.mpg"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileSelection(e.target.files[0]);
                          }
                        }}
                        required={!editingVideo}
                      />
                      <div className="file-upload-label">
                        <div className="upload-icon-pulse">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                        </div>
                        <strong>Click to browse or drag video file here</strong>
                        <small>MP4, WebM, MKV, MOV, AVI, FLV, WMV, 3GP, MPEG &amp; all formats (Up to 2 GB)</small>
                        <span className="turbo-badge">⚡ Turbo High-Speed Multi-Stream Upload Enabled</span>
                      </div>
                    </div>
                  ) : (
                    <div className="selected-video-preview-card">
                      <div className="preview-media-thumb">
                        {videoThumbnailSnapshot ? (
                          <img src={videoThumbnailSnapshot} alt="Video Snapshot" />
                        ) : (
                          <div className="thumb-fallback-icon">🎬</div>
                        )}
                        <span className="preview-play-icon">▶</span>
                      </div>
                      <div className="preview-file-details">
                        <strong className="file-name" title={selectedFile.name}>{selectedFile.name}</strong>
                        <div className="file-meta-pills">
                          <span className="meta-pill">{formatFileSize(selectedFile.size)}</span>
                          {videoDurationDetected && <span className="meta-pill duration">⏱️ {videoDurationDetected}</span>}
                          <span className="meta-pill high-speed">🚀 Fast Parallel Pipeline</span>
                        </div>
                      </div>
                      {!submitting && (
                        <button
                          type="button"
                          className="btn-change-file"
                          onClick={() => {
                            setSelectedFile(null);
                            setVideoThumbnailSnapshot(null);
                            setVideoDurationDetected("");
                          }}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  )}

                  {/* High-Speed Real-time Upload Progress Dashboard */}
                  {submitting && (
                    <div className="turbo-upload-dashboard">
                      <div className="turbo-top-row">
                        <div className="turbo-status-label">
                          <span className="live-pulse-dot" />
                          <strong>{uploadChunkInfo || "Uploading video streams..."}</strong>
                        </div>
                        <span className="turbo-percent">{uploadProgress}%</span>
                      </div>

                      <div className="turbo-progress-track">
                        <div
                          className="turbo-progress-fill"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>

                      <div className="turbo-metrics-row">
                        {uploadSpeed && (
                          <span className="turbo-metric-chip speed">
                            ⚡ {uploadSpeed}
                          </span>
                        )}
                        {uploadEta && (
                          <span className="turbo-metric-chip eta">
                            ⏱️ {uploadEta}
                          </span>
                        )}
                        {uploadedBytesFormatted && (
                          <span className="turbo-metric-chip bytes">
                            📊 {uploadedBytesFormatted}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
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
                  src={resolveVideoEmbedUrl(previewVideo.embedUrl || previewVideo.videoUrl || previewVideo.originalUrl)}
                  title={previewVideo.title}
                  className="iframe-video-screen"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
      {/* In-Screen Confirm Delete Modal */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default AdminVideos;

