import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CustomerView from "@/pages/CustomerView";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    setIsAuthenticated(!!token);
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CustomerView />} />
          <Route path="/admin/login" element={<AdminLogin setIsAuthenticated={setIsAuthenticated} />} />
          <Route 
            path="/admin/dashboard" 
            element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/admin/login" />} 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;