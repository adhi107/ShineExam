import re
from pathlib import Path

# ─────────────────────────────────────────────────────────────────
# 1. Patch TestInterface.tsx
# ─────────────────────────────────────────────────────────────────
ti_path = Path("frontend/src/components/TestInterface.tsx")
ti_content = ti_path.read_text(encoding="utf-8")

old_props_regex = re.compile(
    r'interface TestInterfaceProps\s*\{.*?'
    r'  sectionConfig\?: Array<\{ name: string; duration: number; questionCount: number; marks: number \}>;\s*\n'
    r'  onExit: \(\) => void;\s*\n'
    r'\}\s*\n\s*'
    r'const TestInterface: React\.FC<TestInterfaceProps> = \(\{\s*\n'
    r'  userId,\s*\n'
    r'  examId,\s*\n'
    r'  testName,\s*\n'
    r'  duration,\s*\n'
    r'  passingPercentage = 40,\s*\n'
    r'  questions,\s*\n'
    r'  timerMode = "overall",\s*\n'
    r'  sectionConfig = \[\],\s*\n'
    r'  onExit,\s*\n'
    r'\}\) => \{',
    re.DOTALL
)

new_props = '''interface TestInterfaceProps {
  userId: string;
  examId: string;
  testName: string;
  duration: number;
  passingPercentage?: number;
  questions: Question[];
  timerMode?: "overall" | "sectional";
  sectionConfig?: Array<{ name: string; duration: number; questionCount: number; marks: number }>;
  negativeMarkingScheme?: string;
  negativeMarks?: number;
  isSeries?: boolean;
  seriesId?: string;
  paperId?: string;
  customInstructions?: string;
  onExit: () => void;
}

const TestInterface: React.FC<TestInterfaceProps> = ({
  userId,
  examId,
  testName,
  duration,
  passingPercentage = 40,
  questions,
  timerMode = "overall",
  sectionConfig = [],
  negativeMarkingScheme = "quarter",
  negativeMarks = 0.25,
  isSeries = false,
  seriesId,
  paperId,
  customInstructions,
  onExit,
}) => {'''

if old_props_regex.search(ti_content):
    ti_content = old_props_regex.sub(new_props, ti_content, count=1)

# Pass paperId and seriesId in save
old_save_regex = re.compile(
    r'apiPost\("/answerer/attempts/save",\s*\{\s*\n'
    r'\s*attemptId: attemptId \|\| "current",\s*\n'
    r'\s*examId,\s*\n'
    r'\s*userId,\s*\n',
    re.DOTALL
)
new_save = '''apiPost("/answerer/attempts/save", {
          attemptId: attemptId || "current",
          examId,
          paperId: paperId || examId,
          seriesId,
          isSeries,
          userId,
'''
if old_save_regex.search(ti_content):
    ti_content = old_save_regex.sub(new_save, ti_content, count=1)

# Pass paperId and seriesId in submit
old_submit_regex = re.compile(
    r'const res = await apiPost<any>\("/answerer/attempts/submit",\s*\{\s*\n'
    r'\s*userId,\s*\n'
    r'\s*examId,\s*\n'
    r'\s*answers,\s*\n'
    r'\s*timeSpentSec: duration \* 60 - timeLeft,\s*\n'
    r'\s*questionTimes,\s*\n'
    r'\s*\}\);',
    re.DOTALL
)
new_submit = '''const res = await apiPost<any>("/answerer/attempts/submit", {
        userId,
        examId,
        paperId: paperId || examId,
        seriesId,
        isSeries,
        answers,
        timeSpentSec: duration * 60 - timeLeft,
        questionTimes,
      });'''
if old_submit_regex.search(ti_content):
    ti_content = old_submit_regex.sub(new_submit, ti_content, count=1)

