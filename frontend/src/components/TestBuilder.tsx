// Shine Exam test builder for creating and publishing question papers.
import React, { useEffect, useState } from 'react';
import './TestBuilder.css';
import { apiGet, apiPost } from "../services/api";
import type { ExamCategory } from "./ExamCategoryManagement";
import { DocumentQuestionUploader } from "./DocumentQuestionUploader";
import { ParsedQuestionPreview } from "./ParsedQuestionPreview";
import { SharedParsedQuestion } from "../types/visual";

type Question = SharedParsedQuestion;

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
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSection, setNewSection] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSetModal, setShowSetModal] = useState(false);
  const [setForm, setSetForm] = useState({
    title: 'Directions (Q1–5): Read the passage / study the data carefully and answer the questions.',
    contextType: 'passage' as 'passage' | 'table' | 'graph',
    contextBody: '',
    numQuestions: 5,
    sectionId: sections[0]?.id || '',
    marks: 1,
  });

  const applyPreset = (presetType: 'sbi' | 'ssc' | 'rrb') => {
    if (presetType === 'sbi') {
      setTestName(prev => prev || 'SBI PO Prelims Mock Test');
      setDuration(60);
      setPassingPercentage(45);
      setSections([
        { id: 'sec_qa', name: 'Quantitative Aptitude' },
        { id: 'sec_reasoning', name: 'Reasoning Ability' },
        { id: 'sec_english', name: 'English Language' }
      ]);
      setQuestionForm(prev => ({ ...prev, section: 'sec_qa' }));
    } else if (presetType === 'ssc') {
      setTestName(prev => prev || 'SSC CGL Tier-1 Official Pattern Mock');
      setDuration(60);
      setPassingPercentage(40);
      setSections([
        { id: 'sec_gi', name: 'General Intelligence & Reasoning' },
        { id: 'sec_ga', name: 'General Awareness' },
        { id: 'sec_quant', name: 'Quantitative Aptitude' },
        { id: 'sec_english', name: 'English Comprehension' }
      ]);
      setQuestionForm(prev => ({ ...prev, section: 'sec_gi' }));
    } else if (presetType === 'rrb') {
      setTestName(prev => prev || 'RRB NTPC CBT-1 Full Length Mock');
      setDuration(90);
      setPassingPercentage(40);
      setSections([
        { id: 'sec_math', name: 'Mathematics' },
        { id: 'sec_reasoning', name: 'General Intelligence & Reasoning' },
        { id: 'sec_ga', name: 'General Awareness' }
      ]);
      setQuestionForm(prev => ({ ...prev, section: 'sec_math' }));
    }
  };

  const handleCreateQuestionSet = () => {
    const bodyText = setForm.contextBody.trim();
    if (!bodyText) {
      alert('Please enter the passage text or table data for the question set.');
      return;
    }
    const fullContext = setForm.title.trim() ? `${setForm.title.trim()}\n${bodyText}` : bodyText;
    const targetSection = setForm.sectionId || sections[0]?.id || 'general';
    const count = Math.max(1, setForm.numQuestions || 5);

    const newSetQuestions: Question[] = [];
    for (let i = 1; i <= count; i++) {
      newSetQuestions.push({
        id: `q_set_${Date.now()}_${i}`,
        type: 'mcq',
        question: `Question ${i} based on the given ${setForm.contextType === 'table' ? 'data table' : setForm.contextType === 'graph' ? 'diagram' : 'passage'}:`,
        context: fullContext,
        contextType: setForm.contextType,
        options: [`Option A for Q${i}`, `Option B for Q${i}`, `Option C for Q${i}`, `Option D for Q${i}`],
        correctAnswer: `Option A for Q${i}`,
        section: targetSection,
        marks: setForm.marks || 1,
        negativeMarks: 0.25,
      });
    }

    setQuestions(prev => [...prev, ...newSetQuestions]);
    setShowSetModal(false);
    setSetForm(prev => ({ ...prev, contextBody: '' }));
  };

  const [questionForm, setQuestionForm] = useState({
    type: 'mcq' as 'mcq' | 'multiple' | 'text',
    question: '',
    context: '',
    contextType: '' as 'table' | 'passage' | 'graph' | '',
    options: ['', ''],
    correctAnswer: '',
    correctAnswers: [] as string[],
    section: sections[0]?.id || '',
    marks: 1,
  });


  useEffect(() => {
    apiGet<{ categories: ExamCategory[] }>("/admin/exam-categories").then(res => {
      const items = res.categories || [];
      setCategories(items);
      const first = items[0];
      const sub = first?.subcategories[0];
      setCategoryId(first?.id || '');
      setSubcategoryId(sub?.id || '');
      setStage(sub?.stages[0] || '');
    }).catch(console.error);
  }, []);

  const selectedCategory = categories.find(item => item.id === categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(item => item.id === subcategoryId);
  
  const changeCategory = (value: string) => {
    const category = categories.find(item => item.id === value);
    const sub = category?.subcategories[0];
    setCategoryId(value);
    setSubcategoryId(sub?.id || '');
    setStage(sub?.stages[0] || '');
  };
  
  const changeSubcategory = (value: string) => {
    const sub = selectedCategory?.subcategories.find(item => item.id === value);
    setSubcategoryId(value);
    setStage(sub?.stages[0] || '');
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
      context: q.context || '',
      contextType: q.contextType || '',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      section: secIdMap[q.section] || updatedSections[0].id,
      marks: q.marks || 1,
      negativeMarks: q.negativeMarks || 0,
      chartData: (q as any).chartData || null,
      tableData: (q as any).tableData || null,
      imageReference: (q as any).imageReference || (q as any).visual_asset || '',
      visualReferences: (q as any).visualReferences || (q as any).visuals || [],
      groupId: (q as any).groupId || (q as any).sharedContentId || '',
      sharedContentId: (q as any).sharedContentId || (q as any).groupId || '',
      questionRange: (q as any).questionRange,
      sharedContent: (q as any).sharedContent,
      visualId: (q as any).visualId || '',
      visualIds: (q as any).visualIds || [],
      mappingStatus: (q as any).mappingStatus || '',
      mappingConfidence: (q as any).mappingConfidence || '',
    }));

    setSections(updatedSections);
    if (mode === 'replace') {
      setQuestions(formattedQuestions);
    } else {
      setQuestions(prev => [...prev, ...formattedQuestions]);
    }
  };

  const addSection = () => {
    const name = newSection.trim();
    if (!name) return;
    if (sections.some(s => s.name.toLowerCase() === name.toLowerCase())) return;

    setSections([...sections, { id: Date.now().toString(), name }]);
    setNewSection('');
  };

  const addOption = () => {
    setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] });
  };

  const removeOption = (index: number) => {
    const newOptions = questionForm.options.filter((_, i) => i !== index);
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

  const handleEditQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setQuestionForm({
      type: question.type,
      question: question.question,
      context: question.context || '',
      contextType: question.contextType || '',
      options: question.options && question.options.length > 0 ? [...question.options] : ['', ''],
      correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
      correctAnswers: Array.isArray(question.correctAnswer) ? [...question.correctAnswer] : [],
      section: question.section,
      marks: question.marks,
    });
    setShowQuestionForm(true);

    setTimeout(() => {
      const el = document.getElementById(`builder-question-editor-${question.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionForm({
      type: 'mcq',
      question: '',
      context: '',
      contextType: '',
      options: ['', ''],
      correctAnswer: '',
      correctAnswers: [],
      section: sections[0]?.id || '',
      marks: 1,
    });
    setShowQuestionForm(false);
  };

  const addQuestion = () => {
    if (questionForm.question.trim() === '') {
      alert('Please enter a question');
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

    const nextQuestionId = editingQuestionId || Date.now().toString();
    const newQuestion: Question = {
      id: nextQuestionId,
      type: questionForm.type,
      question: questionForm.question,
      context: questionForm.context,
      contextType: questionForm.contextType,
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
      context: '',
      contextType: '',
      options: ['', ''],
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
      resetQuestionForm();
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

  const renderQuestionFormCard = (targetId: string | null = null) => {
    const isEditing = targetId !== null;
    return (
      <div
        id={isEditing ? `builder-question-editor-${targetId}` : 'builder-new-question-form'}
        className={`question-form ${isEditing ? 'editing-question-card' : ''}`}
      >
        <div className="form-header-badge">
          {isEditing ? '✏️ EDIT QUESTION' : '✨ NEW QUESTION'}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Question Type *</label>
            <select
              value={questionForm.type}
              onChange={e => setQuestionForm({ ...questionForm, type: e.target.value as any })}
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
              onChange={e => setQuestionForm({ ...questionForm, section: e.target.value })}
            >
              {sections.map(section => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Marks *</label>
            <input
              type="number"
              value={questionForm.marks}
              min="1"
              onChange={e => setQuestionForm({ ...questionForm, marks: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label>Question *</label>
            <label className="preset-chip" style={{ cursor: 'pointer', margin: 0, padding: '0.25rem 0.65rem' }}>
              📷 Attach Image to Question
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const dataUri = ev.target?.result as string;
                      if (dataUri) {
                        setQuestionForm(prev => ({
                          ...prev,
                          question: prev.question ? `${prev.question}\n![Question Diagram](${dataUri})` : `![Question Diagram](${dataUri})`
                        }));
                      }
                    };
                    reader.readAsDataURL(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
          <textarea
            value={questionForm.question}
            rows={3}
            onChange={e => setQuestionForm({ ...questionForm, question: e.target.value })}
            placeholder="Enter your question text or formula"
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label>Shared passage / table / graph context</label>
            <label className="preset-chip" style={{ cursor: 'pointer', margin: 0, padding: '0.25rem 0.65rem' }}>
              📊 Upload Bar Graph / Diagram Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const dataUri = ev.target?.result as string;
                      if (dataUri) {
                        setQuestionForm(prev => ({
                          ...prev,
                          context: prev.context ? `${prev.context}\n![Shared Diagram](${dataUri})` : `![Shared Diagram](${dataUri})`,
                          contextType: prev.contextType || 'graph'
                        }));
                      }
                    };
                    reader.readAsDataURL(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
          <textarea
            value={questionForm.context}
            rows={4}
            onChange={e => setQuestionForm({ ...questionForm, context: e.target.value })}
            placeholder="Optional shared context for passage, table, DI, caselet or graph-based questions"
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
                  placeholder={`Option ${index + 1}`}
                  onChange={e => handleOptionChange(index, e.target.value)}
                />
                {questionForm.type === 'mcq' ? (
                  <input
                    type="radio"
                    name={`builder-correct-${targetId || 'new'}`}
                    checked={questionForm.correctAnswer === option}
                    onChange={() => setQuestionForm({ ...questionForm, correctAnswer: option })}
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
              rows={3}
              onChange={e => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
              placeholder="Enter model answer"
            />
          </div>
        )}

        <div className="form-actions">
          <button className="primary-btn" onClick={addQuestion}>
            {isEditing ? 'Update Question' : 'Add Question'}
          </button>
          <button className="secondary-btn" onClick={resetQuestionForm}>
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="test-builder page-with-topbar">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">TEST MANAGEMENT</span>
          <h2>Create New Test</h2>
          <p>Configure the paper, organise sections and add answer-ready questions.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="secondary-btn" onClick={onBack}>
            ← Back to Tests
          </button>
          <button className="primary-btn header-save-btn" onClick={handleSaveTest} disabled={isSaving}>
            {isSaving ? "Saving..." : "💾 Save Test"}
          </button>
        </div>
      </div>

      <div className="builder-progress" aria-label="Test creation steps">
        <div className="progress-step active"><span>1</span><div><strong>Test details</strong><small>Name, timing and score</small></div></div>
        <div className={`progress-step ${sections.length ? 'active' : ''}`}><span>2</span><div><strong>Sections</strong><small>{sections.length} configured</small></div></div>
        <div className={`progress-step ${questions.length ? 'active' : ''}`}><span>3</span><div><strong>Questions</strong><small>{questions.length} added</small></div></div>
      </div>

      <div className="form-card">
        <div className="card-heading">
          <div className="card-heading-icon">📝</div>
          <div><h3>Test Details</h3><p>Set the basic rules students will see for this examination.</p></div>
        </div>

        <div className="preset-quick-bar">
          <span className="preset-label">⚡ Quick Exam Presets:</span>
          <button type="button" className="preset-chip" onClick={() => applyPreset('sbi')}>🏦 SBI PO / IBPS PO Pattern</button>
          <button type="button" className="preset-chip" onClick={() => applyPreset('ssc')}>🏛️ SSC CGL Tier-1 Pattern</button>
          <button type="button" className="preset-chip" onClick={() => applyPreset('rrb')}>🚆 RRB NTPC Pattern</button>
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
          <div className="form-group"><label>Category *</label><select value={categoryId} onChange={e => changeCategory(e.target.value)}><option value="">Select category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label>Subcategory *</label><select value={subcategoryId} onChange={e => changeSubcategory(e.target.value)}><option value="">Select subcategory</option>{selectedCategory?.subcategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="form-group"><label>Stage *</label><select value={stage} onChange={e => setStage(e.target.value)}><option value="">Select stage</option>{selectedSubcategory?.stages.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>

        <div className="validity-row">
          <div className="validity-copy"><span>TEST AVAILABILITY</span><strong>Validity window</strong><p>Students can start this paper only within these dates.</p></div>
          <div className="form-group"><label>Available from *</label><input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} /></div>
          <div className="form-group"><label>Valid until *</label><input type="date" min={availableFrom} value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
        </div>

        <DocumentQuestionUploader onParsed={handleDocumentParsed} />

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
          <div className="section-bottom-row">
            <div className="add-section">
              <input
                type="text"
                value={newSection}
                onChange={e => setNewSection(e.target.value)}
                placeholder="New section name"
                onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
              />
              <button type="button" className="primary-btn" onClick={addSection}>Add Section</button>
            </div>
            <button
              type="button"
              className="save-test-btn-action"
              onClick={handleSaveTest}
              disabled={isSaving}
              title="Save and publish this exam"
            >
              {isSaving ? "Saving Test..." : "💾 Save Test"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Questions ── */}
      <div className="questions-section">
        <div className="section-header">
          <div><h3>Question Bank</h3><p>{questions.length} questions • {questions.reduce((sum, q) => sum + q.marks, 0)} total marks</p></div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="secondary-btn" onClick={() => setShowSetModal(true)}>
              📖 + Add Passage / DI Set (5 Questions)
            </button>
            <button className="primary-btn" onClick={() => {
              if (showQuestionForm && !editingQuestionId) {
                resetQuestionForm();
                return;
              }
              setEditingQuestionId(null);
              setShowQuestionForm(!showQuestionForm);
            }}>
              {showQuestionForm && !editingQuestionId ? 'Cancel' : '+ Add Single Question'}
            </button>
          </div>
        </div>

        {/* Modal for 5-Question Set Generator */}
        {showSetModal && (
          <div className="modal-backdrop">
            <div className="set-modal-card">
              <h3>📖 Add Shared Passage / DI Question Set</h3>
              <p>Map 5 (or custom) questions under one shared paragraph, table, or graph context.</p>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Set Type & Format *</label>
                <select
                  value={setForm.contextType}
                  onChange={e => setSetForm({ ...setForm, contextType: e.target.value as any })}
                >
                  <option value="passage">Reading Comprehension / Caselet Passage</option>
                  <option value="table">Data Interpretation Table</option>
                  <option value="graph">Data Interpretation Graph / Chart Image</option>
                </select>
              </div>

              <div className="form-group">
                <label>Direction Line / Title *</label>
                <input
                  type="text"
                  value={setForm.title}
                  onChange={e => setSetForm({ ...setForm, title: e.target.value })}
                  placeholder="Directions (Q1-5): Read the passage and answer..."
                />
              </div>

              <div className="form-group">
                <label>Passage Paragraph Text or Table Data *</label>
                <textarea
                  rows={6}
                  value={setForm.contextBody}
                  onChange={e => setSetForm({ ...setForm, contextBody: e.target.value })}
                  placeholder={setForm.contextType === 'table' ? '| Branch | Accounts |\n| Branch A | 120 |\n| Branch B | 450 |' : 'Enter paragraph text or graph description here...'}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Target Section *</label>
                  <select
                    value={setForm.sectionId}
                    onChange={e => setSetForm({ ...setForm, sectionId: e.target.value })}
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Number of Questions *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={setForm.numQuestions}
                    onChange={e => setSetForm({ ...setForm, numQuestions: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowSetModal(false)}>Cancel</button>
                <button type="button" className="primary-btn" onClick={handleCreateQuestionSet}>✨ Generate Question Set</button>
              </div>
            </div>
          </div>
        )}


        {showQuestionForm && !editingQuestionId && renderQuestionFormCard(null)}

        {sections.map(section => {
          const sectionQuestions = getQuestionsBySection(section.id);
          if (sectionQuestions.length === 0) return null;
          return (
            <div key={section.id} className="section-block">
              <h4>{section.name} ({sectionQuestions.length} questions)</h4>
              <div className="questions-list">
                {sectionQuestions.map((q, index) => {
                  if (editingQuestionId === q.id) {
                    return <React.Fragment key={q.id}>{renderQuestionFormCard(q.id)}</React.Fragment>;
                  }
                  return (
                    <div key={q.id} id={`builder-question-card-${q.id}`} className="question-card">
                      <div className="question-header">
                        <span className="question-number">Q{index + 1}</span>
                        <span className="question-type">{q.type.toUpperCase()}</span>
                        <span className="question-marks">{q.marks} marks</span>
                        <button
                          className="question-edit-btn"
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
                      <ParsedQuestionPreview
                        question={q.question}
                        context={q.context}
                        contextType={q.contextType}
                        chartData={q.chartData}
                        tableData={q.tableData}
                        imageReference={q.imageReference}
                        visualReferences={q.visualReferences}
                        mappingStatus={q.mappingStatus}
                        mappingConfidence={q.mappingConfidence}
                      />
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
                  );
                })}
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
