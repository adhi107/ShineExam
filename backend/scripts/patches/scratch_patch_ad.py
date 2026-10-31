from pathlib import Path
import re

path = Path("frontend/src/components/AnswererDashboard.tsx")
content = path.read_text(encoding="utf-8")

# 1. Update ExamForTaking
old_iface = '''interface ExamForTaking {
  id: string; testName: string; duration: number;
  passingPercentage?: number; questions: any[];
  timerMode?: "overall" | "sectional";
  sectionConfig?: Array<{ name: string; duration: number; questionCount: number; marks: number }>;
}'''

new_iface = '''interface ExamForTaking {
  id: string; testName: string; duration: number;
  passingPercentage?: number; questions: any[];
  timerMode?: "overall" | "sectional";
  sectionConfig?: Array<{ name: string; duration: number; questionCount: number; marks: number }>;
  negativeMarkingScheme?: string;
  negativeMarks?: number;
  isSeries?: boolean;
  seriesId?: string;
  paperId?: string;
  customInstructions?: string;
}'''

assert old_iface in content, "Could not find ExamForTaking in AnswererDashboard.tsx"
content = content.replace(old_iface, new_iface, 1)

# 2. Remove duplicate timerMode at line 847
old_block = '''                isSeries: true,
                seriesId: examData.seriesId,
                paperId: examData.paperId || examData.id,
                customInstructions: examData.instructions || examData.customInstructions,
                timerMode: examData.timerMode || "overall",
              });'''

new_block = '''                isSeries: true,
                seriesId: examData.seriesId,
                paperId: examData.paperId || examData.id,
                customInstructions: examData.instructions || examData.customInstructions,
              });'''

assert old_block in content, "Could not find duplicate timerMode block in AnswererDashboard.tsx"
content = content.replace(old_block, new_block, 1)

path.write_text(content, encoding="utf-8")
print("SUCCESS: AnswererDashboard.tsx fixed!")

