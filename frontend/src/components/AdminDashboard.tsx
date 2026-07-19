import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserManagement from "./UserManagement";
import TestBuilder from "./TestBuilder";
import TestEditor from "./TestEditor";
import TestList from "./TestList";
import TestResults from "./TestResults";
import ExamCategoryManagement from "./ExamCategoryManagement";
import DocumentManagement from "./DocumentManagement";
import AnnouncementManagement from "./AnnouncementManagement";
import ShineLogo from "./ShineLogo";
import AppIcon from "./AppIcons";
import { apiGet, apiPost } from "../services/api";
import "./AdminDashboard.css";
import "./AdminPolish.css";

type AdminView="dashboard"|"users"|"categories"|"documents"|"announcements"|"tests"|"create-test"|"edit-test"|"results";
const paths:Record<AdminView,string>={dashboard:"/admin",users:"/admin/users",categories:"/admin/exam-categories",documents:"/admin/documents",announcements:"/admin/announcements",tests:"/admin/tests","create-test":"/admin/tests/create","edit-test":"/admin/tests/edit",results:"/admin/results"};
const views:Record<string,AdminView>={"/admin":"dashboard","/admin/users":"users","/admin/exam-categories":"categories","/admin/documents":"documents","/admin/announcements":"announcements","/admin/tests":"tests","/admin/tests/create":"create-test","/admin/tests/edit":"edit-test","/admin/results":"results"};
interface RecentAttempt{id:string;userId:string;testName:string;percentage:number;passed:boolean;submittedAt:string}
interface DashboardStats{totalUsers:number;activeUsers:number;blockedUsers:number;totalTests:number;activeTests:number;totalAttempts:number;completedAttempts:number;averageScore:number;passRate:number;recentAttempts:RecentAttempt[]}
interface Props{adminName:string;onLogout:()=>void}
const initialStats:DashboardStats={totalUsers:0,activeUsers:0,blockedUsers:0,totalTests:0,activeTests:0,totalAttempts:0,completedAttempts:0,averageScore:0,passRate:0,recentAttempts:[]};

