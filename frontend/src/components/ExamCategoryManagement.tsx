import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import PromptDialog from "./PromptDialog";
import AlertDialog, { AlertVariant } from "./AlertDialog";
import "./ExamCategoryManagement.css";

export interface ExamSubcategory { id:string;name:string;slug:string;stages:string[];isActive?:boolean }
export interface ExamCategory { id:string;name:string;slug:string;order:number;isActive:boolean;subcategories:ExamSubcategory[] }

const AVAILABLE_STAGES = ["Prelims", "Mains", "Interview", "Tier 1", "Tier 2", "Phase 1", "Phase 2", "Physical Test"];

const STAGE_PRESETS = [
  { label: "Prelims & Mains", value: "Prelims, Mains" },
  { label: "Prelims, Mains & Interview", value: "Prelims, Mains, Interview" },
  { label: "Tier 1 & Tier 2", value: "Tier 1, Tier 2" },
  { label: "Tier 1, Tier 2 & Tier 3", value: "Tier 1, Tier 2, Tier 3" },
  { label: "Phase 1 & Phase 2", value: "Phase 1, Phase 2" },
  { label: "Single Stage Exam", value: "Single Exam" }
];

const ExamCategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [name, setName] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [modalSubcategories, setModalSubcategories] = useState<Array<{ name: string; stages: string }>>([
    { name: "", stages: "Prelims, Mains" }
  ]);

  const [drafts, setDrafts] = useState<Record<string,{name:string;stages:string}>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{type:"success"|"error";text:string}|null>(null);

  // In-Screen Custom Modal Dialog States
  const [promptDialog, setPromptDialog] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    defaultValue: string;
    placeholder?: string;
    confirmText?: string;
    icon?: string;
    onConfirm: (val: string) => Promise<void>;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText: string;
    variant: DialogVariant;
    icon?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    variant?: AlertVariant;
    icon?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{categories:ExamCategory[]}>("/admin/exam-categories");
      setCategories(res.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalSubcategories = categories.reduce((sum, cat) => sum + cat.subcategories.length, 0);
  const totalStages = categories.reduce(
    (sum, cat) => sum + cat.subcategories.reduce((sSum, sub) => sSum + sub.stages.length, 0),
    0
  );

  const addModalSubRow = () => {
    setModalSubcategories(prev => [...prev, { name: "", stages: "Prelims, Mains" }]);
  };

  const removeModalSubRow = (index: number) => {
    setModalSubcategories(prev => prev.filter((_, i) => i !== index));
  };

  const updateModalSubRow = (index: number, field: "name" | "stages", value: string) => {
    setModalSubcategories(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const toggleStageInSubRow = (index: number, stage: string) => {
    setModalSubcategories(prev => prev.map((sub, i) => {
      if (i !== index) return sub;
      const currentList = sub.stages.split(",").map(s => s.trim()).filter(Boolean);
      const newList = currentList.includes(stage)
        ? currentList.filter(s => s !== stage)
        : [...currentList, stage];
      return { ...sub, stages: newList.join(", ") };
    }));
  };

  const openCreateModal = () => {
    setName("");
    setModalSubcategories([{ name: "", stages: "Prelims, Mains" }]);
    setAddModalOpen(true);
  };

  const addCategory = async () => {
    const categoryName = name.trim();
    if (!categoryName || adding) {
      if (!categoryName) {
        setAlertDialog({
          isOpen: true,
          title: "Category Name Required",
          message: "Please enter a valid name for the new exam category.",
          variant: "warning",
          icon: "⚠️"
        });
      }
      return;
    }
    setAdding(true);
    setFeedback(null);
    try {
      const res = await apiPost<{ category: ExamCategory }>("/admin/exam-categories", {
        name: categoryName,
        order: categories.length
      });
      const categoryId = res.category?.id;

      let subCount = 0;
      if (categoryId && modalSubcategories.length > 0) {
        for (const sub of modalSubcategories) {
          if (sub.name.trim()) {
            await apiPost(`/admin/exam-categories/${categoryId}/subcategories`, {
              name: sub.name.trim(),
              stages: sub.stages.split(",").map(v => v.trim()).filter(Boolean)
            });
            subCount++;
          }
        }
      }

      setName("");
      setModalSubcategories([{ name: "", stages: "Prelims, Mains" }]);
      setAddModalOpen(false);
      await load();
      setFeedback({
        type: "success",
        text: `Category "${categoryName}" ${subCount > 0 ? `and ${subCount} subcategory(ies)` : ""} created successfully.`
      });
    } catch(error: any) {
      setFeedback({type:"error", text: error?.message || "Category could not be added."});
    } finally {
      setAdding(false);
    }
  };

  const addSubcategory = async (categoryId: string) => {
    const draft = drafts[categoryId] || { name: "", stages: "Prelims, Mains" };
    if (!draft.name.trim()) return;
    try {
      await apiPost(`/admin/exam-categories/${categoryId}/subcategories`, {
        name: draft.name.trim(),
        stages: draft.stages.split(",").map(v => v.trim()).filter(Boolean)
      });
      setDrafts(current => ({ ...current, [categoryId]: { name: "", stages: "Prelims, Mains" } }));
      await load();
    } catch(error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Error Adding Subcategory",
        message: error?.message || "Subcategory could not be added.",
        variant: "danger",
        icon: "🚫"
      });
    }
  };

  const editCategory = (category: ExamCategory) => {
    setPromptDialog({
      isOpen: true,
      title: "Rename Exam Category",
      message: `Update name for category: ${category.name}`,
      defaultValue: category.name,
      placeholder: "e.g. Banking, SSC, Railway",
      confirmText: "Update Category",
      icon: "📁",
      onConfirm: async (nextName) => {
        if (!nextName || nextName === category.name) return;
        try {
          await apiPut(`/admin/exam-categories/${category.id}`, {
            name: nextName,
            order: category.order,
            isActive: category.isActive
          });
          await load();
        } catch(error: any) {
          setAlertDialog({
            isOpen: true,
            title: "Update Failed",
            message: error?.message || "Category could not be updated",
            variant: "danger"
          });
        }
      }
    });
  };

  const removeCategory = (category: ExamCategory) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Exam Category",
      message: (
        <>
          Are you sure you want to delete category <strong>"{category.name}"</strong>?
          <br />
          This will also remove all associated subcategories and exam stage assignments.
        </>
      ),
      confirmText: "Yes, Delete Category",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        try {
          await apiDelete(`/admin/exam-categories/${category.id}`);
          await load();
        } catch(error: any) {
          setConfirmDialog({
            isOpen: true,
            title: "Category Contains Tests",
            message: (
              <>
                Category <strong>"{category.name}"</strong> contains active assigned tests.
                <br /><br />
                Would you like to <strong>force delete</strong> it and unassign the tests?
              </>
            ),
            confirmText: "Force Delete & Unassign",
            variant: "danger",
            icon: "⚠️",
            onConfirm: async () => {
              try {
                await apiDelete(`/admin/exam-categories/${category.id}?force=true`);
                await load();
              } catch(err: any) {
                setAlertDialog({
                  isOpen: true,
                  title: "Delete Failed",
                  message: err?.message || "Category could not be deleted",
                  variant: "danger"
                });
              }
            }
          });
        }
      }
    });
  };

  const editSubcategory = (category: ExamCategory, sub: ExamSubcategory) => {
    setPromptDialog({
      isOpen: true,
      title: "Edit Subcategory Name",
      message: `Updating subcategory in ${category.name}`,
      defaultValue: sub.name,
      placeholder: "e.g. SBI Clerk, IBPS PO",
      confirmText: "Next: Edit Stages",
      icon: "📑",
      onConfirm: async (nextName) => {
        if (!nextName) return;
        setPromptDialog({
          isOpen: true,
          title: `Edit Exam Stages for "${nextName}"`,
          message: "Enter exam stages separated by commas (e.g. Prelims, Mains, Interview):",
          defaultValue: sub.stages.join(", "),
          placeholder: "Prelims, Mains",
          confirmText: "Save Subcategory",
          icon: "🎯",
          onConfirm: async (stagesStr) => {
            try {
              await apiPut(`/admin/exam-categories/${category.id}/subcategories/${sub.id}`, {
                name: nextName,
                stages: stagesStr.split(",").map(v => v.trim()).filter(Boolean),
                isActive: sub.isActive !== false
              });
              await load();
            } catch(error: any) {
              setAlertDialog({
                isOpen: true,
                title: "Update Failed",
                message: error?.message || "Subcategory could not be updated",
                variant: "danger"
              });
            }
          }
        });
      }
    });
  };

  const removeSubcategory = (category: ExamCategory, sub: ExamSubcategory) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Subcategory",
      message: (
        <>
          Are you sure you want to delete subcategory <strong>"{sub.name}"</strong> from <strong>{category.name}</strong>?
        </>
      ),
      confirmText: "Yes, Delete Subcategory",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        try {
          await apiDelete(`/admin/exam-categories/${category.id}/subcategories/${sub.id}`);
          await load();
        } catch(error: any) {
          setConfirmDialog({
            isOpen: true,
            title: "Subcategory Contains Tests",
            message: (
              <>
                Subcategory <strong>"{sub.name}"</strong> contains assigned tests.
                <br /><br />
                Would you like to <strong>force delete</strong> it and unassign the tests?
              </>
            ),
            confirmText: "Force Delete & Unassign",
            variant: "danger",
            icon: "⚠️",
            onConfirm: async () => {
              try {
                await apiDelete(`/admin/exam-categories/${category.id}/subcategories/${sub.id}?force=true`);
                await load();
              } catch(err: any) {
                setAlertDialog({
                  isOpen: true,
                  title: "Delete Failed",
                  message: err?.message || "Subcategory could not be deleted",
                  variant: "danger"
                });
              }
            }
          });
        }
      }
    });
  };

  return (
    <section className="category-admin-page">
      <header className="category-page-header">
        <div>
          <span className="category-kicker">EXAM STRUCTURE</span>
          <h1>Exam Categories</h1>
          <p>Manage the hierarchy used in My Tests and during test creation.</p>
        </div>
        <button type="button" className="add-category-btn" onClick={openCreateModal}>
          + Add Category
        </button>
      </header>

      {feedback && (
        <div className={`category-feedback ${feedback.type}`}>
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="category-summary">
        <div>
          <span>Total Categories</span>
          <strong>{categories.length}</strong>
        </div>
        <div>
          <span>Total Subcategories</span>
          <strong>{totalSubcategories}</strong>
        </div>
        <div>
          <span>Configured Stages</span>
          <strong>{totalStages}</strong>
        </div>
      </div>

      {loading ? (
        <div className="category-empty">Loading categories...</div>
      ) : categories.length === 0 ? (
        <div className="category-empty">
          <p>No exam categories yet. Click "+ Add Category" above to create your first exam structure.</p>
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((category, index) => {
            const draft = drafts[category.id] || { name: "", stages: "Prelims, Mains" };
            return (
              <article key={category.id} className="category-card">
                <div className="category-card-head">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{category.name}</h2>
                    <small>{category.subcategories.length} subcategories</small>
                  </div>
                  <button type="button" onClick={() => editCategory(category)}>Edit</button>
                  <button type="button" className="danger" onClick={() => removeCategory(category)}>Delete</button>
                </div>

                <div className="subcategory-list">
                  {category.subcategories.length === 0 ? (
                    <div style={{ padding: "16px 8px", color: "#94a3b8", fontSize: "13px" }}>No subcategories added yet.</div>
                  ) : (
                    category.subcategories.map(sub => (
                      <div key={sub.id} className="subcategory-row">
                        <div className="subcategory-main-info">
                          <strong>{sub.name}</strong>
                          <div className="sub-stage-badges">
                            {sub.stages.map(stage => (
                              <i key={stage}>{stage}</i>
                            ))}
                          </div>
                        </div>
                        <div className="sub-row-actions">
                          <button type="button" className="sub-edit-btn" onClick={() => editSubcategory(category, sub)}>Edit</button>
                          <button type="button" className="sub-delete-btn" onClick={() => removeSubcategory(category, sub)}>Delete</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="add-subcategory">
                  <div className="add-sub-inputs-top">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => setDrafts(current => ({
                        ...current,
                        [category.id]: { ...draft, name: e.target.value }
                      }))}
                      placeholder="Subcategory name (e.g. RBI Grade B, SSC CGL)"
                      className="add-sub-name-input"
                    />
                    <button
                      type="button"
                      className="add-sub-submit-btn"
                      disabled={!draft.name.trim()}
                      onClick={() => addSubcategory(category.id)}
                    >
                      + Add Subcategory
                    </button>
                  </div>

                  <div className="add-sub-options-row">
                    <select
                      value={STAGE_PRESETS.find(p => p.value === draft.stages)?.value || "custom"}
                      onChange={e => {
                        if (e.target.value !== "custom") {
                          setDrafts(current => ({
                            ...current,
                            [category.id]: { ...draft, stages: e.target.value }
                          }));
                        }
                      }}
                      className="card-stage-select"
                    >
                      {STAGE_PRESETS.map(preset => (
                        <option key={preset.value} value={preset.value}>{preset.label}</option>
                      ))}
                      <option value="custom">Custom Selection…</option>
                    </select>

                    <div className="card-stage-pills-row">
                      {AVAILABLE_STAGES.map(stage => {
                        const currentList = draft.stages.split(",").map(s => s.trim()).filter(Boolean);
                        const isSelected = currentList.includes(stage);
                        return (
                          <button
                            key={stage}
                            type="button"
                            className={`stage-pill ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              const newList = isSelected
                                ? currentList.filter(s => s !== stage)
                                : [...currentList, stage];
                              setDrafts(current => ({
                                ...current,
                                [category.id]: { ...draft, stages: newList.join(", ") }
                              }));
                            }}
                          >
                            {isSelected ? "✓ " : "+ "}{stage}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Category Modal */}
      {addModalOpen && (
        <div className="category-modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="category-modal" onClick={e => e.stopPropagation()}>
            <header className="category-modal-header">
              <div>
                <span>NEW EXAM CATEGORY</span>
                <h2>Create Category & Subcategories</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setAddModalOpen(false)}>✕</button>
            </header>

            <form onSubmit={e => { e.preventDefault(); addCategory(); }} className="category-modal-body">
              <label>Category Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Banking, SSC, Railway, State PSC"
                required
                autoFocus
              />

              <div className="modal-subcategories-section">
                <div className="modal-sub-head">
                  <label>Subcategories & Stages</label>
                  <button type="button" className="add-sub-row-btn" onClick={addModalSubRow}>
                    + Add Another Subcategory
                  </button>
                </div>
                <p className="modal-sub-desc">Select stage presets or toggle stages like Prelims & Mains with 1 click.</p>

                {modalSubcategories.map((sub, idx) => (
                  <div key={idx} className="modal-sub-block">
                    <div className="modal-sub-row">
                      <input 
                        type="text" 
                        value={sub.name} 
                        onChange={e => updateModalSubRow(idx, "name", e.target.value)} 
                        placeholder="Subcategory name (e.g. RRB NTPC, SBI PO)"
                        className="modal-sub-name-input"
                      />
                      <select 
                        value={
                          STAGE_PRESETS.find(p => p.value === sub.stages)?.value || "custom"
                        }
                        onChange={e => {
                          if (e.target.value !== "custom") {
                            updateModalSubRow(idx, "stages", e.target.value);
                          }
                        }}
                        className="modal-sub-preset-select"
                      >
                        {STAGE_PRESETS.map(preset => (
                          <option key={preset.value} value={preset.value}>{preset.label}</option>
                        ))}
                        <option value="custom">Custom Selection…</option>
                      </select>
                      {modalSubcategories.length > 1 && (
                        <button type="button" className="remove-sub-row-btn" onClick={() => removeModalSubRow(idx)}>✕</button>
                      )}
                    </div>

                    <div className="stage-pills-row">
                      <span className="stage-pills-label">Stages:</span>
                      {AVAILABLE_STAGES.map(stage => {
                        const currentList = sub.stages.split(",").map(s => s.trim()).filter(Boolean);
                        const isSelected = currentList.includes(stage);
                        return (
                          <button
                            key={stage}
                            type="button"
                            className={`stage-pill ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleStageInSubRow(idx, stage)}
                          >
                            {isSelected ? "✓ " : "+ "}{stage}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <footer className="category-modal-footer">
                <button type="button" className="modal-cancel-btn" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-save-btn" disabled={adding || !name.trim()}>
                  {adding ? "Creating…" : "Create Category"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Screen Center Custom Prompt Dialog */}
      {promptDialog && (
        <PromptDialog
          isOpen={promptDialog.isOpen}
          title={promptDialog.title}
          message={promptDialog.message}
          defaultValue={promptDialog.defaultValue}
          placeholder={promptDialog.placeholder}
          confirmText={promptDialog.confirmText}
          icon={promptDialog.icon}
          onConfirm={async (val) => {
            const cb = promptDialog.onConfirm;
            setPromptDialog(null);
            await cb(val);
          }}
          onCancel={() => setPromptDialog(null)}
        />
      )}

      {/* Screen Center Custom Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={async () => {
            const cb = confirmDialog.onConfirm;
            setConfirmDialog(null);
            await cb();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Screen Center Custom Alert Dialog */}
      {alertDialog && (
        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          variant={alertDialog.variant}
          icon={alertDialog.icon}
          onClose={() => setAlertDialog(null)}
        />
      )}
    </section>
  );
};

export default ExamCategoryManagement;
