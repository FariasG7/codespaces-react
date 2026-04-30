import React, { useState, useEffect, useRef, useCallback } from 'react';
import { jsPDF } from "jspdf";
import './App.css';
import { FaMicrophone, FaCamera, FaPaperclip, FaRegFilePdf, FaPlus, FaSignOutAlt, FaTrash } from 'react-icons/fa';
import { AuthProvider, useAuth } from './context/AuthContext';

// --- COMPONENTE DE LOGIN ---
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aqui você integraria com sua API ou AuthContext
    // Por enquanto, simulando validação simples
    if (email && senha) {
      onLogin(true);
    } else {
      alert("Preencha os campos corretamente.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🏗️ ObraVoz</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <input className="login-input" type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="login-input" type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} required />
          <button type="submit" className="btn-login">Entrar</button>
        </form>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
function MainContent() {
  const { usuario, logout } = useAuth(); // Usando o hook do seu Contexto
  
  // --- ESTADOS DE DADOS ---
  const [texto, setTexto] = useState(() => localStorage.getItem('diario_texto') || '');
  const [fotos, setFotos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('diario_fotos')) || []; } catch { return []; }
  });
  const [linhasCofragem, setLinhasCofragem] = useState(() => {
    try { return JSON.parse(localStorage.getItem('diario_cofragem')) || [{ peca: '', largura: '', altura: '', comprimento: '' }]; } catch { return [{ peca: '', largura: '', altura: '', comprimento: '' }]; }
  });
  const [linhasBetao, setLinhasBetao] = useState(() => {
    try { return JSON.parse(localStorage.getItem('diario_betao')) || [{ elemento: '', largura: '', altura: '', comprimento: '' }]; } catch { return [{ elemento: '', largura: '', altura: '', comprimento: '' }]; }
  });

  const [status, setStatus] = useState('Aguardando...');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');

  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    localStorage.setItem('diario_texto', texto);
    localStorage.setItem('diario_fotos', JSON.stringify(fotos));
    localStorage.setItem('diario_cofragem', JSON.stringify(linhasCofragem));
    localStorage.setItem('diario_betao', JSON.stringify(linhasBetao));
  }, [texto, fotos, linhasCofragem, linhasBetao]);

  // --- CLIMA ---
  const buscarClima = useCallback(async () => {
    if (!navigator.geolocation) return setClima("GPS off");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=5d69641538ee4295a9ffc578b22ad484&units=metric&lang=pt_br`);
        const data = await res.json();
        setClima(`🌡️ ${Math.round(data.main.temp)}°C | ${data.weather[0].description}`);
      } catch { setClima("Erro Clima"); }
    });
  }, []);

  useEffect(() => {
    buscarClima();
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Speech) {
      const rec = new Speech();
      rec.lang = 'pt-BR';
      rec.continuous = true;
      rec.onresult = (e) => {
        const result = e.results[e.results.length - 1][0].transcript;
        setTexto(prev => prev + (prev ? ' ' : '') + result);
      };
      rec.onend = () => setGravando(false);
      recognitionRef.current = rec;
    }
  }, [buscarClima]);

  // --- AÇÕES ---
  const alternarGravacao = async () => {
    if (!recognitionRef.current) return alert("Voz não suportada neste navegador.");
    if (!gravando) {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Gravando...');
      } catch { setStatus('Erro microfone'); }
    } else {
      recognitionRef.current.stop();
      wakeLockRef.current?.release();
      setGravando(false);
      setStatus('✅ Áudio processado');
    }
  };

  const handleFoto = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setFotos(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const atualizarCampo = (index, tabela, campo, valor) => {
    const setter = tabela === 'cofragem' ? setLinhasCofragem : setLinhasBetao;
    const lista = tabela === 'cofragem' ? [...linhasCofragem] : [...linhasBetao];
    lista[index][campo] = valor;
    setter(lista);
  };

  const gerarPDF = () => {
    try {
      const doc = new jsPDF();
      const largura = doc.internal.pageSize.getWidth();
      
      // Cabeçalho Simples
      doc.setFontSize(18);
      doc.text("RELATÓRIO DIÁRIO DE OBRA", 15, 20);
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString()}`, largura - 15, 15, { align: 'right' });
      doc.text(`Clima: ${clima.replace(/[^\x00-\x7F]/g, "")}`, largura - 15, 22, { align: 'right' });
      doc.line(15, 28, largura - 15, 28);

      // Relato
      doc.setFontSize(12);
      doc.setTextColor(0, 102, 204);
      doc.text("RELATO:", 15, 38);
      doc.setTextColor(0);
      const textSplit = doc.splitTextToSize(texto || "Sem relato informado.", largura - 30);
      doc.text(textSplit, 15, 45);

      // Tabelas e Fotos (Lógica simplificada para brevidade)
      // ... (Mantenha sua lógica de loop de tabelas aqui)

      doc.save(`Relatorio_${Date.now()}.pdf`);
      setStatus("✅ PDF Pronto!");
    } catch (err) {
      setStatus("❌ Erro no PDF");
    }
  };

    // --- FUNÇÕES QUE ESTAVAM FALTANDO ---
  const adicionarLinha = () => {
    setLinhasCofragem([...linhasCofragem, { peca: '', largura: '', altura: '', comprimento: '' }]);
  };

  const removerLinha = (index) => {
    const novaLista = linhasCofragem.filter((_, i) => i !== index);
    setLinhasCofragem(novaLista);
  };

  const removerFoto = (index) => {
    setFotos(fotos.filter((_, i) => i !== index));
  };


  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <textarea 
            value={texto} 
            onChange={(e) => setTexto(e.target.value)} 
            placeholder="Relate o que aconteceu hoje..." 
            className="textarea" 
          />
          
          <div className="card-tabelas">
            <h3>📐 Cofragem (m²)</h3>
            {linhasCofragem.map((l, i) => (
    <div key={i} className="linha-cofragem">
      <input className="input-peca" placeholder="Peça (Ex: P1)" value={l.peca} onChange={e => atualizarCampo(i, 'peca', e.target.value)}/>
      <div className="inputs-medidas">
        <div className="campo-container">
          <label>L</label>
          <input type="number" value={l.largura} onChange={e => atualizarCampo(i, 'largura', e.target.value)} />
        </div>
        <div className="campo-container">
          <label>A</label>
          <input type="number" value={l.altura} onChange={e => atualizarCampo(i, 'altura', e.target.value)} />
        </div>
        <div className="campo-container">
          <label>C</label>
          <input type="number" value={l.comprimento} onChange={e => atualizarCampo(i, 'comprimento', e.target.value)} />
        </div>
        <button className="btn-remover-linha" onClick={() => removerLinha(i)}>
          <FaTrash size={14} />
        </button>
      </div>
    </div>
  ))}
  <button onClick={adicionarLinha} className="btn-add">
    <FaPlus /> Peça
  </button>
