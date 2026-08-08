import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../services/api";
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

const ExamCategoryManagement:React.FC=()=>{
  const [categories,setCategories]=useState<ExamCategory[]>([]);
  const [name,setName]=useState("");
  const [addModalOpen,setAddModalOpen]=useState(false);
  const [modalSubcategories, setModalSubcategories] = useState<Array<{ name: string; stages: string }>>([
    { name: "", stages: "Prelims, Mains" }
  ]);

  const [drafts,setDrafts]=useState<Record<string,{name:string;stages:string}>>({});
  const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState(false);
  const [feedback,setFeedback]=useState<{type:"success"|"error";text:string}|null>(null);

  const load=async()=>{
    setLoading(true);
    try {
      const res=await apiGet<{categories:ExamCategory[]}>("/admin/exam-categories");
      setCategories(res.categories||[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); },[]);

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

  const addCategory=async()=>{
    const categoryName=name.trim();
    if(!categoryName||adding){
      if(!categoryName) alert("Please enter a category name.");
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
    } catch(error:any) {
      setFeedback({type:"error",text:error?.message||"Category could not be added."});
    } finally {
      setAdding(false);
    }
  };

  const addSubcategory=async(categoryId:string)=>{
    const draft=drafts[categoryId]||{name:"",stages:"Prelims, Mains"};
    if(!draft.name.trim()) return;
    try {
      await apiPost(`/admin/exam-categories/${categoryId}/subcategories`,{
        name:draft.name.trim(),
        stages:draft.stages.split(",").map(v=>v.trim()).filter(Boolean)
      });
      setDrafts(current=>({...current,[categoryId]:{name:"",stages:"Prelims, Mains"}}));
      await load();
    } catch(error:any) {
      alert(error?.message||"Subcategory could not be added");
    }
  };

  const editCategory=async(category:ExamCategory)=>{
    const next=window.prompt("Category name",category.name)?.trim();
    if(!next||next===category.name) return;
    try {
      await apiPut(`/admin/exam-categories/${category.id}`,{name:next,order:category.order,isActive:category.isActive});
      await load();
    } catch(error:any) {
      alert(error?.message||"Category could not be updated");
    }
  };

  const removeCategory=async(category:ExamCategory)=>{
    if(!window.confirm(`Delete ${category.name}?`)) return;
    try {
      await apiDelete(`/admin/exam-categories/${category.id}`);
      await load();
    } catch(error:any) {
      if (window.confirm(`Category "${category.name}" contains assigned tests. Would you like to force delete it and unassign the tests?`)) {
        try {
          await apiDelete(`/admin/exam-categories/${category.id}?force=true`);
          await load();
        } catch(err:any) {
          alert(err?.message || "Category could not be deleted");
        }
      }
    }
  };

  const editSubcategory=async(category:ExamCategory,sub:ExamSubcategory)=>{
    const nextName=window.prompt("Subcategory name",sub.name)?.trim();
    if(!nextName) return;
    const stages=window.prompt("Stages separated by commas",sub.stages.join(", "));
    if(stages===null) return;
    try {
      await apiPut(`/admin/exam-categories/${category.id}/subcategories/${sub.id}`,{
        name:nextName,
        stages:stages.split(",").map(v=>v.trim()).filter(Boolean),
        isActive:sub.isActive!==false
      });
      await load();
    } catch(error:any) {
      alert(error?.message||"Subcategory could not be updated");
    }
  };

  const removeSubcategory=async(category:ExamCategory,sub:ExamSubcategory)=>{
    if(!window.confirm(`Delete ${sub.name}?`)) return;
    try {
      await apiDelete(`/admin/exam-categories/${category.id}/subcategories/${sub.id}`);
      await load();
    } catch(error:any) {
      if (window.confirm(`Subcategory "${sub.name}" contains assigned tests. Would you like to force delete it and unassign the tests?`)) {
        try {
          await apiDelete(`/admin/exam-categories/${category.id}/subcategories/${sub.id}?force=true`);
          await load();
        } catch(err:any) {
          alert(err?.message || "Subcategory could not be deleted");
        }
      }
    }
  };

  return (
    <section className="category-admin-page">
      <header className="category-page-header">
        <div>
          <span className="category-kicker">EXAM STRUCTURE</span>
          <h1>Exam Categories</h1>
          <p>Manage the hierarchy used in My Tests and during test creation.</p>
        </div>
        <button className="add-category-btn" onClick={openCreateModal}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add category
        </button>
      </header>

      {feedback && (
        <div className={`category-feedback ${feedback.type}`}>
          {feedback.type === "success" ? "✓" : "!"} {feedback.text}
        </div>
      )}

      <div className="category-summary">
        <div><span>Categories</span><strong>{categories.length}</strong></div>
        <div><span>Subcategories</span><strong>{categories.reduce((sum,item)=>sum+item.subcategories.length,0)}</strong></div>
        <div><span>Stages</span><strong>{categories.reduce((sum,item)=>sum+item.subcategories.reduce((count,sub)=>count+sub.stages.length,0),0)}</strong></div>
      </div>

      {loading ? (
        <div className="category-empty">Loading exam structure…</div>
      ) : categories.length === 0 ? (
        <div className="category-empty">No categories yet. Click <strong>+ Add category</strong> above to create your first category.</div>
      ) : (
        <div className="category-grid">
          {categories.map((category,index)=>(
            <article key={category.id} className="category-card">
              <div className="category-card-head">
                <span>{String(index+1).padStart(2,"0")}</span>
                <div>
                  <h2>{category.name}</h2>
                  <small>{category.subcategories.length} subcategories</small>
                </div>
                <button onClick={()=>editCategory(category)}>Edit</button>
                <button className="danger" onClick={()=>removeCategory(category)}>Delete</button>
              </div>

              <div className="subcategory-list">
                {category.subcategories.map(sub=>(
                  <div key={sub.id} className="subcategory-row">
                    <div className="subcategory-main-info">
                      <strong>{sub.name}</strong>
                      <div className="sub-stage-badges">
                        {sub.stages.map(stage=><i key={stage}>{stage}</i>)}
                      </div>
                    </div>
                    <div className="sub-row-actions">
                      <button className="sub-edit-btn" onClick={()=>editSubcategory(category,sub)}>Edit</button>
                      <button className="sub-delete-btn" onClick={()=>removeSubcategory(category,sub)} title="Delete subcategory">Delete</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="add-subcategory">
                <div className="add-sub-inputs-top">
                  <input 
                    value={drafts[category.id]?.name||""} 
                    onChange={e=>setDrafts({...drafts,[category.id]:{name:e.target.value,stages:drafts[category.id]?.stages||"Prelims, Mains"}})} 
                    placeholder="Subcategory name (e.g. RBI Grade B, SSC CGL)"
                    className="add-sub-name-input"
                  />
                  <button className="add-sub-submit-btn" onClick={()=>addSubcategory(category.id)}>+ Add Subcategory</button>
                </div>

                <div className="add-sub-options-row">
                  <select 
                    value={
                      STAGE_PRESETS.find(p => p.value === (drafts[category.id]?.stages || "Prelims, Mains"))?.value || "custom"
                    }
                    onChange={e => {
                      if (e.target.value !== "custom") {
                        setDrafts({ ...drafts, [category.id]: { name: drafts[category.id]?.name || "", stages: e.target.value } });
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
                    {AVAILABLE_STAGES.slice(0, 6).map(stage => {
                      const currentStages = (drafts[category.id]?.stages || "Prelims, Mains").split(",").map(s => s.trim()).filter(Boolean);
                      const isSelected = currentStages.includes(stage);
                      return (
                        <button
                          key={stage}
                          type="button"
                          className={`stage-pill ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            const newList = isSelected
                              ? currentStages.filter(s => s !== stage)
                              : [...currentStages, stage];
                            setDrafts({
                              ...drafts,
                              [category.id]: {
                                name: drafts[category.id]?.name || "",
                                stages: newList.join(", "),
                              },
                            });
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
          ))}
        </div>
      )}

      {/* Add Category + Subcategories Modal Popup */}
      {addModalOpen && (
        <div className="category-modal-backdrop" onMouseDown={() => setAddModalOpen(false)}>
          <div className="category-modal" onMouseDown={e => e.stopPropagation()}>
            <header className="category-modal-header">
              <div>
                <span>CREATE EXAM CATEGORY</span>
                <h2>Add New Category</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setAddModalOpen(false)}>×</button>
            </header>

            <form onSubmit={e => { e.preventDefault(); void addCategory(); }} className="category-modal-body">
              <label>
                Category Name
                <input 
                  autoFocus 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Railway, Banking, SSC, UPSC" 
                  required
                />
              </label>

              {/* Optional Subcategories Section */}
              <div className="modal-subcategories-section">
                <div className="modal-sub-head">
                  <label>Subcategories (Optional)</label>
                  <button type="button" className="add-sub-row-btn" onClick={addModalSubRow}>
                    + Add Subcategory
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
    </section>
  );
};

export default ExamCategoryManagement;
