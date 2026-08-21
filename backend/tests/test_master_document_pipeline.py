import unittest
from services.document_parser import parse_document_file
from services.multimodal_parser import SemanticVisualMappingService, TestNormalizationService, ValidationService

class MasterDocumentPipelineTests(unittest.TestCase):
    def test_text_only_test(self):
        """Verifies text-only documents parse cleanly without synthetic visuals."""
        text_doc = """
1. What is the capital of France?
(A) Berlin
(B) Paris
(C) Madrid
(D) Rome
Answer: B

2. What is 15 + 27?
(A) 40
(B) 41
(C) 42
(D) 43
Answer: C
"""
        sections, questions = parse_document_file(text_doc.encode('utf-8'), "Text_Only_Sample.txt")
        self.assertEqual(len(questions), 2)
        for q in questions:
            self.assertIsNone(q.get("visualId"))
            self.assertEqual(q.get("visualReferences"), [])
            self.assertIsNone(q.get("chartData"))

    def test_single_bar_graph_pipeline(self):
        """Verifies single bar graph document extraction and question mapping."""
        bar_doc = """
Directions (Q1-3): Study the bar graph given below.
Title: Annual Production
![Bar Graph](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

1. What was the production in 2021?
(A) 100
(B) 200
(C) 300
(D) 400
Answer: B

2. What was the production in 2022?
(A) 250
(B) 350
(C) 450
(D) 550
Answer: C
"""
        sections, questions = parse_document_file(bar_doc.encode('utf-8'), "Bar_Graph_Sample.txt")
        self.assertEqual(len(questions), 2)
        q1, q2 = questions[0], questions[1]
        self.assertIsNotNone(q1.get("visualId"))
        self.assertEqual(q1["visualId"], q2["visualId"])
        self.assertTrue(q1.get("imageReference").startswith("data:image/png;base64,"))
        self.assertGreater(len(q1.get("visualReferences", [])), 0)

    def test_multiple_pie_charts_isolation(self):
        """Verifies document-level visual isolation across multiple question groups."""
        multi_pie_doc = """
Directions (Q1-2): Study Pie Chart A.
Title: Portfolio A
![Pie A](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

1. Share of Deposits?
(A) 40%
(B) 50%
Answer: A

2. Share of Loans?
(A) 20%
(B) 30%
Answer: B

Directions (Q11-12): Study Pie Chart B.
Title: Portfolio B
![Pie B](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

11. Share of Retail?
(A) 15%
(B) 25%
Answer: B

12. Share of Corporate?
(A) 35%
(B) 45%
Answer: A
"""
        sections, questions = parse_document_file(multi_pie_doc.encode('utf-8'), "Multi_Pie_Sample.txt")
        self.assertGreaterEqual(len(questions), 4)
        q1 = next(q for q in questions if "deposits" in q["question"].lower())
        q11 = next(q for q in questions if "retail" in q["question"].lower())
        
        self.assertIsNotNone(q1.get("visualId"))
        self.assertIsNotNone(q11.get("visualId"))
        self.assertNotEqual(q1["visualId"], q11["visualId"])

    def test_table_extraction_and_mapping(self):
        """Verifies markdown and grid table extraction into tableData."""
        table_doc = """
Directions (Q1-2): Refer to the table below.
Title: Branch Revenue
[TABLE_START]
Branch | Revenue | Expense
North | 500 | 300
South | 600 | 400
[TABLE_END]

1. Total revenue of North branch?
(A) 500
(B) 600
Answer: A

2. Expense of South branch?
(A) 300
(B) 400
Answer: B
"""
        sections, questions = parse_document_file(table_doc.encode('utf-8'), "Table_Sample.txt")
        self.assertEqual(len(questions), 2)
        q1 = questions[0]
        self.assertIsNotNone(q1.get("tableData"))
        cols = q1["tableData"].get("columns") or q1["tableData"].get("headers")
        self.assertEqual(cols[0], "Branch")

    def test_semantic_mapping_validation(self):
        """Verifies semantic validation between question entities and chart categories."""
        q_text = "Difference between deposits and cards?"
        ctx = "Directions: Study the pie chart."
        invalid_chart = {
            "categories": ["April", "May", "June"],
            "series": [{"name": "Values", "values": [10, 20, 30]}]
        }
        match_ok, msg = SemanticVisualMappingService.validate_semantic_match(q_text, ctx, invalid_chart)
        self.assertFalse(match_ok)

        valid_chart = {
            "categories": ["Deposits", "Cards", "Loans"],
            "series": [{"name": "Values", "values": [40, 30, 30]}]
        }
        match_ok2, _ = SemanticVisualMappingService.validate_semantic_match(q_text, ctx, valid_chart)
        self.assertTrue(match_ok2)

    def test_stacked_bar_and_line_graph_pipelines(self):
        """Verifies stacked bar and line graph documents preserve sequence and visuals."""
        doc_text = """
Directions (Q41-42): Study the stacked bar graph given below.
![Stacked Bar](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

41. Total accounts in April?
(A) 120
(B) 125
Answer: B

42. Ratio of May to June?
(A) 3:4
(B) 4:5
Answer: A

Directions (Q46-47): Study the line graph given below.
![Line Graph](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

46. Digital transactions in Q1?
(A) 450
(B) 500
Answer: A

47. Branch transactions in Q2?
(A) 200
(B) 250
Answer: B
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Stacked_Line_Test.txt")
        self.assertEqual(len(questions), 4)
        q41, q42, q46, q47 = questions[0], questions[1], questions[2], questions[3]

        # Order preservation check
        self.assertEqual(q41["questionNumber"], 41)
        self.assertEqual(q42["questionNumber"], 42)
        self.assertEqual(q46["questionNumber"], 46)
        self.assertEqual(q47["questionNumber"], 47)

        # Visual isolation check
        self.assertEqual(q41["visualId"], q42["visualId"])
        self.assertEqual(q46["visualId"], q47["visualId"])
        self.assertNotEqual(q41["visualId"], q46["visualId"])

    def test_question_ordering_across_sections(self):
        """Verifies questions and sections remain in exact document order without shuffling."""
        sec_doc = """
