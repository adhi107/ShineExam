from pathlib import Path
import re

path = Path("frontend/src/components/ParserPreviewModal.tsx")
content = path.read_text(encoding="utf-8")

# Update header title wrap
old_header = '''        {/* Modal Header */}
        <div className="parser-modal-header">
          <div className="parser-modal-title">
            <span>✨ AI Multimodal Document Parser Preview</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 400 }}>({filename})</span>
          </div>
          <button type="button" className="parser-modal-close-btn" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>'''

new_header = '''        {/* Modal Header */}
        <div className="parser-modal-header">
          <div className="parser-modal-title">
            <span className="parser-title-main">✨ AI Document Parser Preview</span>
            {filename && <span className="parser-title-filename" title={filename}>({filename})</span>}
          </div>
          <button type="button" className="parser-modal-close-btn" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>'''

assert old_header in content, "Could not match header in ParserPreviewModal.tsx"
content = content.replace(old_header, new_header, 1)

# Update footer structure
old_footer = '''        {/* Footer */}
        <div className="parser-modal-footer">
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            <span>
              Ready to import <strong>{totalQuestionsCount}</strong> questions across <strong>{sections.length}</strong> section(s).
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="secondary-btn" onClick={onClose} style={{ padding: '0.5rem 1.25rem' }}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => onApprove(questions)}
              style={{ padding: '0.5rem 1.5rem', fontWeight: 700 }}
            >
              ✨ Populate Test Form ({totalQuestionsCount} Questions)
            </button>
          </div>
        </div>'''

new_footer = '''        {/* Footer */}
        <div className="parser-modal-footer">
          <div className="parser-footer-summary">
            <span>
              Ready to import <strong>{totalQuestionsCount}</strong> questions across <strong>{sections.length}</strong> section(s).
            </span>
          </div>
          <div className="parser-footer-actions">
            <button type="button" className="secondary-btn parser-footer-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-btn parser-footer-approve"
              onClick={() => onApprove(questions)}
            >
              ✨ Import {totalQuestionsCount} Questions
            </button>
          </div>
        </div>'''

assert old_footer in content, "Could not match footer in ParserPreviewModal.tsx"
content = content.replace(old_footer, new_footer, 1)

path.write_text(content, encoding="utf-8")
print("SUCCESS: ParserPreviewModal.tsx updated!")
