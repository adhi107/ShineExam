import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.document_parser import _parse_text  # noqa: E402


class DocumentParserTests(unittest.TestCase):
    def test_mixed_exam_formats_parse_without_guessing(self):
        text = """
Section A - General Aptitude
Each question carries 2 marks. +2 correct, -0.50 incorrect.
Directions (Q1-2): Study the table and answer.
Name | Score | Rank
Asha | 90 | 1
Ben | 75 | 2
1. Who scored highest?
A: Asha
B: Ben
C: Both
D: None
2. Select all values shown for Asha. A) 90 B) Rank 1 C) Rank 2 D) 75
3. The statement "The earth is flat" is True or False?
4. Explain normalization in one sentence.
5. Which HTTP methods are safe?
(A) GET
(B) POST
(C) HEAD
(D) DELETE

ANSWER KEY
1. A
2. A,C
3. False
5. A/C
"""
        sections, questions = _parse_text(text)

        self.assertEqual([s["name"] for s in sections], ["General Aptitude"])
        self.assertEqual(len(questions), 5)
        self.assertEqual(questions[0]["marks"], 2)
        self.assertEqual(questions[0]["negativeMarks"], 0.5)
        self.assertEqual(questions[0]["contextType"], "table")
        self.assertIn("Name | Score | Rank", questions[0]["context"])
        self.assertEqual(questions[0]["correctAnswer"], "Asha")

        self.assertEqual(questions[1]["type"], "multiple")
        self.assertEqual(questions[1]["correctAnswer"], ["90", "Rank 2"])

        self.assertEqual(questions[2]["options"], ["True", "False"])
        self.assertEqual(questions[2]["correctAnswer"], "False")

        self.assertEqual(questions[3]["type"], "text")
        self.assertEqual(questions[3]["correctAnswer"], "")

        self.assertEqual(questions[4]["type"], "multiple")
        self.assertEqual(questions[4]["correctAnswer"], ["GET", "HEAD"])

    def test_para_jumble_fragments_stay_in_question_text(self):
        text = """
English
1. A. customers can access services instantly B. because of digital banking C. from almost anywhere D. without visiting a branch
A) BACD
B) ABCD
C) BCAD
D) ACBD
Answer: A
"""
        _, questions = _parse_text(text)

        self.assertEqual(len(questions), 1)
        self.assertIn("customers can access services instantly", questions[0]["question"])
        self.assertEqual(questions[0]["options"], ["BACD", "ABCD", "BCAD", "ACBD"])
        self.assertEqual(questions[0]["correctAnswer"], "BACD")

    def test_ratios_are_not_split_into_options(self):
        text = """
Quantitative Aptitude
1. The ratio of A:B is 3:5. If A+B=64, B is:
A) 24
B) 32
C) 36
D) 40
E) 48
Answer: B
"""
        _, questions = _parse_text(text)

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["question"], "The ratio of A:B is 3:5. If A+B=64, B is:")
        self.assertEqual(questions[0]["options"], ["24", "32", "36", "40", "48"])
        self.assertEqual(questions[0]["correctAnswer"], "32")

    def test_shared_context_is_attached_to_every_question_in_range(self):
        text = """
Reasoning Ability
Directions (Q1-3): Read the following passage carefully.
All managers are employees. Some employees are graduates.
1. Which conclusion follows?
A) Only I
B) Only II
Answer: B
2. Which statement is given?
A) All managers are employees
B) No manager is an employee
Answer: A
3. Choose the best inference.
A) Definite
B) Cannot be determined
Answer: B
Directions (Q4-5): Study the bar graph and answer the questions.
4. Highest value is:
A) A
B) B
Answer: A
5. Lowest value is:
A) C
B) D
Answer: B
"""
        _, questions = _parse_text(text)

        self.assertEqual(len(questions), 5)
        for index in range(3):
            self.assertEqual(questions[index]["contextType"], "passage")
            self.assertIn("All managers are employees", questions[index]["context"])
        for index in range(3, 5):
            self.assertEqual(questions[index]["contextType"], "graph")
            self.assertIn("bar graph", questions[index]["context"].lower())

    def test_multi_line_ratios_and_equation_question_stems(self):
        text = """
Quantitative Aptitude
3. The ratio of
B is
If A+B=64, B is:
A) 24
B) 32
C) 36
D) 40
E) 48
Answer: B
"""
        _, questions = _parse_text(text)
        self.assertEqual(len(questions), 1)
        self.assertIn("The ratio of B is If A+B=64, B is:", questions[0]["question"])
        self.assertEqual(questions[0]["options"], ["24", "32", "36", "40", "48"])
        self.assertEqual(questions[0]["correctAnswer"], "32")

    def test_reading_comprehension_full_passage_collection(self):
        text = """
English Language
Directions (Q1-5): Read the passage and answer the questions.
Digital banking has revolutionized modern financial transactions across India.
While electronic payments offer tremendous convenience, user security habits remain essential.
Customers must adopt safe passwords and avoid sharing OTPs to prevent fraud.

1. What is the central idea of the passage?
A) Branch banking is ending completely.
B) Digital banking is convenient, but secure habits are essential.
C) Digital payments are always unsafe.
D) Banks no longer need customer awareness.
E) Customers should avoid technology.
Answer: B
"""
        _, questions = _parse_text(text)
        self.assertEqual(len(questions), 1)
        self.assertIn("Digital banking has revolutionized", questions[0]["context"])
        self.assertIn("Customers must adopt safe passwords", questions[0]["context"])
        self.assertEqual(questions[0]["options"][1], "Digital banking is convenient, but secure habits are essential.")
        self.assertEqual(questions[0]["correctAnswer"], "Digital banking is convenient, but secure habits are essential.")

    def test_mismatched_question_range_direction_binding(self):
        text = """
Quantitative Aptitude
Directions (Q41–45): Study the bar graph and answer the questions.
| Branch | Accounts |
| Branch A | 120 |
| Branch B | 450 |

11. Which branch opened the highest number of accounts?
A) Branch A
B) Branch B
C) Branch C
D) Branch D
E) Branch B
Answer: E

41. Which branch opened the highest number of accounts?
A) Branch A
B) Branch B
C) Branch C
D) Branch D
E) Branch B
Answer: B
"""
        _, questions = _parse_text(text)
        self.assertEqual(len(questions), 2)
        # Q11 must NOT have Q41-45 context
        self.assertEqual(questions[0]["context"], "")
        self.assertIsNone(questions[0]["sharedContent"])
        # Q41 MUST have Q41-45 context
        self.assertIn("Study the bar graph", questions[1]["context"])
        self.assertIn("Branch B | 450", questions[1]["context"])
        self.assertEqual(questions[1]["contextType"], "table")

    def test_standalone_questions_have_no_shared_context(self):
        text = """
Reasoning Ability
Directions (Q1-2): Read the passage and answer.
Paragraph text for passage.
1. Question one?
A) Option A
B) Option B
Answer: A
2. Question two?
A) Option A
B) Option B
Answer: B

3. What is the capital of France?
A) Paris
B) London
Answer: A
"""
        _, questions = _parse_text(text)
        self.assertEqual(len(questions), 3)
        self.assertEqual(questions[0]["context"], "Directions (Q1-2): Read the passage and answer.\nParagraph text for passage.")
        self.assertEqual(questions[1]["context"], "Directions (Q1-2): Read the passage and answer.\nParagraph text for passage.")
        self.assertEqual(questions[2]["context"], "")

    def test_validate_parsed_test_data(self):
        from services.document_parser import validate_parsed_test_data
        sections = [{'id': 'sec_1', 'name': 'General'}]
        questions = [{
            'id': 'q1',
            'type': 'mcq',
            'question': 'Sample question prompt?',
            'options': ['Opt A', 'Opt B'],
            'correctAnswer': 'Opt A',
            'context': '![Img](data:image/png;base64,' + 'A'*120 + ')',
            'contextType': 'graph'
        }]
        res = validate_parsed_test_data(sections, questions)
        self.assertTrue(res['valid'])
        self.assertEqual(res['qualityScore'], 100)
        self.assertEqual(res['validatedImages'], 1)


if __name__ == "__main__":
    unittest.main()