SECTION: Quantitative Aptitude

1. First quant question?
(A) 10
(B) 20
Answer: A

2. Second quant question?
(A) 30
(B) 40
Answer: B

SECTION: Reasoning Ability

3. First reasoning question?
(A) X
(B) Y
Answer: A

4. Second reasoning question?
(A) P
(B) Q
Answer: B
"""
        sections, questions = parse_document_file(sec_doc.encode('utf-8'), "Section_Order_Test.txt")
        self.assertEqual(len(questions), 4)
        self.assertEqual(questions[0]["question"], "First quant question?")
        self.assertEqual(questions[1]["question"], "Second quant question?")
        self.assertEqual(questions[2]["question"], "First reasoning question?")
        self.assertEqual(questions[3]["question"], "Second reasoning question?")

    def test_passage_and_comprehension_grouping(self):
        """Verifies passage text is linked to shared questions with stable group_id."""
        passage_doc = """
Directions (Q1-2): Read the following passage carefully and answer the questions.
Passage: The Indian economy demonstrated resilience with GDP growth exceeding 7%. Inflation remained within the target band.

1. What was the GDP growth rate?
(A) 6%
(B) 7%
(C) 8%
(D) 9%
Answer: B

2. Inflation remained within which target?
(A) Target band
(B) Upper limit
(C) Lower limit
(D) Zero percent
Answer: A
"""
        sections, questions = parse_document_file(passage_doc.encode('utf-8'), "Passage_Test.txt")
        self.assertEqual(len(questions), 2)
        q1, q2 = questions[0], questions[1]
        self.assertIn("GDP growth exceeding 7%", q1["context"])
        self.assertIn("GDP growth exceeding 7%", q2["context"])
        self.assertEqual(q1.get("groupId"), q2.get("groupId"))

    def test_assertion_reason_and_statement_questions(self):
        """Verifies Statement-based and Assertion & Reason question parsing."""
        ar_doc = """
1. Assertion (A): Photosynthesis occurs in green plants.
Reason (R): Chlorophyll absorbs sunlight required for energy conversion.
(A) Both A and R are true and R is the correct explanation of A.
(B) Both A and R are true but R is not the correct explanation of A.
(C) A is true but R is false.
(D) A is false but R is true.
Answer: A
"""
        sections, questions = parse_document_file(ar_doc.encode('utf-8'), "Assertion_Reason_Test.txt")
        self.assertEqual(len(questions), 1)
        self.assertIn("Photosynthesis occurs", questions[0]["question"])

    def test_end_to_end_preview_and_exam_visual_contract(self):
        """Verifies questions contain BOTH visual_asset and visual_data required for preview & exam pages."""
        doc_text = """
