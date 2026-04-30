import React, { useState } from 'react';

const CadastroUsuario = () => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    permissao: 'leitor'
  });
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Recupera usuários já salvos ou cria array vazio
    const usuariosAtuais = JSON.parse(localStorage.getItem('usuariosObra')) || [];
    
    // Adiciona o novo usuário com um ID único
    const novoUsuario = { ...formData, id: Date.now() };
    const novaLista = [...usuariosAtuais, novoUsuario];

    // Salva no LocalStorage
    localStorage.setItem('usuariosObra', JSON.stringify(novaLista));

    setStatus(`Usuário ${formData.nome} cadastrado com sucesso!`);
    
    // Limpa o formulário
    setFormData({ nome: '', email: '', permissao: 'leitor' });

    // Remove a mensagem de status após 3 segundos
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div style={styles.container}>
      <h2>Cadastro de Autorização</h2>
      <p>Defina quem pode exibir ou editar os relatos do diário.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          name="nome"
          placeholder="Nome do Colaborador"
          value={formData.nome}
          onChange={handleChange}
          required
          style={styles.input}
        />

        <input
          type="email"
          name="email"
          placeholder="E-mail de Acesso"
          value={formData.email}
          onChange={handleChange}
          required
          style={styles.input}
        />

        <label style={styles.label}>Nível de Acesso:</label>
        <select 
          name="permissao" 
          value={formData.permissao} 
          onChange={handleChange} 
          style={styles.select}
        >
          <option value="leitor">👀 Leitor (Apenas visualizar)</option>
          <option value="editor">✍️ Editor (Criar e editar relatos)</option>
        </select>

        <button type="submit" style={styles.button}>
          Autorizar Acesso
        </button>
      </form>

      {status && <div style={styles.alert}>{status}</div>}
    </div>
  );
};

// Estilização rápida para teste (Pode mover para um arquivo CSS)
const styles = {
  container: { padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  input: { padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ccc' },
  select: { padding: '12px', fontSize: '16px', borderRadius: '8px' },
  label: { marginBottom: '-10px', fontSize: '14px', fontWeight: 'bold' },
  button: { padding: '15px', backgroundColor: '#2ecc71', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  alert: { marginTop: '20px', padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', textAlign: 'center', borderRadius: '5px' }
};

export default CadastroUsuario;
