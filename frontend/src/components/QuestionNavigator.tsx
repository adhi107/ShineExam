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
  questions: Question[];
  currentIndex: number;
  answers: Answer[];
  sections: string[];
  currentSection: string;
  onQuestionSelect: (index: number) => void;
  onSectionChange: (section: string) => void;
  getQuestionStatus: (index: number) => string;
  onSubmit: () => void;
}

const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questions,
  currentIndex,
  sections,
  currentSection,
  onSectionChange,
  onQuestionSelect,
  getQuestionStatus,
  onSubmit,
}) => {
  return (
    <div className="question-navigator">
      <div className="navigator-header">
        <h3>Assessment Navigator</h3>
        <button className="close-navigator">✕</button>
      </div>

      <div className="navigator-sections" aria-label="Exam sections">
        {sections.map((section) => (
          <button
            key={section}
            className={currentSection === section ? 'active' : ''}
            onClick={() => onSectionChange(section)}
          >
            {section}
          </button>
        ))}
      </div>

      <div className="questions-grid">
        {questions.map((_, index) => {
          const status = getQuestionStatus(index);
          return (
            <button
              key={index}
              className={`question-btn ${status} ${currentIndex === index ? 'current' : ''}`}
              onClick={() => onQuestionSelect(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="navigator-submit-wrap">
        <button className="navigator-submit" onClick={onSubmit}>Submit Exam</button>
      </div>
    </div>
  );
};

export default QuestionNavigator;
