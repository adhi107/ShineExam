import os

# ==============================================================================
# 1. Patch CurrentAffairsHub.tsx (Mobile PDF embed with object, touch scroll, and native reader button)
# ==============================================================================
with open('frontend/src/components/CurrentAffairs/CurrentAffairsHub.tsx', 'r', encoding='utf-8') as f:
    ca_text = f.read()

target_ca_iframe = '''              ) : previewDoc.url.toLowerCase().endsWith(".pdf") || previewDoc.url.includes("pdf") ? (
                <iframe
                  src={`${docBlobUrl || previewDoc.url}#view=FitH&toolbar=1&navpanes=0`}
                  title={previewDoc.name}
                  className="ca-doc-preview-iframe"
                  tabIndex={0}
                  style={{ border: "none", width: "100%", height: "100%", minHeight: "100%", background: "#525659" }}
                />'''

replace_ca_iframe = '''              ) : previewDoc.url.toLowerCase().endsWith(".pdf") || previewDoc.url.includes("pdf") ? (
                <div className="ca-pdf-embed-wrapper">
                  <div className="ca-mobile-pdf-bar">
                    <span>💡 Mobile PDF View:</span>
                    <a
                      href={docBlobUrl || previewDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ca-mobile-pdf-open-btn"
                    >
                      Open Full Reader ↗
                    </a>
                  </div>
                  <object
                    data={`${docBlobUrl || previewDoc.url}#view=FitH&toolbar=1&navpanes=0`}
                    type="application/pdf"
                    className="ca-doc-preview-iframe"
                  >
                    <iframe
                      src={`${docBlobUrl || previewDoc.url}#view=FitH&toolbar=1&navpanes=0`}
                      title={previewDoc.name}
                      className="ca-doc-preview-iframe"
                      tabIndex={0}
                      scrolling="yes"
                    />
                  </object>
                </div>'''

if target_ca_iframe in ca_text:
    ca_text = ca_text.replace(target_ca_iframe, replace_ca_iframe, 1)
    with open('frontend/src/components/CurrentAffairs/CurrentAffairsHub.tsx', 'w', encoding='utf-8', newline='') as f:
        f.write(ca_text)
    print("1. Patched CurrentAffairsHub.tsx PDF embed successfully")
else:
    print("Warning: target_ca_iframe not found")

# ==============================================================================
# 2. Patch CurrentAffairsHub.css (Add ca-pdf-embed-wrapper, ca-mobile-pdf-bar, fix touch scrolling)
# ==============================================================================
with open('frontend/src/components/CurrentAffairs/CurrentAffairsHub.css', 'r', encoding='utf-8') as f:
    cacss_text = f.read()

target_cacss_body = '''.ca-doc-preview-body {
  flex: 1 1 auto;
  padding: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y pinch-zoom;
  background: #525659;
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
  min-height: 0;
  width: 100%;
}'''

replace_cacss_body = '''.ca-pdf-embed-wrapper {
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ca-mobile-pdf-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #1e293b;
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.ca-mobile-pdf-open-btn {
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 4px 10px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 700;
  transition: all 0.15s ease;
}

.ca-mobile-pdf-open-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  color: #ffffff;
}

.ca-doc-preview-body {
  flex: 1 1 auto;
  padding: 0;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: auto !important;
  background: #525659;
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
  min-height: 0;
  width: 100%;
}'''

if target_cacss_body in cacss_text:
    cacss_text = cacss_text.replace(target_cacss_body, replace_cacss_body, 1)
    with open('frontend/src/components/CurrentAffairs/CurrentAffairsHub.css', 'w', encoding='utf-8', newline='') as f:
        f.write(cacss_text)
    print("2. Patched CurrentAffairsHub.css touch scrolling successfully")
else:
    print("Warning: target_cacss_body not found")


# ==============================================================================
# 3. Patch DocumentManagement.tsx (Import buildUrl, add previewDoc state, add View button and Preview Modal)
# ==============================================================================
with open('frontend/src/components/DocumentManagement.tsx', 'r', encoding='utf-8') as f:
    dm_text = f.read()

# Replace import
target_dm_import = 'import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";'
replace_dm_import = 'import { apiDelete, apiGet, apiPost, apiPostForm, buildUrl } from "../services/api";'
if target_dm_import in dm_text:
    dm_text = dm_text.replace(target_dm_import, replace_dm_import, 1)

# Add states in DocumentManagement component
target_dm_state = '  const [feedbackNotice, setFeedbackNotice] = useState("");'
replace_dm_state = '''  const [feedbackNotice, setFeedbackNotice] = useState("");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [docBlobUrl, setDocBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!previewDoc) {
      if (docBlobUrl) {
        URL.revokeObjectURL(docBlobUrl);
      }
      setDocBlobUrl(null);
      setLoadingPreview(false);
      return;
    }

    let active = true;
    setLoadingPreview(true);

    fetch(buildUrl(`/admin/documents/${previewDoc.id}/view`), {
      headers: {
        'X-Tenant-Id': sessionStorage.getItem('tenantId') || 'default',
        'X-User-Id': sessionStorage.getItem('userId') || 'admin'
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Could not load document preview");
        return res.blob();
      })
      .then(blob => {
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        setDocBlobUrl(objectUrl);
        setLoadingPreview(false);
      })
      .catch(err => {
        if (!active) return;
        console.error("Preview error:", err);
        setLoadingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [previewDoc]);

  const handleDownload = (doc: Doc) => {
    const url = buildUrl(`/admin/documents/${doc.id}/download`);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalName || `${doc.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };'''

