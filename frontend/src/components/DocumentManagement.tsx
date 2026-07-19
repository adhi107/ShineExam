import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ValueHelpField from "./ValueHelpField";
import "./DocumentManagement.css";

interface Doc { id:string;title:string;description:string;originalName:string;size:number;createdAt:string;assignedCount:number;assignedUserIds:string[] }
interface Student { name:string;userId:string;email:string;isActive:boolean }

const DocumentManagement: React.FC = () => {
  const [documents,setDocuments]=useState<Doc[]>([]);
  const [students,setStudents]=useState<Student[]>([]);
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [uploading,setUploading]=useState(false);
  const [assigning,setAssigning]=useState<Doc|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [studentSearch,setStudentSearch]=useState("");
  const [documentSearch,setDocumentSearch]=useState("");
  const [fileType,setFileType]=useState("all");
  const [assignment,setAssignment]=useState("all");

  const load=async()=>{const [docs,users]=await Promise.all([apiGet<{documents:Doc[]}>("/admin/documents"),apiGet<{users:Student[]}>("/admin/users")]);setDocuments(docs.documents||[]);setStudents(users.users||[])};
  useEffect(()=>{load().catch(console.error)},[]);
  const visibleStudents=useMemo(()=>{const query=normalizeSearchText(studentSearch);return students.filter(student=>normalizeSearchText(`${student.name} ${student.userId} ${student.email}`).includes(query))},[students,studentSearch]);
  const filteredDocuments=useMemo(()=>documents.filter(doc=>{const matchesSearch=normalizeSearchText(`${doc.title} ${doc.description} ${doc.originalName}`).includes(normalizeSearchText(documentSearch));const extension=doc.originalName.split(".").pop()?.toLowerCase()||"";const matchesType=fileType==="all"||(fileType==="pdf"?extension==="pdf":fileType==="image"?["png","jpg","jpeg"].includes(extension):!["pdf","png","jpg","jpeg"].includes(extension));const matchesAssignment=assignment==="all"||(assignment==="assigned"?doc.assignedCount>0:doc.assignedCount===0);return matchesSearch&&matchesType&&matchesAssignment}),[documents,documentSearch,fileType,assignment]);

  const upload=async()=>{if(!title.trim()||!file)return;setUploading(true);try{const body=new FormData();body.append("title",title.trim());body.append("description",description.trim());body.append("file",file);await apiPostForm("/admin/documents",body);setTitle("");setDescription("");setFile(null);await load()}catch(error:any){alert(error?.message||"Upload failed")}finally{setUploading(false)}};
  const openAssign=(doc:Doc)=>{setAssigning(doc);setSelected(doc.assignedUserIds||[]);setStudentSearch("")};
  const saveAssignments=async()=>{if(!assigning)return;try{await apiPost(`/admin/documents/${assigning.id}/assign`,{userIds:selected});setAssigning(null);await load()}catch(error:any){alert(error?.message||"Assignment failed")}};
  const remove=async(doc:Doc)=>{if(!window.confirm(`Delete ${doc.title}?`))return;try{await apiDelete(`/admin/documents/${doc.id}`);await load()}catch(error:any){alert(error?.message||"Delete failed")}};
  const size=(bytes:number)=>bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`;

  return <section className="document-admin">
    <header><div><span>LEARNING RESOURCES</span><h1>Documents</h1><p>Upload study material and assign it to selected students.</p></div></header>
    <div className="document-upload-card"><div><h2>Upload a document</h2><p>PDF, Office documents, text and images.</p></div><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Document title"/><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description"/><label className="file-picker polished-file-picker"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" onChange={e=>setFile(e.target.files?.[0]||null)}/><b>↑ Choose file</b><span>{file?file.name:"No file selected"}</span></label><button disabled={uploading||!file||!title.trim()} onClick={upload}>{uploading?"Uploading…":"Upload document →"}</button></div>
    <div className="document-filters value-help-document-filters"><ValueHelpField label="Search Documents" placeholder="Search title or filename" value={documentSearch} options={documents.map(document=>({value:document.title,label:document.title,keywords:[document.originalName,document.description]}))} onChange={setDocumentSearch} allowFreeText/><ValueHelpField label="File Type" placeholder="All file types" value={fileType} options={[{value:"all",label:"All file types"},{value:"pdf",label:"PDF"},{value:"image",label:"Images"},{value:"other",label:"Office & other"}]} onChange={setFileType}/><ValueHelpField label="Assignment" placeholder="All documents" value={assignment} options={[{value:"all",label:"All documents"},{value:"assigned",label:"Assigned"},{value:"unassigned",label:"Not assigned"}]} onChange={setAssignment}/><button onClick={()=>{setDocumentSearch("");setFileType("all");setAssignment("all")}}>Clear filters</button></div>
    <div className="document-grid">{filteredDocuments.map(doc=><article key={doc.id}><div className="document-type">DOC</div><div className="document-copy"><h3>{doc.title}</h3><p>{doc.description||doc.originalName}</p><span>{doc.originalName} • {size(doc.size)}</span></div><div className="document-assigned"><strong>{doc.assignedCount}</strong><span>students</span></div><button onClick={()=>openAssign(doc)}>Assign</button><button className="danger" onClick={()=>remove(doc)}>Delete</button></article>)}{filteredDocuments.length===0&&<div className="document-empty">No documents match these filters.</div>}</div>
    {assigning&&<div className="document-modal-backdrop" onMouseDown={()=>setAssigning(null)}><div className="document-modal" onMouseDown={e=>e.stopPropagation()}><header><div><span>ASSIGN DOCUMENT</span><h2>{assigning.title}</h2></div><button onClick={()=>setAssigning(null)}>×</button></header><ValueHelpField label="Search Students" placeholder="Search name, username or email" value={studentSearch} options={students.map(student=>({value:student.name,label:student.name,keywords:[student.userId,student.email]}))} onChange={setStudentSearch} allowFreeText/><label className="select-all"><input type="checkbox" checked={visibleStudents.length>0&&visibleStudents.every(s=>selected.includes(s.userId))} onChange={e=>setSelected(e.target.checked?Array.from(new Set([...selected,...visibleStudents.map(s=>s.userId)])):selected.filter(id=>!visibleStudents.some(s=>s.userId===id)))}/> Select all visible students</label><div className="document-students">{visibleStudents.map(student=><label key={student.userId}><input type="checkbox" checked={selected.includes(student.userId)} onChange={e=>setSelected(e.target.checked?[...selected,student.userId]:selected.filter(id=>id!==student.userId))}/><span>{student.name}<small>{student.userId} • {student.email}</small></span></label>)}</div><footer><span>{selected.length} selected</span><button onClick={saveAssignments}>Assign document</button></footer></div></div>}
  </section>;
};
export default DocumentManagement;
