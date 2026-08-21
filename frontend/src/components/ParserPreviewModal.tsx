import React, { useState } from 'react';
import './ParserPreviewModal.css';
import { VisualContentRenderer } from './VisualContentRenderer';

export interface ParsedQuestion {
  id: string;
  questionNumber?: number;
  type: 'mcq' | 'multiple' | 'text';
  question: string;
  context?: string;
  contextType?: 'table' | 'passage' | 'graph' | '';
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  negativeMarks?: number;
  chartData?: any;
  tableData?: any;
  imageReference?: string;
  visualReferences?: any[];
  groupId?: string;
  visualId?: string;
  mappingStatus?: string;
  mappingConfidence?: string;
  validationStatus?: 'passed' | 'failed';
  validationError?: string;
}

export interface ParseStats {
  totalQuestions: number;
  textQuestions: number;
  chartQuestions: number;
  tableQuestions: number;
  passageBased: number;
  imagesCount: number;
  validationPassed: number;
  needsReview: number;
  dataInterpretation?: number;
  graphBased?: number;
}

interface ParserPreviewModalProps {
  filename: string;
  sections: { id: string; name: string }[];
  questions: ParsedQuestion[];
  stats: ParseStats;
  onApprove: (questions: ParsedQuestion[]) => void;
  onClose: () => void;
}

