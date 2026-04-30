import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);

  // Simula a verificação de sessão ao carregar o app
  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuarioLogado');
    if (usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
    }
  }, []);

  const login = (email) => {
    // Busca na nossa "base" do LocalStorage
    const usuarios = JSON.parse(localStorage.getItem('usuariosObra')) || [];
    const userFound = usuarios.find(u => u.email === email);

    if (userFound) {
      setUsuario(userFound);
      localStorage.setItem('usuarioLogado', JSON.stringify(userFound));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUsuario(null);
    localStorage.removeItem('usuarioLogado');
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, isEditor: usuario?.permissao === 'editor' }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para facilitar o uso
export const useAuth = () => useContext(AuthContext);
