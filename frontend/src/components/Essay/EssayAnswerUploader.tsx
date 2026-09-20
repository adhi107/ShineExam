import React, { useState, useRef, useEffect, useCallback } from "react";
import { apiPostForm } from "../../services/api";
import "./EssayAnswerUploader.css";

export interface EssayAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  extension?: string;
  page?: number;
  rotation?: number; // 0, 90, 180, 270
}

export interface EssayAnswerValue {
  textAnswer: string;
  attachments: EssayAttachment[];
}

interface EssayAnswerUploaderProps {
  questionId: string | number;
  attemptId?: string;
  userId?: string;
  value: string | EssayAnswerValue;
  onChange: (value: EssayAnswerValue | string) => void;
  wordLimit?: number;
  maxFileSizeMb?: number;
  allowedFormats?: string[];
  instructions?: string;
  disabled?: boolean;
}

export const EssayAnswerUploader: React.FC<EssayAnswerUploaderProps> = ({
  questionId,
  attemptId = "current",
  userId,
  value,
  onChange,
  wordLimit,
  maxFileSizeMb = 25,
  allowedFormats = ["pdf", "jpg", "jpeg", "png", "webp", "docx", "doc"],
  instructions,
  disabled = false,
}) => {
  // Parse incoming value
  const parsedValue: EssayAnswerValue = typeof value === "object" && value !== null
    ? {
        textAnswer: value.textAnswer || "",
        attachments: Array.isArray(value.attachments) ? value.attachments : [],
      }
    : {
        textAnswer: typeof value === "string" ? value : "",
        attachments: [],
      };

  const [textAnswer, setTextAnswer] = useState<string>(parsedValue.textAnswer);
  const [attachments, setAttachments] = useState<EssayAttachment[]>(parsedValue.attachments);
  const [activeTab, setActiveTab] = useState<"both" | "upload" | "type">("both");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<EssayAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes (e.g. question switch)
  useEffect(() => {
    const nextText = typeof value === "object" && value !== null ? value.textAnswer || "" : typeof value === "string" ? value : "";
    const nextAtts = typeof value === "object" && value !== null && Array.isArray(value.attachments) ? value.attachments : [];
    setTextAnswer(nextText);
    setAttachments(nextAtts);
    setErrorMessage(null);
  }, [questionId]);

  // Notify parent of state changes
  const emitChange = useCallback((newText: string, newAtts: EssayAttachment[]) => {
    onChange({
      textAnswer: newText,
      attachments: newAtts,
    });
  }, [onChange]);

  // Word count calculation
  const wordCount = textAnswer.trim() ? textAnswer.trim().split(/\s+/).length : 0;
  const charCount = textAnswer.length;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setTextAnswer(next);
    emitChange(next, attachments);
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    setErrorMessage(null);
    setUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append("questionId", String(questionId));
      formData.append("attemptId", attemptId);
      if (userId) formData.append("userId", userId);

      let validCount = 0;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        
        // Validate format
        if (!allowedFormats.map(f => f.toLowerCase()).includes(ext)) {
          throw new Error(`File "${file.name}" has an unsupported format (.${ext}). Allowed: ${allowedFormats.join(", ").toUpperCase()}`);
        }

        // Validate size
        if (file.size > maxFileSizeMb * 1024 * 1024) {
          throw new Error(`File "${file.name}" exceeds the ${maxFileSizeMb}MB size limit.`);
        }

        formData.append("files", file);
        validCount++;
      }

      if (validCount === 0) {
        setUploading(false);
        return;
      }

      setUploadProgress(60);

      const res = await apiPostForm<{
        success: boolean;
        file?: EssayAttachment;
        files?: EssayAttachment[];
      }>("/answerer/attempts/upload-attachment", formData);

      setUploadProgress(100);

      const newUploadedFiles = res.files || (res.file ? [res.file] : []);
      if (newUploadedFiles.length > 0) {
        const updatedList = [
          ...attachments,
          ...newUploadedFiles.map((f, idx) => ({
            ...f,
            page: attachments.length + idx + 1,
            rotation: 0,
          }))
        ];
        setAttachments(updatedList);
        emitChange(textAnswer, updatedList);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorMessage(err.message || "Failed to upload document. Please check file format and try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const filtered = attachments.filter(a => a.id !== id).map((a, idx) => ({ ...a, page: idx + 1 }));
    setAttachments(filtered);
    emitChange(textAnswer, filtered);
    if (previewAttachment?.id === id) {
      setPreviewAttachment(null);
    }
  };

  const handleRotateAttachment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = attachments.map(a => {
      if (a.id === id) {
        const nextRotation = ((a.rotation || 0) + 90) % 360;
        return { ...a, rotation: nextRotation };
      }
      return a;
    });
    setAttachments(updated);
    emitChange(textAnswer, updated);
  };

  const handleMovePage = (index: number, direction: "up" | "down", e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= attachments.length) return;

    const list = [...attachments];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);

    const renumbered = list.map((a, idx) => ({ ...a, page: idx + 1 }));
    setAttachments(renumbered);
    emitChange(textAnswer, renumbered);
  };

  const isImageFile = (att: EssayAttachment) => {
    const ext = att.extension || att.name.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) || att.type.startsWith("image/");
  };

  const isPdfFile = (att: EssayAttachment) => {
    const ext = att.extension || att.name.split(".").pop()?.toLowerCase() || "";
    return ext === "pdf" || att.type.includes("pdf");
  };

  return (
    <div className="essay-uploader-container">
      {/* View/Input Mode Bar */}
      <div className="essay-mode-header">
        <div className="essay-mode-tabs">
          <button
            type="button"
            className={`essay-tab-btn ${activeTab === "both" ? "active" : ""}`}
            onClick={() => setActiveTab("both")}
          >
            📝 Typed + 📄 Handwritten Upload
          </button>
          <button
            type="button"
            className={`essay-tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            📄 Upload Answer Sheet ({attachments.length})
          </button>
          <button
            type="button"
            className={`essay-tab-btn ${activeTab === "type" ? "active" : ""}`}
            onClick={() => setActiveTab("type")}
          >
            ⌨️ Type Answer Only
          </button>
        </div>

        {/* Word / Page Counts Pill */}
        <div className="essay-status-pill">
          {attachments.length > 0 && (
            <span className="pill-item-pages">
              📄 {attachments.length} Page{attachments.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`pill-item-words ${wordLimit && wordCount > wordLimit ? "word-limit-exceeded" : ""}`}>
            ✍️ {wordCount} {wordLimit ? `/ ${wordLimit}` : ""} words
          </span>
        </div>
      </div>

      {/* Instructions if provided */}
      {instructions && (
        <div className="essay-instructions-box">
          <span className="essay-instructions-icon">📌</span>
          <div>
            <strong>Evaluation Guidelines:</strong> {instructions}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          1. HANDWRITTEN DOCUMENT UPLOAD SECTION
          ───────────────────────────────────────────────────────── */}
      {(activeTab === "both" || activeTab === "upload") && (
        <div className="essay-upload-section">
          {/* Dropzone */}
          <div
            className={`essay-dropzone ${dragOver ? "dragover" : ""} ${uploading ? "uploading" : ""} ${disabled ? "disabled" : ""}`}
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              accept={allowedFormats.map(f => `.${f}`).join(",")}
              onChange={(e) => handleFilesSelected(e.target.files)}
              disabled={disabled || uploading}
            />
            {/* Hidden mobile camera capture input */}
            <input
              ref={cameraInputRef}
              type="file"
              capture="environment"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleFilesSelected(e.target.files)}
              disabled={disabled || uploading}
            />

            <div className="essay-dropzone-icon">
              {uploading ? (
                <div className="essay-spinner" />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </div>

            <div className="essay-dropzone-text">
              <strong>{uploading ? "Uploading & Scanning Answer Sheets..." : "Drop handwritten answer sheets here, or browse"}</strong>
              <p>Supports multi-page scanned answer sheets, PDFs, and high-res photos</p>
            </div>

            {/* Quick Actions (Browse + Camera) */}
            <div className="essay-dropzone-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="essay-action-btn primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
              >
                📁 Select Documents / Photos
              </button>
              <button
                type="button"
                className="essay-action-btn camera"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled || uploading}
                title="Use phone camera to snap handwritten answer sheet"
              >
                📸 Snap Page with Camera
              </button>
            </div>

            {/* Format Chips */}
            <div className="essay-allowed-formats">
              <span>Accepted formats:</span>
              {allowedFormats.map(fmt => (
                <span key={fmt} className="format-badge">.{fmt.toUpperCase()}</span>
              ))}
              <span className="format-size-limit">(Max {maxFileSizeMb}MB per file)</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="essay-error-alert">
              <span>⚠️</span>
              <p>{errorMessage}</p>
              <button type="button" onClick={() => setErrorMessage(null)}>✕</button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              MULTI-PAGE ATTACHMENT TRAY & THUMBNAILS
              ───────────────────────────────────────────────────────── */}
          {attachments.length > 0 && (
            <div className="essay-attachments-tray">
              <div className="essay-tray-header">
                <h4>
                  <span>📑 Attached Answer Pages</span> ({attachments.length} Page{attachments.length !== 1 ? "s" : ""})
                </h4>
                <small>Drag or use arrows to reorder pages</small>
              </div>

              <div className="essay-pages-grid">
                {attachments.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className="essay-page-card"
                    onClick={() => setPreviewAttachment(att)}
                  >
                    <div className="essay-page-number">Page {att.page || idx + 1}</div>

                    {/* Thumbnail preview */}
                    <div className="essay-page-thumb-wrap">
                      {isImageFile(att) ? (
                        <img
                          src={att.url}
                          alt={`Page ${idx + 1}`}
                          className="essay-page-img"
                          style={{
                            transform: `rotate(${att.rotation || 0}deg)`,
                          }}
                        />
                      ) : isPdfFile(att) ? (
                        <div className="essay-pdf-placeholder">
                          <span className="pdf-icon">📕</span>
                          <span className="pdf-name">{att.name}</span>
                          <span className="pdf-view-tag">Click to Preview PDF</span>
                        </div>
                      ) : (
                        <div className="essay-doc-placeholder">
                          <span className="doc-icon">📄</span>
                          <span className="doc-name">{att.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer with Page Actions */}
                    <div className="essay-page-footer" onClick={(e) => e.stopPropagation()}>
                      <span className="essay-file-name" title={att.name}>
                        {att.name}
                      </span>

                      <div className="essay-card-controls">
                        {/* Reorder Up */}
                        {idx > 0 && (
                          <button
                            type="button"
                            className="btn-page-ctrl"
                            onClick={(e) => handleMovePage(idx, "up", e)}
                            title="Move Page Up"
                          >
                            ◀
                          </button>
                        )}
                        {/* Reorder Down */}
                        {idx < attachments.length - 1 && (
                          <button
                            type="button"
                            className="btn-page-ctrl"
                            onClick={(e) => handleMovePage(idx, "down", e)}
                            title="Move Page Down"
                          >
                            ▶
                          </button>
                        )}
                        {/* Rotate button for images */}
                        {isImageFile(att) && (
                          <button
                            type="button"
                            className="btn-page-ctrl"
                            onClick={(e) => handleRotateAttachment(att.id, e)}
                            title="Rotate 90°"
                          >
                            🔄
                          </button>
                        )}
                        {/* Zoom Preview */}
                        <button
                          type="button"
                          className="btn-page-ctrl"
                          onClick={() => setPreviewAttachment(att)}
                          title="Zoom / Preview"
                        >
                          🔍
                        </button>
                        {/* Remove */}
                        {!disabled && (
                          <button
                            type="button"
                            className="btn-page-ctrl delete"
                            onClick={() => handleRemoveAttachment(att.id)}
                            title="Remove Page"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          2. TYPED ESSAY TEXT EDITOR
          ───────────────────────────────────────────────────────── */}
      {(activeTab === "both" || activeTab === "type") && (
        <div className="essay-type-section">
          <div className="essay-editor-toolbar">
            <span className="editor-label">✍️ Typed Response (Optional or Supplemental)</span>
            <span className="editor-metrics">
              <span>{charCount} characters</span>
              <span>•</span>
              <strong className={wordLimit && wordCount > wordLimit ? "limit-warning" : ""}>
                {wordCount} words
              </strong>
            </span>
          </div>

          <textarea
            className="essay-textarea"
            value={textAnswer}
            onChange={handleTextChange}
            placeholder="Type your essay response here, or structure key points, introduction, and conclusion..."
            rows={activeTab === "type" ? 14 : 7}
            disabled={disabled}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          3. FULL-SIZE DOCUMENT / IMAGE PREVIEW MODAL
          ───────────────────────────────────────────────────────── */}
      {previewAttachment && (
        <div className="essay-preview-modal-overlay" onClick={() => setPreviewAttachment(null)}>
          <div className="essay-preview-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="essay-preview-header">
              <div className="preview-title-info">
                <h3>{previewAttachment.name}</h3>
                <span>
                  {previewAttachment.page ? `Page ${previewAttachment.page} • ` : ""}
                  {(previewAttachment.size / 1024).toFixed(1)} KB
                </span>
              </div>

              <div className="preview-header-actions">
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="preview-btn-download"
                  download={previewAttachment.name}
                >
                  ⬇️ Download
                </a>
                <button
                  type="button"
                  className="preview-btn-close"
                  onClick={() => setPreviewAttachment(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="essay-preview-body">
              {isImageFile(previewAttachment) ? (
                <div className="preview-image-container">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="preview-full-img"
                    style={{
                      transform: `rotate(${previewAttachment.rotation || 0}deg)`,
                    }}
                  />
                </div>
              ) : isPdfFile(previewAttachment) ? (
                <iframe
                  src={`${previewAttachment.url}#toolbar=0`}
                  title={previewAttachment.name}
                  className="preview-pdf-frame"
                />
              ) : (
                <div className="preview-generic-file">
                  <span>📄</span>
                  <p>Preview not available for this file type.</p>
                  <a href={previewAttachment.url} download className="essay-action-btn primary">
                    Download & Open File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EssayAnswerUploader;
