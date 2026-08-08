// Shine Exam test builder for creating and publishing question papers.
import React, { useEffect, useState } from 'react';
import './TestBuilder.css';
import { apiGet, apiPost } from "../services/api";
import type { ExamCategory } from "./ExamCategoryManagement";
import { DocumentQuestionUploader } from "./DocumentQuestionUploader";


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

interface TestBuilderProps {
  onBack: () => void;
}

const dateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const defaultValidUntil = () => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return dateInputValue(date); };

const TestBuilder: React.FC<TestBuilderProps> = ({ onBack }) => {
  const [testName, setTestName] = useState('');
  const [duration, setDuration] = useState(60);
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [availableFrom, setAvailableFrom] = useState(dateInputValue(new Date()));
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [stage, setStage] = useState('');
  const [sections, setSections] = useState<Section[]>([
    { id: 'general', name: 'General' }
  ]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({
    type: 'mcq' as 'mcq' | 'multiple' | 'text',
    question: '',
    options: ['', ''],
    correctAnswer: '',
    correctAnswers: [] as string[],
    section: sections[0]?.id || '',
    marks: 1,
  });

  useEffect(() => { apiGet<{categories:ExamCategory[]}>("/admin/exam-categories").then(res => { const items=res.categories||[];setCategories(items);const first=items[0];const sub=first?.subcategories[0];setCategoryId(first?.id||'');setSubcategoryId(sub?.id||'');setStage(sub?.stages[0]||''); }).catch(console.error); }, []);
  const selectedCategory=categories.find(item=>item.id===categoryId);
  const selectedSubcategory=selectedCategory?.subcategories.find(item=>item.id===subcategoryId);
  const changeCategory=(value:string)=>{const category=categories.find(item=>item.id===value);const sub=category?.subcategories[0];setCategoryId(value);setSubcategoryId(sub?.id||'');setStage(sub?.stages[0]||'')};
  const changeSubcategory=(value:string)=>{const sub=selectedCategory?.subcategories.find(item=>item.id===value);setSubcategoryId(value);setStage(sub?.stages[0]||'')};

  const addSection = () => {
    const name = newSection.trim();
    if (!name) return;
    const exists = sections.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    setSections([...sections, { id: Date.now().toString(), name }]);
    setNewSection('');
  };

  const addOption = () => {
    setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] });
  };

  const handleDocumentParsed = (
    parsedData: { sections: Section[]; questions: Question[] },
    mode: 'append' | 'replace'
  ) => {
    let updatedSections = mode === 'replace' ? [] : [...sections];
    const secIdMap: Record<string, string> = {};

    parsedData.sections.forEach(pSec => {
      const existing = updatedSections.find(
        s => s.name.trim().toLowerCase() === pSec.name.trim().toLowerCase()
      );
      if (existing) {
        secIdMap[pSec.id] = existing.id;
      } else {
        const newSecId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newSecObj = { id: newSecId, name: pSec.name.trim() };
        updatedSections.push(newSecObj);
        secIdMap[pSec.id] = newSecId;
      }
    });

    if (updatedSections.length === 0) {
      updatedSections = [{ id: 'general', name: 'General' }];
    }

    const formattedQuestions: Question[] = parsedData.questions.map((q, idx) => ({
      id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      type: q.type,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      section: secIdMap[q.section] || updatedSections[0].id,
      marks: q.marks || 1,
    }));

    setSections(updatedSections);
    if (mode === 'replace') {
      setQuestions(formattedQuestions);
    } else {
      setQuestions(prev => [...prev, ...formattedQuestions]);
    }
  };

  const removeOption = (index: number) => {
    const removedOption = questionForm.options[index];
    const newOptions = questionForm.options.filter((_, i) => i !== index);
    setQuestionForm({
      ...questionForm,
      options: newOptions,
      correctAnswers: questionForm.correctAnswers.filter(a => a !== removedOption),
      correctAnswer: questionForm.correctAnswer === removedOption ? '' : questionForm.correctAnswer,
    });
  };

  const addQuestion = () => {
    if (!questionForm.question.trim()) {
      alert('Question text is required');
      return;
    }
    if (!questionForm.section) {
      alert('Please select a section');
      return;
    }
    if (questionForm.marks <= 0) {
      alert('Question marks must be greater than zero');
      return;
    }
    if (questionForm.type === 'mcq' || questionForm.type === 'multiple') {
      const validOptions = questionForm.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        alert('Please add at least 2 options');
        return;
      }
      if (questionForm.type === 'mcq' && !questionForm.correctAnswer) {
        alert('Please select the correct answer');
        return;
      }
      if (questionForm.type === 'multiple' && questionForm.correctAnswers.length === 0) {
        alert('Please select at least one correct answer');
        return;
      }
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
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

    setQuestions([...questions, newQuestion]);
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

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const toggleCorrectAnswer = (option: string) => {
    const current = questionForm.correctAnswers;
    if (current.includes(option)) {
      setQuestionForm({ ...questionForm, correctAnswers: current.filter(a => a !== option) });
    } else {
      setQuestionForm({ ...questionForm, correctAnswers: [...current, option] });
    }
  };

  const getQuestionsBySection = (sectionId: string) => {
    return questions.filter(q => q.section === sectionId);
  };

  const handleSaveTest = async () => {
    if (!testName.trim()) { alert("Test name is required"); return; }
    if (questions.length === 0) { alert("Add at least one question before saving the test"); return; }
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
      setIsSaving(true);
      const sectionNames = sections.map(s => s.name);
      const questionsWithSectionNames = questions.map(q => {
        const sectionObj = sections.find(s => s.id === q.section);
        return { ...q, section: sectionObj ? sectionObj.name : q.section };
      });

      await apiPost("/admin/exams", {
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

      alert("Test saved successfully");
      onBack();
    } catch (err) {
      console.error(err);
      alert("Failed to save test");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="test-builder page-with-topbar">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">TEST MANAGEMENT</span>
          <h2>Create New Test</h2>
          <p>Configure the paper, organise sections and add answer-ready questions.</p>
        </div>
        <button className="secondary-btn" onClick={onBack}>
          ← Back to Tests
        </button>
      </div>

      <div className="builder-progress" aria-label="Test creation steps">
        <div className="progress-step active"><span>1</span><div><strong>Test details</strong><small>Name, timing and score</small></div></div>
        <div className={`progress-step ${sections.length ? 'active' : ''}`}><span>2</span><div><strong>Sections</strong><small>{sections.length} configured</small></div></div>
        <div className={`progress-step ${questions.length ? 'active' : ''}`}><span>3</span><div><strong>Questions</strong><small>{questions.length} added</small></div></div>
      </div>

      {/* ── Test Details ── */}
      <div className="form-card">
        <div className="card-heading">
          <div className="card-heading-icon">📝</div>
          <div><h3>Test Details</h3><p>Set the basic rules students will see for this examination.</p></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Test Name *</label>
            <input
              type="text"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              placeholder="Enter test name"
            />
          </div>
          <div className="form-group">
            <label>Duration (minutes) *</label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              placeholder="60"
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Passing Score (%) *</label>
            <input
              type="number"
              value={passingPercentage}
              onChange={e => setPassingPercentage(Number(e.target.value))}
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

        {/* ── Document Upload Option (Below Validity Window & Above Paper Sections) ── */}
        <DocumentQuestionUploader onParsed={handleDocumentParsed} />

        {/* ── Sections ── */}
        <div className="section-management">

          <div className="subsection-heading"><div><h4>Paper Sections</h4><p>Group questions into subjects such as Reasoning or English.</p></div><span>{sections.length} sections</span></div>
          <div className="section-tags">
            {sections.map(section => (
              <div key={section.id} className="section-chip">
                {editingSectionId === section.id ? (
                  <input
                    className="section-edit-input"
                    value={section.name}
                    autoFocus
                    onChange={e => setSections(sections.map(s =>
                      s.id === section.id ? { ...s, name: e.target.value } : s
                    ))}
                    onBlur={() => setEditingSectionId(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingSectionId(null); }}
                  />
                ) : (
                  <span className="section-name">{section.name}</span>
                )}
                <div className="section-actions">
                  <button type="button" className="icon-btn" title="Edit section"
                    onClick={() => setEditingSectionId(section.id)}>
                    ✏️
                  </button>
                  <button type="button" className="icon-btn danger" title="Delete section"
                    onClick={() => {
                      const remaining = sections.filter(s => s.id !== section.id);
                      setSections(remaining);
                      setQuestions(questions.filter(q => q.section !== section.id));
                      setQuestionForm(prev => ({
                        ...prev,
                        section: prev.section === section.id ? (remaining[0]?.id || '') : prev.section,
                      }));
                    }}>
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
              onChange={e => setNewSection(e.target.value)}
              placeholder="New section name"
              onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
            />
            <button className="primary-btn" onClick={addSection}>Add Section</button>
          </div>
        </div>
      </div>

      {/* ── Questions ── */}
      <div className="questions-section">
        <div className="section-header">
          <div><h3>Question Bank</h3><p>{questions.length} questions • {questions.reduce((sum, q) => sum + q.marks, 0)} total marks</p></div>
          <button className="primary-btn" onClick={() => setShowQuestionForm(!showQuestionForm)}>
            {showQuestionForm ? 'Cancel' : '+ Add Question'}
          </button>
        </div>

        {showQuestionForm && (
          <div className="question-form">
            <div className="form-row">
              <div className="form-group">
                <label>Question Type *</label>
                <select value={questionForm.type}
                  onChange={e => setQuestionForm({ ...questionForm, type: e.target.value as any })}>
                  <option value="mcq">Single Choice (MCQ)</option>
                  <option value="multiple">Multiple Correct Answers</option>
                  <option value="text">Text Answer</option>
                </select>
              </div>
              <div className="form-group">
                <label>Section *</label>
                <select value={questionForm.section}
                  onChange={e => setQuestionForm({ ...questionForm, section: e.target.value })}>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Marks *</label>
                <input type="number" value={questionForm.marks} min="1"
                  onChange={e => setQuestionForm({ ...questionForm, marks: Number(e.target.value) })} />
              </div>
            </div>

            <div className="form-group">
              <label>Question *</label>
              <textarea value={questionForm.question} rows={3}
                onChange={e => setQuestionForm({ ...questionForm, question: e.target.value })}
                placeholder="Enter your question" />
            </div>

            {(questionForm.type === 'mcq' || questionForm.type === 'multiple') && (
              <div className="options-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label>Options * (minimum 2)</label>
                  <button type="button" className="primary-btn"
                    onClick={addOption} style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                    + Add Option
                  </button>
                </div>
                {questionForm.options.map((option, index) => (
                  <div key={index} className="option-input">
                    <input type="text" value={option} placeholder={`Option ${index + 1}`}
                      onChange={e => handleOptionChange(index, e.target.value)} />
                    {questionForm.type === 'mcq' ? (
                      <input type="radio" name="correct"
                        checked={questionForm.correctAnswer === option}
                        onChange={() => setQuestionForm({ ...questionForm, correctAnswer: option })} />
                    ) : (
                      <input type="checkbox"
                        checked={questionForm.correctAnswers.includes(option)}
                        onChange={() => toggleCorrectAnswer(option)} />
                    )}
                    <span className="option-label">Correct</span>
                    {questionForm.options.length > 2 && (
                      <button type="button" className="icon-btn danger"
                        onClick={() => removeOption(index)} title="Remove option"
                        style={{ marginLeft: '0.5rem' }}>
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
                <textarea value={questionForm.correctAnswer} rows={3}
                  onChange={e => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                  placeholder="Enter model answer" />
              </div>
            )}

            <div className="form-actions">
              <button className="primary-btn" onClick={addQuestion}>Add Question</button>
            </div>
          </div>
        )}

        {sections.map(section => {
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
                      <button className="delete-icon" onClick={() => deleteQuestion(q.id)}>✕</button>
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
        <div className="builder-save-bar">
          <div><strong>Ready to publish?</strong><span>{questions.length} questions across {sections.length} sections</span></div>
          <button className="primary-btn large" onClick={handleSaveTest} disabled={isSaving}>
            {isSaving ? 'Saving Test…' : 'Save & Publish Test'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TestBuilder;