export const ParserPreviewModal: React.FC<ParserPreviewModalProps> = ({
  filename,
  sections,
  questions: initialQuestions,
  stats,
  onApprove,
  onClose,
}) => {
  const [questions, setQuestions] = useState<ParsedQuestion[]>(initialQuestions);
  const [activeTab, setActiveTab] = useState<'all' | 'needs_review' | 'chart' | 'table' | 'text'>('all');

  const filteredQuestions = questions.filter((q) => {
    if (activeTab === 'needs_review') return q.validationStatus === 'failed';
    if (activeTab === 'chart') return q.contextType === 'graph' || !!q.chartData;
    if (activeTab === 'table') return q.contextType === 'table' || !!q.tableData;
    if (activeTab === 'text') return !q.contextType && !q.chartData && !q.tableData;
    return true;
  });

  const handleFixQuestion = (id: string, newCorrectAns: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              correctAnswer: newCorrectAns,
              validationStatus: 'passed',
              validationError: '',
            }
          : q
      )
    );
  };

  const totalQuestionsCount = questions.length;
  const passedCount = questions.filter((q) => q.validationStatus === 'passed').length;
  const needsReviewCount = questions.filter((q) => q.validationStatus === 'failed').length;

  return (
    <div className="parser-preview-overlay">
      <div className="parser-preview-modal">
        {/* Modal Header */}
        <div className="parser-modal-header">
          <div className="parser-modal-title">
            <span>✨ AI Multimodal Document Parser Preview</span>
            <span style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 400 }}>({filename})</span>
          </div>
          <button type="button" className="parser-modal-close-btn" onClick={onClose} title="Close Preview">
            ✕
          </button>
        </div>

        {/* Multi-stage Pipeline Progress Bar */}
        <div className="parser-steps-bar">
          <div className="parser-step-chip completed">✓ Step 1: Ingestion</div>
          <div className="parser-step-chip completed">✓ Step 2: Page Rendering</div>
          <div className="parser-step-chip completed">✓ Step 3: Text & Layout</div>
          <div className="parser-step-chip completed">✓ Step 4: Visual Region OCR</div>
          <div className="parser-step-chip completed">✓ Step 5: Chart & Table Extraction</div>
          <div className="parser-step-chip completed">✓ Step 6: Answer Key Verification</div>
          <div className="parser-step-chip active">● Step 7: Final Admin Review</div>
        </div>

        {/* Parse Metrics Summary Grid */}
        <div className="parser-stats-grid">
          <div className="stat-card">
            <div className="stat-number">{totalQuestionsCount}</div>
            <div className="stat-label">Total Questions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.chartQuestions || 0}</div>
            <div className="stat-label">Chart / DI Sets</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.tableQuestions || 0}</div>
            <div className="stat-label">Table DI Sets</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.passageBased || 0}</div>
            <div className="stat-label">Passage Sets</div>
          </div>
          <div className="stat-card passed">
            <div className="stat-number">{passedCount}</div>
            <div className="stat-label">Validation Passed</div>
          </div>
          <div className={`stat-card ${needsReviewCount > 0 ? 'needs-review' : ''}`}>
            <div className="stat-number">{needsReviewCount}</div>
            <div className="stat-label">Needs Review</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="parser-filters-row">
          <div className="filter-tabs">
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Questions ({totalQuestionsCount})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'needs_review' ? 'active' : ''}`}
              onClick={() => setActiveTab('needs_review')}
              style={{ color: needsReviewCount > 0 ? '#e11d48' : undefined }}
            >
              ⚠️ Needs Review ({needsReviewCount})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              📊 Chart / Graphs ({stats.chartQuestions || 0})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              📋 Tables ({stats.tableQuestions || 0})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              📝 Text Only
            </button>
          </div>
        </div>

        {/* Questions Scrollable Listing */}
        <div className="parser-questions-scroll">
          {filteredQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              No questions found under selected tab filter.
            </div>
          ) : (
            filteredQuestions.map((q, index) => {
              const qNum = q.questionNumber || index + 1;
              const isFailed = q.validationStatus === 'failed';

              return (
                <div key={q.id || index} className={`preview-question-card ${isFailed ? 'failed' : ''}`}>
                  <div className="q-card-header">
                    <span className="q-num-badge">Question #{qNum}</span>
                    <span className={`q-status-badge ${isFailed ? 'failed' : 'passed'}`}>
                      {isFailed ? '⚠️ NEEDS REVIEW' : '✓ PASSED VALIDATION'}
                    </span>
                  </div>

                  {isFailed && (
                    <div className="q-validation-error-alert">
                      <span>⚠️ Validation Alert:</span> {q.validationError || 'Cross-check answer mapping with chart.'}
                    </div>
                  )}

                  {/* Render Visual Content / Chart if available */}
                  {(q.chartData || q.tableData || q.imageReference || (q.visualReferences && q.visualReferences.length > 0) || q.contextType === 'graph' || q.contextType === 'table') && (
                    <VisualContentRenderer
                      chartData={q.chartData}
                      tableData={q.tableData}
                      imageReference={q.imageReference}
                      visualReferences={q.visualReferences}
                      context={q.context}
                      contextType={q.contextType}
                      title={q.context ? q.context.split('\n')[0] : ''}
                      mappingStatus={q.mappingStatus}
                      mappingConfidence={q.mappingConfidence}
                    />
                  )}

                  {/* Question Stem */}
                  <div className="q-stem-text" style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: '0.75rem 0' }}>
                    {q.question}
                  </div>

                  {/* Options */}
                  {q.options && q.options.length > 0 && (
                    <div className="preview-options-list">
                      {q.options.map((opt, optIdx) => {
                        const optLabel = String.fromCharCode(65 + optIdx);
                        const isCorrect =
                          Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.includes(opt)
                            : q.correctAnswer === opt || q.correctAnswer === optLabel;

                        return (
                          <div key={optIdx} className={`preview-option-item ${isCorrect ? 'correct' : ''}`}>
                            <span>
                              <strong>{optLabel})</strong> {opt}
                            </span>
                            {isCorrect && <span>✓ Correct Answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Admin Override Fix button if failed */}
                  {isFailed && q.options && q.options.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Set Correct Answer:</span>
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleFixQuestion(q.id, opt)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '0.25rem',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          {String.fromCharCode(65 + optIdx)}) {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
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
        </div>
      </div>
    </div>
  );
};
