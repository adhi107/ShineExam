import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import "./CourseManagement.css";
import "./StudentCourses.css";
import ValueHelpField, { ValueHelpOption } from "./ValueHelpField";
import { LessonView } from "./StudentCourses";
import { normalizeLessonContent, type CourseMaterialRecord } from "./courseContent";
import { filterAssignableStudents } from "../utils/filterUtils";

interface Course {
  id: string;
  name: string;
  description: string;
  assignmentCount: number;
  status: string;
}

interface Student {
  id: string;
  name: string;
  userId: string;
  email: string;
  isActive: boolean;
  collegeName?: string;
  courseStream?: string;
  gender?: string;
}

interface CourseMaterial extends CourseMaterialRecord {}

const emptyCourseForm = { name: "", description: "" };

const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [showAssignFilters, setShowAssignFilters] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const availableStreams = useMemo(
    () => Array.from(new Set(students.map((student) => student.courseStream).filter(Boolean) as string[])).sort(),
    [students]
  );

  const availableColleges = useMemo(
    () => Array.from(new Set(students.map((student) => student.collegeName).filter(Boolean) as string[])).sort(),
    [students]
  );

  const studentSearchOptions = useMemo<ValueHelpOption[]>(() => {
    const unique = Array.from(new Set(students.flatMap((student) => [
      student.name, student.userId, student.email, student.courseStream, student.collegeName, student.gender,
    ]).filter(Boolean) as string[]));
    return unique.slice(0, 40).map((value) => ({ value, label: value }));
  }, [students]);

  const streamOptions: ValueHelpOption[] = [{ value: "", label: "All Streams" }, ...availableStreams.map((value) => ({ value, label: value }))];
  const collegeOptions: ValueHelpOption[] = [{ value: "", label: "All Colleges" }, ...availableColleges.map((value) => ({ value, label: value }))];
  const statusOptions: ValueHelpOption[] = [
    { value: "active", label: "Active Only" },
    { value: "inactive", label: "Inactive Only" },
    { value: "all", label: "All Students" },
  ];

  const filteredStudents = useMemo(() => {
    return filterAssignableStudents(students, {
      search: studentSearch,
      stream: streamFilter,
      college: collegeFilter,
      status: statusFilter,
    });
  }, [students, studentSearch, streamFilter, collegeFilter, statusFilter]);

  const filteredStudentIds = useMemo(
    () => filteredStudents.map((student) => student.userId),
    [filteredStudents]
  );

  const areAllFilteredStudentsSelected = useMemo(
    () => filteredStudentIds.length > 0 && filteredStudentIds.every((userId) => selectedUserIds.includes(userId)),
    [filteredStudentIds, selectedUserIds]
  );

  const activeAssignFilterCount = [
    Boolean(studentSearch.trim()),
    Boolean(streamFilter),
    Boolean(collegeFilter),
    statusFilter !== "active",
  ].filter(Boolean).length;

  const assignmentChanges = useMemo(() => {
    const selected = new Set(selectedUserIds);
    const assigned = new Set(assignedUserIds);
    const added = selectedUserIds.filter((userId) => !assigned.has(userId));
    const removed = assignedUserIds.filter((userId) => !selected.has(userId));
    return { added, removed };
  }, [assignedUserIds, selectedUserIds]);

  const sortedMaterials = useMemo(
    () => materials.slice().sort((a, b) => a.dayNumber - b.dayNumber || a.title.localeCompare(b.title)),
    [materials]
  );

  const selectedMaterial = useMemo(
    () => sortedMaterials.find((material) => material.id === selectedMaterialId) ?? sortedMaterials[0] ?? null,
    [sortedMaterials, selectedMaterialId]
  );

  const selectedLesson = useMemo(
    () => (selectedMaterial ? normalizeLessonContent(selectedMaterial) : null),
    [selectedMaterial]
  );

  const loadCourses = async (preferredCourseId?: string) => {
    setLoading(true);
    try {
      const res = await apiGet<{ courses: Course[] }>("/admin/courses");
      const fetchedCourses = res.courses || [];
      setCourses(fetchedCourses);

      const nextSelectedId =
        preferredCourseId && fetchedCourses.some((course) => course.id === preferredCourseId)
          ? preferredCourseId
          : selectedCourseId && fetchedCourses.some((course) => course.id === selectedCourseId)
            ? selectedCourseId
            : fetchedCourses[0]?.id || "";
      setSelectedCourseId(nextSelectedId);
    } catch (error: any) {
      alert(error.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await apiGet<{ users: Student[] }>("/admin/users");
      setStudents(res.users || []);
    } catch (error: any) {
      alert(error.message || "Failed to load students");
    }
  };

  const loadAssignments = async (courseId: string) => {
    if (!courseId) {
      setAssignedUserIds([]);
      setSelectedUserIds([]);
      return;
    }

    try {
      const res = await apiGet<{ userIds: string[] }>(`/admin/courses/${courseId}/assignments`);
      const nextAssigned = res.userIds || [];
      setAssignedUserIds(nextAssigned);
      setSelectedUserIds(nextAssigned);
    } catch (error: any) {
      alert(error.message || "Failed to load assigned students");
      setAssignedUserIds([]);
      setSelectedUserIds([]);
    }
  };

  const loadMaterials = async (courseId: string) => {
    if (!courseId) {
      setMaterials([]);
      setSelectedMaterialId("");
      return;
    }

    setLoadingMaterials(true);
    try {
      const res = await apiGet<{ materials: CourseMaterial[] }>(`/admin/courses/${courseId}/materials`);
      const fetchedMaterials = res.materials || [];
      setMaterials(fetchedMaterials);
      setSelectedMaterialId((current) =>
        current && fetchedMaterials.some((material) => material.id === current)
          ? current
          : fetchedMaterials[0]?.id || ""
      );
    } catch (error: any) {
      alert(error.message || "Failed to load course material");
      setMaterials([]);
      setSelectedMaterialId("");
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadStudents();
  }, []);

  useEffect(() => {
    loadAssignments(selectedCourseId);
    loadMaterials(selectedCourseId);
  }, [selectedCourseId]);

  const resetCourseForm = () => {
    setCourseForm(emptyCourseForm);
    setEditingCourseId(null);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourseId) {
        const res = await apiPut<{ course: Course }>(`/admin/courses/${editingCourseId}`, courseForm);
        await loadCourses(res.course.id);
      } else {
        const res = await apiPost<{ course: Course }>("/admin/courses", courseForm);
        await loadCourses(res.course.id);
      }
      resetCourseForm();
    } catch (error: any) {
      alert(error.message || "Failed to save course");
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseForm({ name: course.name, description: course.description || "" });
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    variant?: DialogVariant;
    icon?: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDeleteCourse = (courseId: string) => {
    const target = courses.find((c) => c.id === courseId);
    setConfirmDialog({
      isOpen: true,
      title: "Delete Course Curriculum?",
      message: (
        <span>
          Are you sure you want to delete {target ? <strong>"{target.name}"</strong> : "this course"}? This action cannot be undone.
        </span>
      ),
      confirmText: "Yes, Delete Course",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiDelete(`/admin/courses/${courseId}`);
          if (selectedCourseId === courseId) {
            setSelectedCourseId("");
          }
          await loadCourses();
          resetCourseForm();
        } catch (error: any) {
          console.error(error);
        }
      },
    });
  };

  const handleSyncAssignments = async () => {
    if (!selectedCourseId) {
      alert("Select a course first");
      return;
    }
    setSavingAssignments(true);
    try {
      const res = await apiPut<{ userIds: string[]; message: string }>(`/admin/courses/${selectedCourseId}/assignments`, {
        userIds: selectedUserIds,
      });
      setAssignedUserIds(res.userIds || []);
      setSelectedUserIds(res.userIds || []);
      await loadCourses(selectedCourseId);
      alert(res.message || "Assignments updated");
    } catch (error: any) {
      alert(error.message || "Failed to update course assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  return (
    <div className="course-management">
      <div className="page-header">
        <div>
          <h2>Course Management</h2>
          <p className="cm-subtitle">Create a course, assign students, and the Day 1, Day 2, and Day 3 course pages will be available automatically to assigned learners.</p>
        </div>
      </div>

      <div className="cm-grid">
        <section className="cm-card cm-card-full">
          <div className="cm-card-header">
            <h3>{editingCourseId ? "Edit Course" : "Create Course"}</h3>
          </div>
          <form className="cm-form" onSubmit={handleSaveCourse}>
            <label>
              Course Name
              <input
                type="text"
                value={courseForm.name}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </label>
            <div className="cm-actions">
              <button type="submit" className="primary-btn">
                {editingCourseId ? "Update Course" : "Create Course"}
              </button>
              {editingCourseId && (
                <button type="button" className="secondary-btn" onClick={resetCourseForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="cm-card">
          <div className="cm-card-header">
            <h3>Courses</h3>
            <span className="cm-muted">{loading ? "Loading..." : `${courses.length} total`}</span>
          </div>
          <div className="cm-course-list">
            {courses.length === 0 && <div className="cm-empty">No courses yet.</div>}
            {courses.map((course) => (
              <div
                key={course.id}
                className={`cm-course-item ${selectedCourseId === course.id ? "active" : ""}`}
                onClick={() => setSelectedCourseId(course.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCourseId(course.id);
                  }
                }}
              >
                <div>
                  <strong>{course.name}</strong>
                  <p>{course.description || "No description added yet."}</p>
                </div>
                <div className="cm-course-meta">
                  <span>{course.assignmentCount} assigned</span>
                  <div className="cm-inline-actions">
                    <button
                      type="button"
                      className="cm-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourseId(course.id);
                      }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="cm-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditCourse(course);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="cm-link danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourse(course.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="cm-grid">
        <section className="cm-card">
          <div className="cm-card-header">
            <h3>Assign Course</h3>
            <div className="cm-card-header-actions">
              <button className={`cm-filter-toggle ${showAssignFilters ? "active" : ""}`} type="button" onClick={() => setShowAssignFilters((prev) => !prev)}>
                <span className="cm-filter-toggle-icon" aria-hidden="true">{showAssignFilters ? "−" : "+"}</span>
                <span className="cm-filter-toggle-label">{showAssignFilters ? "Hide Filters" : "Show Filters"}</span>
                {activeAssignFilterCount > 0 && <span className="cm-filter-toggle-count">{activeAssignFilterCount}</span>}
              </button>
              <span className="cm-muted">{selectedCourse ? selectedCourse.name : "Select a course"}</span>
            </div>
          </div>
          <div className={`cm-assign-panel ${!selectedCourse ? "disabled" : ""}`}>
            {!selectedCourse && (
              <div className="cm-empty">
                Select a course first. After that, choose the students who should be able to open the course materials.
              </div>
            )}
            {showAssignFilters && (
              <div className="cm-filters-panel">
                <div className="cm-filter-bar">
                  <ValueHelpField label="Search Students" placeholder="Search by name, user ID, email, stream, college" value={studentSearch} options={studentSearchOptions} onChange={setStudentSearch} allowFreeText disabled={!selectedCourse} />
                  <ValueHelpField label="Stream" placeholder="All Streams" value={streamFilter} options={streamOptions} onChange={setStreamFilter} disabled={!selectedCourse} />
                  <ValueHelpField label="College" placeholder="All Colleges" value={collegeFilter} options={collegeOptions} onChange={setCollegeFilter} disabled={!selectedCourse} />
                  <ValueHelpField label="Status" placeholder="Active Only" value={statusFilter} options={statusOptions} onChange={(value) => setStatusFilter(value as "active" | "inactive" | "all")} disabled={!selectedCourse} />
                </div>
              </div>
            )}
            <div className="cm-selection-meta">
              <span>{filteredStudents.length} students shown</span>
              <span>{assignedUserIds.length} currently assigned</span>
              <button
                type="button"
                className="secondary-btn"
                disabled={!selectedCourse}
                onClick={() =>
                  setSelectedUserIds((prev) => {
                    if (areAllFilteredStudentsSelected) {
                      return prev.filter((userId) => !filteredStudentIds.includes(userId));
                    }
                    return Array.from(new Set([...prev, ...filteredStudentIds]));
                  })
                }
              >
                {areAllFilteredStudentsSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="cm-assignment-summary">
              <span>{assignmentChanges.added.length} to add</span>
              <span>{assignmentChanges.removed.length} to remove</span>
              <span>{selectedUserIds.length} selected</span>
            </div>
            <div className="cm-student-list">
              {filteredStudents.map((student) => {
                const checked = selectedUserIds.includes(student.userId);
                const alreadyAssigned = assignedUserIds.includes(student.userId);
                return (
                  <label key={student.id} className={`cm-student-item ${alreadyAssigned ? "assigned" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectedCourse}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedUserIds((prev) =>
                          isChecked ? Array.from(new Set([...prev, student.userId])) : prev.filter((id) => id !== student.userId)
                        );
                      }}
                    />
                    <span>{student.name}</span>
                    <small>{student.userId}</small>
                    <small>{student.courseStream || "No stream"}</small>
                    <small>{student.collegeName || "No college"}</small>
                    <small>{alreadyAssigned ? "Assigned" : "Not assigned"}</small>
                  </label>
                );
              })}
            </div>
            <button className="primary-btn" type="button" onClick={handleSyncAssignments} disabled={!selectedCourse || savingAssignments}>
              {savingAssignments ? "Saving..." : "Save Course Assignments"}
            </button>
          </div>
        </section>
      </div>

      <div className="cm-grid">
        <section className="cm-card">
          <div className="cm-card-header">
            <h3>Preview Course Material</h3>
            <span className="cm-muted">{selectedCourse ? selectedCourse.name : "Select a course"}</span>
          </div>

          {!selectedCourse ? (
            <div className="cm-empty">Select a course to preview its day-wise material.</div>
          ) : loadingMaterials ? (
            <div className="cm-empty">Loading course material...</div>
          ) : sortedMaterials.length === 0 ? (
            <div className="cm-empty">No material is available for this course yet.</div>
          ) : (
            <div className="cm-preview-panel">
              <div className="cm-preview-toolbar">
                {sortedMaterials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    className={`cm-preview-chip ${selectedMaterial?.id === material.id ? "active" : ""}`}
                    onClick={() => setSelectedMaterialId(material.id)}
                  >
                    Day {material.dayNumber}
                  </button>
                ))}
              </div>

              {selectedMaterial && (
                <div className="cm-preview-body">
                  {selectedLesson ? (
                    <LessonView lesson={selectedLesson} material={selectedMaterial} />
                  ) : (
                    <article className="student-material-card">
                      <div className="student-material-day">Day {selectedMaterial.dayNumber}</div>
                      <div className="student-material-content">
                        <h4>{selectedMaterial.title}</h4>
                        {selectedMaterial.summary && <p className="student-material-summary">{selectedMaterial.summary}</p>}
                        <p>{selectedMaterial.content || "Course material shared for this day is available below."}</p>
                      </div>
                    </article>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* In-Screen Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default CourseManagement;