</div>

<div className="acoes">
  <button onClick={alternarGravacao} className={`icon-btn btn-mic ${gravando ? 'recording' : ''}`}><FaMicrophone /></button>
  <label className="icon-btn btn-cam"><FaCamera /><input type="file" accept="image/*" capture="environment" onChange={handleFoto} hidden /></label>
  <label className="icon-btn btn-clip"><FaPaperclip /><input type="file" accept="image/*" multiple onChange={handleFoto} hidden /></label>
</div>

{/* Galeria posicionada acima do botão Gerar Relatório */}
{fotos.length > 0 && (
  <div className="galeria-preview">
    {fotos.map((f, i) => (
      <div key={i} className="foto-item">
        <img src={f} alt="obra" />
        <button className="btn-remover-foto" onClick={() => removerFoto(i)}>×</button>
      </div>
    ))}
  </div>
)}

<button className="btn-finalizar">
  <FaRegFilePdf /> Gerar Relatório
</button>

<button onClick={logout} className="btn-sair">
  <FaSignOutAlt /> Sair
</button>
      </main>
    </div>
  );
};

// --- EXPORT PRINCIPAL COM PROVIDER ---
export default function App() {
  return (
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

function AuthConsumer() {
  const { logado, login } = useAuth(); // Supondo que seu AuthContext tenha esses valores
  // Se não tiver, você pode usar um estado local:
  const [estaLogado, setEstaLogado] = useState(() => localStorage.getItem('app_logado') === 'true');

  const handleLogin = (val) => {
    setEstaLogado(val);
    localStorage.setItem('app_logado', val);
  };

  return estaLogado ? <MainContent /> : <Login onLogin={handleLogin} />;
}