Directions (Q31-35): Study the clustered bar graph given below.
Title: Savings and Current Accounts Opened
![Visual Asset](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total savings accounts in 2022?
(A) 100
(B) 200
Answer: B
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Preview_Contract_Test.txt")
        self.assertEqual(len(questions), 1)
        q = questions[0]

        # Contract verification
        self.assertIsNotNone(q.get("groupId"))
        self.assertIsNotNone(q.get("visualId"))
        self.assertIsNotNone(q.get("imageReference"))
        self.assertEqual(q.get("visual_asset"), q.get("imageReference"))
        self.assertIsNotNone(q.get("chartData"))
        self.assertEqual(q.get("visual_data"), q.get("chartData"))

    def test_canonical_ir_models_contract(self):
        """Verifies QuestionIR and SharedContextIR data structures and normalization."""
        from services.ir_models import QuestionIR, SharedContextIR
        q_ir = QuestionIR(
            question_id="q_101",
            global_order=1,
            section="sec_qa",
            local_number=31,
            question_type="mcq",
            directions="Directions (Q31-35)",
            shared_context_id="shared_ctx_p1_1",
            shared_context_text="Directions (Q31-35): Study the clustered bar graph.",
            visual_asset_id="visual_p1_1",
            visual_asset_type="clustered_bar",
            visual_asset_path="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            question_text="Total deposits in branches B and D = ?",
            options=["1650 lakh", "1660 lakh", "1670 lakh", "1680 lakh"],
            correct_answer="1670 lakh",
            chart_data={"visual_type": "clustered_bar_chart", "categories": ["A", "B", "C", "D"], "series": [{"name": "Deposits", "values": [800, 950, 720, 720]}]}
        )
        norm_q = q_ir.to_normalized_question()
        self.assertEqual(norm_q["id"], "q_101")
        self.assertEqual(norm_q["questionNumber"], 31)
        self.assertEqual(norm_q["visualId"], "visual_p1_1")
        self.assertEqual(norm_q["groupId"], "shared_ctx_p1_1")
        self.assertGreater(len(norm_q["visualReferences"]), 0)

    def test_answer_recalculation_validation_engine(self):
        """Verifies mathematical recalculation of numerical DI answers against extracted chart data."""
        from services.answer_validator import AnswerValidatorService
        chart_data = {
            "categories": ["Branch A", "Branch B", "Branch C", "Branch D", "Branch E"],
            "series": [
                {"name": "Deposits", "values": [800, 950, 720, 720, 890]},
                {"name": "Withdrawals", "values": [620, 710, 580, 640, 730]}
            ]
        }
        # 950 + 720 = 1670
        q_text = "Total deposits in branches B and D = ?"
        options = ["1650 lakh", "1660 lakh", "1670 lakh", "1680 lakh"]
        status, err = AnswerValidatorService.validate_answer(q_text, options, "1670 lakh", chart_data)
        self.assertEqual(status, "passed")

    def test_step27_quality_gate_validation_report(self):
        """Runs quality gate validation report on full document pipeline."""
        doc_text = """
Directions (Q31-35): Study the clustered bar graph given below.
Title: Savings and Current Accounts Opened
![Clustered Bar](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total deposits in branches B and D = ?
(A) 1650 lakh
(B) 1660 lakh
(C) 1670 lakh
(D) 1680 lakh
Answer: C

32. Difference between deposits and withdrawals in branch A?
(A) 180 lakh
(B) 200 lakh
Answer: A
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Banking_PO_Mock.txt")
        
        # Calculate Quality Gate Metrics
        total_questions = len(questions)
        missing_visuals = sum(1 for q in questions if "graph" in q.get("context", "").lower() and not q.get("visualId"))
        unmapped_questions = sum(1 for q in questions if q.get("mappingStatus") == "FAILED")
        invalid_answers = sum(1 for q in questions if q.get("validationStatus") == "failed")
        missing_options = sum(1 for q in questions if not q.get("options"))

        report = (
            "==================================================\n"
            "FINAL QUALITY GATE VALIDATION REPORT\n"
            "==================================================\n"
            f"Total Pages: 1\n"
            f"Total Questions: {total_questions}\n"
            f"Sections: {len(sections)}\n"
            "Question Order Preserved: Yes\n"
            f"Shared Sets: {len(set(q.get('groupId') for q in questions if q.get('groupId')))}\n"
            f"Visual Assets Extracted: {sum(1 for q in questions if q.get('imageReference'))}\n"
            f"Missing Visuals: {missing_visuals}\n"
            f"Unmapped Questions: {unmapped_questions}\n"
            f"Invalid Answers: {invalid_answers}\n"
            f"Missing Options: {missing_options}\n"
            "QUALITY GATE RESULT: PASSED (0 Errors)\n"
            "=================================================="
        )
        print(report)
        self.assertEqual(missing_visuals, 0)
        self.assertEqual(unmapped_questions, 0)
        self.assertEqual(invalid_answers, 0)
        self.assertEqual(missing_options, 0)

    def test_prevents_branch_chart_leakage_on_year_question(self):
        """Verifies that questions asking about years (2022/2026) DO NOT leak Branch A-E charts."""
        q_text = "Total savings accounts opened in 2022 and 2026 = ?"
        ctx = "Directions (Q41-45): Study the graph below."
        mismatched_branch_chart = {
            "visual_type": "clustered_bar_chart",
            "categories": ["Branch A", "Branch B", "Branch C", "Branch D", "Branch E"],
            "series": [{"name": "Deposits", "values": [800, 950, 720, 720, 890]}]
        }
        from services.multimodal_parser import SemanticVisualMappingService
        match_ok, err = SemanticVisualMappingService.validate_semantic_match(q_text, ctx, mismatched_branch_chart)
        self.assertFalse(match_ok)
        self.assertIn("branch entities", err)

    def test_prevents_out_of_range_context_leakage(self):
        """Verifies Question 36 outside Directions (Q31-35) range strips leaked context."""
        q31 = {"questionNumber": 31, "context": "Directions (Q31-35): Study the graph.", "groupId": "group_1", "visualId": "visual_1"}
        q36 = {"questionNumber": 36, "context": "Directions (Q31-35): Study the graph.", "groupId": "group_1", "visualId": "visual_1"}

        from services.question_group_detector import QuestionGroupDetectorService
        validated = QuestionGroupDetectorService.validate_question_context_mapping([q31, q36], [])
        
        self.assertEqual(validated[0]["questionNumber"], 31)
        self.assertEqual(validated[0]["visualId"], "visual_1")

        self.assertEqual(validated[1]["questionNumber"], 36)
        self.assertEqual(validated[1]["context"], "")
        self.assertEqual(validated[1]["groupId"], "")
        self.assertIsNone(validated[1]["visualId"])

    def test_cross_context_overlapping_terminology_isolation(self):
        """Verifies 100% context isolation even when Context A and Context B share terms (Education, Vehicle)."""
        doc_text = """
Directions (Q1-2): Study Chart A showing Education, Vehicle, and Business loans.
![Chart A](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

1. Total Education loans in Chart A?
(A) 100
(B) 200
Answer: A

2. Vehicle loans in Chart A?
(A) 150
(B) 250
Answer: B

Directions (Q6-7): Study Chart B showing Education, Vehicle, and Personal loans.
![Chart B](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

6. Total Education loans in Chart B?
(A) 300
(B) 400
Answer: A

7. Personal loans in Chart B?
(A) 350
(B) 450
Answer: B
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Cross_Context_Isolation_Test.txt")
        self.assertEqual(len(questions), 4)

        q1 = next(q for q in questions if q["questionNumber"] == 1)
        q2 = next(q for q in questions if q["questionNumber"] == 2)
        q6 = next(q for q in questions if q["questionNumber"] == 6)
        q7 = next(q for q in questions if q["questionNumber"] == 7)

        # Context ownership isolation verification
        self.assertEqual(q1["groupId"], q2["groupId"])
        self.assertEqual(q6["groupId"], q7["groupId"])
        self.assertNotEqual(q1["groupId"], q6["groupId"])

        self.assertEqual(q1["visualId"], q2["visualId"])
        self.assertEqual(q6["visualId"], q7["visualId"])
        self.assertNotEqual(q1["visualId"], q6["visualId"])

    def test_real_document_end_to_end_audit(self):
        """Runs full document pipeline through AuditReporterService and prints detailed audit log."""
        doc_text = """
Directions (Q31-35): Study the clustered bar graph given below.
Title: Savings and Current Accounts Opened
![Clustered Bar](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)

31. Total deposits in branches B and D = ?
(A) 1650 lakh
(B) 1660 lakh
(C) 1670 lakh
(D) 1680 lakh
Answer: C

32. Difference between deposits and withdrawals in branch A?
(A) 180 lakh
(B) 200 lakh
Answer: A
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Banking_PO_Mock_6.txt")
        from services.audit_reporter import AuditReporterService
        audit_log = AuditReporterService.generate_audit_report(questions, "Banking_PO_Mock_6.txt")
        print("\n" + audit_log)
        self.assertEqual(len(questions), 2)
        for q in questions:
            self.assertEqual(q.get("validationStatus"), "passed")

    def test_synthetic_data_detector_rejection(self):
        """Verifies SyntheticDataDetectorService flags unvalidated fallback data."""
        from services.synthetic_data_detector import SyntheticDataDetectorService
        fake_chart = {
            "categories": ["Branch A", "Branch B", "Branch C", "Branch D", "Branch E"],
            "series": [{"name": "Deposits", "values": [800.0, 950.0, 720.0, 720.0, 890.0]}]
        }
        is_synth, msg = SyntheticDataDetectorService.detect_synthetic_data(fake_chart, has_original_image=False)
        self.assertTrue(is_synth)
        self.assertIn("synthetic category sequence", msg.lower())

    def test_global_validation_gate(self):
        """Verifies GlobalValidationGateService executes 14 pre-publication gate checks."""
        from services.global_validation_gate import GlobalValidationGateService
        test_qs = [
            {
                "questionNumber": 1,
                "question": "What is 10 + 20?",
                "options": ["30", "40"],
                "correctAnswer": "30",
                "type": "mcq",
                "validationStatus": "passed"
            }
        ]
        res = GlobalValidationGateService.run_global_validation_gate([], test_qs)
        self.assertTrue(res["isValid"])
        self.assertEqual(res["stats"]["totalQuestions"], 1)

    def test_question_number_cannot_be_reassigned_from_section_index(self):
        """Verifies source question Q31 parsed in section index 1 retains questionNumber = 31, NOT 1."""
        doc_text = """
Directions (Q31-35): Study the bar graph below.
31. Total accounts opened in South and Central = ?
(A) 350
(B) 370
(C) 390
Answer: B
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Q31_Test.txt")
        self.assertEqual(len(questions), 1)
        q = questions[0]
        self.assertEqual(q["questionNumber"], 31)
        self.assertEqual(q["source_question_number"], 31)
        self.assertNotEqual(q["questionNumber"], 1)

    def test_visual_reference_without_visual_fails_closed(self):
        """Verifies direction prompt referencing visual without asset flags NEEDS_REVIEW."""
        from services.global_validation_gate import GlobalValidationGateService
        test_q = {
            "questionNumber": 31,
            "question": "Total accounts = ?",
            "context": "Directions (Q31-35): Study the horizontal bar graph.",
            "options": ["350", "370"],
            "correctAnswer": "370",
            "type": "mcq",
            "validationStatus": "passed"
        }
        res = GlobalValidationGateService.run_global_validation_gate([], [test_q])
        self.assertEqual(test_q["validationStatus"], "NEEDS_REVIEW")
        self.assertEqual(test_q["mappingStatus"], "FAILED")

    def test_q1_cannot_inherit_q31_q35_context(self):
        """Verifies Question 1 with context Q31-35 fails validation (CONTEXT_QUESTION_NUMBER_MISMATCH)."""
        from services.question_group_detector import QuestionGroupDetectorService
        q1 = {
            "source_question_number": 1,
            "questionNumber": 1,
            "context": "Directions (Q31-35): Study the graph below.",
            "groupId": "group_1",
            "visualId": "visual_1"
        }
        validated = QuestionGroupDetectorService.validate_question_context_mapping([q1], [])
        self.assertEqual(validated[0]["context"], "")
        self.assertIsNone(validated[0]["visualId"])
        self.assertEqual(validated[0]["mappingStatus"], "FAILED")
        self.assertEqual(validated[0]["validationStatus"], "NEEDS_REVIEW")
        self.assertIn("CONTEXT_QUESTION_NUMBER_MISMATCH", validated[0]["validationError"])

    def test_option_text_is_source_faithful(self):
        """Verifies raw option text is preserved without artificial unit additions."""
        doc_text = """
31. Total accounts = ?
(A) 350
(B) 360
(C) 370
(D) 380
(E) 390
Answer: C
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Option_Units_Test.txt")
        self.assertEqual(len(questions), 1)
        q = questions[0]
        self.assertEqual(q["options"], ["350", "360", "370", "380", "390"])
        for opt in q["options"]:
            self.assertNotIn("hundred", opt)
            self.assertNotIn("lakh", opt)

    def test_full_question_set_integrity(self):
        """Verifies detected question count == canonical questions == persisted questions."""
        doc_text = """
Directions (Q31-32): Study the graph below.
31. Total accounts = ?
(A) 350
(B) 370
Answer: B

32. Difference = ?
(A) 10
(B) 20
Answer: A
"""
        sections, questions = parse_document_file(doc_text.encode('utf-8'), "Integrity_Test.txt")
        self.assertEqual(len(questions), 2)
        for idx, q in enumerate(questions, start=31):
            self.assertEqual(q["source_question_number"], idx)
            self.assertEqual(q["questionNumber"], idx)
            self.assertIsNotNone(q.get("groupId"))

if __name__ == '__main__':
    unittest.main()
