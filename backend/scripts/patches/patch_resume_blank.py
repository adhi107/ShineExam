import os

# 1. Patch TestInterface.tsx
with open('frontend/src/components/TestInterface.tsx', 'r', encoding='utf-8') as f:
    ti_text = f.read()

# Replace line 204
target_204 = "const restoredIdx = Math.min(Math.max(0, res.currentQuestionIndex || 0), questions.length - 1);"
replace_204 = "const maxIdx = Math.max(0, (questions?.length || 1) - 1);\n          const restoredIdx = Math.min(Math.max(0, res.currentQuestionIndex || 0), maxIdx);"

if target_204 in ti_text:
    ti_text = ti_text.replace(target_204, replace_204, 1)
    print("Patched restoredIdx in TestInterface")
else:
    print("Warning: target_204 not found")

# Replace line 442
target_442 = "const activeQuestion = questions[currentQuestionIndex];"
replace_442 = """const safeQuestionIndex = (questions && questions.length > 0)
    ? Math.min(Math.max(0, currentQuestionIndex), questions.length - 1)
    : 0;
  const activeQuestion = (questions && questions.length > 0)
    ? (questions[safeQuestionIndex] || questions[0])
    : null;"""

if target_442 in ti_text:
    ti_text = ti_text.replace(target_442, replace_442, 1)
    print("Patched activeQuestion in TestInterface")
else:
    print("Warning: target_442 not found")

# Add fallback empty card before exam workspace
target_exam = '{testStep === "exam" && activeQuestion && ('
replace_exam = """{testStep === "exam" && (!activeQuestion || !questions || questions.length === 0) && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f4f9',
          padding: '24px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '36px 32px',
            maxWidth: '540px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 39, 76, 0.08)',
            border: '1px solid #cbd5e1'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📋</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
              No Questions Configured
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '28px' }}>
              This assessment ({testName}) does not have any active questions available at this time. Please contact your administrator.
            </p>
            <button
              type="button"
              className="primary-btn large"
              onClick={onExit}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                background: '#2b78c4',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              ← Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {testStep === "exam" && activeQuestion && ("""

if target_exam in ti_text:
    ti_text = ti_text.replace(target_exam, replace_exam, 1)
    print("Patched fallback exam view in TestInterface")
else:
    print("Warning: target_exam not found")

with open('frontend/src/components/TestInterface.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(ti_text)


# 2. Patch AnswererDashboard.tsx
with open('frontend/src/components/AnswererDashboard.tsx', 'r', encoding='utf-8') as f:
    ad_text = f.read()

target_start = """  const startExam = async (examId: string) => {
    setStartingId(examId);
    try {
      const res = await apiGet<{ test: ExamForTaking }>(`/answerer/tests/${examId}?userId=${encodeURIComponent(userName)}`);
      setActiveExam(res.test);
      navigate("/dashboard/tests");"""

replace_start = """  const startExam = async (examId: string) => {
    setStartingId(examId);
    try {
      const res = await apiGet<{ test: ExamForTaking }>(`/answerer/tests/${examId}?userId=${encodeURIComponent(userName)}`);
      if (!res.test.questions || res.test.questions.length === 0) {
        alert("This test has no questions configured yet. Please contact your administrator.");
        return;
      }
      setActiveExam(res.test);
      navigate("/dashboard/tests");"""

if target_start in ad_text:
    ad_text = ad_text.replace(target_start, replace_start, 1)
    print("Patched startExam validation in AnswererDashboard")
else:
    print("Warning: target_start not found in AnswererDashboard")

with open('frontend/src/components/AnswererDashboard.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(ad_text)
print("Done patching.")

