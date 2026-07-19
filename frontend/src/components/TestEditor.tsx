import React, { useState, useEffect } from 'react';
import './TestBuilder.css';
import { apiGet, apiPut } from "../services/api";
import type { ExamCategory } from "./ExamCategoryManagement";

interface Question {
  id: string;
  type: 'mcq' | 'multiple' | 'text';
  question: string;
  options?: string[];
  correctAnswer?: string | string[];
  section: string;
  marks: number;
}

interface Section {
  id: string;
  name: string;
}

interface TestEditorProps {
  testId: string;
  onBack: () => void;
}

const TestEditor: React.FC<TestEditorProps> = ({ testId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [testName, setTestName] = useState('');
  const [duration, setDuration] = useState(60);
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [availableFrom, setAvailableFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [stage, setStage] = useState('');
  const [sections, setSections] = useState<Section[]>([
    { id: 'general', name: 'General' }
  ]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newSection, setNewSection] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const [questionForm, setQuestionForm] = useState({
    type: 'mcq' as 'mcq' | 'multiple' | 'text',
    question: '',
    options: ['', ''],  // Start with 2 empty options
    correctAnswer: '',
    correctAnswers: [] as string[],
    section: sections[0]?.id || '',
    marks: 1,
  });

  useEffect(() => {
    loadTest();
    apiGet<{categories:ExamCategory[]}>("/admin/exam-categories").then(res=>setCategories(res.categories||[])).catch(console.error);
  }, [testId]);

  const selectedCategory=categories.find(item=>item.id===categoryId);
  const selectedSubcategory=selectedCategory?.subcategories.find(item=>item.id===subcategoryId);
  const changeCategory=(value:string)=>{const category=categories.find(item=>item.id===value);const sub=category?.subcategories[0];setCategoryId(value);setSubcategoryId(sub?.id||'');setStage(sub?.stages[0]||'')};
  const changeSubcategory=(value:string)=>{const sub=selectedCategory?.subcategories.find(item=>item.id===value);setSubcategoryId(value);setStage(sub?.stages[0]||'')};

  const loadTest = async () => {
    setLoading(true);
    try {
      const res = await apiGet<any>(`/admin/exams/${testId}`);
      const test = res.test;
      
      setTestName(test.testName || test.name || '');
      setDuration(test.duration || 60);
      setPassingPercentage(test.passingPercentage || 40);
      setAvailableFrom(test.availableFrom ? String(test.availableFrom).slice(0, 10) : String(test.createdAt || '').slice(0, 10));
      setValidUntil(test.validUntil ? String(test.validUntil).slice(0, 10) : '');
      setCategoryId(test.categoryId || '');
      setSubcategoryId(test.subcategoryId || '');
      setStage(test.stage || '');
      
      // Convert stored Shine Exam sections into editor section rows.
      const normalizedSections = (test.sections || ['General'])
        .map((s: any) => typeof s === 'string' ? s : s.name)
        .map((s: string) => s?.trim())
        .filter((s: string) => s);

      const sectionObjects = normalizedSections.map((name: string, index: number) => ({
        id: `section-${index}`,
        name: name
      }));

      setSections(sectionObjects);
      
      // Convert stored Shine Exam questions into editable question forms.
      const loadedQuestions: Question[] = (test.questions || []).map((q: any) => {
        // Link each stored question back to its editor section.
        const sectionName = q.section?.trim() || 'General';
        const sectionObj = sectionObjects.find((s: Section) => s.name === sectionName);
        const sectionId = sectionObj ? sectionObj.id : sectionObjects[0]?.id || 'general';

        return {
          id: q.id || q._id,
          type: q.type,
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          section: sectionId, // Use section ID instead of name
          marks: q.marks || 1,
        };
      });
      
      console.log('Loaded questions:', loadedQuestions);
      console.log('Sections:', sectionObjects);
      
      setQuestions(loadedQuestions);
      
      if (sectionObjects.length > 0) {
        setQuestionForm(prev => ({ ...prev, section: sectionObjects[0].id }));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load test");
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const addSection = () => {
    const name = newSection.trim();
    if (!name) return;

    const exists = sections.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) return;

    setSections([
      ...sections,
      {
        id: Date.now().toString(),
        name,
      },
    ]);

    setNewSection('');
  };

  // Add an answer option to the test question editor.
  const addOption = () => {
    setQuestionForm({ 
      ...questionForm, 
      options: [...questionForm.options, ''] 
    });
  };

  // Remove an answer option from the test question editor.
  const removeOption = (index: number) => {
    const newOptions = questionForm.options.filter((_, i) => i !== index);
    // Remove the deleted option from selected correct answers.
    const removedOption = questionForm.options[index];
    let newCorrectAnswers = questionForm.correctAnswers;
    if (questionForm.correctAnswers.includes(removedOption)) {
      newCorrectAnswers = questionForm.correctAnswers.filter(a => a !== removedOption);
    }
    let newCorrectAnswer = questionForm.correctAnswer;
    if (questionForm.correctAnswer === removedOption) {
      newCorrectAnswer = '';
    }
    
    setQuestionForm({ 
      ...questionForm, 
      options: newOptions,
      correctAnswers: newCorrectAnswers,
      correctAnswer: newCorrectAnswer,
    });
  };

  const addQuestion = () => {
    // Require enough options for Shine Exam MCQ and multi-select questions.
    if (questionForm.type === 'mcq' || questionForm.type === 'multiple') {
      const validOptions = questionForm.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        alert('Please add at least 2 options');
        return;
      }
    }

    const nextQuestionId = editingQuestionId || Date.now().toString();
    const newQuestion: Question = {
      id: nextQuestionId,
      type: questionForm.type,
      question: questionForm.question,
      section: questionForm.section,
      marks: questionForm.marks,
    };

    if (questionForm.type === 'mcq' || questionForm.type === 'multiple') {
      newQuestion.options = questionForm.options.filter(opt => opt.trim());
    }

    if (questionForm.type === 'mcq') {
      newQuestion.correctAnswer = questionForm.correctAnswer;
    } else if (questionForm.type === 'multiple') {
      newQuestion.correctAnswer = questionForm.correctAnswers;
    } else {
      newQuestion.correctAnswer = questionForm.correctAnswer;
    }

    if (editingQuestionId) {
      setQuestions(questions.map((q) => (q.id === editingQuestionId ? newQuestion : q)));
    } else {
      setQuestions([...questions, newQuestion]);
    }
    setQuestionForm({
      type: 'mcq',
      question: '',
      options: ['', ''],  // Reset to 2 empty options
      correctAnswer: '',
      correctAnswers: [],
      section: sections[0]?.id || '',
      marks: 1,
    });
    setEditingQuestionId(null);
    setShowQuestionForm(false);
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    if (editingQuestionId === id) {
      setEditingQuestionId(null);
      setShowQuestionForm(false);
      setQuestionForm({
        type: 'mcq',
        question: '',
        options: ['', ''],
        correctAnswer: '',
        correctAnswers: [],
        section: sections[0]?.id || '',
        marks: 1,
      });
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const toggleCorrectAnswer = (option: string) => {
    const current = questionForm.correctAnswers;
    if (current.includes(option)) {
      setQuestionForm({
        ...questionForm,
        correctAnswers: current.filter(a => a !== option),
      });
    } else {
      setQuestionForm({
        ...questionForm,
        correctAnswers: [...current, option],
      });
    }
  };

  const getQuestionsBySection = (sectionId: string) => {
    return questions.filter(q => q.section === sectionId);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setQuestionForm({
      type: question.type,
      question: question.question,
      options: question.options && question.options.length > 0 ? [...question.options] : ['', ''],
      correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
      correctAnswers: Array.isArray(question.correctAnswer) ? [...question.correctAnswer] : [],
      section: question.section,
      marks: question.marks,
    });
    setShowQuestionForm(true);
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      type: 'mcq',
      question: '',
      options: ['', ''],
      correctAnswer: '',
      correctAnswers: [],
      section: sections[0]?.id || '',
      marks: 1,
    });
    setShowQuestionForm(false);
  };

  const handleUpdateTest = async () => {
    if (!testName.trim()) {
      alert("Test name is required");
      return;
    }

    if (questions.length === 0) {
      alert("Add at least one question before updating the test");
      return;
    }

    if (passingPercentage < 1 || passingPercentage > 100) {
      alert("Passing score must be between 1 and 100");
      return;
    }
    if (!availableFrom || !validUntil || validUntil < availableFrom) {
      alert("Choose a valid test start date and an end date on or after it");
      return;
    }
    if (!categoryId || !subcategoryId || !stage) { alert("Select an exam category, subcategory and stage"); return; }

    try {
      // Save editor sections as the section names expected by the backend.
      const sectionNames = sections.map(s => s.name);
      
      // Save each question with its selected Shine Exam section name.
      const questionsWithSectionNames = questions.map(q => {
        const sectionObj = sections.find(s => s.id === q.section);
        return {
          ...q,
          section: sectionObj ? sectionObj.name : q.section
        };
      });

      await apiPut(`/admin/exams/${testId}`, {
        testName,
        duration,
        passingPercentage,
        availableFrom,
        validUntil,
        categoryId,
        subcategoryId,
        stage,
        sections: sectionNames,
        questions: questionsWithSectionNames,
      });

      alert("Test updated successfully");
      onBack();
    } catch (err) {
      console.error(err);
      alert("Failed to update test");
    }
  };

  if (loading) {
    return (
      <div className="test-builder page-with-topbar">
        <div style={{ padding: '2rem' }}>
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="test-builder page-with-topbar">
      <div className="page-header">
        <h2>Edit Test</h2>
        <button className="secondary-btn" onClick={onBack}>
          ← Back to Tests
        </button>
      </div>

      <div className="form-card">
        <h3>Test Details</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Test Name *</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Enter test name"
            />
          </div>
          <div className="form-group">
            <label>Duration (minutes) *</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              placeholder="60"
            />
          </div>
          <div className="form-group">
            <label>Passing Score (%) *</label>
            <input
              type="number"
              value={passingPercentage}
              onChange={(e) => setPassingPercentage(Number(e.target.value))}
              placeholder="40"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="hierarchy-row">
          <div className="validity-copy"><span>EXAM CLASSIFICATION</span><strong>My Tests location</strong><p>This controls where the test appears in the candidate sidebar.</p></div>
          <div className="form-group"><label>Category *</label><select value={categoryId} onChange={e=>changeCategory(e.target.value)}><option value="">Select category</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label>Subcategory *</label><select value={subcategoryId} onChange={e=>changeSubcategory(e.target.value)}><option value="">Select subcategory</option>{selectedCategory?.subcategories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label>Stage *</label><select value={stage} onChange={e=>setStage(e.target.value)}><option value="">Select stage</option>{selectedSubcategory?.stages.map(item=><option key={item} value={item}>{item}</option>)}</select></div>
        </div>

        <div className="validity-row">
          <div className="validity-copy"><span>TEST AVAILABILITY</span><strong>Validity window</strong><p>Students can start this paper only within these dates.</p></div>
          <div className="form-group"><label>Available from *</label><input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} /></div>
          <div className="form-group"><label>Valid until *</label><input type="date" min={availableFrom} value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
        </div>

        <div className="section-management">
          <h4>Sections</h4>
          <div className="section-tags">
            {sections.map((section) => (
              <div key={section.id} className="section-chip">
                {editingSectionId === section.id ? (
                  <input
                    className="section-edit-input"
                    value={section.name}
                    autoFocus
                    onChange={(e) => {
                      const newName = e.target.value;
                      setSections(sections.map(s =>
                        s.id === section.id ? { ...s, name: newName } : s
                      ));
                    }}
                    onBlur={() => setEditingSectionId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingSectionId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="section-name">{section.name}</span>
                )}

                <div className="section-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit section"
                    onClick={() => setEditingSectionId(section.id)}
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete section"
                    onClick={() => {
                      const remainingSections = sections.filter(s => s.id !== section.id);

                      setSections(remainingSections);
                      setQuestions(questions.filter(q => q.section !== section.id));

                      // Keep the selected editor section valid after deleting a section.
                      setQuestionForm((prev) => ({
                        ...prev,
                        section:
                          prev.section === section.id
                            ? remainingSections[0]?.id || ''
                            : prev.section,
                      }));
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="add-section">
            <input
              type="text"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="New section name"
            />
            <button className="primary-btn" onClick={addSection}>
              Add Section
            </button>
          </div>
        </div>
      </div>

      <div className="questions-section">
        <div className="section-header">
          <h3>Questions ({questions.length})</h3>
          <button
            className="primary-btn"
            onClick={() => {
              if (showQuestionForm && !editingQuestionId) {
                resetQuestionForm();
                return;
              }
              setEditingQuestionId(null);
              setShowQuestionForm(!showQuestionForm);
            }}
          >
            {showQuestionForm ? 'Cancel' : '+ Add Question'}
          </button>
        </div>

        {showQuestionForm && (
          <div className="question-form">
            <div className="form-row">
              <div className="form-group">
                <label>Question Type *</label>
                <select
                  value={questionForm.type}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, type: e.target.value as any })
                  }
                >
                  <option value="mcq">Single Choice (MCQ)</option>
                  <option value="multiple">Multiple Correct Answers</option>
                  <option value="text">Text Answer</option>
                </select>
              </div>
              <div className="form-group">
                <label>Section *</label>
                <select
                  value={questionForm.section}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, section: e.target.value })
                  }
                >
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Marks *</label>
                <input
                  type="number"
                  value={questionForm.marks}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, marks: Number(e.target.value) })
                  }
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Question *</label>
              <textarea
                value={questionForm.question}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, question: e.target.value })
                }
                placeholder="Enter your question"
                rows={3}
              />
            </div>

            {(questionForm.type === 'mcq' || questionForm.type === 'multiple') && (
              <div className="options-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label>Options * (minimum 2)</label>
                  <button 
                    type="button"
                    className="primary-btn" 
                    onClick={addOption}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    + Add Option
                  </button>
                </div>
                {questionForm.options.map((option, index) => (
                  <div key={index} className="option-input">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {questionForm.type === 'mcq' ? (
                      <input
                        type="radio"
                        name="correct"
                        checked={questionForm.correctAnswer === option}
                        onChange={() =>
                          setQuestionForm({ ...questionForm, correctAnswer: option })
                        }
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={questionForm.correctAnswers.includes(option)}
                        onChange={() => toggleCorrectAnswer(option)}
                      />
                    )}
                    <span className="option-label">Correct</span>
                    {questionForm.options.length > 2 && (
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removeOption(index)}
                        title="Remove option"
                        style={{ marginLeft: '0.5rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {questionForm.type === 'text' && (
              <div className="form-group">
                <label>Model Answer (for reference)</label>
                <textarea
                  value={questionForm.correctAnswer}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, correctAnswer: e.target.value })
                  }
                  placeholder="Enter model answer"
                  rows={3}
                />
              </div>
            )}

            <div className="form-actions">
              <button className="primary-btn" onClick={addQuestion}>
                {editingQuestionId ? 'Update Question' : 'Add Question'}
              </button>
              <button className="secondary-btn" onClick={resetQuestionForm}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {sections.map((section) => {
          const sectionQuestions = getQuestionsBySection(section.id);
          if (sectionQuestions.length === 0) return null;

          return (
            <div key={section.id} className="section-block">
              <h4>{section.name} ({sectionQuestions.length} questions)</h4>
              <div className="questions-list">
                {sectionQuestions.map((q, index) => (
                  <div key={q.id} className="question-card">
                    <div className="question-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className="question-type">{q.type.toUpperCase()}</span>
                      <span className="question-marks">{q.marks} marks</span>
                      <button
                        className="icon-btn"
                        type="button"
                        title="Edit question"
                        onClick={() => handleEditQuestion(q)}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-icon"
                        onClick={() => deleteQuestion(q.id)}
                      >
                        ✕
                      </button>
                    </div>
                    <p className="question-text prewrap">{q.question}</p>
                    {q.options && (
                      <ul className="options-list">
                        {q.options.map((opt, i) => (
                          <li key={i} className={
                            (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(opt)) ||
                            q.correctAnswer === opt ? 'correct-option' : ''
                          }>
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {questions.length === 0 && !showQuestionForm && (
          <div className="empty-state">
            No questions added yet. Click "Add Question" to start building your test.
          </div>
        )}
      </div>

      {questions.length > 0 && (
        <div className="form-actions">
          <button className="primary-btn large" onClick={handleUpdateTest}>
            Update Test
          </button>
        </div>
      )}
    </div>
  );
};

export default TestEditor;
