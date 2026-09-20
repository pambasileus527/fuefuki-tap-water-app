import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Resume from './pages/Resume';
import Apply from './pages/Apply';
import Start from './pages/Start';
import AdminLogin from './pages/AdminLogin';
import AdminHome from './pages/AdminHome';
import AdminNewForm from './pages/AdminNewForm';
import AdminFormDetail from './pages/AdminFormDetail';
import RequireAdmin from './pages/RequireAdmin';

export default function App() {
  return (
    <>
      <header className="site">
        <Link to="/">申請フォーム</Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/apply/:applicantId" element={<Apply />} />
          <Route path="/start/:formId" element={<Start />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<RequireAdmin><AdminHome /></RequireAdmin>} />
          <Route path="/admin/new" element={<RequireAdmin><AdminNewForm /></RequireAdmin>} />
          <Route path="/admin/forms/:formId" element={<RequireAdmin><AdminFormDetail /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