const AdminDashboard:React.FC<Props>=({adminName,onLogout})=>{
  const navigate=useNavigate();const location=useLocation();const currentView=views[location.pathname]||"dashboard";
  const go=(view:AdminView)=>navigate(paths[view]);
  const [editingTestId,setEditingTestId]=useState<string|null>(null);
  const [stats,setStats]=useState(initialStats);
  const [showPassword,setShowPassword]=useState(false);const [oldPassword,setOldPassword]=useState("");const [newPassword,setNewPassword]=useState("");const [confirmPassword,setConfirmPassword]=useState("");const [savingPassword,setSavingPassword]=useState(false);
  useEffect(()=>{if(currentView==="dashboard")apiGet<DashboardStats>("/admin/dashboard-stats").then(setStats).catch(console.error)},[currentView]);
  const closePassword=()=>{setShowPassword(false);setOldPassword("");setNewPassword("");setConfirmPassword("")};
  const changePassword=async()=>{if(!oldPassword||newPassword.length<4||newPassword!==confirmPassword){alert("Enter the current password and matching new passwords of at least 4 characters.");return}setSavingPassword(true);try{await apiPost("/auth/change-password",{userId:adminName,role:"admin",oldPassword,newPassword});closePassword();alert("Password changed successfully.")}catch(error:any){alert(error?.message||"Password could not be changed.")}finally{setSavingPassword(false)}};
  const render=()=>{if(currentView==="users")return <UserManagement/>;if(currentView==="categories")return <ExamCategoryManagement/>;if(currentView==="documents")return <DocumentManagement/>;if(currentView==="announcements")return <AnnouncementManagement/>;if(currentView==="create-test")return <TestBuilder onBack={()=>go("tests")}/>;if(currentView==="edit-test")return editingTestId?<TestEditor testId={editingTestId} onBack={()=>go("tests")}/>:<TestList onCreateNew={()=>go("create-test")} onEditTest={id=>{setEditingTestId(id);go("edit-test")}}/>;if(currentView==="tests")return <TestList onCreateNew={()=>go("create-test")} onEditTest={id=>{setEditingTestId(id);go("edit-test")}}/>;if(currentView==="results")return <TestResults/>;return <AdminHome adminName={adminName} stats={stats} go={go}/>};
  return <div className="shine-admin-shell"><aside className="shine-admin-sidebar"><div className="admin-brand"><ShineLogo/><span>ADMIN CONSOLE</span></div><nav><Nav active={currentView==="dashboard"} icon="dashboard" label="Dashboard" onClick={()=>go("dashboard")}/><Nav active={currentView==="users"} icon="users" label="Students" onClick={()=>go("users")}/><Nav active={currentView==="categories"} icon="categories" label="Exam Categories" onClick={()=>go("categories")}/><Nav active={["tests","create-test","edit-test"].includes(currentView)} icon="tests" label="Tests" onClick={()=>go("tests")}/><Nav active={currentView==="documents"} icon="documents" label="Documents" onClick={()=>go("documents")}/><Nav active={currentView==="announcements"} icon="documents" label="Announcements" onClick={()=>go("announcements")}/><Nav active={currentView==="results"} icon="results" label="Analytics" onClick={()=>go("results")}/></nav><div className="admin-sidebar-user"><div><span>{adminName.charAt(0).toUpperCase()}</span><p><strong>{adminName}</strong><small>Administrator</small></p></div><button onClick={()=>setShowPassword(true)}>Change password</button><button className="admin-signout" onClick={onLogout}>Sign out</button></div></aside><main className="shine-admin-main">{render()}</main>{showPassword&&<div className="admin-password-backdrop" onMouseDown={closePassword}><section onMouseDown={event=>event.stopPropagation()}><header><div><span>ACCOUNT SECURITY</span><h2>Change password</h2></div><button onClick={closePassword}>×</button></header><label>Current password<input type="password" value={oldPassword} onChange={event=>setOldPassword(event.target.value)}/></label><label>New password<input type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label><label>Confirm password<input type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}/></label><footer><button onClick={closePassword}>Cancel</button><button disabled={savingPassword} onClick={changePassword}>{savingPassword?"Updating…":"Update password"}</button></footer></section></div>}</div>;
};
const Nav=({active,icon,label,onClick}:any)=><button className={active?"active":""} onClick={onClick}><AppIcon name={icon}/><span>{label}</span></button>;
const AdminHome=({adminName,stats,go}:{adminName:string;stats:DashboardStats;go:(view:AdminView)=>void})=>{
  const cards=[
    ["Students",stats.totalUsers,"Registered candidate accounts","users","users"],
    ["Active students",stats.activeUsers,"Candidates allowed to sign in","users","users"],
    ["Blocked students",stats.blockedUsers,"Accounts requiring attention","users","users"],
    ["Published tests",stats.activeTests,`${stats.totalTests} tests in total`,"tests","tests"],
    ["Completed attempts",stats.completedAttempts,`${stats.totalAttempts} attempts started`,"results","completed"],
    ["Average score",`${stats.averageScore.toFixed(1)}%`,"Across every completed paper","results","results"],
    ["Overall pass rate",`${stats.passRate.toFixed(1)}%`,"Candidate success rate","results","completed"],
    ["Pending attempts",Math.max(0,stats.totalAttempts-stats.completedAttempts),"Tests currently in progress","results","tests"],
  ] as any[];
  return <section className="admin-home"><header><div><span>SHINE EXAM OPERATIONS</span><h1>Good day, {adminName}</h1><p>Manage students, publish papers and monitor examination performance.</p></div><div><small>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</small><button onClick={()=>go("create-test")}>+ Create test</button></div></header><div className="admin-command-bar"><button onClick={()=>go("users")}><span>01</span><div><strong>Manage students</strong><small>Edit or control candidate access</small></div><b>→</b></button><button onClick={()=>go("tests")}><span>02</span><div><strong>Manage papers</strong><small>Create, edit and assign exams</small></div><b>→</b></button><button onClick={()=>go("results")}><span>03</span><div><strong>Open analytics</strong><small>Review scores and performance</small></div><b>→</b></button></div><div className="admin-dashboard-cards">{cards.map(([label,value,help,target,icon])=><button key={label} onClick={()=>go(target)}><div><AppIcon name={icon}/><span>Open →</span></div><small>{label}</small><strong>{value}</strong><p>{help}</p></button>)}</div><div className="admin-home-lower"><article><header><div><h2>Recent student activity</h2><p>Latest completed examination attempts.</p></div><button onClick={()=>go("results")}>View all analytics →</button></header>{stats.recentAttempts.length===0?<div className="admin-no-activity">No completed attempts yet.</div>:<div className="recent-attempts">{stats.recentAttempts.map(attempt=><button key={attempt.id} onClick={()=>go("results")}><span>{attempt.userId.charAt(0).toUpperCase()}</span><div><strong>{attempt.userId}</strong><small>{attempt.testName}</small></div><b>{attempt.percentage.toFixed(1)}%</b><em className={attempt.passed?"pass":"fail"}>{attempt.passed?"Passed":"Review"}</em><time>{attempt.submittedAt?new Date(attempt.submittedAt).toLocaleDateString("en-IN"):"—"}</time></button>)}</div>}</article><aside><h2>Exam readiness</h2><div><span>Student access</span><strong>{stats.totalUsers?Math.round(stats.activeUsers/stats.totalUsers*100):0}%</strong><i><b style={{width:`${stats.totalUsers?stats.activeUsers/stats.totalUsers*100:0}%`}}/></i></div><div><span>Published papers</span><strong>{stats.totalTests?Math.round(stats.activeTests/stats.totalTests*100):0}%</strong><i><b style={{width:`${stats.totalTests?stats.activeTests/stats.totalTests*100:0}%`}}/></i></div><div><span>Attempt completion</span><strong>{stats.totalAttempts?Math.round(stats.completedAttempts/stats.totalAttempts*100):0}%</strong><i><b style={{width:`${stats.totalAttempts?stats.completedAttempts/stats.totalAttempts*100:0}%`}}/></i></div></aside></div></section>;
};
export default AdminDashboard;
