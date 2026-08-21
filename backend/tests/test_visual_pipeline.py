import unittest
from services.document_parser import parse_document_file

class VisualPipelineTests(unittest.TestCase):
    def test_visual_asset_preservation_across_pipeline(self):
        sample_doc = """
Directions (Q31-35): Study the clustered bar graph given below and answer the questions based on it.
Title: Savings and Current Accounts Opened
![Extracted Diagram/Graph](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total savings accounts opened in 2022 and 2026?
(A) 250 hundred
(B) 260 hundred
(C) 270 hundred
(D) 280 hundred
(E) 290 hundred
Answer: C

32. What is the difference between savings and current accounts in 2024?
(A) 40 hundred
(B) 50 hundred
(C) 60 hundred
(D) 70 hundred
(E) 80 hundred
Answer: B

33. What is the average number of savings accounts opened across all 5 years?
(A) 110 hundred
(B) 114 hundred
(C) 120 hundred
(D) 125 hundred
(E) 130 hundred
Answer: B
"""
        sections, questions = parse_document_file(sample_doc.encode('utf-8'), "Mock_Visual_Test.txt")
        self.assertGreaterEqual(len(questions), 3)

        for q in questions[:3]:
            # 1. Verify context contains directions
            self.assertIn("Savings and Current Accounts Opened", q["context"])

            # 2. Verify visual asset reference is attached
            self.assertIsNotNone(q.get("visualReferences"))
            self.assertGreater(len(q["visualReferences"]), 0)
            
            # 3. Verify original image reference is preserved
            self.assertTrue(q.get("imageReference").startswith("data:image/png;base64,"))

            # 4. Verify structured chartData is present
            self.assertIsNotNone(q.get("chartData"))
            self.assertIn("visual_type", q["chartData"])
            self.assertEqual(q["chartData"]["visual_type"], "clustered_bar_chart")

    def test_donut_chart_visual_pipeline(self):
        donut_doc = """
Directions (Q41-45): Study the donut chart given below. Total loan applications = 2,000.
Title: Credit Portfolio Distribution
![Donut Chart](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

41. What is the number of applications for Retail loans?
(A) 600
(B) 700
(C) 800
(D) 900
(E) 1000
Answer: B

42. What is the ratio of MSME to Agri loan applications?
(A) 18:25
(B) 25:18
(C) 3:4
(D) 5:6
(E) 12:25
Answer: A

43. Study the donut chart. Total loan applications = 2,000. What is the value of Corporate loans?
(A) 240
(B) 250
(C) 260
(D) 270
(E) 280
Answer: A
"""
        sections, questions = parse_document_file(donut_doc.encode('utf-8'), "Donut_Test.txt")
        self.assertEqual(len(questions), 3)

        for q in questions:
            self.assertIn("donut chart", q["context"].lower())
            self.assertIsNotNone(q.get("visualReferences"))
            self.assertGreater(len(q["visualReferences"]), 0)
            self.assertTrue(q.get("imageReference").startswith("data:image/png;base64,"))
            self.assertIsNotNone(q.get("chartData"))
            self.assertIn(q["chartData"]["visual_type"], ["doughnut_chart", "pie_chart"])

    def test_text_only_question_backward_compatibility(self):
        text_doc = """
1. What is the capital of India?
(A) New Delhi
(B) Mumbai
(C) Kolkata
(D) Chennai
Answer: A
"""
        sections, questions = parse_document_file(text_doc.encode('utf-8'), "Text_Only_Test.txt")
        self.assertEqual(len(questions), 1)
        q = questions[0]
        self.assertEqual(q["context"], "")
        self.assertEqual(q["contextType"], "")

if __name__ == '__main__':
    unittest.main()
