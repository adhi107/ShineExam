import React, { useEffect, useState, useCallback } from 'react';
import './QuestionPanel.css';
import { VisualContentRenderer } from './VisualContentRenderer';

interface Question {
  id: string;
  type: 'mcq' | 'msq' | 'multiple' | 'ordering' | 'text';
  question: string;
  context?: string;
  contextType?: string;
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
  chartData?: any;
  tableData?: any;
  imageReference?: string;
  visualReferences?: any[];
}

interface QuestionPanelProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  answer: string | string[];
  isMarked: boolean;
  onAnswer: (answer: string | string[]) => void;
  onMarkForReview: () => void;
}

const renderFormattedContent = (content: string) => {
  if (!content || !content.trim()) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length === 0) return;
    const cleanRows = tableBuffer
      .filter((line) => !line.match(/^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/))
      .map((line) =>
        line
          .split('|')
          .map((c) => c.trim())
          .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''))
      );

    tableBuffer = [];
    if (cleanRows.length === 0) return;

    const headerRow = cleanRows[0];
    const rawBodyRows = cleanRows.slice(1);
    const numCols = headerRow.length;
    const bodyRows: string[][] = [];

    rawBodyRows.forEach((row) => {
      if (numCols > 1 && row.length === numCols) {
        const lastCell = row[row.length - 1];
        const tokens = lastCell.trim().split(/\s+/);
        if (tokens.length >= numCols) {
          const firstVal = tokens[0];
          const remTokens = tokens.slice(1);
          bodyRows.push([...row.slice(0, -1), firstVal]);
          for (let i = 0; i < remTokens.length; i += numCols) {
            bodyRows.push(remTokens.slice(i, i + numCols));
          }
          return;
        }
      }
      bodyRows.push(row);
    });

    blocks.push(
      <div key={key} className="parsed-di-table-wrapper">
        <table className="parsed-di-table">
          <thead>
            <tr>
              {headerRow.map((cell, idx) => (
                <th key={idx}>{cell}</th>
              ))}
            </tr>
          </thead>
          {bodyRows.length > 0 && (
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    );
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Universal image extraction: base64, markdown img, http URL, or graph tag
    let extractedImgUrl = '';
    const b64Match = trimmed.match(/data:image\/[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=\s]+/i);
    if (b64Match) {
      extractedImgUrl = b64Match[0].trim();
    }
    if (!extractedImgUrl) {
      const mdImgMatch = trimmed.match(/!\[.*?\]\((.*?)\)/i);
      if (mdImgMatch && mdImgMatch[1]) {
        extractedImgUrl = mdImgMatch[1].trim();
      }
    }
    if (!extractedImgUrl) {
      const httpMatch = trimmed.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|svg|gif|webp))/i);
      if (httpMatch && httpMatch[1]) {
        extractedImgUrl = httpMatch[1].trim();
      }
    }
    if (!extractedImgUrl) {
      const graphTagMatch = trimmed.match(/\[Graph(?:\/Figure)?:\s*(.+?)\]/i);
      if (graphTagMatch && graphTagMatch[1]) {
        extractedImgUrl = graphTagMatch[1].trim();
      }
    }

    if (extractedImgUrl) {
      flushTable(`tbl-${idx}`);
      blocks.push(
        <div key={`img-${idx}`} className="candidate-graph-wrap" style={{ margin: '0.75rem 0', textAlign: 'center' }}>
          {extractedImgUrl.startsWith('http') || extractedImgUrl.startsWith('data:image') ? (
            <img src={extractedImgUrl} alt="Exam diagram" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: '#f8fafc', border: '1.5px dashed #94a3b8', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem' }}>
              📊 Graph / Diagram: {extractedImgUrl}
            </div>
          )}
        </div>
      );
      return;
    }

    const isTableLine = trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.split('|').length >= 3);

    if (isTableLine) {
      tableBuffer.push(line);
    } else {
      flushTable(`tbl-${idx}`);
      if (trimmed) {
        const dirMatch = trimmed.match(/^(Directions\s*(?:\([^)]+\))?\s*:?\s*)(.*)/i);
        if (dirMatch && dirMatch[1]) {
          const headerTitle = dirMatch[1].trim();
          const bodyContent = dirMatch[2] ? dirMatch[2].trim() : '';
          blocks.push(
            <div key={`txt-${idx}`} className="direction-header-block">
              <div className="q-paragraph-line direction-header-line">{headerTitle}</div>
              {bodyContent && <div className="q-paragraph-line passage-body-line" style={{ marginTop: '0.35rem', color: '#1e293b', fontWeight: 400 }}>{bodyContent}</div>}
            </div>
          );
        } else {
          const isDirHeader = /^(?:Directions|Read the following|Consider the|Study the)/i.test(trimmed);
          blocks.push(
            <div key={`txt-${idx}`} className={`q-paragraph-line ${isDirHeader ? 'direction-header-line' : ''}`}>
              {trimmed}
            </div>
          );
        }
      }
    }
  });

  flushTable(`tbl-end`);
  return <div className="formatted-content-wrap">{blocks}</div>;
};

