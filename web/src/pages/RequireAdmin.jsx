import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/** ログイン済みでなければログイン画面に飛ばす */
export default function RequireAdmin({ children }) {
  const [state, setState] = useState('loading');
  const location = useLocation();

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setState(user ? 'in' : 'out');
  }), []);

  if (state === 'loading') return <div className="spinner">読み込んでいます…</div>;
  if (state === 'out') return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  return children;
}