if target_dm_state in dm_text:
    dm_text = dm_text.replace(target_dm_state, replace_dm_state, 1)

# Add "View" button to doc-row-actions
target_actions = '''              <div className="doc-row-actions">
                <button
                  type="button"
                  className="btn-doc-assign"
                  onClick={() => openAssign(doc)}
                >
                  Assign
                </button>'''

replace_actions = '''              <div className="doc-row-actions">
                <button
                  type="button"
                  className="btn-doc-view"
                  onClick={() => setPreviewDoc(doc)}
                  title="View document"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View
                </button>
                <button
                  type="button"
                  className="btn-doc-assign"
                  onClick={() => openAssign(doc)}
                >
                  Assign
                </button>'''

if target_actions in dm_text:
    dm_text = dm_text.replace(target_actions, replace_actions, 1)

# Add Document Preview Modal before the closing tag of DocumentManagement
target_closing = '      {/* Candidate / Batch Assignment Modal */}'
replace_modal = '''      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="doc-preview-modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="doc-preview-modal-card" onClick={e => e.stopPropagation()}>
            <header className="doc-preview-modal-header">
              <div className="doc-preview-header-info">
                <span className="doc-preview-pill">DOCUMENT PREVIEW</span>
                <h3 className="doc-preview-title" title={previewDoc.title}>{previewDoc.title}</h3>
                <span className="doc-preview-sub">{previewDoc.originalName} • {(previewDoc.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="doc-preview-header-actions">
                {docBlobUrl && (
                  <a
                    href={docBlobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="doc-preview-action-btn secondary"
                    title="Open in new tab"
                  >
                    Full Window ↗
                  </a>
                )}
                <button
                  type="button"
                  className="doc-preview-action-btn primary"
                  onClick={() => handleDownload(previewDoc)}
                  title="Download file"
                >
                  Download
                </button>
                <button
                  type="button"
                  className="doc-preview-close-btn"
                  onClick={() => setPreviewDoc(null)}
                  title="Close preview"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className="doc-preview-modal-body">
              {loadingPreview ? (
                <div className="doc-preview-loading">
                  <div className="shine-btn-spinner" style={{ width: 36, height: 36 }} />
                  <span>Loading Document Content...</span>
                </div>
              ) : docBlobUrl ? (
                (() => {
                  const ext = previewDoc.originalName.split('.').pop()?.toLowerCase() || '';
                  const isPdf = ext === 'pdf';
                  const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);

                  if (isPdf) {
                    return (
                      <div className="doc-preview-pdf-wrap">
                        <div className="ca-mobile-pdf-bar">
                          <span>💡 Mobile PDF View:</span>
                          <a href={docBlobUrl} target="_blank" rel="noreferrer" className="ca-mobile-pdf-open-btn">
                            Open Reader ↗
                          </a>
                        </div>
                        <object
                          data={`${docBlobUrl}#view=FitH&toolbar=1&navpanes=0`}
                          type="application/pdf"
                          className="doc-preview-frame"
                        >
                          <iframe
                            src={`${docBlobUrl}#view=FitH&toolbar=1&navpanes=0`}
                            title={previewDoc.title}
                            className="doc-preview-frame"
                            scrolling="yes"
                          />
                        </object>
                      </div>
                    );
                  }

                  if (isImg) {
                    return (
                      <div className="doc-preview-img-wrap">
                        <img src={docBlobUrl} alt={previewDoc.title} className="doc-preview-img" />
                      </div>
                    );
                  }

                  return (
                    <div className="doc-preview-fallback">
                      <div className="fallback-icon">📄</div>
                      <h4>{previewDoc.originalName}</h4>
                      <p>This file type cannot be previewed inline in browser. You can download it directly.</p>
                      <button
                        type="button"
                        className="doc-preview-action-btn primary"
                        onClick={() => handleDownload(previewDoc)}
                      >
                        Download File
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="doc-preview-fallback">
                  <p>Could not load preview. Please download the document directly.</p>
                  <button
                    type="button"
                    className="doc-preview-action-btn primary"
                    onClick={() => handleDownload(previewDoc)}
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Candidate / Batch Assignment Modal */}'''

if target_closing in dm_text:
    dm_text = dm_text.replace(target_closing, replace_modal, 1)

with open('frontend/src/components/DocumentManagement.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(dm_text)
print("3. Patched DocumentManagement.tsx successfully")

