import unittest
from services.document_parser import parse_document_file, _parse_text
from services.question_group_detector import QuestionGroupDetectorService, ContextBlock

class ContextRangeBindingTests(unittest.TestCase):

    def test_1_exact_range_binding_and_termination(self):
        """Test 1: Directions (Q36-40) attaches to Q36-Q40, and Q41 has NO context."""
        sample = """
Directions (Q36-40):
Study the dual-line graph given below and answer the questions.

36. Total digital transactions in Q1 = ?
(A) 100
(B) 200
(C) 300
(D) 400
(E) 500
Answer: A

37. Total digital transactions in Q2 = ?
(A) 110
(B) 210
(C) 310
(D) 410
(E) 510
Answer: B

38. Total digital transactions in Q3 = ?
(A) 120
(B) 220
(C) 320
(D) 420
(E) 520
Answer: C

39. Total digital transactions in Q4 = ?
(A) 130
(B) 230
(C) 330
(D) 430
(E) 530
Answer: D

40. Total digital transactions across all quarters = ?
(A) 140
(B) 240
(C) 340
(D) 440
(E) 540
Answer: E

41. What is 25 + 75?
(A) 90
(B) 95
(C) 100
(D) 105
(E) 110
Answer: C
"""
        sections, questions = parse_document_file(sample.encode('utf-8'), "Test1.txt")
        self.assertEqual(len(questions), 6)

        # Questions 36-40 MUST have the shared context
        for q in questions[:5]:
            self.assertTrue(36 <= q["questionNumber"] <= 40)
            self.assertIn("Study the dual-line graph", q["context"])
            self.assertEqual(q["questionRange"], {"start": 36, "end": 40})
            self.assertIsNotNone(q["sharedContent"])

        # Question 41 MUST NOT have the context
        q41 = questions[5]
        self.assertEqual(q41["questionNumber"], 41)
        self.assertEqual(q41["context"], "")
        self.assertIsNone(q41["sharedContent"])
        self.assertIsNone(q41["questionRange"])

    def test_2_earlier_unrelated_question_q7_regression(self):
        """
        Test 2: Q7 followed by Directions (Q36-40) and Q36-Q40.
        Q7 MUST NOT receive Directions (Q36-40) context or sharedContent.
        """
        sample = """
7. Total digital transactions over four quarters = ?
(A) 2,000 thousand
(B) 2,100 thousand
(C) 2,200 thousand
(D) 2,300 thousand
(E) 2,400 thousand
Answer: C

Directions (Q36-40):
Study the dual-line graph.

36. Digital transactions in Q3 exceed branch transactions in Q3 by:
(A) 280 thousand
(B) 290 thousand
(C) 300 thousand
(D) 310 thousand
(E) 320 thousand
Answer: C
"""
        sections, questions = parse_document_file(sample.encode('utf-8'), "Test2_Q7_Regression.txt")
        self.assertEqual(len(questions), 2)

        q7 = questions[0]
        self.assertEqual(q7["questionNumber"], 7)
        self.assertEqual(q7["question"], "Total digital transactions over four quarters = ?")
        self.assertEqual(q7["context"], "")
        self.assertIsNone(q7["sharedContent"])
        self.assertIsNone(q7["questionRange"])
        self.assertNotIn("Directions (Q36-40)", q7["question"])
        self.assertEqual(q7["correctAnswer"], "2,200 thousand")

        q36 = questions[1]
        self.assertEqual(q36["questionNumber"], 36)
        self.assertIn("Study the dual-line graph", q36["context"])
        self.assertEqual(q36["questionRange"], {"start": 36, "end": 40})
        self.assertIsNotNone(q36["sharedContent"])

    def test_3_multiple_context_ranges(self):
        """Test 3: Multiple independent ranges (Q1-5, Q6-10, Q11-15)."""
        sample = """
Directions (Q1-5):
Passage Alpha content.

1. Question One?
(A) 10
(B) 20
Answer: A

Directions (Q6-10):
Passage Beta content.

6. Question Six?
(A) 60
(B) 70
Answer: B

Directions (Q11-15):
Study the gamma graph.

11. Question Eleven?
(A) 110
(B) 120
Answer: A
"""
        sections, questions = parse_document_file(sample.encode('utf-8'), "Test3_Multi.txt")
        self.assertEqual(len(questions), 3)

        self.assertIn("Passage Alpha", questions[0]["context"])
        self.assertEqual(questions[0]["questionRange"], {"start": 1, "end": 5})

        self.assertIn("Passage Beta", questions[1]["context"])
        self.assertEqual(questions[1]["questionRange"], {"start": 6, "end": 10})

        self.assertIn("gamma graph", questions[2]["context"])
        self.assertEqual(questions[2]["questionRange"], {"start": 11, "end": 15})

    def test_4_universal_range_separators_and_unicode(self):
        """Test 4: Diverse range separators (hyphens, unicode dashes, words) normalize accurately."""
        test_headers = [
            ("Directions (Q36-40)", (36, 40)),
            ("Directions (Q36–40)", (36, 40)),
            ("Directions (Q36—40)", (36, 40)),
            ("Directions (Q36−40)", (36, 40)),
            ("Questions 36 to 40", (36, 40)),
            ("Questions 36 through 40", (36, 40)),
            ("Q.36 - 40", (36, 40)),
            ("Q36 to Q40", (36, 40)),
            ("For questions 36-40", (36, 40)),
            ("Directions for questions 36 through 40", (36, 40)),
            ("Passage 1 (Q36-40)", (36, 40)),
            ("Read the following for questions 36-40", (36, 40)),
            ("(36-40)", (36, 40)),
            ("[36-40]", (36, 40)),
        ]
        for header, expected_range in test_headers:
            detected = QuestionGroupDetectorService.detect_question_range(header)
            self.assertEqual(detected, expected_range, f"Failed for header: {header}")

    def test_5_five_options_banking_format(self):
        """Test 5: Accurate 5-option extraction (A through E)."""
        sample = """
1. Total personal loans in 2025?
(A) 400
(B) 420
(C) 440
(D) 460
(E) 480
Answer: C
"""
        _, questions = parse_document_file(sample.encode('utf-8'), "Test5.txt")
        self.assertEqual(len(questions), 1)
        self.assertEqual(len(questions[0]["options"]), 5)
        self.assertEqual(questions[0]["options"], ["400", "420", "440", "460", "480"])
        self.assertEqual(questions[0]["correctAnswer"], "440")
        self.assertEqual(questions[0]["correct_option_id"], "C")

    def test_6_inline_options_parsing(self):
        """Test 6: Single-line multi-options (A) 2000 (B) 2100 (C) 2200 (D) 2300 (E) 2400."""
        sample = """
1. What is the total?
(A) 2,000 thousand (B) 2,100 thousand (C) 2,200 thousand (D) 2,300 thousand (E) 2,400 thousand
Answer: C
"""
        _, questions = parse_document_file(sample.encode('utf-8'), "Test6.txt")
        self.assertEqual(len(questions), 1)
        self.assertEqual(len(questions[0]["options"]), 5)
        self.assertEqual(questions[0]["options"][2], "2,200 thousand")
        self.assertEqual(questions[0]["correctAnswer"], "2,200 thousand")

    def test_7_visual_context_isolation_from_unrelated_questions(self):
        """Test 7: Visual diagram attached to Q36-40 never leaks to Q7."""
        sample = """
7. Standalone Question?
A) Opt 1
B) Opt 2
Answer: A

Directions (Q36-40):
Study the graph below:
![Dual Line Chart](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

36. Question under graph?
A) Opt A
B) Opt B
Answer: B
"""
        _, questions = parse_document_file(sample.encode('utf-8'), "Test7_Visual.txt")
        self.assertEqual(len(questions), 2)
        q7 = questions[0]
        q36 = questions[1]

        # Q7 must NOT have the image or context
        self.assertEqual(q7["imageReference"], "")
        self.assertEqual(q7["context"], "")
        self.assertIsNone(q7["sharedContent"])

        # Q36 MUST have the image and context
        self.assertTrue(q36["imageReference"].startswith("data:image/png;base64,"))
        self.assertIn("Study the graph below", q36["context"])
        self.assertEqual(q36["questionRange"], {"start": 36, "end": 40})

    def test_8_context_block_applicability_logic(self):
        """Test 8: ContextBlock applies_to_question unit verification."""
        block = ContextBlock(
            context_id="ctx_001",
            type="directions",
            text="Study graph.",
            start_question=36,
            end_question=40,
            binding_mode="explicit_range"
        )
        self.assertFalse(block.applies_to_question(7))
        self.assertFalse(block.applies_to_question(35))
        self.assertTrue(block.applies_to_question(36))
        self.assertTrue(block.applies_to_question(38))
        self.assertTrue(block.applies_to_question(40))
        self.assertFalse(block.applies_to_question(41))

if __name__ == "__main__":
    unittest.main()
