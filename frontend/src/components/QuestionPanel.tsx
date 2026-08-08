import React, { useEffect, useState } from 'react';
import './QuestionPanel.css';

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
    const bodyRows = cleanRows.slice(1);

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
    const isTableLine = trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.split('|').length >= 3);

    if (isTableLine) {
      tableBuffer.push(line);
    } else {
      flushTable(`tbl-${idx}`);
      if (trimmed) {
        blocks.push(
          <div key={`txt-${idx}`} className="q-paragraph-line">
            {trimmed}
          </div>
        );
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

  // Determine if options exist (even if type was set to text erroneously)
  const hasOptions = Array.isArray(question.options) && question.options.length > 0;

  return (
    <div className="bank-question-panel">
      {contextText ? (
        <div className="split-directions-layout">
          <div className="directions-pane">
            <strong className="directions-title">Data / Context:</strong>
            {renderFormattedContent(contextText)}
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
                {orderedItems.map((item, index) => (
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
