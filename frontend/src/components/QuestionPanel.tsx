import React, { useEffect, useState } from 'react';
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
            <img src={extractedImgUrl} alt="Exam diagram" style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '0.5rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: '#f8fafc', border: '1.5px dashed #94a3b8', borderRadius: '0.5rem', fontWeight: 600 }}>
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
              {bodyContent && <div className="q-paragraph-line passage-body-line" style={{ marginTop: '0.4rem', color: '#1e293b' }}>{bodyContent}</div>}
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

  useEffect(() => {
    if (question.type === 'ordering') {
      if (Array.isArray(answer) && answer.length > 0) {
        setOrderedItems(answer as string[]);
      } else {
        setOrderedItems(question.options ? [...question.options] : []);
      }
    }
  }, [answer, question.id, question.options, question.type]);

  const handleOptionClick = (option: string) => {
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
  };

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

  return (
    <div className="bank-question-panel">
      {contextText || question.chartData || question.imageReference || (question.visualReferences && question.visualReferences.length > 0) ? (
        <div className="split-directions-layout">
          <div className="directions-pane">
            <strong className="directions-title">Data / Context:</strong>
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

          <div className="question-content-pane">
            <div className="q-prompt-statement">{renderFormattedContent(fullText)}</div>

            {hasOptions && question.type !== 'ordering' && !isMultipleChoice && (
              <div className="tcs-options-list">
                {question.options!.map((option, index) => (
                  <label key={index} className={`tcs-option-label ${answer === option ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answer === option}
                      onChange={() => handleOptionClick(option)}
                      className="tcs-option-radio"
                    />
                    <span className="tcs-option-val">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {hasOptions && question.type !== 'ordering' && isMultipleChoice && (
              <>
                <p className="note-text">Note: There are multiple correct answers to this question.</p>
                <div className="tcs-options-list">
                  {question.options!.map((option, index) => {
                    const isSelected = Array.isArray(answer) && answer.includes(option);
                    return (
                      <label key={index} className={`tcs-option-label ${isSelected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          name={`question-${question.id}`}
                          value={option}
                          checked={isSelected}
                          onChange={() => handleOptionClick(option)}
                          className="tcs-option-checkbox"
                        />
                        <span className="tcs-option-val">{option}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {question.type === 'ordering' && (
              <div className="ordering-list">
                <p className="note-text">Note: Drag and drop to arrange in order.</p>
                {orderedItems.map((item: string, index: number) => (
                  <div
                    key={item}
                    className={`ordering-item ${dragIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="ordering-index">{index + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {!hasOptions && question.type === 'text' && (
              <textarea
                className="bank-text-area"
                value={typeof answer === 'string' ? answer : ''}
                onChange={(e) => onAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="single-question-layout">
          <div className="question-content-pane">
            <div className="q-prompt-statement">{renderFormattedContent(fullText)}</div>

            {hasOptions && question.type !== 'ordering' && !isMultipleChoice && (
              <div className="tcs-options-list">
                {question.options!.map((option, index) => (
                  <label key={index} className={`tcs-option-label ${answer === option ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answer === option}
                      onChange={() => handleOptionClick(option)}
                      className="tcs-option-radio"
                    />
                    <span className="tcs-option-val">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {hasOptions && question.type !== 'ordering' && isMultipleChoice && (
              <>
                <p className="note-text">Note: There are multiple correct answers to this question.</p>
                <div className="tcs-options-list">
                  {question.options!.map((option, index) => {
                    const isSelected = Array.isArray(answer) && answer.includes(option);
                    return (
                      <label key={index} className={`tcs-option-label ${isSelected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          name={`question-${question.id}`}
                          value={option}
                          checked={isSelected}
                          onChange={() => handleOptionClick(option)}
                          className="tcs-option-checkbox"
                        />
                        <span className="tcs-option-val">{option}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {question.type === 'ordering' && (
              <div className="ordering-list">
                <p className="note-text">Note: Drag and drop to arrange in order.</p>
                {orderedItems.map((item: string, index: number) => (
                  <div
                    key={item}
                    className={`ordering-item ${dragIndex === index ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="ordering-index">{index + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {!hasOptions && question.type === 'text' && (
              <textarea
                className="bank-text-area"
                value={typeof answer === 'string' ? answer : ''}
                onChange={(e) => onAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionPanel;
