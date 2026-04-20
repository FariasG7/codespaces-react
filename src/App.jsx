import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [texto, setTexto] = useState(localStorage.getItem('diario_texto') || '');
  const [gravando, setGravando] = useState(false);
  const [clima, setClima] = useState('Buscando localização...');
  const [fotos, setFotos] = useState([]);
  const [status, setStatus] = useState('Aguardando...');
  
  const recognitionRef = useRef(null);
  const wakeLockRef = useRef(null);

  // --- FUNÇÃO DE CLIMA ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Mock de clima enquanto você não coloca a API Key
        setClima(`📍 Lat: ${latitude.toFixed(2)} | Lon: ${longitude.toFixed(2)}`);
      }, () => setClima("GPS desativado"));
    }
  }, []);

  // --- CONFIGURAÇÃO DE VOZ ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setTexto((prev) => prev + transcript + '\n');
      };
      recognitionRef.current = recognition;
    }
  }, []);

  // --- SALVAMENTO AUTOMÁTICO ---
  useEffect(() => {
    localStorage.setItem('diario_texto', texto);
  }, [texto]);

  const alternarGravacao = async () => {
    if (!gravando) {
      try {
        if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen');
        recognitionRef.current.start();
        setGravando(true);
        setStatus('🟢 Gravando...');
      } catch (err) { setStatus('Erro: ' + err.message); }
    } else {
      recognitionRef.current.stop();
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
      setGravando(false);
      setStatus('✅ Texto guardado.');
    }
  };

  const tirarFoto = (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) {
      const reader = new FileReader();
      reader.onloadend = () => setFotos((prev) => [...prev, reader.result]);
      reader.readAsDataURL(arquivo);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🏗️ ObraVoz</h1>
        <div className="clima-badge">{clima}</div>
      </header>

      <main className="content">
        <div className="card">
          <div className="info-topo">
            <span>📅 {new Date().toLocaleDateString('pt-BR')}</span>
            <button onClick={() => {setTexto(''); setFotos([]); localStorage.clear();}} className="btn-limpar">Limpar</button>
          </div>
          
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Relate a execução..."
            className="textarea"
          />
          
          <div className="acoes">
            <button onClick={alternarGravacao} className={`btn-main ${gravando ? 'btn-stop' : 'btn-start'}`}>
              {gravando ? '🛑 Parar' : '🎤 Gravar Voz'}
            </button>

            <label htmlFor="input-foto" className="btn-foto">
              📷 Foto
            </label>
            <input id="input-foto" type="file" accept="image/*" capture="environment" onChange={tirarFoto} style={{ display: 'none' }} />
          </div>

          <p className="status-label">{status}</p>

          <div className="galeria">
            {fotos.map((foto, index) => (
              <img key={index} src={foto} className="foto-preview" alt="Obra" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