/* ─── Chevron Icon ─── */
const ChevronIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
  <svg
    className={`mobile-accordion-chevron ${isOpen ? 'open' : ''}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question,
  answer,
  onAnswer,
}) => {
  const isMultipleChoice = Array.isArray(question.correctAnswer) || question.type === 'multiple';

  const [orderedItems, setOrderedItems] = useState<string[]>(() => {
    if (question.type === 'ordering') {
      if (Array.isArray(answer) && answer.length > 0) return answer as string[];
      return question.options ? [...question.options] : [];
    }
    return [];
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Mobile accordion: context pane collapsed by default on mobile
  const [contextOpen, setContextOpen] = useState<boolean>(false);

  // Check if we're on mobile — used to decide initial accordion state
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setContextOpen(false); // Start collapsed on mobile
    } else {
      setContextOpen(true);
    }
  }, [question.id]);

  useEffect(() => {
    if (question.type === 'ordering') {
      if (Array.isArray(answer) && answer.length > 0) {
        setOrderedItems(answer as string[]);
      } else {
        setOrderedItems(question.options ? [...question.options] : []);
      }
    }
  }, [answer, question.id, question.options, question.type]);

  const handleOptionClick = useCallback((option: string) => {
    if (isMultipleChoice) {
      const currentAnswers = Array.isArray(answer) ? answer : [];
      if (currentAnswers.includes(option)) {
        onAnswer(currentAnswers.filter((a) => a !== option));
      } else {
        onAnswer([...currentAnswers, option]);
      }
      return;
    }
    onAnswer(option);
  }, [isMultipleChoice, answer, onAnswer]);

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const updated = [...orderedItems];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setDragIndex(index);
    setOrderedItems(updated);
    onAnswer(updated);
  };

  const handleDragEnd = () => setDragIndex(null);

  const fullText = question.question || '';
  const contextText = question.context || '';
  const hasOptions = Array.isArray(question.options) && question.options.length > 0;
  const hasContext = !!(contextText || question.chartData || question.imageReference || (question.visualReferences && question.visualReferences.length > 0));

  /* ─── Move ordering item for touch devices ─── */
  const moveOrderingItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= orderedItems.length) return;
    const updated = [...orderedItems];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setOrderedItems(updated);
    onAnswer(updated);
  };

  /* ─── Options Renderer ─── */
  const renderOptions = () => {
    if (!hasOptions || question.type === 'ordering') return null;

    return (
      <div className="tcs-options-list" role={isMultipleChoice ? "group" : "radiogroup"} aria-label="Answer options">
        {question.options!.map((option, index) => {
          const isSelected = isMultipleChoice
            ? Array.isArray(answer) && answer.includes(option)
            : answer === option;
          const letter = String.fromCharCode(65 + index);
          return (
            <div
              key={index}
              role={isMultipleChoice ? "checkbox" : "radio"}
              aria-checked={isSelected}
              tabIndex={0}
              className={`tcs-option-label ${isSelected ? 'selected' : ''}`}
              onClick={() => handleOptionClick(option)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleOptionClick(option);
                }
              }}
            >
              <span className="option-letter-badge">{letter}</span>
              <span className="tcs-option-val">{option}</span>
            </div>
          );
        })}
      </div>
    );
  };

  /* ─── Question Content Section ─── */
  const renderQuestionContent = () => (
    <div className="question-inner-flow">
      {isMultipleChoice && hasOptions && question.type !== 'ordering' && (
        <p className="note-text">ⓘ Select one or more correct options</p>
      )}

      <div className="q-prompt-statement">{renderFormattedContent(fullText)}</div>

      {renderOptions()}

      {question.type === 'ordering' && (
        <div className="ordering-list">
          <p className="note-text">↕ Drag or tap arrows to arrange in correct order</p>
          {orderedItems.map((item: string, index: number) => (
            <div
              key={item}
              className={`ordering-item ${dragIndex === index ? 'dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <span className="ordering-index">{index + 1}</span>
              <span className="ordering-item-text">{item}</span>
              <div className="ordering-touch-controls">
                <button
                  type="button"
                  className="btn-order-move"
                  disabled={index === 0}
                  onClick={(e) => { e.stopPropagation(); moveOrderingItem(index, index - 1); }}
                  aria-label="Move item up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn-order-move"
                  disabled={index === orderedItems.length - 1}
                  onClick={(e) => { e.stopPropagation(); moveOrderingItem(index, index + 1); }}
                  aria-label="Move item down"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasOptions && question.type === 'text' && (
        <div className="bank-text-wrap">
          <textarea
            className="bank-text-area"
            value={typeof answer === 'string' ? answer : ''}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Type your descriptive answer here..."
            rows={5}
          />
        </div>
      )}
    </div>
  );

  /* ─── Context / Directions Pane Content ─── */
  const renderContextContent = () => (
    <div className="context-content-inner">
      {contextText && renderFormattedContent(contextText)}
      <VisualContentRenderer
        visualReferences={question.visualReferences}
        imageReference={question.imageReference}
        chartData={question.chartData}
        tableData={question.tableData}
        context={contextText}
        contextType={question.contextType}
        title={contextText ? contextText.split('\n')[0] : ''}
        mappingStatus={(question as any).mappingStatus}
        mappingConfidence={(question as any).mappingConfidence}
      />
    </div>
  );

  // Determine smart accordion label
  const getAccordionLabel = () => {
    const isPassage = question.contextType === 'passage' || /passage/i.test(contextText);
    const isGraph = question.contextType === 'graph' || !!question.chartData;
    const isTable = question.contextType === 'table' || !!question.tableData;

    if (isPassage) {
      return {
        icon: '📖',
        text: contextOpen ? 'Hide Passage' : 'Read Passage / Directions',
        tag: 'Passage'
      };
    }
    if (isGraph) {
      return {
        icon: '📊',
        text: contextOpen ? 'Hide Graph / Chart' : 'View Graph & Data',
        tag: 'Graph'
      };
    }
    if (isTable) {
      return {
        icon: '📋',
        text: contextOpen ? 'Hide Table' : 'View Data Table',
        tag: 'Table'
      };
    }
    return {
      icon: 'ℹ️',
      text: contextOpen ? 'Hide Context' : 'View Context / Directions',
      tag: 'Context'
    };
  };

  const accordionMeta = getAccordionLabel();

  if (!hasContext) {
    /* ─── Simple layout: no context ─── */
    return (
      <div className="bank-question-panel" style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="single-question-layout">
          {renderQuestionContent()}
        </div>
      </div>
    );
  }

  /* ─── Split layout: context + question ─── */
  return (
    <div className="bank-question-panel" style={{ flex: '1 1 0%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="split-directions-layout">
        {/* Desktop: left directions pane (HIDDEN ON MOBILE via CSS) */}
        <div className="directions-pane">
          <strong className="directions-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Data / Context
          </strong>
          {renderContextContent()}
        </div>

        {/* Mobile: accordion above question (ONLY VISIBLE ON MOBILE via CSS) */}
        <div className="mobile-context-accordion">
          <button
            type="button"
            className="mobile-accordion-trigger"
            onClick={() => setContextOpen((p) => !p)}
            aria-expanded={contextOpen}
          >
            <span className="mobile-accordion-trigger-label">
              <span className="accordion-label-icon">{accordionMeta.icon}</span>
              <span className="accordion-label-title">{accordionMeta.text}</span>
              <span className="accordion-label-tag">{accordionMeta.tag}</span>
            </span>
            <ChevronIcon isOpen={contextOpen} />
          </button>
          <div
            className={`mobile-accordion-body ${contextOpen ? 'open' : ''}`}
            style={contextOpen ? { maxHeight: '42vh' } : { maxHeight: 0 }}
          >
            {renderContextContent()}
          </div>
        </div>

        {/* Question content pane */}
        <div className="question-content-pane">
          {renderQuestionContent()}
        </div>
      </div>
    </div>
  );
};

export default QuestionPanel;
