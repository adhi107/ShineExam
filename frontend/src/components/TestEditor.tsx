import React, { useState, useEffect } from 'react';
import './TestBuilder.css';
import { apiGet, apiPut } from "../services/api";
import type { ExamCategory } from "./ExamCategoryManagement";
import { DocumentQuestionUploader } from "./DocumentQuestionUploader";
import { ParsedQuestionPreview } from "./ParsedQuestionPreview";

interface Question {
  id: string;
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
  sharedContentId?: string;
  questionRange?: { start: number; end: number };
  sharedContent?: any;
  visualId?: string;
  visualIds?: string[];
  mappingStatus?: string;
  mappingConfidence?: string;
  validationStatus?: 'passed' | 'failed';
  validationError?: string;
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
    loadTest();
    apiGet<{ categories: ExamCategory[] }>("/admin/exam-categories")
      .then(res => setCategories(res.categories || []))
      .catch(console.error);
  }, [testId]);

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

      const normalizedSections = (test.sections || ['General'])
        .map((s: any) => typeof s === 'string' ? s : s.name)
        .map((s: string) => s?.trim())
        .filter((s: string) => s);

      const sectionObjects = normalizedSections.map((name: string, index: number) => ({
        id: `section-${index}`,
        name: name
      }));

      setSections(sectionObjects);

      const loadedQuestions: Question[] = (test.questions || []).map((q: any) => {
        const sectionName = q.section?.trim() || 'General';
        const sectionObj = sectionObjects.find((s: Section) => s.name === sectionName);
        const sectionId = sectionObj ? sectionObj.id : sectionObjects[0]?.id || 'general';

        return {
          id: q.id || q._id,
          type: q.type,
          question: q.question,
          context: q.context || '',
          contextType: q.contextType || '',
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          section: sectionId,
          marks: q.marks || 1,
          negativeMarks: q.negativeMarks || 0,
          chartData: q.chartData || null,
          tableData: q.tableData || null,
          imageReference: q.imageReference || q.visual_asset || '',
          visualReferences: q.visualReferences || q.visuals || [],
          groupId: q.groupId || q.sharedContentId || '',
          sharedContentId: q.sharedContentId || q.groupId || '',
          questionRange: q.questionRange,
          sharedContent: q.sharedContent,
          visualId: q.visualId || '',
          visualIds: q.visualIds || [],
          mappingStatus: q.mappingStatus || '',
          mappingConfidence: q.mappingConfidence || '',
        };
      });

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

  const addOption = () => {
    setQuestionForm({
      ...questionForm,
      options: [...questionForm.options, '']
    });
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

  const addQuestion = () => {
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
      setEditingQuestionId(null);
      setShowQuestionForm(false);
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
      const el = document.getElementById(`question-editor-${question.id}`);
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

  const renderQuestionFormCard = (targetId: string | null = null) => {
    const isEditing = targetId !== null;
    return (
      <div
        id={isEditing ? `question-editor-${targetId}` : 'new-question-form'}
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
            onChange={(e) =>
              setQuestionForm({ ...questionForm, question: e.target.value })
            }
            placeholder="Enter your question text or formula"
            rows={3}
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
            onChange={(e) =>
              setQuestionForm({ ...questionForm, context: e.target.value })
            }
            placeholder="Optional shared context for passage, table, DI, caselet or graph-based questions"
            rows={4}
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
                    name={`correct-${targetId || 'new'}`}
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
            {isEditing ? 'Update Question' : 'Add Question'}
          </button>
          <button className="secondary-btn" onClick={resetQuestionForm}>
            Cancel
          </button>
        </div>
      </div>
    );
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
    if (!categoryId || !subcategoryId || !stage) {
      alert("Select an exam category, subcategory and stage");
      return;
    }

    try {
      const sectionNames = sections.map(s => s.name);
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
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to update test");
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
        <div>
          <span className="page-eyebrow">EDIT TEST</span>
          <h2>Edit Test: {testName}</h2>
          <p>Modify test details, timing, sections and questions.</p>
        </div>
        <button className="secondary-btn" onClick={onBack}>
          ← Back to Tests
        </button>
      </div>

      <div className="form-card">
        <div className="card-heading">
          <div className="card-heading-icon">📝</div>
          <div>
            <h3>Test Details</h3>
            <p>Update basic rules and metadata for this test.</p>
          </div>
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
          <div className="validity-copy">
            <span>EXAM CLASSIFICATION</span>
            <strong>My Tests location</strong>
            <p>This controls where the test appears in the candidate sidebar.</p>
          </div>
          <div className="form-group">
            <label>Category *</label>
            <select value={categoryId} onChange={e => changeCategory(e.target.value)}>
              <option value="">Select category</option>
              {categories.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Subcategory *</label>
            <select value={subcategoryId} onChange={e => changeSubcategory(e.target.value)}>
              <option value="">Select subcategory</option>
              {selectedCategory?.subcategories.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Stage *</label>
            <select value={stage} onChange={e => setStage(e.target.value)}>
              <option value="">Select stage</option>
              {selectedSubcategory?.stages.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="validity-row">
          <div className="validity-copy">
            <span>TEST AVAILABILITY</span>
            <strong>Validity window</strong>
            <p>Students can start this paper only within these dates.</p>
          </div>
          <div className="form-group">
            <label>Available from *</label>
            <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Valid until *</label>
            <input type="date" min={availableFrom} value={validUntil} onChange={e => setValidUntil(e.target.value)} />
          </div>
        </div>

        {/* ── Document Upload Option ── */}
        <DocumentQuestionUploader onParsed={handleDocumentParsed} />

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
                      setQuestionForm((prev) => ({
                        ...prev,
                        section: prev.section === section.id ? remainingSections[0]?.id || '' : prev.section,
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
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="secondary-btn" onClick={() => setShowSetModal(true)}>
              📖 + Add Passage / DI Set (5 Questions)
            </button>
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

        {sections.map((section) => {
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
                    <div key={q.id} id={`question-card-${q.id}`} className="question-card">
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
          <div>
            <strong>Ready to update?</strong>
            <span>{questions.length} questions across {sections.length} sections</span>
          </div>
          <button className="primary-btn large" onClick={handleUpdateTest}>
            Update Test
          </button>
        </div>
      )}
    </div>
  );
};

export default TestEditor;
