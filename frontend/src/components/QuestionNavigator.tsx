import React from 'react';
import './QuestionNavigator.css';

interface Answer {
  questionId: string;
  answer: string | string[];
  marked: boolean;
}

interface Question {
  id: string;
  section: string;
}

interface QuestionNavigatorProps {
  userId?: string;
  questions: Question[];
  currentIndex: number;
  answers: Answer[];
  visited?: Set<number>;
  sections: string[];
  currentSection: string;
  onQuestionSelect: (index: number) => void;
  onSectionChange: (section: string) => void;
  getQuestionStatus: (index: number) => string;
  onSubmit: () => void;
  submitText?: string;
}

const hasValue = (ans: Answer) =>
  Array.isArray(ans.answer) ? ans.answer.length > 0 : ans.answer !== '';

const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  userId = 'Candidate',
  questions,
  currentIndex,
  answers,
  visited = new Set<number>(),
  currentSection,
  onQuestionSelect,
  getQuestionStatus,
  onSubmit,
  submitText = 'Submit Section',
}) => {
  // Filter questions belonging to current section with their global indices
  const sectionQuestionsWithGlobalIndex = questions
    .map((q, globalIdx) => ({ question: q, globalIndex: globalIdx }))
    .filter((item) => !currentSection || item.question.section === currentSection);

  // Calculate status counts strictly for the current section
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let notVisitedCount = 0;
  let markedCount = 0;
  let ansMarkedCount = 0;

  sectionQuestionsWithGlobalIndex.forEach(({ globalIndex }) => {
    const a = answers[globalIndex];
    const isVis = visited.has(globalIndex);
    const hasAns = a ? hasValue(a) : false;
    const isMarked = a ? a.marked : false;

    if (isMarked && hasAns) {
      ansMarkedCount++;
    } else if (isMarked && !hasAns) {
      markedCount++;
    } else if (hasAns) {
      answeredCount++;
    } else if (isVis) {
      notAnsweredCount++;
    } else {
      notVisitedCount++;
    }
  });

  return (
    <div className="bank-palette-sidebar">
      {/* 1. Candidate Profile Box */}
      <div className="candidate-profile-box">
        <div className="candidate-avatar">👤</div>
        <div className="candidate-name-wrap">
          <small>Welcome</small>
          <strong>{userId}</strong>
        </div>
      </div>

      {/* 2. Status Legend Table */}
      <div className="palette-status-legend">
        <div className="legend-row">
          <div className="legend-item">
            <span className="legend-badge answered">{answeredCount}</span>
            <span className="legend-text">Answered</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge not-answered">{notAnsweredCount}</span>
            <span className="legend-text">Not Answered</span>
          </div>
        </div>

        <div className="legend-row">
          <div className="legend-item">
            <span className="legend-badge not-visited">{notVisitedCount}</span>
            <span className="legend-text">Not Visited</span>
          </div>
          <div className="legend-item">
            <span className="legend-badge marked">{markedCount}</span>
            <span className="legend-text">Marked for Review</span>
          </div>
        </div>

        <div className="legend-row full">
          <div className="legend-item full">
            <span className="legend-badge ans-marked">{ansMarkedCount}</span>
            <span className="legend-text">
              Answered and Marked for Review <small>(will be considered for evaluation)</small>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Palette Header */}
      <div className="questions-palette-title-bar">
        Questions Palette
      </div>

      {/* 4. Subheading */}
      <div className="choose-question-subhead">
        Choose a Question
      </div>

      {/* 5. 5-Column Question Number Grid (Sectional) */}
      <div className="questions-grid-container">
        {sectionQuestionsWithGlobalIndex.map((item, secIdx) => {
          const status = getQuestionStatus(item.globalIndex);
          const isCurrent = currentIndex === item.globalIndex;

          return (
            <button
              key={item.globalIndex}
              className={`tcs-q-btn ${status} ${isCurrent ? 'current' : ''}`}
              onClick={() => onQuestionSelect(item.globalIndex)}
              title={`Question ${secIdx + 1}`}
            >
              {secIdx + 1}
            </button>
          );
        })}
      </div>

      {/* 6. Submit Button */}
      <div className="palette-submit-container">
        <button className="tcs-btn-submit" onClick={onSubmit}>
          {submitText}
        </button>
      </div>
    </div>
  );
};

export default QuestionNavigator;