# Pass dynamic props to TestInstructions
old_instr_regex = re.compile(
    r'\{testStep === "instructions" && \(\s*\n'
    r'\s*<TestInstructions\s*\n'
    r'\s*userId=\{userId\}\s*\n'
    r'\s*testName=\{testName\}\s*\n'
    r'\s*duration=\{duration\}\s*\n'
    r'\s*timerMode=\{timerMode\}\s*\n'
    r'\s*sectionConfig=\{sectionConfig\}\s*\n'
    r'\s*onStart=\{\(\) => setTestStep\("exam"\)\}\s*\n'
    r'\s*onBack=\{\(\) => setTestStep\("details"\)\}\s*\n'
    r'\s*/>\s*\n'
    r'\s*\)\}',
    re.DOTALL
)
new_instr = '''{testStep === "instructions" && (
        <TestInstructions
          userId={userId}
          testName={testName}
          duration={duration}
          timerMode={timerMode}
          sectionConfig={sectionConfig}
          questions={questions}
          negativeMarkingScheme={negativeMarkingScheme}
          negativeMarks={negativeMarks}
          passingPercentage={passingPercentage}
          customInstructions={customInstructions}
          isSeries={isSeries}
          onStart={() => setTestStep("exam")}
          onBack={() => setTestStep("details")}
        />
      )}'''
if old_instr_regex.search(ti_content):
    ti_content = old_instr_regex.sub(new_instr, ti_content, count=1)

ti_path.write_text(ti_content, encoding="utf-8")
print("SUCCESS: TestInterface.tsx updated!")


# ─────────────────────────────────────────────────────────────────
# 2. Patch AnswererDashboard.tsx
# ─────────────────────────────────────────────────────────────────
ad_path = Path("frontend/src/components/AnswererDashboard.tsx")
ad_content = ad_path.read_text(encoding="utf-8")

# In AnswererDashboard, update ActiveExam type and rendering
old_active_regex = re.compile(
    r'<TestInterface userId=\{userName\} examId=\{activeExam\.id\} testName=\{activeExam\.testName\}\s*\n'
    r'\s*duration=\{activeExam\.duration\} passingPercentage=\{activeExam\.passingPercentage\}\s*\n'
    r'\s*timerMode=\{activeExam\.timerMode\} sectionConfig=\{activeExam\.sectionConfig\}\s*\n'
    r'\s*questions=\{activeExam\.questions\} onExit=\{exitExam\} />',
    re.DOTALL
)
new_active = '''<TestInterface
      userId={userName}
      examId={activeExam.id}
      testName={activeExam.testName}
      duration={activeExam.duration}
      passingPercentage={activeExam.passingPercentage}
      timerMode={activeExam.timerMode}
      sectionConfig={activeExam.sectionConfig}
      questions={activeExam.questions}
      negativeMarkingScheme={activeExam.negativeMarkingScheme}
      negativeMarks={activeExam.negativeMarks}
      isSeries={activeExam.isSeries}
      seriesId={activeExam.seriesId}
      paperId={activeExam.paperId}
      customInstructions={activeExam.customInstructions}
      onExit={exitExam}
    />'''
if old_active_regex.search(ad_content):
    ad_content = old_active_regex.sub(new_active, ad_content, count=1)

# In AnswererDashboard, update onStartExam from test-series
old_ts_start_regex = re.compile(
    r'onStartExam=\{\(examData: any\) => \{\s*\n'
    r'\s*setActiveExam\(\{\s*\n'
    r'\s*id: examData\.paperId \|\| examData\.id,\s*\n'
    r'\s*testName: examData\.testName,\s*\n'
    r'\s*duration: examData\.duration,\s*\n'
    r'\s*passingPercentage: examData\.passingPercentage,\s*\n'
    r'\s*questions: examData\.questions \|\| \[\],',
    re.DOTALL
)
new_ts_start = '''onStartExam={(examData: any) => {
              setActiveExam({
                id: examData.paperId || examData.id,
                testName: examData.testName,
                duration: examData.duration,
                passingPercentage: examData.passingPercentage,
                questions: examData.questions || [],
                timerMode: examData.timerMode || "overall",
                sectionConfig: examData.sectionConfig || [],
                negativeMarkingScheme: examData.negativeMarkingScheme || "quarter",
                negativeMarks: examData.negativeMarks,
                isSeries: true,
                seriesId: examData.seriesId,
                paperId: examData.paperId || examData.id,
                customInstructions: examData.instructions || examData.customInstructions,'''
if old_ts_start_regex.search(ad_content):
    ad_content = old_ts_start_regex.sub(new_ts_start, ad_content, count=1)

ad_path.write_text(ad_content, encoding="utf-8")
print("SUCCESS: AnswererDashboard.tsx updated!")
